/**
 * Mobills CSV/Excel Import Parser
 *
 * Parses exported data from Mobills app and maps to BUDGY structure.
 * Mobills exports CSV with columns:
 * - Data (Date), Descrição (Description), Categoria (Category),
 *   Conta (Account), Valor (Amount), Tipo (Type), Estado (Status),
 *   Tags, Notas (Notes)
 *
 * Also handles Mobills Excel (.xlsx) format with the same columns.
 */

import { autoCategorize } from "./auto-categorize";

export interface MobillsTransaction {
  date: string;
  description: string;
  category: string;
  subcategory?: string;
  account: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  status: string;
  tags: string[];
  notes: string;
}

export interface ImportedTransaction {
  date: string;
  description: string;
  originalCategory: string;
  mappedCategory: string;
  account: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  tags: string[];
  notes: string;
  needsReview: boolean;
}

export interface ImportResult {
  success: boolean;
  total: number;
  imported: ImportedTransaction[];
  skipped: number;
  errors: string[];
  categoryMapping: Record<string, string>;
  accountsFound: string[];
  dateRange: { from: string; to: string } | null;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalTransfers: number;
    categoryCounts: Record<string, number>;
  };
}

// ─── Mobills Category Mapping ────────────────────────────────────────────────

/**
 * Maps Mobills Portuguese categories to BUDGY categories.
 * Consolidates the user's many Mobills categories into cleaner groups.
 */
