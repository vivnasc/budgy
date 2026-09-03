"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Wallet,
  ShoppingCart,
  Utensils,
  Car,
  Zap,
  Home,
  GraduationCap,
  Heart,
  Smartphone,
  X,
} from "lucide-react";
import { TransactionItem } from "@/components/transaction-item";
import { AddTransactionModal } from "@/components/add-transaction-modal";
import { TransactionDetailModal } from "@/components/transaction-detail-modal";
import { useTransactions, useLatestMonthOffset, useTransactionStats, useAccounts } from "@/hooks/use-supabase-data";
import type { Transaction } from "@/lib/supabase/types";

type FilterType = "all" | "income" | "expense" | "transfer";

const CATEGORY_ICONS: Record<string, typeof Wallet> = {
  "Rendimento": Wallet,
  "Salário": Wallet,
  "Freelance": Smartphone,
  "Alimentação": Utensils,
  "Compras": ShoppingCart,
  "Transporte": Car,
  "Contas": Zap,
  "Casa": Home,
  "Educação": GraduationCap,
  "Saúde": Heart,
};

function getMonthDates(monthOffset: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const from = d.toISOString().split("T")[0]!;
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0]!;
  const label = d.toLocaleDateString("pt-MZ", { month: "long", year: "numeric" });
  return { from, to, label };
}

