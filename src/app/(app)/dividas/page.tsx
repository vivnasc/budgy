"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  SortAsc,
  SortDesc,
  UserCircle,
  CalendarDays,
  Banknote,
} from "lucide-react";
import { useDebts } from "@/hooks/use-supabase-data";
import type { DebtRecord } from "@/lib/supabase/types";

type DebtTab = "devo" | "devem";
type SortBy = "amount" | "date";

function getDaysRemaining(dueDate: string | null): { text: string; isOverdue: boolean } {
  if (!dueDate) return { text: "Sem prazo", isOverdue: false };
  const now = new Date();
  const due = new Date(dueDate + "T00:00:00");
  const diff = due.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return { text: `${Math.abs(days)} dias atrasado`, isOverdue: true };
  if (days === 0) return { text: "Vence hoje", isOverdue: false };
  if (days === 1) return { text: "Vence amanhã", isOverdue: false };
  if (days <= 30) return { text: `${days} dias restantes`, isOverdue: false };
  const months = Math.floor(days / 30);
  return { text: `${months} ${months === 1 ? "mês" : "meses"} restante${months > 1 ? "s" : ""}`, isOverdue: false };
}

function DebtCard({ debt, type }: { debt: DebtRecord; type: DebtTab }) {
  const daysInfo = getDaysRemaining(debt.due_date);
  const statusIcon = debt.is_paid ? CheckCircle2 : daysInfo.isOverdue ? AlertTriangle : Clock;
  const statusLabel = debt.is_paid ? "Pago" : daysInfo.isOverdue ? "Atrasado" : "Pendente";
  const statusBg = debt.is_paid ? "bg-emerald-50 text-emerald-700" : daysInfo.isOverdue ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700";
  const StatusIcon = statusIcon;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${type === "devo" ? "bg-red-50" : "bg-emerald-50"}`}>
          <UserCircle className={`w-6 h-6 ${type === "devo" ? "text-red-400" : "text-emerald-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold truncate">{debt.person_name}</h3>
            <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${statusBg}`}>{statusLabel}</span>
          </div>
          {debt.description && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">{debt.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className={`text-lg font-bold ${type === "devo" ? "text-red-500" : "text-emerald-600"}`}>
          {debt.amount.toLocaleString("pt-MZ")} MZN
        </p>
        <div className="flex items-center gap-1">
          <CalendarDays className="w-3 h-3 text-[var(--color-text-muted)]" />
          <span className={`text-2xs font-medium ${daysInfo.isOverdue ? "text-red-500" : "text-[var(--color-text-muted)]"}`}>
            {daysInfo.text}
          </span>
        </div>
      </div>

      {!debt.is_paid && (
        <div className="flex gap-2 pt-1">
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary-50 text-primary-700 rounded-xl text-xs font-medium hover:bg-primary-100 transition-colors">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Marcar como pago
          </button>
          {type === "devem" && (
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-medium hover:bg-amber-100 transition-colors">
              <Send className="w-3.5 h-3.5" />
              Enviar lembrete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DividasPage() {
  const [activeTab, setActiveTab] = useState<DebtTab>("devo");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const { data: debts, loading } = useDebts();
  const allDebts = debts ?? [];

  const oweDebts = useMemo(() => allDebts.filter((d) => d.type === "owe"), [allDebts]);
  const owedDebts = useMemo(() => allDebts.filter((d) => d.type === "owed"), [allDebts]);
  const currentDebts = activeTab === "devo" ? oweDebts : owedDebts;

  const sortedDebts = useMemo(() => {
    return [...currentDebts].sort((a, b) => {
      if (sortBy === "amount") {
        const diff = a.amount - b.amount;
        return sortAsc ? diff : -diff;
      }
      const dateA = a.due_date ?? "9999-12-31";
      const dateB = b.due_date ?? "9999-12-31";
      return sortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    });
  }, [currentDebts, sortBy, sortAsc]);

  const totalOwe = oweDebts.filter((d) => !d.is_paid).reduce((sum, d) => sum + d.amount, 0);
  const totalOwed = owedDebts.filter((d) => !d.is_paid).reduce((sum, d) => sum + d.amount, 0);
  const netBalance = totalOwed - totalOwe;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-primary-200 rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-400">A carregar dívidas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-xl font-bold mb-4">Dívidas</h1>
        <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-primary-200 text-2xs">Devo</p>
              <p className="text-sm font-bold text-red-200">{totalOwe.toLocaleString("pt-MZ")}</p>
            </div>
            <div className="text-center">
              <p className="text-primary-200 text-2xs">Devem-me</p>
              <p className="text-sm font-bold text-emerald-200">{totalOwed.toLocaleString("pt-MZ")}</p>
            </div>
            <div className="text-center">
              <p className="text-primary-200 text-2xs">Balanço</p>
              <p className={`text-sm font-bold ${netBalance >= 0 ? "text-emerald-200" : "text-red-200"}`}>
                {netBalance >= 0 ? "+" : ""}{netBalance.toLocaleString("pt-MZ")}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/20">
            <p className="text-center text-xs text-primary-200">Valores em MZN</p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("devo")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "devo" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            Devo ({oweDebts.filter((d) => !d.is_paid).length})
          </button>
          <button
            onClick={() => setActiveTab("devem")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "devem" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            Devem-me ({owedDebts.filter((d) => !d.is_paid).length})
          </button>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">
            {sortedDebts.length} {sortedDebts.length === 1 ? "dívida" : "dívidas"}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy("amount")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-medium transition-colors ${
                sortBy === "amount" ? "bg-primary-50 text-primary-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              <Banknote className="w-3 h-3" />
              Valor
            </button>
            <button
              onClick={() => setSortBy("date")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-medium transition-colors ${
                sortBy === "date" ? "bg-primary-50 text-primary-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              <CalendarDays className="w-3 h-3" />
              Data
            </button>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="p-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              {sortAsc ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Overdue Alert */}
        {activeTab === "devo" && oweDebts.some((d) => !d.is_paid && d.due_date && new Date(d.due_date) < new Date()) && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-800">Tens dívidas atrasadas!</p>
            </div>
          </div>
        )}

        {/* Debt List */}
        <div className="space-y-3">
          {sortedDebts.map((debt) => (
            <DebtCard key={debt.id} debt={debt} type={activeTab} />
          ))}
        </div>

        {sortedDebts.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-muted)]">
              {allDebts.length === 0 ? "Sem dívidas registadas" : "Nenhuma dívida encontrada"}
            </p>
          </div>
        )}
      </main>

      <button className="fab">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
