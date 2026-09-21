"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Users, Plus, Check, Loader2, Trash2, Pencil, AlertCircle, CheckCircle2, X, Calendar,
} from "lucide-react";
import { useAccounts, useTransactions } from "@/hooks/use-supabase-data";
import { getCycleStartDay, cycleRangeFor, cycleLabel, currentCycleStart } from "@/lib/period";

interface RecurringPayment {
  id: string;
  name: string;
  amount: number;
  account_id: string | null;
  category_name: string | null;
  note: string | null;
  is_active: boolean;
}

const SETUP_SQL = `-- Cola isto no SQL Editor do Supabase e corre (uma vez):
CREATE TABLE IF NOT EXISTS money_schema.recurring_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  account_id UUID REFERENCES money_schema.accounts(id) ON DELETE SET NULL,
  category_name TEXT DEFAULT 'Salários',
  note TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE money_schema.recurring_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recurring_payments_select_own" ON money_schema.recurring_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recurring_payments_insert_own" ON money_schema.recurring_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recurring_payments_update_own" ON money_schema.recurring_payments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recurring_payments_delete_own" ON money_schema.recurring_payments FOR DELETE USING (auth.uid() = user_id);`;

const fmt = (n: number) => n.toLocaleString("pt-MZ", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function PagamentosPage() {
  const { data: accounts } = useAccounts();
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecurringPayment | null>(null);
  const [adding, setAdding] = useState(false);

  // Ciclo actual (mês de salário — começa no dia configurado, ex: 20).
  const startDay = getCycleStartDay();
  const todayISO = useMemo(() => new Date(Date.now() + 2 * 3600 * 1000).toISOString().split("T")[0]!, []);
  const cycle = useMemo(() => cycleRangeFor(todayISO, startDay), [todayISO, startDay]);
  const cycleTitle = useMemo(
    () => cycleLabel(currentCycleStart(todayISO, startDay), startDay, true),
    [todayISO, startDay]
  );

  // Transações do ciclo — para saber quem já foi pago (etiqueta rp:<id>).
  const { data: cycleTx, refetch: refetchTx } = useTransactions({ from: cycle.from, to: cycle.to, limit: 2000 });

  const paidThisCycle = useMemo(() => {
    const map = new Map<string, { date: string; amount: number }>();
    for (const t of cycleTx ?? []) {
      const tag = (t.tags ?? []).find((x) => typeof x === "string" && x.startsWith("rp:"));
      if (tag) map.set(tag.slice(3), { date: t.date, amount: Number(t.amount) || 0 });
    }
    return map;
  }, [cycleTx]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/recurring-payments");
      const data = await res.json().catch(() => ({}));
      if (data.needsSetup) {
        setNeedsSetup(true);
        setPayments([]);
      } else if (res.ok) {
        setNeedsSetup(false);
        setPayments(data.payments ?? []);
      } else {
        setErr(data.error || "Erro ao carregar");
      }
    } catch {
      setErr("Erro de rede");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = payments.filter((p) => p.is_active);
  const totalCiclo = active.reduce((s, p) => s + p.amount, 0);
  const pagosCount = active.filter((p) => paidThisCycle.has(p.id)).length;
  const jaPago = active.reduce((s, p) => s + (paidThisCycle.get(p.id)?.amount ?? 0), 0);
  const falta = totalCiclo - jaPago;

  const accName = (id: string | null) => accounts?.find((a) => a.id === id)?.name ?? "—";

  const handlePay = async (p: RecurringPayment) => {
    setBusyId(p.id);
    setErr(null);
    try {
      const res = await fetch(`/api/recurring-payments/${p.id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) { setErr(data.error || "Erro ao registar pagamento"); }
      else { refetchTx(); }
    } catch { setErr("Erro de rede"); }
    finally { setBusyId(null); }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/recurring-payments/${id}`, { method: "DELETE" });
      if (res.ok) setPayments((prev) => prev.filter((p) => p.id !== id));
    } finally { setBusyId(null); }
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h1 className="text-xl font-bold">Pagamentos</h1>
          </div>
          {!needsSetup && (
            <button
              onClick={() => { setAdding(true); setEditing(null); }}
              className="flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 px-3 py-2 text-sm font-semibold active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> Trabalhador
            </button>
          )}
        </div>

        {!needsSetup && (
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1 text-primary-100 text-xs">
              <Calendar className="w-3.5 h-3.5" /> Ciclo {cycleTitle}
            </div>
            <p className="text-lg font-bold">{fmt(falta)} MZN <span className="text-sm font-normal text-primary-100">por pagar</span></p>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden mt-2 mb-1">
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${totalCiclo > 0 ? Math.min((jaPago / totalCiclo) * 100, 100) : 0}%` }} />
            </div>
            <div className="flex justify-between text-xs text-primary-100">
              <span>{pagosCount} de {active.length} pagos</span>
              <span>Total {fmt(totalCiclo)} MZN</span>
            </div>
          </div>
        )}
      </header>

      <main className="px-4 pt-6 space-y-4">
        {err && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
            <p className="text-xs text-red-700">{err}</p>
          </div>
        )}

        {needsSetup ? (
          <div className="card p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-2">Falta activar a folha salarial (uma vez)</h2>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Esta funcionalidade precisa de uma tabela nova na tua base de dados. Cola o SQL abaixo no
              <strong> SQL Editor do Supabase</strong> e corre — depois recarrega esta página.
            </p>
            <pre className="text-[10px] bg-gray-900 text-gray-100 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">{SETUP_SQL}</pre>
            <button onClick={load} className="mt-3 text-xs font-semibold bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700">
              Já corri — recarregar
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> A carregar...
          </div>
        ) : active.length === 0 ? (
          <div className="card p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-1">Sem trabalhadores ainda</p>
            <p className="text-xs text-gray-400 mb-4">Adiciona cada trabalhador com o nome e o salário. Todos os meses vês quem falta pagar.</p>
            <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-95">
              <Plus className="w-4 h-4" /> Adicionar trabalhador
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((p) => {
              const paid = paidThisCycle.get(p.id);
              return (
                <div key={p.id} className={`card p-4 ${paid ? "opacity-80" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${paid ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                      {paid ? <CheckCircle2 className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {fmt(p.amount)} MZN · {accName(p.account_id)}
                        {paid && <span className="text-emerald-600 font-medium"> · pago {new Date(paid.date + "T00:00:00").toLocaleDateString("pt-MZ", { day: "numeric", month: "short" })}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!paid && (
                        <button
                          onClick={() => handlePay(p)}
                          disabled={busyId === p.id}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busyId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Pagar
                        </button>
                      )}
                      <button onClick={() => { setEditing(p); setAdding(false); }} className="p-2 text-gray-400 hover:text-gray-700" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} disabled={busyId === p.id} className="p-2 text-red-400 hover:text-red-600" title="Remover">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {(adding || editing) && (
        <WorkerForm
          worker={editing}
          accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.name }))}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function WorkerForm({
  worker, accounts, onClose, onSaved,
}: {
  worker: RecurringPayment | null;
  accounts: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const mpesa = accounts.find((a) => /m.?pesa/i.test(a.name))?.id ?? accounts[0]?.id ?? "";
  const [name, setName] = useState(worker?.name ?? "");
  const [amount, setAmount] = useState(worker ? String(worker.amount) : "");
  const [accountId, setAccountId] = useState(worker?.account_id ?? mpesa);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    const num = parseFloat(amount.replace(/\s/g, "").replace(",", "."));
    if (!name.trim()) { setErr("Nome obrigatório"); return; }
    if (!Number.isFinite(num) || num <= 0) { setErr("Valor inválido"); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch(worker ? `/api/recurring-payments/${worker.id}` : "/api/recurring-payments", {
        method: worker ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), amount: num, account_id: accountId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (!data.success && !data.payment)) { setErr(data.error || "Erro ao guardar"); setSaving(false); return; }
      onSaved();
    } catch { setErr("Erro de rede"); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{worker ? "Editar trabalhador" : "Novo trabalhador"}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João Mabjaia"
            className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">Salário (MZN)</label>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="15000"
              className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Pago de</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button onClick={save} disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white font-semibold py-3 rounded-2xl hover:bg-emerald-600 disabled:opacity-50">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar"}
        </button>
      </div>
    </div>
  );
}
