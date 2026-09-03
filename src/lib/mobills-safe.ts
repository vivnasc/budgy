/**
 * Mobills SAFE import — mapeamento de contas + corte por conta (anti-duplicados).
 *
 * O histórico do Mobills sobrepõe-se aos extratos que a Vivianne já importou
 * (CPC, Moza Banco, Standard Bank, M-Pesa). Para NÃO duplicar, o Mobills só
 * deve entrar em datas ANTERIORES ao que já existe em cada conta.
 *
 * Este módulo contém apenas lógica pura (sem React nem rede) para ser
 * testável com `npx tsx src/lib/mobills-safe.test.ts`.
 */

import type { ImportedTransaction, ImportResult } from "./mobills-import";

/** Contas canónicas já existentes na app (para os defaults inteligentes). */
export const KNOWN_APP_ACCOUNTS = ["CPC", "Moza Banco", "Standard Bank", "M-Pesa"] as const;

/**
 * Sentinela: mapear a conta Mobills para uma conta NOVA com o mesmo nome.
 * Contas novas não têm dados prévios → sem corte → importa tudo.
 */
export const CREATE_NEW = "__criar_nova__";

/**
 * Normaliza um nome de conta ignorando maiúsculas, acentos, espaços e hífens.
 * Assim "Mozabanco" ≡ "Moza Banco", "StandardBank" ≡ "Standard Bank",
 * "Mpesa" ≡ "M-Pesa".
 */
export function normalizeAccountName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-_.]/g, "")
    .trim();
}

/**
 * Nomes de conta Mobills distintos num resultado já parseado.
 * Inclui `account` e `transferToAccount` (folha Transfers).
 */
export function getMobillsAccountNames(result: ImportResult): string[] {
  const set = new Set<string>();
  for (const tx of result.imported) {
    if (tx.account) set.add(tx.account);
    if (tx.transferToAccount) set.add(tx.transferToAccount);
  }
  for (const a of result.accountsFound) if (a) set.add(a);
  return Array.from(set);
}

/**
 * Default inteligente: procura uma conta existente cujo nome normalizado
 * coincida com o nome Mobills. Se não houver, devolve CREATE_NEW.
 */
export function defaultTargetFor(mobillsName: string, appAccountNames: string[]): string {
  const norm = normalizeAccountName(mobillsName);
  const found = appAccountNames.find((n) => normalizeAccountName(n) === norm);
  return found ?? CREATE_NEW;
}

/**
 * Calcula a data mais antiga já existente por nome de conta.
 * A data mais antiga de cada conta é o "corte": o Mobills só entra ANTES dela.
 */
export function earliestDatesByAccount(
  txs: Array<{ date: string | null | undefined; accountName: string | null | undefined }>
): Record<string, string> {
  const earliest: Record<string, string> = {};
  for (const tx of txs) {
    const name = tx.accountName;
    const date = tx.date;
    if (!name || !date) continue;
    const cur = earliest[name];
    if (!cur || date < cur) earliest[name] = date;
  }
  return earliest;
}

/** Resolve o nome final de conta para uma linha, dado o mapeamento. */
function resolveTarget(mobillsName: string, mapping: Record<string, string>): string {
  const mapped = mapping[mobillsName];
  if (mapped === undefined || mapped === CREATE_NEW) return mobillsName;
  return mapped;
}

export interface MobillsMappingResult {
  /** Linhas que SOBREVIVEM (já remapeadas para o nome de conta final). */
  kept: ImportedTransaction[];
  /** Quantas linhas foram saltadas por já estarem cobertas pelos extratos. */
  droppedCount: number;
  /** Total de linhas de entrada. */
  total: number;
}

/**
 * Aplica o mapeamento de contas e o corte por conta.
 *
 * Para cada linha:
 *  1. remapeia `account` (e `transferToAccount`) do nome Mobills → nome da app;
 *  2. se a conta destino TEM corte (i.e. já tem dados) E a data da linha for
 *     >= ao corte, a linha é SALTADA (já coberta pelos extratos);
 *  3. caso contrário a linha é mantida.
 *
 * Contas sem corte (mapeadas para conta nova, ou sem dados prévios) mantêm tudo.
 *
 * @param cutoffsByAccount corte por NOME de conta final (data ISO mais antiga
 *        já existente). Contas ausentes = sem corte = importa tudo.
 */
export function applyMobillsMappingAndCutoff(
  rows: ImportedTransaction[],
  mapping: Record<string, string>,
  cutoffsByAccount: Record<string, string>
): MobillsMappingResult {
  const kept: ImportedTransaction[] = [];
  let droppedCount = 0;

  for (const row of rows) {
    const targetAccount = resolveTarget(row.account, mapping);
    const remapped: ImportedTransaction = { ...row, account: targetAccount };
    if (row.transferToAccount) {
      remapped.transferToAccount = resolveTarget(row.transferToAccount, mapping);
    }

    const cutoff = cutoffsByAccount[targetAccount];
    if (cutoff && row.date >= cutoff) {
      droppedCount++;
      continue;
    }
    kept.push(remapped);
  }

  return { kept, droppedCount, total: rows.length };
}

/**
 * Reconstrói um ImportResult a partir das linhas sobreviventes: recalcula
 * totais, contas encontradas, contagens de categoria e intervalo de datas.
 * Mantém os campos originais (debug, categoryMapping) e remapeia openingBalances.
 */
export function rebuildMobillsResult(
  original: ImportResult,
  keptRows: ImportedTransaction[],
  mapping: Record<string, string>
): ImportResult {
  const accountsSet = new Set<string>();
  const categoryCounts: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalTransfers = 0;
  let minDate = "";
  let maxDate = "";

  for (const tx of keptRows) {
    if (tx.account) accountsSet.add(tx.account);
    if (tx.transferToAccount) accountsSet.add(tx.transferToAccount);
    categoryCounts[tx.mappedCategory] = (categoryCounts[tx.mappedCategory] ?? 0) + 1;
    if (tx.type === "income") totalIncome += tx.amount;
    else if (tx.type === "expense") totalExpenses += tx.amount;
    else totalTransfers += tx.amount;
    if (!minDate || tx.date < minDate) minDate = tx.date;
    if (!maxDate || tx.date > maxDate) maxDate = tx.date;
  }

  const openingBalances = original.openingBalances?.map((ob) => ({
    ...ob,
    accountName: resolveTarget(ob.accountName, mapping),
  }));

  return {
    ...original,
    success: keptRows.length > 0,
    total: keptRows.length,
    imported: keptRows,
    accountsFound: Array.from(accountsSet),
    openingBalances,
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
    summary: {
      totalIncome,
      totalExpenses,
      totalTransfers,
      categoryCounts,
    },
  };
}
