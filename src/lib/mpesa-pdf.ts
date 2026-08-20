/**
 * M-Pesa (Vodafone Moçambique) PDF Statement Parser
 *
 * Parses the "Extracto da Conta" PDF exported from the M-Pesa app/portal.
 * Unlike the CSV/Excel banks, M-Pesa only offers a PDF. The PDF has no real
 * table structure — it is a bag of positioned text fragments. We reconstruct
 * the rows geometrically from the X/Y coordinates of each fragment.
 *
 * The caller (browser) extracts every text item with pdfjs-dist and passes an
 * array of `{ str, x, y, page }` (x = transform[4], y = transform[5], origin
 * bottom-left). This module is therefore environment-agnostic: the same
 * function runs in the browser and in the Node test harness.
 *
 * Layout (verified against a real statement — positions are stable):
 *  - x≈63  : Número de Recibo (11-char alphanumeric) — the ROW ANCHOR.
 *  - x≈141/196 : Tempo de Conclusão / Iniciação — date fragments, stacked.
 *  - x≈215–370 : Detalhes (description), wrapping across stacked lines.
 *  - x≈373 : Estado.
 *  - x≈419–507 : Crédito, Débito, Saldo (three trailing numbers).
 *  Anchors sit ~41px apart vertically.
 *
 * Sign convention (kept consistent with the rest of the codebase — see
 * `src/lib/account-balances.ts`): the balance effect of a row is
 *   income    → +amount
 *   expense   → -amount
 *   transfer  → -amount   (source-account leg)
 * So income/expense store a POSITIVE magnitude and the direction lives in the
 * `type`. Transfers are the only rows that can go either way on a single
 * account, so we store a SIGNED amount whose NEGATION is the real balance
 * movement: money that LEAVES (Transferência para / pagamento a banco) is
 * stored POSITIVE (like every CPC/Moza transfer), money that ENTERS
 * (Transferência recebida) is stored NEGATIVE — that way `-amount` adds it
 * back to the balance and the account calibrates exactly like the CSV imports.
 */

import type { ImportResult, ImportedTransaction } from "./mobills-import";

// ─── Types ──────────────────────────────────────────────────────────────────

/** One positioned text fragment extracted from the PDF by pdfjs. */
export interface MpesaTextItem {
  str: string;
  /** transform[4] — horizontal position, origin bottom-left. */
  x: number;
  /** transform[5] — vertical position, origin bottom-left. */
  y: number;
  /** 1-based page number. */
  page: number;
}

const ACCOUNT_NAME = "M-Pesa";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNumber(raw: string): number {
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Cleans a raw M-Pesa "Detalhes" string into something readable: strips long
 * phone/account ids and "Acc. …" noise, and tidies the dangling connectors
 * ("de -", "para -", "from -") that appear once the id between them is gone.
 */
function cleanDescription(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/\s*Acc\.\s*\d*/gi, ""); // "Acc. 000301080669804" / lone "Acc."
  s = s.replace(/\b\d{6,}\b/g, ""); // long numeric ids (phones/accounts)
  // Tidy the connector left dangling before the beneficiary name.
  s = s.replace(/\b(de|para|from)\s*-\s*/gi, (_m, w: string) =>
    /para/i.test(w) ? "para " : "- "
  );
  s = s.replace(/\s{2,}/g, " ");
  s = s.replace(/\s*-\s*$/, "");
  s = s.replace(/\s*-\s*-\s*/g, " - ");
  return s.trim();
}

