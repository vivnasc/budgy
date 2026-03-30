"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface FeedbackButtonProps {
  appName: string;
  appColor: string;
}

function FeedbackButton({ appName, appColor }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"bug" | "sugestao" | "outro">("bug");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) return;

    const subject = encodeURIComponent(
      `[${appName}] ${type === "bug" ? "Bug" : type === "sugestao" ? "Sugestão" : "Feedback"}`
    );
    const body = encodeURIComponent(
      `App: ${appName}\nTipo: ${type}\n\n${message}\n\n---\nURL: ${window.location.href}\nUser-Agent: ${navigator.userAgent}`
    );
    window.open(`mailto:suporte@budgy.app?subject=${subject}&body=${body}`, "_blank");

    setSent(true);
    setTimeout(() => {
      setOpen(false);
      setSent(false);
      setMessage("");
    }, 2000);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-50 flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-gray-600 shadow-lg border border-gray-200 transition-all hover:shadow-xl active:scale-95"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Feedback
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/30" onClick={() => { setOpen(false); setSent(false); }} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {sent ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-900">Obrigada!</p>
            <p className="mt-1 text-sm text-gray-500">O teu feedback ajuda-nos a melhorar.</p>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-gray-900">Enviar feedback</h3>
            <p className="mt-1 text-sm text-gray-500">Ajuda-nos a melhorar o {appName}</p>
            <div className="mt-4 flex gap-2">
              {([
                { key: "bug" as const, label: "Bug" },
                { key: "sugestao" as const, label: "Sugestão" },
                { key: "outro" as const, label: "Outro" },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                    type === t.key
                      ? "text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                  style={type === t.key ? { backgroundColor: appColor } : undefined}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === "bug"
                  ? "Descreve o problema que encontraste..."
                  : type === "sugestao"
                    ? "Que funcionalidade gostarias de ver?"
                    : "Conta-nos o que pensas..."
              }
              className="mt-4 h-28 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-200"
              autoFocus
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { setOpen(false); setSent(false); }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!message.trim()}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: appColor }}
              >
                Enviar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { FeedbackButton };
export type { FeedbackButtonProps };
