import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import {
  matchTransferCounterparts,
  MATCH_DATE_WINDOW_DAYS,
  type TransferCandidate,
  type ExistingTransfer,
} from "@/lib/match-transfers";

/**
 * POST /api/transactions/match-transfers
 *
 * Reconhece contrapartidas de transferências entre importações. Recebe os
 * candidatos ainda por guardar (do preview de importação / SMS) e devolve os
 * que correspondem a uma transferência JÁ GUARDADA do outro lado (ex: a saída
 * no CPC já guardada é a contrapartida da entrada no Moza a ser importada).
 *
 * Isto é apenas reconhecimento/etiquetagem — NÃO cria transações, NÃO altera
 * saldos e NÃO define transfer_to_account_id. Ambas as pernas continuam
 * independentes (cada conta precisa do seu lado para o seu saldo).
 *
 * Body: { candidates: Array<{ tempId, date, amount, type }> }
 * Resposta: { matched: Array<{ tempId, account, date }> }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawCandidates = Array.isArray(body?.candidates) ? body.candidates : [];

    const candidates: TransferCandidate[] = rawCandidates
      .filter(
        (c: unknown): c is TransferCandidate =>
          !!c &&
          typeof c === "object" &&
          typeof (c as TransferCandidate).tempId === "string" &&
          typeof (c as TransferCandidate).date === "string" &&
          typeof (c as TransferCandidate).amount === "number"
      )
      .map((c: TransferCandidate) => ({
        tempId: c.tempId,
        date: c.date,
        amount: c.amount,
        type: c.type,
      }));

    const transferCandidates = candidates.filter((c) => c.type === "transfer");
    if (transferCandidates.length === 0) {
      return NextResponse.json({ matched: [] });
    }

    // Janela de datas para a query (min/max das datas dos candidatos ±window),
    // para não trazer todo o histórico à memória.
    const dates = transferCandidates
      .map((c) => c.date)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    let query = supabase
      .schema("money_schema")
      .from("transactions")
      .select("id, date, amount, accounts!transactions_account_id_fkey(name)")
      .eq("user_id", user.id)
      .eq("type", "transfer")
      .not("account_id", "is", null);

    if (dates.length > 0) {
      const min = shiftDate(dates[0]!, -MATCH_DATE_WINDOW_DAYS);
      const max = shiftDate(dates[dates.length - 1]!, MATCH_DATE_WINDOW_DAYS);
      query = query.gte("date", min).lte("date", max);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const existing: ExistingTransfer[] = ((data ?? []) as RawExistingRow[]).map((row) => ({
      id: String(row.id),
      date: String(row.date),
      amount: Number(row.amount) || 0,
      account: extractAccountName(row.accounts),
    }));

    const matched = matchTransferCounterparts(transferCandidates, existing);

    return NextResponse.json({ matched });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno do servidor";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface RawExistingRow {
  id: string | number;
  date: string;
  amount: number;
  // O join pode vir como objecto (many-to-one) ou array conforme o cliente.
  accounts: { name: string | null } | { name: string | null }[] | null;
}

function extractAccountName(
  accounts: RawExistingRow["accounts"]
): string | null {
  if (!accounts) return null;
  if (Array.isArray(accounts)) return accounts[0]?.name ?? null;
  return accounts.name ?? null;
}

/** Desloca uma data ISO (YYYY-MM-DD) por `days` dias, devolvendo ISO. */
function shiftDate(iso: string, days: number): string {
  const t = Date.parse(iso + "T00:00:00Z");
  if (Number.isNaN(t)) return iso;
  return new Date(t + days * 86_400_000).toISOString().split("T")[0]!;
}
