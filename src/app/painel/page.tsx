"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Wallet,
  Smartphone,
  Landmark,
  Banknote,
  Home,
  ShoppingCart,
  Utensils,
  Car,
  Zap,
  MoreHorizontal,
  Lightbulb,
  Users,
  Heart,
  Activity,
  Star,
  ChevronRight,
} from "lucide-react";
import { BalanceCard } from "@/components/balance-card";
import { TransactionItem } from "@/components/transaction-item";
import { BudgetProgress } from "@/components/budget-progress";
import { BottomNav } from "@/components/bottom-nav";

const MOCK_ACCOUNTS = [
  {
    id: "1",
    name: "M-Pesa",
    icon: Smartphone,
    balance: 12450.0,
    currency: "MZN",
    color: "bg-red-500",
  },
  {
    id: "2",
    name: "Banco",
    icon: Landmark,
    balance: 45800.0,
    currency: "MZN",
    color: "bg-blue-500",
  },
  {
    id: "3",
    name: "Dinheiro",
    icon: Banknote,
    balance: 3200.0,
    currency: "MZN",
    color: "bg-amber-500",
  },
];

const MOCK_TRANSACTIONS = [
  {
    id: "1",
    description: "Salário",
    category: "Rendimento",
    amount: 65000,
    type: "income" as const,
    date: "2026-02-25",
    account: "Banco",
    icon: Wallet,
  },
  {
    id: "2",
    description: "Shoprite",
    category: "Alimentação",
    amount: -4500,
    type: "expense" as const,
    date: "2026-02-24",
    account: "M-Pesa",
    icon: ShoppingCart,
  },
  {
    id: "3",
    description: "Restaurante Polana",
    category: "Alimentação",
    amount: -1800,
    type: "expense" as const,
    date: "2026-02-23",
    account: "M-Pesa",
    icon: Utensils,
  },
  {
    id: "4",
    description: "Combustível",
    category: "Transporte",
    amount: -3200,
    type: "expense" as const,
    date: "2026-02-22",
    account: "Banco",
    icon: Car,
  },
  {
    id: "5",
    description: "Electricidade EDM",
    category: "Contas",
    amount: -2100,
    type: "expense" as const,
    date: "2026-02-21",
    account: "M-Pesa",
    icon: Zap,
  },
];

const MOCK_BUDGETS = [
  {
    category: "Alimentação",
    budgeted: 15000,
    spent: 11200,
    icon: Utensils,
  },
  {
    category: "Transporte",
    budgeted: 8000,
    spent: 6400,
    icon: Car,
  },
  {
    category: "Contas",
    budgeted: 10000,
    spent: 7800,
    icon: Zap,
  },
  {
    category: "Casa",
    budgeted: 20000,
    spent: 20000,
    icon: Home,
  },
];

const DAILY_TIPS = [
  {
    tip: "Antes de gastar, pergunta-te: preciso ou quero? Essa simples questão pode poupar milhares por mês.",
    category: "Poupança",
  },
  {
    tip: "Configura uma transferência automática de 10% do salário para a poupança logo quando recebes.",
    category: "Automação",
  },
  {
    tip: "Revisa as tuas subscrições mensais. Cancela o que não usas há mais de 30 dias.",
    category: "Despesas",
  },
];

