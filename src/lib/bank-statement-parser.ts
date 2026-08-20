/**
 * Bank Statement CSV Parsers
 *
 * Parses real bank statement exports from Mozambican banks:
 * - CPC (Caixa de Poupança e Crédito) - English CSV, dot decimals
 * - Moza Banco - Portuguese CSV, semicolon-separated, comma decimals
 * - Standard Bank - Excel format (uses xlsx parser)
 *
 * Each parser handles the specific quirks of its bank's export format.
 */

import type { ImportResult, ImportedTransaction } from "./mobills-import";
import { autoCategorize } from "./auto-categorize";

// ─── Types ──────────────────────────────────────────────────────────────────

export type BankFormat = "cpc" | "moza" | "standard-bank" | "mobills" | "auto";

export interface BankInfo {
  id: BankFormat;
  name: string;
  description: string;
  fileTypes: string[];
  icon: string;
}

export const SUPPORTED_BANK_FORMATS: BankInfo[] = [
  {
    id: "auto",
    name: "Detetar Automaticamente",
    description: "O BUDGY deteta o formato do ficheiro",
    fileTypes: [".csv", ".xlsx"],
    icon: "sparkles",
  },
  {
    id: "mobills",
    name: "Outra app",
    description: "Exportação de outra app de finanças",
    fileTypes: [".csv", ".xlsx"],
    icon: "smartphone",
  },
  {
    id: "cpc",
    name: "Extrato CSV (Inglês)",
    description: "CSV com colunas em inglês e ponto decimal",
    fileTypes: [".csv"],
    icon: "building",
  },
  {
    id: "moza",
    name: "Extrato CSV (Português)",
    description: "CSV com ponto-e-vírgula e vírgula decimal",
    fileTypes: [".csv"],
    icon: "building",
  },
  {
    id: "standard-bank",
    name: "Extrato Excel",
    description: "Ficheiro Excel (.xlsx) do banco",
    fileTypes: [".xlsx"],
    icon: "building",
  },
];

// ─── Auto-Detection ─────────────────────────────────────────────────────────

export function detectBankFormat(content: string, filename?: string): BankFormat {
  const lowerFilename = filename?.toLowerCase() ?? "";

  // Filename hints take priority — the user labelled the file already
  if (lowerFilename.includes("cpc")) return "cpc";
  if (lowerFilename.includes("moza")) return "moza";
  if (lowerFilename.includes("standardbank") || lowerFilename.includes("standard bank")) {
    return "standard-bank";
  }
  if (lowerFilename.includes("mobills")) return "mobills";

  // CPC: English headers with Transaction Date + Debit/Credit columns.
  // Match flexibly — exact header punctuation varies between exports.
  const looksLikeCPC =
    /Transaction\s+Date/i.test(content) &&
    /Debit/i.test(content) &&
    /Credit/i.test(content);
  if (looksLikeCPC) return "cpc";
  // Some CPC exports replace "OPENING BALANCE" anywhere in the file
  if (/OPENING BALANCE/i.test(content) && !/Saldo de Abertura/i.test(content)) {
    return "cpc";
  }

  // Moza Banco: BOM + "sep=;" or "Saldo de Abertura" header
  if (content.includes("sep=;") || /Saldo de Abertura/i.test(content)) {
    return "moza";
  }

  // Mobills: typical Portuguese/English category headers
  if (/descri[çc][aã]o.*categori/i.test(content) || /description.*category/i.test(content)) {
    return "mobills";
  }

  return "mobills"; // default fallback
}

// ─── CPC Parser ─────────────────────────────────────────────────────────────

/**
 * CPC CSV format:
 * Header: Transaction Date,Value Date,Transaction Ref.,Description,Debit,Credit,Balance
 * Date format: DD MON YYYY (e.g. "05 JAN 2026")
 * Amounts: dot decimal, negative debit (e.g. -269.45)
 * Special rows: OPENING BALANCE, CLOSING BALANCE
 * Description contains: merchant|payment info
 */

const CPC_MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

