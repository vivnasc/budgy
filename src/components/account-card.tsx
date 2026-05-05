"use client";

import { ChevronRight } from "lucide-react";

interface AccountCardProps {
  name: string;
  type: string;
  icon: React.ComponentType<{ className?: string }>;
  balance: number;
  /** Optional. When supplied and different from `balance`, a "Previsto" row is shown. */
  balancePredicted?: number;
  currency: string;
  color: string;
  lastTransaction: string;
  lastTransactionDate: string;
}

export function AccountCard({
  name,
  type,
  icon: Icon,
  balance,
  balancePredicted,
  currency,
  color,
  lastTransaction,
  lastTransactionDate,
}: AccountCardProps) {
  const showPredicted =
    typeof balancePredicted === "number" && balancePredicted !== balance;

  return (
    <div className="card p-4 hover:shadow-soft active:bg-gray-50 transition-all cursor-pointer">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>

        {/* Account Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{name}</h3>
            <span className="text-2xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-medium flex-shrink-0">
              {type}
            </span>
          </div>

          <p className={`text-lg font-bold mt-0.5 ${balance < 0 ? "text-red-600" : ""}`}>
            {balance.toLocaleString("pt-MZ")}{" "}
            <span className="text-xs font-normal text-[var(--color-text-muted)]">
              {currency}
            </span>
          </p>

          {showPredicted && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Previsto:{" "}
              <span className={`font-semibold ${balancePredicted! < 0 ? "text-red-500" : "text-emerald-600"}`}>
                {balancePredicted!.toLocaleString("pt-MZ")} {currency}
              </span>
            </p>
          )}

          {(lastTransaction || lastTransactionDate) && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-[var(--color-text-muted)]">
                {lastTransaction}
              </span>
              {lastTransaction && lastTransactionDate && (
                <span className="w-1 h-1 bg-gray-300 rounded-full" />
              )}
              <span className="text-xs text-[var(--color-text-muted)]">
                {lastTransactionDate}
              </span>
            </div>
          )}
        </div>

        {/* Arrow */}
        <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
      </div>
    </div>
  );
}
