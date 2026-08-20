"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Repeat,
  Wallet,
  CalendarClock,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Upload,
} from "lucide-react";
import { useTransactions, useLatestMonthOffset } from "@/hooks/use-supabase-data";
import { signatureFor } from "@/lib/learned-rules";
import type { Transaction } from "@/lib/supabase/types";

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatMZN(value: number): string {
  return Math.round(value).toLocaleString("pt-MZ", { maximumFractionDigits: 0 });
}

/** YYYY-MM do mês a `offset` meses do mês actual. */
function monthKeyForOffset(offset: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelForOffset(offset: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return d.toLocaleDateString("pt-MZ", { month: "long", year: "numeric" });
}

/** Início (dia 1) e fim (último dia) do mês a `offset` meses, em YYYY-MM-DD. */
function monthBounds(offset: number): { from: string; to: string } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return { from, to };
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function diffPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Movimento contável para análise: exclui transferências, cancelados e ajustes. */
function isSpendable(tx: Transaction): boolean {
  if (tx.type === "transfer") return false;
  if (tx.status === "cancelled") return false;
  if (tx.categories?.name === "Ajuste de Saldo") return false;
  return true;
}

const WINDOW_MONTHS = 12;

// ─── Tipos do resultado da análise ─────────────────────────────────────────

interface RecurringGroup {
  sig: string;
  label: string;
  category: string;
  monthly: number; // valor representativo/mês (mediana dos totais mensais)
  months: number; // nº de meses distintos em que aparece
}

interface CategorySlice {
  name: string;
  value: number;
  pct: number;
}

interface Suggestion {
  tone: "good" | "bad" | "info";
  text: string;
}

interface Analysis {
  hasData: boolean;
  currentLabel: string;
  prevLabel: string;
  hasPrev: boolean;
  entradas: number;
  saidas: number;
  poupanca: number;
  taxaPoupanca: number;
  entradasDelta: number | null;
  saidasDelta: number | null;
  recurring: RecurringGroup[];
  totalFixo: number;
  topCategories: CategorySlice[];
  totalSpendMonth: number;
  variavelMedia: number;
  previsao: number;
  suggestions: Suggestion[];
}

function computeAnalysis(
  txs: Transaction[],
  currentKey: string,
  prevKey: string,
  currentLabel: string,
  prevLabel: string
): Analysis {
  const spendable = txs.filter(isSpendable);

  if (spendable.length === 0) {
    return {
      hasData: false,
      currentLabel,
      prevLabel,
      hasPrev: false,
      entradas: 0,
      saidas: 0,
      poupanca: 0,
      taxaPoupanca: 0,
      entradasDelta: null,
      saidasDelta: null,
      recurring: [],
      totalFixo: 0,
      topCategories: [],
      totalSpendMonth: 0,
      variavelMedia: 0,
      previsao: 0,
      suggestions: [],
    };
  }

  const keyOf = (tx: Transaction) => tx.date.slice(0, 7);
  const expenses = spendable.filter((t) => t.type === "expense");
  const incomes = spendable.filter((t) => t.type === "income");

  // ── 1. Resumo do mês atual + comparação ────────────────────────────────
  const curExpenses = expenses.filter((t) => keyOf(t) === currentKey);
  const curIncomes = incomes.filter((t) => keyOf(t) === currentKey);
  const prevExpenses = expenses.filter((t) => keyOf(t) === prevKey);
  const prevIncomes = incomes.filter((t) => keyOf(t) === prevKey);

  const entradas = curIncomes.reduce((s, t) => s + Math.abs(t.amount), 0);
  const saidas = curExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const poupanca = entradas - saidas;
  const taxaPoupanca = entradas > 0 ? Math.round((poupanca / entradas) * 100) : 0;

  const prevEntradas = prevIncomes.reduce((s, t) => s + Math.abs(t.amount), 0);
  const prevSaidas = prevExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const hasPrev = prevExpenses.length > 0 || prevIncomes.length > 0;
  const entradasDelta = hasPrev ? diffPercent(entradas, prevEntradas) : null;
  const saidasDelta = hasPrev ? diffPercent(saidas, prevSaidas) : null;

  // ── 2. Despesas fixas / recorrentes detectadas ─────────────────────────
  // Agrupa despesas pela assinatura estável do beneficiário/comerciante.
  interface Bucket {
    monthTotals: Map<string, number>; // YYYY-MM -> soma abs
    descCount: Map<string, number>;
    catCount: Map<string, number>;
  }
  const buckets = new Map<string, Bucket>();
  for (const t of expenses) {
    const sig = signatureFor(t.description ?? "");
    if (!sig) continue;
    let b = buckets.get(sig);
    if (!b) {
      b = { monthTotals: new Map(), descCount: new Map(), catCount: new Map() };
      buckets.set(sig, b);
    }
    const mk = keyOf(t);
    b.monthTotals.set(mk, (b.monthTotals.get(mk) ?? 0) + Math.abs(t.amount));
    const desc = (t.description ?? "").trim();
    if (desc) b.descCount.set(desc, (b.descCount.get(desc) ?? 0) + 1);
    const cat = t.categories?.name ?? "Outros";
    b.catCount.set(cat, (b.catCount.get(cat) ?? 0) + 1);
  }

  const recurringSigs = new Set<string>();
  const recurring: RecurringGroup[] = [];
  for (const [sig, b] of buckets.entries()) {
    if (b.monthTotals.size < 2) continue; // recorrente = >= 2 meses distintos
    recurringSigs.add(sig);
    const monthly = median(Array.from(b.monthTotals.values()));
    const label = mostCommon(b.descCount) ?? mostCommon(b.catCount) ?? sig;
    const category = mostCommon(b.catCount) ?? "Outros";
    recurring.push({ sig, label, category, monthly, months: b.monthTotals.size });
  }
  recurring.sort((a, b) => b.monthly - a.monthly);
  const totalFixo = recurring.reduce((s, r) => s + r.monthly, 0);

  // ── 3. Para onde vai o dinheiro (top categorias do mês) ────────────────
  const catMap = new Map<string, number>();
  for (const t of curExpenses) {
    const cat = t.categories?.name ?? "Outros";
    catMap.set(cat, (catMap.get(cat) ?? 0) + Math.abs(t.amount));
  }
  const totalSpendMonth = Array.from(catMap.values()).reduce((s, v) => s + v, 0);
  const topCategories: CategorySlice[] = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      pct: totalSpendMonth > 0 ? Math.round((value / totalSpendMonth) * 100) : 0,
    }));

  // ── 4. Previsão do próximo mês ─────────────────────────────────────────
  // variável = despesas que NÃO pertencem a um grupo recorrente.
  // média mensal calculada sobre os meses presentes nos dados.
  const monthsPresent = new Set(expenses.map(keyOf));
  const nMonths = Math.max(monthsPresent.size, 1);
  let variavelTotal = 0;
  for (const t of expenses) {
    const sig = signatureFor(t.description ?? "");
    if (sig && recurringSigs.has(sig)) continue;
    variavelTotal += Math.abs(t.amount);
  }
  const variavelMedia = variavelTotal / nMonths;
  const previsao = totalFixo + variavelMedia;

  // ── 5. Sugestões (factuais, calculadas) ────────────────────────────────
  const suggestions: Suggestion[] = [];

  const subsMensal = recurring
    .filter((r) => r.category.toLowerCase().includes("subscri"))
    .reduce((s, r) => s + r.monthly, 0);
  if (subsMensal > 0) {
    suggestions.push({
      tone: "info",
      text: `Subscrições: cerca de ${formatMZN(subsMensal)} MZN por mês em serviços recorrentes.`,
    });
  }

  const top = topCategories[0];
  if (top && top.value > 0) {
    suggestions.push({
      tone: "info",
      text: `Onde mais gastas: ${top.name} (${formatMZN(top.value)} MZN, ${top.pct}% do mês).`,
    });
  }

  if (entradas > 0 && taxaPoupanca >= 20) {
    suggestions.push({
      tone: "good",
      text: `Boa! Poupaste ${taxaPoupanca}% do que entrou este mês. Continua assim.`,
    });
  } else if (poupanca < 0) {
    suggestions.push({
      tone: "bad",
      text: `Atenção: gastaste ${formatMZN(Math.abs(poupanca))} MZN a mais do que entrou este mês.`,
    });
  }

  // Categoria que subiu > 30% vs mês anterior.
  if (hasPrev) {
    const prevCatMap = new Map<string, number>();
    for (const t of prevExpenses) {
      const cat = t.categories?.name ?? "Outros";
      prevCatMap.set(cat, (prevCatMap.get(cat) ?? 0) + Math.abs(t.amount));
    }
    let biggestJump: { name: string; pct: number } | null = null;
    for (const c of topCategories) {
      const prevVal = prevCatMap.get(c.name) ?? 0;
      const pct = diffPercent(c.value, prevVal);
      if (pct !== null && pct > 30 && (!biggestJump || pct > biggestJump.pct)) {
        biggestJump = { name: c.name, pct };
      }
    }
    if (biggestJump) {
      suggestions.push({
        tone: "bad",
        text: `${biggestJump.name} subiu ${biggestJump.pct}% face ao mês passado.`,
      });
    }
  }

  return {
    hasData: true,
    currentLabel,
    prevLabel,
    hasPrev,
    entradas,
    saidas,
    poupanca,
    taxaPoupanca,
    entradasDelta,
    saidasDelta,
    recurring,
    totalFixo,
    topCategories,
    totalSpendMonth,
    variavelMedia,
    previsao,
    suggestions: suggestions.slice(0, 4),
  };
}

