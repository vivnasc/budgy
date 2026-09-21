import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";

/**
 * PATCH /api/recurring-payments/[id]
 * Edita um trabalhador (nome, valor, conta, categoria, activo).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (body.amount !== undefined) {
      const n = Number(body.amount);
      if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
      updates.amount = n;
    }
    if ("account_id" in body) updates.account_id = body.account_id || null;
    if ("category_name" in body) updates.category_name = body.category_name || "Salários";
    if ("note" in body) updates.note = body.note || null;
    if ("is_active" in body) updates.is_active = !!body.is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .schema("money_schema")
      .from("recurring_payments")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, payment: data });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

/**
 * DELETE /api/recurring-payments/[id]
 * Remove um trabalhador da folha (não apaga os pagamentos já feitos).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { error } = await supabase
      .schema("money_schema")
      .from("recurring_payments")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