const MOBILLS_CATEGORY_MAP: Record<string, string> = {
  // ─── Real Mobills categories from user data (59 categories) ───

  // Alimentação & Restaurantes
  "supermercado": "Alimentação",
  "talho": "Alimentação",
  "mercearia": "Alimentação",
  "alimentação": "Alimentação",
  "alimentacao": "Alimentação",
  "comida": "Alimentação",
  "padaria": "Alimentação",
  "restaurantes": "Restaurantes",
  "restaurante": "Restaurantes",
  "almoços de família": "Restaurantes",
  "bottle store & smoke": "Restaurantes",
  "café": "Restaurantes",
  "lanche": "Restaurantes",
  "delivery": "Restaurantes",
  "fast food": "Restaurantes",

  // Casa & Contas
  "home bills": "Contas & Serviços",
  "home clothes & dish": "Casa",
  "house appliances & furniture": "Casa",
  "garden": "Casa",
  "manutenção piscina": "Casa",
  "obras e reparações": "Casa",
  "katembe home project": "Casa",
  "aquisição de habitação": "Casa",

  // Saúde & Beleza & Fitness
  "health": "Saúde",
  "beauty": "Beleza & Cuidados",
  "fitness": "Saúde",

  // Educação
  "education": "Educação",
  "7ecos books": "Educação",
  "writing": "Educação",
  "hobbies: escritora & afins": "Educação",

  // Família & Filhos
  "baby cris": "Família",
  "kidz toys and fun": "Família",
  "ajudas familiares": "Família",
  "aniversários": "Família",
  "feriados e festas": "Família",
  "filhos": "Família",
  "família": "Família",
  "familia": "Família",
  "crianças": "Família",
  "criancas": "Família",
  "gift": "Família",
  "gifts": "Família",

  // Transporte & Viatura
  "transportation": "Transporte",
  "aquisição de viatura": "Transporte",
  "transporte": "Transporte",
  "combustível": "Combustível",
  "combustivel": "Combustível",
  "gasolina": "Combustível",
  "gasóleo": "Combustível",
  "uber": "Transporte",
  "bolt": "Transporte",
  "taxi": "Transporte",
  "táxi": "Transporte",
  "chapa": "Transporte",
  "estacionamento": "Transporte",
  "manutenção veículo": "Automóvel",
  "manutenção veiculo": "Automóvel",
  "seguro auto": "Automóvel",
  "carro": "Automóvel",
  "automóvel": "Automóvel",

  // Viagens
  "holidays": "Viagens",
  "viagens despesas": "Viagens",
  "viagens serviço": "Viagens",
  "subsídio viagem": "Viagens",
  "viagem": "Viagens",
  "viagens": "Viagens",
  "férias": "Viagens",
  "ferias": "Viagens",
  "hotel": "Viagens",

  // Pessoal & Roupa
  "clothing": "Roupa",
  "roupa": "Roupa",
  "vestuário": "Roupa",
  "vestuario": "Roupa",
  "despesas pessoais bruno": "Pessoal",
  "pessoal": "Pessoal",
  "personal gadgets": "Compras",
  "espiritualidade": "Pessoal",
  "documentos id": "Pessoal",

  // Subscrições & Digital
  "digital apps & services": "Subscrições",
  "apple bills": "Subscrições",
  "mensalidades coachme": "Subscrições",
  "subscrição": "Subscrições",
  "subscricao": "Subscrições",
  "assinatura": "Subscrições",
  "netflix": "Subscrições",
  "spotify": "Subscrições",
  "streaming": "Subscrições",

  // Lazer & Entretenimento
  "entertainment": "Lazer",
  "lazer": "Lazer",
  "entretenimento": "Lazer",
  "cinema": "Lazer",
  "diversão": "Lazer",
  "levantamentos fim de semana": "Lazer",

  // Animais
  "pets": "Animais",
  "animais": "Animais",

  // Doações & Ofertas
  "donations": "Doações",
  "doação": "Doações",
  "doacao": "Doações",
  "igreja": "Doações",
  "dízimo": "Doações",
  "dizimo": "Doações",
  "caridade": "Doações",
  "oferta": "Doações",

  // Trabalho & Negócio
  "employees wages": "Negócio",
  "sete-ecos project": "Negócio",

  // Dívidas & Empréstimos
  "loan": "Dívidas",
  "empréstimos bancários": "Dívidas",
  "crédito fml": "Dívidas",
  "moza credito": "Dívidas",
  "reembolso lomesio": "Dívidas",
  "empréstimo": "Dívidas",
  "emprestimo": "Dívidas",
  "dívida": "Dívidas",
  "divida": "Dívidas",
  "cartão crédito": "Dívidas",
  "juros": "Dívidas",

  // Taxas Bancárias
  "comissões bancárias": "Taxas Bancárias",
  "taxa": "Taxas Bancárias",
  "taxa bancária": "Taxas Bancárias",
  "comissão": "Taxas Bancárias",

  // Contas & Serviços
  "contas": "Contas & Serviços",
  "água": "Contas & Serviços",
  "agua": "Contas & Serviços",
  "electricidade": "Contas & Serviços",
  "luz": "Contas & Serviços",
  "gás": "Contas & Serviços",
  "gas": "Contas & Serviços",
  "internet": "Comunicação",
  "telefone": "Comunicação",
  "telemóvel": "Comunicação",
  "telemovel": "Comunicação",
  "comunicação": "Comunicação",
  "comunicacao": "Comunicação",
  "tv": "Comunicação",

  // Rendimentos
  "salary": "Salário",
  "salário": "Salário",
  "salario": "Salário",
  "vencimento": "Salário",
  "ordenado": "Salário",
  "bruno income": "Outro Rendimento",
  "vendas": "Outro Rendimento",
  "award": "Outro Rendimento",
  "freelance": "Freelance",
  "bónus": "Bónus",
  "bonus": "Bónus",
  "rendimento": "Outro Rendimento",
  "renda (recebida)": "Rendimento Passivo",
  "dividendos": "Rendimento Passivo",
  "reembolso": "Reembolso",
  "investimento": "Investimento",
  "investimentos": "Investimento",
  "poupança": "Poupança",
  "poupanca": "Poupança",
  "xitique": "Xitique",

  // Compras
  "compras": "Compras",
  "shopping": "Compras",
  "electrónica": "Compras",
  "electronica": "Compras",
  "tecnologia": "Compras",

  // Casa genérico
  "casa": "Casa",
  "moradia": "Casa",
  "renda": "Casa",
  "aluguel": "Casa",
  "aluguer": "Casa",
  "condomínio": "Casa",
  "condominio": "Casa",
  "mobília": "Casa",
  "decoração": "Casa",
  "limpeza": "Casa",
  "empregada": "Casa",
  "doméstica": "Casa",

  // Saúde genérico
  "saúde": "Saúde",
  "saude": "Saúde",
  "farmácia": "Saúde",
  "farmacia": "Saúde",
  "médico": "Saúde",
  "medico": "Saúde",
  "hospital": "Saúde",
  "consulta": "Saúde",
  "dentista": "Saúde",
  "ginásio": "Saúde",
  "ginasio": "Saúde",
  "gym": "Saúde",

  // Educação genérico
  "educação": "Educação",
  "educacao": "Educação",
  "escola": "Educação",
  "universidade": "Educação",
  "curso": "Educação",
  "livros": "Educação",
  "formação": "Educação",
  "formacao": "Educação",
  "propina": "Educação",
  "beleza": "Beleza & Cuidados",
  "cabeleireiro": "Beleza & Cuidados",
  "cosmético": "Beleza & Cuidados",
  "cosmetico": "Beleza & Cuidados",
  "higiene": "Beleza & Cuidados",

  // ─── Mobills default categories (built-in) ───
  "food": "Alimentação",
  "groceries": "Alimentação",
  "meals": "Restaurantes",
  "snacks": "Restaurantes",
  "drinks": "Restaurantes",
  "beverage": "Restaurantes",
  "beverages": "Restaurantes",
  "dining": "Restaurantes",
  "dining out": "Restaurantes",
  "eating out": "Restaurantes",
  "housing": "Casa",
  "rent": "Casa",
  "mortgage": "Casa",
  "home": "Casa",
  "household": "Casa",
  "furniture": "Casa",
  "appliances": "Casa",
  "utilities": "Contas & Serviços",
  "bills": "Contas & Serviços",
  "electricity": "Contas & Serviços",
  "water": "Contas & Serviços",
  "insurance": "Seguros",
  "seguro": "Seguros",
  "seguros": "Seguros",
  "life insurance": "Seguros",
  "health insurance": "Seguros",
  "car insurance": "Seguros",
  "medical": "Saúde",
  "medicine": "Saúde",
  "doctor": "Saúde",
  "pharmacy": "Saúde",
  "wellness": "Saúde",
  "sports": "Lazer",
  "personal care": "Beleza & Cuidados",
  "haircut": "Beleza & Cuidados",
  "salon": "Beleza & Cuidados",
  "clothes": "Roupa",
  "shoes": "Roupa",
  "accessories": "Roupa",
  "toys": "Família",
  "kids": "Família",
  "children": "Família",
  "baby": "Família",
  "daycare": "Família",
  "child care": "Família",
  "school": "Educação",
  "tuition": "Educação",
  "books": "Educação",
  "courses": "Educação",
  "training": "Educação",
  "fuel": "Combustível",
  "gas station": "Combustível",
  "parking": "Transporte",
  "car maintenance": "Automóvel",
  "car repair": "Automóvel",
  "mechanic": "Automóvel",
  "car wash": "Automóvel",
  "vehicle": "Automóvel",
  "travel": "Viagens",
  "flight": "Viagens",
  "flights": "Viagens",
  "accommodation": "Viagens",
  "vacation": "Viagens",
  "charity": "Doações",
  "donation": "Doações",
  "tithe": "Doações",
  "church": "Doações",
  "taxes": "Taxas Bancárias",
  "fees": "Taxas Bancárias",
  "bank fees": "Taxas Bancárias",
  "bank charges": "Taxas Bancárias",
  "interest": "Dívidas",
  "loan payment": "Dívidas",
  "credit card": "Dívidas",
  "debt": "Dívidas",
  "subscription": "Subscrições",
  "subscriptions": "Subscrições",
  "membership": "Subscrições",
  "phone": "Comunicação",
  "mobile": "Comunicação",
  "cellphone": "Comunicação",
  "cable": "Comunicação",
  "movies": "Lazer",
  "music": "Lazer",
  "games": "Lazer",
  "hobbies": "Lazer",
  "hobby": "Lazer",
  "pet": "Animais",
  "veterinary": "Animais",
  "vet": "Animais",
  "wages": "Salário",
  "paycheck": "Salário",
  "savings": "Poupança",
  "refund": "Reembolso",
  "reimbursement": "Reembolso",
  "transfer": "Transferência",
  "wire transfer": "Transferência",
  "atm": "Levantamento",
  "withdrawal": "Levantamento",
  "levantamento": "Levantamento",
  "deposit": "Depósito",
  "deposito": "Depósito",
  "depósito": "Depósito",
  "electronics": "Compras",
  "technology": "Compras",
  "gadgets": "Compras",
  "online shopping": "Compras",
  "miscellaneous": "Outros",
  "general": "Outros",
  "uncategorized": "Outros",
  "sem categoria": "Outros",

  // Genérico
  "others": "Outros",
  "outro": "Outros",
  "outros": "Outros",
  "other": "Outros",
  "paid": "Outros",
  "adjustment": "Ajuste",
  "transferência": "Transferência",
  "transferencia": "Transferência",
  "ajuste": "Ajuste",
};

