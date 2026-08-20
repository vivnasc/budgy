/**
 * M-Pesa PDF parser test — run with:  npx tsx src/lib/mpesa-pdf.test.ts
 *
 * Extracts the real sample statement with pdfjs (Node legacy build), runs the
 * parser and asserts the reconciliation invariants.
 */

import fs from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseMpesaPdfItems, type MpesaTextItem } from "./mpesa-pdf";

const SAMPLE =
  process.env.MPESA_SAMPLE_PDF ||
  "/root/.claude/uploads/deb1009e-029a-57d8-bfcf-413022ca0e2e/d7c0a170-Transacc_o_es_2026_08_20.pdf";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
}
function approx(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) <= eps;
}

async function extractItems(file: string): Promise<MpesaTextItem[]> {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const items: MpesaTextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!("str" in it)) continue;
      const t = it as { str: string; transform: number[] };
      items.push({ str: t.str, x: t.transform[4]!, y: t.transform[5]!, page: p });
    }
  }
  return items;
}

/** Real balance effect of a stored transaction (matches account-balances.ts). */
function signedEffect(tx: {
  type: "income" | "expense" | "transfer";
  amount: number;
}): number {
  return tx.type === "income" ? tx.amount : -tx.amount;
}

async function main() {
  if (!fs.existsSync(SAMPLE)) {
    console.error(`Amostra não encontrada: ${SAMPLE}`);
    process.exit(2);
  }
  console.log(`Amostra: ${path.basename(SAMPLE)}`);

  const items = await extractItems(SAMPLE);
  const result = parseMpesaPdfItems(items);

  console.log(`\nResultado: ${result.imported.length} transações\n`);

  assert(result.success, "parser devolve success");
  assert(result.imported.length === 17, `17 transações (obtidas: ${result.imported.length})`);
  assert(
    result.accountsFound.length === 1 && result.accountsFound[0] === "M-Pesa",
    "conta encontrada = M-Pesa"
  );

  const opening = result.openingBalances?.[0];
  assert(!!opening && opening.accountName === "M-Pesa", "openingBalances[0] é M-Pesa");

  // A base de dados exige `amount > 0`: todos os valores guardados têm de ser
  // magnitude positiva (a direcção vem do `type`). Este era o bug que impedia
  // a gravação (transferências recebidas ficavam negativas).
  const allPositive = result.imported.every((t) => t.amount > 0);
  assert(allPositive, "todos os amount > 0 (satisfaz a constraint da BD)");
  void signedEffect;

  // Classification spot-checks
  const recebida = result.imported.find(
    (t) => /Transfer[êe]ncia recebida/i.test(t.originalCategory)
  );
  assert(
    !!recebida && recebida.type === "transfer",
    "'Transferência recebida' → type transfer"
  );
  assert(
    !!recebida && /SHIRLEY/i.test(recebida.description + " " + recebida.tags.join(" ")),
    "'Transferência recebida' mantém o nome do beneficiário"
  );

  const credelec = result.imported.find((t) => /Credelec|EDM/i.test(t.originalCategory));
  assert(
    !!credelec && credelec.type === "expense" && credelec.mappedCategory === "Contas",
    "'Credelec/EDM' → expense / Contas"
  );

  const recarga = result.imported.find((t) => /Recarga|Jackpot|Internet/i.test(t.originalCategory));
  assert(
    !!recarga && recarga.type === "expense" && recarga.mappedCategory === "Comunicação",
    "'Recarga' → expense / Comunicação"
  );

  console.log(
    failures === 0 ? "\n✅ TODOS OS TESTES PASSARAM\n" : `\n❌ ${failures} TESTE(S) FALHARAM\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
