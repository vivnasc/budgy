/**
 * Parceiro Financeiro — camada de IA (Claude).
 *
 * - Guarda a chave da Anthropic da utilizadora APENAS no browser (localStorage).
 * - Constrói um "contexto financeiro" compacto a partir dos dados reais dela.
 * - Chama a Messages API da Anthropic directamente do browser (streaming).
 *
 * A chave nunca é registada em logs nem enviada para lado nenhum além da própria
 * API da Anthropic.
 */

import { signatureFor } from "@/lib/learned-rules";
import { cycleKeyFor, cycleLabel } from "@/lib/period";
import type { Account, Transaction, Goal } from "@/lib/supabase/types";

// ─── Chave da API (só no dispositivo) ───────────────────────────────────────

export const ANTHROPIC_KEY_STORAGE = "budgy-anthropic-key";

/** Modelo usado pelo Parceiro. */
export const PARCEIRO_MODEL = "claude-sonnet-5";

export function getAnthropicKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ANTHROPIC_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setAnthropicKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANTHROPIC_KEY_STORAGE, key.trim());
  } catch {
    /* ignora — storage indisponível */
  }
}

export function clearAnthropicKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ANTHROPIC_KEY_STORAGE);
  } catch {
    /* ignora */
  }
}

/** Mostra a chave mascarada (ex: "sk-ant-…a1b2"). Nunca revela o meio. */
export function maskKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 10) return "••••••";
  return `${trimmed.slice(0, 7)}…${trimmed.slice(-4)}`;
}

// ─── Helpers de cálculo (alinhados com a página de Análise) ──────────────────

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function coefVariation(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((s, n) => s + n, 0) / nums.length;
  if (mean <= 0) return Infinity;
  const variance =
    nums.reduce((s, n) => s + (n - mean) * (n - mean), 0) / nums.length;
  return Math.sqrt(variance) / mean;
}

/** Movimento contável: exclui transferências entre contas próprias e cancelados. */
function isSpendable(tx: Transaction): boolean {
  if (tx.type === "transfer") return false;
  if (tx.status === "cancelled") return false;
  if (tx.categories?.name === "Ajuste de Saldo") return false;
  return true;
}

function round(n: number): number {
  return Math.round(n);
}

const STABLE_CV_MAX = 0.35;

// ─── Contexto financeiro ─────────────────────────────────────────────────────

export interface FinancialContext {
  hoje: string;
  mes_actual: string;
  ciclo_actual: string;
  dia_inicio_mes: number;
  saldo_total_mzn: number;
  contas: { nome: string; saldo_mzn: number }[];
  mes: {
    entradas_mzn: number;
    saidas_mzn: number;
    poupanca_mzn: number;
    taxa_poupanca_pct: number;
  };
  historico: { mes: string; entradas_mzn: number; saidas_mzn: number }[];
  top_categorias: { nome: string; valor_mzn: number; pct: number }[];
  despesas_fixas: { nome: string; valor_mes_mzn: number }[];
  total_fixo_mes_mzn: number;
  metas: {
    nome: string;
    alvo_mzn: number;
    actual_mzn: number;
    restante_mzn: number;
    prazo: string | null;
  }[];
  meta_ticiane: {
    nome: string;
    alvo_mzn: number;
    actual_mzn: number;
    restante_mzn: number;
    prazo: string | null;
  } | null;
  nota: string;
}

/** Deteta uma meta que pareça ser da filha (Ticiane / faculdade / educação). */
function looksLikeTiciane(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("ticy") ||
    n.includes("tici") ||
    n.includes("faculdade") ||
    n.includes("universidade") ||
    n.includes("educa") ||
    n.includes("filha") ||
    n.includes("college")
  );
}

/**
 * Constrói um contexto compacto (números resumidos, nunca dumps de 500 linhas)
 * a partir das transações, contas e metas reais da utilizadora.
 *
 * @param txs Transações de uma janela de vários meses (idealmente ~6 meses).
 * @param accounts Contas activas.
 * @param goals Metas de poupança.
 * @param anchorCycleStart Início do ciclo "actual" (YYYY-MM-DD) a analisar.
 * @param startDay Dia de início do ciclo de salário (1..28). 1 = mês do calendário.
 */