/** Extracts the human beneficiary name that follows the last " - " (if any). */
function extractBeneficiary(raw: string): string | null {
  const m = raw.match(/-\s*([^-]+)$/);
  if (!m || !m[1]) return null;
  let name = m[1]
    .replace(/Acc\..*$/i, "")
    .replace(/\b\d{4,}.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return /[A-Za-zÀ-ÿ]{2,}/.test(name) ? name : null;
}

interface Classification {
  type: "income" | "expense" | "transfer";
  category: string;
}

/**
 * Classifies a row from its raw description and direction, per the M-Pesa
 * statement vocabulary. `credito > 0` ⇒ money in, otherwise money out.
 */
function classify(raw: string, credito: number): Classification {
  if (credito > 0) {
    if (/Transfer[êe]ncia\s+recebida/i.test(raw))
      return { type: "transfer", category: "Transferência" };
    if (/Reversal|Estorno/i.test(raw))
      return { type: "income", category: "Reembolso" };
    if (/via WEB by .*BANCO|Pagamento de \d+ - .*BANCO/i.test(raw))
      return { type: "transfer", category: "Transferência" };
    return { type: "income", category: "Outro Rendimento" };
  }
  // money out
  if (/Transfer[êe]ncia\s+para/i.test(raw))
    return { type: "transfer", category: "Transferência" };
  if (/Pagamento de servi[çc]os para \d+ - .*Bank|Send Money to Bank/i.test(raw))
    return { type: "transfer", category: "Transferência" };
  if (/Credelec|EDM/i.test(raw)) return { type: "expense", category: "Contas" };
  if (/Recarga|Jackpot|Internet/i.test(raw))
    return { type: "expense", category: "Comunicação" };
  if (/Taxa|Charge|Comiss[aã]o/i.test(raw))
    return { type: "expense", category: "Taxas Bancárias" };
  return { type: "expense", category: "Outros" };
}

function emptyResult(error: string): ImportResult {
  return {
    success: false,
    total: 0,
    imported: [],
    skipped: 0,
    errors: [error],
    categoryMapping: {},
    accountsFound: [],
    dateRange: null,
    summary: { totalIncome: 0, totalExpenses: 0, totalTransfers: 0, categoryCounts: {} },
  };
}

// ─── Detection ────────────────────────────────────────────────────────────────

/** True when the extracted items look like an M-Pesa "Extracto da Conta". */
export function looksLikeMpesaStatement(items: MpesaTextItem[]): boolean {
  const anchors = items.filter(
    (i) => /^[A-Z0-9]{11}$/.test(i.str.trim()) && i.x < 110
  );
  if (anchors.length > 0) return true;
  const joined = items.map((i) => i.str).join(" ");
  return /Extracto da Conta/i.test(joined);
}

// ─── Parser ────────────────────────────────────────────────────────────────────

/**
 * Parses positioned PDF text items from an M-Pesa statement into the shared
 * `ImportResult` shape used by every other importer.
 */
export function parseMpesaPdfItems(items: MpesaTextItem[]): ImportResult {
  if (!items || items.length === 0) {
    return emptyResult("PDF vazio — não foi possível ler o extracto M-Pesa");
  }

  // Row anchors: the 11-char receipt number in the left-most column.
  const anchors = items
    .filter((i) => /^[A-Z0-9]{11}$/.test(i.str.trim()) && i.x < 110)
    .sort((a, b) => a.page - b.page || b.y - a.y); // top→down within each page

  if (anchors.length === 0) {
    return emptyResult(
      "PDF não reconhecido — de momento só extratos M-Pesa em PDF"
    );
  }

  const imported: ImportedTransaction[] = [];
  const errors: string[] = [];
  let skipped = 0;
  const categoryCounts: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalTransfers = 0;
  let minDate = "";
  let maxDate = "";

  // Back-derive the opening balance from the first chronological row so the
  // account calibrates like the CSV imports: opening = saldo − realMovement.
  let firstOpening: number | null = null;

  for (const a of anchors) {
    const receipt = a.str.trim();

    // Three trailing numbers on the anchor's line: [credito, debito, saldo].
    const nums = items
      .filter(
        (i) =>
          i.page === a.page &&
          Math.abs(i.y - a.y) < 3 &&
          i.x > 405 &&
          /^[\d\-]/.test(i.str.trim())
      )
      .sort((p, q) => p.x - q.x)
      .map((i) => parseNumber(i.str));

    const credito = nums[0] ?? 0;
    const debito = nums[1] ?? 0;
    const saldo = nums[2] ?? 0;

    const magnitude = credito > 0 ? credito : Math.abs(debito);
    if (magnitude === 0 && nums.length < 3) {
      skipped++;
      continue;
    }

    // Description fragments sit in the middle column, wrapping across a few
    // stacked lines within the transaction's vertical band.
    const rawDesc = items
      .filter(
        (i) =>
          i.page === a.page &&
          i.y > a.y - 30 &&
          i.y < a.y + 16 &&
          i.x > 212 &&
          i.x < 372
      )
      .sort((p, q) => q.y - p.y || p.x - q.x)
      .map((i) => i.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    // Date fragments in the "Tempo de Conclusão" columns.
    const rawDate = items
      .filter(
        (i) =>
          i.page === a.page &&
          i.y > a.y - 30 &&
          i.y < a.y + 16 &&
          i.x > 118 &&
          i.x < 210
      )
      .sort((p, q) => q.y - p.y || p.x - q.x)
      .map((i) => i.str)
      .join("");
    const dm = rawDate.match(/(\d{4})-(\d{2})-\s*(\d{2})/);
    const date = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Recibo ${receipt}: data não reconhecida`);
      skipped++;
      continue;
    }

    const { type, category } = classify(rawDesc, credito);
    const beneficiary = extractBeneficiary(rawDesc);
    const description = cleanDescription(rawDesc) || rawDesc || "Movimento M-Pesa";

    // Real balance movement (money in positive, money out negative).
    const realMovement = credito > 0 ? credito : -Math.abs(debito);

    // Stored amount: positive magnitude for income/expense; signed for
    // transfers so that the account-balances delta (`-amount`) reproduces the
    // real movement (money out → +, money in → −). See file header.
    const amount = type === "transfer" ? -realMovement : magnitude;

    // The first anchor in file order is the earliest transaction (the PDF is
    // chronological top→down). Its opening = saldo − realMovement.
    if (firstOpening === null) firstOpening = saldo - realMovement;

    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
    if (type === "income") totalIncome += magnitude;
    else if (type === "expense") totalExpenses += magnitude;
    else totalTransfers += magnitude;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    const tags = [receipt];
    if (beneficiary) tags.push(beneficiary);

    imported.push({
      date,
      description,
      originalCategory: rawDesc,
      mappedCategory: category,
      account: ACCOUNT_NAME,
      amount,
      type,
      status: "completed",
      tags,
      notes: rawDesc,
      needsReview: type === "transfer",
    });
  }

  if (imported.length === 0) {
    return emptyResult("Nenhuma transação M-Pesa encontrada no PDF");
  }

  return {
    success: true,
    total: anchors.length,
    imported,
    skipped,
    errors,
    categoryMapping: {},
    accountsFound: [ACCOUNT_NAME],
    openingBalances:
      firstOpening !== null && minDate
        ? [{ accountName: ACCOUNT_NAME, amount: firstOpening, date: minDate }]
        : [],
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
    summary: { totalIncome, totalExpenses, totalTransfers, categoryCounts },
  };
}
