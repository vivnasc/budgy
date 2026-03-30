"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Download,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Utensils,
  Car,
  Home,
  Zap,
  GraduationCap,
  Heart,
  Gamepad2,
  Shirt,
  ShoppingCart,
  PiggyBank,
} from "lucide-react";

type Period = "this_month" | "last_month" | "last_3" | "this_year";

interface PeriodOption {
  key: Period;
  label: string;
}

const PERIODS: PeriodOption[] = [
  { key: "this_month", label: "Este Mês" },
  { key: "last_month", label: "Último Mês" },
  { key: "last_3", label: "Últimos 3 Meses" },
  { key: "this_year", label: "Este Ano" },
];

// Income vs Expense data by month
const INCOME_EXPENSE_DATA = [
  { month: "Set", receitas: 65000, despesas: 52000 },
  { month: "Out", receitas: 68000, despesas: 48000 },
  { month: "Nov", receitas: 65000, despesas: 55000 },
  { month: "Dez", receitas: 80000, despesas: 72000 },
  { month: "Jan", receitas: 65000, despesas: 45000 },
  { month: "Fev", receitas: 80000, despesas: 58000 },
];

// Category breakdown
const CATEGORY_DATA = [
  { name: "Alimentação", value: 18500, color: "#EF4444", icon: Utensils },
  { name: "Casa & Renda", value: 20000, color: "#3B82F6", icon: Home },
  { name: "Transporte", value: 9200, color: "#F59E0B", icon: Car },
  { name: "Educação", value: 8500, color: "#8B5CF6", icon: GraduationCap },
  { name: "Contas", value: 7800, color: "#06B6D4", icon: Zap },
  { name: "Lazer", value: 6200, color: "#EC4899", icon: Gamepad2 },
  { name: "Saúde", value: 3500, color: "#10B981", icon: Heart },
  { name: "Roupa", value: 2800, color: "#F97316", icon: Shirt },
  { name: "Compras", value: 1500, color: "#6366F1", icon: ShoppingCart },
];

// Monthly trend data
const TREND_DATA = [
  { month: "Set", poupanca: 13000, saldo: 13000 },
  { month: "Out", poupanca: 20000, saldo: 33000 },
  { month: "Nov", poupanca: 10000, saldo: 43000 },
  { month: "Dez", poupanca: 8000, saldo: 51000 },
  { month: "Jan", poupanca: 20000, saldo: 71000 },
  { month: "Fev", poupanca: 22000, saldo: 93000 },
];

const PIE_COLORS = CATEGORY_DATA.map((c) => c.color);

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return value.toString();
}