function normalizeForMapping(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Use the auto-categorize engine (80+ merchant rules) to categorize by description.
 * Returns the category name or null if no match found.
 */
function autoCategorizeFromDescription(description: string): string | null {
  const result = autoCategorize(description, "expense");
  // Only use if confidence is reasonable (system rules match)
  if (result.confidence >= 0.7 && result.category !== "Outros" && result.category !== "Outro Rendimento") {
    return result.category;
  }
  return null;
}

function mapCategory(mobillsCategory: string, subcategory?: string, description?: string): { mapped: string; needsReview: boolean } {
  // Try category first, then subcategory, then combined
  const candidates = [
    mobillsCategory,
    subcategory,
    subcategory ? `${mobillsCategory}: ${subcategory}` : undefined,
  ].filter((c): c is string => !!c && c.length > 0);

  for (const candidate of candidates) {
    const normalized = normalizeForMapping(candidate);

    // Direct match
    if (MOBILLS_CATEGORY_MAP[normalized]) {
      return { mapped: MOBILLS_CATEGORY_MAP[normalized], needsReview: false };
    }

    // Partial match - check if any key is contained in the category name
    // Only match if key is at least 3 chars to avoid false positives
    for (const [key, value] of Object.entries(MOBILLS_CATEGORY_MAP)) {
      if (key.length >= 3 && normalized.includes(key)) {
        return { mapped: value, needsReview: false };
      }
      if (normalized.length >= 3 && key.includes(normalized)) {
        return { mapped: value, needsReview: false };
      }
    }
  }

  // Fallback: try auto-categorize from description (merchant name matching)
  if (description && description.length > 0) {
    const result = autoCategorizeFromDescription(description);
    if (result) {
      return { mapped: result, needsReview: false };
    }
  }

  // No match found — default to Outros
  return { mapped: "Outros", needsReview: true };
}

// ─── CSV Parser ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function detectSeparator(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")  // Strip BOM
    .replace(/^["']|["']$/g, "")  // Strip quotes
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Map possible Mobills column headers to our field names
const HEADER_MAP: Record<string, string> = {
  data: "date",
  date: "date",
  descricao: "description",
  description: "description",
  descri: "description",
  categoria: "category",
  category: "category",
  subcategoria: "subcategory",
  subcategory: "subcategory",
  conta: "account",
  account: "account",
  valor: "amount",
  value: "amount",
  amount: "amount",
  quantia: "amount",
  tipo: "type",
  type: "type",
  estado: "status",
  status: "status",
  tags: "tags",
  tag: "tags",
  notas: "notes",
  notes: "notes",
  observacoes: "notes",
  observacao: "notes",
};

function mapHeaders(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i] ?? "");
    for (const [key, field] of Object.entries(HEADER_MAP)) {
      if (normalized.includes(key)) {
        mapping[i] = field;
        break;
      }
    }
  }
  return mapping;
}

