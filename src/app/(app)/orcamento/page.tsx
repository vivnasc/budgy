"use client";

import { useState } from "react";
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
  RotateCcw,
  TrendingDown,
  PiggyBank,
  ArrowRight,
  Infinity,
  Timer,
  Target,
  Shield,
  CalendarClock,
  Umbrella,
  BookOpen,
  Activity,
} from "lucide-react";
import { BudgetProgress } from "@/components/budget-progress";

type RolloverOption = "unlimited" | "max2x" | "expires" | "redirect";

interface BudgetCategory {
  id: string;
  category: string;
  budgeted: number;
  spent: number;
  icon: React.ComponentType<{ className?: string }>;
  hasRollover: boolean;
  rolloverAmount?: number;
  rolloverOption?: RolloverOption;
}

interface SeasonalProvision {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  annualCost: number;
  monthlyProvision: number;
  accumulated: number;
  nextDue: string;
  color: string;
}

const ROLLOVER_OPTIONS: { key: RolloverOption; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { key: "unlimited", label: "Acumula Ilimitado", icon: Infinity, description: "Saldo não utilizado acumula sem limite" },
  { key: "max2x", label: "Máximo 2x", icon: Shield, description: "Acumula até 2x o orçamento mensal" },
  { key: "expires", label: "Expira", icon: Timer, description: "Saldo não utilizado expira no fim do mês" },
  { key: "redirect", label: "Redirige para Meta", icon: Target, description: "Saldo excedente vai para uma meta" },
];

const MOCK_BUDGETS: BudgetCategory[] = [
  { id: "1", category: "Alimentação", budgeted: 15000, spent: 11200, icon: Utensils, hasRollover: false, rolloverOption: "expires" },
  { id: "2", category: "Transporte", budgeted: 8000, spent: 6400, icon: Car, hasRollover: true, rolloverAmount: 1200, rolloverOption: "unlimited" },
  { id: "3", category: "Contas & Serviços", budgeted: 10000, spent: 7800, icon: Zap, hasRollover: false, rolloverOption: "expires" },
  { id: "4", category: "Casa & Renda", budgeted: 20000, spent: 20000, icon: Home, hasRollover: false, rolloverOption: "expires" },
  { id: "5", category: "Educação", budgeted: 10000, spent: 8500, icon: GraduationCap, hasRollover: true, rolloverAmount: 500, rolloverOption: "max2x" },
  { id: "6", category: "Saúde", budgeted: 5000, spent: 950, icon: Heart, hasRollover: false, rolloverOption: "redirect" },
  { id: "7", category: "Comunicação", budgeted: 3000, spent: 2400, icon: Smartphone, hasRollover: false, rolloverOption: "expires" },
  { id: "8", category: "Lazer", budgeted: 5000, spent: 6200, icon: Gamepad2, hasRollover: false, rolloverOption: "expires" },
  { id: "9", category: "Roupa", budgeted: 4000, spent: 1500, icon: Shirt, hasRollover: true, rolloverAmount: 2000, rolloverOption: "unlimited" },
  { id: "10", category: "Compras", budgeted: 3000, spent: 800, icon: ShoppingCart, hasRollover: false, rolloverOption: "max2x" },
];

const SEASONAL_PROVISIONS: SeasonalProvision[] = [
  {
    id: "1",
    name: "Material Escolar",
    icon: BookOpen,
    annualCost: 18000,
    monthlyProvision: 1500,
    accumulated: 4500,
    nextDue: "Janeiro 2027",
    color: "bg-blue-500",
  },
  {
    id: "2",
    name: "Seguro Automóvel",
    icon: Shield,
    annualCost: 24000,
    monthlyProvision: 2000,
    accumulated: 14000,
    nextDue: "Julho 2026",
    color: "bg-amber-500",
  },
  {
    id: "3",
    name: "Fundo de Chuvas",
    icon: Umbrella,
    annualCost: 12000,
    monthlyProvision: 1000,
    accumulated: 8000,
    nextDue: "Novembro 2026",
    color: "bg-teal-500",
  },
];

