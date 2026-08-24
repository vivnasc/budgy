"use client";

import { useState } from "react";
import { X, Loader2, Trophy } from "lucide-react";

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  is_completed?: boolean;
}

interface Props {
  goal: Goal;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Gerir uma meta: definir o valor já reservado (o que a utilizadora pediu),
 * ajustar o nome, o valor alvo e o prazo. Grava via PATCH /api/goals.
 */
export function GoalManageModal({ goal, onClose, onSaved }: Props) {
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(String(goal.target_amount));
  const [reserved, setReserved] = useState(String(goal.current_amount ?? 0));
  const [deadline, setDeadline] = useState(goal.deadline ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const parse = (v: string) => parseFloat(v.replace(/\s/g, "").replace(",", "."));

  const save = async (extra?: Record<string, unknown>) => {
    const numTarget = parse(target);
    const numReserved = parse(reserved);
    if (!name.trim()) { setErr("Nome obrigatório"); return; }
    if (!Number.isFinite(numTarget) || numTarget <= 0) { setErr("Valor alvo inválido"); return; }
    if (!Number.isFinite(numReserved) || numReserved < 0) { setErr("Valor reservado inválido"); return; }

    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: goal.id,
          name: name.trim(),
          target_amount: numTarget,
          current_amount: numReserved,
          deadline: deadline || null,
          ...extra,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (!data.success && !data.goal)) {
        setErr(data.error || "Erro ao guardar");
        setSaving(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setErr("Erro de rede. Tenta novamente.");
      setSaving(false);
    }
  };

  const numTarget = parse(target);
  const numReserved = parse(reserved);
  const falta =
    Number.isFinite(numTarget) && Number.isFinite(numReserved)
      ? Math.max(numTarget - numReserved, 0)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Gerir meta</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-emerald-700">Valor já reservado (MZN)</label>
          <input
            inputMode="decimal"
            value={reserved}
            onChange={(e) => setReserved(e.target.value)}
            placeholder="0"
            className="mt-1 w-full bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Quanto já tens de parte para esta meta.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">Valor alvo (MZN)</label>
            <input
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Prazo</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {falta !== null && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">
              {falta > 0 ? "Ainda falta" : "Meta atingida 🎉"}
            </p>
            {falta > 0 && (
              <p className="text-sm font-bold text-gray-900">
                {falta.toLocaleString("pt-MZ")} MZN
              </p>
            )}
          </div>
        )}

        {err && <p className="text-xs text-red-600">{err}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => save()}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white font-semibold py-3 rounded-2xl hover:bg-emerald-600 disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar"}
          </button>
          {!goal.is_completed && (
            <button
              onClick={() => save({ is_completed: true })}
              disabled={saving}
              title="Marcar como concluída"
              className="flex items-center justify-center gap-2 bg-amber-100 text-amber-700 font-semibold py-3 px-4 rounded-2xl hover:bg-amber-200 disabled:opacity-50 transition-all"
            >
              <Trophy className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
