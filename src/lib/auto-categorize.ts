/**
 * Auto-Categorization Engine
 *
 * Learns from the user's past categorization patterns and
 * applies rules to automatically categorize new transactions.
 *
 * Strategy:
 * 1. Exact description match → highest confidence
 * 2. Pattern/keyword match → medium confidence
 * 3. Amount range + type heuristics → low confidence
 * 4. Default fallback
 */

export interface CategorizationRule {
  /** Pattern to match against description */
  pattern: string;
  /** Whether to use regex or simple contains */
  isRegex: boolean;
  /** The category to assign */
  category: string;
  /** Confidence 0-1 */
  confidence: number;
  /** How many times this rule was confirmed by user */
  confirmCount: number;
  /** Source: "system" (built-in) or "learned" (from user behavior) */
  source: "system" | "learned";
}

export interface CategorizationResult {
  category: string;
  confidence: number;
  reason: string;
}

// ─── Built-in Rules (Mozambican Context) ─────────────────────────────────────

const SYSTEM_RULES: CategorizationRule[] = [
  // ── Supermarkets & Groceries (from real bank data) ──
  { pattern: "shoprite", isRegex: false, category: "Alimentação", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "superspar", isRegex: false, category: "Alimentação", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "spar", isRegex: false, category: "Alimentação", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "mega distrib", isRegex: false, category: "Alimentação", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "mega distribuicao", isRegex: false, category: "Alimentação", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "alfa supermercado", isRegex: false, category: "Alimentação", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "riyouf supermercado", isRegex: false, category: "Alimentação", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "abacos", isRegex: false, category: "Alimentação", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "tops komat", isRegex: false, category: "Alimentação", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "premier group", isRegex: false, category: "Alimentação", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "pingo doce", isRegex: false, category: "Alimentação", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "supermercado", isRegex: false, category: "Alimentação", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "mercado", isRegex: false, category: "Alimentação", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "padaria", isRegex: false, category: "Alimentação", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "talho", isRegex: false, category: "Alimentação", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "aguas reg", isRegex: false, category: "Alimentação", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "cem por ce", isRegex: false, category: "Alimentação", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "game", isRegex: false, category: "Compras", confidence: 0.7, confirmCount: 0, source: "system" },

  // ── Restaurants & Food ──
  { pattern: "restaurante", isRegex: false, category: "Restaurantes", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "restaurant", isRegex: false, category: "Restaurantes", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "kfc", isRegex: false, category: "Restaurantes", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "galitos", isRegex: false, category: "Restaurantes", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "nandos", isRegex: false, category: "Restaurantes", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "steers", isRegex: false, category: "Restaurantes", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "pizza", isRegex: false, category: "Restaurantes", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "take away", isRegex: false, category: "Restaurantes", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "café", isRegex: false, category: "Restaurantes", confidence: 0.8, confirmCount: 0, source: "system" },
  { pattern: "cafe", isRegex: false, category: "Restaurantes", confidence: 0.8, confirmCount: 0, source: "system" },
  { pattern: "king s bar", isRegex: false, category: "Restaurantes", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "gentlemans", isRegex: false, category: "Restaurantes", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "the crazy", isRegex: false, category: "Restaurantes", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "bottle store", isRegex: false, category: "Restaurantes", confidence: 0.85, confirmCount: 0, source: "system" },

  // ── Fuel ──
  { pattern: "posto galp", isRegex: false, category: "Combustível", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "galp", isRegex: false, category: "Combustível", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "petromoc", isRegex: false, category: "Combustível", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "puma energy", isRegex: false, category: "Combustível", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "total energies", isRegex: false, category: "Combustível", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "engen", isRegex: false, category: "Combustível", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "posto a. a", isRegex: false, category: "Combustível", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "combustível", isRegex: false, category: "Combustível", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "gasolina", isRegex: false, category: "Combustível", confidence: 0.95, confirmCount: 0, source: "system" },

  // ── Transport ──
  { pattern: "uber", isRegex: false, category: "Transporte", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "bolt", isRegex: false, category: "Transporte", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "chapa", isRegex: false, category: "Transporte", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "taxi", isRegex: false, category: "Transporte", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "lebombo bu", isRegex: false, category: "Transporte", confidence: 0.8, confirmCount: 0, source: "system" },

  // ── Utilities ──
  { pattern: "edm", isRegex: false, category: "Contas", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "fipag", isRegex: false, category: "Contas", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "electricidade", isRegex: false, category: "Contas", confidence: 0.95, confirmCount: 0, source: "system" },

  // ── Telecom ──
  { pattern: "vodacom", isRegex: false, category: "Comunicação", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "movitel", isRegex: false, category: "Comunicação", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "tmcel", isRegex: false, category: "Comunicação", confidence: 0.9, confirmCount: 0, source: "system" },

  // ── Subscriptions (from real CPC data) ──
  { pattern: "netflix", isRegex: false, category: "Subscrições", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "spotify", isRegex: false, category: "Subscrições", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "youtube", isRegex: false, category: "Subscrições", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "dstv", isRegex: false, category: "Subscrições", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "hotmart", isRegex: false, category: "Subscrições", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "apple.com/bill", isRegex: false, category: "Subscrições", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "shein", isRegex: false, category: "Compras", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "leonardo.ai", isRegex: false, category: "Subscrições", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "elevenlabs", isRegex: false, category: "Subscrições", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "invideo", isRegex: false, category: "Subscrições", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "kits ai", isRegex: false, category: "Subscrições", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "kits.ai", isRegex: false, category: "Subscrições", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "think diffusion", isRegex: false, category: "Subscrições", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "creem.io", isRegex: false, category: "Subscrições", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "ecotrimcome", isRegex: false, category: "Subscrições", confidence: 0.8, confirmCount: 0, source: "system" },
  { pattern: "facebook", isRegex: false, category: "Subscrições", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "paypal", isRegex: false, category: "Subscrições", confidence: 0.7, confirmCount: 0, source: "system" },

  // ── Health & Wellness (from real data) ──
  { pattern: "farmacia feliz", isRegex: false, category: "Saúde", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "farmácia", isRegex: false, category: "Saúde", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "farmacia", isRegex: false, category: "Saúde", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "hospital", isRegex: false, category: "Saúde", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "clínica", isRegex: false, category: "Saúde", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "clinica", isRegex: false, category: "Saúde", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "consultorio medico", isRegex: false, category: "Saúde", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "cons medico", isRegex: false, category: "Saúde", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "quiropr", isRegex: false, category: "Saúde", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "labor. ana", isRegex: false, category: "Saúde", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "komati pha", isRegex: false, category: "Saúde", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "skinlab", isRegex: false, category: "Pessoal", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "skin lab", isRegex: false, category: "Pessoal", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "365 fitness", isRegex: false, category: "Saúde", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "vetpets", isRegex: false, category: "Animais", confidence: 0.95, confirmCount: 0, source: "system" },

  // ── Shopping & Personal (from real data) ──
  { pattern: "woolworths", isRegex: false, category: "Compras", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "lokal 2", isRegex: false, category: "Compras", confidence: 0.8, confirmCount: 0, source: "system" },
  { pattern: "oh baby so", isRegex: false, category: "Família", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "rainbow nurseries", isRegex: false, category: "Casa", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "smartpools", isRegex: false, category: "Casa", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "tiger impo", isRegex: false, category: "Compras", confidence: 0.8, confirmCount: 0, source: "system" },
  { pattern: "exclusive", isRegex: false, category: "Compras", confidence: 0.8, confirmCount: 0, source: "system" },
  { pattern: "lap tec", isRegex: false, category: "Compras", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "luxor", isRegex: false, category: "Compras", confidence: 0.8, confirmCount: 0, source: "system" },
  { pattern: "sandra sil", isRegex: false, category: "Pessoal", confidence: 0.75, confirmCount: 0, source: "system" },
  { pattern: "home land", isRegex: false, category: "Casa", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "migracao", isRegex: false, category: "Pessoal", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "mega lokal", isRegex: false, category: "Compras", confidence: 0.8, confirmCount: 0, source: "system" },
  { pattern: "orbis", isRegex: false, category: "Compras", confidence: 0.75, confirmCount: 0, source: "system" },
  { pattern: "itvm inspe", isRegex: false, category: "Automóvel", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "nyoxami", isRegex: false, category: "Compras", confidence: 0.75, confirmCount: 0, source: "system" },

  // ── Income ──
  { pattern: "salário", isRegex: false, category: "Salário", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "salario", isRegex: false, category: "Salário", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "pagamento salario", isRegex: false, category: "Salário", confidence: 0.98, confirmCount: 0, source: "system" },
  { pattern: "vencimento", isRegex: false, category: "Salário", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "masterworks", isRegex: false, category: "Salário", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "dividendos", isRegex: false, category: "Rendimento Passivo", confidence: 0.95, confirmCount: 0, source: "system" },

  // ── Housing ──
  { pattern: "renda", isRegex: false, category: "Casa", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "aluguer", isRegex: false, category: "Casa", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "creche", isRegex: false, category: "Família", confidence: 0.95, confirmCount: 0, source: "system" },

  // ── Banking & Fees ──
  { pattern: "comissão", isRegex: false, category: "Taxas Bancárias", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "comissao", isRegex: false, category: "Taxas Bancárias", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "taxa de manutenção", isRegex: false, category: "Taxas Bancárias", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "imposto de selo", isRegex: false, category: "Taxas Bancárias", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "anuidade", isRegex: false, category: "Taxas Bancárias", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "prestacao mensal emprestimo", isRegex: false, category: "Dívidas", confidence: 0.95, confirmCount: 0, source: "system" },

  // ── Utilities (Mozambican household bills) ──
  { pattern: "energia", isRegex: false, category: "Contas", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "factura agua", isRegex: false, category: "Contas", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "factura de agua", isRegex: false, category: "Contas", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "factura água", isRegex: false, category: "Contas", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "fatura agua", isRegex: false, category: "Contas", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "agua katembe", isRegex: false, category: "Contas", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "água ", isRegex: false, category: "Contas", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "edm ", isRegex: false, category: "Contas", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "fipag", isRegex: false, category: "Contas", confidence: 0.95, confirmCount: 0, source: "system" },

  // ── Education / Tuition ──
  { pattern: "propina", isRegex: false, category: "Educação", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "propinas", isRegex: false, category: "Educação", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "woodrose", isRegex: false, category: "Educação", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "escola ", isRegex: false, category: "Educação", confidence: 0.85, confirmCount: 0, source: "system" },

  // ── Health / Therapy ──
  { pattern: "terapia da fala", isRegex: false, category: "Saúde", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "terapia", isRegex: false, category: "Saúde", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "psicolog", isRegex: false, category: "Saúde", confidence: 0.9, confirmCount: 0, source: "system" },

  // ── Family-specific (children's activities, family transfers) ──
  { pattern: "futebol breno", isRegex: false, category: "Família", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "futebol", isRegex: false, category: "Lazer", confidence: 0.7, confirmCount: 0, source: "system" },
  { pattern: "breno nascimento", isRegex: false, category: "Família", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "trf-breno", isRegex: false, category: "Família", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "transferência para breno", isRegex: false, category: "Família", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "creche cris", isRegex: false, category: "Família", confidence: 0.98, confirmCount: 0, source: "system" },
  { pattern: "baby", isRegex: false, category: "Família", confidence: 0.7, confirmCount: 0, source: "system" },

  // ── Home / Garden / Domestic services ──
  { pattern: "jardineira", isRegex: false, category: "Casa", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "jardim", isRegex: false, category: "Casa", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "limpeza", isRegex: false, category: "Casa", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "empregada", isRegex: false, category: "Casa", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "rainbow nurseries", isRegex: false, category: "Casa", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "smartpools", isRegex: false, category: "Casa", confidence: 0.95, confirmCount: 0, source: "system" },
  { pattern: "home land", isRegex: false, category: "Casa", confidence: 0.9, confirmCount: 0, source: "system" },

  // ── Personal income (side hustles / family income) ──
  { pattern: "bruno income", isRegex: false, category: "Outro Rendimento", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "reembolso", isRegex: false, category: "Reembolso", confidence: 0.9, confirmCount: 0, source: "system" },
  { pattern: "devolução", isRegex: false, category: "Reembolso", confidence: 0.85, confirmCount: 0, source: "system" },
  { pattern: "devolucao", isRegex: false, category: "Reembolso", confidence: 0.85, confirmCount: 0, source: "system" },
];

