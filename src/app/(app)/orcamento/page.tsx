"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Utensils,
  Car,
  Zap,
  Home,
  ShoppingCart,
  GraduationCap,
  Heart,
  Smartphone,
  Gamepad2,
  Shirt,
  AlertTriangle,
  TrendingDown,
  PiggyBank,
  Activity,
  Wallet,
} from "lucide-react";
import { BudgetProgress } from "@/components/budget-progress";
import { useBudgets, useTransactions, useCategories } from "@/hooks/use-supabase-data";
import { QuickCreateModal } from "@/components/quick-create-modal";

const CATEGORY_ICONS: Record<string, typeof Utensils> = {
  "Alimentação": Utensils,
  "Transporte": Car,
  "Contas": Zap,
  "Contas & Serviços": Zap,
  "Casa": Home,
  "Casa & Renda": Home,
  "Educação": GraduationCap,
  "Saúde": Heart,
  "Comunicação": Smartphone,
  "Lazer": Gamepad2,
  "Roupa": Shirt,
  "Compras": ShoppingCart,
};

function getMonthDates(monthOffset: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const from = d.toISOString().split("T")[0]!;
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0]!;
  const label = d.toLocaleDateString("pt-MZ", { month: "long", year: "numeric" });
  return { from, to, label };
}

