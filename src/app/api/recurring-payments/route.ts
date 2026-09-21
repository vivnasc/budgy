import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";

/** Deteta o erro típico de "tabela ainda não existe" (migração por aplicar). */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    /relation .*recurring_payments.* does not exist/i.test(error.message ?? "") ||
    /could not find the table/i.test(error.message ?? "")
  );
}

/**
 * GET /api/recurring-payments
 * Lista os pagamentos recorrentes (folha salarial) da utilizadora.
 */
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data, error } = await supabase
      .schema("money_schema")
      .from("recurring_payments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ payments: [], needsSetup: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ payments: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

/**
 * POST /api/recurring-payments
 * Cria um trabalhador/pagamento recorrente.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await request.json();
    const { name, amount, account_id, category_name, note } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const { data, error } = await supabase
      .schema("money_schema")
      .from("recurring_payments")
      .insert({
        user_id: user.id,
        name: name.trim(),
        amount: numAmount,
        account_id: account_id || null,
        category_name: category_name || "Salários",
        note: note || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ needsSetup: true }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, payment: data });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
