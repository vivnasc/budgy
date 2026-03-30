import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";

/**
 * GET /api/budgets
 * List user budgets with category info.
 */
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .schema("money_schema")
      .from("budgets")
      .select("*, categories(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ budgets: data });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

/**
 * POST /api/budgets
 * Create a new budget.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { category_id, amount, period, start_date, end_date, rollover_enabled } = body;

    if (!amount || !start_date) {
      return NextResponse.json({ error: "Montante e data de início são obrigatórios" }, { status: 400 });
    }

    const { data, error } = await supabase
      .schema("money_schema")
      .from("budgets")
      .insert({
        user_id: user.id,
        category_id: category_id || null,
        amount,
        period: period || "monthly",
        start_date,
        end_date: end_date || null,
        rollover_enabled: rollover_enabled || false,
      })
      .select("*, categories(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, budget: data });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
