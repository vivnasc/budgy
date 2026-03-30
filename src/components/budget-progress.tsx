"use client";

import { RotateCcw } from "lucide-react";

interface BudgetProgressProps {
  category: string;
  budgeted: number;
  spent: number;
  icon: React.ComponentType<{ className?: string }>;
  hasRollover?: boolean;
  rolloverAmount?: number;
}

export function BudgetProgress({
  category,
  budgeted,
  spent,
  icon: Icon,
  hasRollover = false,
  rolloverAmount = 0,
}: BudgetProgressProps) {
  const effectiveBudget = budgeted + rolloverAmount;
  const remaining = effectiveBudget - spent;
  const percentage = Math.min((spent / effectiveBudget) * 100, 100);
  const isOver = spent > effectiveBudget;
  const isNearLimit = percentage >= 80 && !isOver;

  const barColor = isOver
    ? "bg-red-500"
    : isNearLimit
      ? "bg-amber-400"
      : "bg-primary-500";

  const statusColor = isOver
    ? "text-red-500"
    : isNearLimit
      ? "text-amber-600"
      : "text-emerald-600";

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 mb-2">
        {/* Icon */}
        <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-gray-600" />
        </div>

        {/* Category & Amount */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{category}</p>
            {hasRollover && (
              <span className="inline-flex items-center gap-0.5 text-2xs bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded-md font-medium">
                <RotateCcw className="w-2.5 h-2.5" />
                +{rolloverAmount.toLocaleString("pt-MZ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <span>{spent.toLocaleString("pt-MZ")}</span>
            <span>/</span>
            <span>{effectiveBudget.toLocaleString("pt-MZ")} MZN</span>
          </div>
        </div>

        {/* Status */}
        <div className="text-right flex-shrink-0">
          <p className={`text-sm font-bold ${statusColor}`}>
            {isOver ? "+" : ""}
            {Math.abs(remaining).toLocaleString("pt-MZ")}
          </p>
          <p className="text-2xs text-[var(--color-text-muted)]">
            {isOver ? "acima" : "restante"}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Percentage label */}
      <div className="flex justify-end mt-1">
        <span
          className={`text-2xs font-medium ${
            isOver ? "text-red-500" : "text-[var(--color-text-muted)]"
          }`}
        >
          {Math.round((spent / effectiveBudget) * 100)}%
          {isOver && " - Acima do limite!"}
        </span>
      </div>
    </div>
  );
}
