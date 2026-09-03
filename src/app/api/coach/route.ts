import { NextResponse } from "next/server";

/**
 * POST /api/coach
 *
 * Proxy servidor para a Messages API da Anthropic, usada pelo Parceiro Financeiro.
 *
 * A chave é resolvida assim:
 *   1. process.env.ANTHROPIC_API_KEY  (configurada no Vercel — vale em todos os aparelhos)
 *   2. body.apiKey                    (chave colada, guardada no localStorage do browser)
 *
 * Se nenhuma existir, devolve { error: "no_key" } com status 400 — o cliente
 * faz então fallback à chamada directa do browser com a chave local.
 *
 * A chave NUNCA é registada em logs.
 *
 * Corpo esperado: { messages, system, model?, max_tokens?, apiKey? }
 * A resposta é o stream SSE da Anthropic, encaminhado tal como recebido.
 */

export const runtime = "edge";

interface CoachBody {
  messages?: { role: "user" | "assistant"; content: string }[];
  system?: string;
  model?: string;
  max_tokens?: number;
  apiKey?: string;
}

const DEFAULT_MODEL = "claude-sonnet-5";

export async function POST(request: Request) {
  let body: CoachBody;
  try {
    body = (await request.json()) as CoachBody;
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Corpo inválido." },
      { status: 400 }
    );
  }

  // Nunca registar a chave — apenas verificar a existência.
  const key = process.env.ANTHROPIC_API_KEY || body.apiKey;
  if (!key) {
    return NextResponse.json(
      {
        error: "no_key",
        message:
          "Sem chave da Anthropic. Configura ANTHROPIC_API_KEY no servidor ou cola a chave nas definições.",
      },
      { status: 400 }
    );
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json(
      { error: "bad_request", message: "Sem mensagens." },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: body.model || DEFAULT_MODEL,
        max_tokens: body.max_tokens ?? 1200,
        stream: true,
        thinking: { type: "disabled" },
        system: body.system ?? "",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
  } catch {
    return NextResponse.json(
      {
        error: "upstream_unreachable",
        message: "Não consegui ligar-me à Anthropic. Tenta novamente.",
      },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    // Encaminha o estado + corpo de erro (sem a chave) para o cliente traduzir.
    let detail: unknown = null;
    try {
      detail = await upstream.json();
    } catch {
      /* corpo não-JSON */
    }
    return NextResponse.json(
      { error: "upstream_error", status: upstream.status, detail },
      { status: upstream.status || 502 }
    );
  }

  // Encaminha o stream SSE tal e qual.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
