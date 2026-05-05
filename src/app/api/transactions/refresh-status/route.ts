import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";

/**
 * POST /api/transactions/refresh-status
 *
 * Marks every transaction whose date is in the future as `pending`, and every
 * past-dated transaction currently flagged as `pending` as `completed` (its
 * scheduled date has passed — assume it actually happened).
 *
 * Useful after early imports where everything was forced to 'completed'.
 * Recalculates affected account balances afterwards.
 */
export async function POST() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const today = new Date().toISOString().split("T")[0]!;

    // 1) Future-dated → pending (only if currently 'completed')
    const { data: futurePromoted, error: futErr } = await supabase
      .schema("money_schema")
      .from("transactions")
      .update({ status: "pending" })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gt("date", today)
      .select("account_id, transfer_to_account_id");

    if (futErr) return NextResponse.json({ error: futErr.message }, { status: 500 });

    // 2) Past-dated 'pending' → completed (the scheduled day is gone)
    const { data: pastCompleted, error: pastErr } = await supabase
      .schema("money_schema")
      .from("transactions")
      .update({ status: "completed" })
      .eq("user_id", user.id)
      .eq("status", "pending")
      .lte("date", today)
      .select("account_id, transfer_to_account_id");

    if (pastErr) return NextResponse.json({ error: pastErr.message }, { status: 500 });

    // Recalc balances for every affected account (status changes affect totals)
    const touched = new Set<string>();
    for (const r of [...(futurePromoted || []), ...(pastCompleted || [])] as { account_id: string | null; transfer_to_account_id: string | null }[]) {
      if (r.account_id) touched.add(r.account_id);
      if (r.transfer_to_account_id) touched.add(r.transfer_to_account_id);
    }

    if (touched.size > 0) {
      const { data: txs } = await supabase
        .schema("money_schema")
        .from("transactions")
        .select("account_id, transfer_to_account_id, type, amount, status")
        .eq("user_id", user.id);

      const balances = new Map<string, number>();
      for (const id of touched) balances.set(id, 0);
      for (const tx of (txs || []) as { account_id: string | null; transfer_to_account_id: string | null; type: string; amount: number; status?: string | null }[]) {
        if (tx.status && tx.status !== "completed") continue;
        const amt = Number(tx.amount) || 0;
        if (tx.account_id && balances.has(tx.account_id)) {
          const cur = balances.get(tx.account_id)!;
          if (tx.type === "income") balances.set(tx.account_id, cur + amt);
          else if (tx.type === "expense" || tx.type === "transfer") balances.set(tx.account_id, cur - amt);
        }
        if (tx.transfer_to_account_id && balances.has(tx.transfer_to_account_id) && tx.type === "transfer") {
          const cur = balances.get(tx.transfer_to_account_id)!;
          balances.set(tx.transfer_to_account_id, cur + amt);
        }
      }

      await Promise.all(
        Array.from(balances.entries()).map(([id, balance]) =>
          supabase
            .schema("money_schema")
            .from("accounts")
            .update({ balance })
            .eq("id", id)
            .eq("user_id", user.id)
        )
      );
    }

    return NextResponse.json({
      success: true,
      promotedToPending: futurePromoted?.length ?? 0,
      promotedToCompleted: pastCompleted?.length ?? 0,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
