import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PATCH /api/transactions/[id]
 * Update fields on a single transaction (description, amount, date, category, type).
 * Recalculates the affected accounts' balances after the update.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = (await request.json()) as Record<string, unknown>;

    // Fetch the existing row so we know which accounts are touched even
    // before the update (so we recalc them too if account_id changes).
    const { data: before, error: beforeErr } = await supabase
      .schema("money_schema")
      .from("transactions")
      .select("account_id, transfer_to_account_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (beforeErr || !before) {
      return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
    }

    // Optionally resolve a category by name if the client sent `category_name`
    let categoryId: string | undefined;
    if (typeof body.category_name === "string" && body.category_name.trim()) {
      categoryId = await ensureCategory(
        supabase,
        user.id,
        body.category_name.trim(),
        (body.type as string) === "income" ? "income" : "expense"
      );
    }

    const allowed: Record<string, unknown> = {};
    for (const k of ["description", "amount", "date", "type", "category_id", "is_recurring", "tags"]) {
      if (k in body) allowed[k] = body[k];
    }
    if (categoryId) allowed.category_id = categoryId;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "Sem campos para actualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .schema("money_schema")
      .from("transactions")
      .update(allowed)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, categories(*), accounts!transactions_account_id_fkey(*)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const touched = new Set<string>();
    if (before.account_id) touched.add(before.account_id);
    if (before.transfer_to_account_id) touched.add(before.transfer_to_account_id);
    await recalcAccountBalances(supabase, user.id, Array.from(touched));

    return NextResponse.json({ success: true, transaction: data });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

/**
 * DELETE /api/transactions/[id]
 * Removes a single transaction and recalculates balances of affected accounts.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: before } = await supabase
      .schema("money_schema")
      .from("transactions")
      .select("account_id, transfer_to_account_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    const { error } = await supabase
      .schema("money_schema")
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (before) {
      const touched: string[] = [];
      if (before.account_id) touched.push(before.account_id);
      if (before.transfer_to_account_id) touched.push(before.transfer_to_account_id);
      if (touched.length) await recalcAccountBalances(supabase, user.id, touched);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

async function ensureCategory(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  type: "income" | "expense"
): Promise<string | undefined> {
  const { data: existing } = await supabase
    .schema("money_schema")
    .from("categories")
    .select("id, name")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .ilike("name", name)
    .limit(1);

  const found = (existing as { id: string; name: string }[] | null)?.[0];
  if (found) return found.id;

  const { data: created } = await supabase
    .schema("money_schema")
    .from("categories")
    .insert({ user_id: userId, name, type, is_system: false })
    .select("id")
    .single();
  return (created as { id: string } | null)?.id;
}

async function recalcAccountBalances(
  supabase: SupabaseClient,
  userId: string,
  accountIds: string[]
): Promise<void> {
  if (accountIds.length === 0) return;

  const { data: txs } = await supabase
    .schema("money_schema")
    .from("transactions")
    .select("account_id, transfer_to_account_id, type, amount")
    .eq("user_id", userId);

  if (!txs) return;

  const balances = new Map<string, number>();
  for (const id of accountIds) balances.set(id, 0);

  for (const tx of txs as { account_id: string | null; transfer_to_account_id: string | null; type: string; amount: number }[]) {
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
        .eq("user_id", userId)
    )
  );
}
