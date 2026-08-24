"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  MessageSquareText,
  Upload,
  FileSpreadsheet,
  Check,
  X,
  ChevronRight,
  AlertCircle,
  Smartphone,
  ArrowLeft,
  Loader2,
  Edit3,
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  ShieldCheck,
  RotateCcw,
  ClipboardPaste,
} from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/auth/client";
import { useUser } from "@/lib/auth/hooks";
import {
  gatherBackup,
  downloadBackup,
  parseBackup,
  restoreBackup,
  type BudgyBackup,
} from "@/lib/backup";
import type { ParsedSMS } from "@/lib/sms-parser";
import type { ImportResult } from "@/lib/mobills-import";
import { generateImportPDF } from "@/lib/import-pdf";
import { SUPPORTED_BANKS } from "@/lib/sms-parser";
import { BUDGY_CATEGORIES } from "@/lib/mobills-import";
import { SUPPORTED_BANK_FORMATS, type BankFormat } from "@/lib/bank-statement-parser";
import { applyLearnedRules, rememberDecision } from "@/lib/learned-rules";
import {
  applyMobillsMappingAndCutoff,
  rebuildMobillsResult,
  getMobillsAccountNames,
  defaultTargetFor,
  earliestDatesByAccount,
  CREATE_NEW,
} from "@/lib/mobills-safe";
import { useAccounts, useTransactions } from "@/hooks/use-supabase-data";
import { parsePastedTransactions } from "@/lib/paste-parser";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "sms" | "import" | "paste";
type ImportStep = "upload" | "mobills" | "preview" | "mapping" | "confirm";

/** Resumo do corte Mobills mostrado no topo da revisão. */
interface MobillsCutSummary {
  total: number;
  kept: number;
  dropped: number;
}

interface PendingTransaction {
  id: string;
  source: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  currency: string;
  date: string;
  description: string;
  category: string;
  suggestedCategory?: string;
  accountHint?: string;
  confidence: number;
  status: "pending" | "approved" | "rejected" | "editing";
  /** Preenchido automaticamente a partir de uma decisão aprendida. */
  learned?: boolean;
  /**
   * Reconhecido como contrapartida de uma transferência JÁ guardada do outro
   * lado (ex: a saída no CPC já guardada é a contrapartida desta entrada no
   * Moza). É apenas reconhecimento — a linha continua a ser guardada.
   */
  counterpart?: boolean;
  /** Nome da conta da transferência já guardada (o outro lado). */
  counterpartAccount?: string | null;
  /**
   * Já existe na base de dados (mesma conta + data + valor + descrição). É
   * saltada automaticamente para não duplicar quando reimportas um extrato que
   * se sobrepõe a dias já lançados.
   */
  duplicate?: boolean;
}

/**
 * Assinatura de uma transação para deteção de duplicados entre uma importação
 * e o que já está guardado. Junta conta + data + valor (em cêntimos) +
 * descrição normalizada. Reimportar o MESMO extrato produz descrições
 * idênticas, por isso a correspondência é exacta e não apanha transações
 * diferentes por acaso.
 */
