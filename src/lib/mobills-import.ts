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
  mappedSubcategory?: string;
  account: string;
  /** For type="transfer": the destination account name. */
  transferToAccount?: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  status: "pending" | "completed" | "cancelled";
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
  /**
   * Opening balances detected in the file (e.g. CPC's "OPENING BALANCE" line,
   * Moza Banco's "Saldo de Abertura" header). Used to calibrate the account
   * balance automatically on import without the user computing differences.
   */
  openingBalances?: Array<{
    accountName: string;
    amount: number;
    /** ISO date YYYY-MM-DD — the date the opening balance refers to. */
    date: string;
  }>;
  dateRange: { from: string; to: string } | null;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalTransfers: number;
    categoryCounts: Record<string, number>;
  };
  debug?: {
    detectedHeaders: string[];
    headerMapping: Record<string, string>;
    rawCategorySample: string[];
    rawCategoryCounts: Record<string, number>;
    headerRowIndex: number;
    sampleRow?: Record<string, string>;
  };
}

// ─── Mobills Category Mapping ────────────────────────────────────────────────

/**
 * Maps Mobills Portuguese categories to BUDGY categories.
 * Consolidates the user's many Mobills categories into cleaner groups.
 */
const MOBILLS_CATEGORY_MAP: Record<string, string> = {
  // ─── Alimentação (subcategorias separadas) ───
  "supermercado": "Alimentação",
  "talho": "Alimentação",
  "mercearia": "Alimentação",
  "alimentação": "Alimentação",
  "alimentacao": "Alimentação",
  "comida": "Alimentação",
  "padaria": "Alimentação",

  // ─── Restaurantes ───
  "restaurantes": "Restaurantes",
  "restaurante": "Restaurantes",
  "almoços de família": "Restaurantes",
  "café": "Restaurantes",
  "lanche": "Restaurantes",
  "delivery": "Restaurantes",
  "fast food": "Restaurantes",

  // ─── Lazer & Entretenimento ───
  "bottle store & smoke": "Lazer",
  "entertainment": "Lazer",
  "lazer": "Lazer",
  "entretenimento": "Lazer",
  "cinema": "Lazer",
  "diversão": "Lazer",
  "aniversários": "Lazer",
  "feriados e festas": "Lazer",
  "gift": "Lazer",
  "gifts": "Lazer",
  "hobbies: escritora & afins": "Pessoal",

  // ─── Casa & Domésticos ───
  "home bills": "Casa",
  "home clothes & dish": "Casa",
  "house appliances & furniture": "Casa",
  "garden": "Casa",
  "manutenção piscina": "Casa",
  "obras e reparações": "Casa",
  "employees wages": "Casa",
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

  // ─── Investimento (imóvel, viatura — NÃO é despesa corrente) ───
  "katembe home project": "Investimento",
  "aquisição de habitação": "Investimento",
  "aquisição de viatura": "Investimento",

  // ─── Saúde ───
  "health": "Saúde",
  "fitness": "Saúde",
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

  // ─── Beleza & Cuidados ───
  "beauty": "Beleza & Cuidados",
  "beleza": "Beleza & Cuidados",
  "cabeleireiro": "Beleza & Cuidados",
  "cosmético": "Beleza & Cuidados",
  "cosmetico": "Beleza & Cuidados",
  "higiene": "Beleza & Cuidados",

  // ─── Educação (só filhos/escola) ───
  "education": "Educação",
  "educação": "Educação",
  "educacao": "Educação",
  "escola": "Educação",
  "universidade": "Educação",
  "propina": "Educação",

  // ─── Pessoal (desenvolvimento pessoal, hobbies, documentos) ───
  "writing": "Pessoal",
  "7ecos books": "Pessoal",
  "despesas pessoais bruno": "Pessoal",
  "pessoal": "Pessoal",
  "espiritualidade": "Pessoal",
  "documentos id": "Pessoal",
  "curso": "Pessoal",
  "livros": "Pessoal",
  "formação": "Pessoal",
  "formacao": "Pessoal",

  // ─── Família (filhos + apoio familiar) ───
  "baby cris": "Família",
  "kidz toys and fun": "Família",
  "ajudas familiares": "Família",
  "filhos": "Família",
  "família": "Família",
  "familia": "Família",
  "crianças": "Família",
  "criancas": "Família",

  // ─── Transporte (inclui combustível e manutenção) ───
  "transportation": "Transporte",
  "transporte": "Transporte",
  "combustível": "Transporte",
  "combustivel": "Transporte",
  "gasolina": "Transporte",
  "gasóleo": "Transporte",
  "uber": "Transporte",
  "bolt": "Transporte",
  "taxi": "Transporte",
  "táxi": "Transporte",
  "chapa": "Transporte",
  "estacionamento": "Transporte",
  "manutenção veículo": "Transporte",
  "manutenção veiculo": "Transporte",
  "seguro auto": "Transporte",
  "carro": "Transporte",
  "automóvel": "Transporte",

  // ─── Viagens (só despesas de viagem) ───
  "holidays": "Viagens",
  "viagens despesas": "Viagens",
  "viagem": "Viagens",
  "viagens": "Viagens",
  "férias": "Viagens",
  "ferias": "Viagens",
  "hotel": "Viagens",

  // ─── Rendimentos (separados correctamente) ───
  "salary": "Salário",
  "salário": "Salário",
  "salario": "Salário",
  "vencimento": "Salário",
  "ordenado": "Salário",
  "mensalidades coachme": "Freelance",
  "bruno income": "Freelance",
  "vendas": "Freelance",
  "sete-ecos project": "Freelance",
  "viagens serviço": "Outro Rendimento",
  "subsídio viagem": "Outro Rendimento",
  "award": "Bónus",
  "freelance": "Freelance",
  "bónus": "Bónus",
  "bonus": "Bónus",
  "rendimento": "Outro Rendimento",
  "renda (recebida)": "Rendimento Passivo",
  "dividendos": "Rendimento Passivo",
  "reembolso": "Reembolso",
  "reembolso lomesio": "Reembolso",
  "investimento": "Investimento",
  "investimentos": "Investimento",
  "poupança": "Poupança",
  "poupanca": "Poupança",
  "xitique": "Xitique",

  // ─── Roupa ───
  "clothing": "Roupa",
  "roupa": "Roupa",
  "vestuário": "Roupa",
  "vestuario": "Roupa",

  // ─── Subscrições & Digital ───
  "digital apps & services": "Subscrições",
  "apple bills": "Subscrições",
  "apple bill": "Subscrições",
  "subscrição": "Subscrições",
  "subscricao": "Subscrições",
  "assinatura": "Subscrições",
  "netflix": "Subscrições",
  "spotify": "Subscrições",
  "streaming": "Subscrições",

  // ─── Compras ───
  "personal gadgets": "Compras",
  "compras": "Compras",
  "shopping": "Compras",
  "electrónica": "Compras",
  "electronica": "Compras",
  "tecnologia": "Compras",

  // ─── Animais ───
  "pets": "Animais",
  "animais": "Animais",

  // ─── Doações & Contribuições ───
  "donations": "Doações",
  "doação": "Doações",
  "doacao": "Doações",
  "igreja": "Doações",
  "dízimo": "Doações",
  "dizimo": "Doações",
  "caridade": "Doações",
  "oferta": "Doações",

  // ─── Dívidas & Empréstimos ───
  "loan": "Dívidas",
  "empréstimos bancários": "Dívidas",
  "crédito fml": "Dívidas",
  "moza credito": "Dívidas",
  "empréstimo": "Dívidas",
  "emprestimo": "Dívidas",
  "dívida": "Dívidas",
  "divida": "Dívidas",
  "cartão crédito": "Dívidas",
  "juros": "Dívidas",

  // ─── Taxas Bancárias ───
  "comissões bancárias": "Taxas Bancárias",
  "taxa": "Taxas Bancárias",
  "taxa bancária": "Taxas Bancárias",
  "comissão": "Taxas Bancárias",

  // ─── Contas & Serviços ───
  "contas": "Contas & Serviços",
  "água": "Contas & Serviços",
  "agua": "Contas & Serviços",
  "electricidade": "Contas & Serviços",
  "luz": "Contas & Serviços",
  "gás": "Contas & Serviços",
  "gas": "Contas & Serviços",

  // ─── Comunicação ───
  "internet": "Comunicação",
  "telefone": "Comunicação",
  "telemóvel": "Comunicação",
  "telemovel": "Comunicação",
  "comunicação": "Comunicação",
  "comunicacao": "Comunicação",
  "tv": "Comunicação",

  // ─── Levantamentos ATM ───
  "levantamentos fim de semana": "Levantamentos",

  // ─── Genérico ───
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

/**
 * Maps Mobills Portuguese categories to BUDGY subcategories.
 * Each key matches MOBILLS_CATEGORY_MAP — the subcategory is more specific.
 */
const MOBILLS_SUBCATEGORY_MAP: Record<string, string> = {
  // ─── Alimentação ───
  "supermercado": "Supermercado",
  "talho": "Talho",
  "mercearia": "Mercearia",
  "alimentação": "Geral",
  "alimentacao": "Geral",
  "comida": "Geral",
  "padaria": "Padaria",

  // ─── Restaurantes ───
  "restaurantes": "Refeições Fora",
  "restaurante": "Refeições Fora",
  "almoços de família": "Refeições em Grupo",
  "café": "Cafés & Snacks",
  "lanche": "Cafés & Snacks",
  "delivery": "Entregas",
  "fast food": "Fast Food",

  // ─── Lazer ───
  "bottle store & smoke": "Bares & Bebidas",
  "entertainment": "Entretenimento",
  "lazer": "Geral",
  "entretenimento": "Entretenimento",
  "cinema": "Cinema & Espectáculos",
  "diversão": "Geral",
  "aniversários": "Celebrações",
  "feriados e festas": "Celebrações",
  "gift": "Presentes",
  "gifts": "Presentes",

  // ─── Casa ───
  "home bills": "Contas da Casa",
  "home clothes & dish": "Têxteis & Utensílios",
  "house appliances & furniture": "Electrodomésticos",
  "garden": "Jardim",
  "manutenção piscina": "Piscina",
  "obras e reparações": "Obras & Reparações",
  "employees wages": "Empregados Domésticos",
  "casa": "Geral",
  "moradia": "Habitação",
  "renda": "Renda / Aluguer",
  "aluguel": "Renda / Aluguer",
  "aluguer": "Renda / Aluguer",
  "condomínio": "Condomínio",
  "condominio": "Condomínio",
  "mobília": "Mobília & Decoração",
  "decoração": "Mobília & Decoração",
  "limpeza": "Limpeza",
  "empregada": "Empregados Domésticos",
  "doméstica": "Empregados Domésticos",

  // ─── Investimento ───
  "katembe home project": "Projecto Habitação",
  "aquisição de habitação": "Imóvel",
  "aquisição de viatura": "Viatura",

  // ─── Saúde ───
  "health": "Geral",
  "fitness": "Fitness & Ginásio",
  "saúde": "Geral",
  "saude": "Geral",
  "farmácia": "Farmácia",
  "farmacia": "Farmácia",
  "médico": "Consulta Médica",
  "medico": "Consulta Médica",
  "hospital": "Hospital",
  "consulta": "Consulta Médica",
  "dentista": "Dentista",
  "ginásio": "Fitness & Ginásio",
  "ginasio": "Fitness & Ginásio",
  "gym": "Fitness & Ginásio",

  // ─── Beleza & Cuidados ───
  "beauty": "Estética",
  "beleza": "Estética",
  "cabeleireiro": "Cabeleireiro",
  "cosmético": "Cosméticos",
  "cosmetico": "Cosméticos",
  "higiene": "Higiene",

  // ─── Educação (filhos) ───
  "education": "Educação Filhos",
  "educação": "Geral",
  "educacao": "Geral",
  "escola": "Escola",
  "universidade": "Universidade",
  "propina": "Propinas",

  // ─── Pessoal (desenvolvimento pessoal) ───
  "writing": "Escrita & Formação",
  "7ecos books": "Livros",
  "hobbies: escritora & afins": "Hobbies",
  "despesas pessoais bruno": "Despesas Pessoais",
  "pessoal": "Geral",
  "espiritualidade": "Bem-estar",
  "documentos id": "Documentação",
  "curso": "Cursos & Formação",
  "livros": "Livros",
  "formação": "Cursos & Formação",
  "formacao": "Cursos & Formação",

  // ─── Família ───
  "baby cris": "Filhos",
  "kidz toys and fun": "Brinquedos",
  "ajudas familiares": "Apoio Familiar",
  "filhos": "Filhos",
  "família": "Geral",
  "familia": "Geral",
  "crianças": "Filhos",
  "criancas": "Filhos",

  // ─── Transporte ───
  "transportation": "Geral",
  "transporte": "Geral",
  "combustível": "Combustível",
  "combustivel": "Combustível",
  "gasolina": "Combustível",
  "gasóleo": "Combustível",
  "uber": "Táxi & Apps",
  "bolt": "Táxi & Apps",
  "taxi": "Táxi & Apps",
  "táxi": "Táxi & Apps",
  "chapa": "Transporte Público",
  "estacionamento": "Estacionamento",
  "manutenção veículo": "Manutenção",
  "manutenção veiculo": "Manutenção",
  "seguro auto": "Seguro",
  "carro": "Viatura",
  "automóvel": "Viatura",

  // ─── Viagens ───
  "holidays": "Férias",
  "viagens despesas": "Despesas de Viagem",
  "viagem": "Geral",
  "viagens": "Geral",
  "férias": "Férias",
  "ferias": "Férias",
  "hotel": "Alojamento",

  // ─── Rendimentos ───
  "salary": "Salário Mensal",
  "salário": "Salário Mensal",
  "salario": "Salário Mensal",
  "vencimento": "Salário Mensal",
  "ordenado": "Salário Mensal",
  "mensalidades coachme": "Coaching",
  "bruno income": "Rendimento Extra",
  "vendas": "Vendas",
  "sete-ecos project": "Projecto",
  "viagens serviço": "Subsídio Viagem",
  "subsídio viagem": "Subsídio Viagem",
  "award": "Prémio",
  "freelance": "Trabalho Independente",
  "bónus": "Bónus",
  "bonus": "Bónus",
  "rendimento": "Geral",
  "renda (recebida)": "Renda Recebida",
  "dividendos": "Dividendos",
  "reembolso": "Reembolso",
  "reembolso lomesio": "Reembolso",
  "investimento": "Geral",
  "investimentos": "Geral",
  "poupança": "Poupança",
  "poupanca": "Poupança",
  "xitique": "Xitique",

  // ─── Roupa ───
  "clothing": "Vestuário",
  "roupa": "Vestuário",
  "vestuário": "Vestuário",
  "vestuario": "Vestuário",

  // ─── Subscrições ───
  "digital apps & services": "Apps & Serviços",
  "apple bills": "Apps & Serviços",
  "apple bill": "Apps & Serviços",
  "subscrição": "Geral",
  "subscricao": "Geral",
  "assinatura": "Geral",
  "netflix": "Streaming",
  "spotify": "Streaming",
  "streaming": "Streaming",

  // ─── Compras ───
  "personal gadgets": "Gadgets & Electrónica",
  "compras": "Geral",
  "shopping": "Geral",
  "electrónica": "Electrónica",
  "electronica": "Electrónica",
  "tecnologia": "Tecnologia",

  // ─── Animais ───
  "pets": "Animais de Estimação",
  "animais": "Animais de Estimação",

  // ─── Doações ───
  "donations": "Geral",
  "doação": "Geral",
  "doacao": "Geral",
  "igreja": "Contribuição Religiosa",
  "dízimo": "Contribuição Religiosa",
  "dizimo": "Contribuição Religiosa",
  "caridade": "Caridade",
  "oferta": "Oferta",

  // ─── Dívidas ───
  "loan": "Empréstimo",
  "empréstimos bancários": "Empréstimo Bancário",
  "crédito fml": "Crédito Pessoal",
  "moza credito": "Crédito Pessoal",
  "empréstimo": "Empréstimo",
  "emprestimo": "Empréstimo",
  "dívida": "Geral",
  "divida": "Geral",
  "cartão crédito": "Cartão de Crédito",
  "juros": "Juros",

  // ─── Taxas Bancárias ───
  "comissões bancárias": "Comissões",
  "taxa": "Taxas",
  "taxa bancária": "Taxas",
  "comissão": "Comissões",

  // ─── Contas & Serviços ───
  "contas": "Geral",
  "água": "Água",
  "agua": "Água",
  "electricidade": "Electricidade",
  "luz": "Electricidade",
  "gás": "Gás",
  "gas": "Gás",

  // ─── Comunicação ───
  "internet": "Internet",
  "telefone": "Telefone",
  "telemóvel": "Telemóvel",
  "telemovel": "Telemóvel",
  "comunicação": "Geral",
  "comunicacao": "Geral",
  "tv": "TV & Cabo",

  // ─── Levantamentos ───
  "levantamentos fim de semana": "ATM",

  // ─── Genérico ───
  "others": "Outros",
  "outro": "Outros",
  "outros": "Outros",
  "other": "Outros",
  "paid": "Pagamento",
  "adjustment": "Correcção de Saldo",
  "transferência": "Transferência",
  "transferencia": "Transferência",
  "ajuste": "Correcção de Saldo",
};

function normalizeForMapping(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Pre-build normalized lookup maps (accent-stripped keys)
const NORMALIZED_CATEGORY_MAP: Record<string, string> = {};
for (const [key, value] of Object.entries(MOBILLS_CATEGORY_MAP)) {
  NORMALIZED_CATEGORY_MAP[normalizeForMapping(key)] = value;
}

const NORMALIZED_SUBCATEGORY_MAP: Record<string, string> = {};
for (const [key, value] of Object.entries(MOBILLS_SUBCATEGORY_MAP)) {
  NORMALIZED_SUBCATEGORY_MAP[normalizeForMapping(key)] = value;
}

function mapCategory(
  mobillsCategory: string,
  subcategory?: string,
  description?: string,
  type?: "income" | "expense" | "transfer"
): { mapped: string; mappedSubcategory: string; needsReview: boolean } {
  // Try category first, then subcategory
  const candidates = [
    mobillsCategory,
    subcategory,
  ].filter((c): c is string => !!c && c.length > 0);

  for (const candidate of candidates) {
    const normalized = normalizeForMapping(candidate);

    // Direct match (accent-stripped)
    if (NORMALIZED_CATEGORY_MAP[normalized]) {
      return {
        mapped: NORMALIZED_CATEGORY_MAP[normalized],
        mappedSubcategory: NORMALIZED_SUBCATEGORY_MAP[normalized] || NORMALIZED_CATEGORY_MAP[normalized],
        needsReview: false,
      };
    }

    // Partial match (min 3 chars, accent-stripped keys)
    for (const [key, value] of Object.entries(NORMALIZED_CATEGORY_MAP)) {
      if (key.length >= 3 && normalized.includes(key)) {
        return {
          mapped: value,
          mappedSubcategory: NORMALIZED_SUBCATEGORY_MAP[key] || value,
          needsReview: false,
        };
      }
      if (normalized.length >= 3 && key.includes(normalized)) {
        return {
          mapped: value,
          mappedSubcategory: NORMALIZED_SUBCATEGORY_MAP[key] || value,
          needsReview: false,
        };
      }
    }
  }

  // Fallback: auto-categorize from description (merchant name matching)
  if (description && description.length > 1) {
    const result = autoCategorize(description, type || "expense");
    if (result.confidence >= 0.7 && result.category !== "Outros" && result.category !== "Outro Rendimento") {
      return { mapped: result.category, mappedSubcategory: result.category, needsReview: false };
    }
  }

  // No match found — default to Outros
  return { mapped: "Outros", mappedSubcategory: "Outros", needsReview: true };
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
  // Sort keys by length (longest first) so "subcategory" matches before "category"
  const sortedEntries = Object.entries(HEADER_MAP).sort((a, b) => b[0].length - a[0].length);
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i] ?? "");
    for (const [key, field] of sortedEntries) {
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

function parseTransactionStatus(status: string): "pending" | "completed" | "cancelled" {
  const s = status.toLowerCase().trim();
  if (!s) return "completed";
  if (/paid|paga|pago|completed|conclu|realiz/i.test(s)) return "completed";
  if (/pending|pendent|future|previst|expected|aguarda/i.test(s)) return "pending";
  if (/cancel|anulad/i.test(s)) return "cancelled";
  return "completed";
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

  // Detect separator and parse headers
  const firstLine = lines[0]!;
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
  const rawCategoryCounts: Record<string, number> = {};
  const rawCategorySample: Set<string> = new Set();
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalTransfers = 0;
  let minDate = "";
  let maxDate = "";
  let sampleRow: Record<string, string> | undefined;

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
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
      // Skip footer/summary rows (e.g. "Total (incomes - expenses)") where date is not ISO
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        skipped++;
        continue;
      }

      // Skip "Reajuste de saldo" / "Adjustment" rows — these are Mobills'
      // manual balance corrections, not real income or expense. Including
      // them would inflate receitas/despesas without matching Mobills.
      const rawCatLower = (row.category || "").toLowerCase().trim();
      if (
        rawCatLower === "adjustment" ||
        rawCatLower === "ajuste" ||
        /reajuste de saldo|reajuste do saldo/i.test(row.description || "")
      ) {
        skipped++;
        continue;
      }

      const type = row.type ? parseTransactionType(row.type) : (rawAmount < 0 ? "expense" : "income");
      const amount = Math.abs(rawAmount);

      // Determine status:
      //   1. Honour the Mobills "Status" column if it is present and unambiguous
      //   2. Otherwise: if the date is in the future, mark as pending (the
      //      money has not actually moved yet — typical for scheduled bills
      //      and salaries that the user added in advance)
      //   3. Default to completed
      // Compute "today" in Maputo time (UTC+2) so transactions for "today"
      // don't get auto-promoted at midnight UTC (02:00 local).
      const nowMaputo = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const todayISO = nowMaputo.toISOString().split("T")[0]!;
      const parsedStatus = parseTransactionStatus(row.status || "");
      const status: "pending" | "completed" | "cancelled" =
        row.status && row.status.trim()
          ? parsedStatus
          : (date > todayISO ? "pending" : "completed");
      // Debug: track raw category values from file
      const rawCat = row.category ?? "";
      const rawSubcat = row.subcategory ?? "";
      const rawKey = rawCat || "(vazio)";
      rawCategoryCounts[rawKey] = (rawCategoryCounts[rawKey] || 0) + 1;
      if (rawCategorySample.size < 30) {
        if (rawCat) rawCategorySample.add(rawCat);
        if (rawSubcat) rawCategorySample.add(`[sub] ${rawSubcat}`);
      }

      // Save first row as sample for debugging
      if (!sampleRow) {
        sampleRow = { ...row };
      }

      const originalCategory = row.category || "Outros";
      const { mapped, mappedSubcategory, needsReview } = mapCategory(originalCategory, row.subcategory, row.description, type);

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
        mappedSubcategory,
        account: row.account || "Principal",
        amount,
        type,
        status,
        tags: row.tags ? row.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        notes: row.notes || "",
        needsReview,
      });
    } catch {
      errors.push(`Erro na linha ${i + 1}`);
      skipped++;
    }
  }

  // Build readable header mapping for debug
  const readableHeaderMap: Record<string, string> = {};
  for (const [index, field] of Object.entries(headerMap)) {
    readableHeaderMap[headers[parseInt(index)] ?? `col${index}`] = field;
  }

  return {
    success: imported.length > 0,
    total: lines.length - 1,
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
    debug: {
      detectedHeaders: headers.map((h) => h.replace(/^"|"$/g, "").trim()),
      headerMapping: readableHeaderMap,
      rawCategorySample: Array.from(rawCategorySample),
      rawCategoryCounts,
      headerRowIndex: 0,
      sampleRow,
    },
  };
}