// ─── Categorization Engine ───────────────────────────────────────────────────

/**
 * Auto-categorize a transaction based on description.
 * Uses system rules + user-learned rules.
 */
export function autoCategorize(
  description: string,
  type: "income" | "expense" | "transfer",
  amount?: number,
  userRules: CategorizationRule[] = []
): CategorizationResult {
  const normalized = description.toLowerCase().trim();

  // 1. Check user-learned rules first (higher priority)
  for (const rule of userRules) {
    const match = rule.isRegex
      ? new RegExp(rule.pattern, "i").test(normalized)
      : normalized.includes(rule.pattern.toLowerCase());

    if (match) {
      // Boost confidence based on user confirmations
      const boostedConfidence = Math.min(rule.confidence + rule.confirmCount * 0.02, 1.0);
      return {
        category: rule.category,
        confidence: boostedConfidence,
        reason: `Aprendido: "${rule.pattern}" → ${rule.category}`,
      };
    }
  }

  // 2. Check system rules
  let bestMatch: CategorizationResult | null = null;

  for (const rule of SYSTEM_RULES) {
    const match = rule.isRegex
      ? new RegExp(rule.pattern, "i").test(normalized)
      : normalized.includes(rule.pattern.toLowerCase());

    if (match && (!bestMatch || rule.confidence > bestMatch.confidence)) {
      bestMatch = {
        category: rule.category,
        confidence: rule.confidence,
        reason: `Padrão reconhecido: "${rule.pattern}"`,
      };
    }
  }

  if (bestMatch) return bestMatch;

  // 3. Amount-based heuristics
  if (type === "income" && amount) {
    if (amount > 20000) {
      return {
        category: "Salário",
        confidence: 0.4,
        reason: "Valor alto de rendimento (possível salário)",
      };
    }
  }

  // 4. Default
  const defaults: Record<string, string> = {
    income: "Outro Rendimento",
    expense: "Outros",
    transfer: "Transferência",
  };

  return {
    category: defaults[type] || "Outros",
    confidence: 0.1,
    reason: "Sem padrão reconhecido",
  };
}

