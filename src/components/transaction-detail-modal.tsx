"use client";

import { useState } from "react";
import { X, Trash2, Save, Loader2, AlertCircle, Calendar, Tag, Wallet, Repeat, FileText, Clock, CheckCircle2, XCircle } from "lucide-react";
import type { Transaction, TransactionStatus } from "@/lib/supabase/types";

interface TransactionDetailModalProps {
  transaction: Transaction;
  onClose: () => void;
  onChanged?: () => void;
}

type Mode = "view" | "edit";

const CATEGORY_OPTIONS_EXPENSE = [
  "Alimentação", "Restaurantes", "Transporte", "Combustível", "Automóvel",
  "Casa", "Empregados Domésticos", "Jardim & Piscina",
  "Contas", "Comunicação", "Subscrições", "Saúde", "Beleza & Cuidados",
  "Educação", "Pessoal", "Compras", "Lazer", "Viagens", "Família",
  "Animais", "Doações", "Taxas Bancárias", "Dívidas", "Levantamento", "Outros",
];

const CATEGORY_OPTIONS_INCOME = [
  "Salário", "Freelance", "Investimento", "Rendimento Passivo", "Bónus",
  "Reembolso", "Xitique", "Outro Rendimento",
];

export function TransactionDetailModal({ transaction, onClose, onChanged }: TransactionDetailModalProps) {
  const [mode, setMode] = useState<Mode>("view");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [description, setDescription] = useState(transaction.description ?? "");
  const [amount, setAmount] = useState(String(transaction.amount));
  const [date, setDate] = useState(transaction.date);
  const [categoryName, setCategoryName] = useState(transaction.categories?.name ?? "");
  const [isRecurring, setIsRecurring] = useState(transaction.is_recurring ?? false);
  const [status, setStatus] = useState<TransactionStatus>(transaction.status ?? "completed");

  // Notas guardadas (descrição original do banco) — ficam na coluna `notes`
  // do supabase ou em tags. Aqui mostramos o que estiver disponível.
  const notes = (transaction as Transaction & { notes?: string }).notes
    || transaction.tags?.join(", ")
    || "";

  const typeLabel = transaction.type === "income" ? "Receita" : transaction.type === "transfer" ? "Transferência" : "Despesa";
  const typeColor = transaction.type === "income"
    ? "text-emerald-400 bg-emerald-500/10"
    : transaction.type === "transfer"
      ? "text-indigo-400 bg-indigo-500/10"
      : "text-rose-400 bg-rose-500/10";

  const categoryOptions = transaction.type === "income" ? CATEGORY_OPTIONS_INCOME : CATEGORY_OPTIONS_EXPENSE;

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        setErr("Valor inválido");
        setSaving(false);
        return;
      }
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          amount: numAmount,
          date,
          category_name: categoryName || undefined,
          type: transaction.type,
          is_recurring: isRecurring,
          status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErr(data.error || "Erro ao guardar");
      } else {
        onChanged?.();
        onClose();
      }
    } catch {
      setErr("Erro de rede");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErr(data.error || "Erro ao apagar");
        setDeleting(false);
        return;
      }
      onChanged?.();
      onClose();
    } catch {
      setErr("Erro de rede");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-slate-900 sm:rounded-2xl rounded-t-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${typeColor}`}>
              {typeLabel}
            </span>
            {mode === "edit" && (
              <span className="text-xs text-amber-400 font-medium">A editar</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Amount */}
          <div className="text-center py-4 border-b border-white/5">
            {mode === "edit" ? (
              <div className="flex items-center justify-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-3xl font-bold bg-transparent text-white text-center border-b border-white/20 focus:border-emerald-500 outline-none w-40"
                />
                <span className="text-sm text-gray-400">MZN</span>
              </div>
            ) : (
              <p className={`text-3xl font-bold ${transaction.type === "income" ? "text-emerald-400" : transaction.type === "transfer" ? "text-indigo-400" : "text-rose-400"}`}>
                {transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : ""}
                {Number(transaction.amount).toLocaleString("pt-MZ")}{" "}
                <span className="text-sm font-normal text-gray-500">{transaction.currency}</span>
              </p>
            )}
          </div>

          {/* Description */}
          <Field icon={Tag} label="Descrição">
            {mode === "edit" ? (
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
            ) : (
              <p className="text-sm text-white">{transaction.description || "—"}</p>
            )}
          </Field>

          {/* Category */}
          <Field icon={Tag} label="Categoria">
            {mode === "edit" ? (
              <select
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">— escolher —</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-white">{transaction.categories?.name || "Sem categoria"}</p>
            )}
          </Field>

          {/* Date */}
          <Field icon={Calendar} label="Data">
            {mode === "edit" ? (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
            ) : (
              <p className="text-sm text-white">
                {new Date(transaction.date + "T00:00:00").toLocaleDateString("pt-MZ", {
                  day: "numeric", month: "long", year: "numeric"
                })}
              </p>
            )}
          </Field>

          {/* Account */}
          <Field icon={Wallet} label="Conta">
            <p className="text-sm text-white">{transaction.accounts?.name || "—"}</p>
          </Field>

          {/* Status (pendente/paga/cancelada) */}
          <Field icon={Clock} label="Estado">
            {mode === "edit" ? (
              <div className="flex gap-2">
                {([
                  { value: "completed", label: "Paga", icon: CheckCircle2, color: "emerald" },
                  { value: "pending", label: "Pendente", icon: Clock, color: "amber" },
                  { value: "cancelled", label: "Cancelada", icon: XCircle, color: "gray" },
                ] as const).map((opt) => {
                  const active = status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-colors border ${
                        active
                          ? opt.color === "emerald"
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                            : opt.color === "amber"
                              ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                              : "bg-gray-500/20 border-gray-500/40 text-gray-300"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                      }`}
                    >
                      <opt.icon className="w-3.5 h-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-white flex items-center gap-2">
                {status === "completed" && (<><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Paga (já realizada)</>)}
                {status === "pending" && (<><Clock className="w-4 h-4 text-amber-400" /> Pendente — não conta no saldo</>)}
                {status === "cancelled" && (<><XCircle className="w-4 h-4 text-gray-400" /> Cancelada — não conta</>)}
              </p>
            )}
          </Field>

          {/* Recurring toggle */}
          <Field icon={Repeat} label="Recorrente">
            {mode === "edit" ? (
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50"
                />
                Esta transação repete-se todos os meses
              </label>
            ) : (
              <p className="text-sm text-white">{transaction.is_recurring ? "Sim — repete-se mensalmente" : "Não"}</p>
            )}
          </Field>

          {/* Original notes (description from bank/SMS/import) */}
          {notes && (
            <Field icon={FileText} label="Notas">
              <p className="text-xs text-gray-300 leading-relaxed break-words">{notes}</p>
            </Field>
          )}

          {err && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{err}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-white/10 p-4">
          {confirmDelete ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-amber-200 text-center">Apagar esta transação? Não dá para reverter.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Apagar
                </button>
              </div>
            </div>
          ) : mode === "edit" ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setMode("view"); setErr(null); }}
                disabled={saving}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(true)}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Apagar
              </button>
              <button
                onClick={() => setMode("edit")}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-xs text-gray-500">
        <Icon className="w-3.5 h-3.5" />
        <span className="uppercase tracking-wider font-semibold">{label}</span>
      </div>
      {children}
    </div>
  );
}
