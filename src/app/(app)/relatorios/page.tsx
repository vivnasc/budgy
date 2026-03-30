"use client";

import { useState, useMemo } from "react";
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
} from "recharts";
import {
  Download,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { useTransactions } from "@/hooks/use-supabase-data";
import type { Transaction } from "@/lib/supabase/types";

type Period = "this_month" | "last_month" | "last_3" | "last_6";

const PERIODS: { key: Period; label: string; months: number }[] = [
  { key: "this_month", label: "Este Mês", months: 1 },
  { key: "last_month", label: "Último Mês", months: 1 },
  { key: "last_3", label: "Últimos 3 Meses", months: 3 },
  { key: "last_6", label: "Últimos 6 Meses", months: 6 },
];

const PIE_COLORS = ["#EF4444", "#3B82F6", "#F59E0B", "#8B5CF6", "#06B6D4", "#EC4899", "#10B981", "#F97316", "#6366F1"];

function getDateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  let from: Date;

  switch (period) {
    case "this_month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last_month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case "last_3":
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case "last_6":
      from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      break;
  }

  const to = period === "last_month"
    ? new Date(now.getFullYear(), now.getMonth(), 0)
    : now;

  return {
    from: from.toISOString().split("T")[0]!,
    to: to.toISOString().split("T")[0]!,
  };
}

function formatCurrency(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toString();
}

function groupByCategory(transactions: Transaction[]): Array<{ name: string; value: number; color: string }> {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const cat = tx.categories?.name ?? "Outros";
    map.set(cat, (map.get(cat) ?? 0) + tx.amount);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name,
      value,
      color: PIE_COLORS[i % PIE_COLORS.length]!,
    }));
}

function groupByMonth(transactions: Transaction[]): Array<{ month: string; receitas: number; despesas: number }> {
  const map = new Map<string, { receitas: number; despesas: number }>();

  for (const tx of transactions) {
    const d = new Date(tx.date + "T00:00:00");
    const key = d.toLocaleDateString("pt-MZ", { month: "short" });
    const entry = map.get(key) ?? { receitas: 0, despesas: 0 };
    if (tx.type === "income") entry.receitas += tx.amount;
    else if (tx.type === "expense") entry.despesas += tx.amount;
    map.set(key, entry);
  }

  return Array.from(map.entries()).map(([month, data]) => ({ month, ...data }));
}

export default function RelatoriosPage() {
  const [period, setPeriod] = useState<Period>("this_month");
  const { from, to } = useMemo(() => getDateRange(period), [period]);
  const { data: transactions, loading } = useTransactions({ from, to, limit: 1000 });

  const allTx = transactions ?? [];
  const totalIncome = allTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = allTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const netSavings = totalIncome - totalExpense;

  const categoryData = useMemo(() => groupByCategory(allTx), [allTx]);
  const monthlyData = useMemo(() => groupByMonth(allTx), [allTx]);
  const totalCategorySpend = categoryData.reduce((s, c) => s + c.value, 0);
  const topCategories = categoryData.slice(0, 5);

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
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                period === p.key ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 pt-4 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-56 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">Receitas</span>
                </div>
                <p className="text-lg font-bold text-emerald-600">{totalIncome.toLocaleString("pt-MZ")}</p>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">Despesas</span>
                </div>
                <p className="text-lg font-bold text-red-500">{totalExpense.toLocaleString("pt-MZ")}</p>
              </div>
            </div>

            {/* Net Savings */}
            <div className={`card p-4 border-l-4 ${netSavings >= 0 ? "border-l-emerald-500 bg-emerald-50/30" : "border-l-red-500 bg-red-50/30"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Poupança Líquida</p>
                  <p className={`text-xl font-bold ${netSavings >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {netSavings >= 0 ? "+" : ""}{netSavings.toLocaleString("pt-MZ")} MZN
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${netSavings >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
                  <PiggyBank className={`w-5 h-5 ${netSavings >= 0 ? "text-emerald-600" : "text-red-500"}`} />
                </div>
              </div>
            </div>

            {/* Bar Chart */}
            {monthlyData.length > 0 && (
              <section className="card p-4">
                <h2 className="font-semibold text-sm mb-4">Receitas vs Despesas</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} tickLine={false} axisLine={false} tickFormatter={formatCurrency} />
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value.toLocaleString("pt-MZ")} MZN`, name === "receitas" ? "Receitas" : "Despesas"]}
                        contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB", fontSize: "12px" }}
                      />
                      <Bar dataKey="receitas" fill="#10B981" radius={[4, 4, 0, 0]} name="Receitas" />
                      <Bar dataKey="despesas" fill="#EF4444" radius={[4, 4, 0, 0]} name="Despesas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Category Pie Chart */}
            {categoryData.length > 0 && (
              <section className="card p-4">
                <h2 className="font-semibold text-sm mb-4">Despesas por Categoria</h2>
                <div className="flex items-center gap-4">
                  <div className="h-48 w-48 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${value.toLocaleString("pt-MZ")} MZN`, ""]}
                          contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB", fontSize: "12px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {categoryData.slice(0, 6).map((cat) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-2xs text-[var(--color-text-secondary)] flex-1 truncate">{cat.name}</span>
                        <span className="text-2xs font-semibold">
                          {totalCategorySpend > 0 ? Math.round((cat.value / totalCategorySpend) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Top Categories */}
            {topCategories.length > 0 && (
              <section className="card p-4">
                <h2 className="font-semibold text-sm mb-3">Top Categorias de Despesa</h2>
                <div className="space-y-3">
                  {topCategories.map((cat, i) => {
                    const percent = totalCategorySpend > 0 ? (cat.value / totalCategorySpend) * 100 : 0;
                    return (
                      <div key={cat.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-[var(--color-text-muted)] w-5 text-center">{i + 1}</span>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cat.color}15` }}>
                          <Wallet className="w-4 h-4" style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium truncate">{cat.name}</span>
                            <span className="text-xs font-bold">{cat.value.toLocaleString("pt-MZ")} MZN</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: cat.color }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Empty state */}
            {allTx.length === 0 && (
              <div className="card p-8 text-center">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-1">Sem dados para este período</p>
                <p className="text-xs text-gray-400">Importa transações para ver relatórios</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
