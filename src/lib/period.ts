/**
 * Ciclo financeiro (mês de salário).
 *
 * A Vivianne recebe o salário no dia 20 — para ela o "mês" vai de 20 a 19, não
 * de 1 a 31. Este módulo transforma qualquer data no CICLO a que pertence, para
 * que a Análise e o Parceiro agrupem por ciclo de salário em vez de mês do
 * calendário.
 *
 * O dia de início do ciclo é configurável (1..28) e guardado só no browser.
 * Por omissão é 1 — e nesse caso o comportamento é EXACTAMENTE igual ao mês do
 * calendário.
 *
 * Toda a aritmética de datas é feita em UTC para evitar desvios de fuso horário.
 */

export const CYCLE_START_STORAGE = "budgy-cycle-start-day";

const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// ─── Persistência do dia de início do ciclo ─────────────────────────────────

/** Limita a 1..28 (28 evita problemas com meses curtos como Fevereiro). */
export function clampCycleDay(day: number): number {
  if (!Number.isFinite(day)) return 1;
  const d = Math.floor(day);
  if (d < 1) return 1;
  if (d > 28) return 28;
  return d;
}

/** Lê o dia de início do ciclo (localStorage). SSR-safe → 1 se não houver window. */
export function getCycleStartDay(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(CYCLE_START_STORAGE);
    if (raw === null || raw === "") return 1;
    return clampCycleDay(Number(raw));
  } catch {
    return 1;
  }
}

/** Grava o dia de início do ciclo (1..28). SSR-safe (não faz nada sem window). */
export function setCycleStartDay(day: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CYCLE_START_STORAGE, String(clampCycleDay(day)));
  } catch {
    /* storage indisponível — ignora */
  }
}

// ─── Aritmética de datas (UTC, pura) ─────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Extrai {y, m (1..12), d} dos primeiros 10 chars de uma data ISO. */
function parseISO(dateISO: string): { y: number; m: number; d: number } {
  const parts = (dateISO ?? "").slice(0, 10).split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  return {
    y: Number.isFinite(y) ? (y as number) : 1970,
    m: Number.isFinite(m) ? (m as number) : 1,
    d: Number.isFinite(d) ? (d as number) : 1,
  };
}

function isoFrom(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Soma `delta` meses a um par (ano, mês 1..12), normalizando. Pura. */
function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12; // 0-based
  return { y: ny, m: nm + 1 };
}

/** Data (ISO) do dia imediatamente anterior a `y-m-day`. */
function dayBefore(y: number, m: number, day: number): string {
  const dt = new Date(Date.UTC(y, m - 1, day));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return isoFrom(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

// ─── Ciclo ───────────────────────────────────────────────────────────────────

/**
 * Chave estável do ciclo a que uma data pertence, no formato da data de início
 * do ciclo (YYYY-MM-DD).
 *
 * Regra: um dia >= startDay pertence ao ciclo que COMEÇA nesse mês; um dia
 * < startDay pertence ao ciclo do mês anterior.
 *
 * Ex (startDay=20): "2026-08-25" → "2026-08-20"; "2026-08-05" → "2026-07-20".
 * Com startDay=1, devolve sempre "YYYY-MM-01" (idêntico ao mês do calendário).
 */
export function cycleKeyFor(dateISO: string, startDay: number): string {
  const s = clampCycleDay(startDay);
  const { y, m, d } = parseISO(dateISO);
  if (d >= s) return isoFrom(y, m, s);
  const prev = addMonths(y, m, -1);
  return isoFrom(prev.y, prev.m, s);
}

/**
 * Intervalo do ciclo que contém `dateISO`: `from` (início, inclusivo) e `to`
 * (último dia do ciclo = dia antes do próximo início, inclusivo).
 */
export function cycleRangeFor(dateISO: string, startDay: number): { from: string; to: string } {
  const s = clampCycleDay(startDay);
  const from = cycleKeyFor(dateISO, s);
  const start = parseISO(from);
  const next = addMonths(start.y, start.m, 1);
  const to = dayBefore(next.y, next.m, s);
  return { from, to };
}

/** Início do ciclo que contém `todayISO`. */
export function currentCycleStart(todayISO: string, startDay: number): string {
  return cycleKeyFor(todayISO, startDay);
}

/**
 * Desloca um início de ciclo por `deltaCycles` ciclos (meses). Usa o dia
 * embebido na própria chave, por isso é robusto ao startDay.
 */
export function shiftCycle(cycleStartISO: string, deltaCycles: number): string {
  const { y, m, d } = parseISO(cycleStartISO);
  const shifted = addMonths(y, m, deltaCycles);
  return isoFrom(shifted.y, shifted.m, d);
}

/**
 * Rótulo curto e amigável do ciclo, em português.
 * - startDay === 1 → mês do calendário: "agosto de 2026".
 * - caso contrário → intervalo: "20 ago – 19 set" (+ ano se `withYear`).
 */
export function cycleLabel(cycleStartISO: string, startDay: number, withYear = false): string {
  const s = clampCycleDay(startDay);
  const start = parseISO(cycleStartISO);
  if (s === 1) {
    return `${MONTHS_LONG[start.m - 1]} de ${start.y}`;
  }
  const range = cycleRangeFor(cycleStartISO, s);
  const end = parseISO(range.to);
  const startLbl = `${start.d} ${MONTHS_SHORT[start.m - 1]}`;
  const endLbl = `${end.d} ${MONTHS_SHORT[end.m - 1]}`;
  return withYear ? `${startLbl} – ${endLbl} ${end.y}` : `${startLbl} – ${endLbl}`;
}

/** Rótulo curto (só o mês de início, ex: "ago") — para barras de tendência. */
export function cycleShortLabel(cycleStartISO: string): string {
  const { m } = parseISO(cycleStartISO);
  return MONTHS_SHORT[m - 1] ?? "";
}
