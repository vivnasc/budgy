"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccounts } from "@/hooks/use-supabase-data";
import type { Account, AccountType } from "@/lib/supabase/types";
import {
  X,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Smartphone,
  Landmark,
  Banknote,
  PiggyBank,
  ShoppingCart,
  Utensils,
  Car,
  Zap,
  Home,
  GraduationCap,
  Heart,
  Gamepad2,
  Shirt,
  Wallet,
  Calendar,
  RefreshCw,
  StickyNote,
  Tag,
  ChevronDown,
  ChevronUp,
  Fuel,
  Bus,
  Phone,
  Users,
  Repeat,
  CreditCard,
  Loader2,
  type LucideIcon,
} from "lucide-react";

interface AddTransactionModalProps {
  onClose: () => void;
  onSaved?: () => void;
}

type TransactionType = "income" | "expense" | "transfer";
type Currency = "MZN" | "USD";
type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";
type InstallmentOption = 1 | 2 | 3 | 6 | 12;

interface CategoryItem {
  name: string;
  icon: LucideIcon;
}

const CATEGORIES: Record<TransactionType, CategoryItem[]> = {
  expense: [
    { name: "Alimentação", icon: Utensils },
    { name: "Transporte", icon: Car },
    { name: "Casa", icon: Home },
    { name: "Saúde", icon: Heart },
    { name: "Educação", icon: GraduationCap },
    { name: "Lazer", icon: Gamepad2 },
    { name: "Roupa", icon: Shirt },
    { name: "Comunicação", icon: Phone },
    { name: "Xitique", icon: Users },
    { name: "Gasosa", icon: Fuel },
    { name: "Chapa", icon: Bus },
    { name: "Compras", icon: ShoppingCart },
    { name: "Contas", icon: Zap },
  ],
  income: [
    { name: "Salário", icon: Wallet },
    { name: "Freelance", icon: Smartphone },
    { name: "Investimento", icon: PiggyBank },
    { name: "Xitique", icon: Users },
    { name: "Outro", icon: ArrowUpRight },
  ],
  transfer: [
    { name: "Transferência", icon: ArrowLeftRight },
  ],
};

/** Ícone sensato para cada tipo de conta real da utilizadora. */
function accountIcon(type: AccountType): LucideIcon {
  switch (type) {
    case "mpesa":
      return Smartphone;
    case "bank":
      return Landmark;
    case "cash":
      return Banknote;
    case "savings":
      return PiggyBank;
    default:
      return Wallet;
  }
}

const RECURRING_OPTIONS: { key: RecurringFrequency; label: string }[] = [
  { key: "daily", label: "Diário" },
  { key: "weekly", label: "Semanal" },
  { key: "monthly", label: "Mensal" },
  { key: "yearly", label: "Anual" },
];

const INSTALLMENT_OPTIONS: InstallmentOption[] = [1, 2, 3, 6, 12];

const SUGGESTED_TAGS = [
  "Essencial",
  "Trabalho",
  "Família",
  "Pessoal",
  "Urgente",
  "Investimento",
  "Festa",
  "Viagem",
];

