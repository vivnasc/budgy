/**
 * Lógica PURA da correcção de transferências ("Corrigir transferências").
 *
 * Serve a rota `POST /api/transactions/fix-transfers`, que corrige EM CASA os
 * dados que a Vivianne já tem — sem reimportar nada. Está isolada aqui, sem
 * dependências de browser/Supabase, para poder ser testada com:
 *
 *   npx tsx src/lib/fix-transfers.test.ts
 *
 * Convenção de sinal (ver `src/lib/account-balances.ts`):
 *   - receita/despesa: `amount` = magnitude POSITIVA (direcção vem do `type`).
 *   - transferência:   `amount` = valor COM SINAL — dinheiro que ENTRA na conta
 *     é POSITIVO, dinheiro que SAI é NEGATIVO. Assim uma transferência recebida
 *     SOMA ao saldo da conta.
 *
 * A decisão é IDEMPOTENTE: corre duas vezes e dá o mesmo resultado, porque o
 * sinal/tipo final é derivado apenas da descrição (e do tipo actual), nunca do
 * sinal já gravado.
 */

export type TxType = "income" | "expense" | "transfer";

export interface TransferFixInput {
  description: string | null | undefined;
  type: TxType;
  amount: number;
}

export interface TransferFixDecision {
  newType: TxType;
  newAmount: number;
  /** Passou de `income` a `transfer` (transferência recebida mal classificada). */
  reclassified: boolean;
  /** O sinal/valor do montante mudou (transferência re-assinada). */
  resigned: boolean;
}

/** Descrições que são SALÁRIO genuíno — nunca reclassificar como transferência. */
const SALARY_RE = /sal[áa]rio|TEI RCB.*Sal|MTR BIM ORD/i;

/** Uma transferência interbancária RECEBIDA que ficou mal marcada como receita. */
const INCOMING_INTERBANK_RE = [
  /transfer[êe]ncia\s+de\b/i,
  /transfer[êe]ncia\s+recebida/i,
  /via web by .*banco/i,
];

/** Padrões que denunciam uma SAÍDA de dinheiro numa transferência. */
const OUTGOING_RE =
  /para|enviada|metix|conta a conta|m-?pesa para|send money|trf_cart_dig|trf-|interb.*enviada/i;

/** Padrões que denunciam uma ENTRADA de dinheiro numa transferência. */
const INCOMING_RE = /\bde\b|recebida|via web by .*banco|reversal/i;

/**
 * Decide, para UMA transação, se deve ser reclassificada e/ou re-assinada.
 *
 * Nota: esta função trata do caso de UMA conta (transferências importadas de
 * extratos, sem conta de destino). As transferências entre DUAS contas (com
 * `transfer_to_account_id`) são normalizadas separadamente na rota, porque aí o
 * montante é uma magnitude que sai da origem e entra no destino.
 */
export function decideTransferFix(input: TransferFixInput): TransferFixDecision {
  const desc = input.description ?? "";
  const abs = Math.abs(Number(input.amount) || 0);

  // ── Passo 1: receita → transferência (transferência interbancária recebida) ──
  if (
    input.type === "income" &&
    !SALARY_RE.test(desc) &&
    INCOMING_INTERBANK_RE.some((re) => re.test(desc))
  ) {
    const newAmount = abs; // entra → positivo
    return {
      newType: "transfer",
      newAmount,
      reclassified: true,
      resigned: newAmount !== input.amount,
    };
  }

  // ── Passo 2: re-assinar transferências existentes pela direcção ──
  if (input.type === "transfer") {
    let signed: number;
    if (INCOMING_RE.test(desc) && !OUTGOING_RE.test(desc)) {
      signed = abs; // entrada → positivo
    } else if (OUTGOING_RE.test(desc)) {
      signed = -abs; // saída → negativo
    } else {
      signed = -abs; // ambíguo → assume saída (o caso mais comum)
    }
    return {
      newType: "transfer",
      newAmount: signed,
      reclassified: false,
      resigned: signed !== input.amount,
    };
  }

  // ── Sem alteração ──
  return {
    newType: input.type,
    newAmount: input.amount,
    reclassified: false,
    resigned: false,
  };
}
