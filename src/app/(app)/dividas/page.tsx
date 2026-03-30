"use client";

import { useState } from "react";
import {
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  MoreVertical,
  SortAsc,
  SortDesc,
  UserCircle,
  CalendarDays,
  Banknote,
  XCircle,
} from "lucide-react";

type DebtTab = "devo" | "devem";
type DebtStatus = "pending" | "partial" | "paid" | "overdue";
type SortBy = "amount" | "date";

interface Debt {
  id: string;
  person: string;
  amount: number;
  paidAmount: number;
  description: string;
  dueDate: string;
  status: DebtStatus;
  createdAt: string;
}

const MOCK_DEBTS_OWE: Debt[] = [
  {
    id: "d1",
    person: "Carlos Machava",
    amount: 15000,
    paidAmount: 5000,
    description: "Empréstimo para reparação do carro",
    dueDate: "2026-03-15",
    status: "partial",
    createdAt: "2026-01-10",
  },
  {
    id: "d2",
    person: "Loja Samsung",
    amount: 45000,
    paidAmount: 0,
    description: "Prestações do telemóvel - 3x de 15.000",
    dueDate: "2026-04-01",
    status: "pending",
    createdAt: "2026-02-01",
  },
  {
    id: "d3",
    person: "Mãe",
    amount: 8000,
    paidAmount: 0,
    description: "Ajuda com as compras do mês",
    dueDate: "2026-02-28",
    status: "overdue",
    createdAt: "2026-01-20",
  },
];

const MOCK_DEBTS_OWED: Debt[] = [
  {
    id: "o1",
    person: "João Silva",
    amount: 5000,
    paidAmount: 0,
    description: "Almoço que paguei",
    dueDate: "2026-03-01",
    status: "pending",
    createdAt: "2026-02-15",
  },
  {
    id: "o2",
    person: "Ana Tembe",
    amount: 20000,
    paidAmount: 10000,
    description: "Empréstimo pessoal",
    dueDate: "2026-05-01",
    status: "partial",
    createdAt: "2026-01-05",
  },
  {
    id: "o3",
    person: "Pedro Nhaca",
    amount: 3500,
    paidAmount: 3500,
    description: "Combustível partilhado",
    dueDate: "2026-02-20",
    status: "paid",
    createdAt: "2026-02-10",
  },
  {
    id: "o4",
    person: "Miguel Cossa",
    amount: 12000,
    paidAmount: 0,
    description: "Material de construção",
    dueDate: "2026-06-30",
    status: "pending",
    createdAt: "2025-12-15",
  },
];

function getStatusConfig(status: DebtStatus) {
  switch (status) {
    case "paid":
      return {
        label: "Pago",
        color: "text-emerald-700",
        bg: "bg-emerald-50",
        icon: CheckCircle2,
        iconColor: "text-emerald-500",
      };
    case "partial":
      return {
        label: "Parcial",
        color: "text-blue-700",
        bg: "bg-blue-50",
        icon: Clock,
        iconColor: "text-blue-500",
      };
    case "overdue":
      return {
        label: "Atrasado",
        color: "text-red-700",
        bg: "bg-red-50",
        icon: AlertTriangle,
        iconColor: "text-red-500",
      };
    default:
      return {
        label: "Pendente",
        color: "text-amber-700",
        bg: "bg-amber-50",
        icon: Clock,
        iconColor: "text-amber-500",
      };
  }
}

