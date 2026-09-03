/**
 * Verificação rápida do módulo de ciclo. Correr com: npx tsx src/lib/period.test.ts
 * Não usa framework — só asserções e exit code.
 */

import {
  cycleKeyFor,
  cycleRangeFor,
  currentCycleStart,
  shiftCycle,
  cycleLabel,
  cycleShortLabel,
  getCycleStartDay,
  clampCycleDay,
} from "./period";

let failures = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok: ${msg}`);
  } else {
    failures++;
    console.error(`  FALHOU: ${msg}\n    esperado: ${e}\n    obtido:   ${a}`);
  }
}

console.log("startDay = 20 (mês de salário da Vivianne)");
// Fronteira do dia 20: dia >= 20 → ciclo deste mês; dia < 20 → ciclo do mês anterior.
eq(cycleKeyFor("2026-08-25", 20), "2026-08-20", "25 ago pertence ao ciclo 20 ago");
eq(cycleKeyFor("2026-08-20", 20), "2026-08-20", "20 ago (fronteira) inicia novo ciclo");
eq(cycleKeyFor("2026-08-19", 20), "2026-07-20", "19 ago pertence ao ciclo anterior (20 jul)");
eq(cycleKeyFor("2026-08-05", 20), "2026-07-20", "05 ago pertence ao ciclo 20 jul");
eq(cycleKeyFor("2026-01-05", 20), "2025-12-20", "05 jan cruza o ano → ciclo 20 dez do ano anterior");
eq(cycleRangeFor("2026-08-25", 20), { from: "2026-08-20", to: "2026-09-19" }, "intervalo do ciclo 20 ago–19 set");
eq(shiftCycle("2026-08-20", -1), "2026-07-20", "ciclo anterior a 20 ago é 20 jul");
eq(shiftCycle("2026-01-20", -1), "2025-12-20", "ciclo anterior cruza o ano");
eq(cycleLabel("2026-08-20", 20, true), "20 ago – 19 set 2026", "rótulo do ciclo com ano");
eq(cycleLabel("2026-08-20", 20), "20 ago – 19 set", "rótulo do ciclo sem ano");
eq(cycleShortLabel("2026-08-20"), "ago", "rótulo curto do ciclo");
eq(currentCycleStart("2026-09-01", 20), "2026-08-20", "01 set ainda está no ciclo 20 ago");

console.log("startDay = 1 (por omissão → idêntico ao mês do calendário)");
eq(cycleKeyFor("2026-08-15", 1), "2026-08-01", "qualquer dia mapeia para o dia 1 do mês");
eq(cycleKeyFor("2026-08-01", 1), "2026-08-01", "dia 1 mapeia para o próprio mês");
eq(cycleRangeFor("2026-08-15", 1), { from: "2026-08-01", to: "2026-08-31" }, "intervalo = mês completo (agosto)");
eq(cycleRangeFor("2026-02-10", 1), { from: "2026-02-01", to: "2026-02-28" }, "fevereiro termina a 28");
eq(shiftCycle("2026-08-01", -1), "2026-07-01", "mês anterior a agosto é julho");
eq(cycleLabel("2026-08-01", 1), "agosto de 2026", "rótulo = mês do calendário");
// Chave por ciclo (YYYY-MM-01) preserva a mesma agregação que YYYY-MM.
eq(cycleKeyFor("2026-08-31", 1) === cycleKeyFor("2026-08-01", 1), true, "todo o mês cai na mesma chave");

console.log("clamp e defaults");
eq(clampCycleDay(0), 1, "clamp mínimo → 1");
eq(clampCycleDay(31), 28, "clamp máximo → 28");
eq(clampCycleDay(20), 20, "valor válido mantém-se");
eq(getCycleStartDay(), 1, "SSR / sem window → default 1");

if (failures > 0) {
  console.error(`\n${failures} teste(s) falharam.`);
  process.exit(1);
}
console.log("\nTodos os testes passaram.");
