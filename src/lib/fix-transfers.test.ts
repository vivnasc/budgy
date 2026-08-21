/**
 * Teste da lógica de decisão da correcção de transferências.
 *
 * Correr com:  npx tsx src/lib/fix-transfers.test.ts
 */

import assert from "node:assert/strict";
import { decideTransferFix } from "./fix-transfers.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

test("'Transferência de 001200…' (income) → transfer, montante positivo", () => {
  const d = decideTransferFix({
    description: "Transferência de 001200345678 VIVIANNE",
    type: "income",
    amount: 50000,
  });
  assert.equal(d.newType, "transfer");
  assert.equal(d.newAmount, 50000);
  assert.equal(d.reclassified, true);
});

test("'Transf. METIX via NIB Enviada' (transfer) → negativo", () => {
  const d = decideTransferFix({
    description: "Transf. METIX via NIB Enviada IB-0034 Minha Conta Moza",
    type: "transfer",
    amount: 100000,
  });
  assert.equal(d.newType, "transfer");
  assert.equal(d.newAmount, -100000);
  assert.equal(d.reclassified, false);
  assert.equal(d.resigned, true);
});

test("'M-Pesa para 849…' (expense) → inalterado", () => {
  const d = decideTransferFix({
    description: "M-Pesa para 849123456",
    type: "expense",
    amount: 2420,
  });
  assert.equal(d.newType, "expense");
  assert.equal(d.newAmount, 2420);
  assert.equal(d.reclassified, false);
  assert.equal(d.resigned, false);
});

test("'PAGAMENTO SALARIO' (income) → inalterado (não é transferência)", () => {
  const d = decideTransferFix({
    description: "PAGAMENTO SALARIO CR BMSAL",
    type: "income",
    amount: 401030.98,
  });
  assert.equal(d.newType, "income");
  assert.equal(d.newAmount, 401030.98);
  assert.equal(d.reclassified, false);
});

test("'Transferência recebida SHIRLEY' (transfer já correcto) → positivo, idempotente", () => {
  const d = decideTransferFix({
    description: "Transferência recebida de SHIRLEY",
    type: "transfer",
    amount: 1500,
  });
  assert.equal(d.newAmount, 1500);
  assert.equal(d.resigned, false);
});

test("idempotência: correr outra vez sobre o resultado não muda nada", () => {
  const once = decideTransferFix({
    description: "Transferência de 001200345678 VIVIANNE",
    type: "income",
    amount: 50000,
  });
  const twice = decideTransferFix({
    description: "Transferência de 001200345678 VIVIANNE",
    type: once.newType,
    amount: once.newAmount,
  });
  assert.equal(twice.newAmount, once.newAmount);
  assert.equal(twice.resigned, false);
});

test("transferência ambígua (sem pistas) → assume saída (negativo)", () => {
  const d = decideTransferFix({
    description: "Transferência interna",
    type: "transfer",
    amount: 3000,
  });
  assert.equal(d.newAmount, -3000);
});

test("TEI RCB Sal (salário via TEI) NÃO é reclassificado", () => {
  const d = decideTransferFix({
    description: "TEI RCB Sal Masterworks",
    type: "income",
    amount: 80000,
  });
  assert.equal(d.newType, "income");
  assert.equal(d.reclassified, false);
});

console.log(`\n${passed} testes passaram ✅`);
