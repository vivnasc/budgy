import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { computeAccountBalances, persistAccountBalances } from "@/lib/account-balances";

/**
 * GET /api/recalcular
 *
 * One-shot maintenance page the user can simply open in the browser. It
 * recomputes balance + balance_predicted for EVERY account from the
 * transaction log (the source of truth) and persists them, then shows a
 * before/after table so it's obvious it worked.
 *
 * This fixes accounts whose stored balance drifted from reality because the
 * recalc had previously only run for accounts touched by an import.
 */
export async function GET() {
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
  const fmt = (n: unknown) =>
    (Number(n) || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return page(`<div class="bad">❌ Sessão não autenticada.</div>`);

    // Snapshot BEFORE
    const { data: before } = await supabase
      .schema("money_schema")
      .from("accounts")
      .select("id, name, balance")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    // The truth, computed from transactions
    const computed = await computeAccountBalances(supabase, user.id);

    // Persist EVERY account
    await persistAccountBalances(supabase, user.id);

    // Snapshot AFTER
    const { data: after } = await supabase
      .schema("money_schema")
      .from("accounts")
      .select("id, name, balance")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    const afterMap = new Map(
      ((after || []) as { id: string; balance: number }[]).map((a) => [a.id, a.balance])
    );

    const rows = ((before || []) as { id: string; name: string; balance: number }[])
      .map((b) => {
        const now = afterMap.get(b.id) ?? b.balance;
        const target = computed.get(b.id)?.balance ?? 0;
        const fixed = Math.abs((Number(b.balance) || 0) - (Number(now) || 0)) > 0.005;
        const okNow = Math.abs((Number(now) || 0) - target) <= 0.005;
        return `<div class="${okNow ? "ok" : "bad"}">${okNow ? "✅" : "❌"} <b>${esc(b.name)}</b>: ${
          fixed ? `<span class="old">${fmt(b.balance)}</span> → ` : ""
        }<b>${fmt(now)}</b> ${fixed ? '<span class="tag">corrigido</span>' : ""}</div>`;
      })
      .join("");

    return page(
      `<div class="ok">✅ Recálculo concluído para ${after?.length ?? 0} contas.</div>${rows}` +
        `<div class="info">Volta à app e <b>recarrega a página</b> (puxa para baixo) para veres os novos saldos.</div>`
    );
  } catch (e) {
    return page(`<div class="bad">❌ Erro: ${esc(e instanceof Error ? e.message : e)}</div>`);
  }
}

function page(body: string) {
  return new NextResponse(
    `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BUDGY — Recalcular saldos</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0b1220;color:#e5e7eb;padding:20px;line-height:1.5}
  h1{font-size:20px;margin:0 0 16px}
  div{margin:6px 0;padding:8px 12px;border-radius:8px;background:#111a2e;font-size:14px}
  .ok{border-left:4px solid #10b981}
  .bad{border-left:4px solid #ef4444;background:#2a1414;color:#fecaca}
  .info{border-left:4px solid #475569;color:#cbd5e1}
  .old{color:#94a3b8;text-decoration:line-through}
  .tag{background:#10b981;color:#04221a;border-radius:6px;padding:1px 6px;font-size:12px;font-weight:600}
  b{color:#fff}
</style></head><body>
<h1>🔄 BUDGY — Recalcular todos os saldos</h1>
${body}
</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
