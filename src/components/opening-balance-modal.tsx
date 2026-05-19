"use client";

import { useState } from "react";
import { X, Save, Loader2, AlertCircle, Wallet } from "lucide-react";
import type { Account } from "@/lib/supabase/types";

/**
 * Parses a Mozambican-formatted money string into a number.
 * Accepts: "750000", "750 000", "750.000", "750,000",
 *          "750.000,50", "750,000.50", "-12345.67", etc.
 *
 * The naive `parseFloat(s.replace(/,/g, "."))` failed for inputs like
 * "750.000" (returned 750), causing the opening-balance feature to record
 * 750 instead of 750000.
 */
function parseMZNumber(input: string): number {
  let s = input.trim().replace(/\s/g, "");
  if (!s) return NaN;
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1);

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (lastDot >= 0 && lastComma >= 0) {
    // Both separators present — the rightmost one is the decimal mark
    if (lastDot > lastComma) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(/\./g, "").replace(",", ".");
    }
  } else if (lastComma >= 0) {
    const after = s.length - lastComma - 1;
    const commaCount = (s.match(/,/g) || []).length;
    if (commaCount === 1 && after > 0 && after <= 2) {
      // "750,50" → decimal
      s = s.replace(",", ".");
    } else {
      // "750,000" or "1,000,000" → thousands separator
      s = s.replace(/,/g, "");
    }
  } else if (lastDot >= 0) {
    const after = s.length - lastDot - 1;
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount === 1 && after > 0 && after <= 2) {
      // "750.50" → decimal — keep dot
    } else {
      // "750.000" or "1.000.000" → thousands separator
      s = s.replace(/\./g, "");
    }
  }
  const n = parseFloat(s);
  return negative ? -n : n;
}

interface Props {
  account: Account;
  onClose: () => void;
  onSaved?: () => void;
}

export function OpeningBalanceModal({ account, onClose, onSaved }: Props) {
  const [realBalance, setRealBalance] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedBalance, setSavedBalance] = useState<number | null>(null);

  const currentBalance = Number(account.balance) || 0;

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const num = parseMZNumber(realBalance);
      if (!Number.isFinite(num)) {
        setErr("Valor inválido. Escreve apenas dígitos, ex: 750000");
        setSaving(false);
        return;
      }
      const res = await fetch(`/api/accounts/${account.id}/opening-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_real_balance: num }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErr(data.error || "Erro ao guardar");
        setSaving(false);
        return;
      }
      // Mostra o saldo real que ficou gravado para a Vivianne confirmar
      // visualmente que o valor parsed bate com o que ela escreveu.
      setSavedBalance(typeof data.balance === "number" ? data.balance : num);
      setSaving(false);
      onSaved?.();
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
            <Wallet className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900">Acertar saldo da conta</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Conta</p>
            <p className="text-base font-semibold text-gray-900">{account.name}</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Saldo calculado pelo BUDGY</span>
              <span className={`text-sm font-bold ${currentBalance < 0 ? "text-red-600" : "text-gray-900"}`}>
                {currentBalance.toLocaleString("pt-MZ")} MZN
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Soma de todas as transações importadas (sem o saldo que a conta já tinha antes).
            </p>
          </div>

          {savedBalance !== null ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2">
                ✓ Saldo gravado
              </p>
              <p className="text-2xl font-bold text-emerald-700">
                {savedBalance.toLocaleString("pt-MZ")} <span className="text-sm font-normal">MZN</span>
              </p>
              <p className="text-xs text-emerald-800 mt-2">
                Confere se este número é mesmo o que tens no banco. Se não bater, fecha e tenta de novo.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs text-blue-900 leading-relaxed">
                  <strong>Como corrigir:</strong> escreve aqui o saldo real que a tua app do banco mostra agora.
                  O BUDGY calcula a diferença e cria um &quot;Saldo de Abertura&quot; para que tudo bata certo.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 block">
                  Saldo real actual (MZN)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={realBalance}
                  onChange={(e) => setRealBalance(e.target.value)}
                  placeholder="Ex: 750000"
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-900 focus:border-emerald-500 outline-none"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Escreve só os dígitos. Sem espaços nem pontos. Ex: <code className="bg-gray-100 px-1 rounded">750000</code>
                </p>
              </div>
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
          {savedBalance !== null ? (
            <button
              onClick={onClose}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold"
            >
              Fechar
            </button>
          ) : (
            <>
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
                Acertar saldo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