function parseTransactionType(type: string): "income" | "expense" | "transfer" {
  const t = type.toLowerCase().trim();
  if (/recei|income|rend|entrada|cr[eé]dito|receita/i.test(t)) return "income";
  if (/transfer[eê]ncia|transfer/i.test(t)) return "transfer";
  return "expense";
}

function parseMobillsAmount(value: string): number {
  // Remove currency symbols and whitespace
  let cleaned = value.replace(/[MZNTUSDEURGBPZAR$€£R\s]/gi, "").trim();

  // Handle negative amounts (Mobills uses - for expenses sometimes)
  const isNegative = cleaned.startsWith("-");
  if (isNegative) cleaned = cleaned.substring(1);

  // Parse the number (handle both 5.000,00 and 5000.00 formats)
  if (/\d\.\d{3},\d{2}/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/\d,\d{2}$/.test(cleaned)) {
    cleaned = cleaned.replace(",", ".");
  } else if (/\d,\d{3}/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
  }

  const amount = parseFloat(cleaned);
  if (isNaN(amount)) return 0;
  return isNegative ? -amount : amount;
}

function parseMobillsDate(dateStr: string): string {
  // DD/MM/YYYY
  const dmyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    return `${dmyMatch[3]}-${month}-${day}`;
  }

  // YYYY-MM-DD
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch && isoMatch[0]) return isoMatch[0];

  // DD-MM-YYYY
  const dashMatch = dateStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dashMatch && dashMatch[1] && dashMatch[2] && dashMatch[3]) {
    const day = dashMatch[1].padStart(2, "0");
    const month = dashMatch[2].padStart(2, "0");
    return `${dashMatch[3]}-${month}-${day}`;
  }

  return dateStr;
}

