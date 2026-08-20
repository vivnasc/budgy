/**
 * learned-rules — memória local das decisões da utilizadora no fluxo de importação.
 *
 * Quando a Vivianne corrige o tipo ou a categoria de um movimento (ou simplesmente
 * aprova com os valores mostrados), guardamos essa decisão associada a uma
 * "assinatura" estável da descrição. Nos próximos imports, movimentos do mesmo
 * comerciante/beneficiário são preenchidos automaticamente — a app aprende.
 *
 * 100% client-side (localStorage). Sem rede, sem dependências novas.
 */

const STORAGE_KEY = "budgy-learned-rules-v1";

export interface LearnedRule {
  type?: "income" | "expense" | "transfer";
  category?: string;
}

/**
 * Produz uma chave estável a partir da descrição de um movimento, de modo a que
 * o mesmo comerciante/beneficiário caia sempre na mesma chave entre imports.
 *
 * Normaliza: maiúsculas; remove máscaras de cartão (402546******2463), refs
 * interbancárias (IB-..., FT12345, VISA.123), grupos de dígitos soltos; colapsa
 * qualquer sequência de caracteres não-alfanuméricos num único espaço; corta; e
 * mantém os primeiros ~40 caracteres. Devolve "" se nada de útil sobrar.
 */
export function signatureFor(description: string): string {
  if (!description) return "";

  let s = description.toUpperCase();

  // Máscaras de cartão: 6 dígitos + asteriscos + 4 dígitos
  s = s.replace(/\d{6}\*+\d{4}/g, " ");
  // Refs interbancárias / transferências
  s = s.replace(/\bIB-[A-Z0-9-]+/g, " ");
  s = s.replace(/\bFT\d+/g, " ");
  s = s.replace(/\bVISA\.\d+/g, " ");
  // Grupos de dígitos soltos (datas, valores, nºs de telefone, refs)
  s = s.replace(/\d+/g, " ");
  // Colapsa qualquer run de não-alfanuméricos num único espaço
  s = s.replace(/[^A-Z0-9]+/g, " ").trim();

  if (!s) return "";
  return s.slice(0, 40).trim();
}

/**
 * Lê e faz parse do localStorage. Tolera ausência/JSON corrompido (devolve {}).
 * Seguro em SSR.
 */
export function getLearnedRules(): Record<string, LearnedRule> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, LearnedRule>;
  } catch {
    return {};
  }
}

/**
 * Regista (ou funde) uma decisão para a assinatura da descrição. Ignora se a
 * assinatura for vazia. Seguro em SSR.
 */
export function rememberDecision(description: string, rule: LearnedRule): void {
  if (typeof window === "undefined") return;
  const sig = signatureFor(description);
  if (!sig) return;

  const rules = getLearnedRules();
  const existing = rules[sig] ?? {};
  const merged: LearnedRule = { ...existing };
  if (rule.type) merged.type = rule.type;
  if (rule.category) merged.category = rule.category;
  rules[sig] = merged;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // Quota cheia ou localStorage indisponível — ignora silenciosamente.
  }
}

/**
 * Aplica as regras aprendidas a uma lista de movimentos. Para cada movimento,
 * calcula a assinatura e, se houver regra, aplica type e/ou category e marca
 * learned=true. Função pura (lê as regras uma vez no início).
 */
export function applyLearnedRules<
  T extends { description: string; type: "income" | "expense" | "transfer"; category: string }
>(txs: T[]): (T & { learned?: boolean })[] {
  const rules = getLearnedRules();
  return txs.map((tx) => {
    const sig = signatureFor(tx.description);
    const rule = sig ? rules[sig] : undefined;
    if (!rule) return tx;
    const next = { ...tx, learned: true } as T & { learned?: boolean };
    if (rule.type) next.type = rule.type;
    if (rule.category) next.category = rule.category;
    return next;
  });
}

/** Remove todas as regras aprendidas (para um futuro botão de reset). */
export function clearLearnedRules(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora
  }
}
