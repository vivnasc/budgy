import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";

/**
 * GET /api/goals
 * List user savings goals.
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
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ goals: data });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

/**
 * POST /api/goals
 * Create a new savings goal.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, target_amount, currency, deadline, icon, color } = body;

    if (!name || !target_amount) {
      return NextResponse.json({ error: "Nome e valor alvo são obrigatórios" }, { status: 400 });
    }

    const { data, error } = await supabase
      .schema("money_schema")
      .from("goals")
      .insert({
        user_id: user.id,
        name,
        target_amount,
        currency: currency || "MZN",
        deadline: deadline || null,
        icon: icon || null,
        color: color || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, goal: data });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
