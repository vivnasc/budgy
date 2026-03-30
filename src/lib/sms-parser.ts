/**
 * SMS Parser for Mozambican Banks & Mobile Money
 *
 * Parses transaction SMS from:
 * - M-Pesa (Vodacom)
 * - e-Mola (Movitel)
 * - BIM (Millennium BIM)
 * - BCI (Banco Comercial e de Investimentos)
 * - Standard Bank
 * - FNB Moçambique
 * - Absa Moçambique
 *
 * Returns structured transaction data ready for validation.
 */

export interface ParsedSMS {
  /** Which bank/provider was detected */
  source: string;
  /** Transaction type */
  type: "income" | "expense" | "transfer";
  /** Amount in the original currency */
  amount: number;
  /** Currency code */
  currency: string;
  /** Remaining balance after transaction (if available) */
  balance?: number | null;
  /** Transaction date */
  date: Date;
  /** Description/counterparty */
  description: string;
  /** Reference number (if available) */
  reference?: string;
  /** Account hint (last digits, account name) */
  accountHint?: string;
  /** Raw SMS text for reference */
  rawText: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Suggested category based on description */
  suggestedCategory?: string;
}

export interface SMSParseResult {
  success: boolean;
  transaction?: ParsedSMS;
  error?: string;
}

// ─── Amount Parsing ──────────────────────────────────────────────────────────

function parseAmount(text: string): number | null {
  // Match patterns like: 5.000,00 | 5,000.00 | 5000.00 | 5000,00 | 500
  // Mozambican format uses dot for thousands, comma for decimals: 5.000,00
  const patterns = [
    // 5.000,00 or 15.000,00 (MZ format: dot=thousands, comma=decimal)
    /(\d{1,3}(?:\.\d{3})*,\d{2})/,
    // 5,000.00 (US format: comma=thousands, dot=decimal)
    /(\d{1,3}(?:,\d{3})*\.\d{2})/,
    // 5000.00 (simple decimal)
    /(\d+\.\d{2})/,
    // 5000,00 (simple with comma decimal)
    /(\d+,\d{2})/,
    // 5000 (integer)
    /(\d{3,})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let numStr: string = match[1];
      // If MZ format (has dots before comma): 5.000,00
      if (/\d\.\d{3},\d{2}/.test(numStr)) {
        numStr = numStr.replace(/\./g, "").replace(",", ".");
      }
      // If has comma as decimal: 5000,00
      else if (/\d,\d{2}$/.test(numStr) && !/\.\d/.test(numStr)) {
        numStr = numStr.replace(",", ".");
      }
      // If US format: 5,000.00
      else if (/\d,\d{3}/.test(numStr)) {
        numStr = numStr.replace(/,/g, "");
      }
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

// ─── Date Parsing ────────────────────────────────────────────────────────────

function parseDate(text: string): Date {
  // DD/MM/YYYY HH:MM
  const fullMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (fullMatch && fullMatch[1] && fullMatch[2] && fullMatch[3] && fullMatch[4] && fullMatch[5]) {
    return new Date(
      parseInt(fullMatch[3]),
      parseInt(fullMatch[2]) - 1,
      parseInt(fullMatch[1]),
      parseInt(fullMatch[4]),
      parseInt(fullMatch[5])
    );
  }

  // DD/MM/YYYY
  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
    return new Date(
      parseInt(dateMatch[3]),
      parseInt(dateMatch[2]) - 1,
      parseInt(dateMatch[1])
    );
  }

  // DD-MM-YYYY
  const dashMatch = text.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (dashMatch && dashMatch[1] && dashMatch[2] && dashMatch[3]) {
    return new Date(
      parseInt(dashMatch[3]),
      parseInt(dashMatch[2]) - 1,
      parseInt(dashMatch[1])
    );
  }

  // YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    return new Date(
      parseInt(isoMatch[1]),
      parseInt(isoMatch[2]) - 1,
      parseInt(isoMatch[3])
    );
  }

  return new Date();
}

// ─── Balance Extraction ──────────────────────────────────────────────────────

