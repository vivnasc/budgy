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
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Wallet,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTransactions } from "@/hooks/use-supabase-data";
import type { Transaction } from "@/lib/supabase/types";

const PIE_COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#6366F1"];

function getMonthDates(monthOffset: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const from = d.toISOString().split("T")[0]!;
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0]!;
  const label = d.toLocaleDateString("pt-MZ", { month: "long", year: "numeric" });
  return { from, to, label };
}

function formatMZN(value: number): string {
  return value.toLocaleString("pt-MZ", { maximumFractionDigits: 0 });
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
    .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length]! }));
}

function groupByWeek(transactions: Transaction[]): Array<{ label: string; receitas: number; despesas: number }> {
  const weeks = new Map<string, { receitas: number; despesas: number }>();
  for (const tx of transactions) {
    const d = new Date(tx.date + "T00:00:00");
    const weekNum = Math.ceil(d.getDate() / 7);
    const key = `Sem ${weekNum}`;
    const entry = weeks.get(key) ?? { receitas: 0, despesas: 0 };
    if (tx.type === "income") entry.receitas += tx.amount;
    else if (tx.type === "expense") entry.despesas += tx.amount;
    weeks.set(key, entry);
  }
  return Array.from(weeks.entries()).map(([label, data]) => ({ label, ...data }));
}

