import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { persistAccountBalances, getBalanceForAccount } from "@/lib/account-balances";

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
      // Mode A: user gave the real balance — compute opening so totals match.
      // Note: we just deleted any existing opening row, so the current sum
      // does NOT include a previous opening balance.
      const realBalance = Number(body.current_real_balance);
      const { balance: sumWithoutOpening } = await getBalanceForAccount(supabase, user.id, id);
      openingAmount = realBalance - sumWithoutOpening;
    } else if (typeof body?.amount === "number" && Number.isFinite(body.amount)) {
      // Mode B: explicit opening balance
      openingAmount = Number(body.amount);
    } else {
      return NextResponse.json({ error: "Tens de enviar 'current_real_balance' ou 'amount'" }, { status: 400 });
    }

    // Âncora manual = o saldo REAL que a utilizadora vê no banco HOJE. Datamos
    // a âncora em HOJE e guardamos o alvo nas tags, para que fique autoritária:
    // importações posteriores de extratos (com data de fecho <= hoje) não a
    // sobrepõem — o "Acertar saldo" manual manda.
    const today = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().split("T")[0]!;
    const openingDate = today;
    const anchorTarget =
      typeof body?.current_real_balance === "number"
        ? Number(body.current_real_balance)
        : null;

    if (openingAmount !== 0) {
      const isPositive = openingAmount > 0;
      // Resolve (or create) the dedicated "Ajuste de Saldo" category so the
      // opening-balance row doesn't pollute the user's spending/income pies.
      const categoryId = await ensureAdjustmentCategory(supabase, user.id, isPositive ? "income" : "expense");
      const { error: insErr } = await supabase
        .schema("money_schema")
        .from("transactions")
        .insert({
          user_id: user.id,
          account_id: id,
          category_id: categoryId,
          type: isPositive ? "income" : "expense",
          amount: Math.abs(openingAmount),
          currency: "MZN",
          description: "Saldo de Abertura",
          date: openingDate,
          status: "completed",
          tags:
            anchorTarget !== null
              ? ["__saldo_anchor__", String(anchorTarget), openingDate]
              : undefined,
        });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // Recompute balance + balance_predicted for this account (single source
    // of truth for both fields)
    await persistAccountBalances(supabase, user.id, [id]);
    const { balance: newBalance, balance_predicted } = await getBalanceForAccount(
      supabase,
      user.id,
      id
    );

    return NextResponse.json({
      success: true,
      balance: newBalance,
      balance_predicted,
      openingAmount,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno do servidor";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Returns the id of the user's "Ajuste de Saldo" category, creating it if it
 * doesn't yet exist. This category is intentionally excluded from spending /
 * income breakdowns in the dashboard and reports.
 */
async function ensureAdjustmentCategory(
  supabase: SupabaseClient,
  userId: string,
  type: "income" | "expense"
): Promise<string | undefined> {
  const { data: existing } = await supabase
    .schema("money_schema")
    .from("categories")
    .select("id, type")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .ilike("name", "Ajuste de Saldo");

  const match = (existing as { id: string; type: string }[] | null)?.find((c) => c.type === type);
  if (match) return match.id;

  const { data: created } = await supabase
    .schema("money_schema")
    .from("categories")
    .insert({
      user_id: userId,
      name: "Ajuste de Saldo",
      type,
      icon: "scale",
      color: "#94A3B8",
      is_system: false,
    })
    .select("id")
    .single();
  return (created as { id: string } | null)?.id;
}