/**
 * Create a learned rule from user correction.
 * When a user changes a category suggestion, we learn from it.
 */
export function createLearnedRule(
  description: string,
  correctCategory: string,
  existingRules: CategorizationRule[]
): CategorizationRule {
  // Check if we already have a rule for this pattern
  const normalized = description.toLowerCase().trim();
  const existing = existingRules.find(
    (r) => r.pattern.toLowerCase() === normalized && r.source === "learned"
  );

  if (existing) {
    // Update existing rule
    existing.category = correctCategory;
    existing.confirmCount++;
    existing.confidence = Math.min(existing.confidence + 0.05, 0.98);
    return existing;
  }

  // Create new rule
  // Extract the most meaningful part of the description
  const keywords = normalized
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .join(" ");

  return {
    pattern: keywords || normalized,
    isRegex: false,
    category: correctCategory,
    confidence: 0.7,
    confirmCount: 1,
    source: "learned",
  };
}

/**
 * Get category suggestions for a partial description (as user types).
 */
export function suggestCategories(
  partialDescription: string,
  type: "income" | "expense" | "transfer",
  userRules: CategorizationRule[] = [],
  limit = 3
): CategorizationResult[] {
  if (partialDescription.length < 2) return [];

  const normalized = partialDescription.toLowerCase().trim();
  const results: CategorizationResult[] = [];
  const seen = new Set<string>();

  const allRules = [...userRules, ...SYSTEM_RULES];

  for (const rule of allRules) {
    if (seen.size >= limit) break;

    const match = normalized.includes(rule.pattern.toLowerCase()) ||
      rule.pattern.toLowerCase().includes(normalized);

    if (match && !seen.has(rule.category)) {
      seen.add(rule.category);
      results.push({
        category: rule.category,
        confidence: rule.confidence * 0.8, // Reduce confidence for partial matches
        reason: rule.source === "learned" ? "Baseado no teu histórico" : "Sugestão automática",
      });
    }
  }

  return results;
}
