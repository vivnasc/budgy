import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";

/**
 * GET /api/limpar
 *
 * Clean-restart tool. Without confirmation it shows a warning page. With
 * ?confirmar=SIM it deletes ALL of the user's transactions and accounts so
 * they can re-import from scratch. Irreversible — guarded by the explicit
 * query param so it can't fire by accident.
 */
export async function GET(request: Request) {
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
  const url = new URL(request.url);
  const confirmar = url.searchParams.get("confirmar");

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return page(`<div class="bad">❌ Sessão não autenticada.</div>`);

  // Count current data
  const { count: txCount } = await supabase
    .schema("money_schema")
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const { count: accCount } = await supabase
    .schema("money_schema")
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (confirmar !== "SIM") {
    return page(
      `<div class="warn">⚠️ Vais apagar <b>${txCount ?? 0} transacções</b> e <b>${accCount ?? 0} contas</b>.</div>
       <div class="info">Isto é <b>irreversível</b>. Depois importas os extratos de novo, limpo.</div>
       <a class="danger" href="/api/limpar?confirmar=SIM">APAGAR TUDO AGORA</a>
       <a class="cancel" href="/painel">Cancelar</a>`
    );
  }

  // Delete transactions first (FK), then accounts
  const { error: txErr } = await supabase
    .schema("money_schema")
    .from("transactions")
    .delete()
    .eq("user_id", user.id);
  if (txErr) return page(`<div class="bad">❌ Erro ao apagar transacções: ${esc(txErr.message)}</div>`);

  const { error: accErr } = await supabase
    .schema("money_schema")
    .from("accounts")
    .delete()
    .eq("user_id", user.id);
  if (accErr) return page(`<div class="bad">❌ Erro ao apagar contas: ${esc(accErr.message)}</div>`);

  return page(
    `<div class="ok">✅ Apagado! ${txCount ?? 0} transacções e ${accCount ?? 0} contas removidas.</div>
     <div class="info">Agora começa limpo:</div>
     <a class="cancel" href="/importar">Importar extratos →</a>
     <a class="cancel" href="/painel">Ir para o painel →</a>`
  );
}

function page(body: string) {
  return new NextResponse(
    `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BUDGY — Limpar dados</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0b1220;color:#e5e7eb;padding:20px;line-height:1.5;max-width:520px;margin:0 auto}
  h1{font-size:20px;margin:0 0 16px}
  div{margin:8px 0;padding:10px 12px;border-radius:8px;background:#111a2e;font-size:14px}
  .ok{border-left:4px solid #10b981}
  .bad{border-left:4px solid #ef4444;background:#2a1414;color:#fecaca}
  .warn{border-left:4px solid #fbbf24;color:#fde68a}
  .info{border-left:4px solid #475569;color:#cbd5e1}
  a{display:block;text-align:center;text-decoration:none;border-radius:10px;padding:13px;margin:10px 0;font-weight:600}
  a.danger{background:#ef4444;color:#fff}
  a.cancel{background:#1e293b;color:#cbd5e1}
  b{color:#fff}
</style></head><body>
<h1>🗑️ BUDGY — Recomeçar limpo</h1>
${body}
</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
