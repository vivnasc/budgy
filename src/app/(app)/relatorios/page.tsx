"use client";

import { useState, useMemo, useEffect } from "react";
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
  ArrowDownRight,
  PiggyBank,
  Wallet,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Smartphone,
  Banknote,
  ArrowUpRight,
} from "lucide-react";
import { useTransactions, useLatestMonthOffset } from "@/hooks/use-supabase-data";
import type { Transaction } from "@/lib/supabase/types";

const PIE_COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6"];
const INCOME_COLORS = ["#10B981", "#34D399", "#6EE7B7", "#A7F3D0", "#059669", "#047857"];

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

type Slice = { name: string; value: number; color: string };

function groupByCategory(transactions: Transaction[], type: "expense" | "income"): Slice[] {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const cat = tx.categories?.name ?? "Outros";
    map.set(cat, (map.get(cat) ?? 0) + tx.amount);
  }
  const palette = type === "income" ? INCOME_COLORS : PIE_COLORS;
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: palette[i % palette.length]! }));
}

function groupByAccount(transactions: Transaction[]): Slice[] {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const acc = tx.accounts?.name ?? "Sem conta";
    map.set(acc, (map.get(acc) ?? 0) + tx.amount);
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

function diffPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function accountIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("mpesa") || n.includes("m-pesa") || n.includes("emola")) return Smartphone;
  if (n.includes("dinheiro") || n.includes("cash") || n.includes("wallet")) return Banknote;
  return Landmark;
}

function DonutChart({ data, total, label }: { data: Slice[]; total: number; label: string }) {
  return (
    <div className="relative w-44 h-44 flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={82}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-2xs uppercase tracking-wider text-gray-500">{label}</p>
        <p className="text-base font-bold text-gray-900 leading-none mt-1">{formatMZN(total)}</p>
        <p className="text-2xs text-gray-400 mt-0.5">MZN</p>
      </div>
    </div>
  );
}