// ─── Mobills Transfers Sheet Parser ─────────────────────────────────────────

/**
 * Parses the Mobills `Transfers` sheet, which has different columns than the
 * main sheet: `Date, Conta origem, Conta destino, Value, Tags`.
 *
 * Each row creates ONE transaction with type="transfer", linking source
 * account → destination account. These should NOT be counted as income.
 */
export function parseMobillsTransfersCSV(csvContent: string): ImportResult {
  const errors: string[] = [];
  const imported: ImportedTransaction[] = [];
  let skipped = 0;

  const lines = csvContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return emptyTransfersResult();
  }

  // Detect separator from header
  const firstLine = lines[0]!;
  const separator = detectSeparator(firstLine);
  const headers = firstLine
    .split(separator === ";" ? ";" : /,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((h) => h.replace(/^"|"$/g, "").trim());

  // Locate columns: date, source account, destination account, value
  let dateIdx = -1;
  let originIdx = -1;
  let destIdx = -1;
  let valueIdx = -1;
  let tagsIdx = -1;

  headers.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (dateIdx === -1 && /\bdate|^data\b/.test(n)) dateIdx = i;
    else if (originIdx === -1 && /(origem|source|from|de\b)/.test(n) && /conta|account/.test(n)) originIdx = i;
    else if (destIdx === -1 && /(destino|destination|to\b|para)/.test(n) && /conta|account/.test(n)) destIdx = i;
    else if (valueIdx === -1 && /value|valor|amount/.test(n)) valueIdx = i;
    else if (tagsIdx === -1 && /\btags?\b/.test(n)) tagsIdx = i;
  });

  // Fallback: positional layout (Date, Conta origem, Conta destino, Value, Tags)
  if (dateIdx === -1) dateIdx = 0;
  if (originIdx === -1) originIdx = 1;
  if (destIdx === -1) destIdx = 2;
  if (valueIdx === -1) valueIdx = 3;

  const accountsSet = new Set<string>();
  const categoryCounts: Record<string, number> = {};
  let totalTransfers = 0;
  let minDate = "";
  let maxDate = "";

  for (let i = 1; i < lines.length; i++) {
    try {
      const line = lines[i]!;
      const values = separator === ";"
        ? line.split(";").map((v) => v.trim().replace(/^"|"$/g, ""))
        : parseCSVLine(line);

      const dateRaw = values[dateIdx] ?? "";
      const origin = (values[originIdx] ?? "").trim();
      const dest = (values[destIdx] ?? "").trim();
      const valueRaw = values[valueIdx] ?? "0";
      const tagsRaw = tagsIdx >= 0 ? (values[tagsIdx] ?? "") : "";

      const date = parseMobillsDate(dateRaw);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        skipped++;
        continue;
      }

      const rawAmount = parseMobillsAmount(valueRaw);
      const amount = Math.abs(rawAmount);
      if (amount === 0 || !origin || !dest) {
        skipped++;
        continue;
      }

      accountsSet.add(origin);
      accountsSet.add(dest);

      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
      totalTransfers += amount;
      categoryCounts["Transferência"] = (categoryCounts["Transferência"] || 0) + 1;

      imported.push({
        date,
        description: `${origin} → ${dest}`,
        originalCategory: "Transferência",
        mappedCategory: "Transferência",
        mappedSubcategory: "Transferência",
        account: origin,
        transferToAccount: dest,
        amount,
        type: "transfer",
        status: "completed",
        tags: tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [],
        notes: "",
        needsReview: false,
      });
    } catch {
      errors.push(`Erro na linha ${i + 1}`);
      skipped++;
    }
  }

  return {
    success: imported.length > 0,
    total: lines.length - 1,
    imported,
    skipped,
    errors,
    categoryMapping: {},
    accountsFound: Array.from(accountsSet),
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
    summary: {
      totalIncome: 0,
      totalExpenses: 0,
      totalTransfers,
      categoryCounts,
    },
  };
}

