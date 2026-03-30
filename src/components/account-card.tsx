"use client";

import { ChevronRight } from "lucide-react";

interface AccountCardProps {
  name: string;
  type: string;
  icon: React.ComponentType<{ className?: string }>;
  balance: number;
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
  currency,
  color,
  lastTransaction,
  lastTransactionDate,
}: AccountCardProps) {
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

          <p className="text-lg font-bold mt-0.5">
            {balance.toLocaleString("pt-MZ")}{" "}
            <span className="text-xs font-normal text-[var(--color-text-muted)]">
              {currency}
            </span>
          </p>

          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-[var(--color-text-muted)]">
              {lastTransaction}
            </span>
            <span className="w-1 h-1 bg-gray-300 rounded-full" />
            <span className="text-xs text-[var(--color-text-muted)]">
              {lastTransactionDate}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
      </div>
    </div>
  );
}
