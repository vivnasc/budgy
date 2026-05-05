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

function getMonthLabel(referenceDate?: string | null): string {
  // Show the month of the latest data so the "current month" totals make sense
  // for users who have just imported historical data.
  const ref = referenceDate ? new Date(referenceDate + "T00:00:00") : new Date();
  return ref.toLocaleDateString("pt-MZ", { month: "long", year: "numeric" });
}

export default function DashboardPage() {
  const { data, loading } = useDashboard();
  const latestDate = data?.transactions[0]?.date ?? null;
  const currentMonth = getMonthLabel(latestDate);

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
  const healthColor = healthScore >= 70 ? "text-emerald-400" : healthScore >= 40 ? "text-amber-400" : "text-red-400";
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
          <div className="w-12 h-12 bg-emerald-500/20 rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-400">A carregar...</p>
        </div>
      </div>
    );
  }

  const isEmpty = accounts.length === 0 && transactions.length === 0;

  // Detecta dados estragados de imports antigos: transações sem conta ligada,
  // ou contas todas com saldo zero apesar de existirem transações. Quando
  // detectado, mostramos um banner pedindo para limpar e reimportar.
  const orphanedTransactions = transactions.filter((t) => !t.account_id).length;
  const allAccountsZero = accounts.length > 0 && accounts.every((a) => Number(a.balance) === 0);
  const dataLooksBroken = transactions.length > 0 && (orphanedTransactions > 0 || allAccountsZero);

  return (
    <div className="min-h-screen pb-4">
      {/* Header — Premium gradient with texture */}
      <header className="relative bg-gradient-to-br from-emerald-600/90 to-teal-700/90 backdrop-blur-xl text-white px-4 pt-12 pb-6 rounded-b-3xl lg:rounded-2xl overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {/* Hide logo on desktop — sidebar already shows it */}
              <img src="/budgy-logo-64.webp" alt="BUDGY" className="w-10 h-10 rounded-xl shadow-lg ring-1 ring-white/20 lg:hidden" />
              <div>
                <p className="text-emerald-100/70 text-sm">Ol&aacute;, bem-vindo</p>
                <h1 className="text-xl font-bold tracking-tight lg:hidden">BUDGY</h1>
                <h1 className="hidden lg:block text-xl font-bold tracking-tight">Painel</h1>
              </div>
            </div>
            <button className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          <BalanceCard
            totalBalance={totalBalance}
            currency="MZN"
            trend={totalIncome > 0 ? +((totalIncome - totalExpenses) / totalIncome * 100) : 0}
            period={currentMonth}
          />
        </div>
      </header>

      <main className="-mt-2 space-y-6">
        {/* Banner para reimportar quando os dados ficaram inconsistentes */}
        {dataLooksBroken && (
          <section className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-200">Os teus dados parecem desactualizados</h3>
                <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                  As transações importadas não estão ligadas às contas certas. Limpa e reimporta o teu ficheiro do Mobills para obter os saldos correctos.
                </p>
                <a
                  href="/importar"
                  className="inline-flex items-center gap-2 mt-3 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                >
                  Ir para Importar <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Empty State */}
        {isEmpty && (
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
            <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h2 className="font-semibold text-white mb-1">Começa por adicionar as tuas contas</h2>
            <p className="text-sm text-gray-400 mb-4">
              Vai a Contas para adicionar M-Pesa, Banco ou Dinheiro. Depois importa transações via SMS ou extrato.
            </p>
            <a href="/contas" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
              Adicionar conta <ChevronRight className="w-4 h-4" />
            </a>
          </section>
        )}

        {/* Quick Account Cards — Glass effect */}
        {accounts.length > 0 && (
          <section>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {accounts.map((account) => {
                const iconConfig = ACCOUNT_ICONS[account.type] ?? { icon: Wallet, color: "bg-gray-500" };
                const Icon = iconConfig.icon;
                return (
                  <div key={account.id} className="flex-shrink-0 w-36 p-3 space-y-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
                    <div className={`w-8 h-8 ${iconConfig.color}/80 rounded-lg flex items-center justify-center`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-xs text-gray-400">{account.name}</p>
                    <p className="text-sm font-bold text-white">
                      {account.balance.toLocaleString("pt-MZ")}{" "}
                      <span className="text-xs font-normal text-gray-500">{account.currency}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Health Score + Tip of Day — side by side on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Financial Health Score — Prominent with glow */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 flex-shrink-0">
                {/* Glow behind the score circle */}
                <div
                  className="absolute inset-1 rounded-full blur-lg opacity-30"
                  style={{ backgroundColor: healthScore >= 70 ? "#10B981" : healthScore >= 40 ? "#F59E0B" : "#EF4444" }}
                />
                <svg className="w-20 h-20 -rotate-90 relative z-10" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={healthScore >= 70 ? "#10B981" : healthScore >= 40 ? "#F59E0B" : "#EF4444"}
                    strokeWidth="8"
                    strokeDasharray={`${healthScore * 2.51} ${251 - healthScore * 2.51}`}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <span className={`text-lg font-bold ${healthColor}`}>{healthScore}</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-white">Saúde Financeira</h3>
                </div>
                <p className={`text-xs font-bold ${healthColor}`}>{healthLabel}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Baseado no teu orçamento e padrão de gastos
                </p>
              </div>
            </div>
          </section>

          {/* Dica do Dia — Dark amber/gold tones */}
          <section className="bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lightbulb className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-bold text-amber-300">Dica do Dia</p>
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-md font-medium">
                    {dailyTip.category}
                  </span>
                </div>
                <p className="text-sm text-amber-200/80 leading-relaxed">{dailyTip.tip}</p>
              </div>
            </div>
          </section>
        </div>

        {/* Summary Cards — Balance, Income, Expense */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Balance */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-xs text-gray-500">Saldo Total</p>
            </div>
            <p className="text-xl font-bold text-white">{totalBalance.toLocaleString("pt-MZ")} <span className="text-xs font-normal text-gray-500">MZN</span></p>
            <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${incomePercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{currentMonth}</p>
          </section>

          {/* Income */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-xs text-gray-500">Receitas</p>
            </div>
            <p className="text-xl font-bold text-emerald-400">+{totalIncome.toLocaleString("pt-MZ")} <span className="text-xs font-normal text-gray-500">MZN</span></p>
          </section>

          {/* Expense */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-rose-500/15 rounded-xl flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5 text-rose-400" />
              </div>
              <p className="text-xs text-gray-500">Despesas</p>
            </div>
            <p className="text-xl font-bold text-rose-400">-{totalExpenses.toLocaleString("pt-MZ")} <span className="text-xs font-normal text-gray-500">MZN</span></p>
          </section>
        </div>

        {/* Xitique Summary */}
        {activeXitiqueGroups > 0 && (
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h2 className="font-semibold text-sm text-white">Xitique</h2>
              </div>
              <a href="/xitique" className="flex items-center gap-1 text-xs text-emerald-400 font-medium hover:text-emerald-300 transition-colors">
                Ver tudo <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Grupos activos</span>
                  <span className="font-semibold text-white">{activeXitiqueGroups}</span>
                </div>
              </div>
              {myTurnXitique && (
                <div className="flex-shrink-0 bg-amber-500/15 border border-amber-500/20 rounded-xl px-3 py-2 text-center">
                  <Star className="w-4 h-4 text-amber-400 mx-auto mb-0.5" />
                  <p className="text-xs font-bold text-amber-300">Minha vez!</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Debt Summary */}
        {(totalDebtOwed > 0 || totalDebtReceivable > 0) && (
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" />
                <h2 className="font-semibold text-sm text-white">Dívidas</h2>
              </div>
              <a href="/dividas" className="flex items-center gap-1 text-xs text-emerald-400 font-medium hover:text-emerald-300 transition-colors">
                Ver tudo <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center">
                <p className="text-xs text-rose-300">Devo</p>
                <p className="text-sm font-bold text-rose-400">{totalDebtOwed.toLocaleString("pt-MZ")}</p>
                <p className="text-xs text-rose-500">MZN</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <p className="text-xs text-emerald-300">Devem-me</p>
                <p className="text-sm font-bold text-emerald-400">{totalDebtReceivable.toLocaleString("pt-MZ")}</p>
                <p className="text-xs text-emerald-500">MZN</p>
              </div>
            </div>
          </section>
        )}

        {/* Budget Progress + Recent Transactions — side by side on lg+ */}
        {(budgetProgress.length > 0 || recentTransactions.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget Progress */}
            {budgetProgress.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-white">Orçamento</h2>
                  <a href="/orcamento" className="text-xs text-emerald-400 font-medium hover:text-emerald-300 transition-colors">Ver tudo</a>
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
                  <h2 className="font-semibold text-white">Transacções Recentes</h2>
                  <a href="/transacoes" className="text-xs text-emerald-400 font-medium hover:text-emerald-300 transition-colors">Ver todas</a>
                </div>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl divide-y divide-white/5">
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
          </div>
        )}

        {/* Trend indicator — dark premium */}
        {totalIncome > totalExpenses && totalIncome > 0 && (
          <section className="bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-300">Estás a poupar bem!</p>
                <p className="text-xs text-emerald-400/70">
                  Poupaste {Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)}% do teu rendimento este mês
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
