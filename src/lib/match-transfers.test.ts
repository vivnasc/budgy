/**
 * Teste autónomo da lógica pura de emparelhamento de contrapartidas.
 *
 * Correr com Node (>=22.6) via strip-types:
 *   node --experimental-strip-types src/lib/match-transfers.test.ts
 */

import assert from "node:assert/strict";
import {
  matchTransferCounterparts,
  type TransferCandidate,
  type ExistingTransfer,
} from "./match-transfers.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

// 1) CPC saída (guardada) + Moza entrada (candidata) → MATCH.
// Nota: o CPC guarda o montante SEMPRE positivo, mas o teste usa -100000 para
// provar que o emparelhamento é robusto ao sinal (compara Math.abs).
test("CPC -100000 (07-07) + Moza +100000 (08-07) → emparelha", () => {
  const candidates: TransferCandidate[] = [
    { tempId: "moza-1", date: "2026-07-08", amount: 100000, type: "transfer" },
  ];
  const existing: ExistingTransfer[] = [
    { id: "cpc-1", date: "2026-07-07", amount: -100000, account: "CPC" },
  ];
  const matched = matchTransferCounterparts(candidates, existing);
  assert.equal(matched.length, 1);
  assert.equal(matched[0]!.tempId, "moza-1");
  assert.equal(matched[0]!.account, "CPC");
  assert.equal(matched[0]!.date, "2026-07-08");
});

// 2) Montantes diferentes → sem match.
test("montantes diferentes → não emparelha", () => {
  const candidates: TransferCandidate[] = [
    { tempId: "moza-1", date: "2026-07-08", amount: 100000, type: "transfer" },
  ];
  const existing: ExistingTransfer[] = [
    { id: "cpc-1", date: "2026-07-07", amount: -95000, account: "CPC" },
  ];
  assert.deepEqual(matchTransferCounterparts(candidates, existing), []);
});

// 3) Mesma conta ainda emparelha (o candidato NÃO tem conta ainda; só se exige
//    que a existente tenha conta). O nome igual não impede — o pré-filtro de
//    conta é feito no endpoint. Aqui provamos que uma existente com conta nula
//    devolve account=null mas continua a emparelhar por montante+data.
test("existente com account null → emparelha com account null", () => {
  const candidates: TransferCandidate[] = [
    { tempId: "moza-1", date: "2026-07-08", amount: 100000, type: "transfer" },
  ];
  const existing: ExistingTransfer[] = [
    { id: "x-1", date: "2026-07-08", amount: 100000, account: null },
  ];
  const matched = matchTransferCounterparts(candidates, existing);
  assert.equal(matched.length, 1);
  assert.equal(matched[0]!.account, null);
});

// 4) Mais de 5 dias de diferença → sem match.
test(">5 dias de diferença → não emparelha", () => {
  const candidates: TransferCandidate[] = [
    { tempId: "moza-1", date: "2026-07-14", amount: 100000, type: "transfer" },
  ];
  const existing: ExistingTransfer[] = [
    { id: "cpc-1", date: "2026-07-07", amount: -100000, account: "CPC" },
  ];
  assert.deepEqual(matchTransferCounterparts(candidates, existing), []);
});

// 4b) Exactamente 5 dias → ainda emparelha (limite inclusivo).
test("exactamente 5 dias → emparelha", () => {
  const candidates: TransferCandidate[] = [
    { tempId: "moza-1", date: "2026-07-12", amount: 100000, type: "transfer" },
  ];
  const existing: ExistingTransfer[] = [
    { id: "cpc-1", date: "2026-07-07", amount: 100000, account: "CPC" },
  ];
  assert.equal(matchTransferCounterparts(candidates, existing).length, 1);
});

// 5) Dois candidatos do mesmo montante → duas existentes DISTINTAS, não a mesma
//    duas vezes. Prefere a data mais próxima.
test("dois candidatos iguais → duas existentes distintas (1-para-1)", () => {
  const candidates: TransferCandidate[] = [
    { tempId: "moza-1", date: "2026-07-07", amount: 100000, type: "transfer" },
    { tempId: "moza-2", date: "2026-07-10", amount: 100000, type: "transfer" },
  ];
  const existing: ExistingTransfer[] = [
    { id: "cpc-a", date: "2026-07-07", amount: 100000, account: "CPC" },
    { id: "cpc-b", date: "2026-07-10", amount: 100000, account: "Standard Bank" },
  ];
  const matched = matchTransferCounterparts(candidates, existing);
  assert.equal(matched.length, 2);
  const byTemp = new Map(matched.map((m) => [m.tempId, m]));
  // moza-1 (07) fica com a existente de 07 (CPC), moza-2 (10) com a de 10 (SB)
  assert.equal(byTemp.get("moza-1")!.account, "CPC");
  assert.equal(byTemp.get("moza-2")!.account, "Standard Bank");
});

// 6) Só existe uma existente para dois candidatos iguais → só um emparelha.
test("uma existente para dois candidatos → só um emparelha", () => {
  const candidates: TransferCandidate[] = [
    { tempId: "moza-1", date: "2026-07-07", amount: 100000, type: "transfer" },
    { tempId: "moza-2", date: "2026-07-08", amount: 100000, type: "transfer" },
  ];
  const existing: ExistingTransfer[] = [
    { id: "cpc-a", date: "2026-07-07", amount: 100000, account: "CPC" },
  ];
  const matched = matchTransferCounterparts(candidates, existing);
  assert.equal(matched.length, 1);
  assert.equal(matched[0]!.tempId, "moza-1");
});

// 7) Candidatos que não são "transfer" são ignorados.
test("candidatos não-transfer são ignorados", () => {
  const candidates: TransferCandidate[] = [
    { tempId: "e-1", date: "2026-07-07", amount: 100000, type: "expense" },
    { tempId: "i-1", date: "2026-07-07", amount: 100000, type: "income" },
  ];
  const existing: ExistingTransfer[] = [
    { id: "cpc-a", date: "2026-07-07", amount: 100000, account: "CPC" },
  ];
  assert.deepEqual(matchTransferCounterparts(candidates, existing), []);
});

console.log(`\n${passed} testes passaram.`);
