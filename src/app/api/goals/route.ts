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

/**
 * PATCH /api/goals
 * Update a savings goal — used to set the value already reserved
 * (current_amount) or edit name / target / deadline. Marks the goal completed
 * automatically once the reserved value reaches the target.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, target_amount, current_amount, deadline, is_completed } = body;

    if (!id) {
      return NextResponse.json({ error: "id da meta é obrigatório" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (target_amount !== undefined) updates.target_amount = target_amount;
    if (current_amount !== undefined) updates.current_amount = current_amount;
    if (deadline !== undefined) updates.deadline = deadline || null;
    if (is_completed !== undefined) updates.is_completed = is_completed;

    // Auto-conclui quando o reservado atinge o alvo (a não ser que o cliente
    // já tenha dito explicitamente o contrário).
    if (
      is_completed === undefined &&
      current_amount !== undefined &&
      target_amount !== undefined &&
      Number(current_amount) >= Number(target_amount) &&
      Number(target_amount) > 0
    ) {
      updates.is_completed = true;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .schema("money_schema")
      .from("goals")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
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
