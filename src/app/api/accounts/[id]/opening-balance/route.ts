import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * POST /api/accounts/[id]/opening-balance
 *
 * Two modes:
 *
 *   { current_real_balance: number }
 *     The user enters the real balance they currently see on their bank
 *     statement / mobile app. We compute the opening balance needed so that
 *     after summing all existing 'completed' transactions on this account,
 *     the resulting balance matches that real number.
 *
 *   { amount: number }
 *     Legacy: the user enters the opening balance directly (the value the
 *     account had before the first imported transaction).
 *
 * Either mode results in a single "Saldo de Abertura" income/expense row
 * dated one day before the earliest transaction on that account, replacing
 * any previous opening-balance marker.
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
    // so we can recompute cleanly without it polluting the totals
    await supabase
      .schema("money_schema")
      .from("transactions")
      .delete()
      .eq("user_id", user.id)
      .eq("account_id", id)
      .eq("description", "Saldo de Abertura");

    // Compute the actual opening-balance amount we need to insert
    let openingAmount: number;

    if (typeof body?.current_real_balance === "number" && Number.isFinite(body.current_real_balance)) {
      // Mode A: user gave the real balance — compute opening so totals match
      const realBalance = Number(body.current_real_balance);
      const sum = await sumTransactionsForAccount(supabase, user.id, id);
      openingAmount = realBalance - sum;
    } else if (typeof body?.amount === "number" && Number.isFinite(body.amount)) {
      // Mode B: explicit opening balance
      openingAmount = Number(body.amount);
    } else {
      return NextResponse.json({ error: "Tens de enviar 'current_real_balance' ou 'amount'" }, { status: 400 });
    }

    // Determine the date for the opening balance row: one day before the
    // earliest transaction on this account, otherwise today.
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

    if (openingAmount !== 0) {
      const isPositive = openingAmount > 0;
      const { error: insErr } = await supabase
        .schema("money_schema")
        .from("transactions")
        .insert({
          user_id: user.id,
          account_id: id,
          type: isPositive ? "income" : "expense",
          amount: Math.abs(openingAmount),
          currency: "MZN",
          description: "Saldo de Abertura",
          date: openingDate,
          status: "completed",
        });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // Recompute the account balance now that the opening row is in place
    const newBalance = await sumTransactionsForAccount(supabase, user.id, id);
    await supabase
      .schema("money_schema")
      .from("accounts")
      .update({ balance: newBalance })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, balance: newBalance, openingAmount });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

/**
 * Sums all 'completed' transactions affecting a single account
 * (income +, expense −, transfer out −, transfer in +).
 */
async function sumTransactionsForAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string
): Promise<number> {
  const { data: txs } = await supabase
    .schema("money_schema")
    .from("transactions")
    .select("account_id, transfer_to_account_id, type, amount, status")
    .eq("user_id", userId);

  let balance = 0;
  for (const tx of (txs || []) as {
    account_id: string | null;
    transfer_to_account_id: string | null;
    type: string;
    amount: number;
    status?: string | null;
  }[]) {
    if (tx.status && tx.status !== "completed") continue;
    const amt = Number(tx.amount) || 0;
    if (tx.account_id === accountId) {
      if (tx.type === "income") balance += amt;
      else if (tx.type === "expense" || tx.type === "transfer") balance -= amt;
    }
    if (tx.transfer_to_account_id === accountId && tx.type === "transfer") balance += amt;
  }
  return balance;
}