function mostCommon(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestN = -1;
  for (const [k, n] of counts.entries()) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function AnalisePage() {
  const latestOffset = useLatestMonthOffset();
  const effectiveOffset = latestOffset ?? 0;

  // Janela ampla (12 meses) ancorada no mês com dados mais recentes,
  // para conseguir detectar recorrências e médias mensais.
  const { from, to } = useMemo(() => {
    const start = monthBounds(effectiveOffset - (WINDOW_MONTHS - 1));
    const end = monthBounds(effectiveOffset);
    return { from: start.from, to: end.to };
  }, [effectiveOffset]);

  const { data: transactions, loading } = useTransactions({ from, to, limit: 5000 });

  const currentKey = useMemo(() => monthKeyForOffset(effectiveOffset), [effectiveOffset]);
  const prevKey = useMemo(() => monthKeyForOffset(effectiveOffset - 1), [effectiveOffset]);
  const currentLabel = useMemo(() => monthLabelForOffset(effectiveOffset), [effectiveOffset]);
  const prevLabel = useMemo(() => monthLabelForOffset(effectiveOffset - 1), [effectiveOffset]);

  const analysis = useMemo(
    () => computeAnalysis(transactions ?? [], currentKey, prevKey, currentLabel, prevLabel),
    [transactions, currentKey, prevKey, currentLabel, prevLabel]
  );

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-600/90 to-teal-700/90 backdrop-blur-xl text-white px-4 pt-6 pb-6 rounded-2xl">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold">An&aacute;lise</h1>
          <Sparkles className="w-5 h-5 text-emerald-200" />
        </div>
        <p className="text-xs text-emerald-100/90 capitalize">{analysis.currentLabel}</p>
      </header>

      <main className="px-1 pt-5 space-y-5">
        {loading ? (
          <div className="space-y-4">
            <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
            <div className="h-56 bg-white/5 rounded-2xl animate-pulse" />
            <div className="h-40 bg-white/5 rounded-2xl animate-pulse" />
          </div>
        ) : !analysis.hasData ? (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">&#x2728;</div>
            <p className="text-sm text-gray-200 mb-1 font-semibold">Ainda sem dados para analisar</p>
            <p className="text-xs text-gray-400 mb-5">
              Importa as tuas transa&ccedil;&otilde;es e a BUDGY mostra-te para onde vai o dinheiro,
              as tuas despesas fixas e uma previs&atilde;o do pr&oacute;ximo m&ecirc;s.
            </p>
            <Link
              href="/importar"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
            >
              <Upload className="w-4 h-4" />
              Importar transa&ccedil;&otilde;es
            </Link>
          </div>
        ) : (
          <>
            {/* 1. Resumo do mês */}
            <section className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-8 h-8 bg-emerald-500/15 rounded-lg flex items-center justify-center">
                    <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-xs text-gray-400">Entradas</span>
                </div>
                <p className="text-xl font-bold text-emerald-400">{formatMZN(analysis.entradas)}</p>
                {analysis.entradasDelta !== null && (
                  <p className="text-2xs text-gray-500 mt-0.5">
                    {analysis.entradasDelta >= 0 ? "+" : ""}
                    {analysis.entradasDelta}% vs m&ecirc;s ant.
                  </p>
                )}
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-8 h-8 bg-red-500/15 rounded-lg flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4 text-red-400" />
                  </div>
                  <span className="text-xs text-gray-400">Sa&iacute;das</span>
                </div>
                <p className="text-xl font-bold text-red-400">{formatMZN(analysis.saidas)}</p>
                {analysis.saidasDelta !== null && (
                  <p className="text-2xs text-gray-500 mt-0.5">
                    {analysis.saidasDelta >= 0 ? "+" : ""}
                    {analysis.saidasDelta}% vs m&ecirc;s ant.
                  </p>
                )}
              </div>

              <div className="card p-4 col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                        analysis.poupanca >= 0 ? "bg-emerald-500/15" : "bg-red-500/15"
                      }`}
                    >
                      <PiggyBank
                        className={`w-5 h-5 ${analysis.poupanca >= 0 ? "text-emerald-400" : "text-red-400"}`}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Poupan&ccedil;a este m&ecirc;s</p>
                      <p
                        className={`text-lg font-bold ${
                          analysis.poupanca >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {analysis.poupanca >= 0 ? "+" : ""}
                        {formatMZN(analysis.poupanca)} MZN
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xs text-gray-500 uppercase tracking-wide">Taxa</p>
                    <p
                      className={`text-2xl font-bold ${
                        analysis.taxaPoupanca >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {analysis.taxaPoupanca}%
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. Previsão do próximo mês */}
            <section className="card p-5 border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock className="w-4 h-4 text-emerald-400" />
                <h2 className="font-bold text-sm text-gray-100">Previs&atilde;o do pr&oacute;ximo m&ecirc;s</h2>
              </div>
              <p className="text-2xl font-bold text-gray-100">
                &asymp; {formatMZN(analysis.previsao)} <span className="text-sm font-medium text-gray-400">MZN</span>
              </p>
              <p className="text-xs text-gray-400 mt-1.5">
                Se manteres os h&aacute;bitos, o pr&oacute;ximo m&ecirc;s deve rondar este valor.
                <br />
                <span className="text-2xs text-gray-500">
                  Fixo {formatMZN(analysis.totalFixo)} + vari&aacute;vel m&eacute;dio {formatMZN(analysis.variavelMedia)}. Estimativa.
                </span>
              </p>
            </section>

            {/* 2. Despesas fixas detectadas */}
            <section className="card p-5">
              <div className="flex items-baseline justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h2 className="font-bold text-sm text-gray-100">Despesas fixas detectadas</h2>
                    <p className="text-xs text-gray-400">Recorrentes (2+ meses), sem inseri&shy;res nada</p>
                  </div>
                </div>
              </div>

              {analysis.recurring.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">
                  Ainda n&atilde;o h&aacute; despesas recorrentes suficientes para detectar padr&otilde;es.
                </p>
              ) : (
                <>
                  <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-white/10">
                    <span className="text-xs text-gray-400">Total fixo / m&ecirc;s</span>
                    <span className="text-lg font-bold text-emerald-400">
                      {formatMZN(analysis.totalFixo)} MZN
                    </span>
                  </div>
                  <ul className="space-y-2.5">
                    {analysis.recurring.slice(0, 12).map((r) => (
                      <li key={r.sig} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Repeat className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-200 truncate capitalize">
                            {r.label.toLowerCase()}
                          </p>
                          <p className="text-2xs text-gray-500">
                            {r.category} &middot; {r.months} meses
                          </p>
                        </div>
                        <span className="text-sm font-bold text-gray-100 flex-shrink-0">
                          {formatMZN(r.monthly)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {analysis.recurring.length > 12 && (
                    <p className="text-2xs text-gray-500 mt-3 text-center">
                      +{analysis.recurring.length - 12} outras recorr&ecirc;ncias
                    </p>
                  )}
                </>
              )}
            </section>

            {/* 3. Para onde vai o dinheiro */}
            <section className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <div>
                  <h2 className="font-bold text-sm text-gray-100">Para onde vai o dinheiro</h2>
                  <p className="text-xs text-gray-400">Top categorias deste m&ecirc;s</p>
                </div>
              </div>

              {analysis.topCategories.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">Sem despesas este m&ecirc;s.</p>
              ) : (
                <div className="space-y-3">
                  {analysis.topCategories.slice(0, 6).map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-500 w-4 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className="text-xs font-medium text-gray-200 truncate">{c.name}</span>
                          <span className="text-xs font-bold text-gray-100 flex-shrink-0">
                            {formatMZN(c.value)} <span className="text-gray-500 font-normal">({c.pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                            style={{ width: `${c.pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 5. Sugestões */}
            {analysis.suggestions.length > 0 && (
              <section className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <h2 className="font-bold text-sm text-gray-100">Sugest&otilde;es</h2>
                </div>
                <ul className="space-y-2.5">
                  {analysis.suggestions.map((s, i) => {
                    const Icon =
                      s.tone === "good" ? TrendingUp : s.tone === "bad" ? TrendingDown : Sparkles;
                    const color =
                      s.tone === "good"
                        ? "text-emerald-400"
                        : s.tone === "bad"
                          ? "text-red-400"
                          : "text-gray-400";
                    return (
                      <li key={i} className="flex items-start gap-2.5">
                        <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${color}`} />
                        <span className="text-xs text-gray-300 leading-relaxed">{s.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <p className="text-2xs text-gray-600 text-center px-4">
              An&aacute;lise calculada a partir das tuas transa&ccedil;&otilde;es importadas. Transfer&ecirc;ncias entre
              contas pr&oacute;prias s&atilde;o exclu&iacute;das.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
