/**
 * Teste autónomo do leitor de "Colar transacções".
 *
 * Correr com:
 *   npx tsx src/lib/paste-parser.test.ts
 */

import assert from "node:assert/strict";
import { parsePastedTransactions } from "./paste-parser.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

// Amostra real: copiar-colar do internet-banking CPC. O primeiro registo ocupa
// DUAS linhas físicas (a descrição dá a volta).
const SAMPLE = `21 AUG 2026\t21 AUG 2026\tFT2623333454\tPagamento no PV (VISA)
PAYPAL *PADDLE.NET 35314369001 GBR\t-3,220.38\tMZN
21 AUG 2026\t21 AUG 2026\tFT2623397920\tTransf. METIX via NIB Enviada IB-003400000424646710162-VIVIA NNE SARAIVA-Minha Conta Moza\t-100,000.00\tMZN
21 AUG 2026\t21 AUG 2026\tFT2623314000\tTransf. METIX via NIB Enviada IB-000301080669804100865-VIVIA NNE SARAIVA-MINHA CONTA SB\t-100,000.00\tMZN`;

const result = parsePastedTransactions(SAMPLE);

test("lê exactamente 3 transações", () => {
  assert.equal(result.length, 3);
});

test("valores COM SINAL: despesa +3220.38, transferências ENVIADAS -100000", () => {
  // Despesa mantém magnitude positiva; transferências guardam sinal (saída = −).
  assert.deepEqual(
    result.map((r) => r.amount),
    [3220.38, -100000, -100000]
  );
});

test("magnitudes: 3220.38, 100000, 100000", () => {
  assert.deepEqual(
    result.map((r) => Math.abs(r.amount)),
    [3220.38, 100000, 100000]
  );
});

test("todas as datas são 2026-08-21", () => {
  assert.ok(result.every((r) => r.date === "2026-08-21"));
});

test("nenhum valor é zero (constraint amount <> 0)", () => {
  assert.ok(result.every((r) => r.amount !== 0));
});

test("transferências enviadas são negativas; despesas/receitas positivas", () => {
  for (const r of result) {
    if (r.type === "transfer") assert.ok(r.amount < 0, "transferência enviada < 0");
    else assert.ok(r.amount > 0, "receita/despesa > 0");
  }
});

test("o primeiro (PayPal) é uma despesa", () => {
  assert.equal(result[0]!.type, "expense");
});

test("os dois METIX para conta própria são transferências", () => {
  assert.equal(result[1]!.type, "transfer");
  assert.equal(result[2]!.type, "transfer");
  assert.equal(result[1]!.category, "Transferência");
  assert.equal(result[2]!.category, "Transferência");
});

test("descrições limpas (sem data, sem FT, sem MZN residual)", () => {
  for (const r of result) {
    assert.ok(!/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(r.description), "sem data à frente");
    assert.ok(!/^FT\d/.test(r.description), "sem referência FT");
    assert.ok(!/\bMZN\b$/.test(r.description), "sem MZN no fim");
    assert.ok(r.description.length > 0, "descrição não vazia");
  }
});

test("tolera espaços a mais e falta de MZN", () => {
  const messy = `05 JAN 2026   05 JAN 2026   FT9999999999   Compra no Ponto de Venda (OIC)   SHOPRITE Maputo   -1,250.00`;
  const r = parsePastedTransactions(messy);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.amount, 1250);
  assert.equal(r[0]!.date, "2026-01-05");
  assert.equal(r[0]!.type, "expense");
});

console.log(`\n${passed} testes passaram ✅`);
