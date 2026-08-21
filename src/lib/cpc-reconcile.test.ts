/**
 * Teste de reconciliação do leitor de extratos CPC.
 *
 * Correr com:  npx tsx src/lib/cpc-reconcile.test.ts
 *
 * Invariante fundamental (convenção de sinal COM transferências assinadas):
 *   saldo_abertura + Σ( receita:+amount, despesa:−amount, transferência:+amount )
 *     === saldo_fecho
 *
 * O `amount` das transferências já vem COM SINAL (entrada +, saída −), tal como
 * `account-balances.ts` as soma. Assim, uma transferência ENVIADA (débito)
 * subtrai e uma RECEBIDA (crédito) soma — exactamente como no banco.
 */

import fs from "node:fs";
import assert from "node:assert/strict";
import { parseCPCStatement } from "./bank-statement-parser.ts";

const SAMPLE =
  process.env.CPC_SAMPLE_CSV ||
  "/root/.claude/uploads/deb1009e-029a-57d8-bfcf-413022ca0e2e/3f6e2d0b-CPC_statement_3.csv";

const OPENING = 431626.02;
const CLOSING = 559915.41;

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

if (!fs.existsSync(SAMPLE)) {
  console.error(`Amostra CPC não encontrada: ${SAMPLE}`);
  process.exit(2);
}

const csv = fs.readFileSync(SAMPLE, "utf8");
const result = parseCPCStatement(csv);

/** Efeito real no saldo (igual a account-balances.ts). */
function signedEffect(tx: { type: "income" | "expense" | "transfer"; amount: number }): number {
  return tx.type === "income" ? tx.amount : tx.type === "expense" ? -tx.amount : tx.amount;
}

test("o extracto foi lido com sucesso", () => {
  assert.ok(result.success);
  assert.ok(result.imported.length > 0);
});

test("saldo de abertura detectado = 431626.02", () => {
  const ob = result.openingBalances?.[0];
  assert.ok(ob && Math.abs(ob.amount - OPENING) < 0.01, `abertura: ${ob?.amount}`);
});

test("nenhum valor guardado é zero (constraint amount <> 0)", () => {
  assert.ok(result.imported.every((t) => t.amount !== 0));
});

test("receitas/despesas guardam magnitude positiva; transferências com sinal", () => {
  for (const t of result.imported) {
    if (t.type !== "transfer") assert.ok(t.amount > 0, `${t.type} devia ser > 0`);
  }
});

test("as transferências ENVIADAS (débito) ficam negativas", () => {
  const enviadas = result.imported.filter(
    (t) => t.type === "transfer" && /Enviada/i.test(t.notes ?? t.description)
  );
  assert.ok(enviadas.length > 0, "há pelo menos uma transferência enviada");
  assert.ok(enviadas.every((t) => t.amount < 0), "todas as enviadas são negativas");
});

test("a transferência interbancária RECEBIDA (crédito) fica positiva", () => {
  const recebidas = result.imported.filter(
    (t) => t.type === "transfer" && /Recebida/i.test(t.notes ?? t.description)
  );
  assert.ok(recebidas.length > 0, "há pelo menos uma transferência recebida");
  assert.ok(recebidas.every((t) => t.amount > 0), "todas as recebidas são positivas");
});

test("reconciliação: abertura + Σ(efeito) === 559915.41", () => {
  const closing = result.imported.reduce((s, t) => s + signedEffect(t), OPENING);
  assert.ok(
    Math.abs(closing - CLOSING) < 0.01,
    `esperado ${CLOSING}, obtido ${closing.toFixed(2)}`
  );
});

console.log(`\n${passed} testes passaram ✅`);