export default function RelatoriosPage() {
  const [period, setPeriod] = useState<Period>("this_month");

  const totalIncome = 80000;
  const totalExpense = 78000;
  const netSavings = totalIncome - totalExpense;
  const prevIncome = 65000;
  const prevExpense = 45000;
  const incomeChange = ((totalIncome - prevIncome) / prevIncome) * 100;
  const expenseChange = ((totalExpense - prevExpense) / prevExpense) * 100;

  const totalCategorySpend = CATEGORY_DATA.reduce((s, c) => s + c.value, 0);
  const topCategories = [...CATEGORY_DATA].sort((a, b) => b.value - a.value).slice(0, 5);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 pt-12 pb-4 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Relatórios</h1>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                period === p.key
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 pt-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">Receitas</span>
            </div>
            <p className="text-lg font-bold text-emerald-600">
              {totalIncome.toLocaleString("pt-MZ")}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span className="text-2xs text-emerald-600 font-medium">
                +{incomeChange.toFixed(1)}% vs mês anterior
              </span>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">Despesas</span>
            </div>
            <p className="text-lg font-bold text-red-500">
              {totalExpense.toLocaleString("pt-MZ")}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-red-500" />
              <span className="text-2xs text-red-500 font-medium">
                +{expenseChange.toFixed(1)}% vs mês anterior
              </span>
            </div>
          </div>
        </div>

        {/* Net Savings */}
        <div
          className={`card p-4 border-l-4 ${
            netSavings >= 0
              ? "border-l-emerald-500 bg-emerald-50/30"
              : "border-l-red-500 bg-red-50/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Poupança Líquida
              </p>
              <p
                className={`text-xl font-bold ${
                  netSavings >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {netSavings >= 0 ? "+" : ""}
                {netSavings.toLocaleString("pt-MZ")} MZN
              </p>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                netSavings >= 0 ? "bg-emerald-100" : "bg-red-100"
              }`}
            >
              <PiggyBank
                className={`w-5 h-5 ${
                  netSavings >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Income vs Expense Bar Chart */}
        <section className="card p-4">
          <h2 className="font-semibold text-sm mb-4">Receitas vs Despesas</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={INCOME_EXPENSE_DATA} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString("pt-MZ")} MZN`,
                    name === "receitas" ? "Receitas" : "Despesas",
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #E5E7EB",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="receitas"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  name="Receitas"
                />
                <Bar
                  dataKey="despesas"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                  name="Despesas"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
              <span className="text-2xs text-[var(--color-text-muted)]">Receitas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-red-500 rounded-sm" />
              <span className="text-2xs text-[var(--color-text-muted)]">Despesas</span>
            </div>
          </div>
        </section>

        {/* Category Breakdown Pie Chart */}
        <section className="card p-4">
          <h2 className="font-semibold text-sm mb-4">Despesas por Categoria</h2>
          <div className="flex items-center gap-4">
            <div className="h-48 w-48 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={CATEGORY_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {CATEGORY_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [
                      `${value.toLocaleString("pt-MZ")} MZN`,
                      "",
                    ]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #E5E7EB",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-1.5">
              {CATEGORY_DATA.slice(0, 6).map((cat) => (
                <div key={cat.name} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-2xs text-[var(--color-text-secondary)] flex-1 truncate">
                    {cat.name}
                  </span>
                  <span className="text-2xs font-semibold">
                    {Math.round((cat.value / totalCategorySpend) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Top Spending Categories */}
        <section className="card p-4">
          <h2 className="font-semibold text-sm mb-3">
            Top Categorias de Despesa
          </h2>
          <div className="space-y-3">
            {topCategories.map((cat, i) => {
              const percent = (cat.value / totalCategorySpend) * 100;
              const CatIcon = cat.icon;
              return (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[var(--color-text-muted)] w-5 text-center">
                    {i + 1}
                  </span>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}15` }}
                  >
                    <CatIcon
                      className="w-4 h-4"
                      style={{ color: cat.color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate">
                        {cat.name}
                      </span>
                      <span className="text-xs font-bold">
                        {cat.value.toLocaleString("pt-MZ")} MZN
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Savings Trend Line Chart */}
        <section className="card p-4">
          <h2 className="font-semibold text-sm mb-4">
            Tendência de Poupança
          </h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={TREND_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString("pt-MZ")} MZN`,
                    name === "poupanca" ? "Poupança Mensal" : "Saldo Acumulado",
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #E5E7EB",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="poupanca"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#10B981" }}
                  name="Poupança Mensal"
                />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#3B82F6" }}
                  strokeDasharray="5 5"
                  name="Saldo Acumulado"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-emerald-500 rounded" />
              <span className="text-2xs text-[var(--color-text-muted)]">Poupança Mensal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-blue-500 rounded border-dashed" />
              <span className="text-2xs text-[var(--color-text-muted)]">Saldo Acumulado</span>
            </div>
          </div>
        </section>

        {/* Comparison with Previous Period */}
        <section className="card p-4">
          <h2 className="font-semibold text-sm mb-3">
            Comparação com Mês Anterior
          </h2>
          <div className="space-y-3">
            {[
              {
                label: "Receitas",
                current: totalIncome,
                previous: prevIncome,
                icon: ArrowUpRight,
              },
              {
                label: "Despesas",
                current: totalExpense,
                previous: prevExpense,
                icon: ArrowDownRight,
              },
              {
                label: "Poupança",
                current: netSavings,
                previous: prevIncome - prevExpense,
                icon: PiggyBank,
              },
            ].map((item) => {
              const change = item.previous > 0
                ? ((item.current - item.previous) / item.previous) * 100
                : 0;
              const isPositive =
                item.label === "Despesas" ? change < 0 : change > 0;
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 py-2 border-b border-[var(--color-border)] last:border-0"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Icon className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium">{item.label}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {item.previous.toLocaleString("pt-MZ")}
                      </span>
                      <span className="text-2xs text-[var(--color-text-muted)]">
                        &rarr;
                      </span>
                      <span className="text-xs font-bold">
                        {item.current.toLocaleString("pt-MZ")}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      isPositive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {change >= 0 ? "+" : ""}
                    {change.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
