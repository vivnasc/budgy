/**
 * Reconhecimento de contrapartidas de transferências entre importações.
 *
 * A utilizadora importa um extracto de cada vez (ex: CPC hoje, Moza para a
 * semana). Uma transferência entre as SUAS PRÓPRIAS contas aparece como DUAS
 * linhas: a saída no CPC (ex: 100000) e a entrada no Moza (ex: +100000). Quando
 * o segundo extracto é importado, a linha de entrada é a CONTRAPARTIDA de uma
 * transferência JÁ GUARDADA a partir do outro lado — não é dinheiro novo.
 *
 * Este módulo contém a lógica PURA de emparelhamento (sem BD, sem rede) para
 * ser facilmente testável. O endpoint /api/transactions/match-transfers busca
 * as transferências já guardadas e delega o emparelhamento aqui.
 *
 * IMPORTANTE sobre o sinal do `amount`:
 *   - Parser CPC: `amount = credit > 0 ? credit : Math.abs(debit)` → SEMPRE
 *     POSITIVO; a direcção vem do campo `type`.
 *   - Parser Moza: `amount = credit > 0 ? credit : debit`, e a coluna Débito do
 *     Moza traz o sinal negativo (ex: "-2420,00"), pelo que uma saída pode ser
 *     guardada NEGATIVA enquanto uma entrada é positiva.
 * Como a convenção NÃO é consistente entre bancos, o emparelhamento compara
 * sempre `Math.abs(amount)` arredondado a 2 casas decimais.
 */

/** Janela de tolerância entre as duas datas da mesma transferência (dias). */
export const MATCH_DATE_WINDOW_DAYS = 5;

export type TxType = "income" | "expense" | "transfer";

/** Candidato ainda por guardar (vem do preview de importação / SMS). */
export interface TransferCandidate {
  tempId: string;
  date: string; // ISO YYYY-MM-DD
  amount: number;
  type: TxType;
}

/** Transferência já guardada na BD (já filtrada: type=transfer, com conta). */
export interface ExistingTransfer {
  id: string;
  date: string; // ISO YYYY-MM-DD
  amount: number;
  /** Nome da conta da transferência já guardada (pode ser null). */
  account: string | null;
}

/** Resultado: candidato que encontrou contrapartida. */
export interface TransferMatch {
  tempId: string;
  account: string | null;
  date: string; // a data do candidato
}

/** Chave estável para comparar montantes independentemente do sinal. */
function amountKey(amount: number): number {
  return Math.round(Math.abs(amount) * 100);
}

/** Diferença absoluta em dias entre duas datas ISO (YYYY-MM-DD). */
function dayDiff(a: string, b: string): number {
  const ta = Date.parse(a + "T00:00:00Z");
  const tb = Date.parse(b + "T00:00:00Z");
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((ta - tb) / 86_400_000));
}

/**
 * Emparelha cada candidato do tipo "transfer" com uma transferência já
 * guardada que:
 *   - tenha o MESMO montante absoluto (2 casas decimais);
 *   - esteja dentro de ±MATCH_DATE_WINDOW_DAYS da data do candidato.
 *
 * Emparelhamento um-para-um: uma transferência guardada não é reutilizada para
 * dois candidatos (marcada como consumida). Prefere a data mais próxima.
 *
 * NÃO define transfer_to_account_id nem altera saldos — é apenas
 * reconhecimento/etiquetagem. Ambas as pernas continuam independentes.
 */
export function matchTransferCounterparts(
  candidates: TransferCandidate[],
  existing: ExistingTransfer[]
): TransferMatch[] {
  const transfers = candidates.filter((c) => c.type === "transfer");
  if (transfers.length === 0) return [];

  const consumed = new Set<string>();
  const matches: TransferMatch[] = [];

  for (const cand of transfers) {
    const candAmount = amountKey(cand.amount);
    let best: { existing: ExistingTransfer; diff: number } | null = null;

    for (const ex of existing) {
      if (consumed.has(ex.id)) continue;
      if (amountKey(ex.amount) !== candAmount) continue;
      const diff = dayDiff(cand.date, ex.date);
      if (diff > MATCH_DATE_WINDOW_DAYS) continue;
      if (!best || diff < best.diff) {
        best = { existing: ex, diff };
      }
    }

    if (best) {
      consumed.add(best.existing.id);
      matches.push({
        tempId: cand.tempId,
        account: best.existing.account,
        date: cand.date,
      });
    }
  }

  return matches;
}