function getHealthScore(budgets: typeof MOCK_BUDGETS): number {
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.budgeted, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const overBudgetCount = budgets.filter((b) => b.spent > b.budgeted).length;
  const ratio = totalSpent / totalBudgeted;

  let score = 100;
  score -= ratio * 60;
  score -= overBudgetCount * 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default function DashboardPage() {
  const [currentMonth] = useState("Fevereiro 2026");

  const totalBalance = MOCK_ACCOUNTS.reduce((sum, acc) => sum + acc.balance, 0);
  const totalIncome = 65000;
  const totalExpenses = 11600;
  const incomePercent = (totalIncome / (totalIncome + totalExpenses)) * 100;

  const healthScore = getHealthScore(MOCK_BUDGETS);
  const healthColor =
    healthScore >= 70
      ? "text-emerald-600"
      : healthScore >= 40
        ? "text-amber-600"
        : "text-red-500";
  const healthBg =
    healthScore >= 70
      ? "bg-emerald-500"
      : healthScore >= 40
        ? "bg-amber-500"
        : "bg-red-500";
  const healthLabel =
    healthScore >= 70
      ? "Saudável"
      : healthScore >= 40
        ? "Atenção"
        : "Crítico";

  const dailyTip = DAILY_TIPS[0]!;

  // Mock xitique & debt data for dashboard summary
  const activeXitiqueGroups = 3;
  const nextXitiquePayment = "1 Março";
  const myTurnXitique = true;
  const totalDebtOwed = 63000;
  const totalDebtReceivable = 27500;

  return (
    <div className="min-h-screen pb-4">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-primary-100 text-sm">Olá, bem-vindo</p>
            <h1 className="text-xl font-bold">BUDGY</h1>
          </div>
          <button className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        <BalanceCard
          totalBalance={totalBalance}
          currency="MZN"
          trend={+5.2}
          period={currentMonth}
        />
      </header>

      <main className="px-4 -mt-2 space-y-6">
        {/* Quick Account Cards */}
        <section>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
            {MOCK_ACCOUNTS.map((account) => (
              <div
                key={account.id}
                className="card flex-shrink-0 w-36 p-3 space-y-2"
              >
                <div
                  className={`w-8 h-8 ${account.color} rounded-lg flex items-center justify-center`}
                >
                  <account.icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {account.name}
                </p>
                <p className="text-sm font-bold">
                  {account.balance.toLocaleString("pt-MZ")}{" "}
                  <span className="text-xs font-normal text-[var(--color-text-muted)]">
                    {account.currency}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Financial Health Score */}
        <section className="card p-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={healthScore >= 70 ? "#10B981" : healthScore >= 40 ? "#F59E0B" : "#EF4444"}
                  strokeWidth="8"
                  strokeDasharray={`${healthScore * 2.51} ${251 - healthScore * 2.51}`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-bold ${healthColor}`}>
                  {healthScore}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <h3 className="text-sm font-semibold">Saúde Financeira</h3>
              </div>
              <p className={`text-xs font-bold ${healthColor}`}>
                {healthLabel}
              </p>
              <p className="text-2xs text-[var(--color-text-muted)] mt-0.5">
                Baseado no teu orçamento e padrão de gastos
              </p>
            </div>
          </div>
        </section>

        {/* Dica do Dia */}
        <section className="card p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-100">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Lightbulb className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-bold text-amber-800">Dica do Dia</p>
                <span className="text-2xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-md font-medium">
                  {dailyTip.category}
                </span>
              </div>
              <p className="text-sm text-amber-700 leading-relaxed">
                {dailyTip.tip}
              </p>
            </div>
          </div>
        </section>

        {/* Income vs Expense Summary */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Resumo do Mês</h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              {currentMonth}
            </span>
          </div>

          {/* Visual bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${incomePercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Receitas
                </p>
                <p className="text-sm font-bold text-emerald-600">
                  +{totalIncome.toLocaleString("pt-MZ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Despesas
                </p>
                <p className="text-sm font-bold text-red-500">
                  -{totalExpenses.toLocaleString("pt-MZ")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Xitique Summary */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-500" />
              <h2 className="font-semibold text-sm">Xitique</h2>
            </div>
            <a
              href="/xitique"
              className="flex items-center gap-1 text-xs text-primary-600 font-medium"
            >
              Ver tudo
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Grupos activos</span>
                <span className="font-semibold">{activeXitiqueGroups}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Próximo pagamento</span>
                <span className="font-semibold">{nextXitiquePayment}</span>
              </div>
            </div>
            {myTurnXitique && (
              <div className="flex-shrink-0 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
                <Star className="w-4 h-4 text-amber-500 mx-auto mb-0.5" />
                <p className="text-2xs font-bold text-amber-700">Minha vez!</p>
              </div>
            )}
          </div>
        </section>

        {/* Debt Summary */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-400" />
              <h2 className="font-semibold text-sm">Dívidas</h2>
            </div>
            <a
              href="/dividas"
              className="flex items-center gap-1 text-xs text-primary-600 font-medium"
            >
              Ver tudo
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-2xs text-red-600">Devo</p>
              <p className="text-sm font-bold text-red-600">
                {totalDebtOwed.toLocaleString("pt-MZ")}
              </p>
              <p className="text-2xs text-red-400">MZN</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-2xs text-emerald-600">Devem-me</p>
              <p className="text-sm font-bold text-emerald-600">
                {totalDebtReceivable.toLocaleString("pt-MZ")}
              </p>
              <p className="text-2xs text-emerald-400">MZN</p>
            </div>
          </div>
        </section>

        {/* Budget Progress */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Orçamento</h2>
            <a
              href="/orcamento"
              className="text-xs text-primary-600 font-medium"
            >
              Ver tudo
            </a>
          </div>
          <div className="space-y-3">
            {MOCK_BUDGETS.map((budget) => (
              <BudgetProgress
                key={budget.category}
                category={budget.category}
                budgeted={budget.budgeted}
                spent={budget.spent}
                icon={budget.icon}
              />
            ))}
          </div>
        </section>

        {/* Recent Transactions */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Transacções Recentes</h2>
            <a
              href="/transacoes"
              className="text-xs text-primary-600 font-medium"
            >
              Ver todas
            </a>
          </div>
          <div className="card divide-y divide-[var(--color-border)]">
            {MOCK_TRANSACTIONS.map((tx) => (
              <TransactionItem
                key={tx.id}
                description={tx.description}
                category={tx.category}
                amount={tx.amount}
                type={tx.type}
                date={tx.date}
                account={tx.account}
                icon={tx.icon}
              />
            ))}
          </div>
        </section>

        {/* Trend indicator */}
        <section className="card p-4 bg-gradient-to-r from-primary-50 to-emerald-50 border-primary-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary-800">
                Estás a poupar bem!
              </p>
              <p className="text-xs text-primary-600">
                Poupaste 82% mais que o mês passado
              </p>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
