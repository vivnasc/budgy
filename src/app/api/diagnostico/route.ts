import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { computeAccountBalances } from "@/lib/account-balances";

/**
 * GET /api/diagnostico
 *
 * Human-readable diagnostic page (HTML) the user can simply open in the
 * browser and screenshot. It checks, step by step, exactly which part of the
 * "save balance" pipeline is broken in the LIVE environment:
 *
 *   1. Is the server-side session authenticated?
 *   2. Can it READ the accounts / transactions?
 *   3. Does an UPDATE on money_schema.accounts actually persist (rows > 0)?
 *      — this is the critical test: if the UPDATE matches 0 rows or errors,
 *        that is why imports and "Acertar saldo" never change the balance.
 *
 * No secrets are exposed. Runs entirely as the logged-in user via cookies.
 */
export async function GET() {
  const rows: string[] = [];
  const ok = (s: string) => rows.push(`<div class="ok">✅ ${s}</div>`);
  const bad = (s: string) => rows.push(`<div class="bad">❌ ${s}</div>`);
  const info = (s: string) => rows.push(`<div class="info">• ${s}</div>`);
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));

  try {
    const supabase = await createServerClient();

    // 1) Auth
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr) bad(`Erro de autenticação: ${esc(authErr.message)}`);
    if (!user) {
      bad("Sessão NÃO autenticada no servidor. (As gravações falham por isto.)");
      return html(rows.join(""));
    }
    ok(`Autenticado como ${esc(user.email)} (id: ${esc(user.id).slice(0, 8)}…)`);

    // 2) Read accounts
    const { data: accounts, error: accErr } = await supabase
      .schema("money_schema")
      .from("accounts")
      .select("id, name, balance, balance_predicted")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (accErr) {
      bad(`Não consigo LER as contas: ${esc(accErr.message)}`);
      return html(rows.join(""));
    }
    ok(`Leitura de contas OK — ${accounts?.length ?? 0} contas.`);

    // 3) Computed vs stored balances
    const computed = await computeAccountBalances(supabase, user.id);
    info("<b>Conta — saldo gravado vs saldo calculado das transacções:</b>");
    for (const a of (accounts || []) as { id: string; name: string; balance: number }[]) {
      const c = computed.get(a.id)?.balance ?? 0;
      const diff = Math.abs((Number(a.balance) || 0) - c) > 0.005;
      info(
        `${esc(a.name)}: gravado <b>${fmt(a.balance)}</b> | calculado <b>${fmt(c)}</b> ${
          diff ? '<span class="bad">← diferentes (gravação não aplicou)</span>' : "✓"
        }`
      );
    }

    // 4) CRITICAL: test an UPDATE on accounts and report rows affected + error
    const first = (accounts || [])[0] as { id: string; name: string; balance: number } | undefined;
    if (!first) {
      info("Sem contas para testar a gravação.");
    } else {
      const target = computed.get(first.id)?.balance ?? Number(first.balance) ?? 0;
      const { data: updData, error: updErr } = await supabase
        .schema("money_schema")
        .from("accounts")
        .update({ balance: target })
        .eq("id", first.id)
        .eq("user_id", user.id)
        .select("id");

      const affected = Array.isArray(updData) ? updData.length : 0;
      if (updErr) {
        bad(`TESTE DE GRAVAÇÃO falhou em "${esc(first.name)}": ${esc(updErr.message)}`);
        bad("→ É ESTE o motivo. O UPDATE em accounts dá erro (provável RLS/coluna na BD).");
      } else if (affected === 0) {
        bad(`TESTE DE GRAVAÇÃO: 0 linhas afectadas em "${esc(first.name)}" (sem erro).`);
        bad("→ É ESTE o motivo. Falta a política RLS de UPDATE em money_schema.accounts.");
      } else {
        ok(`TESTE DE GRAVAÇÃO OK em "${esc(first.name)}" — ${affected} linha gravada.`);
      }

      // 5) DECISIVE: test writing balance_predicted specifically. The recalc
      // code writes { balance, balance_predicted } together; if this column is
      // missing in the live DB the whole UPDATE fails silently → "nada
      // acontece" even though writing `balance` alone works.
      const { error: predErr } = await supabase
        .schema("money_schema")
        .from("accounts")
        .update({ balance_predicted: computed.get(first.id)?.balance_predicted ?? 0 })
        .eq("id", first.id)
        .eq("user_id", user.id)
        .select("id");

      if (predErr) {
        bad(`COLUNA balance_predicted FALHA: ${esc(predErr.message)}`);
        bad("→ ENCONTRADO! Falta a coluna 'balance_predicted'. É por isto que nada grava.");
        info("Solução: 1 linha de SQL no Supabase (eu dou-te já).");
      } else {
        ok("Coluna balance_predicted grava OK — não é este o problema.");
        info("Se mesmo assim o saldo não muda no ecrã, é cache do browser/refetch.");
      }
    }
  } catch (e) {
    bad(`Excepção: ${esc(e instanceof Error ? e.message : e)}`);
  }

  return html(rows.join(""));
}

function fmt(n: unknown): string {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function html(body: string) {
  return new NextResponse(
    `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BUDGY — Diagnóstico</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0b1220;color:#e5e7eb;padding:20px;line-height:1.5}
  h1{font-size:20px;margin:0 0 16px}
  div{margin:6px 0;padding:8px 12px;border-radius:8px;background:#111a2e;font-size:14px}
  .ok{border-left:4px solid #10b981}
  .bad{border-left:4px solid #ef4444;background:#2a1414;color:#fecaca}
  .info{border-left:4px solid #475569;color:#cbd5e1}
  b{color:#fff}
</style></head><body>
<h1>🔎 BUDGY — Diagnóstico de gravação de saldo</h1>
${body}
<div class="info">Tira print desta página e envia. (Build: ${process.env.NEXT_PUBLIC_BUILD_COMMIT || "dev"})</div>
</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
