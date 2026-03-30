"use client";

import { TrendingUp, TrendingDown, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface BalanceCardProps {
  totalBalance: number;
  currency: string;
  trend: number;
  period: string;
}

export function BalanceCard({
  totalBalance,
  currency,
  trend,
  period,
}: BalanceCardProps) {
  const [visible, setVisible] = useState(true);
  const isPositive = trend >= 0;

  return (
    <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-primary-100 text-xs">Saldo Total</p>
        <button
          onClick={() => setVisible(!visible)}
          className="p-1 rounded-full hover:bg-white/10 transition-colors"
          aria-label={visible ? "Esconder saldo" : "Mostrar saldo"}
        >
          {visible ? (
            <Eye className="w-4 h-4 text-primary-200" />
          ) : (
            <EyeOff className="w-4 h-4 text-primary-200" />
          )}
        </button>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        {visible ? (
          <>
            <span className="text-3xl font-bold">
              {totalBalance.toLocaleString("pt-MZ")}
            </span>
            <span className="text-sm text-primary-200">{currency}</span>
          </>
        ) : (
          <span className="text-3xl font-bold tracking-widest">
            *** ***
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            isPositive
              ? "bg-white/20 text-white"
              : "bg-red-400/30 text-red-100"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>
            {isPositive ? "+" : ""}
            {trend}%
          </span>
        </div>
        <span className="text-xs text-primary-200">vs mês anterior</span>
      </div>
    </div>
  );
}