function getHealthScore(budgets: BudgetCategory[]): { score: number; label: string; color: string; bgColor: string } {
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.budgeted, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const overBudgetCount = budgets.filter((b) => b.spent > b.budgeted).length;
  const ratio = totalSpent / totalBudgeted;

  let score = 100;
  score -= ratio * 60;
  score -= overBudgetCount * 8;
  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score >= 70) return { score, label: "Saudável", color: "text-emerald-600", bgColor: "bg-emerald-500" };
  if (score >= 40) return { score, label: "Atenção", color: "text-amber-600", bgColor: "bg-amber-500" };
  return { score, label: "Crítico", color: "text-red-600", bgColor: "bg-red-500" };
}

export default function OrcamentoPage() {
  const [currentMonth] = useState("Fevereiro 2026");
  const [selectedRolloverCategory, setSelectedRolloverCategory] = useState<string | null>(null);

  const totalBudgeted = MOCK_BUDGETS.reduce((sum, b) => sum + b.budgeted, 0);
  const totalSpent = MOCK_BUDGETS.reduce((sum, b) => sum + b.spent, 0);
  const remaining = totalBudgeted - totalSpent;
  const overallPercent = Math.min((totalSpent / totalBudgeted) * 100, 100);
  const overBudgetCategories = MOCK_BUDGETS.filter((b) => b.spent > b.budgeted);
  const totalRollover = MOCK_BUDGETS.reduce((sum, b) => sum + (b.rolloverAmount || 0), 0);

  const health = getHealthScore(MOCK_BUDGETS);
  const totalSeasonalMonthly = SEASONAL_PROVISIONS.reduce((sum, p) => sum + p.monthlyProvision, 0);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 pt-12 pb-4 sticky top-0 z-30">
        <h1 className="text-xl font-bold mb-4">Orçamento</h1>

        {/* Month Selector */}
        <div className="flex items-center justify-center gap-4">
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[140px] text-center">
            {currentMonth}
          </span>
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="px-4 pt-4 space-y-6">
        {/* Budget Health Meter */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--color-text-secondary)]" />
              <h2 className="font-semibold text-sm">Saúde Financeira</h2>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                health.score >= 70
                  ? "bg-emerald-50 text-emerald-700"
                  : health.score >= 40
                    ? "bg-amber-50 text-amber-700"
                    : "bg-red-50 text-red-700"
              }`}
            >
              {health.label}
            </span>
          </div>

          {/* Health meter bar */}
          <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-3">
            {/* Gradient background zones */}
            <div className="absolute inset-0 flex">
              <div className="flex-1 bg-red-100" />
              <div className="flex-1 bg-amber-100" />
              <div className="flex-1 bg-emerald-100" />
            </div>
            {/* Score indicator */}
            <div
              className={`absolute top-0 h-full ${health.bgColor} rounded-full transition-all duration-700 opacity-90`}
              style={{ width: `${health.score}%` }}
            />
            {/* Score number overlay */}
            <div
              className="absolute top-0 h-full flex items-center transition-all duration-700"
              style={{ left: `${Math.max(health.score - 5, 2)}%` }}
            >
              <span className="text-2xs font-bold text-white drop-shadow-sm">
                {health.score}
              </span>
            </div>
          </div>

          <div className="flex justify-between text-2xs text-[var(--color-text-muted)]">
            <span>Crítico</span>
            <span>Atenção</span>
            <span>Saudável</span>
          </div>
        </div>

        {/* Overview Card */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Visão Geral</h2>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                remaining >= 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {remaining >= 0 ? "No limite" : "Acima do orçamento"}
            </span>
          </div>

          {/* Circular-style visual */}
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={overallPercent > 90 ? "#EF4444" : overallPercent > 75 ? "#F59E0B" : "#10B981"}
                  strokeWidth="10"
                  strokeDasharray={`${overallPercent * 2.51} ${251 - overallPercent * 2.51}`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">
                  {Math.round(overallPercent)}%
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Orçamentado</span>
                <span className="font-semibold">
                  {totalBudgeted.toLocaleString("pt-MZ")} MZN
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Gasto</span>
                <span className="font-semibold text-red-500">
                  {totalSpent.toLocaleString("pt-MZ")} MZN
                </span>
              </div>
              <hr className="border-[var(--color-border)]" />
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Restante</span>
                <span
                  className={`font-bold ${
                    remaining >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
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
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <TrendingDown className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <p className="text-xs text-[var(--color-text-muted)]">Maior gasto</p>
            <p className="text-xs font-bold mt-0.5">Casa & Renda</p>
          </div>
          <div className="card p-3 text-center">
            <PiggyBank className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-xs text-[var(--color-text-muted)]">Mais poupado</p>
            <p className="text-xs font-bold mt-0.5">Saúde</p>
          </div>
          <div className="card p-3 text-center">
            <RotateCcw className="w-5 h-5 text-primary-500 mx-auto mb-1" />
            <p className="text-xs text-[var(--color-text-muted)]">Rollover</p>
            <p className="text-xs font-bold mt-0.5">{totalRollover.toLocaleString("pt-MZ")} MZN</p>
          </div>
        </div>

        {/* Rollover Options Visual */}
        <section>
          <h2 className="font-semibold mb-3">Opções de Rollover</h2>
          <div className="grid grid-cols-2 gap-3">
            {ROLLOVER_OPTIONS.map((option) => {
              const count = MOCK_BUDGETS.filter((b) => b.rolloverOption === option.key).length;
              const isSelected = selectedRolloverCategory === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() =>
                    setSelectedRolloverCategory(
                      isSelected ? null : option.key
                    )
                  }
                  className={`card p-3 text-left transition-all ${
                    isSelected ? "ring-2 ring-primary-500 bg-primary-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isSelected
                          ? "bg-primary-500 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <option.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-2xs font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md">
                      {count}
                    </span>
                  </div>
                  <p className="text-xs font-semibold">{option.label}</p>
                  <p className="text-2xs text-[var(--color-text-muted)] mt-0.5 leading-tight">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Budget Category Cards */}
        <section>
          <h2 className="font-semibold mb-3">Categorias</h2>
          <div className="space-y-3">
            {MOCK_BUDGETS.filter((budget) =>
              selectedRolloverCategory
                ? budget.rolloverOption === selectedRolloverCategory
                : true
            ).map((budget) => {
              const rolloverOpt = ROLLOVER_OPTIONS.find(
                (r) => r.key === budget.rolloverOption
              );
              return (
                <div key={budget.id} className="space-y-1">
                  <BudgetProgress
                    category={budget.category}
                    budgeted={budget.budgeted}
                    spent={budget.spent}
                    icon={budget.icon}
                    hasRollover={budget.hasRollover}
                    rolloverAmount={budget.rolloverAmount}
                  />
                  {/* Rollover indicator per category */}
                  {budget.rolloverOption && (
                    <div className="flex items-center gap-1.5 ml-12 px-1">
                      {rolloverOpt && (
                        <span className="inline-flex items-center gap-1 text-2xs text-[var(--color-text-muted)]">
                          <rolloverOpt.icon className="w-2.5 h-2.5" />
                          {rolloverOpt.label}
                        </span>
                      )}
                      {budget.hasRollover && budget.rolloverAmount && budget.rolloverAmount > 0 && (
                        <span className="text-2xs text-primary-600 font-medium">
                          | Acumulado: {budget.rolloverAmount.toLocaleString("pt-MZ")} MZN
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Provisão Sazonal */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[var(--color-text-secondary)]" />
              <h2 className="font-semibold">Provisão Sazonal</h2>
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">
              {totalSeasonalMonthly.toLocaleString("pt-MZ")} MZN/mês
            </span>
          </div>

          <div className="space-y-3">
            {SEASONAL_PROVISIONS.map((provision) => {
              const progress = (provision.accumulated / provision.annualCost) * 100;
              return (
                <div key={provision.id} className="card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-10 h-10 ${provision.color} rounded-xl flex items-center justify-center flex-shrink-0`}
                    >
                      <provision.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{provision.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Próximo: {provision.nextDue}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-primary-600">
                        {provision.accumulated.toLocaleString("pt-MZ")}
                      </p>
                      <p className="text-2xs text-[var(--color-text-muted)]">
                        de {provision.annualCost.toLocaleString("pt-MZ")} MZN
                      </p>
                    </div>
                  </div>

                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                    <div
                      className={`h-full ${provision.color} rounded-full transition-all duration-500 opacity-80`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-2xs text-[var(--color-text-muted)]">
                    <span>Provisão mensal: {provision.monthlyProvision.toLocaleString("pt-MZ")} MZN</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* FAB to add budget category */}
      <button className="fab">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