export function AddTransactionModal({ onClose, onSaved }: AddTransactionModalProps) {
  const { data: accounts, loading: accountsLoading } = useAccounts();
  const realAccounts: Account[] = accounts ?? [];

  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("MZN");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedToAccount, setSelectedToAccount] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]!);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>("monthly");
  const [installments, setInstallments] = useState<InstallmentOption>(1);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Selecciona por defeito a primeira conta REAL assim que carregarem.
  useEffect(() => {
    if (!selectedAccount && realAccounts.length > 0) {
      setSelectedAccount(realAccounts[0]!.name);
    }
  }, [realAccounts, selectedAccount]);

  const currentCategories = CATEGORIES[type];

  const typeConfig = {
    income: {
      label: "Receita",
      icon: ArrowUpRight,
      color: "bg-emerald-500",
      activeColor: "bg-emerald-500 text-white",
    },
    expense: {
      label: "Despesa",
      icon: ArrowDownRight,
      color: "bg-red-500",
      activeColor: "bg-red-500 text-white",
    },
    transfer: {
      label: "Transferência",
      icon: ArrowLeftRight,
      color: "bg-indigo-500",
      activeColor: "bg-indigo-500 text-white",
    },
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const exchangeRate = 63.5;
  const displayAmount = amount
    ? currency === "MZN"
      ? `≈ ${(parseFloat(amount) / exchangeRate).toFixed(2)} USD`
      : `≈ ${(parseFloat(amount) * exchangeRate).toFixed(0)} MZN`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
        onClick={handleClose}
      />

      {/* Modal Sheet - Animated slide-up */}
      <div
        className={`relative w-full max-w-lg bg-[var(--color-surface)] rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden transition-transform duration-300 ease-out ${
          isClosing ? "translate-y-full" : "translate-y-0 animate-in"
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 bg-[var(--color-surface)] rounded-t-3xl flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-4 bg-[var(--color-surface)] flex-shrink-0">
          <h2 className="text-lg font-bold">Nova Transacção</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo com scroll — não corta em ecrãs pequenos */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-5">
          {/* Type Selector */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 block">
              Tipo
            </label>
            <div className="flex gap-2">
              {(Object.keys(typeConfig) as TransactionType[]).map((t) => {
                const config = typeConfig[t];
                const Icon = config.icon;
                const isSelected = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setType(t);
                      setSelectedCategory(null);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isSelected
                        ? config.activeColor
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Input with Currency Toggle */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 block">
              Valor
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-3xl font-bold py-3 px-4 pr-20 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
              />
              {/* Currency Toggle */}
              <button
                onClick={() => setCurrency(currency === "MZN" ? "USD" : "MZN")}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary-600 transition-colors"
              >
                {currency}
              </button>
            </div>
            {/* Exchange rate hint */}
            {displayAmount && (
              <p className="text-xs text-[var(--color-text-muted)] text-center mt-1.5">
                {displayAmount}
              </p>
            )}
          </div>

          {/* Account Selector — contas REAIS da utilizadora */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 block">
              {type === "transfer" ? "Da conta" : "Conta"}
            </label>
            {accountsLoading ? (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                A carregar as tuas contas...
              </div>
            ) : realAccounts.length === 0 ? (
              <Link
                href="/contas"
                onClick={handleClose}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200"
              >
                <Wallet className="w-4 h-4" />
                Ainda não tens contas — cria uma primeiro
              </Link>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {realAccounts.map((account) => {
                  const Icon = accountIcon(account.type);
                  return (
                    <button
                      key={account.id}
                      onClick={() => setSelectedAccount(account.name)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        selectedAccount === account.name
                          ? "bg-primary-500 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {account.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* To Account (Transfer only) */}
          {type === "transfer" && realAccounts.length > 0 && (
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 block">
                Para conta
              </label>
              <div className="flex gap-2 flex-wrap">
                {realAccounts
                  .filter((a) => a.name !== selectedAccount)
                  .map((account) => {
                    const Icon = accountIcon(account.type);
                    return (
                      <button
                        key={account.id}
                        onClick={() => setSelectedToAccount(account.name)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                          selectedToAccount === account.name
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {account.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Category Selector - Icons Grid */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 block">
              Categoria
            </label>
            <div className="grid grid-cols-4 gap-2">
              {currentCategories.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-primary-50 text-primary-700 ring-2 ring-primary-500"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-primary-500 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <cat.icon className="w-4.5 h-4.5" />
                    </div>
                    <span className="truncate w-full text-center text-2xs leading-tight">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 block">
              Descrição
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicionar descrição..."
              className="w-full py-2.5 px-4 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Date Picker */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 block">
              Data
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full py-2.5 pl-10 pr-4 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Recurring Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <span className="text-sm font-medium">Transacção recorrente</span>
              </div>
              <button
                onClick={() => setIsRecurring(!isRecurring)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isRecurring ? "bg-primary-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    isRecurring ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Recurring Frequency Options */}
            {isRecurring && (
              <div className="flex gap-2">
                {RECURRING_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setRecurringFrequency(option.key)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      recurringFrequency === option.key
                        ? "bg-primary-500 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Installments (Prestações) - only for expenses */}
          {type === "expense" && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Prestações
                </label>
              </div>
              <div className="flex gap-2">
                {INSTALLMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setInstallments(opt)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      installments === opt
                        ? "bg-primary-500 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {opt === 1 ? "À vista" : `${opt}x`}
                  </button>
                ))}
              </div>
              {installments > 1 && amount && (
                <p className="text-xs text-[var(--color-text-muted)] text-center mt-1.5">
                  {installments}x de{" "}
                  {(parseFloat(amount) / installments).toLocaleString("pt-MZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {currency}
                </p>
              )}
            </div>
          )}

          {/* Advanced Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            {showAdvanced ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Menos opções
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Mais opções
              </>
            )}
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-5 animate-in">
              {/* Notes */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <StickyNote className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Notas
                  </label>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicionar notas adicionais..."
                  rows={3}
                  className="w-full py-2.5 px-4 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              {/* Tags */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Tags (opcional)
                  </label>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {SUGGESTED_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        tags.includes(tag)
                          ? "bg-primary-100 text-primary-700 ring-1 ring-primary-300"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {saveError && (
            <p className="text-sm text-red-500 text-center">{saveError}</p>
          )}

          {/* Submit Button */}
          <button
            disabled={saving || !amount || parseFloat(amount) <= 0}
            onClick={async () => {
              setSaving(true);
              setSaveError(null);
              try {
                const txData = {
                  type,
                  amount: parseFloat(amount),
                  currency,
                  description: description || selectedCategory || "",
                  date: date,
                  is_recurring: isRecurring,
                  recurring_config: isRecurring ? { frequency: recurringFrequency } : null,
                  tags: tags.length > 0 ? tags : null,
                  status: "completed",
                  // Conta REAL seleccionada → resolvida para account_id existente
                  // (não cria contas genéricas falsas).
                  ...(selectedAccount ? { account: selectedAccount } : {}),
                  ...(type === "transfer" && selectedToAccount
                    ? { transfer_to_account: selectedToAccount }
                    : {}),
                  ...(selectedCategory && type !== "transfer"
                    ? { category_name: selectedCategory }
                    : {}),
                };

                const response = await fetch("/api/transactions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ transaction: txData }),
                });

                const data = await response.json();
                if (response.ok && data.success) {
                  onSaved?.();
                  handleClose();
                } else {
                  setSaveError(data.error || "Erro ao guardar");
                }
              } catch {
                setSaveError("Erro de rede. Tenta novamente.");
              } finally {
                setSaving(false);
              }
            }}
            className={`w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98] shadow-lg disabled:opacity-50 ${
              type === "income"
                ? "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 shadow-emerald-500/25"
                : type === "transfer"
                  ? "bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 shadow-indigo-500/25"
                  : "bg-red-500 hover:bg-red-600 active:bg-red-700 shadow-red-500/25"
            }`}
          >
            {saving
              ? "A guardar..."
              : type === "income"
                ? "Registar Receita"
                : type === "transfer"
                  ? "Registar Transferência"
                  : "Registar Despesa"}
          </button>
        </div>
      </div>
    </div>
  );
}
