/**
 * Aprendizagem de Negócio vs Pessoal por fornecedor.
 *
 * Quando a utilizadora marca uma transação como Negócio (ou Pessoal), guardamos
 * essa decisão pela ASSINATURA do fornecedor (mesma de learned-rules). Nas
 * importações seguintes, transações do mesmo fornecedor vêm já marcadas sozinhas
 * — sem ela ter de marcar à mão sempre.
 *
 * Tratamento de ambiguidade: se o MESMO fornecedor foi marcado das duas formas
 * (ex: Apple às vezes pessoal, às vezes negócio), fica AMBÍGUO e deixamos de
 * adivinhar — ela decide esses casos. 100% no browser (localStorage).
 */

import { signatureFor } from "./learned-rules";

const STORAGE_KEY = "budgy-learned-business-v1";

interface Counts {
  business: number;
  personal: number;
}

function readStore(): Record<string, Counts> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, Counts>;
      }
    }
  } catch {
    /* ignora */
  }
  return {};
}

function writeStore(store: Record<string, Counts>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota cheia / indisponível — ignora */
  }
}

/** Regista que este fornecedor foi marcado como Negócio (on=true) ou Pessoal. */
export function rememberBusinessDecision(description: string, isBusiness: boolean): void {
  if (typeof window === "undefined") return;
  const sig = signatureFor(description);
  if (!sig) return;
  const store = readStore();
  const c: Counts = store[sig] ?? { business: 0, personal: 0 };
  if (isBusiness) c.business += 1;
  else c.personal += 1;
  store[sig] = c;
  writeStore(store);
}

/**
 * Decisão aprendida para um fornecedor:
 *   true  → sempre marcado como Negócio
 *   false → sempre marcado como Pessoal
 *   null  → sem dados, ou AMBÍGUO (marcado das duas formas) → não adivinhar
 */
export function getLearnedBusiness(description: string): boolean | null {
  const sig = signatureFor(description);
  if (!sig) return null;
  const c = readStore()[sig];
  if (!c) return null;
  if (c.business > 0 && c.personal === 0) return true;
  if (c.personal > 0 && c.business === 0) return false;
  return null; // ambíguo
}

export function clearLearnedBusiness(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignora */
  }
}