export function buildFinancialContext(
  txs: Transaction[],
  accounts: Account[],
  goals: Goal[],
  anchorCycleStart: string,
  startDay: number
): FinancialContext {
  const spendable = txs.filter(isSpendable);
  const expenses = spendable.filter((t) => t.type === "expense");
  const incomes = spendable.filter((t) => t.type === "income");

  // Chave = ciclo de salário (com startDay=1 é idêntico ao mês do calendário).
  const cycleKey = (dateStr: string) => cycleKeyFor(dateStr ?? "", startDay);

  // ── Ciclo actual ──
  const curExp = expenses.filter((t) => cycleKey(t.date) === anchorCycleStart);
  const curInc = incomes.filter((t) => cycleKey(t.date) === anchorCycleStart);
  const entradas = curInc.reduce((s, t) => s + Math.abs(t.amount), 0);
  const saidas = curExp.reduce((s, t) => s + Math.abs(t.amount), 0);
  const poupanca = entradas - saidas;
  const taxaPoupanca = entradas > 0 ? Math.round((poupanca / entradas) * 100) : 0;

  // ── Histórico (últimos ciclos presentes, máx 5) ──
  const byCycle = new Map<string, { ent: number; sai: number }>();
  for (const t of incomes) {
    const k = cycleKey(t.date);
    const e = byCycle.get(k) ?? { ent: 0, sai: 0 };
    e.ent += Math.abs(t.amount);
    byCycle.set(k, e);
  }
  for (const t of expenses) {
    const k = cycleKey(t.date);
    const e = byCycle.get(k) ?? { ent: 0, sai: 0 };
    e.sai += Math.abs(t.amount);
    byCycle.set(k, e);
  }
  const historico = Array.from(byCycle.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 5)
    .map(([key, v]) => ({
      mes: cycleLabel(key, startDay),
      entradas_mzn: round(v.ent),
      saidas_mzn: round(v.sai),
    }));

  // ── Top categorias do mês actual ──
  const catMap = new Map<string, number>();
  for (const t of curExp) {
    const cat = t.categories?.name ?? "Outros";
    catMap.set(cat, (catMap.get(cat) ?? 0) + Math.abs(t.amount));
  }
  const totalMes = Array.from(catMap.values()).reduce((s, v) => s + v, 0);
  const topCategorias = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([nome, valor]) => ({
      nome,
      valor_mzn: round(valor),
      pct: totalMes > 0 ? Math.round((valor / totalMes) * 100) : 0,
    }));

  // ── Despesas fixas (recorrentes estáveis) ──
  const buckets = new Map<string, { monthTotals: Map<string, number>; labels: Map<string, number> }>();
  for (const t of expenses) {
    const sig = signatureFor(t.description ?? "");
    if (!sig) continue;
    let b = buckets.get(sig);
    if (!b) {
      b = { monthTotals: new Map(), labels: new Map() };
      buckets.set(sig, b);
    }
    const mk = cycleKey(t.date);
    b.monthTotals.set(mk, (b.monthTotals.get(mk) ?? 0) + Math.abs(t.amount));
    const desc = (t.description ?? "").trim();
    if (desc) b.labels.set(desc, (b.labels.get(desc) ?? 0) + 1);
  }
  const fixas: { nome: string; valor_mes_mzn: number }[] = [];
  for (const [sig, b] of buckets.entries()) {
    if (b.monthTotals.size < 2) continue; // recorrente = >= 2 meses
    const totals = Array.from(b.monthTotals.values());
    if (coefVariation(totals) > STABLE_CV_MAX) continue; // valor varia → não é fixa
    if (/paypal/i.test(sig)) continue; // agregador, mistura beneficiários
    let bestLabel = sig;
    let bestN = -1;
    for (const [l, n] of b.labels.entries()) {
      if (n > bestN) {
        bestLabel = l;
        bestN = n;
      }
    }
    fixas.push({
      nome: bestLabel.replace(/\d{6}\*+\d{4}/g, "").replace(/\s+/g, " ").trim().slice(0, 40),
      valor_mes_mzn: round(median(totals)),
    });
  }
  fixas.sort((a, b) => b.valor_mes_mzn - a.valor_mes_mzn);
  const fixasTop = fixas.slice(0, 12);
  const totalFixo = fixas.reduce((s, r) => s + r.valor_mes_mzn, 0);

  // ── Contas + saldo total ──
  const contas = (accounts ?? []).map((a) => ({
    nome: a.name,
    saldo_mzn: round(a.balance ?? 0),
  }));
  const saldoTotal = contas.reduce((s, c) => s + c.saldo_mzn, 0);

  // ── Metas ──
  const metaList = (goals ?? [])
    .filter((g) => !g.is_completed)
    .map((g) => ({
      nome: g.name,
      alvo_mzn: round(g.target_amount ?? 0),
      actual_mzn: round(g.current_amount ?? 0),
      restante_mzn: round(Math.max((g.target_amount ?? 0) - (g.current_amount ?? 0), 0)),
      prazo: g.deadline ?? null,
    }));
  const metaTiciane = metaList.find((m) => looksLikeTiciane(m.nome)) ?? null;

  const nowIso = new Date().toISOString().slice(0, 10);
  const cicloLabel = cycleLabel(anchorCycleStart, startDay, true);

  return {
    hoje: nowIso,
    mes_actual: cicloLabel,
    ciclo_actual: cicloLabel,
    dia_inicio_mes: startDay,
    saldo_total_mzn: round(saldoTotal),
    contas,
    mes: {
      entradas_mzn: round(entradas),
      saidas_mzn: round(saidas),
      poupanca_mzn: round(poupanca),
      taxa_poupanca_pct: taxaPoupanca,
    },
    historico,
    top_categorias: topCategorias,
    despesas_fixas: fixasTop,
    total_fixo_mes_mzn: round(totalFixo),
    metas: metaList,
    meta_ticiane: metaTiciane,
    nota:
      `Todos os valores estão em Meticais (MZN). Transferências entre contas próprias já foram excluídas dos totais de entradas/saídas. O mês da utilizadora começa no dia ${startDay}: quando falares de "este mês/ciclo" refere-te ao ciclo ${cicloLabel} (de salário a salário, não ao mês do calendário).`,
  };
}

