import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { persistAccountBalances } from "@/lib/account-balances";

/**
 * POST /api/transactions/remove-duplicates
 *
 * Remove APENAS transações duplicadas — mantém uma de cada, apaga as repetidas.
 * NÃO apaga dados válidos: uma transação só é considerada duplicada de outra se
 * tiver a MESMA conta + data + valor + tipo + descrição. Assim limpa a confusão
 * de imports repetidos sem perder histórico real.
 *
 * As âncoras "Saldo de Abertura" nunca são tocadas.
 *
 * Query/body opcional: { dryRun: true } devolve só a contagem, sem apagar.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;

    // Lê TODAS as transações (paginado — o Supabase corta às 1000).
    const PAGE = 1000;
    type Row = {
      id: string;
      account_id: string | null;
      transfer_to_account_id: string | null;
      type: string;
      amount: number;
      date: string | null;
      description: string | null;
    };
    const rows: Row[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase
        .schema("money_schema")
        .from("transactions")
        .select("id, account_id, transfer_to_account_id, type, amount, date, description")
        .eq("user_id", user.id)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const batch = (data || []) as Row[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }

    // Agrupa por assinatura exacta. Mantém a primeira (id mais baixo), marca as
    // restantes para remoção. Nunca toca nas âncoras de saldo.
    const norm = (s: string | null) =>
      (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const seen = new Set<string>();
    const toDelete: string[] = [];
    const affectedAccounts = new Set<string>();
    for (const r of rows) {
      if (r.description === "Saldo de Abertura") continue;
      const sig = [
        r.account_id ?? "",
        r.transfer_to_account_id ?? "",
        r.type,
        Math.round((Number(r.amount) || 0) * 100),
        r.date ?? "",
        norm(r.description),
      ].join("|");
      if (seen.has(sig)) {
        toDelete.push(r.id);
        if (r.account_id) affectedAccounts.add(r.account_id);
        if (r.transfer_to_account_id) affectedAccounts.add(r.transfer_to_account_id);
      } else {
        seen.add(sig);
      }
    }

    if (dryRun) {
      return NextResponse.json({ success: true, duplicates: toDelete.length, dryRun: true });
    }

    if (toDelete.length === 0) {
      return NextResponse.json({ success: true, removed: 0 });
    }

    // Apaga em lotes (o filtro .in tem limite prático).
    let removed = 0;
    const DEL = 200;
    for (let i = 0; i < toDelete.length; i += DEL) {
      const chunk = toDelete.slice(i, i + DEL);
      const { error } = await supabase
        .schema("money_schema")
        .from("transactions")
        .delete()
        .eq("user_id", user.id)
        .in("id", chunk);
      if (error) return NextResponse.json({ error: error.message, removed }, { status: 500 });
      removed += chunk.length;
    }

    // Recalcula os saldos das contas afectadas.
    await persistAccountBalances(supabase, user.id, Array.from(affectedAccounts));

    return NextResponse.json({ success: true, removed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno do servidor";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