export default function OrcamentoPage() {
  const [monthOffset, setMonthOffset] = useState(0);
  const { from, to, label: currentMonth } = useMemo(() => getMonthDates(monthOffset), [monthOffset]);

  const { data: budgets, loading: budgetsLoading, refetch } = useBudgets();
  const { data: allCategories } = useCategories();
  const [creating, setCreating] = useState(false);
  const expenseCategories = (allCategories ?? []).filter((c) => c.type === "expense");
  const { data: transactions, loading: txLoading } = useTransactions({ type: "expense", from, to, limit: 500 });

  const allBudgets = budgets ?? [];
  const allTx = transactions ?? [];
  const loading = budgetsLoading || txLoading;

  // Calculate spent per budget category
  const budgetProgress = useMemo(() => {
    return allBudgets.map((b) => {
      const categoryName = b.categories?.name ?? "Outros";
      const spent = allTx
        .filter((t) => t.category_id === b.category_id)
        .reduce((s, t) => s + t.amount, 0);
      const icon = CATEGORY_ICONS[categoryName] ?? Wallet;
      return {
        id: b.id,
        category: categoryName,
        budgeted: b.amount,
        spent,
        icon,
        rollover_enabled: b.rollover_enabled,
        rollover_amount: b.rollover_amount,
      };
    });
  }, [allBudgets, allTx]);

  const totalBudgeted = budgetProgress.reduce((sum, b) => sum + b.budgeted, 0);
  const totalSpent = budgetProgress.reduce((sum, b) => sum + b.spent, 0);
  const remaining = totalBudgeted - totalSpent;
  const overallPercent = totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0;
  const overBudgetCategories = budgetProgress.filter((b) => b.spent > b.budgeted);

  // Health score
  let healthScore = 100;
  if (totalBudgeted > 0) healthScore -= (totalSpent / totalBudgeted) * 60;
  healthScore -= overBudgetCategories.length * 8;
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
  const healthLabel = healthScore >= 70 ? "Saudável" : healthScore >= 40 ? "Atenção" : "Crítico";
  const healthBg = healthScore >= 70 ? "bg-emerald-500" : healthScore >= 40 ? "bg-amber-500" : "bg-red-500";

  // Top spender
  const topSpender = budgetProgress.length > 0
    ? budgetProgress.reduce((max, b) => b.spent > max.spent ? b : max, budgetProgress[0]!)
    : null;
  const topSaver = budgetProgress.length > 0
    ? budgetProgress.reduce((max, b) => (b.budgeted - b.spent) > (max.budgeted - max.spent) ? b : max, budgetProgress[0]!)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-primary-200 rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-400">A carregar orçamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 pt-12 pb-4 sticky top-0 z-30">
        <h1 className="text-xl font-bold mb-4">Orçamento</h1>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setMonthOffset((m) => m - 1)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[140px] text-center capitalize">{currentMonth}</span>
          <button onClick={() => setMonthOffset((m) => Math.min(m + 1, 0))} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="px-4 pt-4 space-y-6">
        {allBudgets.length === 0 ? (
          <div className="card p-8 text-center">
            <PiggyBank className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-1">Sem orçamentos definidos</p>
            <p className="text-xs text-gray-400">Cria orçamentos por categoria para controlar os gastos</p>
          </div>
        ) : (
          <>
            {/* Budget Health */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <h2 className="font-semibold text-sm">Saúde Financeira</h2>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  healthScore >= 70 ? "bg-emerald-50 text-emerald-700" : healthScore >= 40 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                }`}>
                  {healthLabel}
                </span>
              </div>
              <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div className="absolute inset-0 flex">
                  <div className="flex-1 bg-red-100" />
                  <div className="flex-1 bg-amber-100" />
                  <div className="flex-1 bg-emerald-100" />
                </div>
                <div className={`absolute top-0 h-full ${healthBg} rounded-full transition-all duration-700 opacity-90`} style={{ width: `${healthScore}%` }} />
              </div>
              <div className="flex justify-between text-2xs text-[var(--color-text-muted)]">
                <span>Crítico</span><span>Atenção</span><span>Saudável</span>
              </div>
            </div>

            {/* Overview */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm">Visão Geral</h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${remaining >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {remaining >= 0 ? "No limite" : "Acima do orçamento"}
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                    <circle cx="50" cy="50" r="40" fill="none"
                      stroke={overallPercent > 90 ? "#EF4444" : overallPercent > 75 ? "#F59E0B" : "#10B981"}
                      strokeWidth="10"
                      strokeDasharray={`${overallPercent * 2.51} ${251 - overallPercent * 2.51}`}
                      strokeLinecap="round" className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold">{Math.round(overallPercent)}%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">Orçamentado</span>
                    <span className="font-semibold">{totalBudgeted.toLocaleString("pt-MZ")} MZN</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">Gasto</span>
                    <span className="font-semibold text-red-500">{totalSpent.toLocaleString("pt-MZ")} MZN</span>
                  </div>
                  <hr className="border-[var(--color-border)]" />
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">Restante</span>
                    <span className={`font-bold ${remaining >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {remaining.toLocaleString("pt-MZ")} MZN
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Over Budget Alert */}
            {overBudgetCategories.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    {overBudgetCategories.length} categoria{overBudgetCategories.length > 1 ? "s" : ""} acima do orçamento
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {overBudgetCategories.map((b) => b.category).join(", ")}
                  </p>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            {budgetProgress.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {topSpender && (
                  <div className="card p-3 text-center">
                    <TrendingDown className="w-5 h-5 text-red-500 mx-auto mb-1" />
                    <p className="text-xs text-[var(--color-text-muted)]">Maior gasto</p>
                    <p className="text-xs font-bold mt-0.5">{topSpender.category}</p>
                  </div>
                )}
                {topSaver && (
                  <div className="card p-3 text-center">
                    <PiggyBank className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xs text-[var(--color-text-muted)]">Mais poupado</p>
                    <p className="text-xs font-bold mt-0.5">{topSaver.category}</p>
                  </div>
                )}
              </div>
            )}

            {/* Budget Categories */}
            <section>
              <h2 className="font-semibold mb-3">Categorias</h2>
              <div className="space-y-3">
                {budgetProgress.map((budget) => (
                  <BudgetProgress
                    key={budget.id}
                    category={budget.category}
                    budgeted={budget.budgeted}
                    spent={budget.spent}
                    icon={budget.icon}
                    hasRollover={budget.rollover_enabled}
                    rolloverAmount={budget.rollover_amount}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <button onClick={() => setCreating(true)} className="fab">
        <Plus className="w-6 h-6" />
      </button>

      {creating && (
        <QuickCreateModal
          kind="budget"
          categoryOptions={expenseCategories}
          onClose={() => setCreating(false)}
          onCreated={() => refetch()}
        />
      )}
    </div>
  );
}