export default function RelatoriosPage() {
  const [monthOffset, setMonthOffset] = useState(0);
  const { from, to, label: currentMonth } = useMemo(() => getMonthDates(monthOffset), [monthOffset]);
  const { data: transactions, loading } = useTransactions({ from, to, limit: 1000 });

  const allTx = transactions ?? [];
  const totalIncome = allTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = allTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  const categoryData = useMemo(() => groupByCategory(allTx), [allTx]);
  const weeklyData = useMemo(() => groupByWeek(allTx), [allTx]);
  const totalCategorySpend = categoryData.reduce((s, c) => s + c.value, 0);

  // Top insights
  const topCategory = categoryData[0];
  const txCount = allTx.length;

  return (
    <div className="min-h-screen pb-24 bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Relat&oacute;rios</h1>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-200" />
          </div>
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-center gap-4 mb-5">
          <button onClick={() => setMonthOffset((m) => m - 1)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[140px] text-center capitalize">{currentMonth}</span>
          <button onClick={() => setMonthOffset((m) => Math.min(m + 1, 0))} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Big numbers */}
        <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-primary-200 text-2xs uppercase">Entrou</p>
              <p className="text-lg font-bold text-emerald-200">+{formatMZN(totalIncome)}</p>
            </div>
            <div>
              <p className="text-primary-200 text-2xs uppercase">Saiu</p>
              <p className="text-lg font-bold text-red-200">-{formatMZN(totalExpense)}</p>
            </div>
            <div>
              <p className="text-primary-200 text-2xs uppercase">Sobrou</p>
              <p className={`text-lg font-bold ${netSavings >= 0 ? "text-white" : "text-red-200"}`}>
                {netSavings >= 0 ? "+" : ""}{formatMZN(netSavings)}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 -mt-2 space-y-5">
        {loading ? (
          <div className="space-y-4 pt-4">
            <div className="h-32 bg-white rounded-2xl animate-pulse" />
            <div className="h-56 bg-white rounded-2xl animate-pulse" />
          </div>
        ) : allTx.length === 0 ? (
          <div className="card p-10 text-center mt-4">
            <div className="text-4xl mb-3">&#x1F4CA;</div>
            <p className="text-sm text-gray-500 mb-1">Sem dados para este m&ecirc;s</p>
            <p className="text-xs text-gray-400">Importa transa&ccedil;&otilde;es para ver os teus relat&oacute;rios</p>
          </div>
        ) : (
          <>
            {/* Quick insights */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  {savingsRate >= 0 ? (
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    </div>
                  )}
                  <span className="text-xs text-gray-400">Poupan&ccedil;a</span>
                </div>
                <p className={`text-2xl font-bold ${savingsRate >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {savingsRate}%
                </p>
                <p className="text-2xs text-gray-400 mt-0.5">do rendimento</p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs text-gray-400">Transa&ccedil;&otilde;es</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{txCount}</p>
                <p className="text-2xs text-gray-400 mt-0.5">este m&ecirc;s</p>
              </div>
            </div>

            {/* Where money goes - Pie chart */}
            {categoryData.length > 0 && (
              <div className="card p-5">
                <h2 className="font-bold text-sm text-gray-900 mb-1">Para onde vai o dinheiro</h2>
                <p className="text-xs text-gray-400 mb-4">Despesas por categoria</p>

                <div className="flex items-center gap-4">
                  <div className="w-40 h-40 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                          {categoryData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {categoryData.slice(0, 5).map((cat) => {
                      const pct = totalCategorySpend > 0 ? Math.round((cat.value / totalCategorySpend) * 100) : 0;
                      return (
                        <div key={cat.name}>
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                              <span className="text-xs text-gray-700 truncate max-w-[80px]">{cat.name}</span>
                            </div>
                            <span className="text-xs font-bold text-gray-900">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-4">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                          </div>
                        </div>
                      );
                    })}
                    {categoryData.length > 5 && (
                      <p className="text-2xs text-gray-400 ml-4">+{categoryData.length - 5} categorias</p>
                    )}
                  </div>
                </div>

                {/* Top spender callout */}
                {topCategory && (
                  <div className="mt-4 bg-red-50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: topCategory.color + "20" }}>
                      <ArrowDownRight className="w-4 h-4" style={{ color: topCategory.color }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">
                        Maior gasto: <span style={{ color: topCategory.color }}>{topCategory.name}</span>
                      </p>
                      <p className="text-xs text-gray-500">{formatMZN(topCategory.value)} MZN ({Math.round((topCategory.value / totalCategorySpend) * 100)}% do total)</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Weekly comparison */}
            {weeklyData.length > 0 && (
              <div className="card p-5">
                <h2 className="font-bold text-sm text-gray-900 mb-1">Semana a semana</h2>
                <p className="text-xs text-gray-400 mb-4">Receitas vs despesas por semana</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number, name: string) => [`${formatMZN(value)} MZN`, name === "receitas" ? "Receitas" : "Despesas"]}
                        contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB", fontSize: "12px" }}
                      />
                      <Bar dataKey="receitas" fill="#10B981" radius={[6, 6, 0, 0]} name="Receitas" />
                      <Bar dataKey="despesas" fill="#EF4444" radius={[6, 6, 0, 0]} name="Despesas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                    <span className="text-2xs text-gray-500">Receitas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-red-500 rounded-sm" />
                    <span className="text-2xs text-gray-500">Despesas</span>
                  </div>
                </div>
              </div>
            )}

            {/* All categories list - visual, not table */}
            {categoryData.length > 0 && (
              <div className="card p-5">
                <h2 className="font-bold text-sm text-gray-900 mb-4">Todas as categorias</h2>
                <div className="space-y-3">
                  {categoryData.map((cat, i) => {
                    const pct = totalCategorySpend > 0 ? (cat.value / totalCategorySpend) * 100 : 0;
                    return (
                      <div key={cat.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-300 w-5 text-right">{i + 1}</span>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cat.color}15` }}>
                          <Wallet className="w-4 h-4" style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-800 truncate">{cat.name}</span>
                            <span className="text-xs font-bold text-gray-900">{formatMZN(cat.value)}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Savings summary */}
            <div className={`card p-5 border-l-4 ${netSavings >= 0 ? "border-l-emerald-500" : "border-l-red-500"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${netSavings >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
                  <PiggyBank className={`w-6 h-6 ${netSavings >= 0 ? "text-emerald-600" : "text-red-500"}`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {netSavings >= 0 ? "Poupaste este m\u00EAs!" : "Gastaste mais do que recebeste"}
                  </p>
                  <p className={`text-lg font-bold ${netSavings >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {netSavings >= 0 ? "+" : ""}{formatMZN(netSavings)} MZN
                  </p>
                  {netSavings >= 0 && totalIncome > 0 && (
                    <p className="text-xs text-gray-400">{savingsRate}% do teu rendimento</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
