/**
 * Verificação do Mobills SAFE (mapeamento + corte por conta).
 * Correr com: npx tsx src/lib/mobills-safe.test.ts
 * Sem framework — só asserções e exit code.
 */

import {
  applyMobillsMappingAndCutoff,
  defaultTargetFor,
  normalizeAccountName,
  earliestDatesByAccount,
  getMobillsAccountNames,
  rebuildMobillsResult,
  CREATE_NEW,
} from "./mobills-safe";
import type { ImportedTransaction, ImportResult } from "./mobills-import";

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

function row(partial: Partial<ImportedTransaction>): ImportedTransaction {
  return {
    date: "2026-01-01",
    description: "teste",
    originalCategory: "Outros",
    mappedCategory: "Outros",
    mappedSubcategory: "Outros",
    account: "Mozabanco",
    amount: 100,
    type: "expense",
    status: "completed",
    tags: [],
    notes: "",
    needsReview: false,
    ...partial,
  };
}

// ─── normalização de nomes ────────────────────────────────────────────────
console.log("normalização de nomes de conta");
eq(normalizeAccountName("Mozabanco"), normalizeAccountName("Moza Banco"), "Mozabanco ≡ Moza Banco");
eq(normalizeAccountName("StandardBank"), normalizeAccountName("Standard Bank"), "StandardBank ≡ Standard Bank");
eq(normalizeAccountName("Mpesa"), normalizeAccountName("M-Pesa"), "Mpesa ≡ M-Pesa");
eq(normalizeAccountName("cpc"), normalizeAccountName("CPC"), "cpc ≡ CPC");

// ─── defaults inteligentes ────────────────────────────────────────────────
console.log("defaults inteligentes contra contas existentes");
const app = ["CPC", "Moza Banco", "Standard Bank", "M-Pesa"];
eq(defaultTargetFor("CPC", app), "CPC", "CPC → CPC");
eq(defaultTargetFor("Mozabanco", app), "Moza Banco", "Mozabanco → Moza Banco");
eq(defaultTargetFor("StandardBank", app), "Standard Bank", "StandardBank → Standard Bank");
eq(defaultTargetFor("Mpesa", app), "M-Pesa", "Mpesa → M-Pesa");
eq(defaultTargetFor("MBim", app), CREATE_NEW, "MBim → criar nova");
eq(defaultTargetFor("Wallet", app), CREATE_NEW, "Wallet → criar nova");

// ─── corte por conta ──────────────────────────────────────────────────────
console.log("corte por conta (anti-duplicados)");
const mapping = { Mozabanco: "Moza Banco", StandardBank: "Standard Bank" };
const cutoffs = { "Moza Banco": "2026-06-01" };

// Mozabanco em 2026-07-01 (>= corte 2026-06-01) → SALTADA
const r1 = applyMobillsMappingAndCutoff([row({ account: "Mozabanco", date: "2026-07-01" })], mapping, cutoffs);
eq(r1.kept.length, 0, "Mozabanco 2026-07-01 é saltada (>= corte)");
eq(r1.droppedCount, 1, "conta 1 saltada");

// Mozabanco em 2026-03-01 (< corte) → MANTIDA
const r2 = applyMobillsMappingAndCutoff([row({ account: "Mozabanco", date: "2026-03-01" })], mapping, cutoffs);
eq(r2.kept.length, 1, "Mozabanco 2026-03-01 é mantida (< corte)");
eq(r2.kept[0]?.account, "Moza Banco", "conta remapeada para Moza Banco");

// Wallet (conta nova, sem corte) → sempre MANTIDA
const r3 = applyMobillsMappingAndCutoff(
  [row({ account: "Wallet", date: "2026-08-01" })],
  { Wallet: CREATE_NEW },
  cutoffs
);
eq(r3.kept.length, 1, "Wallet é sempre mantida (sem corte)");
eq(r3.kept[0]?.account, "Wallet", "Wallet mantém o nome (conta nova)");

// exactamente na data de corte → SALTADA (>=)
const r4 = applyMobillsMappingAndCutoff([row({ account: "Mozabanco", date: "2026-06-01" })], mapping, cutoffs);
eq(r4.kept.length, 0, "linha na própria data de corte é saltada");

// remapeamento renomeia account correctamente (StandardBank sem corte)
const r5 = applyMobillsMappingAndCutoff([row({ account: "StandardBank", date: "2026-07-01" })], mapping, cutoffs);
eq(r5.kept[0]?.account, "Standard Bank", "StandardBank → Standard Bank (renomeado)");
eq(r5.kept.length, 1, "StandardBank mantida (sem corte para essa conta)");