function getDaysRemaining(dueDate: string): { text: string; isOverdue: boolean } {
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

function DebtCard({ debt, type }: { debt: Debt; type: DebtTab }) {
  const statusConfig = getStatusConfig(debt.status);
  const StatusIcon = statusConfig.icon;
  const daysInfo = getDaysRemaining(debt.dueDate);
  const progress = debt.amount > 0 ? (debt.paidAmount / debt.amount) * 100 : 0;
  const remaining = debt.amount - debt.paidAmount;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start gap-3">
        {/* Person Avatar */}
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
            type === "devo" ? "bg-red-50" : "bg-emerald-50"
          }`}
        >
          <UserCircle
            className={`w-6 h-6 ${
              type === "devo" ? "text-red-400" : "text-emerald-400"
            }`}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold truncate">{debt.person}</h3>
            <span
              className={`text-2xs font-bold px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}
            >
              {statusConfig.label}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">
            {debt.description}
          </p>
        </div>
      </div>

      {/* Amount */}
      <div className="flex items-center justify-between">
        <div>
          <p
            className={`text-lg font-bold ${
              type === "devo" ? "text-red-500" : "text-emerald-600"
            }`}
          >
            {remaining.toLocaleString("pt-MZ")} MZN
          </p>
          {debt.paidAmount > 0 && (
            <p className="text-2xs text-[var(--color-text-muted)]">
              Pago: {debt.paidAmount.toLocaleString("pt-MZ")} de {debt.amount.toLocaleString("pt-MZ")} MZN
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3 text-[var(--color-text-muted)]" />
            <span
              className={`text-2xs font-medium ${
                daysInfo.isOverdue ? "text-red-500" : "text-[var(--color-text-muted)]"
              }`}
            >
              {daysInfo.text}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar for partial payments */}
      {debt.paidAmount > 0 && debt.status !== "paid" && (
        <div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-end mt-0.5">
            <span className="text-2xs text-[var(--color-text-muted)]">
              {Math.round(progress)}% pago
            </span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {debt.status !== "paid" && (
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

  const debts = activeTab === "devo" ? MOCK_DEBTS_OWE : MOCK_DEBTS_OWED;

  const sortedDebts = [...debts].sort((a, b) => {
    if (sortBy === "amount") {
      const diff = (a.amount - a.paidAmount) - (b.amount - b.paidAmount);
      return sortAsc ? diff : -diff;
    }
    return sortAsc
      ? a.dueDate.localeCompare(b.dueDate)
      : b.dueDate.localeCompare(a.dueDate);
  });

  const totalOwe = MOCK_DEBTS_OWE.filter((d) => d.status !== "paid").reduce(
    (sum, d) => sum + (d.amount - d.paidAmount),
    0
  );
  const totalOwed = MOCK_DEBTS_OWED.filter((d) => d.status !== "paid").reduce(
    (sum, d) => sum + (d.amount - d.paidAmount),
    0
  );
  const netBalance = totalOwed - totalOwe;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-xl font-bold mb-4">Dívidas</h1>

        {/* Summary */}
        <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-primary-200 text-2xs">Devo</p>
              <p className="text-sm font-bold text-red-200">
                {totalOwe.toLocaleString("pt-MZ")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-primary-200 text-2xs">Devem-me</p>
              <p className="text-sm font-bold text-emerald-200">
                {totalOwed.toLocaleString("pt-MZ")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-primary-200 text-2xs">Balanço</p>
              <p
                className={`text-sm font-bold ${
                  netBalance >= 0 ? "text-emerald-200" : "text-red-200"
                }`}
              >
                {netBalance >= 0 ? "+" : ""}
                {netBalance.toLocaleString("pt-MZ")}
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/20">
            <p className="text-center text-xs text-primary-200">
              Valores em MZN
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("devo")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "devo"
                ? "bg-red-500 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            Devo ({MOCK_DEBTS_OWE.filter((d) => d.status !== "paid").length})
          </button>
          <button
            onClick={() => setActiveTab("devem")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "devem"
                ? "bg-emerald-500 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            Devem-me ({MOCK_DEBTS_OWED.filter((d) => d.status !== "paid").length})
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
                sortBy === "amount"
                  ? "bg-primary-50 text-primary-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <Banknote className="w-3 h-3" />
              Valor
            </button>
            <button
              onClick={() => setSortBy("date")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-medium transition-colors ${
                sortBy === "date"
                  ? "bg-primary-50 text-primary-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <CalendarDays className="w-3 h-3" />
              Data
            </button>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="p-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              {sortAsc ? (
                <SortAsc className="w-3.5 h-3.5" />
              ) : (
                <SortDesc className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Overdue Alert */}
        {activeTab === "devo" &&
          MOCK_DEBTS_OWE.some((d) => d.status === "overdue") && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-800">
                  Tens dívidas atrasadas!
                </p>
                <p className="text-2xs text-red-600 mt-0.5">
                  {MOCK_DEBTS_OWE.filter((d) => d.status === "overdue")
                    .map((d) => d.person)
                    .join(", ")}
                </p>
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
              Nenhuma dívida encontrada
            </p>
          </div>
        )}
      </main>

      {/* FAB */}
      <button className="fab">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