function groupByDate(transactions: Transaction[]): Record<string, Transaction[]> {
  return transactions.reduce(
    (groups, tx) => {
      const key = tx.date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
      return groups;
    },
    {} as Record<string, Transaction[]>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";

  return date.toLocaleDateString("pt-MZ", { weekday: "short", day: "numeric", month: "short" });
}

export default function TransacoesPage() {
  const latestOffset = useLatestMonthOffset();
  const stats = useTransactionStats();
  const [monthOffset, setMonthOffset] = useState<number | null>(null);
  const [viewAll, setViewAll] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const { data: accounts } = useAccounts();

  // Saltar para o mês mais recente com dados na primeira carga
  useEffect(() => {
    if (monthOffset === null && latestOffset !== null) setMonthOffset(latestOffset);
  }, [latestOffset, monthOffset]);

  const effectiveOffset = monthOffset ?? 0;
  const { from, to, label: currentMonth } = useMemo(() => getMonthDates(effectiveOffset), [effectiveOffset]);
  const typeFilter = filter === "all" ? undefined : filter;
  const { data: transactions, loading, error, refetch } = useTransactions(
    viewAll
      ? { type: typeFilter, limit: 5000 }
      : { type: typeFilter, from, to, limit: 1000 }
  );

  // Categorias presentes na vista actual (para o dropdown)
  const categoryOptions = useMemo(() => {
    if (!transactions) return [];
    const names = new Set<string>();
    for (const tx of transactions) {
      const name = tx.categories?.name;
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt"));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      // Filtro por conta (account_id)
      if (selectedAccount && tx.account_id !== selectedAccount) return false;
      // Filtro por categoria (por nome)
      if (selectedCategory && (tx.categories?.name ?? "") !== selectedCategory) return false;
      // Procura por texto (descrição ou categoria)
      if (q) {
        const hit =
          (tx.description ?? "").toLowerCase().includes(q) ||
          (tx.categories?.name ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [transactions, searchQuery, selectedAccount, selectedCategory]);

  const hasActiveFilters =
    filter !== "all" || searchQuery.trim() !== "" || selectedAccount !== null || selectedCategory !== null;

  const clearFilters = () => {
    setFilter("all");
    setSearchQuery("");
    setSelectedAccount(null);
    setSelectedCategory(null);
  };

  const grouped = groupByDate(filteredTransactions);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="min-h-screen pb-4">
      {/* Header */}
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 pt-12 pb-4 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Transacções</h1>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <Search className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {showSearch && (
          <div className="mb-3 animate-in">
            <input
              type="text"
              placeholder="Pesquisar transacções..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        )}

        {/* Month Selector + Toggle "Ver tudo" */}
        <div className="flex items-center justify-center gap-3 mb-3">
          <button
            onClick={() => setMonthOffset((m) => (m ?? 0) - 1)}
            disabled={viewAll}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className={`text-sm font-semibold min-w-[140px] text-center capitalize ${viewAll ? "opacity-40" : ""}`}>
            {currentMonth}
          </span>
          <button
            onClick={() => setMonthOffset((m) => Math.min((m ?? 0) + 1, 0))}
            disabled={viewAll}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-center mb-3">
          <button
            onClick={() => setViewAll((v) => !v)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              viewAll ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {viewAll ? "✓ A ver tudo" : "Ver histórico todo"}
          </button>
        </div>

        {/* Filter tabs (tipo) */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-0.5">
          {[
            { key: "all" as FilterType, label: "Tudo" },
            { key: "income" as FilterType, label: "Receitas", icon: ArrowUpRight },
            { key: "expense" as FilterType, label: "Despesas", icon: ArrowDownRight },
            { key: "transfer" as FilterType, label: "Transf.", icon: ArrowLeftRight },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                filter === key
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>

        {/* Filtro por conta */}
        {accounts && accounts.length > 0 && (
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 mt-2 pb-0.5">
            <button
              onClick={() => setSelectedAccount(null)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                selectedAccount === null
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Wallet className="w-3 h-3" />
              Todas
            </button>
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccount(acc.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                  selectedAccount === acc.id
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {acc.name}
              </button>
            ))}
          </div>
        )}

        {/* Filtro por categoria + limpar */}
        <div className="flex items-center gap-2 mt-2">
          <select
            value={selectedCategory ?? ""}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="flex-1 min-w-0 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todas as categorias</option>
            {selectedCategory && !categoryOptions.includes(selectedCategory) && (
              <option value={selectedCategory}>{selectedCategory}</option>
            )}
            {categoryOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
              Limpar
            </button>
          )}
        </div>
      </header>

      <main className="px-4 pt-4 space-y-4">
        {/* Diagnóstico: total na BD + erro de query */}
        {(stats.count !== null || stats.error || error) && (
          <div className={`rounded-xl p-3 text-xs ${stats.error || error ? "bg-red-500/10 border border-red-500/20 text-red-300" : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"}`}>
            {stats.error || error ? (
              <>
                <p className="font-semibold mb-1">Erro a ler da BD</p>
                <p className="opacity-80 break-words">{stats.error || error}</p>
              </>
            ) : (
              <p>
                <span className="font-bold">{stats.count}</span> transações no histórico
                {stats.latestDate && (
                  <span className="opacity-70"> · última: {new Date(stats.latestDate + "T00:00:00").toLocaleDateString("pt-MZ")}</span>
                )}
                {transactions && (
                  <span className="opacity-70"> · {transactions.length} a mostrar</span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Summary strip */}
        <div className="flex gap-3">
          <div className="flex-1 card p-3 text-center">
            <p className="text-xs text-[var(--color-text-muted)]">Receitas</p>
            <p className="text-sm font-bold text-emerald-600">
              +{totalIncome.toLocaleString("pt-MZ")}
            </p>
          </div>
          <div className="flex-1 card p-3 text-center">
            <p className="text-xs text-[var(--color-text-muted)]">Despesas</p>
            <p className="text-sm font-bold text-red-500">
              -{totalExpense.toLocaleString("pt-MZ")}
            </p>
          </div>
          <div className="flex-1 card p-3 text-center">
            <p className="text-xs text-[var(--color-text-muted)]">Balanço</p>
            <p className={`text-sm font-bold ${totalIncome - totalExpense >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {(totalIncome - totalExpense).toLocaleString("pt-MZ")}
            </p>
          </div>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="animate-pulse">
              <div className="h-16 bg-gray-100 rounded-xl mb-3" />
              <div className="h-16 bg-gray-100 rounded-xl mb-3" />
              <div className="h-16 bg-gray-100 rounded-xl" />
            </div>
          </div>
        )}

        {/* Grouped Transactions */}
        {sortedDates.map((date) => {
          const dayTransactions = grouped[date]!;
          const dayTotal = dayTransactions.reduce(
            (sum, tx) => sum + (tx.type === "expense" ? -tx.amount : tx.amount),
            0
          );

          return (
            <div key={date} className="animate-in">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase">
                  {formatDate(date)}
                </span>
                <span className={`text-xs font-medium ${dayTotal >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {dayTotal >= 0 ? "+" : ""}
                  {dayTotal.toLocaleString("pt-MZ")} MZN
                </span>
              </div>
              <div className="card divide-y divide-[var(--color-border)]">
                {dayTransactions.map((tx) => {
                  const icon = CATEGORY_ICONS[tx.categories?.name ?? ""] ?? Wallet;
                  return (
                    <TransactionItem
                      key={tx.id}
                      description={tx.description ?? ""}
                      category={tx.categories?.name ?? "Outros"}
                      amount={tx.type === "expense" ? -tx.amount : tx.amount}
                      type={tx.type}
                      status={tx.status}
                      date={tx.date}
                      account={tx.accounts?.name ?? ""}
                      icon={icon}
                      onClick={() => setSelectedTx(tx)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {!loading && filteredTransactions.length === 0 && (
          <div className="text-center py-12">
            <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-muted)]">
              Nenhuma transacção encontrada
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Importa SMS ou extratos bancários para começar
            </p>
          </div>
        )}
      </main>

      {/* FAB */}
      <button onClick={() => setShowAddModal(true)} className="fab">
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <AddTransactionModal onClose={() => setShowAddModal(false)} />
      )}

      {/* Transaction Detail / Edit Modal */}
      {selectedTx && (
        <TransactionDetailModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          onChanged={() => refetch()}
        />
      )}
    </div>
  );
}
