"use client";

/**
 * React hooks for fetching data from Supabase money_schema.
 * Each hook handles loading, error, and data states.
 * Falls back gracefully when Supabase is not configured.
 */

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/auth/client";
import { useUser } from "@/lib/auth/hooks";
import {
  getAccounts,
  getTransactions,
  getBudgets,
  getGoals,
  getDebts,
  getXitiqueGroups,
  getCategories,
  getDashboardData,
  getLatestTransactionDate,
  createTransaction as createTx,
  createTransactions as createTxs,
  createAccount as createAcct,
} from "@/lib/supabase/queries";
import type {
  Account,
  Transaction,
  Budget,
  Goal,
  DebtRecord,
  XitiqueGroup,
  Category,
  TransactionInsert,
  AccountInsert,
} from "@/lib/supabase/types";

function useSupabase() {
  try {
    return createBrowserClient();
  } catch {
    return null;
  }
}

// ─── Generic data hook ──────────────────────────────────────────────────────

function useSupabaseQuery<T>(
  fetcher: (userId: string) => Promise<{ data: T | null; error: unknown }>,
  deps: unknown[] = []
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const { user } = useUser();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    fetcher(user.id).then(({ data: d, error: e }) => {
      if (cancelled) return;
      setData(d);
      setError(e ? String(e) : null);
      setLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, trigger, ...deps]);

  return { data, loading, error, refetch };
}

// ─── Accounts ───────────────────────────────────────────────────────────────

export function useAccounts() {
  const supabase = useSupabase();
  const result = useSupabaseQuery<Account[]>(
    (userId) => supabase ? getAccounts(supabase, userId) : Promise.resolve({ data: [], error: null })
  );

  const create = useCallback(async (account: AccountInsert) => {
    if (!supabase) return { error: "Supabase não configurado" };
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return { error: "Não autenticado" };
    const { error } = await createAcct(supabase, authUser.id, account);
    if (!error) result.refetch();
    return { error: error?.message ?? null };
  }, [supabase, result]);

  return { ...result, create };
}

// ─── Categories ─────────────────────────────────────────────────────────────

export function useCategories() {
  const supabase = useSupabase();
  return useSupabaseQuery<Category[]>(
    () => supabase ? getCategories(supabase) : Promise.resolve({ data: [], error: null })
  );
}

// ─── Transactions ───────────────────────────────────────────────────────────

export function useTransactions(opts: { type?: string; from?: string; to?: string; limit?: number } = {}) {
  const supabase = useSupabase();
  const result = useSupabaseQuery<Transaction[]>(
    (userId) =>
      supabase
        ? getTransactions(supabase, userId, opts).then((r) => ({ data: r.data, error: r.error }))
        : Promise.resolve({ data: [], error: null }),
    [opts.type, opts.from, opts.to, opts.limit]
  );

  const create = useCallback(async (tx: TransactionInsert) => {
    if (!supabase) return { data: null, error: "Supabase não configurado" };
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return { data: null, error: "Não autenticado" };
    const { data, error } = await createTx(supabase, authUser.id, tx);
    if (!error) result.refetch();
    return { data, error: error?.message ?? null };
  }, [supabase, result]);

  const createBulk = useCallback(async (txs: TransactionInsert[]) => {
    if (!supabase) return { data: null, error: "Supabase não configurado" };
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return { data: null, error: "Não autenticado" };
    const { data, error } = await createTxs(supabase, authUser.id, txs);
    if (!error) result.refetch();
    return { data, error: error?.message ?? null };
  }, [supabase, result]);

  return { ...result, create, createBulk };
}

// ─── Budgets ────────────────────────────────────────────────────────────────

export function useBudgets() {
  const supabase = useSupabase();
  return useSupabaseQuery<Budget[]>(
    (userId) => supabase ? getBudgets(supabase, userId) : Promise.resolve({ data: [], error: null })
  );
}

// ─── Goals ──────────────────────────────────────────────────────────────────

export function useGoals() {
  const supabase = useSupabase();
  return useSupabaseQuery<Goal[]>(
    (userId) => supabase ? getGoals(supabase, userId) : Promise.resolve({ data: [], error: null })
  );
}

// ─── Debts ──────────────────────────────────────────────────────────────────

export function useDebts() {
  const supabase = useSupabase();
  return useSupabaseQuery<DebtRecord[]>(
    (userId) => supabase ? getDebts(supabase, userId) : Promise.resolve({ data: [], error: null })
  );
}

// ─── Xitique Groups ────────────────────────────────────────────────────────

export function useXitiqueGroups() {
  const supabase = useSupabase();
  return useSupabaseQuery<XitiqueGroup[]>(
    (userId) => supabase ? getXitiqueGroups(supabase, userId) : Promise.resolve({ data: [], error: null })
  );
}

// ─── Dashboard (aggregated) ─────────────────────────────────────────────────

export function useDashboard() {
  const supabase = useSupabase();
  const { user } = useUser();
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardData>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    getDashboardData(supabase, user.id).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [user, supabase, trigger]);

  return { data, loading, refetch };
}

// ─── Latest transaction month offset ────────────────────────────────────────
// Devolve o offset (em meses, relativo ao mês actual) do mês com a transação
// mais recente. Útil para abrir relatórios/transações no mês onde há dados.
export function useLatestMonthOffset() {
  const supabase = useSupabase();
  const { user } = useUser();
  const [offset, setOffset] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !supabase) {
      setOffset(0);
      return;
    }
    let cancelled = false;
    getLatestTransactionDate(supabase, user.id).then(({ data }) => {
      if (cancelled) return;
      if (!data) {
        setOffset(0);
        return;
      }
      const d = new Date(data + "T00:00:00");
      const now = new Date();
      const diff = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
      setOffset(Math.min(diff, 0));
    });
    return () => { cancelled = true; };
  }, [user, supabase]);

  return offset;
}
