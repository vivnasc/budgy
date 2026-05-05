"use client";

import { useState } from "react";
import {
  Plus,
  Smartphone,
  Landmark,
  Banknote,
  PiggyBank,
  TrendingUp,
  ArrowUpDown,
  Wallet,
  Pencil,
} from "lucide-react";
import { AccountCard } from "@/components/account-card";
import { OpeningBalanceModal } from "@/components/opening-balance-modal";
import { QuickCreateModal } from "@/components/quick-create-modal";
import { useAccounts } from "@/hooks/use-supabase-data";
import type { Account } from "@/lib/supabase/types";

const ACCOUNT_ICONS: Record<string, { icon: typeof Smartphone; color: string; label: string }> = {
  mpesa: { icon: Smartphone, color: "bg-red-500", label: "Mobile Money" },
  bank: { icon: Landmark, color: "bg-blue-500", label: "Conta Corrente" },
  cash: { icon: Banknote, color: "bg-amber-500", label: "Dinheiro" },
  savings: { icon: PiggyBank, color: "bg-emerald-500", label: "Conta Poupança" },
  investment: { icon: TrendingUp, color: "bg-purple-500", label: "Investimento" },
};

export default function ContasPage() {
  const { data: accounts, loading, refetch } = useAccounts();
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);

  const allAccounts = accounts ?? [];
  const totalBalance = allAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const savingsAccounts = allAccounts.filter((a) => a.type === "savings" || a.type === "investment");
  const savingsBalance = savingsAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const liquidBalance = totalBalance - savingsBalance;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-primary-200 rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-400">A carregar contas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-4">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-xl font-bold mb-4">As Minhas Contas</h1>

        <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-primary-100 text-xs">Património Total</p>
              <p className="text-2xl font-bold">
                {totalBalance.toLocaleString("pt-MZ")}{" "}
                <span className="text-sm font-normal text-primary-200">MZN</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/20">
            <div>
              <p className="text-primary-200 text-xs">Disponível</p>
              <p className="text-sm font-bold">{liquidBalance.toLocaleString("pt-MZ")} MZN</p>
            </div>
            <div>
              <p className="text-primary-200 text-xs">Poupança</p>
              <p className="text-sm font-bold">{savingsBalance.toLocaleString("pt-MZ")} MZN</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 pt-6 space-y-6">
        {/* Quick Actions */}
        <div className="flex gap-3">
          <a href="/transacoes" className="flex-1 card p-3 flex items-center justify-center gap-2 hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <ArrowUpDown className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-medium">Transferências</span>
          </a>
          <a href="/transacoes" className="flex-1 card p-3 flex items-center justify-center gap-2 hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <TrendingUp className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-medium">Histórico</span>
          </a>
        </div>

        {/* Account Cards */}
        <section>
          <h2 className="font-semibold mb-3">
            Contas{" "}
            <span className="text-xs text-[var(--color-text-muted)] font-normal">
              ({allAccounts.length})
            </span>
          </h2>

          {allAccounts.length === 0 ? (
            <div className="card p-8 text-center">
              <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-1">Sem contas ainda</p>
              <p className="text-xs text-gray-400">Adiciona M-Pesa, Banco ou Dinheiro para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allAccounts.map((account) => {
                const config = ACCOUNT_ICONS[account.type] ?? { icon: Wallet, color: "bg-gray-500", label: account.type };
                return (
                  <div key={account.id} className="relative">
                    <AccountCard
                      name={account.name}
                      type={config.label}
                      icon={config.icon}
                      balance={account.balance}
                      currency={account.currency}
                      color={account.color ?? config.color}
                      lastTransaction=""
                      lastTransactionDate=""
                    />
                    <button
                      type="button"
                      onClick={() => setEditingAccount(account)}
                      className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold bg-white/90 hover:bg-white text-gray-700 px-2 py-1 rounded-lg shadow border border-gray-200"
                      title="Acertar com o saldo real do banco"
                    >
                      <Pencil className="w-3 h-3" />
                      Acertar saldo
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Distribution */}
        {allAccounts.length > 0 && totalBalance > 0 && (
          <section className="card p-4">
            <h3 className="font-semibold text-sm mb-3">Distribuição</h3>
            <div className="space-y-2">
              {allAccounts.map((account) => {
                const percent = (account.balance / totalBalance) * 100;
                const config = ACCOUNT_ICONS[account.type] ?? { color: "bg-gray-500" };
                return (
                  <div key={account.id} className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-text-secondary)] w-24 truncate">
                      {account.name}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${account.color ?? config.color} rounded-full transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-10 text-right">
                      {Math.round(percent)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <button onClick={() => setCreating(true)} className="fab">
        <Plus className="w-6 h-6" />
      </button>

      {editingAccount && (
        <OpeningBalanceModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSaved={() => refetch()}
        />
      )}

      {creating && (
        <QuickCreateModal
          kind="account"
          onClose={() => setCreating(false)}
          onCreated={() => refetch()}
        />
      )}
    </div>
  );
}
