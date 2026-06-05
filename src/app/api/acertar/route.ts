import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { computeAccountBalances } from "@/lib/account-balances";

/**
 * GET /api/acertar
 *
 * Self-service page: lists every account with its current (computed) balance
 * and an input where the user types the REAL balance shown in their bank app.
 * Saving POSTs to /api/accounts/[id]/opening-balance (Mode A,
 * current_real_balance) which back-computes the "Saldo de Abertura" so the
 * total matches reality. Pure HTML + inline fetch — bypasses the React modal
 * that wasn't updating for her.
 */
export async function GET() {
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
  const fmt = (n: unknown) =>
    (Number(n) || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return page(`<div class="bad">❌ Sessão não autenticada.</div>`);

  const { data: accounts } = await supabase
    .schema("money_schema")
    .from("accounts")
    .select("id, name")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  const computed = await computeAccountBalances(supabase, user.id);

  // Count transactions per account so we can flag empty (likely duplicate) ones
  const { data: txs } = await supabase
    .schema("money_schema")
    .from("transactions")
    .select("account_id")
    .eq("user_id", user.id);
  const txCount = new Map<string, number>();
  for (const t of (txs || []) as { account_id: string | null }[]) {
    if (t.account_id) txCount.set(t.account_id, (txCount.get(t.account_id) || 0) + 1);
  }

  const rows = ((accounts || []) as { id: string; name: string }[])
    .map((a) => {
      const bal = computed.get(a.id)?.balance ?? 0;
      const n = txCount.get(a.id) || 0;
      const empty = n === 0;
      return `<div class="card" ${empty ? 'data-empty="1"' : ""}>
        <div class="row">
          <div><b>${esc(a.name)}</b> <span class="muted">${n} transacções</span>
            ${empty ? '<span class="warn">vazia — provável duplicada</span>' : ""}</div>
          <div class="cur" id="cur-${a.id}">${fmt(bal)} MZN</div>
        </div>
        <div class="row">
          <input id="in-${a.id}" inputmode="decimal" placeholder="saldo real no banco, ex: 12 500,00">
          <button onclick="save('${a.id}')">Guardar</button>
        </div>
        <div class="msg" id="msg-${a.id}"></div>
      </div>`;
    })
    .join("");

  return page(
    `<div class="info">Escreve o <b>saldo real</b> de cada conta (o que vês no app do banco) e carrega <b>Guardar</b>. A app calcula o saldo de abertura sozinha.</div>${rows}`
  );
}

function page(body: string) {
  return new NextResponse(
    `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BUDGY — Acertar saldos</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0b1220;color:#e5e7eb;padding:16px;line-height:1.45;max-width:560px;margin:0 auto}
  h1{font-size:19px;margin:0 0 14px}
  .info{background:#111a2e;border-left:4px solid #475569;border-radius:8px;padding:10px 12px;font-size:14px;margin-bottom:14px}
  .card{background:#111a2e;border-radius:10px;padding:12px;margin:10px 0}
  .card[data-empty="1"]{opacity:.6}
  .row{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:4px 0}
  .muted{color:#64748b;font-size:12px;margin-left:4px}
  .warn{color:#fbbf24;font-size:12px;margin-left:6px}
  .cur{color:#93c5fd;font-weight:600;font-size:14px;white-space:nowrap}
  input{flex:1;background:#0b1220;border:1px solid #334155;color:#e5e7eb;border-radius:8px;padding:9px 10px;font-size:15px;min-width:0}
  button{background:#10b981;color:#04221a;border:0;border-radius:8px;padding:9px 16px;font-weight:600;font-size:14px}
  button:disabled{opacity:.5}
  .msg{font-size:13px;min-height:0}
  .msg.ok{color:#6ee7b7}
  .msg.bad{color:#fca5a5}
  .bad{color:#fca5a5}
</style></head><body>
<h1>🎯 BUDGY — Acertar saldos</h1>
${body}
<script>
function parseNum(s){
  if(!s) return NaN;
  s=String(s).trim().replace(/[^0-9.,-]/g,'');
  // last separator is the decimal one
  var lc=s.lastIndexOf(','), ld=s.lastIndexOf('.');
  if(lc>ld){ s=s.replace(/\\./g,'').replace(',','.'); }
  else { s=s.replace(/,/g,''); }
  return parseFloat(s);
}
async function save(id){
  var inp=document.getElementById('in-'+id);
  var msg=document.getElementById('msg-'+id);
  var btn=inp.nextElementSibling;
  var v=parseNum(inp.value);
  msg.className='msg';
  if(!isFinite(v)){ msg.className='msg bad'; msg.textContent='Escreve um número válido.'; return; }
  btn.disabled=true; msg.className='msg'; msg.textContent='A guardar…';
  try{
    var r=await fetch('/api/accounts/'+id+'/opening-balance',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({current_real_balance:v})
    });
    var d=await r.json().catch(function(){return {}});
    if(!r.ok||!d.success){ msg.className='msg bad'; msg.textContent='Erro: '+(d.error||('HTTP '+r.status)); btn.disabled=false; return; }
    document.getElementById('cur-'+id).textContent=Number(d.balance).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})+' MZN';
    msg.className='msg ok'; msg.textContent='✅ Guardado! Saldo certo.';
    btn.disabled=false; inp.value='';
  }catch(e){ msg.className='msg bad'; msg.textContent='Erro de rede.'; btn.disabled=false; }
}
</script>
</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
