"use client";

import { useState, useMemo } from "react";
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
import { useDashboard } from "@/hooks/use-supabase-data";
import type { Account, Transaction, Budget, DebtRecord, XitiqueGroup } from "@/lib/supabase/types";

// ─── Icon mapping for accounts ──────────────────────────────────────────────

const ACCOUNT_ICONS: Record<string, { icon: typeof Smartphone; color: string }> = {
  mpesa: { icon: Smartphone, color: "bg-red-500" },
  bank: { icon: Landmark, color: "bg-blue-500" },
  cash: { icon: Banknote, color: "bg-amber-500" },
  savings: { icon: Wallet, color: "bg-emerald-500" },
  investment: { icon: TrendingUp, color: "bg-purple-500" },
};

const CATEGORY_ICONS: Record<string, typeof Utensils> = {
  "Alimentação": Utensils,
  "Transporte": Car,
  "Contas": Zap,
  "Casa": Home,
  "Compras": ShoppingCart,
  "Rendimento": Wallet,
};

const DAILY_TIPS = [
  { tip: "Antes de gastar, pergunta-te: preciso ou quero? Essa simples questão pode poupar milhares por mês.", category: "Poupança" },
  { tip: "Configura uma transferência automática de 10% do salário para a poupança logo quando recebes.", category: "Automação" },
  { tip: "Revisa as tuas subscrições mensais. Cancela o que não usas há mais de 30 dias.", category: "Despesas" },
];