// ─── Main Import Function ────────────────────────────────────────────────────

/**
 * Parse Mobills CSV export and return structured transactions.
 */
export function parseMobillsCSV(csvContent: string): ImportResult {
  const errors: string[] = [];
  const imported: ImportedTransaction[] = [];
  let skipped = 0;

  const lines = csvContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      success: false,
      total: 0,
      imported: [],
      skipped: 0,
      errors: ["Ficheiro CSV vazio ou sem dados"],
      categoryMapping: {},
      accountsFound: [],
      dateRange: null,
      summary: { totalIncome: 0, totalExpenses: 0, totalTransfers: 0, categoryCounts: {} },
    };
  }

  // Strip BOM from first line
  if (lines[0]) {
    lines[0] = lines[0].replace(/^\uFEFF/, "");
  }

  // Find header row (may not be the first row - skip metadata rows)
  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i]!.toLowerCase();
    if ((line.includes("data") || line.includes("date")) &&
        (line.includes("descri") || line.includes("categ") || line.includes("valor") || line.includes("amount"))) {
      headerIndex = i;
      break;
    }
  }

  // Detect separator and parse headers
  const firstLine = lines[headerIndex]!;
  const separator = detectSeparator(firstLine);
  const headers = firstLine.split(separator === ";" ? ";" : /,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  const headerMap = mapHeaders(headers);

  // Validate we have minimum required fields
  const fields = Object.values(headerMap);
  if (!fields.includes("date") || !fields.includes("amount")) {
    return {
      success: false,
      total: 0,
      imported: [],
      skipped: 0,
      errors: ["Colunas obrigatórias não encontradas. Preciso pelo menos de Data e Valor."],
      categoryMapping: {},
      accountsFound: [],
      dateRange: null,
      summary: { totalIncome: 0, totalExpenses: 0, totalTransfers: 0, categoryCounts: {} },
    };
  }

  const categoryMapping: Record<string, string> = {};
  const accountsSet = new Set<string>();
  const categoryCounts: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalTransfers = 0;
  let minDate = "";
  let maxDate = "";

  // Parse data rows (start after header row)
  for (let i = headerIndex + 1; i < lines.length; i++) {
    try {
      const line = lines[i]!;
      const values = separator === ";"
        ? line.split(";").map((v) => v.trim().replace(/^"|"$/g, ""))
        : parseCSVLine(line);

      const row: Record<string, string> = {};
      for (const [index, field] of Object.entries(headerMap)) {
        row[field] = values[parseInt(index)] || "";
      }

      // Skip rows without amount
      const rawAmount = parseMobillsAmount(row.amount || "0");
      if (rawAmount === 0) {
        skipped++;
        continue;
      }

      const date = parseMobillsDate(row.date || "");
      const type = row.type ? parseTransactionType(row.type) : (rawAmount < 0 ? "expense" : "income");
      const amount = Math.abs(rawAmount);
      const originalCategory = row.category || "Outros";
      const { mapped, needsReview } = mapCategory(originalCategory, row.subcategory, row.description);

      // Track category mapping
      if (originalCategory !== mapped) {
        categoryMapping[originalCategory] = mapped;
      }

      // Track accounts
      if (row.account) accountsSet.add(row.account);

      // Track date range
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;

      // Track totals
      if (type === "income") totalIncome += amount;
      else if (type === "expense") totalExpenses += amount;
      else totalTransfers += amount;

      // Track category counts
      categoryCounts[mapped] = (categoryCounts[mapped] || 0) + 1;

      imported.push({
        date,
        description: row.description || originalCategory,
        originalCategory,
        mappedCategory: mapped,
        account: row.account || "Principal",
        amount,
        type,
        tags: row.tags ? row.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        notes: row.notes || "",
        needsReview,
      });
    } catch {
      errors.push(`Erro na linha ${i + 1}`);
      skipped++;
    }
  }

  return {
    success: imported.length > 0,
    total: lines.length - headerIndex - 1,
    imported,
    skipped,
    errors,
    categoryMapping,
    accountsFound: Array.from(accountsSet),
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
    summary: {
      totalIncome,
      totalExpenses,
      totalTransfers,
      categoryCounts,
    },
  };
}

