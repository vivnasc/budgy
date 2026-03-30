"use client";

import { CheckCircle2 } from "lucide-react";

interface GoalCardProps {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  current: number;
  target: number;
  deadline: string;
  color: string;
  completed?: boolean;
}

function getDeadlineCountdown(deadline: string): string {
  const now = new Date();
  const target = new Date(deadline);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return "Vencido";

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 365) {
    const years = Math.floor(diffDays / 365);
    return `${years} ano${years > 1 ? "s" : ""}`;
  }
  if (diffDays > 30) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months > 1 ? "meses" : "mês"}`;
  }
  return `${diffDays} dia${diffDays > 1 ? "s" : ""}`;
}

export function GoalCard({
  name,
  icon: Icon,
  current,
  target,
  deadline,
  color,
  completed = false,
}: GoalCardProps) {
  const percentage = Math.min((current / target) * 100, 100);
  const countdown = getDeadlineCountdown(deadline);

  return (
    <div
      className={`card p-4 relative overflow-hidden ${
        completed ? "opacity-75" : ""
      }`}
    >
      {completed && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>
      )}

      {/* Icon */}
      <div
        className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>

      {/* Name */}
      <h3 className="text-sm font-semibold truncate mb-1">{name}</h3>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Amounts */}
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-bold">
          {current >= 1000
            ? `${(current / 1000).toFixed(0)}k`
            : current.toLocaleString("pt-MZ")}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          /{" "}
          {target >= 1000
            ? `${(target / 1000).toFixed(0)}k`
            : target.toLocaleString("pt-MZ")}{" "}
          MZN
        </span>
      </div>

      {/* Deadline & Percentage */}
      <div className="flex items-center justify-between">
        <span className="text-2xs text-[var(--color-text-muted)]">
          {completed ? "Concluída" : countdown}
        </span>
        <span
          className={`text-2xs font-semibold ${
            completed ? "text-emerald-600" : "text-[var(--color-text-secondary)]"
          }`}
        >
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
}
