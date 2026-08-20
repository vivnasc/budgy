"use client";

import { useMemo, useState } from "react";
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
  BarChart3,
  ChevronDown,
  ShoppingBag,
} from "lucide-react";
import { useTransactions, useLatestTransactionDate } from "@/hooks/use-supabase-data";
import { signatureFor } from "@/lib/learned-rules";
import type { Transaction } from "@/lib/supabase/types";
import {
  cycleKeyFor,
  cycleLabel,
  cycleShortLabel,
  cycleRangeFor,
  currentCycleStart,
  shiftCycle,
} from "@/lib/period";
import { CicloSettings, useCycleStartDay } from "@/components/ciclo-settings";

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatMZN(value: number): string {
  return Math.round(value).toLocaleString("pt-MZ", { maximumFractionDigits: 0 });
}

/** Data curta (ex: "05 jan") a partir de YYYY-MM-DD. */
function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d
    .toLocaleDateString("pt-MZ", { day: "2-digit", month: "short" })
    .replace(".", "");
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Coeficiente de variação (desvio-padrão / média) de uma série. */
function coefVariation(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((s, n) => s + n, 0) / nums.length;
  if (mean <= 0) return Infinity;
  const variance =
    nums.reduce((s, n) => s + (n - mean) * (n - mean), 0) / nums.length;
  return Math.sqrt(variance) / mean;
}

function diffPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Limpa a descrição para leitura humana (remove máscaras de cartão, espaços a mais). */
function cleanDesc(desc: string | null): string {
  if (!desc) return "";
  return desc
    .replace(/\d{6}\*+\d{4}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Movimento contável para análise: exclui transferências, cancelados e ajustes. */
function isSpendable(tx: Transaction): boolean {
  if (tx.type === "transfer") return false;
  if (tx.status === "cancelled") return false;
  if (tx.categories?.name === "Ajuste de Saldo") return false;
  return true;
}

const WINDOW_MONTHS = 12;

// Grupo estável = obrigação fixa real: os totais mensais quase não variam.
// Acima deste coeficiente de variação (desvio/média) tratamos como "frequente"
// (valor que varia — ex: supermercado, Shein), não como fixo.
const STABLE_CV_MAX = 0.35;

// Um único movimento cujo valor absoluto seja maior que 5× a mediana de todos
// os movimentos é um gasto pontual (ex: obra de 3,66M) e NÃO deve entrar na
// média do variável nem disparar alertas de "categoria disparou".
const OUTLIER_FACTOR = 5;

// ─── Tipos do resultado da análise ─────────────────────────────────────────

interface DrillTx {
  id: string;
  date: string;
  desc: string;
  amount: number; // abs
}

interface RecurringGroup {
  sig: string;
  label: string;
  category: string;
  monthly: number; // valor representativo/mês (mediana dos totais mensais)
  months: number; // nº de meses distintos em que aparece
  stable: boolean; // true = fixo real; false = frequente (valor varia)
  isAggregator: boolean; // true = agregador tipo PayPal (mistura beneficiários)
  txs: DrillTx[];
}

interface CategorySlice {
  name: string;
  value: number;
  pct: number;
  txs: DrillTx[];
}

interface TrendPoint {
  key: string;
  label: string;
  total: number;
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
  fixas: RecurringGroup[]; // recorrentes estáveis (obrigações fixas)
  frequentes: RecurringGroup[]; // recorrentes mas com valor variável
  totalFixo: number; // soma das fixas estáveis (mediana/mês)
  topCategories: CategorySlice[];
  totalSpendMonth: number;
  variavelMensal: number; // mediana dos totais variáveis mensais (robusta)
  previsao: number;
  trend: TrendPoint[];
  trendRead: string;
  trendTone: "good" | "bad" | "info";
  suggestions: Suggestion[];
}

function emptyAnalysis(currentLabel: string, prevLabel: string): Analysis {
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
    fixas: [],
    frequentes: [],
    totalFixo: 0,
    topCategories: [],
    totalSpendMonth: 0,
    variavelMensal: 0,
    previsao: 0,
    trend: [],
    trendRead: "",
    trendTone: "info",
    suggestions: [],
  };
}

function computeAnalysis(
  txs: Transaction[],
  currentKey: string,
  prevKey: string,
  currentLabel: string,
  prevLabel: string,
  startDay: number
): Analysis {
  const spendable = txs.filter(isSpendable);
  if (spendable.length === 0) return emptyAnalysis(currentLabel, prevLabel);

  // Chave = ciclo de salário (não mês do calendário). Com startDay=1 é idêntico
  // ao mês. currentKey/prevKey são inícios de ciclo (YYYY-MM-DD).
  const keyOf = (tx: Transaction) => cycleKeyFor(tx.date, startDay);
  const pw = startDay === 1 ? "mês" : "ciclo"; // palavra do período nas sugestões
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

  // ── 2. Recorrências: agrupa despesas pela assinatura do beneficiário ────
  interface Bucket {
    monthTotals: Map<string, number>; // YYYY-MM -> soma abs
    descCount: Map<string, number>;
    catCount: Map<string, number>;
    txs: DrillTx[];
  }
  const buckets = new Map<string, Bucket>();
  for (const t of expenses) {
    const sig = signatureFor(t.description ?? "");
    if (!sig) continue;
    let b = buckets.get(sig);
    if (!b) {
      b = { monthTotals: new Map(), descCount: new Map(), catCount: new Map(), txs: [] };
      buckets.set(sig, b);
    }
    const mk = keyOf(t);
    b.monthTotals.set(mk, (b.monthTotals.get(mk) ?? 0) + Math.abs(t.amount));
    const desc = (t.description ?? "").trim();
    if (desc) b.descCount.set(desc, (b.descCount.get(desc) ?? 0) + 1);
    const cat = t.categories?.name ?? "Outros";
    b.catCount.set(cat, (b.catCount.get(cat) ?? 0) + 1);
    b.txs.push({ id: t.id, date: t.date, desc: cleanDesc(t.description) || cat, amount: Math.abs(t.amount) });
  }

  const stableSigs = new Set<string>();
  const fixas: RecurringGroup[] = [];
  const frequentes: RecurringGroup[] = [];
  for (const [sig, b] of buckets.entries()) {
    if (b.monthTotals.size < 2) continue; // recorrente = aparece em >= 2 meses
    const monthlyTotals = Array.from(b.monthTotals.values());
    const monthly = median(monthlyTotals);
    const label = mostCommon(b.descCount) ?? mostCommon(b.catCount) ?? sig;
    const category = mostCommon(b.catCount) ?? "Outros";
    const isAggregator = /paypal/i.test(label) || /paypal/i.test(sig);
    // Estável = valor mensal consistente (CV baixo) e não é um agregador tipo PayPal.
    const stable = !isAggregator && coefVariation(monthlyTotals) <= STABLE_CV_MAX;
    const txs = [...b.txs].sort((a, c) => (a.date < c.date ? 1 : -1));
    const group: RecurringGroup = { sig, label, category, monthly, months: b.monthTotals.size, stable, isAggregator, txs };
    if (stable) {
      stableSigs.add(sig);
      fixas.push(group);
    } else {
      frequentes.push(group);
    }
  }
  fixas.sort((a, b) => b.monthly - a.monthly);
  frequentes.sort((a, b) => b.monthly - a.monthly);
  // Total fixo = só as obrigações estáveis, pela mediana mensal de cada uma.
  const totalFixo = fixas.reduce((s, r) => s + r.monthly, 0);

  // ── 3. Para onde vai o dinheiro (top categorias do mês) ────────────────
  const catMap = new Map<string, number>();
  const catTxs = new Map<string, DrillTx[]>();
  for (const t of curExpenses) {
    const cat = t.categories?.name ?? "Outros";
    catMap.set(cat, (catMap.get(cat) ?? 0) + Math.abs(t.amount));
    const list = catTxs.get(cat) ?? [];
    list.push({ id: t.id, date: t.date, desc: cleanDesc(t.description) || cat, amount: Math.abs(t.amount) });
    catTxs.set(cat, list);
  }
  const totalSpendMonth = Array.from(catMap.values()).reduce((s, v) => s + v, 0);
  const topCategories: CategorySlice[] = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      pct: totalSpendMonth > 0 ? Math.round((value / totalSpendMonth) * 100) : 0,
      txs: (catTxs.get(name) ?? []).sort((a, c) => (a.date < c.date ? 1 : -1)),
    }));

  // ── 4. Previsão robusta do próximo mês ─────────────────────────────────
  // Mediana global do valor de um movimento; serve de referência para apanhar
  // pontuais (obra, compra grande) sem os deixar inflar a média.
  const allAbs = expenses.map((t) => Math.abs(t.amount));
  const medianSingle = median(allAbs);
  const outlierThreshold = medianSingle > 0 ? medianSingle * OUTLIER_FACTOR : Infinity;

  // Total variável por mês = tudo o que NÃO é uma obrigação fixa estável
  // (frequentes variáveis ficam aqui, é onde o seu valor a variar faz sentido),
  // depois de descartar movimentos pontuais acima do limiar de outlier.
  const monthsPresent = Array.from(new Set(expenses.map(keyOf)));
  const variableMonthTotals = new Map<string, number>();
  for (const mk of monthsPresent) variableMonthTotals.set(mk, 0);
  for (const t of expenses) {
    const sig = signatureFor(t.description ?? "");
    if (sig && stableSigs.has(sig)) continue; // já contado no fixo
    const abs = Math.abs(t.amount);
    if (abs > outlierThreshold) continue; // gasto pontual, fora da média
    const mk = keyOf(t);
    variableMonthTotals.set(mk, (variableMonthTotals.get(mk) ?? 0) + abs);
  }
  // MEDIANA (não média) dos totais variáveis mensais → resistente a meses atípicos.
  const variavelMensal = median(Array.from(variableMonthTotals.values()));
  const previsao = totalFixo + variavelMensal;

  // ── 5. Tendência (gasto total por mês, últimos 6 meses presentes) ───────
  const monthSpend = new Map<string, number>();
  for (const t of expenses) {
    const mk = keyOf(t);
    monthSpend.set(mk, (monthSpend.get(mk) ?? 0) + Math.abs(t.amount));
  }
  const orderedMonths = Array.from(monthSpend.keys()).sort();
  const trendKeys = orderedMonths.slice(-6);
  const trend: TrendPoint[] = trendKeys.map((k) => ({
    key: k,
    label: cycleShortLabel(k),
    total: monthSpend.get(k) ?? 0,
  }));

  let trendRead = "";
  let trendTone: "good" | "bad" | "info" = "info";
  if (trend.length >= 2) {
    const half = Math.min(3, Math.floor(trend.length / 2));
    const recent = trend.slice(-half);
    const older = trend.slice(-half * 2, -half);
    const avg = (arr: TrendPoint[]) =>
      arr.length ? arr.reduce((s, p) => s + p.total, 0) / arr.length : 0;
    const recentAvg = avg(recent);
    const olderAvg = avg(older.length ? older : trend.slice(0, -half));
    const change = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;
    if (change > 0.1) {
      trendRead = "Estás a gastar mais nos últimos meses.";
      trendTone = "bad";
    } else if (change < -0.1) {
      trendRead = "Estás a gastar menos nos últimos meses. Boa!";
      trendTone = "good";
    } else {
      trendRead = "Os teus gastos estão estáveis.";
      trendTone = "info";
    }
  }

  // ── 6. Sugestões (factuais, calculadas) ────────────────────────────────
  const suggestions: Suggestion[] = [];

  const subsMensal = fixas
    .filter((r) => r.category.toLowerCase().includes("subscri"))
    .reduce((s, r) => s + r.monthly, 0);
  if (subsMensal > 0) {
    suggestions.push({
      tone: "info",
      text: `Subscrições: cerca de ${formatMZN(subsMensal)} MZN por ${pw} em serviços recorrentes.`,
    });
  }

  const top = topCategories[0];
  if (top && top.value > 0) {
    suggestions.push({
      tone: "info",
      text: `Onde mais gastas: ${top.name} (${formatMZN(top.value)} MZN, ${top.pct}% do ${pw}).`,
    });
  }

  if (entradas > 0 && taxaPoupanca >= 20) {
    suggestions.push({
      tone: "good",
      text: `Boa! Poupaste ${taxaPoupanca}% do que entrou este ${pw}. Continua assim.`,
    });
  } else if (poupanca < 0) {
    suggestions.push({
      tone: "bad",
      text: `Atenção: gastaste ${formatMZN(Math.abs(poupanca))} MZN a mais do que entrou este ${pw}.`,
    });
  }

  // Categoria que subiu > 30% vs mês anterior — mas ignora saltos causados
  // por UM único movimento pontual (> 5× a mediana da categoria).
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
      if (pct === null || pct <= 30) continue;
      // Salto conduzido por um outlier? Compara o maior movimento do mês com a
      // mediana histórica da categoria em toda a janela.
      const catWindowAmounts = expenses
        .filter((t) => (t.categories?.name ?? "Outros") === c.name)
        .map((t) => Math.abs(t.amount));
      const catMedian = median(catWindowAmounts);
      const curMax = Math.max(...c.txs.map((t) => t.amount), 0);
      const drivenByOutlier = catMedian > 0 && curMax > catMedian * OUTLIER_FACTOR;
      if (drivenByOutlier) continue; // pontual, não é hábito — não alerta
      if (!biggestJump || pct > biggestJump.pct) biggestJump = { name: c.name, pct };
    }
    if (biggestJump) {
      suggestions.push({
        tone: "bad",
        text: `${biggestJump.name} subiu ${biggestJump.pct}% face ao ${pw} passado.`,
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
    fixas,
    frequentes,
    totalFixo,
    topCategories,
    totalSpendMonth,
    variavelMensal,
    previsao,
    trend,
    trendRead,
    trendTone,
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

// ─── Sub-componentes ────────────────────────────────────────────────────────

/** Lista de movimentos subjacentes (drill-down), limitada a 30. */
function DrillList({ txs }: { txs: DrillTx[] }) {
  const shown = txs.slice(0, 30);
  const rest = txs.length - shown.length;
  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
      {shown.map((t) => (
        <div key={t.id} className="flex items-center gap-3 text-2xs">
          <span className="text-gray-500 w-12 flex-shrink-0">{shortDate(t.date)}</span>
          <span className="text-gray-300 flex-1 min-w-0 truncate capitalize">
            {t.desc.toLowerCase()}
          </span>
          <span className="text-gray-200 font-medium flex-shrink-0">{formatMZN(t.amount)}</span>
        </div>
      ))}
      {rest > 0 && <p className="text-2xs text-gray-500 text-center pt-1">+{rest} mais</p>}
    </div>
  );
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function AnalisePage() {
  const [startDay, setStartDay] = useCycleStartDay();
  const latestDate = useLatestTransactionDate();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  // Palavra do período: "mês" no calendário normal (dia 1), "ciclo" quando ela
  // desloca o início (ex: salário no dia 20). Mantém o texto igual ao anterior
  // para quem não muda nada.
  const periodWord = startDay === 1 ? "mês" : "ciclo";
  const periodPlural = startDay === 1 ? "meses" : "ciclos";

  // Âncora = data da transação mais recente (mas nunca no futuro). Serve para
  // saber em que ciclo abrir a análise.
  const anchorISO = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return latestDate && latestDate <= today ? latestDate : today;
  }, [latestDate]);

  const currentKey = useMemo(
    () => currentCycleStart(anchorISO, startDay),
    [anchorISO, startDay]
  );
  const prevKey = useMemo(() => shiftCycle(currentKey, -1), [currentKey]);
  const currentLabel = useMemo(() => cycleLabel(currentKey, startDay, true), [currentKey, startDay]);
  const prevLabel = useMemo(() => cycleLabel(prevKey, startDay, true), [prevKey, startDay]);

  // Janela ampla (12 ciclos) ancorada no ciclo actual, para detectar
  // recorrências e medianas por ciclo.
  const { from, to } = useMemo(() => {
    const start = shiftCycle(currentKey, -(WINDOW_MONTHS - 1));
    const end = cycleRangeFor(currentKey, startDay).to;
    return { from: start, to: end };
  }, [currentKey, startDay]);

  const { data: transactions, loading } = useTransactions({ from, to, limit: 5000 });

  const analysis = useMemo(
    () => computeAnalysis(transactions ?? [], currentKey, prevKey, currentLabel, prevLabel, startDay),
    [transactions, currentKey, prevKey, currentLabel, prevLabel, startDay]
  );

  const trendMax = Math.max(...analysis.trend.map((t) => t.total), 1);

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
        <CicloSettings startDay={startDay} onChange={setStartDay} />

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
              as tuas despesas fixas e uma previs&atilde;o do pr&oacute;ximo {periodWord}.
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
                    {analysis.entradasDelta}% vs {periodWord} ant.
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
                    {analysis.saidasDelta}% vs {periodWord} ant.
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
                      <p className="text-xs text-gray-400">Poupan&ccedil;a este {periodWord}</p>
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
                <h2 className="font-bold text-sm text-gray-100">Previs&atilde;o do pr&oacute;ximo {periodWord}</h2>
              </div>
              <p className="text-2xl font-bold text-gray-100">
                &asymp; {formatMZN(analysis.previsao)} <span className="text-sm font-medium text-gray-400">MZN</span>
              </p>
              <p className="text-xs text-gray-400 mt-1.5">
                Se manteres os h&aacute;bitos, o pr&oacute;ximo {periodWord} deve rondar este valor.
                <br />
                <span className="text-2xs text-gray-500">
                  Fixo {formatMZN(analysis.totalFixo)} + vari&aacute;vel {formatMZN(analysis.variavelMensal)} (mediana por {periodWord}, sem gastos pontuais). Estimativa.
                </span>
              </p>
            </section>

            {/* 5. Tendência */}
            {analysis.trend.length >= 2 && (
              <section className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h2 className="font-bold text-sm text-gray-100">Tend&ecirc;ncia</h2>
                    <p className="text-xs text-gray-400">Gasto total por {periodWord}</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {analysis.trend.map((t, i) => {
                    const isLast = i === analysis.trend.length - 1;
                    return (
                      <div key={t.key} className="flex items-center gap-3">
                        <span className="text-2xs text-gray-500 w-8 capitalize flex-shrink-0">{t.label}</span>
                        <div className="flex-1 h-4 bg-white/5 rounded-md overflow-hidden">
                          <div
                            className={`h-full rounded-md transition-all duration-500 ${
                              isLast
                                ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                : "bg-white/15"
                            }`}
                            style={{ width: `${Math.max((t.total / trendMax) * 100, 2)}%` }}
                          />
                        </div>
                        <span className="text-2xs text-gray-300 font-medium w-14 text-right flex-shrink-0">
                          {formatMZN(t.total)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {analysis.trendRead && (
                  <p
                    className={`text-xs mt-4 font-medium ${
                      analysis.trendTone === "good"
                        ? "text-emerald-400"
                        : analysis.trendTone === "bad"
                          ? "text-red-400"
                          : "text-gray-400"
                    }`}
                  >
                    {analysis.trendRead}
                  </p>
                )}
              </section>
            )}

            {/* 2. Despesas fixas detectadas */}
            <section className="card p-5">
              <div className="flex items-baseline justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h2 className="font-bold text-sm text-gray-100">Despesas fixas (est&aacute;veis)</h2>
                    <p className="text-xs text-gray-400">Recorrentes com valor consistente</p>
                  </div>
                </div>
              </div>

              {analysis.fixas.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">
                  Ainda n&atilde;o h&aacute; obriga&ccedil;&otilde;es fixas est&aacute;veis suficientes para detectar.
                </p>
              ) : (
                <>
                  <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-white/10">
                    <span className="text-xs text-gray-400">Total fixo / {periodWord}</span>
                    <span className="text-lg font-bold text-emerald-400">
                      {formatMZN(analysis.totalFixo)} MZN
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {analysis.fixas.slice(0, 12).map((r) => {
                      const id = `fix-${r.sig}`;
                      const isOpen = !!open[id];
                      return (
                        <li key={r.sig}>
                          <button
                            onClick={() => toggle(id)}
                            className="w-full flex items-center gap-3 py-1.5 text-left active:opacity-70"
                          >
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                              <Repeat className="w-3.5 h-3.5 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-200 truncate capitalize">
                                {r.label.toLowerCase()}
                              </p>
                              <p className="text-2xs text-gray-500">
                                {r.category} &middot; {r.months} {periodPlural}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-gray-100 flex-shrink-0">
                              {formatMZN(r.monthly)}
                            </span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                          {isOpen && <DrillList txs={r.txs} />}
                        </li>
                      );
                    })}
                  </ul>
                  {analysis.fixas.length > 12 && (
                    <p className="text-2xs text-gray-500 mt-3 text-center">
                      +{analysis.fixas.length - 12} outras fixas
                    </p>
                  )}
                </>
              )}
            </section>

            {/* 2b. Gastos frequentes (valor varia) */}
            {analysis.frequentes.length > 0 && (
              <section className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingBag className="w-4 h-4 text-amber-400" />
                  <div>
                    <h2 className="font-bold text-sm text-gray-100">Gastos frequentes (valor varia)</h2>
                    <p className="text-xs text-gray-400">Recorrentes mas sem valor fixo</p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {analysis.frequentes.slice(0, 10).map((r) => {
                    const id = `frq-${r.sig}`;
                    const isOpen = !!open[id];
                    return (
                      <li key={r.sig}>
                        <button
                          onClick={() => toggle(id)}
                          className="w-full flex items-center gap-3 py-1.5 text-left active:opacity-70"
                        >
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-200 truncate capitalize">
                              {r.label.toLowerCase()}
                            </p>
                            <p className="text-2xs text-gray-500">
                              {r.category} &middot; {r.months} {periodPlural} &middot; ~{formatMZN(r.monthly)}/{periodWord}
                            </p>
                            {r.isAggregator && (
                              <p className="text-2xs text-amber-500/80 mt-0.5">
                                PayPal junta v&aacute;rios benefici&aacute;rios numa s&oacute; linha.
                              </p>
                            )}
                          </div>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        {isOpen && <DrillList txs={r.txs} />}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* 3. Para onde vai o dinheiro */}
            <section className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <div>
                  <h2 className="font-bold text-sm text-gray-100">Para onde vai o dinheiro</h2>
                  <p className="text-xs text-gray-400">Top categorias deste {periodWord} &middot; toca para ver</p>
                </div>
              </div>

              {analysis.topCategories.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">Sem despesas este {periodWord}.</p>
              ) : (
                <div className="space-y-1">
                  {analysis.topCategories.slice(0, 6).map((c, i) => {
                    const id = `cat-${c.name}`;
                    const isOpen = !!open[id];
                    return (
                      <div key={c.name}>
                        <button
                          onClick={() => toggle(id)}
                          className="w-full flex items-center gap-3 py-1.5 text-left active:opacity-70"
                        >
                          <span className="text-xs font-bold text-gray-500 w-4 text-right flex-shrink-0">{i + 1}</span>
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
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        {isOpen && <DrillList txs={c.txs} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 6. Sugestões */}
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