function getHealthScore(budgets: Budget[], transactions: Transaction[]): number {
  if (budgets.length === 0) return 75; // Default healthy when no budgets
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
  // Calculate spent per budget category from transactions
  const totalSpent = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const overBudgetCount = budgets.filter((b) => {
    const spent = transactions
      .filter((t) => t.type === "expense" && t.category_id === b.category_id)
      .reduce((s, t) => s + t.amount, 0);
    return spent > b.amount;
  }).length;

  let score = 100;
  if (totalBudgeted > 0) score -= (totalSpent / totalBudgeted) * 60;
  score -= overBudgetCount * 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getMonthLabel(): string {
  return new Date().toLocaleDateString("pt-MZ", { month: "long", year: "numeric" });
}

export default function DashboardPage() {
  const { data, loading } = useDashboard();
  const currentMonth = getMonthLabel();

  const accounts = data?.accounts ?? [];
  const transactions = data?.transactions ?? [];
  const budgets = data?.budgets ?? [];
  const debts = data?.debts ?? [];
  const xitique = data?.xitique ?? [];

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalIncome = useMemo(
    () => transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const totalExpenses = useMemo(
    () => transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const incomePercent = totalIncome + totalExpenses > 0
    ? (totalIncome / (totalIncome + totalExpenses)) * 100
    : 50;

  const healthScore = getHealthScore(budgets, transactions);
  const healthColor = healthScore >= 70 ? "text-emerald-600" : healthScore >= 40 ? "text-amber-600" : "text-red-500";
  const healthLabel = healthScore >= 70 ? "Saudável" : healthScore >= 40 ? "Atenção" : "Crítico";

  const dailyTip = DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length]!;

  const activeXitiqueGroups = xitique.length;
  const myTurnXitique = xitique.some((g) => g.my_turn === g.current_round);
  const totalDebtOwed = debts.filter((d) => d.type === "owe" && !d.is_paid).reduce((s, d) => s + d.amount, 0);
  const totalDebtReceivable = debts.filter((d) => d.type === "owed" && !d.is_paid).reduce((s, d) => s + d.amount, 0);

  // Budget progress: match categories to spending
  const budgetProgress = useMemo(() => {
    return budgets.map((b) => {
      const categoryName = b.categories?.name ?? "Outros";
      const spent = transactions
        .filter((t) => t.type === "expense" && t.category_id === b.category_id)
        .reduce((s, t) => s + t.amount, 0);
      const icon = CATEGORY_ICONS[categoryName] ?? Wallet;
      return { category: categoryName, budgeted: b.amount, spent, icon };
    });
  }, [budgets, transactions]);

  const recentTransactions = transactions.slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-primary-200 rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-400">A carregar...</p>
        </div>
      </div>
    );
  }

  const isEmpty = accounts.length === 0 && transactions.length === 0;

  return (
    <div className="min-h-screen pb-4">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src="/budgy-logo.webp" alt="BUDGY" className="w-10 h-10 rounded-xl shadow-lg" />
            <div>
              <p className="text-primary-100 text-sm">Ol&aacute;, bem-vindo</p>
              <h1 className="text-xl font-bold">BUDGY</h1>
            </div>
          </div>
          <button className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        <BalanceCard
          totalBalance={totalBalance}
          currency="MZN"
          trend={totalIncome > 0 ? +((totalIncome - totalExpenses) / totalIncome * 100) : 0}
          period={currentMonth}
        />
      </header>

      <main className="px-4 -mt-2 space-y-6">
        {/* Empty State */}
        {isEmpty && (
          <section className="card p-6 text-center">
            <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h2 className="font-semibold text-gray-700 mb-1">Começa por adicionar as tuas contas</h2>
            <p className="text-sm text-gray-400 mb-4">
              Vai a Contas para adicionar M-Pesa, Banco ou Dinheiro. Depois importa transações via SMS ou extrato.
            </p>
            <a href="/contas" className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">
              Adicionar conta <ChevronRight className="w-4 h-4" />
            </a>
          </section>
        )}

        {/* Quick Account Cards */}
        {accounts.length > 0 && (
          <section>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
              {accounts.map((account) => {
                const iconConfig = ACCOUNT_ICONS[account.type] ?? { icon: Wallet, color: "bg-gray-500" };
                const Icon = iconConfig.icon;
                return (
                  <div key={account.id} className="card flex-shrink-0 w-36 p-3 space-y-2">
                    <div className={`w-8 h-8 ${iconConfig.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">{account.name}</p>
                    <p className="text-sm font-bold">
                      {account.balance.toLocaleString("pt-MZ")}{" "}
                      <span className="text-xs font-normal text-[var(--color-text-muted)]">{account.currency}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Financial Health Score */}
        <section className="card p-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={healthScore >= 70 ? "#10B981" : healthScore >= 40 ? "#F59E0B" : "#EF4444"}
                  strokeWidth="8"
                  strokeDasharray={`${healthScore * 2.51} ${251 - healthScore * 2.51}`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-bold ${healthColor}`}>{healthScore}</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <h3 className="text-sm font-semibold">Saúde Financeira</h3>
              </div>
              <p className={`text-xs font-bold ${healthColor}`}>{healthLabel}</p>
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
              <p className="text-sm text-amber-700 leading-relaxed">{dailyTip.tip}</p>
            </div>
          </div>
        </section>

        {/* Income vs Expense Summary */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Resumo do Mês</h2>
            <span className="text-xs text-[var(--color-text-muted)]">{currentMonth}</span>
          </div>
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
                <p className="text-xs text-[var(--color-text-muted)]">Receitas</p>
                <p className="text-sm font-bold text-emerald-600">+{totalIncome.toLocaleString("pt-MZ")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Despesas</p>
                <p className="text-sm font-bold text-red-500">-{totalExpenses.toLocaleString("pt-MZ")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Xitique Summary */}
        {activeXitiqueGroups > 0 && (
          <section className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-500" />
                <h2 className="font-semibold text-sm">Xitique</h2>
              </div>
              <a href="/xitique" className="flex items-center gap-1 text-xs text-primary-600 font-medium">
                Ver tudo <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Grupos activos</span>
                  <span className="font-semibold">{activeXitiqueGroups}</span>
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
        )}

        {/* Debt Summary */}
        {(totalDebtOwed > 0 || totalDebtReceivable > 0) && (
          <section className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-400" />
                <h2 className="font-semibold text-sm">Dívidas</h2>
              </div>
              <a href="/dividas" className="flex items-center gap-1 text-xs text-primary-600 font-medium">
                Ver tudo <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-2xs text-red-600">Devo</p>
                <p className="text-sm font-bold text-red-600">{totalDebtOwed.toLocaleString("pt-MZ")}</p>
                <p className="text-2xs text-red-400">MZN</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-2xs text-emerald-600">Devem-me</p>
                <p className="text-sm font-bold text-emerald-600">{totalDebtReceivable.toLocaleString("pt-MZ")}</p>
                <p className="text-2xs text-emerald-400">MZN</p>
              </div>
            </div>
          </section>
        )}

        {/* Budget Progress */}
        {budgetProgress.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Orçamento</h2>
              <a href="/orcamento" className="text-xs text-primary-600 font-medium">Ver tudo</a>
            </div>
            <div className="space-y-3">
              {budgetProgress.map((budget) => (
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
        )}

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Transacções Recentes</h2>
              <a href="/transacoes" className="text-xs text-primary-600 font-medium">Ver todas</a>
            </div>
            <div className="card divide-y divide-[var(--color-border)]">
              {recentTransactions.map((tx) => {
                const icon = CATEGORY_ICONS[tx.categories?.name ?? ""] ?? Wallet;
                return (
                  <TransactionItem
                    key={tx.id}
                    description={tx.description ?? ""}
                    category={tx.categories?.name ?? "Outros"}
                    amount={tx.type === "expense" ? -tx.amount : tx.amount}
                    type={tx.type}
                    date={tx.date}
                    account={tx.accounts?.name ?? ""}
                    icon={icon}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Trend indicator */}
        {totalIncome > totalExpenses && totalIncome > 0 && (
          <section className="card p-4 bg-gradient-to-r from-primary-50 to-emerald-50 border-primary-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary-800">Estás a poupar bem!</p>
                <p className="text-xs text-primary-600">
                  Poupaste {Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)}% do teu rendimento este mês
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