// ─── System prompt (personalidade do coach) ─────────────────────────────────

export const PARCEIRO_SYSTEM = `És o "Parceiro Financeiro" da BUDGY — o parceiro de dinheiro da Vivianne, uma empreendedora moçambicana em Maputo. Ela ganha bem mas é gastadora impulsiva e QUER melhorar. Tem uma filha, a Ticiane (Ticy), e um dos objectivos dela é juntar dinheiro para a faculdade da Ticy.

O TEU PAPEL:
- Falas português de Moçambique, de forma calorosa, próxima e directa. Trata-a por "tu".
- És um PARCEIRO honesto, não um professor. Nada de sermões longos. Respostas curtas, práticas, humanas.
- Usas sempre Meticais (MZN). Escreve os valores como "8.000 MZN".
- Respondes com base nos NÚMEROS REAIS dela, que recebes em JSON no início de cada conversa. Nunca inventes números — se não tiveres o dado, diz que ainda não tens essa informação.

QUANDO ELA PERGUNTA "POSSO COMPRAR X?":
- Dá uma resposta concreta: SIM, NÃO, ou ESPERA (e até quando / quanto).
- Fundamenta em 1-2 números reais: saldo, poupança do mês, despesas fixas que ainda faltam pagar, e o impacto na meta da Ticy.
- Se a compra é razoável face ao que ela tem, diz que sim sem culpa. Se compromete as contas ou a meta da Ticy, explica com carinho porque é melhor esperar, e sugere um plano ("se poupares X por semana, em N semanas compras isto sem mexer na Ticy").

COMPORTAMENTO:
- Celebra os bons hábitos. Se ela poupou, controlou-se, ou baixou gastos — reconhece com entusiasmo. Reforço positivo, nunca vergonha.
- Sê gentil mas verdadeiro. Se ela está a gastar demais, diz — com jeito, não com julgamento.
- Liga sempre que fizer sentido à meta da Ticy: é a âncora da motivação dela.
- No máximo ~120 palavras por resposta, a menos que ela peça detalhe. Usa **negrito** para o essencial e no máximo uma lista curta quando ajudar.`;

// ─── Chamada à Messages API (streaming, directo do browser) ──────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Chama Claude em streaming. Invoca `onDelta` com cada pedaço de texto.
 * Devolve o texto completo. Lança Error com mensagem amigável em caso de falha.
 */
export async function streamParceiro(
  apiKey: string,
  context: FinancialContext,
  history: ChatMessage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const systemWithData = `${PARCEIRO_SYSTEM}

DADOS FINANCEIROS REAIS DA VIVIANNE (JSON, valores em MZN):
${JSON.stringify(context)}`;

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model: PARCEIRO_MODEL,
        max_tokens: 1200,
        stream: true,
        thinking: { type: "disabled" },
        system: systemWithData,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
  } catch {
    throw new Error(
      "Não consegui ligar-me à Anthropic. Verifica a tua ligação à internet e tenta outra vez."
    );
  }

  if (!res.ok || !res.body) {
    let friendly = "Algo correu mal ao falar com o Claude. Tenta novamente daqui a pouco.";
    try {
      const err = (await res.json()) as { error?: { type?: string; message?: string } };
      const type = err?.error?.type ?? "";
      if (res.status === 401 || type === "authentication_error") {
        friendly =
          "A tua chave da Anthropic parece inválida ou expirou. Verifica-a nas definições do Parceiro.";
      } else if (res.status === 429 || type === "rate_limit_error") {
        friendly = "Muitos pedidos de seguida. Espera uns segundos e tenta de novo.";
      } else if (res.status === 400 && err?.error?.message) {
        friendly = "Pedido inválido: " + err.error.message;
      } else if (res.status >= 500) {
        friendly = "O serviço da Anthropic está com problemas neste momento. Tenta mais tarde.";
      }
    } catch {
      /* corpo não-JSON — usa mensagem genérica */
    }
    throw new Error(friendly);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Processa eventos SSE separados por linha em branco.
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      for (const line of evt.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string };
            error?: { message?: string };
          };
          if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
            const chunk = json.delta.text ?? "";
            if (chunk) {
              full += chunk;
              onDelta(chunk);
            }
          } else if (json.type === "error") {
            throw new Error(
              json.error?.message ?? "Erro do Claude durante a resposta."
            );
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("Erro")) throw e;
          // JSON parcial/desconhecido — ignora
        }
      }
    }
  }

  return full;
}