function parseCPCDate(dateStr: string): string {
  const match = dateStr.trim().match(/(\d{2})\s+([A-Z]{3})\s+(\d{4})/);
  if (!match || !match[1] || !match[2] || !match[3]) return dateStr;
  const month = CPC_MONTHS[match[2]];
  if (month === undefined) return dateStr;
  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1]}`;
}

function parseCPCAmount(value: string): number {
  if (!value || value.trim() === "") return 0;
  const cleaned = value.replace(/[,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractCPCDescription(raw: string): { description: string; merchant: string } {
  // Format: "Pagamento no PV (VISA)  |HOTMART 4029357733 USA"
  // Or: "Compra no Ponto de Venda (OIC)  |365 FITNESS Maputo - KaMpfMZ"
  // Or: "Transf Interb (CPC-NET) Online VSARAIVA Minha Conta Moza"
  // Or: "PAGAMENTO SALARIO CR  BMSAL"

  const pipeIndex = raw.indexOf("|");
  if (pipeIndex !== -1) {
    const merchant = raw.substring(pipeIndex + 1).trim();
    // Clean location suffixes like "Maputo - KaMpfMZ"
    const cleanedMerchant = merchant
      .replace(/\s+(?:Maputo|Beira|Nampula|Chimoio|Quelimane|Tete)\s*-\s*\w+\s*(?:MZ)?$/i, "")
      .replace(/\s+\d{10,}/g, "") // Remove card numbers
      .replace(/\s+[A-Z]{3}$/, "") // Remove country codes like USA, IRL, SGP
      .trim();
    return { description: raw.split("|")[0]!.trim(), merchant: cleanedMerchant };
  }

  // No pipe — the description IS the merchant info
  return { description: raw.trim(), merchant: raw.trim() };
}

export function parseCPCStatement(csvContent: string): ImportResult {
  const errors: string[] = [];
  const imported: ImportedTransaction[] = [];
  let skipped = 0;

  const lines = csvContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return emptyResult("Ficheiro CPC vazio ou sem dados");
  }

  // Skip header
  const accountsSet = new Set<string>(["CPC"]);
  const categoryCounts: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalTransfers = 0;
  let minDate = "";
  let maxDate = "";
  let openingBalance: { amount: number; date: string } | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;

    // Extract OPENING BALANCE before skipping. CPC format examples:
    //   "01 JAN 2026,01 JAN 2026,,OPENING BALANCE,,,1234567.89,..."
    //   "OPENING BALANCE,,,,,,1234567.89"
    if (/OPENING BALANCE/i.test(line)) {
      const fields = parseCSVLine(line);
      // The balance column on CPC sits in position 6 (0-indexed) — same as
      // Balance for normal rows. Fall back to the last numeric column.
      const parsed = (() => {
        const byIdx = parseCPCAmount(fields[6] ?? "");
        if (byIdx) return byIdx;
        for (let j = fields.length - 1; j >= 0; j--) {
          const n = parseCPCAmount(fields[j] ?? "");
          if (n) return n;
        }
        return 0;
      })();
      const candidateDate = parseCPCDate(fields[0] ?? "");
      const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(candidateDate)
        ? candidateDate
        : new Date().toISOString().split("T")[0]!;
      if (parsed !== 0) openingBalance = { amount: parsed, date: isoDate };
      continue;
    }
    if (/^CLOSING BALANCE/i.test(line)) continue;

    // Parse CSV line (CPC uses comma-separated with possible quoted fields)
    const fields = parseCSVLine(line);

    // CPC format: Transaction Date, Value Date(?), Transaction Ref., Description, Debit, Credit, Balance, Account(?), Code(?)
    // The actual data shows extra trailing fields (account number, code)
    if (fields.length < 5) {
      errors.push(`Linha ${i + 1}: formato inválido`);
      skipped++;
      continue;
    }

    const transDateRaw = fields[0]!;
    const txRef = fields[2] ?? "";
    const descriptionRaw = fields[3] ?? "";
    const debitRaw = fields[4] ?? "";
    const creditRaw = fields[5] ?? "";

    // Parse date
    const date = parseCPCDate(transDateRaw);
    if (date === transDateRaw && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Skip non-parseable date lines (might be a continuation or metadata)
      skipped++;
      continue;
    }

    // Parse amounts
    const debit = parseCPCAmount(debitRaw);
    const credit = parseCPCAmount(creditRaw);

    const amount = credit > 0 ? credit : Math.abs(debit);
    if (amount === 0) {
      skipped++;
      continue;
    }

    // Determine type
    let type: "income" | "expense" | "transfer" = "expense";
    const { description, merchant } = extractCPCDescription(descriptionRaw);

    if (credit > 0) {
      type = "income";
    }

    // Detect transfers between the user's OWN accounts (CPC → Moza/Standard).
    // These move money between her own pockets — not income, not spending.
    //  - "Transf ... Interb/Intrab"      → interbank between own accounts
    //  - "Transf. Conta a Conta"          → same-bank move (incl. the big BALCAO
    //                                       pass-throughs and card provisioning)
    //  - "Transf. METIX via NIB Enviada"  → own-account move ONLY when nothing
    //                                       follows "Enviada". When a beneficiary
    //                                       name follows (IB-...-Creche/Adao/...)
    //                                       it is a real payment → stays expense.
    const metixBeneficiary = /Transf\.?\s+METIX\s+via\s+NIB\s+Enviada\s*(\S.*)?$/i.exec(descriptionRaw);
    if (
      /Transf(?:erencia)?\s+Interb/i.test(descriptionRaw) ||
      /Transferencia\s+Intrab/i.test(descriptionRaw) ||
      /Transf\.?\s+Conta a Conta/i.test(descriptionRaw) ||
      (metixBeneficiary !== null && !metixBeneficiary[1])
    ) {
      type = "transfer";
    }

    // Detect commissions as expense
    if (/^Comissao/i.test(descriptionRaw)) {
      type = "expense";
    }

    // Auto-categorize based on merchant/description
    const searchText = `${merchant} ${description}`;
    const categoryResult = autoCategorize(searchText, type, amount);

    // Special CPC-specific categorization
    let mappedCategory = categoryResult.category;
    if (/PAGAMENTO SALARIO/i.test(descriptionRaw)) mappedCategory = "Salário";
    else if (/Prestacao Mensal Emprestimo/i.test(descriptionRaw)) mappedCategory = "Dívidas";
    else if (/Comissao Trf/i.test(descriptionRaw)) mappedCategory = "Taxas Bancárias";
    else if (/DIVIDENDOS/i.test(descriptionRaw)) mappedCategory = "Rendimento Passivo";
    else if (/Regularizacao ATM/i.test(descriptionRaw)) mappedCategory = "Reembolso";
    else if (/MINHA CONTA/i.test(descriptionRaw) || (type === "transfer" && /METIX|Conta a Conta/i.test(descriptionRaw))) mappedCategory = "Transferência";
    else if (/Creche|CENTR\w*\s*INFANTIL|PIKINICO|Col[eé]gio|Escola/i.test(descriptionRaw)) mappedCategory = "Educação";
    else if (/Adao\s+Baptista/i.test(descriptionRaw)) mappedCategory = "Compras";
    else if (/Transf.+Breno|Transf.+Nazira/i.test(descriptionRaw)) mappedCategory = "Família";
    else if (/Anuidade.*cart[aã]o|Imposto de selo/i.test(descriptionRaw)) mappedCategory = "Taxas Bancárias";

    // Track stats
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
    if (type === "income") totalIncome += amount;
    else if (type === "expense") totalExpenses += amount;
    else totalTransfers += amount;
    categoryCounts[mappedCategory] = (categoryCounts[mappedCategory] || 0) + 1;

    // Build display description
    const displayDesc = merchant || description;

    imported.push({
      date,
      description: displayDesc,
      originalCategory: description,
      mappedCategory,
      account: "CPC",
      amount,
      type,
      status: "completed",
      tags: txRef ? [txRef] : [],
      notes: descriptionRaw,
      needsReview: categoryResult.confidence < 0.5,
    });
  }

  // The CPC "OPENING BALANCE" line carries no usable date of its own — it is
  // the balance that existed right BEFORE the earliest transaction in the
  // file. Anchor it to minDate so calibration sums zero movements before it
  // (same convention as Moza). Without this the date fell back to "today",
  // which made applyOpeningBalance treat the opening figure as the CURRENT
  // balance and wrongly collapse the account total to the opening amount.
  if (openingBalance && minDate) {
    openingBalance.date = minDate;
  }

  return {
    success: imported.length > 0,
    total: lines.length - 1,
    imported,
    skipped,
    errors,
    categoryMapping: {},
    accountsFound: Array.from(accountsSet),
    openingBalances: openingBalance
      ? [{ accountName: "CPC", amount: openingBalance.amount, date: openingBalance.date }]
      : [],
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
    summary: { totalIncome, totalExpenses, totalTransfers, categoryCounts },
  };
}

// ─── Moza Banco Parser ──────────────────────────────────────────────────────

/**
 * Moza Banco CSV format:
 * Line 1: "sep=;"
 * Line 2: account number + ";"
 * Line 3: "Saldo de Abertura: ;170896,25"
 * Line 4: "Saldo de fecho: ;292261,03"
 * Line 5: "Moeda;MZN"
 * Line 6: "Data;Data-Valor;Descrição;Nº de Ref;Débito;Crédito;Saldo"
 * Data rows: semicolon-separated, quoted descriptions, comma decimals
 */

function parseMozaAmount(value: string): number {
  if (!value || value.trim() === "") return 0;
  // Moza format: -2420,00 or 100000,00
  let cleaned = value.trim().replace(/\s/g, "");
  const isNegative = cleaned.startsWith("-");
  if (isNegative) cleaned = cleaned.substring(1);

  // Handle comma decimal: 2420,00 → 2420.00
  // Handle dots as thousands separator: 170.896,25 → 170896.25
  if (/\d\.\d{3},\d{2}/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/,\d{2}$/.test(cleaned)) {
    cleaned = cleaned.replace(",", ".");
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseMozaDate(dateStr: string): string {
  // DD/MM/YYYY
  const match = dateStr.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match || !match[1] || !match[2] || !match[3]) return dateStr;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function extractMozaDescription(raw: string): string {
  // Remove surrounding quotes
  let desc = raw.replace(/^"|"$/g, "").trim();

  // Clean card number prefix: "Compra 402546******2463  Mv84 KFC - HOSP"
  desc = desc.replace(/^Compra\s+\d+\*+\d+\s+Mv\d*\s*/i, "");

  // Clean levantamento prefix: "Levantamento 402546******2463 Mv80 PRACA"
  desc = desc.replace(/^Levantamento\s+\d+\*+\d+\s+Mv\d*\s*/i, "Levantamento ");

  // Clean "Purchase MERCHANT 9635985 ENET- Suspensa UOT POS-VISA" patterns.
  // The merchant name sits between "Purchase" and the 6-7 digit terminal id.
  // Examples:
  //   "Purchase NETFLIXCOM 40872 9635985 ENET- Suspensa UOT POS-VISA"
  //   "Purchase ANTARIO SUPERMER 9635985 ENET Suspensa UOT-POS REDE"
  if (/^Purchase\s+/i.test(desc)) {
    desc = desc
      .replace(/^Purchase\s+/i, "")
      // Strip terminal id + ENET POS noise from the end
      .replace(/\s+\d{6,}\s*ENET[\s-]*Suspens[ao]\s*UOT[\s-]*POS[\s-]*(?:REDE|VISA).*$/i, "")
      .replace(/\s+\d{6,}\s*ENET.*$/i, "")
      .trim();
  }

  // Clean "Compra Recarga Credelec EDM Susp. CREDELEC Netplus" patterns
  // (utility recharges via Netplus)
  if (/Recarga\s+Credelec|EDM\s+Susp|CREDELEC/i.test(desc)) {
    desc = "Recarga Credelec EDM";
  }

  // Strip generic transfer-banking suffixes
  desc = desc.replace(/\s*ENET[\s-]*Suspens[ao]\s*UOT[\s-]*POS[\s-]*(?:REDE|VISA)\s*$/i, "");
  desc = desc.replace(/\s*ENET\s+UOT\s+Transferencias\s+Recebidas\s*$/i, "");
  desc = desc.trim();

  // Clean M-Pesa transfer format: "TRF_Cart_Dig_Mpesa846313848"
  if (/^TRF_Cart_Dig_Mpesa/i.test(desc)) {
    const phone = desc.replace(/^TRF_Cart_Dig_Mpesa/i, "");
    desc = `M-Pesa para ${phone}`;
  }

  // Clean e-Mola transfer: "TRF_Cart_Dig_Emola867929276"
  if (/^TRF_Cart_Dig_Emola/i.test(desc)) {
    const phone = desc.replace(/^TRF_Cart_Dig_Emola/i, "");
    desc = `e-Mola para ${phone}`;
  }

  // Clean TEI RCB (incoming transfer): "TEI RCB Transferencia 25 03"
  if (/^TEI RCB/i.test(desc)) {
    const detail = desc.replace(/^TEI RCB\s*/i, "").trim();
    desc = `Transferência recebida ${detail}`;
  }

  // Clean MTR BIM ORD. (salary): "MTR BIM ORD. MASTERWORKS LDA"
  if (/^MTR BIM ORD\./i.test(desc)) {
    const company = desc.replace(/^MTR BIM ORD\.\s*/i, "").trim();
    desc = `Salário ${company}`;
  }

  // Clean TRF-Name (internal transfer): "TRF-Breno"
  if (/^TRF-/i.test(desc)) {
    const name = desc.replace(/^TRF-/i, "").trim();
    desc = `Transferência para ${name}`;
  }

  return desc.trim();
}

export function parseMozaBancoStatement(csvContent: string): ImportResult {
  const errors: string[] = [];
  const imported: ImportedTransaction[] = [];
  let skipped = 0;

  // Remove BOM
  const content = csvContent.replace(/^\uFEFF/, "").replace(/^\u200B/, "");

  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 7) {
    return emptyResult("Ficheiro Moza Banco vazio ou sem dados");
  }

  // Find header row (contains "Data;Data-Valor;Descrição")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i]!.includes("Data") && lines[i]!.includes("Descri")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return emptyResult("Cabeçalho do Moza Banco não encontrado");
  }

  // Extract account info from metadata
  const accountNumber = lines[1]?.replace(/;.*$/, "").trim() ?? "Moza Banco";

  // Extract "Saldo de Abertura" amount from the header lines. Moza Banco
  // format: "Saldo de Abertura: ;170896,25" (semi-colon separated).
  let openingAmount: number | null = null;
  let openingDate: string | null = null;
  for (let i = 0; i < headerIndex; i++) {
    const ln = lines[i]!;
    if (/saldo\s*de\s*abertura/i.test(ln)) {
      const parts = ln.split(";").map((p) => p.trim().replace(/^"|"$/g, ""));
      // The amount is the first non-label numeric token after "Saldo de Abertura"
      for (const p of parts) {
        if (/saldo|abertura/i.test(p)) continue;
        const n = parseMozaAmount(p);
        if (n !== 0) {
          openingAmount = n;
          break;
        }
      }
    }
  }

  const accountsSet = new Set<string>(["Moza Banco"]);
  const categoryCounts: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalTransfers = 0;
  let minDate = "";
  let maxDate = "";

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i]!;
    const fields = line.split(";").map((f) => f.replace(/^"|"$/g, "").trim());

    // Expected: Data, Data-Valor, Descrição, Nº de Ref, Débito, Crédito, Saldo
    if (fields.length < 6) {
      skipped++;
      continue;
    }

    const dateRaw = fields[0] ?? "";
    const descriptionRaw = fields[2] ?? "";
    const refNumber = fields[3] ?? "";
    const debitRaw = fields[4] ?? "";
    const creditRaw = fields[5] ?? "";

    const date = parseMozaDate(dateRaw);
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      skipped++;
      continue;
    }

    const debit = parseMozaAmount(debitRaw);
    const credit = parseMozaAmount(creditRaw);

    const amount = credit > 0 ? credit : debit;
    if (amount === 0) {
      skipped++;
      continue;
    }

    // Determine type and clean description
    let type: "income" | "expense" | "transfer" = "expense";
    const cleanDesc = extractMozaDescription(descriptionRaw);

    if (credit > 0) {
      type = "income";
    }

    // Detect transfers
    if (/TRF_Cart_Dig|TRF-/i.test(descriptionRaw)) {
      type = "transfer";
    }

    // Commissions and taxes are expenses
    if (/^Comissão|^Imposto de Selo/i.test(descriptionRaw)) {
      type = "expense";
    }

    // Levantamento (ATM withdrawal)
    if (/^Levantamento/i.test(descriptionRaw)) {
      type = "transfer";
    }

    // Auto-categorize
    const categoryResult = autoCategorize(cleanDesc, type, amount);

    // Moza-specific categorization
    let mappedCategory = categoryResult.category;
    if (/Comissão.*MPESA|Comissão.*Carteira/i.test(descriptionRaw)) mappedCategory = "Taxas Bancárias";
    else if (/Imposto de Selo/i.test(descriptionRaw)) mappedCategory = "Taxas Bancárias";
    else if (/Comissão Levantamento/i.test(descriptionRaw)) mappedCategory = "Taxas Bancárias";
    else if (/Anuidade|Imposto de selo s\/ Despesa/i.test(descriptionRaw)) mappedCategory = "Taxas Bancárias";
    else if (/Pagamento de Cart[aã]o de Cr[eé]dito/i.test(descriptionRaw)) mappedCategory = "Dívidas";
    else if (/TRF_Cart_Dig_Mpesa/i.test(descriptionRaw)) mappedCategory = "Transferência";
    else if (/TRF_Cart_Dig_Emola/i.test(descriptionRaw)) mappedCategory = "Transferência";
    else if (/TEI RCB.*Sal\b|MTR BIM ORD/i.test(descriptionRaw)) mappedCategory = "Salário";
    else if (/TEI RCB.*Transfer/i.test(descriptionRaw)) mappedCategory = "Transferência";
    else if (/TRF-Breno/i.test(descriptionRaw)) mappedCategory = "Família";
    else if (/Levantamento/i.test(descriptionRaw)) mappedCategory = "Levantamento";

    // Track stats
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
    if (type === "income") totalIncome += amount;
    else if (type === "expense") totalExpenses += amount;
    else totalTransfers += amount;
    categoryCounts[mappedCategory] = (categoryCounts[mappedCategory] || 0) + 1;

    imported.push({
      date,
      description: cleanDesc,
      originalCategory: descriptionRaw.replace(/^"|"$/g, ""),
      mappedCategory,
      account: "Moza Banco",
      amount,
      type,
      status: "completed",
      tags: refNumber ? [refNumber] : [],
      notes: descriptionRaw.replace(/^"|"$/g, ""),
      needsReview: categoryResult.confidence < 0.5,
    });
  }

  // For Moza, the opening balance refers to the date right before the
  // earliest transaction in the file
  if (openingAmount !== null && minDate) {
    openingDate = minDate;
  }

  return {
    success: imported.length > 0,
    total: lines.length - headerIndex - 1,
    imported,
    skipped,
    errors,
    categoryMapping: {},
    accountsFound: Array.from(accountsSet),
    openingBalances:
      openingAmount !== null && openingDate
        ? [{ accountName: "Moza Banco", amount: openingAmount, date: openingDate }]
        : [],
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
    summary: { totalIncome, totalExpenses, totalTransfers, categoryCounts },
  };
}

// ─── Excel Parser (for Mobills .xlsx and Standard Bank .xlsx) ────────────────

export async function parseExcelFile(
  buffer: ArrayBuffer,
  format: BankFormat
): Promise<ImportResult> {
  try {
    // Dynamic import to avoid bundling xlsx when not needed
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "array" });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return emptyResult("Ficheiro Excel vazio");
    }

    if (format === "mobills") {
      // The Mobills Excel export typically has 4 sheets:
      //   "Receitas e Despesas" — combined view (income + expenses)
      //   "Expenses"            — duplicate subset of the combined sheet
      //   "Incomes"             — duplicate subset of the combined sheet
      //   "Transfers"           — different columns: Date, Conta origem, Conta destino, Value
      //
      // To avoid duplicates we parse only the combined sheet for income/expense.
      // If the combined sheet is missing we fall back to Expenses + Incomes.
      // The Transfers sheet is parsed separately because its column layout is different.
      const { parseMobillsCSV, parseMobillsTransfersCSV } = await import("./mobills-import");
      const results: ImportResult[] = [];

      const sheetByLowerName: Record<string, string> = {};
      for (const name of workbook.SheetNames) {
        sheetByLowerName[name.toLowerCase()] = name;
      }

      const combinedName =
        sheetByLowerName["receitas e despesas"] ||
        sheetByLowerName["receitas e despesa"] ||
        sheetByLowerName["expenses and incomes"] ||
        sheetByLowerName["all"];

      const sheetToCsv = (name: string): string | null => {
        const ws = workbook.Sheets[name];
        if (!ws) return null;
        const csv = XLSX.utils.sheet_to_csv(ws, { FS: "," });
        const lines = csv.split("\n").filter((l) => l.trim().length > 0);
        return lines.length >= 2 ? csv : null;
      };

      if (combinedName) {
        const csv = sheetToCsv(combinedName);
        if (csv) results.push(parseMobillsCSV(csv));
      } else {
        // Fall back: parse Expenses + Incomes individually
        for (const name of workbook.SheetNames) {
          const lower = name.toLowerCase();
          if (lower === "transfers" || lower === "transferências" || lower === "transferencias") continue;
          const csv = sheetToCsv(name);
          if (csv) results.push(parseMobillsCSV(csv));
        }
      }

      // Always parse the Transfers sheet if present
      const transfersName =
        sheetByLowerName["transfers"] ||
        sheetByLowerName["transferências"] ||
        sheetByLowerName["transferencias"];
      if (transfersName) {
        const csv = sheetToCsv(transfersName);
        if (csv) results.push(parseMobillsTransfersCSV(csv));
      }

      // No combined sheet AND no fallback sheets parsed → first sheet as last resort
      if (results.length === 0) {
        const firstCsv = sheetToCsv(firstSheetName);
        if (!firstCsv) return emptyResult("Ficheiro Excel vazio");
        return parseMobillsCSV(firstCsv);
      }

      return results.length === 1 ? results[0]! : mergeImportResults(results);
    }

    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      return emptyResult("Folha de cálculo vazia");
    }

    // Convert to CSV then parse with appropriate parser
    const csvContent = XLSX.utils.sheet_to_csv(worksheet, { FS: "," });

    if (format === "standard-bank") {
      return parseStandardBankCSV(csvContent);
    }

    // Auto-detect from converted content
    const detected = detectBankFormat(csvContent);
    if (detected === "cpc") return parseCPCStatement(csvContent);
    if (detected === "moza") return parseMozaBancoStatement(csvContent);

    // Default to Mobills
    const { parseMobillsCSV } = await import("./mobills-import");
    return parseMobillsCSV(csvContent);
  } catch {
    return emptyResult("Erro ao ler ficheiro Excel. Verifica se o formato está correcto.");
  }
}

function mergeImportResults(results: ImportResult[]): ImportResult {
  const merged: ImportResult = {
    success: false,
    total: 0,
    imported: [],
    skipped: 0,
    errors: [],
    categoryMapping: {},
    accountsFound: [],
    dateRange: null,
    summary: { totalIncome: 0, totalExpenses: 0, totalTransfers: 0, categoryCounts: {} },
  };

  let minDate = "";
  let maxDate = "";
  const accountsSet = new Set<string>();
  const debugHeaders: string[] = [];
  const debugRawCategoryCounts: Record<string, number> = {};

  for (const r of results) {
    if (!r.success) continue;
    merged.success = true;
    merged.total += r.total;
    merged.imported.push(...r.imported);
    merged.skipped += r.skipped;
    merged.errors.push(...r.errors);
    Object.assign(merged.categoryMapping, r.categoryMapping);
    r.accountsFound.forEach((a) => accountsSet.add(a));
    merged.summary.totalIncome += r.summary.totalIncome;
    merged.summary.totalExpenses += r.summary.totalExpenses;
    merged.summary.totalTransfers += r.summary.totalTransfers;
    for (const [cat, count] of Object.entries(r.summary.categoryCounts)) {
      merged.summary.categoryCounts[cat] = (merged.summary.categoryCounts[cat] || 0) + count;
    }
    if (r.dateRange) {
      if (!minDate || r.dateRange.from < minDate) minDate = r.dateRange.from;
      if (!maxDate || r.dateRange.to > maxDate) maxDate = r.dateRange.to;
    }
    // Merge debug info
    if (r.debug) {
      if (debugHeaders.length === 0) debugHeaders.push(...r.debug.detectedHeaders);
      for (const [cat, count] of Object.entries(r.debug.rawCategoryCounts)) {
        debugRawCategoryCounts[cat] = (debugRawCategoryCounts[cat] || 0) + count;
      }
    }
  }

  merged.accountsFound = Array.from(accountsSet);
  merged.dateRange = minDate && maxDate ? { from: minDate, to: maxDate } : null;

  // Merge debug from first successful result + combined raw categories
  const firstDebug = results.find((r) => r.debug)?.debug;
  if (firstDebug) {
    merged.debug = {
      ...firstDebug,
      rawCategoryCounts: debugRawCategoryCounts,
      detectedHeaders: debugHeaders.length > 0 ? debugHeaders : firstDebug.detectedHeaders,
    };
  }

  return merged;
}

// ─── Standard Bank Parser ───────────────────────────────────────────────────

function parseStandardBankCSV(csvContent: string): ImportResult {
  const errors: string[] = [];
  const imported: ImportedTransaction[] = [];
  let skipped = 0;

  const lines = csvContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return emptyResult("Ficheiro Standard Bank vazio ou sem dados");
  }

  // Find header row
  let headerIndex = -1;
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i]!.toLowerCase();
    if ((line.includes("data") || line.includes("date")) && (line.includes("descri") || line.includes("valor") || line.includes("amount"))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    // Try to parse anyway assuming first row is header
    headerIndex = 0;
  }

  const headers = parseCSVLine(lines[headerIndex]!);
  const headerMap = mapStandardBankHeaders(headers);

  const accountsSet = new Set<string>(["Standard Bank"]);
  const categoryCounts: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalTransfers = 0;
  let minDate = "";
  let maxDate = "";
  // Standard Bank carries no explicit "opening balance" header, but it does
  // have a running "Saldo" column. We capture the running balance of the
  // chronologically newest row (the closing balance) and back-derive the
  // opening so the import can calibrate the account without any manual step.
  // Bank exports are ordered consistently (either newest- or oldest-first);
  // we detect which by comparing the first and last rows' dates, which avoids
  // the same-date ambiguity of an intra-loop max.
  let firstBalance: number | null = null;
  let firstBalanceDate = "";
  let lastBalance: number | null = null;
  let lastBalanceDate = "";

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i]!;
    const fields = parseCSVLine(line);

    const row: Record<string, string> = {};
    for (const [index, field] of Object.entries(headerMap)) {
      row[field] = fields[parseInt(index)] ?? "";
    }

    const date = parseFlexibleDate(row.date ?? "");
    if (!date) {
      skipped++;
      continue;
    }

    // Track the running balance of the first and last rows in file order.
    if (row.balance) {
      const bal = parseFlexibleAmount(row.balance);
      if (firstBalance === null) {
        firstBalance = bal;
        firstBalanceDate = date;
      }
      lastBalance = bal;
      lastBalanceDate = date;
    }

    const debit = parseFlexibleAmount(row.debit ?? "");
    const credit = parseFlexibleAmount(row.credit ?? "");
    const singleAmount = parseFlexibleAmount(row.amount ?? "");

    const amount = credit > 0 ? credit : debit > 0 ? debit : Math.abs(singleAmount);
    if (amount === 0) {
      skipped++;
      continue;
    }

    let description = (row.description ?? "Standard Bank").trim();
    let type: "income" | "expense" | "transfer" = "expense";
    if (credit > 0 || singleAmount > 0) type = "income";

    // Clean Standard Bank descriptions — same POS/ENET noise as Moza Banco
    // "Purchase FARMACIA FELIZ L 9635985  ENET Suspensa UOT-POS REDE" → "FARMACIA FELIZ L"
    // "Lvto. C. Auto. Av Angola 9635985  ATM SB - ..." → "Levantamento"
    // "Transferencia IVA ..." → "Transferência ..."
    if (/^Purchase\s+/i.test(description)) {
      description = description
        .replace(/^Purchase\s+/i, "")
        .replace(/\s+\d{6,}.*$/i, "")
        .trim();
    } else if (/^Lvto\.\s*C\.\s*Auto\./i.test(description)) {
      type = "transfer";
      description = "Levantamento ATM";
    } else if (/^Transferencia\b/i.test(description)) {
      type = "income";
      description = description.replace(/\s+\d{6,}.*$/i, "").replace(/\s+ENET.*$/i, "").trim();
    } else if (/^Refund\b/i.test(description)) {
      type = "income";
      description = description.replace(/\s+\d{6,}.*$/i, "").trim();
    }
    // Strip trailing card number + ENET/POS noise generically
    description = description
      .replace(/\s+\d{6,}\s+(?:ENET|ATM|POS).*$/i, "")
      .replace(/\s+\d{6,}\s+\w+\s+\w+.*$/i, "")
      .trim();

    const categoryResult = autoCategorize(description, type, amount);

    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
    if (type === "income") totalIncome += amount;
    else if (type === "expense") totalExpenses += amount;
    else totalTransfers += amount;
    categoryCounts[categoryResult.category] = (categoryCounts[categoryResult.category] || 0) + 1;

    imported.push({
      date,
      description,
      originalCategory: description,
      mappedCategory: categoryResult.category,
      account: "Standard Bank",
      amount,
      type,
      status: "completed",
      tags: [],
      notes: "",
      needsReview: categoryResult.confidence < 0.5,
    });
  }

  // Pick the closing balance as the running balance of the chronologically
  // newest row. Detect file order from the first vs last row's dates.
  let closingBalance: number | null = null;
  if (firstBalance !== null && lastBalance !== null) {
    closingBalance = firstBalanceDate >= lastBalanceDate ? firstBalance : lastBalance;
  }

  // Back-derive the opening balance from the closing balance minus the net of
  // all movements in the file, anchored to the earliest transaction date.
  // applyOpeningBalance then sums zero movements before it (first import) and
  // calibrates the account to the real closing balance.
  let openingBalances: Array<{ accountName: string; amount: number; date: string }> = [];
  if (closingBalance !== null && minDate) {
    const netSigned = totalIncome - totalExpenses - totalTransfers;
    const openingAmount = closingBalance - netSigned;
    openingBalances = [{ accountName: "Standard Bank", amount: openingAmount, date: minDate }];
  }

  return {
    success: imported.length > 0,
    total: lines.length - headerIndex - 1,
    imported,
    skipped,
    errors,
    categoryMapping: {},
    accountsFound: Array.from(accountsSet),
    openingBalances,
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
    summary: { totalIncome, totalExpenses, totalTransfers, categoryCounts },
  };
}

// ─── Unified Parser ─────────────────────────────────────────────────────────

/**
 * Parse any bank statement file (CSV or text content).
 * Detects format automatically or uses specified format.
 */
export function parseBankStatement(
  content: string,
  format: BankFormat = "auto",
  filename?: string
): ImportResult {
  const detectedFormat = format === "auto" ? detectBankFormat(content, filename) : format;

  switch (detectedFormat) {
    case "cpc":
      return parseCPCStatement(content);
    case "moza":
      return parseMozaBancoStatement(content);
    case "standard-bank":
      return parseStandardBankCSV(content);
    case "mobills":
    default: {
      // Dynamic import not possible synchronously, use inline
      // parseMobillsCSV is imported at call site
      return emptyResult("Use parseMobillsCSV para ficheiros Mobills");
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function mapStandardBankHeaders(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (h.includes("data") || h.includes("date")) mapping[i] = "date";
    else if (h.includes("descri")) mapping[i] = "description";
    else if (h.includes("debito") || h.includes("debit")) mapping[i] = "debit";
    else if (h.includes("credito") || h.includes("credit")) mapping[i] = "credit";
    else if (h.includes("valor") || h.includes("amount") || h.includes("montante")) mapping[i] = "amount";
    else if (h.includes("saldo") || h.includes("balance")) mapping[i] = "balance";
    else if (h.includes("ref")) mapping[i] = "reference";
  }
  return mapping;
}

function parseFlexibleDate(dateStr: string): string | null {
  const cleaned = dateStr.trim();
  if (!cleaned) return null;

  // DD/MM/YYYY
  const dmy = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy && dmy[1] && dmy[2] && dmy[3]) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  // YYYY-MM-DD
  const iso = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso && iso[0]) return iso[0];

  // DD-MM-YYYY
  const dash = cleaned.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dash && dash[1] && dash[2] && dash[3]) {
    return `${dash[3]}-${dash[2].padStart(2, "0")}-${dash[1].padStart(2, "0")}`;
  }

  // DD MON YYYY
  const mon = cleaned.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (mon && mon[1] && mon[2] && mon[3]) {
    return parseCPCDate(cleaned);
  }

  return null;
}

function parseFlexibleAmount(value: string): number {
  if (!value || value.trim() === "") return 0;
  let cleaned = value.trim().replace(/[^\d.,-]/g, "");
  const isNegative = cleaned.startsWith("-");
  if (isNegative) cleaned = cleaned.substring(1);

  if (/\d\.\d{3},\d{2}/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/,\d{2}$/.test(cleaned)) {
    cleaned = cleaned.replace(",", ".");
  } else if (/\d,\d{3}/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
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
