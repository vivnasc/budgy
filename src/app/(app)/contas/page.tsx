"use client";

import {
  Plus,
  Smartphone,
  Landmark,
  Banknote,
  PiggyBank,
  TrendingUp,
  ArrowUpDown,
  Wallet,
} from "lucide-react";
import { AccountCard } from "@/components/account-card";

interface Account {
  id: string;
  name: string;
  type: string;
  icon: React.ComponentType<{ className?: string }>;
  balance: number;
  currency: string;
  color: string;
  lastTransaction: string;
  lastTransactionDate: string;
}

const MOCK_ACCOUNTS: Account[] = [
  {
    id: "1",
    name: "M-Pesa",
    type: "Mobile Money",
    icon: Smartphone,
    balance: 12450.0,
    currency: "MZN",
    color: "bg-red-500",
    lastTransaction: "Shoprite -4.500 MZN",
    lastTransactionDate: "24 Fev",
  },
  {
    id: "2",
    name: "Millennium BIM",
    type: "Conta Corrente",
    icon: Landmark,
    balance: 45800.0,
    currency: "MZN",
    color: "bg-blue-500",
    lastTransaction: "Salário +65.000 MZN",
    lastTransactionDate: "25 Fev",
  },
  {
    id: "3",
    name: "Dinheiro Físico",
    type: "Dinheiro",
    icon: Banknote,
    balance: 3200.0,
    currency: "MZN",
    color: "bg-amber-500",
    lastTransaction: "Farmácia -950 MZN",
    lastTransactionDate: "18 Fev",
  },
  {
    id: "4",
    name: "Poupança BIM",
    type: "Conta Poupança",
    icon: PiggyBank,
    balance: 180000.0,
    currency: "MZN",
    color: "bg-emerald-500",
    lastTransaction: "Depósito +10.000 MZN",
    lastTransactionDate: "15 Fev",
  },
];

export default function ContasPage() {
  const totalBalance = MOCK_ACCOUNTS.reduce((sum, acc) => sum + acc.balance, 0);
  const liquidAccounts = MOCK_ACCOUNTS.filter(
    (a) => a.type !== "Conta Poupança"
  );
  const liquidBalance = liquidAccounts.reduce(
    (sum, acc) => sum + acc.balance,
    0
  );

  return (
    <div className="min-h-screen pb-4">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-xl font-bold mb-4">As Minhas Contas</h1>

        {/* Net Worth Summary */}
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
              <p className="text-sm font-bold">
                {liquidBalance.toLocaleString("pt-MZ")} MZN
              </p>
            </div>
            <div>
              <p className="text-primary-200 text-xs">Poupança</p>
              <p className="text-sm font-bold">
                {(totalBalance - liquidBalance).toLocaleString("pt-MZ")} MZN
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 pt-6 space-y-6">
        {/* Quick Actions */}
        <div className="flex gap-3">
          <button className="flex-1 card p-3 flex items-center justify-center gap-2 hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <ArrowUpDown className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-medium">Transferir</span>
          </button>
          <button className="flex-1 card p-3 flex items-center justify-center gap-2 hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <TrendingUp className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-medium">Histórico</span>
          </button>
        </div>

        {/* Account Cards */}
        <section>
          <h2 className="font-semibold mb-3">
            Contas{" "}
            <span className="text-xs text-[var(--color-text-muted)] font-normal">
              ({MOCK_ACCOUNTS.length})
            </span>
          </h2>

          <div className="space-y-3">
            {MOCK_ACCOUNTS.map((account) => (
              <AccountCard
                key={account.id}
                name={account.name}
                type={account.type}
                icon={account.icon}
                balance={account.balance}
                currency={account.currency}
                color={account.color}
                lastTransaction={account.lastTransaction}
                lastTransactionDate={account.lastTransactionDate}
              />
            ))}
          </div>
        </section>

        {/* Distribution */}
        <section className="card p-4">
          <h3 className="font-semibold text-sm mb-3">Distribuição</h3>
          <div className="space-y-2">
            {MOCK_ACCOUNTS.map((account) => {
              const percent = (account.balance / totalBalance) * 100;
              return (
                <div key={account.id} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-text-secondary)] w-24 truncate">
                    {account.name}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${account.color} rounded-full transition-all duration-500`}
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
      </main>

      {/* FAB to add account */}
      <button className="fab">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