function extractBalance(text: string): number | null {
  const patterns = [
    /[Ss]aldo\s*(?:dispon[ií]vel)?:?\s*(?:MZN|MT|Kz)?\s*([\d.,]+)/i,
    /[Nn]ovo\s+[Ss]aldo:?\s*(?:MZN|MT|Kz)?\s*([\d.,]+)/i,
    /[Bb]alance:?\s*(?:MZN|MT|Kz)?\s*([\d.,]+)/i,
    /[Ss]aldo:?\s*(?:MZN|MT|Kz)?\s*([\d.,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return parseAmount(match[1]);
    }
  }
  return null;
}

// ─── Reference Extraction ────────────────────────────────────────────────────

function extractReference(text: string): string | undefined {
  const patterns = [
    /[Rr]ef(?:er[eê]ncia)?:?\s*([A-Z0-9]+)/,
    /[Tt]rans(?:a[cç][çã]o)?:?\s*([A-Z0-9]+)/,
    /ID:?\s*([A-Z0-9]+)/,
    /[Nn]\.?\s*([A-Z0-9]{6,})/,
    /[Cc]omprovativo:?\s*([A-Z0-9]+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1];
  }
  return undefined;
}

// ─── Bank-Specific Parsers ───────────────────────────────────────────────────

function parseMPesa(text: string): ParsedSMS | null {
  const normalized = text.trim();

  // M-Pesa send money: "Confirmado. Kz X enviados para NAME..."
  // M-Pesa receive: "Recebeu Kz X de NAME..."
  // M-Pesa payment: "Pagamento de Kz X para NAME..."
  // M-Pesa withdrawal: "Levantamento de Kz X..."
  // M-Pesa deposit: "Depósito de Kz X..."

  let type: "income" | "expense" | "transfer" = "expense";
  let description = "";

  if (/[Rr]eceb[eu]/i.test(normalized)) {
    type = "income";
    const nameMatch = normalized.match(/[Rr]eceb\w+\s+(?:MZN|MT|Kz)?\s*[\d.,]+\s+de\s+(.+?)(?:\.|Novo|Ref|$)/i);
    description = nameMatch?.[1] ? `Recebido de ${nameMatch[1].trim()}` : "Recebimento M-Pesa";
  } else if (/[Ee]nviad/i.test(normalized)) {
    type = "expense";
    const nameMatch = normalized.match(/enviad\w+\s+para\s+(.+?)(?:\.|Novo|Ref|$)/i);
    description = nameMatch?.[1] ? `Enviado para ${nameMatch[1].trim()}` : "Envio M-Pesa";
  } else if (/[Pp]agamento/i.test(normalized)) {
    type = "expense";
    const nameMatch = normalized.match(/[Pp]agamento\s+(?:de\s+)?(?:MZN|MT|Kz)?\s*[\d.,]+\s+para\s+(.+?)(?:\.|Novo|Ref|$)/i);
    description = nameMatch?.[1] ? `Pagamento a ${nameMatch[1].trim()}` : "Pagamento M-Pesa";
  } else if (/[Ll]evantamento/i.test(normalized)) {
    type = "transfer";
    description = "Levantamento M-Pesa";
  } else if (/[Dd]ep[oó]sito/i.test(normalized)) {
    type = "income";
    description = "Depósito M-Pesa";
  }

  const amount = parseAmount(normalized);
  if (!amount) return null;

  return {
    source: "M-Pesa",
    type,
    amount,
    currency: "MZN",
    balance: extractBalance(normalized),
    date: parseDate(normalized),
    description,
    reference: extractReference(normalized),
    accountHint: "M-Pesa",
    rawText: text,
    confidence: 0.85,
  };
}

function parseEmola(text: string): ParsedSMS | null {
  const normalized = text.trim();

  let type: "income" | "expense" | "transfer" = "expense";
  let description = "";

  if (/[Rr]eceb/i.test(normalized)) {
    type = "income";
    const nameMatch = normalized.match(/[Rr]eceb\w+\s+(?:MZN|MT)?\s*[\d.,]+\s+de\s+(.+?)(?:\.|Novo|Saldo|$)/i);
    description = nameMatch?.[1] ? `Recebido de ${nameMatch[1].trim()}` : "Recebimento e-Mola";
  } else if (/[Ee]nviad|[Tt]ransfer/i.test(normalized)) {
    type = "expense";
    const nameMatch = normalized.match(/(?:enviad\w+|transfer\w+)\s+(?:para\s+)?(.+?)(?:\.|Novo|Saldo|$)/i);
    description = nameMatch?.[1] ? `Enviado para ${nameMatch[1].trim()}` : "Envio e-Mola";
  } else if (/[Pp]agamento/i.test(normalized)) {
    type = "expense";
    description = "Pagamento e-Mola";
  }

  const amount = parseAmount(normalized);
  if (!amount) return null;

  return {
    source: "e-Mola",
    type,
    amount,
    currency: "MZN",
    balance: extractBalance(normalized),
    date: parseDate(normalized),
    description,
    reference: extractReference(normalized),
    accountHint: "e-Mola",
    rawText: text,
    confidence: 0.8,
  };
}

function parseBIM(text: string): ParsedSMS | null {
  const normalized = text.trim();

  let type: "income" | "expense" | "transfer" = "expense";
  let description = "";
  let accountHint: string | undefined;

  // Extract account number hint
  const accountMatch = normalized.match(/conta\s*[*]?(\d{2,4})/i);
  if (accountMatch?.[1]) accountHint = `****${accountMatch[1]}`;

  if (/[Cc]r[eé]dito/i.test(normalized)) {
    type = "income";
    description = "Crédito BIM";
    const detailMatch = normalized.match(/[Cc]r[eé]dito\s+(?:de\s+)?(?:MZN|MT)?\s*[\d.,]+\s+(?:MZN|MT)?\s*(?:na\s+conta\s+\S+\s+)?(?:em\s+\S+\s+)?(?:ref:?\s*)?(.+?)(?:\.|Saldo|$)/i);
    if (detailMatch?.[1]?.trim()) {
      description = `Crédito: ${detailMatch[1].trim()}`;
    }
  } else if (/[Dd][eé]bito/i.test(normalized)) {
    type = "expense";
    description = "Débito BIM";
    const detailMatch = normalized.match(/[Dd][eé]bito\s+(?:de\s+)?(?:MZN|MT)?\s*[\d.,]+\s+(?:MZN|MT)?\s*(?:na\s+conta\s+\S+\s+)?(?:em\s+\S+\s+)?(?:ref:?\s*)?(.+?)(?:\.|Saldo|$)/i);
    if (detailMatch?.[1]?.trim()) {
      description = `Débito: ${detailMatch[1].trim()}`;
    }
  } else if (/[Tt]ransfer[eê]ncia/i.test(normalized)) {
    type = "transfer";
    description = "Transferência BIM";
  }

  const amount = parseAmount(normalized);
  if (!amount) return null;

  return {
    source: "Millennium BIM",
    type,
    amount,
    currency: "MZN",
    balance: extractBalance(normalized),
    date: parseDate(normalized),
    description,
    reference: extractReference(normalized),
    accountHint: accountHint || "BIM",
    rawText: text,
    confidence: 0.9,
  };
}

function parseBCI(text: string): ParsedSMS | null {
  const normalized = text.trim();

  let type: "income" | "expense" | "transfer" = "expense";
  let description = "";
  let accountHint: string | undefined;

  const accountMatch = normalized.match(/conta\s*[*]?(\d{2,4})/i);
  if (accountMatch?.[1]) accountHint = `****${accountMatch[1]}`;

  if (/[Cc]r[eé]dito|[Cc]reditado/i.test(normalized)) {
    type = "income";
    description = "Crédito BCI";
  } else if (/[Dd][eé]bito|[Dd]ebitado/i.test(normalized)) {
    type = "expense";
    description = "Débito BCI";
  } else if (/[Mm]ovimento\s+de\s+d[eé]bito/i.test(normalized)) {
    type = "expense";
    description = "Débito BCI";
  } else if (/[Mm]ovimento\s+de\s+cr[eé]dito/i.test(normalized)) {
    type = "income";
    description = "Crédito BCI";
  } else if (/[Tt]ransfer[eê]ncia/i.test(normalized)) {
    type = "transfer";
    description = "Transferência BCI";
  }

  const amount = parseAmount(normalized);
  if (!amount) return null;

  return {
    source: "BCI",
    type,
    amount,
    currency: "MZN",
    balance: extractBalance(normalized),
    date: parseDate(normalized),
    description,
    reference: extractReference(normalized),
    accountHint: accountHint || "BCI",
    rawText: text,
    confidence: 0.9,
  };
}

function parseStandardBank(text: string): ParsedSMS | null {
  const normalized = text.trim();

  let type: "income" | "expense" | "transfer" = "expense";
  let description = "";

  if (/[Cc]r[eé]dito|[Dd]ep[oó]sito|[Rr]eceb/i.test(normalized)) {
    type = "income";
    description = "Crédito Standard Bank";
  } else if (/[Dd][eé]bito|[Pp]agamento|[Cc]ompra/i.test(normalized)) {
    type = "expense";
    description = "Débito Standard Bank";
  } else if (/[Tt]ransfer[eê]ncia/i.test(normalized)) {
    type = "transfer";
    description = "Transferência Standard Bank";
  }

  const amount = parseAmount(normalized);
  if (!amount) return null;

  return {
    source: "Standard Bank",
    type,
    amount,
    currency: "MZN",
    balance: extractBalance(normalized),
    date: parseDate(normalized),
    description,
    reference: extractReference(normalized),
    accountHint: "Standard Bank",
    rawText: text,
    confidence: 0.85,
  };
}

function parseGenericBank(text: string): ParsedSMS | null {
  const normalized = text.trim();

  let type: "income" | "expense" | "transfer" = "expense";
  let description = "Transação bancária";
  let source = "Banco";

  // Detect bank name
  if (/FNB/i.test(normalized)) source = "FNB";
  else if (/Absa/i.test(normalized)) source = "Absa";
  else if (/Nedbank/i.test(normalized)) source = "Nedbank";
  else if (/Moza[Bb]anco/i.test(normalized)) source = "Moza Banco";

  // Detect type
  if (/[Cc]r[eé]dito|[Rr]eceb|[Dd]ep[oó]sito|entrada/i.test(normalized)) {
    type = "income";
    description = `Crédito ${source}`;
  } else if (/[Dd][eé]bito|[Pp]agamento|[Cc]ompra|sa[ií]da|levantamento/i.test(normalized)) {
    type = "expense";
    description = `Débito ${source}`;
  } else if (/[Tt]ransfer/i.test(normalized)) {
    type = "transfer";
    description = `Transferência ${source}`;
  }

  const amount = parseAmount(normalized);
  if (!amount) return null;

  return {
    source,
    type,
    amount,
    currency: "MZN",
    balance: extractBalance(normalized),
    date: parseDate(normalized),
    description,
    reference: extractReference(normalized),
    rawText: text,
    confidence: 0.6,
  };
}

// ─── Source Detection ────────────────────────────────────────────────────────

function detectSource(text: string): string {
  const upper = text.toUpperCase();
  if (/M[\s-]?PESA|MPESA|VODACOM/i.test(upper)) return "mpesa";
  if (/E[\s-]?MOLA|EMOLA|MOVITEL/i.test(upper)) return "emola";
  if (/BIM|MILLENNIUM/i.test(upper)) return "bim";
  if (/BCI|COMERCIAL\s+E\s+DE\s+INVEST/i.test(upper)) return "bci";
  if (/STANDARD\s*BANK/i.test(upper)) return "standard";
  return "generic";
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

/**
 * Parse a single SMS message and extract transaction data.
 */
export function parseSMS(text: string): SMSParseResult {
  if (!text || text.trim().length < 10) {
    return { success: false, error: "Mensagem SMS muito curta" };
  }

  const source = detectSource(text);
  let transaction: ParsedSMS | null = null;

  switch (source) {
    case "mpesa":
      transaction = parseMPesa(text);
      break;
    case "emola":
      transaction = parseEmola(text);
      break;
    case "bim":
      transaction = parseBIM(text);
      break;
    case "bci":
      transaction = parseBCI(text);
      break;
    case "standard":
      transaction = parseStandardBank(text);
      break;
    default:
      transaction = parseGenericBank(text);
      break;
  }

  if (!transaction) {
    return {
      success: false,
      error: "Não foi possível extrair dados da mensagem. Verifica se é uma notificação de transação bancária.",
    };
  }

  // Auto-suggest category based on description
  transaction.suggestedCategory = suggestCategory(transaction);

  return { success: true, transaction };
}

/**
 * Parse multiple SMS messages (bulk paste, one per line or separated by blank lines).
 */
export function parseBulkSMS(text: string): SMSParseResult[] {
  // Split by double newlines or by common SMS separators
  const messages = text
    .split(/\n{2,}|(?=(?:M-Pesa|BIM|BCI|Standard Bank|e-Mola|Confirmado|Recebeu))/gi)
    .map((m) => m.trim())
    .filter((m) => m.length > 10);

  return messages.map((msg) => parseSMS(msg));
}

// ─── Category Suggestion ─────────────────────────────────────────────────────

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  // Food & Groceries
  { pattern: /shoprite|spar|game|pingo\s*doce|supermercado|mercado|feira|padaria|talho|mercearia/i, category: "Alimentação" },
  // Restaurants & Eating Out
  { pattern: /restaurante|caf[eé]|bar|pizza|chicken|kfc|galitos|nandos|steers/i, category: "Restaurantes" },
  // Transport
  { pattern: /combusti?vel|gasol?ina|gas[oó]leo|gasolineira|galp|puma|total|engen|bp\b|petromoc/i, category: "Combustível" },
  { pattern: /chapa|uber|bolt|taxi|t[aá]xi|estacionamento|portagem/i, category: "Transporte" },
  // Housing
  { pattern: /renda|aluguer|aluguel|condom[ií]nio|hipoteca/i, category: "Casa" },
  // Utilities
  { pattern: /edm\b|electricidade|[aá]gua|fipag|luz/i, category: "Contas" },
  { pattern: /vodacom|movitel|tmcel|mcel|internet|wifi|tv\s*cabo|dstv|zap\s*tv/i, category: "Comunicação" },
  // Health
  { pattern: /farm[aá]cia|hospital|cl[ií]nica|m[eé]dico|consulta|laborat[oó]rio|sa[uú]de/i, category: "Saúde" },
  // Education
  { pattern: /escola|universidade|curso|propina|livr|material\s*escolar|educa[çc][aã]o/i, category: "Educação" },
  // Shopping
  { pattern: /compra|loja|shopping|centro\s*comercial|roupa|sapato|moda/i, category: "Compras" },
  // Entertainment
  { pattern: /cinema|teatro|concerto|festa|lazer|divers[aã]o|jogo|bilhete/i, category: "Lazer" },
  // Salary & Income
  { pattern: /sal[aá]rio|vencimento|ordenado|pagamento\s*mensal/i, category: "Salário" },
  { pattern: /freelance|servi[çc]o|trabalho/i, category: "Freelance" },
  // Transfer between own accounts
  { pattern: /transfer[eê]ncia\s+(?:pr[oó]pria|interna|entre\s+contas)/i, category: "Transferência" },
  // Mobile money specific
  { pattern: /levantamento/i, category: "Levantamento" },
  { pattern: /dep[oó]sito/i, category: "Depósito" },
];

function suggestCategory(transaction: ParsedSMS): string {
  const searchText = `${transaction.description} ${transaction.rawText}`;

  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(searchText)) {
      return category;
    }
  }

  // Default categories by type
  if (transaction.type === "income") return "Outro Rendimento";
  if (transaction.type === "transfer") return "Transferência";
  return "Outros";
}

// ─── Supported Banks Info ────────────────────────────────────────────────────

export const SUPPORTED_BANKS = [
  { id: "mpesa", name: "M-Pesa (Vodacom)", icon: "📱", color: "#E60000" },
  { id: "emola", name: "e-Mola (Movitel)", icon: "📱", color: "#FF6B00" },
  { id: "bim", name: "Millennium BIM", icon: "🏦", color: "#003366" },
  { id: "bci", name: "BCI", icon: "🏦", color: "#004B93" },
  { id: "standard", name: "Standard Bank", icon: "🏦", color: "#0033A0" },
  { id: "fnb", name: "FNB Moçambique", icon: "🏦", color: "#009A44" },
  { id: "absa", name: "Absa Moçambique", icon: "🏦", color: "#AF0C3E" },
] as const;