function emptyTransfersResult(): ImportResult {
  return {
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
    { name: "Obras & Habitação", icon: "🧱", color: "#B45309" },
    { name: "Empregados Domésticos", icon: "👷", color: "#0891B2" },
    { name: "Jardim & Piscina", icon: "🌱", color: "#84CC16" },
    { name: "Contas", icon: "📄", color: "#0EA5E9" },
    { name: "Comunicação", icon: "📱", color: "#06B6D4" },
    { name: "Subscrições", icon: "🔄", color: "#14B8A6" },
    { name: "Saúde", icon: "💊", color: "#10B981" },
    { name: "Beleza & Cuidados", icon: "💅", color: "#F472B6" },
    { name: "Educação", icon: "📚", color: "#22C55E" },
    { name: "Pessoal", icon: "👤", color: "#F97316" },
    { name: "Compras", icon: "🛍️", color: "#EC4899" },
    { name: "Lazer", icon: "🎬", color: "#D946EF" },
    { name: "Viagens", icon: "✈️", color: "#A855F7" },
    { name: "Família", icon: "👨‍👩‍👧", color: "#FF6B35" },
    { name: "Animais", icon: "🐾", color: "#78716C" },
    { name: "Doações", icon: "🤝", color: "#F43F5E" },
    { name: "Taxas Bancárias", icon: "🏦", color: "#64748B" },
    { name: "Dívidas", icon: "💳", color: "#DC2626" },
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
