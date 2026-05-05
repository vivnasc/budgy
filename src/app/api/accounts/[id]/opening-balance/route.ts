import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";

/**
 * POST /api/accounts/[id]/opening-balance
 * Body: { amount: number }
 *
 * Sets (or replaces) the "Saldo de Abertura" transaction for the given account.
 * This is stored as a regular `income` transaction with a marker description so
 * the running balance recalculation picks it up automatically.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await request.json();
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    // Confirm the account belongs to this user
    const { data: account } = await supabase
      .schema("money_schema")
      .from("accounts")
      .select("id, name")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    // Remove any existing opening-balance marker transactions for this account
    await supabase
      .schema("money_schema")
      .from("transactions")
      .delete()
      .eq("user_id", user.id)
      .eq("account_id", id)
      .eq("description", "Saldo de Abertura");

    // Determine a date for the opening balance: one day before the earliest
    // transaction on this account, otherwise today.
    const { data: earliest } = await supabase
      .schema("money_schema")
      .from("transactions")
      .select("date")
      .eq("user_id", user.id)
      .eq("account_id", id)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();

    let openingDate: string;
    if (earliest?.date) {
      const d = new Date(earliest.date + "T00:00:00");
      d.setDate(d.getDate() - 1);
      openingDate = d.toISOString().split("T")[0]!;
    } else {
      openingDate = new Date().toISOString().split("T")[0]!;
    }

    // Only insert a new opening-balance row if amount is non-zero
    if (amount !== 0) {
      const isPositive = amount > 0;
      const { error: insErr } = await supabase
        .schema("money_schema")
        .from("transactions")
        .insert({
          user_id: user.id,
          account_id: id,
          type: isPositive ? "income" : "expense",
          amount: Math.abs(amount),
          currency: "MZN",
          description: "Saldo de Abertura",
          date: openingDate,
        });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // Recalc balance for this single account
    const { data: txs } = await supabase
      .schema("money_schema")
      .from("transactions")
      .select("account_id, transfer_to_account_id, type, amount, status")
      .eq("user_id", user.id);

    let balance = 0;
    for (const tx of (txs || []) as { account_id: string | null; transfer_to_account_id: string | null; type: string; amount: number; status?: string | null }[]) {
      if (tx.status && tx.status !== "completed") continue;
      const amt = Number(tx.amount) || 0;
      if (tx.account_id === id) {
        if (tx.type === "income") balance += amt;
        else if (tx.type === "expense" || tx.type === "transfer") balance -= amt;
      }
      if (tx.transfer_to_account_id === id && tx.type === "transfer") balance += amt;
    }

    await supabase
      .schema("money_schema")
      .from("accounts")
      .update({ balance })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, balance });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
