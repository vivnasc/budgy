"use client";

import { useState, useRef, useCallback } from "react";
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
} from "lucide-react";
import Link from "next/link";
import type { ParsedSMS } from "@/lib/sms-parser";
import type { ImportResult } from "@/lib/mobills-import";
import { generateImportPDF } from "@/lib/import-pdf";
import { SUPPORTED_BANKS } from "@/lib/sms-parser";
import { BUDGY_CATEGORIES } from "@/lib/mobills-import";
import { SUPPORTED_BANK_FORMATS, type BankFormat } from "@/lib/bank-statement-parser";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "sms" | "import";
type ImportStep = "upload" | "preview" | "mapping" | "confirm";

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
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ImportarPage() {
  const [activeTab, setActiveTab] = useState<Tab>("sms");

  return (
    <div className="min-h-screen bg-gray-50">
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
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "sms"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <MessageSquareText className="w-4 h-4" />
            SMS Bancário
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "import"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar Ficheiro
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6">
        {activeTab === "sms" ? <SMSTab /> : <ImportTab />}
      </div>
    </div>
  );
}

// ─── SMS Tab ─────────────────────────────────────────────────────────────────

function SMSTab() {
  const [smsText, setSmsText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        setPendingTransactions((prev) => [...newTransactions, ...prev]);
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
        setPendingTransactions((prev) => [newTx, ...prev]);
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
      prev.map((tx) => (tx.id === id ? { ...tx, status: "approved" as const } : tx))
    );
  };

  const handleReject = (id: string) => {
    setPendingTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, status: "rejected" as const } : tx))
    );
  };

  const handleCategoryChange = (id: string, category: string) => {
    setPendingTransactions((prev) =>
      prev.map((tx) =>
        tx.id === id ? { ...tx, category, status: "pending" as const } : tx
      )
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

          <div className="space-y-3">
            {pendingTransactions.map((tx) => (
              <PendingTransactionCard
                key={tx.id}
                transaction={tx}
                onApprove={() => handleApprove(tx.id)}
                onReject={() => handleReject(tx.id)}
                onCategoryChange={(cat) => handleCategoryChange(tx.id, cat)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pending Transaction Card ────────────────────────────────────────────────

function PendingTransactionCard({
  transaction: tx,
  onApprove,
  onReject,
  onCategoryChange,
}: {
  transaction: PendingTransaction;
  onApprove: () => void;
  onReject: () => void;
  onCategoryChange: (category: string) => void;
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

  const allCategories = tx.type === "income"
    ? BUDGY_CATEGORIES.income
    : tx.type === "transfer"
    ? BUDGY_CATEGORIES.transfer
    : BUDGY_CATEGORIES.expense;

  return (
    <div className={`rounded-2xl border p-4 transition-all ${statusStyles[tx.status]}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${typeColors[tx.type]}`}>
              {typeLabels[tx.type]}
            </span>
            <span className="text-[10px] text-gray-400">{tx.source}</span>
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
  const [selectedFormat, setSelectedFormat] = useState<BankFormat>("auto");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);

    try {
      const filename = file.name.toLowerCase();
      const isExcel = filename.endsWith(".xlsx") || filename.endsWith(".xls");

      if (isExcel) {
        // Use FormData for Excel files
        const formData = new FormData();
        formData.append("file", file);
        formData.append("format", selectedFormat);

        const response = await fetch("/api/import", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (data.success) {
          setImportResult(data);
          setDetectedFormat(data.detectedFormat || selectedFormat);
          setStep("preview");
        } else {
          setError(data.error || "Erro ao processar ficheiro Excel");
        }
      } else {
        // CSV/text files
        const csvContent = await file.text();

        const response = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvContent, format: selectedFormat, filename: file.name }),
        });

        const data = await response.json();
        if (data.success) {
          setImportResult(data);
          setDetectedFormat(data.detectedFormat || selectedFormat);
          setStep("preview");
        } else {
          setError(data.error || "Erro ao processar ficheiro");
        }
      }
    } catch {
      setError("Erro ao ler ficheiro. Verifica se o formato está correcto.");
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [selectedFormat]);

  const acceptedFileTypes = selectedFormat === "auto"
    ? ".csv,.xlsx,.xls,.txt"
    : SUPPORTED_BANK_FORMATS.find((b) => b.id === selectedFormat)?.fileTypes.join(",") || ".csv,.xlsx";

  return (
    <div className="space-y-6">
      {step === "upload" && (
        <>
          {/* Instructions */}
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <div className="flex items-start gap-3">
              <Upload className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-blue-900">Importar Extrato Bancário</h3>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                  Carrega o extrato do teu banco ou a exportação de outra app.
                  O BUDGY deteta o formato, organiza as categorias e importa tudo automaticamente.
                </p>
              </div>
            </div>
          </div>

          {/* Bank Format Selection */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Formato do ficheiro
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_BANK_FORMATS.map((bank) => (
                <button
                  key={bank.id}
                  onClick={() => setSelectedFormat(bank.id)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    selectedFormat === bank.id
                      ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200"
                      : "border-gray-100 bg-white hover:border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {bank.id === "auto" ? (
                      <Sparkles className={`w-4 h-4 ${selectedFormat === bank.id ? "text-emerald-600" : "text-gray-400"}`} />
                    ) : (
                      <FileSpreadsheet className={`w-4 h-4 ${selectedFormat === bank.id ? "text-emerald-600" : "text-gray-400"}`} />
                    )}
                    <span className={`text-sm font-semibold ${selectedFormat === bank.id ? "text-emerald-900" : "text-gray-700"}`}>
                      {bank.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {bank.description}
                  </span>
                  <span className="text-[10px] text-gray-300 mt-0.5">
                    {bank.fileTypes.join(", ")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full flex items-center justify-center gap-3 bg-emerald-500 text-white font-semibold py-4 rounded-2xl hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
          >
            {importing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                A processar...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Carregar ficheiro
              </>
            )}
          </button>

          {error && (
            <div className="flex items-start gap-3 bg-red-50 rounded-2xl p-4 border border-red-100">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Help Section */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">
              Como obter o extrato
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-base">🏦</span>
                <span className="text-xs text-gray-600">
                  Internet Banking do teu banco → Extractos → Exportar CSV ou Excel
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base">📱</span>
                <span className="text-xs text-gray-600">
                  App do banco → Movimentos → Download / Exportar
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base">📊</span>
                <span className="text-xs text-gray-600">
                  Outra app → Definições → Exportar dados (Excel)
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {step === "preview" && importResult && (
        <ImportPreview
          result={importResult}
          detectedFormat={detectedFormat}
          onBack={() => { setStep("upload"); setImportResult(null); setDetectedFormat(null); }}
        />
      )}
    </div>
  );
}

// ─── Import Preview ──────────────────────────────────────────────────────────

function ImportPreview({
  result,
  detectedFormat,
  onBack,
}: {
  result: ImportResult;
  detectedFormat?: string | null;
  onBack: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [categoriesConfirmed, setCategoriesConfirmed] = useState(false);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});

  // Build the list of all available BUDGY category names (expense + income + transfer, deduplicated)
  const allCategoryNames: string[] = [];
  const seenNames = new Set<string>();
  for (const group of [BUDGY_CATEGORIES.expense, BUDGY_CATEGORIES.income, BUDGY_CATEGORIES.transfer]) {
    for (const cat of group) {
      if (!seenNames.has(cat.name)) {
        seenNames.add(cat.name);
        allCategoryNames.push(cat.name);
      }
    }
  }

  // Current mapped categories with counts (before overrides), sorted by count
  const mappedCategories = Object.entries(result.summary.categoryCounts)
    .sort((a, b) => b[1] - a[1]);

  const handleCategoryOverride = (originalMapped: string, newCategory: string) => {
    setCategoryOverrides((prev) => {
      if (newCategory === originalMapped) {
        // Remove override if set back to original
        const next = { ...prev };
        delete next[originalMapped];
        return next;
      }
      return { ...prev, [originalMapped]: newCategory };
    });
  };

  const handleConfirmCategories = () => {
    // Apply overrides to all transactions in result.imported
    if (Object.keys(categoryOverrides).length > 0) {
      for (const tx of result.imported) {
        const override = categoryOverrides[tx.mappedCategory];
        if (override) {
          tx.mappedCategory = override;
        }
      }
      // Update summary categoryCounts to match
      const newCounts: Record<string, number> = {};
      for (const tx of result.imported) {
        newCounts[tx.mappedCategory] = (newCounts[tx.mappedCategory] ?? 0) + 1;
      }
      result.summary.categoryCounts = newCounts;
      setCategoryOverrides({});
    }
    setCategoriesConfirmed(true);
  };

  const handleSaveToDatabase = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const transactions = result.imported.map((tx) => ({
        type: tx.type,
        amount: tx.amount,
        currency: "MZN",
        date: tx.date,
        description: tx.description,
      }));

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions }),
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
      {/* Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Resumo da importação</h3>
            {detectedFormat && detectedFormat !== "auto" && (
              <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">
                {detectedFormat === "cpc" ? "CSV (Inglês)" : detectedFormat === "moza" ? "CSV (Português)" : detectedFormat === "standard-bank" ? "Excel" : "App externa"}
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

      {/* Category Review & Recategorization */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-gray-900">
            {categoriesConfirmed ? "Categorias confirmadas" : "Rever categorias"}
          </h3>
          {categoriesConfirmed && (
            <button
              onClick={() => setCategoriesConfirmed(false)}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              Editar
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {categoriesConfirmed
            ? `${Object.keys(result.summary.categoryCounts).length} categorias organizadas.`
            : `Verifica as ${mappedCategories.length} categorias mapeadas. Podes alterar antes de importar.`
          }
        </p>

        {!categoriesConfirmed ? (
          <>
            <div className="space-y-2.5">
              {mappedCategories.map(([category, count]) => {
                const currentValue = categoryOverrides[category] ?? category;
                const isOverridden = categoryOverrides[category] !== undefined;
                return (
                  <div key={category} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium truncate ${isOverridden ? "text-emerald-700 line-through" : "text-gray-700"}`}>
                          {category}
                        </span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                          {count} tx
                        </span>
                      </div>
                    </div>
                    <select
                      value={currentValue}
                      onChange={(e) => handleCategoryOverride(category, e.target.value)}
                      className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 max-w-[160px]"
                    >
                      {allCategoryNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {Object.keys(categoryOverrides).length > 0 && (
              <div className="mt-3 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <p className="text-xs text-emerald-700 font-medium mb-1">
                  Alterações pendentes:
                </p>
                <div className="space-y-0.5">
                  {Object.entries(categoryOverrides).map(([from, to]) => {
                    const affectedCount = result.summary.categoryCounts[from] ?? 0;
                    return (
                      <p key={from} className="text-xs text-emerald-600">
                        {from} → {to} ({affectedCount} transações)
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={handleConfirmCategories}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-emerald-500 text-white text-sm font-semibold py-3 rounded-xl hover:bg-emerald-600 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirmar categorias
            </button>
          </>
        ) : (
          <div className="space-y-2">
            {topCategories.map(([category, count]) => {
              const percentage = Math.round((count / result.imported.length) * 100);
              return (
                <div key={category} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">{category}</span>
                      <span className="text-xs text-gray-400">{count}x</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Debug Info (temporary) */}
      {result.debug && (
        <div className="bg-yellow-50 rounded-2xl border border-yellow-200 p-5">
          <h3 className="text-sm font-bold text-yellow-900 mb-3">🔍 Debug — Dados brutos do ficheiro</h3>

          <div className="space-y-3 text-xs">
            <div>
              <p className="font-semibold text-yellow-800">Cabeçalhos detectados (linha {result.debug.headerRowIndex}):</p>
              <p className="text-yellow-700 font-mono bg-yellow-100 p-2 rounded mt-1 break-all">
                {result.debug.detectedHeaders.join(" | ")}
              </p>
            </div>

            <div>
              <p className="font-semibold text-yellow-800">Mapeamento de colunas:</p>
              <div className="text-yellow-700 font-mono bg-yellow-100 p-2 rounded mt-1 space-y-0.5">
                {Object.entries(result.debug.headerMapping).map(([header, field]) => (
                  <div key={header}>{header} → {field}</div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-semibold text-yellow-800">Categorias originais do ficheiro (contagem):</p>
              <div className="text-yellow-700 font-mono bg-yellow-100 p-2 rounded mt-1 space-y-0.5">
                {Object.entries(result.debug.rawCategoryCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, count]) => (
                    <div key={cat}>&quot;{cat}&quot;: {count}x</div>
                  ))}
              </div>
            </div>

            {result.debug.rawCategorySample.length > 0 && (
              <div>
                <p className="font-semibold text-yellow-800">Amostra categorias/subcategorias:</p>
                <div className="text-yellow-700 font-mono bg-yellow-100 p-2 rounded mt-1 flex flex-wrap gap-1">
                  {result.debug.rawCategorySample.map((cat) => (
                    <span key={cat} className="bg-yellow-200 px-1.5 py-0.5 rounded">{cat}</span>
                  ))}
                </div>
              </div>
            )}

            {result.debug.sampleRow && (
              <div>
                <p className="font-semibold text-yellow-800">1ª linha de dados:</p>
                <div className="text-yellow-700 font-mono bg-yellow-100 p-2 rounded mt-1 space-y-0.5">
                  {Object.entries(result.debug.sampleRow).map(([key, val]) => (
                    <div key={key}><span className="text-yellow-900">{key}:</span> &quot;{val}&quot;</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Import Button — only after categories are confirmed */}
      {categoriesConfirmed && (
        <>
          {saved ? (
            <div className="w-full flex items-center justify-center gap-3 bg-emerald-100 text-emerald-700 font-semibold py-4 rounded-2xl">
              <CheckCircle2 className="w-5 h-5" />
              {result.imported.length} transações importadas com sucesso!
            </div>
          ) : (
            <button
              className="w-full flex items-center justify-center gap-3 bg-emerald-500 text-white font-semibold py-4 rounded-2xl hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
              onClick={handleSaveToDatabase}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Importar {result.imported.length} transações
                </>
              )}
            </button>
          )}
        </>
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
