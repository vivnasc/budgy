/**
 * Testes de reconciliação de saldos importados.
 *
 * Garante que, depois de aplicar o sinal correcto a transferências e de
 * normalizar despesas para magnitude positiva, o saldo calculado a partir do
 * extrato bate certo com o saldo de fecho do próprio banco.
 *
 * Correr (imports sem extensão exigem tsx):
 *   npx tsx src/lib/reconciliation.test.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCPCStatement, parseExcelFile } from "./bank-statement-parser";
import type { ImportedTransaction } from "./mobills-import";

const UPLOADS = "/root/.claude/uploads/deb1009e-029a-57d8-bfcf-413022ca0e2e";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

// Efeito, com sinal, de uma transação sobre o saldo da conta — a MESMA
// convenção de computeAccountBalances: income:+ · expense:- · transfer:+sinal.
function signedEffect(tx: { type: string; amount: number }): number {
  return tx.type === "income"
    ? tx.amount
    : tx.type === "expense"
      ? -tx.amount
      : tx.type === "transfer"
        ? tx.amount
        : 0;
}

function sumEffects(txs: ImportedTransaction[]): number {
  return txs.reduce((acc, t) => acc + signedEffect(t), 0);
}

async function run() {
  // ── 1) Unidade: a fórmula de saldo trata cada tipo correctamente ──────────
  await test("saldo: transferência recebida SOMA, enviada SUBTRAI, despesa SUBTRAI, rendimento SOMA", () => {
    assert.equal(signedEffect({ type: "transfer", amount: 100000 }), 100000);
    assert.equal(signedEffect({ type: "transfer", amount: -100000 }), -100000);
    assert.equal(signedEffect({ type: "expense", amount: 2420 }), -2420);
    assert.equal(signedEffect({ type: "income", amount: 5000 }), 5000);
  });

  // ── 2) Reconciliação CPC ──────────────────────────────────────────────────
  let cpcReconciled = 0;
  await test("CPC: abertura + efeitos == saldo de fecho 559915.41", () => {
    const csv = fs.readFileSync(`${UPLOADS}/3f43c940-statement_3.csv`, "utf8");
    const result = parseCPCStatement(csv);
    assert.equal(result.success, true, "parse CPC falhou");
    const opening = result.openingBalances[0]!;
    assert.ok(Math.abs(opening.amount - 431626.02) < 0.01, `abertura ${opening.amount} != 431626.02`);

    // A transferência recebida de +3.660.000 tem de estar classificada como
    // transferência e SOMAR (bug original subtraía-a).
    const recebida = result.imported.find((t) => /Interb\. Recebida/i.test(t.notes ?? ""));
    assert.ok(recebida, "transferência recebida não encontrada");
    assert.equal(recebida!.type, "transfer");
    assert.ok(recebida!.amount > 0, "transferência recebida devia ser positiva");

    cpcReconciled = opening.amount + sumEffects(result.imported);
    assert.ok(
      Math.abs(cpcReconciled - 559915.41) < 0.01,
      `reconciliação CPC ${cpcReconciled} != 559915.41`
    );
  });

  // ── 3) Reconciliação Standard Bank (.xlsx, detecção por conteúdo) ─────────
  let sbReconciled = 0;
  await test("Standard: abertura + efeitos == saldo de fecho 22745.61", async () => {
    const buf = fs.readFileSync(`${UPLOADS}/88e2be88-Movimentos_de_Conta__1086698041008_9.xlsx`);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    // Nome do ficheiro leva ao "mobills" de propósito — a detecção por conteúdo
    // tem de reencaminhar para standard-bank.
    const result = await parseExcelFile(ab as ArrayBuffer, "mobills");
    assert.equal(result.success, true, "parse Standard falhou");
    assert.deepEqual(result.accountsFound, ["Standard Bank"], "não roteou para Standard Bank");
    const opening = result.openingBalances[0]!;
    assert.ok(opening, "sem saldo de abertura derivado");

    sbReconciled = opening.amount + sumEffects(result.imported);
    assert.ok(
      Math.abs(sbReconciled - 22745.61) < 0.05,
      `reconciliação Standard ${sbReconciled} != 22745.61`
    );
  });

  console.log(`\n${passed} testes OK`);
  console.log(`RECONCILIAÇÃO CPC      = ${cpcReconciled.toFixed(2)} (esperado 559915.41)`);
  console.log(`RECONCILIAÇÃO STANDARD = ${sbReconciled.toFixed(2)} (esperado 22745.61)`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