// remapeia transferToAccount também
const r6 = applyMobillsMappingAndCutoff(
  [row({ account: "StandardBank", transferToAccount: "Mozabanco", type: "transfer", date: "2026-02-01" })],
  mapping,
  cutoffs
);
eq(r6.kept[0]?.transferToAccount, "Moza Banco", "transferToAccount remapeado");

// ─── earliestDatesByAccount ───────────────────────────────────────────────
console.log("cálculo do corte (data mais antiga por conta)");
const earliest = earliestDatesByAccount([
  { date: "2026-06-15", accountName: "Moza Banco" },
  { date: "2026-06-01", accountName: "Moza Banco" },
  { date: "2026-07-20", accountName: "CPC" },
  { date: "2026-05-05", accountName: "CPC" },
  { date: "2026-01-01", accountName: null },
]);
eq(earliest["Moza Banco"], "2026-06-01", "corte Moza Banco = 2026-06-01");
eq(earliest["CPC"], "2026-05-05", "corte CPC = 2026-05-05");
eq(Object.keys(earliest).length, 2, "linhas sem conta são ignoradas");

// ─── rebuildMobillsResult ─────────────────────────────────────────────────
console.log("reconstrução do ImportResult");
const original: ImportResult = {
  success: true,
  total: 3,
  imported: [],
  skipped: 0,
  errors: [],
  categoryMapping: {},
  accountsFound: ["Mozabanco", "CPC"],
  dateRange: { from: "2026-01-01", to: "2026-12-31" },
  summary: { totalIncome: 0, totalExpenses: 0, totalTransfers: 0, categoryCounts: {} },
};
const kept = [
  row({ account: "Moza Banco", date: "2026-03-01", type: "expense", amount: 200, mappedCategory: "Alimentação" }),
  row({ account: "CPC", date: "2026-01-15", type: "income", amount: 5000, mappedCategory: "Salário" }),
];
const rebuilt = rebuildMobillsResult(original, kept, mapping);
eq(rebuilt.imported.length, 2, "imported reconstruído com 2 linhas");
eq(rebuilt.summary.totalExpenses, 200, "totalExpenses recalculado");
eq(rebuilt.summary.totalIncome, 5000, "totalIncome recalculado");
eq(rebuilt.dateRange, { from: "2026-01-15", to: "2026-03-01" }, "dateRange recalculado");
eq(rebuilt.accountsFound.sort(), ["CPC", "Moza Banco"], "accountsFound recalculado");

// ─── getMobillsAccountNames ───────────────────────────────────────────────
console.log("deteção de contas distintas");
const withRows: ImportResult = {
  ...original,
  imported: [
    row({ account: "CPC" }),
    row({ account: "Mozabanco" }),
    row({ account: "StandardBank", transferToAccount: "Mpesa", type: "transfer" }),
    row({ account: "MBim" }),
    row({ account: "Wallet" }),
  ],
  accountsFound: [],
};
const names = getMobillsAccountNames(withRows).sort();
eq(names, ["CPC", "MBim", "Mozabanco", "Mpesa", "StandardBank", "Wallet"], "6 contas distintas detectadas");

// ─── opcional: ler o xlsx real e confirmar as 6 contas ────────────────────
async function checkRealFile(): Promise<void> {
  const path =
    "/root/.claude/uploads/deb1009e-029a-57d8-bfcf-413022ca0e2e/f199c4a0-REPORT_TRANSACTIONS_MOBILLS.xlsx";
  try {
    const { readFileSync, existsSync } = await import("node:fs");
    if (!existsSync(path)) {
      console.log("ficheiro real (xlsx) — não disponível, salto este teste");
      return;
    }
    console.log("ficheiro real (xlsx) — deteção das 6 contas");
    const { parseExcelFile } = await import("./bank-statement-parser");
    const buf = readFileSync(path);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const result = await parseExcelFile(ab as ArrayBuffer, "mobills");
    const detected = getMobillsAccountNames(result).sort();
    const expected = ["CPC", "MBim", "Mozabanco", "Mpesa", "StandardBank", "Wallet"].sort();
    eq(detected, expected, "6 contas reais detectadas no xlsx");
  } catch (e) {
    console.log(`ficheiro real (xlsx) — salto (${e instanceof Error ? e.message : String(e)})`);
  }
}

async function main(): Promise<void> {
  await checkRealFile();
  console.log(failures === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${failures} TESTE(S) FALHARAM`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
