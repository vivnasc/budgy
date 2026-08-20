/**
 * Backup / Restauro — rede de segurança para os dados da Vivianne.
 *
 * Export: junta TODOS os dados no browser (contas, transações com nomes de
 * categoria/conta, metas, orçamentos, dívidas) e descarrega um ficheiro JSON.
 * É apenas leitura — nunca apaga nem altera nada.
 *
 * Restauro: volta a enviar as transações para POST /api/transactions, que já
 * deduplica (data+valor+descrição+tipo+conta). O restauro ACRESCENTA o que
 * falta, não apaga — as duplicadas são simplesmente ignoradas.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAccounts,
  getBudgets,
  getGoals,
  getDebts,
} from "@/lib/supabase/queries";
import type {
  Account,
  Budget,
  Goal,
  DebtRecord,
  Transaction,
} from "@/lib/supabase/types";

export const BACKUP_VERSION = 1 as const;

/**
 * Uma transação como guardada no backup — os campos necessários para a
 * restaurar via bulk POST /api/transactions (que resolve conta/categoria por
 * NOME). Guardamos os valores/tipos exactamente como estão (sem tocar em sinais).
 */
export interface BackupTransaction {
  date: string;
  amount: number;
  type: string;
  currency: string;
  status: string;
  description: string;
  category_name: string | null;
  account: string | null;
  transfer_to_account: string | null;
  tags: string[] | null;
}

export interface BudgyBackup {
  version: number;
  exported_at: string;
  accounts: Account[];
  transactions: BackupTransaction[];
  goals: Goal[];
  budgets: Budget[];
  debts: DebtRecord[];
}

// ─── Recolha (só leitura) ─────────────────────────────────────────────────────

/**
 * Busca TODAS as transações do utilizador (com categoria e conta ligadas),
 * paginando para não ficar limitado ao máximo de linhas por pedido do Supabase.
 */
async function fetchAllTransactions(
  supabase: SupabaseClient,
  userId: string
): Promise<Transaction[]> {
  const pageSize = 1000;
  const all: Transaction[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .schema("money_schema")
      .from("transactions")
      .select("*, categories(*), accounts!transactions_account_id_fkey(*)")
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const rows = (data as Transaction[] | null) ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

/**
 * Reúne o backup completo do utilizador. Puramente leitura.
 */
export async function gatherBackup(
  supabase: SupabaseClient,
  userId: string
): Promise<BudgyBackup> {
  const [accountsRes, txs, goalsRes, budgetsRes, debtsRes] = await Promise.all([
    getAccounts(supabase, userId),
    fetchAllTransactions(supabase, userId),
    getGoals(supabase, userId),
    getBudgets(supabase, userId),
    getDebts(supabase, userId),
  ]);

  const accounts = accountsRes.data ?? [];

  // Mapa id → nome da conta para resolver o outro lado das transferências
  // (o join só traz a conta de origem via account_id).
  const accountNameById = new Map<string, string>();
  for (const acc of accounts) accountNameById.set(acc.id, acc.name);

  const transactions: BackupTransaction[] = txs.map((tx) => ({
    date: tx.date,
    amount: tx.amount,
    type: tx.type,
    currency: tx.currency,
    status: tx.status,
    description: tx.description ?? "",
    category_name: tx.categories?.name ?? null,
    account: tx.accounts?.name ?? accountNameById.get(tx.account_id) ?? null,
    transfer_to_account: tx.transfer_to_account_id
      ? accountNameById.get(tx.transfer_to_account_id) ?? null
      : null,
    tags: tx.tags ?? null,
  }));

  return {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    accounts,
    transactions,
    goals: goalsRes.data ?? [],
    budgets: budgetsRes.data ?? [],
    debts: debtsRes.data ?? [],
  };
}

// ─── Descarregar (browser) ────────────────────────────────────────────────────

/** Nome do ficheiro: budgy-backup-YYYY-MM-DD.json */
export function backupFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `budgy-backup-${yyyy}-${mm}-${dd}.json`;
}

/**
 * Dispara o download do backup no browser (Blob + object URL + <a download>).
 */
export function downloadBackup(backup: BudgyBackup): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Liberta o object URL no próximo tick (deixa o click concluir).
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ─── Validação / leitura de um ficheiro de backup ─────────────────────────────

/**
 * Interpreta e valida o texto de um ficheiro de backup BUDGY. Lança um Error
 * com mensagem amigável (em português) se não for um backup válido.
 */
export function parseBackup(text: string): BudgyBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Ficheiro inválido — não é um JSON legível.");
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("Este ficheiro não é um backup do BUDGY.");
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.version !== "number" || !Array.isArray(obj.transactions)) {
    throw new Error(
      "Este ficheiro não parece um backup do BUDGY (faltam 'version' ou 'transactions')."
    );
  }

  return {
    version: obj.version,
    exported_at: typeof obj.exported_at === "string" ? obj.exported_at : "",
    accounts: Array.isArray(obj.accounts) ? (obj.accounts as Account[]) : [],
    transactions: obj.transactions as BackupTransaction[],
    goals: Array.isArray(obj.goals) ? (obj.goals as Goal[]) : [],
    budgets: Array.isArray(obj.budgets) ? (obj.budgets as Budget[]) : [],
    debts: Array.isArray(obj.debts) ? (obj.debts as DebtRecord[]) : [],
  };
}

// ─── Restauro (aditivo, com deduplicação) ─────────────────────────────────────

export interface RestoreResult {
  restored: number;
  duplicates: number;
}

/**
 * Restaura as transações de um backup via POST /api/transactions em lotes.
 * O endpoint deduplica, por isso restaurar por cima do que já existe é seguro:
 * as duplicadas são ignoradas e só o que falta é acrescentado. Nunca apaga nada.
 */
export async function restoreBackup(backup: BudgyBackup): Promise<RestoreResult> {
  const batchSize = 200;
  let restored = 0;
  let duplicates = 0;

  const txs = backup.transactions.map((tx) => ({
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency,
    date: tx.date,
    description: tx.description,
    status: tx.status,
    ...(tx.category_name ? { category_name: tx.category_name } : {}),
    ...(tx.account ? { account: tx.account } : {}),
    ...(tx.transfer_to_account ? { transfer_to_account: tx.transfer_to_account } : {}),
    ...(tx.tags ? { tags: tx.tags } : {}),
  }));

  for (let i = 0; i < txs.length; i += batchSize) {
    const batch = txs.slice(i, i + batchSize);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: batch }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Erro ao restaurar transações.");
    }
    restored += typeof data.count === "number" ? data.count : 0;
    duplicates += typeof data.duplicates === "number" ? data.duplicates : 0;
  }

  return { restored, duplicates };
}