function Legend({ data, total, max = 5 }: { data: Slice[]; total: number; max?: number }) {
  return (
    <div className="flex-1 space-y-2 min-w-0">
      {data.slice(0, max).map((cat) => {
        const pct = total > 0 ? Math.round((cat.value / total) * 100) : 0;
        return (
          <div key={cat.name}>
            <div className="flex items-center justify-between mb-0.5 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-xs text-gray-700 truncate">{cat.name}</span>
              </div>
              <span className="text-xs font-bold text-gray-900 flex-shrink-0">{pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-4">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
            </div>
          </div>
        );
      })}
      {data.length > max && (
        <p className="text-2xs text-gray-400 ml-4">+{data.length - max} mais</p>
      )}
    </div>
  );
}

export default function RelatoriosPage() {
  const latestOffset = useLatestMonthOffset();
  const [monthOffset, setMonthOffset] = useState<number | null>(null);

  useEffect(() => {
    if (monthOffset === null && latestOffset !== null) setMonthOffset(latestOffset);
  }, [latestOffset, monthOffset]);

  const effectiveOffset = monthOffset ?? 0;
  const { from, to, label: currentMonth } = useMemo(() => getMonthDates(effectiveOffset), [effectiveOffset]);
  const { from: prevFrom, to: prevTo } = useMemo(() => getMonthDates(effectiveOffset - 1), [effectiveOffset]);

  const { data: transactions, loading } = useTransactions({ from, to, limit: 5000 });
  const { data: prevTransactions } = useTransactions({ from: prevFrom, to: prevTo, limit: 5000 });

  // Ajustes de saldo são apenas calibração contabilística — não devem
  // entrar nos totais nem nos pies de "para onde vai o dinheiro"
  const isAdjustment = (t: Transaction) => t.categories?.name === "Ajuste de Saldo";
  const allTx = (transactions ?? []).filter((t) => !isAdjustment(t));
  const prevTx = (prevTransactions ?? []).filter((t) => !isAdjustment(t));

  const totalIncome = allTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = allTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  const prevExpense = prevTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const prevIncome = prevTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenseDelta = diffPercent(totalExpense, prevExpense);
  const incomeDelta = diffPercent(totalIncome, prevIncome);

  const expenseByCategory = useMemo(() => groupByCategory(allTx, "expense"), [allTx]);
  const incomeByCategory = useMemo(() => groupByCategory(allTx, "income"), [allTx]);
  const expenseByAccount = useMemo(() => groupByAccount(allTx), [allTx]);
  const weeklyData = useMemo(() => groupByWeek(allTx), [allTx]);
  const totalCategorySpend = expenseByCategory.reduce((s, c) => s + c.value, 0);

  // Top category insight com comparação ao mês anterior
  const topCategory = expenseByCategory[0];
  const prevExpenseByCategory = useMemo(() => groupByCategory(prevTx, "expense"), [prevTx]);
  const topCategoryDelta = useMemo(() => {
    if (!topCategory) return null;
    const prev = prevExpenseByCategory.find((c) => c.name === topCategory.name);
    if (!prev) return null;
    return diffPercent(topCategory.value, prev.value);
  }, [topCategory, prevExpenseByCategory]);

  const txCount = allTx.length;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-600/90 to-teal-700/90 backdrop-blur-xl text-white px-4 pt-6 pb-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Relat&oacute;rios</h1>
          <Calendar className="w-4 h-4 text-emerald-200" />
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-center gap-4 mb-5">
          <button onClick={() => setMonthOffset((m) => (m ?? 0) - 1)} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[160px] text-center capitalize">{currentMonth}</span>
          <button onClick={() => setMonthOffset((m) => Math.min((m ?? 0) + 1, 0))} disabled={effectiveOffset >= 0} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 flex items-center justify-center transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Big numbers */}
        <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-emerald-100 text-2xs uppercase tracking-wide">Entrou</p>
              <p className="text-lg font-bold text-emerald-200">+{formatMZN(totalIncome)}</p>
              {incomeDelta !== null && (
                <p className="text-2xs text-emerald-100 mt-0.5">
                  {incomeDelta >= 0 ? "+" : ""}{incomeDelta}% vs m&ecirc;s ant.
                </p>
              )}
            </div>
            <div>
              <p className="text-emerald-100 text-2xs uppercase tracking-wide">Saiu</p>
              <p className="text-lg font-bold text-red-200">-{formatMZN(totalExpense)}</p>
              {expenseDelta !== null && (
                <p className="text-2xs text-emerald-100 mt-0.5">
                  {expenseDelta >= 0 ? "+" : ""}{expenseDelta}% vs m&ecirc;s ant.
                </p>
              )}
            </div>
            <div>
              <p className="text-emerald-100 text-2xs uppercase tracking-wide">Sobrou</p>
              <p className={`text-lg font-bold ${netSavings >= 0 ? "text-white" : "text-red-200"}`}>
                {netSavings >= 0 ? "+" : ""}{formatMZN(netSavings)}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-1 pt-5 space-y-5">
        {loading ? (
          <div className="space-y-4">
            <div className="h-32 bg-white rounded-2xl animate-pulse" />
            <div className="h-56 bg-white rounded-2xl animate-pulse" />
            <div className="h-56 bg-white rounded-2xl animate-pulse" />
          </div>
        ) : allTx.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">&#x1F4CA;</div>
            <p className="text-sm text-gray-500 mb-1">Sem dados para este m&ecirc;s</p>
            <p className="text-xs text-gray-400">Importa transa&ccedil;&otilde;es para ver os teus relat&oacute;rios</p>
          </div>
        ) : (
          <>
            {/* Quick insights */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
                <p className={`text-2xl font-bold ${savingsRate >= 0 ? "text-emerald-500" : "text-red-500"}`}>
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

              {topCategory && (
                <div className="card p-4 col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${topCategory.color}20` }}>
                      <ArrowDownRight className="w-4 h-4" style={{ color: topCategory.color }} />
                    </div>
                    <span className="text-xs text-gray-400">Maior gasto</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 truncate">{topCategory.name}</p>
                  <p className="text-2xs text-gray-400 mt-0.5">
                    {formatMZN(topCategory.value)} MZN
                    {topCategoryDelta !== null && (
                      <span className={`ml-1 ${topCategoryDelta > 0 ? "text-red-400" : "text-emerald-500"}`}>
                        ({topCategoryDelta >= 0 ? "+" : ""}{topCategoryDelta}%)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Insight callout */}
            {topCategory && topCategoryDelta !== null && Math.abs(topCategoryDelta) >= 15 && (
              <div className={`rounded-2xl p-4 flex items-start gap-3 ${topCategoryDelta > 0 ? "bg-red-500/10 border border-red-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
                {topCategoryDelta > 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {topCategoryDelta > 0
                      ? `Gastaste ${topCategoryDelta}% mais em ${topCategory.name} este mês`
                      : `Boa! Gastaste ${Math.abs(topCategoryDelta)}% menos em ${topCategory.name}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Comparado com o m&ecirc;s passado ({formatMZN(prevExpenseByCategory.find((c) => c.name === topCategory.name)?.value ?? 0)} MZN)
                  </p>
                </div>
              </div>
            )}

            {/* Donut: Despesas por categoria */}
            {expenseByCategory.length > 0 && (
              <div className="card p-5">
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-sm text-gray-900">Para onde vai o dinheiro</h2>
                    <p className="text-xs text-gray-400">Despesas por categoria</p>
                  </div>
                  <span className="text-2xs text-gray-400">{expenseByCategory.length} categorias</span>
                </div>
                <div className="flex items-center gap-4 flex-wrap lg:flex-nowrap">
                  <DonutChart data={expenseByCategory} total={totalExpense} label="Total" />
                  <Legend data={expenseByCategory} total={totalCategorySpend} />
                </div>
              </div>
            )}

            {/* Donut: Despesas por conta */}
            {expenseByAccount.length > 0 && (
              <div className="card p-5">
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-sm text-gray-900">Por onde sai o dinheiro</h2>
                    <p className="text-xs text-gray-400">Despesas por conta</p>
                  </div>
                  <span className="text-2xs text-gray-400">{expenseByAccount.length} contas</span>
                </div>
                <div className="flex items-center gap-4 flex-wrap lg:flex-nowrap">
                  <DonutChart data={expenseByAccount} total={totalExpense} label="Total" />
                  <div className="flex-1 space-y-2 min-w-0">
                    {expenseByAccount.map((acc) => {
                      const Icon = accountIcon(acc.name);
                      const pct = totalExpense > 0 ? Math.round((acc.value / totalExpense) * 100) : 0;
                      return (
                        <div key={acc.name} className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${acc.color}25` }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: acc.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5 gap-2">
                              <span className="text-xs font-medium text-gray-700 truncate">{acc.name}</span>
                              <span className="text-xs font-bold text-gray-900 flex-shrink-0">{pct}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: acc.color }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Donut: Receitas por categoria */}
            {incomeByCategory.length > 0 && (
              <div className="card p-5">
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-sm text-gray-900">De onde vem o dinheiro</h2>
                    <p className="text-xs text-gray-400">Receitas por categoria</p>
                  </div>
                  <span className="text-2xs text-gray-400">{incomeByCategory.length} fontes</span>
                </div>
                <div className="flex items-center gap-4 flex-wrap lg:flex-nowrap">
                  <DonutChart data={incomeByCategory} total={totalIncome} label="Total" />
                  <Legend data={incomeByCategory} total={totalIncome} />
                </div>
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
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number, name: string) => [`${formatMZN(value)} MZN`, name === "receitas" ? "Receitas" : "Despesas"]}
                        contentStyle={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", background: "rgba(15, 23, 42, 0.95)", color: "#F1F5F9" }}
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
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

            {/* Todas as categorias */}
            {expenseByCategory.length > 0 && (
              <div className="card p-5">
                <h2 className="font-bold text-sm text-gray-900 mb-4">Todas as categorias</h2>
                <div className="space-y-3">
                  {expenseByCategory.map((cat, i) => {
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
                    {netSavings >= 0 ? "Poupaste este mês!" : "Gastaste mais do que recebeste"}
                  </p>
                  <p className={`text-lg font-bold ${netSavings >= 0 ? "text-emerald-500" : "text-red-500"}`}>
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
