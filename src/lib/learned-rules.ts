/**
 * learned-rules — memória local das decisões da utilizadora no fluxo de importação.
 *
 * Quando a Vivianne corrige o tipo ou a categoria de um movimento (ou aprova com
 * os valores mostrados), guardamos essa decisão associada a uma "assinatura"
 * estável da descrição. Nos próximos imports, movimentos do mesmo
 * comerciante/beneficiário são preenchidos automaticamente — a app aprende.
 *
 * ── Porquê "texto + valor" ──
 * Alguns movimentos têm o MESMO texto mas significados diferentes conforme o
 * valor. Ex.: "Transf. METIX via NIB Enviada" às vezes é uma transferência para
 * a conta dela (~100.000) e às vezes é o pagamento da escola do Pikiniko
 * (~27.500). O texto é idêntico — só o VALOR os distingue.
 *
 * Por isso cada assinatura pode estar num de dois estados:
 *   • ESTÁVEL   — uma única decisão para qualquer valor (ex.: subscrições cujo
 *                 valor varia mas a categoria é sempre a mesma). Generaliza.
 *   • AMBÍGUA   — decisões diferentes para valores diferentes. Passa a aprender
 *                 por (texto + valor); um valor nunca visto NÃO é adivinhado.
 * Uma assinatura torna-se AMBÍGUA assim que recebe duas decisões conflituantes.
 *
 * 100% client-side (localStorage). Sem rede, sem dependências novas.
 */

const STORAGE_KEY = "budgy-learned-rules-v2";
const LEGACY_KEY = "budgy-learned-rules-v1";

export type TxType = "income" | "expense" | "transfer";

/** Decisão da utilizadora para um movimento. */
export interface LearnedRule {
  type?: TxType;
  category?: string;
}

/** Regra guardada por assinatura (formato interno v2). */
interface StoredRule {
  /** Decisão única aplicável a qualquer valor (assinatura ESTÁVEL). */
  default?: LearnedRule & { amountKey?: number | null };
  /** Decisões por valor (assinatura AMBÍGUA). Chave = amountKey em string. */
  byAmount?: Record<string, LearnedRule>;
}

/** Chave numérica de um valor, independente do sinal (2 casas decimais). */
function amountKey(amount: number): number {
  return Math.round(Math.abs(amount) * 100);
}

/**
 * Assinatura estável da descrição: o mesmo comerciante/beneficiário cai sempre
 * na mesma chave. Remove máscaras de cartão, refs interbancárias e dígitos.
 */
export function signatureFor(description: string): string {
  if (!description) return "";
  let s = description.toUpperCase();
  s = s.replace(/\d{6}\*+\d{4}/g, " "); // máscaras de cartão
  s = s.replace(/\bIB-[A-Z0-9-]+/g, " "); // refs interbancárias
  s = s.replace(/\bFT\d+/g, " ");
  s = s.replace(/\bVISA\.\d+/g, " ");
  s = s.replace(/\d+/g, " "); // dígitos soltos (datas, valores, telefones)
  s = s.replace(/[^A-Z0-9]+/g, " ").trim();
  if (!s) return "";
  return s.slice(0, 40).trim();
}

function sameDecision(a: LearnedRule | undefined, b: LearnedRule): boolean {
  if (!a) return false;
  return a.type === b.type && a.category === b.category;
}

/** Lê o armazenamento v2, migrando o formato antigo (v1) se existir. Seguro em SSR. */
function readStore(): Record<string, StoredRule> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, StoredRule>;
      }
    }
    // Migração do formato antigo: { sig: {type, category} } → default sem valor.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy);
      if (old && typeof old === "object" && !Array.isArray(old)) {
        const migrated: Record<string, StoredRule> = {};
        for (const [sig, rule] of Object.entries(old as Record<string, LearnedRule>)) {
          if (!rule) continue;
          migrated[sig] = { default: { type: rule.type, category: rule.category, amountKey: null } };
        }
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        } catch {
          /* ignora */
        }
        return migrated;
      }
    }
    return {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, StoredRule>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota cheia / indisponível — ignora */
  }
}

/**
 * Regista uma decisão para (descrição, valor). Se a assinatura já tinha uma
 * decisão diferente para outro valor, passa a AMBÍGUA (aprende por valor).
 */
export function rememberDecision(description: string, amount: number, decision: LearnedRule): void {
  if (typeof window === "undefined") return;
  const sig = signatureFor(description);
  if (!sig) return;
  if (!decision.type && !decision.category) return;

  const store = readStore();
  const r: StoredRule = store[sig] ?? {};
  const ak = amountKey(amount);
  const clean: LearnedRule = { type: decision.type, category: decision.category };

  if (r.byAmount) {
    // Já ambígua — guarda/atualiza a decisão para este valor.
    r.byAmount[String(ak)] = clean;
  } else if (r.default) {
    if (sameDecision(r.default, clean)) {
      // Mesma decisão — mantém estável, apenas refresca.
      r.default = { ...clean, amountKey: r.default.amountKey ?? ak };
    } else {
      // Conflito → torna-se ambígua: aprende por valor.
      const byAmount: Record<string, LearnedRule> = {};
      if (r.default.amountKey != null) {
        byAmount[String(r.default.amountKey)] = { type: r.default.type, category: r.default.category };
      }
      byAmount[String(ak)] = clean;
      r.byAmount = byAmount;
      delete r.default;
    }
  } else {
    // Primeira decisão — estável, associada a este valor.
    r.default = { ...clean, amountKey: ak };
  }

  store[sig] = r;
  writeStore(store);
}

/**
 * Aplica as regras aprendidas a uma lista de movimentos, marcando `learned=true`
 * nos que foram preenchidos. Assinaturas ambíguas só preenchem se o valor exacto
 * já foi ensinado — um valor novo NÃO é adivinhado. Função pura.
 */
export function applyLearnedRules<
  T extends { description: string; type: TxType; category: string; amount: number }
>(txs: T[]): (T & { learned?: boolean })[] {
  const store = readStore();
  return txs.map((tx) => {
    const sig = signatureFor(tx.description);
    const r = sig ? store[sig] : undefined;
    if (!r) return tx;

    let decision: LearnedRule | undefined;
    if (r.byAmount) {
      decision = r.byAmount[String(amountKey(tx.amount))]; // só o valor exacto
    } else {
      decision = r.default;
    }
    if (!decision || (!decision.type && !decision.category)) return tx;

    const next = { ...tx, learned: true } as T & { learned?: boolean };
    if (decision.type) next.type = decision.type;
    if (decision.category) next.category = decision.category;
    return next;
  });
}

/** Remove todas as regras aprendidas (v1 e v2). */
export function clearLearnedRules(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignora */
  }
}