function dedupSignature(
  accountName: string | null | undefined,
  date: string,
  amount: number,
  description: string
): string {
  const acc = (accountName ?? "").trim().toLowerCase();
  const cents = Math.round((Number(amount) || 0) * 100);
  const desc = (description ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${acc}|${date}|${cents}|${desc}`;
}

// ─── Confirmação / categorias ────────────────────────────────────────────────

/**
 * Categorias válidas por tipo (reutiliza BUDGY_CATEGORIES — não inventar).
 */
function categoriesForType(type: PendingTransaction["type"]) {
  return type === "income"
    ? BUDGY_CATEGORIES.income
    : type === "transfer"
    ? BUDGY_CATEGORIES.transfer
    : BUDGY_CATEGORIES.expense;
}

/**
 * Categoria por defeito para um tipo: mantém a actual se ainda for válida,
 * caso contrário usa a primeira categoria do grupo.
 */
function defaultCategoryForType(
  type: PendingTransaction["type"],
  current: string
): string {
  const cats = categoriesForType(type);
  if (cats.some((c) => c.name === current)) return current;
  return cats[0]?.name ?? "Outros";
}

/**
 * Movimentos que a utilizadora provavelmente precisa de classificar à mão:
 * transferências entre contas próprias, rendimentos que não sejam salário
 * (empréstimo, dinheiro de alguém), não categorizados, ou valores grandes.
 */
function needsConfirmation(tx: PendingTransaction): boolean {
  // Uma contrapartida reconhecida já está resolvida — não é algo a confirmar.
  if (tx.counterpart === true) return false;
  // Algo que a utilizadora já ensinou (texto+valor) não precisa de reconfirmação.
  if (tx.learned === true) return false;
  return (
    tx.type === "transfer" ||
    (tx.type === "income" && tx.category !== "Salário") ||
    tx.category === "Outros" ||
    Math.abs(tx.amount) >= 100000
  );
}

/**
 * Depois de a lista de movimentos estar construída, pergunta ao servidor se
 * alguma transferência é contrapartida de uma transferência JÁ guardada do
 * outro lado. Marca as reconhecidas com `counterpart` para não pedir
 * reclassificação nem parecer dinheiro novo.
 *
 * Corre uma vez por lista construída (chaveado no conjunto de ids). Falha em
 * silêncio — é uma camada extra "nice-to-have".
 */
function useCounterpartMatching(
  transactions: PendingTransaction[],
  setTransactions: React.Dispatch<React.SetStateAction<PendingTransaction[]>>
) {
  const doneKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const ids = transactions.map((t) => t.id).join(",");
    if (!ids || doneKeyRef.current === ids) return;

    const candidates = transactions
      .filter((t) => t.type === "transfer")
      .map((t) => ({ tempId: t.id, date: t.date, amount: t.amount, type: t.type }));

    // Marca já para não repetir (mesmo quando não há transferências).
    doneKeyRef.current = ids;
    if (candidates.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/transactions/match-transfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidates }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const matched = (data?.matched ?? []) as Array<{
          tempId: string;
          account: string | null;
          date: string;
        }>;
        if (cancelled || matched.length === 0) return;
        const byId = new Map(matched.map((m) => [m.tempId, m]));
        setTransactions((prev) =>
          prev.map((tx) => {
            const m = byId.get(tx.id);
            return m ? { ...tx, counterpart: true, counterpartAccount: m.account } : tx;
          })
        );
      } catch {
        // Silencioso — o reconhecimento de contrapartida é opcional.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [transactions, setTransactions]);
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ImportarPage() {
  const [activeTab, setActiveTab] = useState<Tab>("sms");

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/painel"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Importar Transações</h1>
            <p className="text-sm text-gray-500">SMS automático ou extrato bancário</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("sms")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "sms"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <MessageSquareText className="w-4 h-4 flex-shrink-0" />
            SMS
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "import"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
            Ficheiro
          </button>
          <button
            onClick={() => setActiveTab("paste")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "paste"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <ClipboardPaste className="w-4 h-4 flex-shrink-0" />
            Colar
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6">
        {activeTab === "sms" ? <SMSTab /> : activeTab === "paste" ? <PasteTab /> : <ImportTab />}
        <BackupRestoreSection />
        <ResetDataSection />
      </div>
    </div>
  );
}

// ─── Backup / Restauro Section ───────────────────────────────────────────────

function BackupRestoreSection() {
  const { user } = useUser();

  // Export
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<{ transactions: number; accounts: number } | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);

  // Restore
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<BudgyBackup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ restored: number; duplicates: number } | null>(null);
  const [restoreErr, setRestoreErr] = useState<string | null>(null);

  const handleDownload = async () => {
    setExporting(true);
    setExportErr(null);
    setExported(null);
    try {
      const supabase = createBrowserClient();
      if (!user) {
        setExportErr("Precisas de ter sessão iniciada.");
        return;
      }
      const backup = await gatherBackup(supabase, user.id);
      downloadBackup(backup);
      setExported({ transactions: backup.transactions.length, accounts: backup.accounts.length });
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : "Erro ao gerar o backup.");
    } finally {
      setExporting(false);
    }
  };

  const handleFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (restoreInputRef.current) restoreInputRef.current.value = "";
    if (!file) return;

    setRestoreErr(null);
    setRestoreResult(null);
    setPendingBackup(null);
    try {
      const text = await file.text();
      const backup = parseBackup(text);
      setPendingBackup(backup);
    } catch (e) {
      setRestoreErr(e instanceof Error ? e.message : "Ficheiro inválido.");
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingBackup) return;
    setRestoring(true);
    setRestoreErr(null);
    try {
      const result = await restoreBackup(pendingBackup);
      setRestoreResult(result);
      setPendingBackup(null);
      // Recarrega para o painel reflectir os dados restaurados.
      setTimeout(() => window.location.reload(), 1800);
    } catch (e) {
      setRestoreErr(e instanceof Error ? e.message : "Erro de rede ao restaurar.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="mt-10 pt-6 border-t border-gray-100 space-y-4">
      <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-emerald-900">Cópia de segurança</h3>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
              Antes de importares histórico, descarrega uma cópia de tudo. Se algo correr mal,
              restauras em segundos. Guarda este ficheiro num sítio seguro.
            </p>

            {/* Descarregar backup */}
            <div className="mt-4">
              {exported ? (
                <p className="text-xs text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Backup descarregado — {exported.transactions} transações, {exported.accounts} contas.
                </p>
              ) : (
                <button
                  onClick={handleDownload}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {exporting ? "A preparar backup..." : "Descarregar backup"}
                </button>
              )}
              {exported && (
                <button
                  onClick={handleDownload}
                  disabled={exporting}
                  className="mt-3 block text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline disabled:opacity-50"
                >
                  Descarregar outra vez
                </button>
              )}
              {exportErr && <p className="text-xs text-red-700 mt-2">{exportErr}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Restaurar de um backup */}
      <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
        <div className="flex items-start gap-3">
          <RotateCcw className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-blue-900">Restaurar de um backup</h3>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              Carrega um ficheiro <span className="font-mono">.json</span> do BUDGY. O restauro
              <strong> ACRESCENTA o que falta, não apaga nada</strong> — graças à deteção de duplicados.
            </p>

            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFilePicked}
              className="hidden"
            />

            {restoreResult ? (
              <p className="text-xs text-emerald-800 font-semibold mt-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {restoreResult.restored} restauradas, {restoreResult.duplicates} já existiam. A recarregar...
              </p>
            ) : pendingBackup ? (
              <div className="mt-4 rounded-xl bg-white border border-blue-100 p-3">
                <p className="text-xs text-blue-900 font-semibold">
                  {pendingBackup.transactions.length} transações, {pendingBackup.accounts.length} contas
                  {pendingBackup.exported_at
                    ? ` (backup de ${pendingBackup.exported_at.split("T")[0]})`
                    : ""}
                  {" "}— restaurar?
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleConfirmRestore}
                    disabled={restoring}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    {restoring ? "A restaurar..." : "Sim, restaurar"}
                  </button>
                  <button
                    onClick={() => setPendingBackup(null)}
                    disabled={restoring}
                    className="text-xs font-semibold bg-white text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => restoreInputRef.current?.click()}
                className="mt-4 inline-flex items-center gap-2 bg-white text-blue-700 border border-blue-200 hover:bg-blue-100 px-4 py-2.5 rounded-xl text-sm font-semibold"
              >
                <Upload className="w-4 h-4" />
                Escolher ficheiro de backup
              </button>
            )}
            {restoreErr && <p className="text-xs text-red-700 mt-2">{restoreErr}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reset Data Section ──────────────────────────────────────────────────────

function ResetDataSection() {
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [recat, setRecat] = useState<{ running: boolean; updated?: number; total?: number; err?: string }>({ running: false });
  const [statusFix, setStatusFix] = useState<{ running: boolean; pending?: number; completed?: number; err?: string }>({ running: false });

  const handleReset = async () => {
    setResetting(true);
    setErr(null);
    try {
      const res = await fetch("/api/transactions", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setDone(true);
        setConfirming(false);
        // Force reload so the dashboard reflects the empty state
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setErr(data.error || "Erro ao apagar dados");
      }
    } catch {
      setErr("Erro de rede");
    } finally {
      setResetting(false);
    }
  };

  const handleRecategorize = async () => {
    setRecat({ running: true });
    try {
      const res = await fetch("/api/transactions/recategorize", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setRecat({ running: false, updated: data.updated, total: data.total });
      } else {
        setRecat({ running: false, err: data.error || "Erro ao re-categorizar" });
      }
    } catch {
      setRecat({ running: false, err: "Erro de rede" });
    }
  };

  const handleRefreshStatus = async () => {
    setStatusFix({ running: true });
    try {
      const res = await fetch("/api/transactions/refresh-status", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setStatusFix({
          running: false,
          pending: data.promotedToPending,
          completed: data.promotedToCompleted,
        });
      } else {
        setStatusFix({ running: false, err: data.error || "Erro ao actualizar estados" });
      }
    } catch {
      setStatusFix({ running: false, err: "Erro de rede" });
    }
  };

  return (
    <div className="mt-10 pt-6 border-t border-gray-100 space-y-4">
      {/* Re-categorize existing transactions (no destructive action) */}
      <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-blue-900">Re-categorizar transações</h3>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              Aplica as regras automáticas a todas as transações que já lá estão (útil se aparecem como &quot;Outros&quot; nos relatórios). Não apaga nada.
            </p>
            {recat.updated !== undefined ? (
              <p className="text-xs text-emerald-700 font-semibold mt-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {recat.updated} de {recat.total} transações actualizadas
              </p>
            ) : (
              <button
                onClick={handleRecategorize}
                disabled={recat.running}
                className="mt-3 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {recat.running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {recat.running ? "A processar..." : "Re-categorizar agora"}
              </button>
            )}
            {recat.err && <p className="text-xs text-red-700 mt-2">{recat.err}</p>}
          </div>
        </div>
      </div>

      {/* Refresh status: future-dated → pending, past pending → completed */}
      <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-amber-900">Actualizar estados (Pendente / Paga)</h3>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Marca como <strong>pendentes</strong> as transações com data futura (ex: salários do final do mês) e como <strong>pagas</strong> as pendentes cuja data já passou. Não apaga nada.
            </p>
            {statusFix.pending !== undefined ? (
              <p className="text-xs text-emerald-700 font-semibold mt-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {statusFix.pending} marcadas como pendentes, {statusFix.completed} como pagas
              </p>
            ) : (
              <button
                onClick={handleRefreshStatus}
                disabled={statusFix.running}
                className="mt-3 inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {statusFix.running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {statusFix.running ? "A processar..." : "Actualizar estados agora"}
              </button>
            )}
            {statusFix.err && <p className="text-xs text-red-700 mt-2">{statusFix.err}</p>}
          </div>
        </div>
      </div>

      {/* Destructive: clear all data */}
      <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-900">Limpar todos os dados</h3>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              Apaga todas as contas e transações importadas. Útil quando o último import ficou confuso e
              queres recomeçar do zero.
            </p>

            {done ? (
              <p className="text-xs text-emerald-700 font-semibold mt-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Dados apagados. A recarregar...
              </p>
            ) : !confirming ? (
              <button
                onClick={() => setConfirming(true)}
                className="mt-3 text-xs font-semibold text-red-700 hover:text-red-900 underline"
              >
                Limpar dados
              </button>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-red-900 font-semibold">Tens a certeza?</span>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {resetting ? "A apagar..." : "Sim, apagar tudo"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={resetting}
                  className="text-xs font-semibold bg-white text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            )}

            {err && <p className="text-xs text-red-800 mt-2">{err}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Colar Transacções Tab ───────────────────────────────────────────────────

function PasteTab() {
  const { data: accounts, loading: accountsLoading } = useAccounts();
  const realAccounts = accounts ?? [];

  const [pasteText, setPasteText] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reconhece contrapartidas de transferências já guardadas do outro lado.
  useCounterpartMatching(pendingTransactions, setPendingTransactions);

  // Selecciona por defeito a primeira conta real assim que carregarem.
  useEffect(() => {
    if (!selectedAccount && realAccounts.length > 0) {
      setSelectedAccount(realAccounts[0]!.name);
    }
  }, [realAccounts, selectedAccount]);

  const handleParse = useCallback(() => {
    setError(null);
    const parsed = parsePastedTransactions(pasteText);
    if (parsed.length === 0) {
      setError(
        "Não consegui ler transações. Confirma que colaste o texto do banco com data, descrição e valor (ex: 21 AUG 2026 ... -3,220.38 MZN)."
      );
      return;
    }
    const built: PendingTransaction[] = parsed.map((tx, i) => ({
      id: `paste-${Date.now()}-${i}`,
      source: "Colado",
      type: tx.type,
      amount: tx.amount,
      currency: "MZN",
      date: tx.date,
      description: tx.description,
      category: tx.category || "Outros",
      suggestedCategory: tx.category,
      ...(selectedAccount ? { accountHint: selectedAccount } : {}),
      confidence: 0.7,
      status: "pending" as const,
    }));
    // Aplica decisões aprendidas antes de mostrar (a app lembra-se).
    const learned = applyLearnedRules(built);
    setPendingTransactions((prev) => [...learned, ...prev]);
    setPasteText("");
  }, [pasteText, selectedAccount]);

  const handleApprove = (id: string) => {
    setPendingTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        rememberDecision(tx.description, tx.amount, { type: tx.type, category: tx.category });
        return { ...tx, status: "approved" as const };
      })
    );
  };

  const handleReject = (id: string) => {
    setPendingTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, status: "rejected" as const } : tx))
    );
  };

  const handleCategoryChange = (id: string, category: string) => {
    setPendingTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        rememberDecision(tx.description, tx.amount, { type: tx.type, category });
        return { ...tx, category, status: "pending" as const };
      })
    );
  };

  const handleTypeChange = (id: string, type: PendingTransaction["type"]) => {
    setPendingTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        const category = defaultCategoryForType(type, tx.category);
        rememberDecision(tx.description, tx.amount, { type, category });
        return { ...tx, type, category, status: "pending" as const };
      })
    );
  };

  const approvedCount = pendingTransactions.filter((tx) => tx.status === "approved").length;
  const pendingCount = pendingTransactions.filter((tx) => tx.status === "pending").length;

  const handleSaveApproved = async () => {
    const approved = pendingTransactions.filter((tx) => tx.status === "approved");
    if (approved.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      const transactions = approved.map((tx) => ({
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        date: tx.date,
        description: tx.description,
        category_name: tx.category,
        ...(tx.accountHint ? { account: tx.accountHint } : {}),
        status: "completed",
      }));

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions }),
      });

      if (response.ok) {
        setPendingTransactions((prev) => prev.filter((tx) => tx.status !== "approved"));
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Erro ao guardar transações");
      }
    } catch {
      setError("Erro ao guardar transações");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Como funciona */}
      <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-emerald-900">Colar transacções</h3>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
              Quando não consegues exportar CSV, copia o bloco de movimentos do teu
              internet-banking e cola aqui. O BUDGY lê datas, descrições e valores. Escolhe a
              conta, carrega em <strong>Ler</strong> e valida.
            </p>
          </div>
        </div>
      </div>

      {/* Escolha da conta */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          A que conta pertence
        </h3>
        {accountsLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            A carregar as tuas contas...
          </div>
        ) : realAccounts.length === 0 ? (
          <Link
            href="/contas"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Ainda não tens contas — cria uma primeiro
          </Link>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {realAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => setSelectedAccount(account.name)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedAccount === account.name
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {account.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Área de texto */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
          <ClipboardPaste className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Colar texto do banco</span>
        </div>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={`Cola aqui os movimentos copiados do internet-banking...\n\nExemplo:\n21 AUG 2026   FT2623333454   Pagamento no PV (VISA)\nPAYPAL *PADDLE.NET   -3,220.38   MZN`}
          className="w-full px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none"
          rows={8}
        />
        <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {pasteText.length > 0 ? `${pasteText.length} caracteres` : "Uma transação por bloco"}
          </span>
          <button
            onClick={handleParse}
            disabled={!pasteText.trim()}
            className="flex items-center gap-2 bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-emerald-600"
          >
            <Sparkles className="w-4 h-4" />
            Ler
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 rounded-2xl p-4 border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Transações para validar */}
      {pendingTransactions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">
              Transações para validar
              {pendingCount > 0 && (
                <span className="ml-2 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
                </span>
              )}
            </h3>
            {approvedCount > 0 && (
              <button
                onClick={handleSaveApproved}
                disabled={saving}
                className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar {approvedCount}
              </button>
            )}
          </div>

          <PendingReviewList
            transactions={pendingTransactions}
            onApprove={handleApprove}
            onReject={handleReject}
            onCategoryChange={handleCategoryChange}
            onTypeChange={handleTypeChange}
          />
        </div>
      )}
    </div>
  );
}

// ─── SMS Tab ─────────────────────────────────────────────────────────────────

function SMSTab() {
  const [smsText, setSmsText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reconhece contrapartidas de transferências já guardadas do outro lado.
  useCounterpartMatching(pendingTransactions, setPendingTransactions);

  const handleParseSMS = useCallback(async () => {
    if (!smsText.trim()) return;

    setParsing(true);
    setError(null);

    try {
      const response = await fetch("/api/sms-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: smsText, bulk: smsText.includes("\n\n") }),
      });

      const data = await response.json();

      if (data.parsed === false && data.error) {
        setError(data.error);
        return;
      }

      // Handle bulk results
      if (data.transactions) {
        const newTransactions: PendingTransaction[] = data.transactions.map(
          (tx: ParsedSMS, i: number) => ({
            id: `sms-${Date.now()}-${i}`,
            source: tx.source,
            type: tx.type,
            amount: tx.amount,
            currency: tx.currency,
            date: (tx.date instanceof Date ? tx.date.toISOString() : String(tx.date)).split("T")[0] ?? "",
            description: tx.description,
            category: tx.suggestedCategory || "Outros",
            suggestedCategory: tx.suggestedCategory,
            accountHint: tx.accountHint,
            confidence: tx.confidence,
            status: "pending" as const,
          })
        );
        // Aplica decisões aprendidas antes de mostrar (a app lembra-se)
        const learned = applyLearnedRules(newTransactions);
        setPendingTransactions((prev) => [...learned, ...prev]);
      }
      // Handle single result
      else if (data.transaction) {
        const tx = data.transaction as ParsedSMS;
        const newTx: PendingTransaction = {
          id: `sms-${Date.now()}`,
          source: tx.source,
          type: tx.type,
          amount: tx.amount,
          currency: tx.currency,
          date: (tx.date instanceof Date ? tx.date.toISOString() : String(tx.date)).split("T")[0] ?? "",
          description: tx.description,
          category: tx.suggestedCategory || "Outros",
          suggestedCategory: tx.suggestedCategory,
          accountHint: tx.accountHint,
          confidence: tx.confidence,
          status: "pending",
        };
        const [learnedTx] = applyLearnedRules([newTx]);
        setPendingTransactions((prev) => [learnedTx ?? newTx, ...prev]);
      }

      setSmsText("");
    } catch {
      setError("Erro ao processar SMS. Tenta novamente.");
    } finally {
      setParsing(false);
    }
  }, [smsText]);

  const handleApprove = (id: string) => {
    setPendingTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        // Aprovar com os valores mostrados ensina a app
        rememberDecision(tx.description, tx.amount, { type: tx.type, category: tx.category });
        return { ...tx, status: "approved" as const };
      })
    );
  };

  const handleReject = (id: string) => {
    setPendingTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, status: "rejected" as const } : tx))
    );
  };

  const handleCategoryChange = (id: string, category: string) => {
    setPendingTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        rememberDecision(tx.description, tx.amount, { type: tx.type, category });
        return { ...tx, category, status: "pending" as const };
      })
    );
  };

  const handleTypeChange = (id: string, type: PendingTransaction["type"]) => {
    setPendingTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        const category = defaultCategoryForType(type, tx.category);
        rememberDecision(tx.description, tx.amount, { type, category });
        return { ...tx, type, category, status: "pending" as const };
      })
    );
  };

  const approvedCount = pendingTransactions.filter((tx) => tx.status === "approved").length;
  const pendingCount = pendingTransactions.filter((tx) => tx.status === "pending").length;

  const handleSaveApproved = async () => {
    const approved = pendingTransactions.filter((tx) => tx.status === "approved");
    if (approved.length === 0) return;

    try {
      const transactions = approved.map((tx) => ({
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        date: tx.date,
        description: tx.description,
        category_name: tx.category,
        ...(tx.accountHint ? { account: tx.accountHint } : {}),
        status: "completed",
      }));

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions }),
      });

      if (response.ok) {
        setPendingTransactions((prev) =>
          prev.filter((tx) => tx.status !== "approved")
        );
      }
    } catch {
      setError("Erro ao guardar transações");
    }
  };

  return (
    <div className="space-y-6">
      {/* How it works */}
      <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-emerald-900">Como funciona</h3>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
              Cola aqui as mensagens SMS que recebes do teu banco. O BUDGY lê automaticamente
              os valores, datas e tipo de transação. Tu só validas e corriges se necessário.
            </p>
          </div>
        </div>
      </div>

      {/* Supported Banks */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Bancos suportados
        </h3>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {SUPPORTED_BANKS.map((bank) => (
            <div
              key={bank.id}
              className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100 flex-shrink-0"
            >
              <span className="text-base">{bank.icon}</span>
              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                {bank.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SMS Input */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Colar SMS</span>
        </div>
        <textarea
          value={smsText}
          onChange={(e) => setSmsText(e.target.value)}
          placeholder={`Cola aqui a mensagem SMS do banco...\n\nExemplo:\nBIM: Débito de 5.000,00 MZN na conta *1234 em 15/03/2026. Saldo: 45.000,00 MZN\n\nPodes colar várias mensagens separadas por linhas em branco.`}
          className="w-full px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none"
          rows={6}
        />
        <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {smsText.length > 0 ? `${smsText.length} caracteres` : "Separa múltiplas SMS com linhas em branco"}
          </span>
          <button
            onClick={handleParseSMS}
            disabled={!smsText.trim() || parsing}
            className="flex items-center gap-2 bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-emerald-600"
          >
            {parsing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Processar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 rounded-2xl p-4 border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Pending Transactions */}
      {pendingTransactions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">
              Transações para validar
              {pendingCount > 0 && (
                <span className="ml-2 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
                </span>
              )}
            </h3>
            {approvedCount > 0 && (
              <button
                onClick={handleSaveApproved}
                className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl"
              >
                <Check className="w-3.5 h-3.5" />
                Guardar {approvedCount}
              </button>
            )}
          </div>

          <PendingReviewList
            transactions={pendingTransactions}
            onApprove={handleApprove}
            onReject={handleReject}
            onCategoryChange={handleCategoryChange}
            onTypeChange={handleTypeChange}
          />
        </div>
      )}
    </div>
  );
}

// ─── Pending Review List (banner + filtro + cartões) ─────────────────────────

function PendingReviewList({
  transactions,
  onApprove,
  onReject,
  onCategoryChange,
  onTypeChange,
}: {
  transactions: PendingTransaction[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCategoryChange: (id: string, category: string) => void;
  onTypeChange: (id: string, type: PendingTransaction["type"]) => void;
}) {
  const [onlyToConfirm, setOnlyToConfirm] = useState(false);

  // Duplicados detectados (já existentes) são saltados — não entram na lista.
  const fresh = transactions.filter((tx) => !tx.duplicate);
  const toConfirm = fresh.filter(
    (tx) => needsConfirmation(tx) && tx.status === "pending"
  );
  const visible = onlyToConfirm ? toConfirm : fresh;

  return (
    <div className="space-y-3">
      {toConfirm.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">
                ⚠️ {toConfirm.length} movimento{toConfirm.length !== 1 ? "s" : ""} para confirmar
              </p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Verifica se são gastos, transferências tuas ou empréstimos.
              </p>
              <button
                onClick={() => setOnlyToConfirm((v) => !v)}
                className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  onlyToConfirm
                    ? "bg-amber-600 text-white"
                    : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-100"
                }`}
              >
                {onlyToConfirm ? "A mostrar só a confirmar" : "Mostrar só a confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {visible.map((tx) => (
        <PendingTransactionCard
          key={tx.id}
          transaction={tx}
          onApprove={() => onApprove(tx.id)}
          onReject={() => onReject(tx.id)}
          onCategoryChange={(cat) => onCategoryChange(tx.id, cat)}
          onTypeChange={(type) => onTypeChange(tx.id, type)}
        />
      ))}
    </div>
  );
}

