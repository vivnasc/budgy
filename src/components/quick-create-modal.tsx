"use client";

import { useState } from "react";
import { X, Save, Loader2, AlertCircle, Wallet, Target, PieChart, Heart } from "lucide-react";

type Kind = "account" | "budget" | "goal" | "debt";

interface Props {
  kind: Kind;
  /** Optional list of categories (id, name) for budget creation */
  categoryOptions?: { id: string; name: string }[];
  onClose: () => void;
  onCreated?: () => void;
}

const META: Record<Kind, { title: string; endpoint: string; icon: typeof Wallet }> = {
  account: { title: "Nova conta", endpoint: "/api/accounts", icon: Wallet },
  budget: { title: "Novo orçamento", endpoint: "/api/budgets", icon: PieChart },
  goal: { title: "Nova meta", endpoint: "/api/goals", icon: Target },
  debt: { title: "Nova dívida", endpoint: "/api/debts", icon: Heart },
};

export function QuickCreateModal({ kind, categoryOptions, onClose, onCreated }: Props) {
  const meta = META[kind];
  const Icon = meta.icon;

  // Shared
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // account
  const [accountType, setAccountType] = useState<"bank" | "mpesa" | "cash" | "savings" | "investment">("bank");

  // budget
  const [categoryId, setCategoryId] = useState("");

  // goal
  const [deadline, setDeadline] = useState("");

  // debt
  const [debtType, setDebtType] = useState<"owe" | "owed">("owe");
  const [personName, setPersonName] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const numAmount = parseFloat(amount.replace(/\s/g, "").replace(",", "."));
      let body: Record<string, unknown> = {};

      if (kind === "account") {
        if (!name.trim()) { setErr("Nome obrigatório"); setSaving(false); return; }
        body = { name: name.trim(), type: accountType, currency: "MZN", balance: 0 };
      } else if (kind === "budget") {
        if (!categoryId) { setErr("Categoria obrigatória"); setSaving(false); return; }
        if (!Number.isFinite(numAmount) || numAmount <= 0) { setErr("Valor inválido"); setSaving(false); return; }
        body = {
          category_id: categoryId,
          amount: numAmount,
          period: "monthly",
          start_date: new Date().toISOString().split("T")[0],
        };
      } else if (kind === "goal") {
        if (!name.trim()) { setErr("Nome obrigatório"); setSaving(false); return; }
        if (!Number.isFinite(numAmount) || numAmount <= 0) { setErr("Valor alvo inválido"); setSaving(false); return; }
        body = {
          name: name.trim(),
          target_amount: numAmount,
          current_amount: 0,
          currency: "MZN",
          deadline: deadline || null,
          is_completed: false,
        };
      } else if (kind === "debt") {
        if (!personName.trim()) { setErr("Nome da pessoa obrigatório"); setSaving(false); return; }
        if (!Number.isFinite(numAmount) || numAmount <= 0) { setErr("Valor inválido"); setSaving(false); return; }
        body = {
          type: debtType,
          person_name: personName.trim(),
          amount: numAmount,
          currency: "MZN",
          description: name.trim() || null,
          due_date: deadline || null,
          is_paid: false,
        };
      }

      const res = await fetch(meta.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (!data.success && !data.id && !data.account && !data.goal && !data.budget && !data.debt)) {
        setErr(data.error || "Erro ao criar");
        setSaving(false);
        return;
      }
      onCreated?.();
      onClose();
    } catch {
      setErr("Erro de rede");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
        <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900">{meta.title}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {kind === "account" && (
            <>
              <Input label="Nome da conta" value={name} onChange={setName} placeholder="Ex: Mpesa, Banco BIM, Carteira" />
              <Select label="Tipo" value={accountType} onChange={(v) => setAccountType(v as typeof accountType)}>
                <option value="bank">Banco</option>
                <option value="mpesa">Mobile Money (M-Pesa, e-Mola)</option>
                <option value="cash">Dinheiro</option>
                <option value="savings">Poupança</option>
                <option value="investment">Investimento</option>
              </Select>
              <p className="text-xs text-gray-500">O saldo de abertura podes definir depois no cartão da conta.</p>
            </>
          )}

          {kind === "budget" && (
            <>
              <Select label="Categoria" value={categoryId} onChange={setCategoryId}>
                <option value="">— escolher categoria —</option>
                {(categoryOptions || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Input label="Valor mensal (MZN)" value={amount} onChange={setAmount} type="number" placeholder="Ex: 15000" />
              {(!categoryOptions || categoryOptions.length === 0) && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
                  Ainda não tens categorias. Importa transações primeiro.
                </p>
              )}
            </>
          )}

          {kind === "goal" && (
            <>
              <Input label="Nome da meta" value={name} onChange={setName} placeholder="Ex: Férias 2026, Computador novo" />
              <Input label="Valor alvo (MZN)" value={amount} onChange={setAmount} type="number" placeholder="Ex: 100000" />
              <Input label="Data limite (opcional)" value={deadline} onChange={setDeadline} type="date" />
            </>
          )}

          {kind === "debt" && (
            <>
              <Select label="Tipo" value={debtType} onChange={(v) => setDebtType(v as "owe" | "owed")}>
                <option value="owe">Eu devo</option>
                <option value="owed">Devem-me</option>
              </Select>
              <Input label="Pessoa" value={personName} onChange={setPersonName} placeholder="Nome de quem deve / a quem" />
              <Input label="Valor (MZN)" value={amount} onChange={setAmount} type="number" placeholder="Ex: 5000" />
              <Input label="Descrição (opcional)" value={name} onChange={setName} placeholder="Ex: Empréstimo carro" />
              <Input label="Data limite (opcional)" value={deadline} onChange={setDeadline} type="date" />
            </>
          )}

          {err && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{err}</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 p-4 flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 outline-none"
      />
    </div>
  );
}

function Select({
  label, value, onChange, children,
}: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 outline-none"
      >
        {children}
      </select>
    </div>
  );
}
