"use client";

interface TransactionItemProps {
  description: string;
  category: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  status?: "pending" | "completed" | "cancelled" | null;
  date: string;
  account: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}

export function TransactionItem({
  description,
  category,
  amount,
  type,
  status,
  date,
  account,
  icon: Icon,
  onClick,
}: TransactionItemProps) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString(
    "pt-MZ",
    {
      day: "numeric",
      month: "short",
    }
  );

  const isPending = status === "pending";
  const isCancelled = status === "cancelled";
  const isCompleted = !status || status === "completed";

  // Cor do indicador de estado (à esquerda do ícone, sempre visível)
  // verde = paga/recebida, amarelo = pendente, cinza = cancelada
  const statusDotColor = isCompleted
    ? "bg-emerald-500"
    : isPending
      ? "bg-amber-500"
      : "bg-gray-400";
  const statusTitle = isCompleted
    ? "Paga / recebida"
    : isPending
      ? "Pendente — não conta no saldo"
      : "Cancelada";

  // Para pendentes esbatemos o valor e o ícone (mas mantemos legível)
  const dimmed = isPending || isCancelled;

  const amountColor =
    type === "income"
      ? isCompleted ? "text-emerald-600" : "text-emerald-400/70"
      : type === "transfer"
        ? isCompleted ? "text-indigo-500" : "text-indigo-400/70"
        : isCompleted ? "text-red-500" : "text-red-400/70";

  const amountPrefix = type === "income" ? "+" : type === "transfer" ? "" : "";

  const iconBg =
    type === "income"
      ? "bg-emerald-50"
      : type === "transfer"
        ? "bg-indigo-50"
        : "bg-red-50";

  const iconColor =
    type === "income"
      ? "text-emerald-600"
      : type === "transfer"
        ? "text-indigo-500"
        : "text-red-500";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 p-3 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer ${isCancelled ? "opacity-50 line-through" : ""}`}
    >
      {/* Status dot — sempre visível à esquerda do ícone */}
      <div
        className={`w-2 h-2 rounded-full ${statusDotColor} flex-shrink-0 ${isPending ? "animate-pulse" : ""}`}
        title={statusTitle}
        aria-label={statusTitle}
      />

      {/* Category Icon */}
      <div
        className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0 ${dimmed ? "opacity-70" : ""}`}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>

      {/* Description & Category */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${dimmed ? "text-gray-500" : ""}`}>{description}</p>
          {isPending && (
            <span className="flex-shrink-0 text-2xs font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
              Pendente
            </span>
          )}
          {isCancelled && (
            <span className="flex-shrink-0 text-2xs font-bold uppercase tracking-wider bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
              Cancelada
            </span>
          )}
          {category === "Ajuste de Saldo" && (
            <span
              className="flex-shrink-0 text-2xs font-bold uppercase tracking-wider bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded"
              title="Calibração contabilística — não conta como movimento real"
            >
              Ajuste
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-[var(--color-text-muted)]">
            {category}
          </span>
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <span className="text-xs text-[var(--color-text-muted)]">
            {formattedDate}
          </span>
        </div>
      </div>

      {/* Amount & Account */}
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-semibold ${amountColor}`}>
          {amountPrefix}
          {Math.abs(amount).toLocaleString("pt-MZ")} <span className="text-xs font-normal">MZN</span>
        </p>
        <span className="inline-block mt-0.5 text-2xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-medium">
          {account}
        </span>
      </div>
    </button>
  );
}