// ─── Pending Transaction Card ────────────────────────────────────────────────

const TYPE_OPTIONS: { value: PendingTransaction["type"]; label: string }[] = [
  { value: "income", label: "Entrada" },
  { value: "expense", label: "Saída" },
  { value: "transfer", label: "Transferência" },
];

function PendingTransactionCard({
  transaction: tx,
  onApprove,
  onReject,
  onCategoryChange,
  onTypeChange,
}: {
  transaction: PendingTransaction;
  onApprove: () => void;
  onReject: () => void;
  onCategoryChange: (category: string) => void;
  onTypeChange: (type: PendingTransaction["type"]) => void;
}) {
  const [showCategories, setShowCategories] = useState(false);

  const typeColors = {
    income: "text-emerald-600 bg-emerald-50",
    expense: "text-red-600 bg-red-50",
    transfer: "text-blue-600 bg-blue-50",
  };

  const typeLabels = {
    income: "Rendimento",
    expense: "Despesa",
    transfer: "Transferência",
  };

  const statusStyles = {
    pending: "border-gray-200 bg-white",
    approved: "border-emerald-200 bg-emerald-50/50",
    rejected: "border-red-200 bg-red-50/30 opacity-60",
    editing: "border-blue-200 bg-blue-50/30",
  };

  // Movimentos a confirmar destacam-se (âmbar) enquanto pendentes.
  const flagged = needsConfirmation(tx) && tx.status === "pending";
  const cardStyle = flagged ? "border-amber-300 bg-amber-50/40" : statusStyles[tx.status];

  const allCategories = categoriesForType(tx.type);

  return (
    <div className={`rounded-2xl border p-4 transition-all ${cardStyle}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${typeColors[tx.type]}`}>
              {typeLabels[tx.type]}
            </span>
            <span className="text-[10px] text-gray-400">{tx.source}</span>
            {tx.learned && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                ✓ Aprendido
              </span>
            )}
            {tx.confidence >= 0.8 && (
              <span className="text-[10px] text-emerald-500 font-medium">Alta confiança</span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900">{tx.description}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {tx.date} {tx.accountHint && `· ${tx.accountHint}`}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${tx.type === "income" ? "text-emerald-600" : tx.type === "expense" ? "text-gray-900" : "text-blue-600"}`}>
            {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
            {tx.amount.toLocaleString("pt-MZ")} {tx.currency}
          </p>
        </div>
      </div>

      {/* Contrapartida reconhecida — transferência já registada do outro lado */}
      {tx.counterpart && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
          <span className="text-sm font-semibold text-blue-700">
            🔗 Contrapartida — já registada
            {tx.counterpartAccount ? ` (${tx.counterpartAccount})` : ""}
          </span>
        </div>
      )}

      {/* Type toggle */}
      {tx.status !== "rejected" && (
        <div className="flex gap-1.5 mb-3">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onTypeChange(opt.value)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                tx.type === opt.value
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Category */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowCategories(!showCategories)}
          className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <Edit3 className="w-3 h-3" />
          {tx.category}
          <ChevronRight className={`w-3 h-3 transition-transform ${showCategories ? "rotate-90" : ""}`} />
        </button>
        {tx.suggestedCategory && tx.suggestedCategory !== tx.category && (
          <span className="text-[10px] text-gray-400">
            Sugerido: {tx.suggestedCategory}
          </span>
        )}
      </div>

      {/* Category picker */}
      {showCategories && (
        <div className="mb-3 grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-xl">
          {allCategories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => {
                onCategoryChange(cat.name);
                setShowCategories(false);
              }}
              className={`text-xs px-2 py-1.5 rounded-lg text-left transition-colors ${
                tx.category === cat.name
                  ? "bg-emerald-500 text-white font-semibold"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-100"
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      {tx.status === "pending" && (
        <div className="flex items-center gap-2">
          <button
            onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-emerald-600 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Aprovar
          </button>
          <button
            onClick={onReject}
            className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-semibold py-2.5 px-4 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {tx.status === "approved" && (
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-xs font-semibold">Aprovada</span>
        </div>
      )}

      {tx.status === "rejected" && (
        <div className="flex items-center gap-2 text-red-500">
          <XCircle className="w-4 h-4" />
          <span className="text-xs font-semibold">Rejeitada</span>
        </div>
      )}
    </div>
  );
}

// ─── Import Tab (Bank Statements & Other Apps) ─────────────────────────────

function ImportTab() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Resultado original do Mobills (antes do mapeamento/corte) e resumo do corte.
  const [mobillsRaw, setMobillsRaw] = useState<ImportResult | null>(null);
  const [mobillsSummary, setMobillsSummary] = useState<MobillsCutSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Depois do parse: Mobills vai primeiro ao passo de preparação (mapeamento +
  // corte); os restantes formatos vão directamente à revisão.
  const routeAfterParse = useCallback((result: ImportResult, fmt: string) => {
    if (fmt === "mobills") {
      setMobillsRaw(result);
      setImportResult(null);
      setMobillsSummary(null);
      setStep("mobills");
    } else {
      setImportResult(result);
      setStep("preview");
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    setImporting(true);
    setError(null);

    try {
      const filename = file.name.toLowerCase();
      const isExcel = filename.endsWith(".xlsx") || filename.endsWith(".xls");
      const isPdf = filename.endsWith(".pdf");

      if (isPdf) {
        // Extração do texto do PDF acontece no browser (pdfjs). O extrato
        // M-Pesa não tem CSV — reconstruímos as linhas pelas coordenadas.
        const { parseMpesaPdfFile } = await import("@/lib/mpesa-pdf-client");
        const data = await parseMpesaPdfFile(file);
        if (data.success) {
          setDetectedFormat("mpesa");
          routeAfterParse(data, "mpesa");
        } else {
          setError(
            data.errors[0] ||
              "PDF não reconhecido — de momento só extratos M-Pesa em PDF"
          );
        }
      } else if (isExcel) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("format", "auto");

        const response = await fetch("/api/import", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (data.success) {
          const fmt = data.detectedFormat || "auto";
          setDetectedFormat(fmt);
          routeAfterParse(data, fmt);
        } else {
          setError(data.error || "Erro ao processar ficheiro");
        }
      } else {
        const csvContent = await file.text();

        const response = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvContent, format: "auto", filename: file.name }),
        });

        const data = await response.json();
        if (data.success) {
          const fmt = data.detectedFormat || "auto";
          setDetectedFormat(fmt);
          routeAfterParse(data, fmt);
        } else {
          setError(data.error || "Erro ao processar ficheiro");
        }
      }
    } catch {
      setError("Erro ao ler ficheiro. Verifica se o formato está correcto.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [routeAfterParse]);

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="space-y-6">
      {step === "upload" && (
        <>
          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              dragOver
                ? "border-emerald-400 bg-emerald-50/50 scale-[1.01]"
                : "border-gray-200 bg-gray-50/50 hover:border-emerald-300 hover:bg-emerald-50/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt,.pdf"
              onChange={handleFileInput}
              className="hidden"
            />

            {importing ? (
              <div className="py-4">
                <Loader2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 animate-spin" />
                <p className="text-sm font-semibold text-gray-700">A processar...</p>
                <p className="text-xs text-gray-400 mt-1">O BUDGY está a ler e categorizar</p>
              </div>
            ) : (
              <div className="py-4">
                <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? "text-emerald-500" : "text-gray-400"}`} />
                <p className="text-sm font-semibold text-gray-700">
                  Arrasta aqui o ficheiro do banco
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  CSV, Excel ou PDF (M-Pesa) — CPC, Moza Banco, Standard Bank, Mobills
                </p>
                <p className="text-xs text-gray-300 mt-0.5">
                  ou clica para escolher
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-red-900">Erro</h3>
                  <p className="text-xs text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {step === "mobills" && mobillsRaw && (
        <MobillsPrepareStep
          result={mobillsRaw}
          onBack={() => { setStep("upload"); setMobillsRaw(null); setDetectedFormat(null); }}
          onContinue={(filtered, summary) => {
            setImportResult(filtered);
            setMobillsSummary(summary);
            setStep("preview");
          }}
        />
      )}
      {step === "preview" && importResult && (
        <ImportPreview
          result={importResult}
          detectedFormat={detectedFormat}
          mobillsSummary={mobillsSummary}
          onBack={() => {
            // Volta ao passo de preparação Mobills se veio de lá; senão, ao upload.
            if (mobillsRaw) {
              setStep("mobills");
              setImportResult(null);
              setMobillsSummary(null);
            } else {
              setStep("upload");
              setImportResult(null);
              setDetectedFormat(null);
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Passo de Preparação Mobills (mapeamento de contas + corte por conta) ────

function MobillsPrepareStep({
  result,
  onBack,
  onContinue,
}: {
  result: ImportResult;
  onBack: () => void;
  onContinue: (filtered: ImportResult, summary: MobillsCutSummary) => void;
}) {
  const { data: accounts, loading: accountsLoading } = useAccounts();
  // Janela larga para apanhar a data mais antiga de cada conta.
  const { data: existingTx, loading: txLoading } = useTransactions({
    from: "2000-01-01",
    limit: 100000,
  });

  const loading = accountsLoading || txLoading;

  const mobillsAccounts = useMemo(() => getMobillsAccountNames(result), [result]);
  const appAccountNames = useMemo(
    () => (accounts ?? []).map((a) => a.name),
    [accounts]
  );

  // Data mais antiga já existente por nome de conta (o corte).
  const earliestByAccount = useMemo(
    () =>
      earliestDatesByAccount(
        (existingTx ?? []).map((t) => ({ date: t.date, accountName: t.accounts?.name ?? null }))
      ),
    [existingTx]
  );

  // Mapeamento: nome Mobills → nome de conta app OU CREATE_NEW.
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Preenche defaults quando as contas carregam (ou os nomes Mobills mudam).
  useEffect(() => {
    if (loading) return;
    setMapping((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const name of mobillsAccounts) {
        if (next[name] === undefined) {
          next[name] = defaultTargetFor(name, appAccountNames);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [loading, mobillsAccounts, appAccountNames]);

  const handleContinue = () => {
    // Mapeamento final: CREATE_NEW → o próprio nome Mobills (conta nova).
    const finalMapping: Record<string, string> = {};
    for (const name of mobillsAccounts) {
      const target = mapping[name] ?? defaultTargetFor(name, appAccountNames);
      finalMapping[name] = target === CREATE_NEW ? name : target;
    }

    // Cortes: só para contas destino que JÁ têm dados existentes.
    const cutoffs: Record<string, string> = {};
    for (const name of mobillsAccounts) {
      const target = finalMapping[name]!;
      const cutoff = earliestByAccount[target];
      if (cutoff) cutoffs[target] = cutoff;
    }

    const { kept, droppedCount, total } = applyMobillsMappingAndCutoff(
      result.imported,
      finalMapping,
      cutoffs
    );
    const filtered = rebuildMobillsResult(result, kept, finalMapping);
    onContinue(filtered, { total, kept: kept.length, dropped: droppedCount });
  };

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-emerald-900">Preparar importação Mobills</h3>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
              Para não duplicar o que já importaste dos extratos, o Mobills só entra em datas
              <strong> ANTERIORES</strong> ao que já tens em cada conta. Confirma o mapeamento
              das contas em baixo.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm">A ler as tuas contas e datas...</span>
        </div>
      ) : (
        <>
          {/* (a) Mapeamento de contas */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Mapeamento de contas</h3>
            <p className="text-xs text-gray-500 mb-4">
              Liga cada conta do Mobills a uma conta da app (ou cria uma nova).
            </p>
            <div className="space-y-3">
              {mobillsAccounts.map((name) => {
                const selected = mapping[name] ?? defaultTargetFor(name, appAccountNames);
                const targetName = selected === CREATE_NEW ? name : selected;
                const cutoff = selected === CREATE_NEW ? undefined : earliestByAccount[targetName];
                return (
                  <div key={name} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{name}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <select
                        value={selected}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, [name]: e.target.value }))
                        }
                        className="flex-1 min-w-[140px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        {appAccountNames.map((appName) => (
                          <option key={appName} value={appName}>
                            {appName}
                          </option>
                        ))}
                        <option value={CREATE_NEW}>Criar nova conta &quot;{name}&quot;</option>
                      </select>
                    </div>
                    {/* (b) Corte por conta */}
                    <p className="text-[11px] mt-2 ml-0.5">
                      {cutoff ? (
                        <span className="text-amber-700">
                          Corte: só entram transações <strong>antes de {cutoff}</strong> (o que já
                          tens fica intacto).
                        </span>
                      ) : (
                        <span className="text-emerald-700">Sem dados — importa tudo.</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Explicação do corte */}
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Para não duplicar o que já importaste dos extratos, o Mobills só entra em datas
                ANTERIORES ao que já tens em cada conta. Contas novas (sem dados) importam tudo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 font-semibold py-3 px-5 rounded-2xl hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white font-semibold py-3 rounded-2xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
            >
              Continuar
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Import Preview ──────────────────────────────────────────────────────────

function ImportPreview({
  result,
  detectedFormat,
  mobillsSummary,
  onBack,
}: {
  result: ImportResult;
  detectedFormat?: string | null;
  mobillsSummary?: MobillsCutSummary | null;
  onBack: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Lista editável de movimentos (com decisões aprendidas já aplicadas).
  const [pending, setPending] = useState<PendingTransaction[]>(() =>
    applyLearnedRules(
      result.imported.map((tx, i) => ({
        id: `imp-${i}`,
        source: detectedFormat && detectedFormat !== "auto" ? detectedFormat : "Extrato",
        type: tx.type,
        amount: tx.amount,
        currency: "MZN",
        date: tx.date,
        description: tx.description,
        category: tx.mappedCategory,
        suggestedCategory: tx.mappedCategory,
        accountHint: tx.account,
        confidence: tx.needsReview ? 0.5 : 0.9,
        status: "pending" as const,
      }))
    )
  );

  // Reconhece contrapartidas de transferências já guardadas do outro lado.
  useCounterpartMatching(pending, setPending);

  // Deteção automática de duplicados contra o que já está guardado. Quando
  // reimportas um extrato que se sobrepõe a dias já lançados, as transações que
  // já existem (mesma conta + data + valor + descrição) são saltadas sozinhas —
  // vês só as novas, sem teres de rejeitar à mão.
  const { data: existingTx, loading: existingLoading } = useTransactions({
    from: "2000-01-01",
    limit: 100000,
  });
  const [dedupDone, setDedupDone] = useState(false);
  const [dedupCount, setDedupCount] = useState(0);

  useEffect(() => {
    if (dedupDone || existingLoading || !existingTx) return;
    // Multiset das assinaturas já guardadas (conta com repetições exactas).
    const counts = new Map<string, number>();
    for (const t of existingTx) {
      const sig = dedupSignature(
        t.accounts?.name ?? null,
        t.date,
        Number(t.amount) || 0,
        t.description ?? ""
      );
      counts.set(sig, (counts.get(sig) ?? 0) + 1);
    }
    // Percorre os importados por ordem, consumindo uma ocorrência por match.
    let found = 0;
    const marks = pending.map((tx) => {
      const sig = dedupSignature(tx.accountHint ?? null, tx.date, tx.amount, tx.description);
      const c = counts.get(sig) ?? 0;
      if (c > 0) {
        counts.set(sig, c - 1);
        found++;
        return true;
      }
      return false;
    });
    if (found > 0) {
      setPending((prev) =>
        prev.map((tx, i) =>
          marks[i] ? { ...tx, status: "rejected" as const, duplicate: true } : tx
        )
      );
    }
    setDedupCount(found);
    setDedupDone(true);
  }, [existingTx, existingLoading, dedupDone, pending]);

  const handleApprove = (id: string) => {
    setPending((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        rememberDecision(tx.description, tx.amount, { type: tx.type, category: tx.category });
        return { ...tx, status: "approved" as const };
      })
    );
  };

  const handleReject = (id: string) => {
    setPending((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, status: "rejected" as const } : tx))
    );
  };

  const handleCategoryChange = (id: string, category: string) => {
    setPending((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        rememberDecision(tx.description, tx.amount, { type: tx.type, category });
        return { ...tx, category, status: "pending" as const };
      })
    );
  };

  const handleTypeChange = (id: string, type: PendingTransaction["type"]) => {
    setPending((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        const category = defaultCategoryForType(type, tx.category);
        rememberDecision(tx.description, tx.amount, { type, category });
        return { ...tx, type, category, status: "pending" as const };
      })
    );
  };

  // Guardamos tudo o que não foi rejeitado (as edições sobrepõem-se ao original).
  const toSave = pending.filter((tx) => tx.status !== "rejected");

  const handleSaveToDatabase = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const transactions = toSave.map((tx) => {
        const idx = Number(tx.id.slice(4));
        const orig = result.imported[idx];
        return {
          type: tx.type,
          amount: tx.amount,
          currency: "MZN",
          date: tx.date,
          description: tx.description,
          account: tx.accountHint,
          transfer_to_account: orig?.transferToAccount,
          category_name: tx.category,
          tags: orig?.tags,
          status: orig?.status,
        };
      });

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions,
          // Calibra automaticamente os saldos das contas a partir do
          // "Saldo de Abertura" lido do extracto bancário (CPC, Moza)
          openingBalances: result.openingBalances,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSaved(true);
      } else {
        setSaveError(data.error || "Erro ao guardar transações");
      }
    } catch {
      setSaveError("Erro de rede. Tenta novamente.");
    } finally {
      setSaving(false);
    }
  };
  const topCategories = Object.entries(result.summary.categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Resumo do corte Mobills (anti-duplicados) */}
      {mobillsSummary && (
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800 leading-relaxed">
              De <strong>{mobillsSummary.total}</strong> linhas do Mobills,{" "}
              <strong>{mobillsSummary.kept}</strong> entram (as anteriores aos teus extratos);{" "}
              <strong>{mobillsSummary.dropped}</strong> saltadas por já estarem cobertas pelos
              extratos.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Resumo da importação</h3>
            {detectedFormat && detectedFormat !== "auto" && (
              <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">
                {detectedFormat === "cpc" ? "CSV (Inglês)" : detectedFormat === "moza" ? "CSV (Português)" : detectedFormat === "standard-bank" ? "Excel" : detectedFormat === "mpesa" ? "PDF (M-Pesa)" : "App externa"}
              </span>
            )}
          </div>
          <button
            onClick={onBack}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Outro ficheiro
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{result.imported.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Transações</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{result.accountsFound.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Contas</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <div className="text-sm font-bold text-emerald-700">
              +{result.summary.totalIncome.toLocaleString("pt-MZ")}
            </div>
            <div className="text-[10px] text-emerald-600 mt-1">Rendimentos</div>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <div className="text-sm font-bold text-red-700">
              -{result.summary.totalExpenses.toLocaleString("pt-MZ")}
            </div>
            <div className="text-[10px] text-red-600 mt-1">Despesas</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <div className="text-sm font-bold text-blue-700">
              {result.summary.totalTransfers.toLocaleString("pt-MZ")}
            </div>
            <div className="text-[10px] text-blue-600 mt-1">Transferências</div>
          </div>
        </div>

        {result.dateRange && (
          <p className="text-xs text-gray-400 text-center mt-3">
            Período: {result.dateRange.from} a {result.dateRange.to}
          </p>
        )}
      </div>

      {/* Categories organized — with subcategories and mapping detail */}
      {(() => {
        const expenseNames = new Set<string>(BUDGY_CATEGORIES.expense.map((c) => c.name as string));
        const incomeNames = new Set<string>(BUDGY_CATEGORIES.income.map((c) => c.name as string));

        // Build category → subcategory breakdown from imported transactions
        const categoryBreakdown: Record<string, Record<string, { count: number; originals: Set<string> }>> = {};
        for (const tx of result.imported) {
          const cat = tx.mappedCategory;
          const sub = tx.mappedSubcategory || "Geral";
          if (!categoryBreakdown[cat]) categoryBreakdown[cat] = {};
          if (!categoryBreakdown[cat][sub]) categoryBreakdown[cat][sub] = { count: 0, originals: new Set() };
          categoryBreakdown[cat][sub].count++;
          if (tx.originalCategory && tx.originalCategory !== "Outros") {
            categoryBreakdown[cat][sub].originals.add(tx.originalCategory);
          }
        }

        const allCats = Object.entries(result.summary.categoryCounts).sort((a, b) => b[1] - a[1]);
        const expenses = allCats.filter(([cat]) => expenseNames.has(cat) || (!incomeNames.has(cat) && cat !== "Transferência"));
        const income = allCats.filter(([cat]) => incomeNames.has(cat));
        const totalTx = result.imported.length;

        const renderCategoryGroup = (cats: [string, number][], barColor: string) => (
          <div className="space-y-3">
            {cats.map(([category, count]) => {
              const pct = Math.round((count / totalTx) * 100);
              const subs = categoryBreakdown[category] || {};
              const subEntries = Object.entries(subs).sort((a, b) => b[1].count - a[1].count);

              return (
                <div key={category} className="border border-gray-100 rounded-xl p-3">
                  {/* Category header with bar */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-800">{category}</span>
                    <span className="text-xs text-gray-400">{count}x</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>

                  {/* Subcategories detail */}
                  {subEntries.length > 0 && (
                    <div className="space-y-1 ml-2 border-l-2 border-gray-100 pl-3">
                      {subEntries.map(([sub, data]) => (
                        <div key={sub} className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] text-gray-600">{sub}</span>
                            {data.originals.size > 0 && (
                              <span className="text-[10px] text-gray-400 ml-1">
                                ← {Array.from(data.originals).slice(0, 3).join(", ")}
                                {data.originals.size > 3 && ` +${data.originals.size - 3}`}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">{data.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );

        return (
          <>
            {expenses.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1">Despesas</h3>
                <p className="text-xs text-gray-500 mb-3">{expenses.length} categorias organizadas automaticamente</p>
                {renderCategoryGroup(expenses, "bg-red-400")}
              </div>
            )}
            {income.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1">Rendimentos</h3>
                <p className="text-xs text-gray-500 mb-3">{income.length} categorias</p>
                {renderCategoryGroup(income, "bg-emerald-400")}
              </div>
            )}
          </>
        );
      })()}

      {/* Accounts Found */}
      {result.accountsFound.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Contas encontradas</h3>
          <div className="flex flex-wrap gap-2">
            {result.accountsFound.map((account) => (
              <span
                key={account}
                className="text-xs font-medium bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg"
              >
                {account}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Errors/Warnings */}
      {result.errors.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-900">Avisos</h3>
          </div>
          <ul className="space-y-1">
            {result.errors.slice(0, 5).map((err, i) => (
              <li key={i} className="text-xs text-amber-700">{err}</li>
            ))}
            {result.errors.length > 5 && (
              <li className="text-xs text-amber-500">
                +{result.errors.length - 5} mais avisos
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Duplicados saltados automaticamente (reimportação de dias já lançados) */}
      {!saved && dedupCount > 0 && (
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800 leading-relaxed">
              <strong>{dedupCount}</strong> transaç{dedupCount !== 1 ? "ões já existiam" : "ão já existia"}{" "}
              e {dedupCount !== 1 ? "foram saltadas" : "foi saltada"} automaticamente (dias que já
              tinhas lançado). Vês só as <strong>novas</strong> em baixo.
            </p>
          </div>
        </div>
      )}

      {/* Rever transações — detectar, questionar e aprender */}
      {!saved && pending.some((tx) => !tx.duplicate) && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-3">Rever transações</h3>
          <PendingReviewList
            transactions={pending}
            onApprove={handleApprove}
            onReject={handleReject}
            onCategoryChange={handleCategoryChange}
            onTypeChange={handleTypeChange}
          />
        </div>
      )}

      {/* Import Button */}
      {saved ? (
        <div className="w-full flex items-center justify-center gap-3 bg-emerald-100 text-emerald-700 font-semibold py-4 rounded-2xl">
          <CheckCircle2 className="w-5 h-5" />
          {toSave.length} transações importadas com sucesso!
        </div>
      ) : (
        <button
          className="w-full flex items-center justify-center gap-3 bg-emerald-500 text-white font-semibold py-4 rounded-2xl hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
          onClick={handleSaveToDatabase}
          disabled={saving || toSave.length === 0}
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              A guardar...
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Importar {toSave.length} transações
            </>
          )}
        </button>
      )}

      {/* Generate PDF Report Button */}
      <button
        className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 font-semibold py-4 rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all"
        onClick={() => generateImportPDF(result)}
      >
        <span className="text-lg">📄</span>
        Gerar Relatório
      </button>

      {saveError && (
        <div className="flex items-start gap-3 bg-red-50 rounded-2xl p-4 border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{saveError}</p>
        </div>
      )}
    </div>
  );
}
