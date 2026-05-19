import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { persistAccountBalances } from "@/lib/account-balances";

/**
 * POST /api/transactions/refresh-status
 *
 * Marks every transaction whose date is in the future as `pending`, and every
 * past-dated transaction currently flagged as `pending` as `completed` (its
 * scheduled date has passed — assume it actually happened).
 *
 * Useful after early imports where everything was forced to 'completed'.
 * Recalculates the balance AND balance_predicted of every account belonging
 * to the user — status changes affect both numbers.
 */
export async function POST() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    // Use Maputo local time (UTC+2) so a transaction scheduled for "today"
    // doesn't get auto-promoted to completed at midnight UTC (02:00 local).
    const now = new Date();
    const maputo = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const today = maputo.toISOString().split("T")[0]!;

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

    // Recalc balance + balance_predicted for every account affected
    const touched = new Set<string>();
    for (const r of [...(futurePromoted || []), ...(pastCompleted || [])] as { account_id: string | null; transfer_to_account_id: string | null }[]) {
      if (r.account_id) touched.add(r.account_id);
      if (r.transfer_to_account_id) touched.add(r.transfer_to_account_id);
    }
    if (touched.size > 0) {
      await persistAccountBalances(supabase, user.id, touched);
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