// ─── Smart Category Consolidation ────────────────────────────────────────────

/**
 * The BUDGY recommended categories.
 * Simplified from typical Mobills chaos (30+ categories) to clear groups.
 */
export const BUDGY_CATEGORIES = {
  expense: [
    { name: "Alimentação", icon: "🛒", color: "#F59E0B" },
    { name: "Restaurantes", icon: "🍽️", color: "#EF4444" },
    { name: "Transporte", icon: "🚌", color: "#6366F1" },
    { name: "Combustível", icon: "⛽", color: "#8B5CF6" },
    { name: "Automóvel", icon: "🚗", color: "#7C3AED" },
    { name: "Casa", icon: "🏠", color: "#3B82F6" },
    { name: "Contas", icon: "📄", color: "#0EA5E9" },
    { name: "Comunicação", icon: "📱", color: "#06B6D4" },
    { name: "Subscrições", icon: "🔄", color: "#14B8A6" },
    { name: "Saúde", icon: "💊", color: "#10B981" },
    { name: "Educação", icon: "📚", color: "#22C55E" },
    { name: "Pessoal", icon: "👤", color: "#F97316" },
    { name: "Compras", icon: "🛍️", color: "#EC4899" },
    { name: "Lazer", icon: "🎬", color: "#D946EF" },
    { name: "Viagens", icon: "✈️", color: "#A855F7" },
    { name: "Família", icon: "👨‍👩‍👧", color: "#FF6B35" },
    { name: "Animais", icon: "🐾", color: "#78716C" },
    { name: "Doações", icon: "🤝", color: "#F43F5E" },
    { name: "Taxas Bancárias", icon: "🏦", color: "#64748B" },
    { name: "Seguros", icon: "🛡️", color: "#475569" },
    { name: "Dívidas", icon: "💳", color: "#DC2626" },
    { name: "Levantamento", icon: "🏧", color: "#F59E0B" },
    { name: "Roupa", icon: "👗", color: "#E879F9" },
    { name: "Outros", icon: "📦", color: "#94A3B8" },
  ],
  income: [
    { name: "Salário", icon: "💰", color: "#10B981" },
    { name: "Freelance", icon: "💻", color: "#22C55E" },
    { name: "Investimento", icon: "📈", color: "#059669" },
    { name: "Rendimento Passivo", icon: "🔄", color: "#047857" },
    { name: "Bónus", icon: "🎁", color: "#34D399" },
    { name: "Reembolso", icon: "↩️", color: "#6EE7B7" },
    { name: "Xitique", icon: "🤝", color: "#FF6B35" },
    { name: "Outro Rendimento", icon: "💵", color: "#A7F3D0" },
  ],
  transfer: [
    { name: "Transferência", icon: "↔️", color: "#3B82F6" },
    { name: "Poupança", icon: "🐷", color: "#10B981" },
    { name: "Investimento", icon: "📊", color: "#8B5CF6" },
    { name: "Xitique", icon: "🤝", color: "#FF6B35" },
    { name: "Levantamento", icon: "🏧", color: "#F59E0B" },
    { name: "Depósito", icon: "📥", color: "#06B6D4" },
  ],
} as const;

/**
 * Get all unique BUDGY categories from an import result,
 * showing which Mobills categories map to each.
 */
export function getCategoryConsolidationPreview(
  result: ImportResult
): Array<{
  vidaCategory: string;
  mobillsCategories: string[];
  transactionCount: number;
}> {
  const consolidation = new Map<string, { mobillsCategories: Set<string>; count: number }>();

  for (const tx of result.imported) {
    const entry = consolidation.get(tx.mappedCategory) || {
      mobillsCategories: new Set<string>(),
      count: 0,
    };
    entry.mobillsCategories.add(tx.originalCategory);
    entry.count++;
    consolidation.set(tx.mappedCategory, entry);
  }

  return Array.from(consolidation.entries())
    .map(([vidaCategory, data]) => ({
      vidaCategory,
      mobillsCategories: Array.from(data.mobillsCategories),
      transactionCount: data.count,
    }))
    .sort((a, b) => b.transactionCount - a.transactionCount);
}
