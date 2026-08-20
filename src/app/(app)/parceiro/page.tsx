"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HandHeart,
  Send,
  KeyRound,
  ShieldCheck,
  Trash2,
  Pencil,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useTransactions, useAccounts, useGoals, useLatestMonthOffset } from "@/hooks/use-supabase-data";
import {
  buildFinancialContext,
  streamParceiro,
  getAnthropicKey,
  setAnthropicKey,
  clearAnthropicKey,
  maskKey,
  type ChatMessage,
} from "@/lib/parceiro";

// ─── Janela de dados: 6 meses ancorados no mês com dados mais recentes ───────

const WINDOW_MONTHS = 6;

function monthKeyForOffset(offset: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(offset: number): { from: string; to: string } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return { from, to };
}

// ─── Render simples de **negrito** + quebras de linha ────────────────────────

function renderRich(text: string) {
  const lines = text.split("\n");
  return lines.map((line, li) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <span key={li}>
        {parts.map((p, pi) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={pi} className="font-semibold text-white">
              {p.slice(2, -2)}
            </strong>
          ) : (
            <span key={pi}>{p}</span>
          )
        )}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

const QUICK_PROMPTS = [
  "Posso comprar isto?",
  "Como estou este mês?",
  "Quanto posso poupar para a Ticy?",
  "Onde estou a gastar demais?",
];

interface UiMessage extends ChatMessage {
  id: string;
}

// ─── Secção de configuração da chave ─────────────────────────────────────────

function KeySettings({
  hasKey,
  maskedKey,
  onSave,
  onRemove,
}: {
  hasKey: boolean;
  maskedKey: string;
  onSave: (key: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(!hasKey);
  const [value, setValue] = useState("");

  if (hasKey && !editing) {
    return (
      <div className="card p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-100">Chave ligada</p>
          <p className="text-2xs text-gray-500 font-mono truncate">{maskedKey}</p>
        </div>
        <button
          onClick={() => {
            setValue("");
            setEditing(true);
          }}
          className="flex items-center gap-1 text-2xs text-gray-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5"
        >
          <Pencil className="w-3.5 h-3.5" /> Mudar
        </button>
        <button
          onClick={onRemove}
          className="flex items-center gap-1 text-2xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg hover:bg-red-500/10"
        >
          <Trash2 className="w-3.5 h-3.5" /> Remover
        </button>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-bold text-gray-100">Liga o teu Parceiro</h2>
      </div>
      <p className="text-xs text-gray-400 mb-3 leading-relaxed">
        Cola a tua chave da <span className="text-gray-200">Anthropic</span> (Claude). A chave fica
        guardada <span className="text-emerald-400 font-medium">só no teu telemóvel</span> — nunca
        sai daqui nem é partilhada.
      </p>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="sk-ant-..."
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-emerald-500/50 focus:bg-white/[0.07]"
      />
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => {
            if (value.trim().length < 10) return;
            onSave(value.trim());
            setValue("");
            setEditing(false);
          }}
          disabled={value.trim().length < 10}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
        >
          Guardar chave
        </button>
        {hasKey && (
          <button
            onClick={() => {
              setValue("");
              setEditing(false);
            }}
            className="rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function ParceiroPage() {
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Carrega estado da chave só no cliente (evita mismatch de hidratação).
  useEffect(() => {
    const k = getAnthropicKey();
    setHasKey(!!k);
    setMaskedKey(k ? maskKey(k) : "");
  }, []);

  // ── Dados reais ──
  const latestOffset = useLatestMonthOffset();
  const effectiveOffset = latestOffset ?? 0;
  const { from, to } = useMemo(() => {
    const start = monthBounds(effectiveOffset - (WINDOW_MONTHS - 1));
    const end = monthBounds(effectiveOffset);
    return { from: start.from, to: end.to };
  }, [effectiveOffset]);

  const { data: transactions } = useTransactions({ from, to, limit: 5000 });
  const { data: accounts } = useAccounts();
  const { data: goals } = useGoals();
  const anchorKey = useMemo(() => monthKeyForOffset(effectiveOffset), [effectiveOffset]);

  const context = useMemo(
    () =>
      buildFinancialContext(
        transactions ?? [],
        accounts ?? [],
        goals ?? [],
        anchorKey
      ),
    [transactions, accounts, goals, anchorKey]
  );

  // Auto-scroll para o fim.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const handleSaveKey = useCallback((key: string) => {
    setAnthropicKey(key);
    setHasKey(true);
    setMaskedKey(maskKey(key));
    setShowSettings(false);
  }, []);

  const handleRemoveKey = useCallback(() => {
    clearAnthropicKey();
    setHasKey(false);
    setMaskedKey("");
  }, []);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busy) return;
      const key = getAnthropicKey();
      if (!key) {
        setShowSettings(true);
        return;
      }

      setError(null);
      setInput("");
      const userMsg: UiMessage = { id: `u-${Date.now()}`, role: "user", content: clean };
      const assistantId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setBusy(true);

      const history: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: clean },
      ];

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamParceiro(
          key,
          context,
          history,
          (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + delta } : m
              )
            );
          },
          controller.signal
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Algo correu mal. Tenta de novo.";
        setError(msg);
        // Remove a bolha vazia do assistente se não veio nada.
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.content === ""))
        );
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, messages, context]
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col min-h-[calc(100vh-2rem)]">
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-600/90 to-teal-700/90 backdrop-blur-xl text-white px-4 pt-6 pb-6 rounded-2xl flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <HandHeart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Parceiro</h1>
              <p className="text-2xs text-emerald-100/90">O teu parceiro de dinheiro</p>
            </div>
          </div>
          {hasKey && (
            <button
              onClick={() => setShowSettings((s) => !s)}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-2xs font-medium text-emerald-50 hover:bg-white/20"
            >
              <KeyRound className="w-3.5 h-3.5" /> Chave
            </button>
          )}
        </div>
      </header>

      <div className="pt-4 space-y-4 flex-1 flex flex-col min-h-0">
        {/* Definições da chave */}
        {(!hasKey || showSettings) && (
          <KeySettings
            hasKey={hasKey}
            maskedKey={maskedKey}
            onSave={handleSaveKey}
            onRemove={handleRemoveKey}
          />
        )}

        {hasKey && (
          <>
            {/* Conversa */}
            <div
              ref={scrollRef}
              className="flex-1 min-h-[40vh] overflow-y-auto space-y-3 px-0.5"
            >
              {isEmpty && !busy && (
                <div className="card p-6 text-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-100 mb-1">
                    Olá! Sou o teu Parceiro.
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Pergunta-me qualquer coisa sobre o teu dinheiro. Conheço os teus números
                    reais — saldos, gastos e a meta da Ticy. Sou directo e sem julgamentos.
                  </p>
                </div>
              )}

              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-2.5 text-sm text-white shadow-md shadow-emerald-500/10">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-start">
                    <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white/[0.06] border border-white/10 px-3.5 py-2.5 text-sm text-gray-200 leading-relaxed">
                      {m.content ? (
                        renderRich(m.content)
                      ) : (
                        <span className="inline-flex gap-1 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-bounce" />
                        </span>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">{error}</p>
              </div>
            )}

            {/* Sugestões rápidas */}
            {isEmpty && !busy && (
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full bg-white/5 border border-white/10 px-3.5 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white active:scale-95 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2 flex-shrink-0 pb-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Escreve aqui... (ex: posso comprar o carrinho da Shein de 8000?)"
                className="flex-1 resize-none rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-emerald-500/50 max-h-32"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="w-11 h-11 flex-shrink-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
                aria-label="Enviar"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
