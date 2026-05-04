import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";

/**
 * GET /api/transactions
 *
 * List transactions with filtering and pagination.
 * Query params: type, status, from, to, category, account, limit, offset
 */
export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const category = searchParams.get("category");
    const account = searchParams.get("account");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .schema("money_schema")
      .from("transactions")
      .select("*, categories(*), accounts!transactions_account_id_fkey(*)")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
    if (category) query = query.eq("category_id", category);
    if (account) query = query.eq("account_id", account);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transactions: data, total: count });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions
 *
 * Create one or more transactions.
 * Body: { transaction: {...} } or { transactions: [{...}] } for bulk.
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

    const body = await request.json();

    // Bulk insert with duplicate detection
    if (body.transactions && Array.isArray(body.transactions)) {
      const transactions = body.transactions.map(
        (tx: Record<string, unknown>) => ({
          ...tx,
          user_id: user.id,
        })
      );

      // Fetch existing transactions for this user to detect duplicates
      const { data: existing } = await supabase
        .schema("money_schema")
        .from("transactions")
        .select("date, amount, description, type")
        .eq("user_id", user.id);

      const existingKeys = new Set(
        (existing || []).map((tx: { date?: string; amount?: number; description?: string; type?: string }) =>
          `${tx.date}|${tx.amount}|${(tx.description || "").toLowerCase().trim()}|${tx.type}`
        )
      );

      const unique = transactions.filter((tx: { date?: unknown; amount?: unknown; description?: unknown; type?: unknown }) => {
        const key = `${tx.date}|${tx.amount}|${(String(tx.description || "")).toLowerCase().trim()}|${tx.type}`;
        return !existingKeys.has(key);
      });

      const duplicates = transactions.length - unique.length;

      if (unique.length === 0) {
        return NextResponse.json({
          success: true,
          count: 0,
          duplicates,
          transactions: [],
          message: `${duplicates} transações já existem. Nada importado.`,
        });
      }

      const { data, error } = await supabase
        .schema("money_schema")
        .from("transactions")
        .insert(unique)
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        count: data?.length || 0,
        duplicates,
        transactions: data,
        message: duplicates > 0
          ? `${data?.length} importadas, ${duplicates} duplicadas ignoradas.`
          : undefined,
      });
    }

    // Single insert
    if (body.transaction) {
      const transaction = {
        ...body.transaction,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .schema("money_schema")
        .from("transactions")
        .insert(transaction)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, transaction: data });
    }

    return NextResponse.json(
      { error: "Body deve conter 'transaction' ou 'transactions'" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
