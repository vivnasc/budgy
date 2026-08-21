import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { persistAccountBalances } from "@/lib/account-balances";
import { decideTransferFix } from "@/lib/fix-transfers";

/**
 * POST /api/transactions/fix-transfers
 *
 * Corrige EM CASA as transferências da utilizadora, sem reimportar nada. De
 * forma IDEMPOTENTE (correr duas vezes dá o mesmo resultado):
 *
 *   1. Reclassifica transferências interbancárias RECEBIDAS que ficaram mal
 *      marcadas como receita (`income`) → `transfer`, categoria "Transferência",
 *      montante positivo (dinheiro que entra).
 *   2. Re-assina as transferências existentes pela direcção: entrada → +abs,
 *      saída → −abs. As transferências entre DUAS contas (com conta de destino)
 *      são normalizadas para magnitude positiva — o saldo de origem/destino é
 *      calculado pelas duas pernas em `account-balances.ts`.
 *   3. Recalcula os saldos das contas afectadas.
 *
 * Nunca APAGA transações — só muda tipo/sinal/categoria. Devolve um resumo
 * `{ reclassified, resigned, message }`.
 */
export async function POST() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: txs, error: txErr } = await supabase
      .schema("money_schema")
      .from("transactions")
      .select("id, description, type, amount, category_id, account_id, transfer_to_account_id")
      .eq("user_id", user.id);
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    const transactions = (txs || []) as {
      id: string;
      description: string | null;
      type: "income" | "expense" | "transfer";
      amount: number;
      category_id: string | null;
      account_id: string | null;
      transfer_to_account_id: string | null;
    }[];

    // Resolve (ou cria) a categoria "Transferência" — para etiquetar as receitas
    // reclassificadas. As categorias só têm tipo income/expense; usamos expense
    // (os relatórios excluem transferências, por isso a etiqueta é só cosmética).
    let transferCategoryId: string | null = null;
    const ensureTransferCategory = async (): Promise<string | null> => {
      if (transferCategoryId) return transferCategoryId;
      const { data: existing } = await supabase
        .schema("money_schema")
        .from("categories")
        .select("id")
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .ilike("name", "Transferência")
        .limit(1);
      const found = (existing as { id: string }[] | null)?.[0]?.id;
      if (found) {
        transferCategoryId = found;
        return found;
      }
      const { data: created } = await supabase
        .schema("money_schema")
        .from("categories")
        .insert({ user_id: user.id, name: "Transferência", type: "expense", is_system: false })
        .select("id")
        .single();
      transferCategoryId = (created as { id: string } | null)?.id ?? null;
      return transferCategoryId;
    };

    let reclassified = 0;
    let resigned = 0;
    const touched = new Set<string>();

    for (const tx of transactions) {
      const update: { type?: string; amount?: number; category_id?: string } = {};

      // Transferências entre DUAS contas: garantimos magnitude positiva (a perna
      // de origem debita, a de destino credita — ver account-balances.ts). Não
      // mexemos no tipo nem re-assinamos pela descrição.
      if (tx.type === "transfer" && tx.transfer_to_account_id) {
        const positive = Math.abs(Number(tx.amount) || 0);
        if (positive !== tx.amount) {
          update.amount = positive;
          resigned++;
        }
      } else {
        const decision = decideTransferFix({
          description: tx.description,
          type: tx.type,
          amount: tx.amount,
        });

        if (decision.reclassified) {
          update.type = "transfer";
          const catId = await ensureTransferCategory();
          if (catId) update.category_id = catId;
          reclassified++;
        }
        if (decision.newAmount !== tx.amount) {
          update.amount = decision.newAmount;
        }
        if (decision.resigned && !decision.reclassified) {
          resigned++;
        }
      }

      if (Object.keys(update).length === 0) continue;

      const { error: updErr } = await supabase
        .schema("money_schema")
        .from("transactions")
        .update(update)
        .eq("id", tx.id)
        .eq("user_id", user.id);
      if (updErr) {
        return NextResponse.json(
          { error: `Falha a corrigir uma transferência: ${updErr.message}` },
          { status: 500 }
        );
      }
      if (tx.account_id) touched.add(tx.account_id);
      if (tx.transfer_to_account_id) touched.add(tx.transfer_to_account_id);
    }

    // Recalcula os saldos das contas afectadas.
    if (touched.size > 0) {
      await persistAccountBalances(supabase, user.id, touched);
    }

    const message =
      reclassified === 0 && resigned === 0
        ? "As transferências já estavam correctas — nada a mudar."
        : `Corrigidas ${reclassified} transferência(s) recebida(s) mal classificada(s) e re-assinadas ${resigned}. Os saldos foram recalculados.`;

    return NextResponse.json({ success: true, reclassified, resigned, message });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
