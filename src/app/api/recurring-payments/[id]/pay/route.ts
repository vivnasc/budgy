import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { persistAccountBalances } from "@/lib/account-balances";

/**
 * POST /api/recurring-payments/[id]/pay
 * Regista o pagamento deste ciclo: cria uma transação de despesa na conta do
 * trabalhador (por omissão a definida nele), com o nome dele na descrição e a
 * etiqueta `rp:<id>` para a app saber que já foi pago neste ciclo.
 *
 * Body opcional: { amount, date } para pagar um valor/data diferentes do padrão.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: rp, error: rpErr } = await supabase
      .schema("money_schema")
      .from("recurring_payments")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (rpErr || !rp) return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const amount = Number(body?.amount ?? rp.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    const today = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().split("T")[0]!;
    const date = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : today;

    // Resolve a categoria (por nome) para não poluir os gráficos com "Outros".
    let categoryId: string | null = null;
    const catName = rp.category_name || "Salários";
    const { data: cats } = await supabase
      .schema("money_schema")
      .from("categories")
      .select("id")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .eq("type", "expense")
      .ilike("name", catName);
    categoryId = (cats as { id: string }[] | null)?.[0]?.id ?? null;
    if (!categoryId) {
      const { data: created } = await supabase
        .schema("money_schema")
        .from("categories")
        .insert({ user_id: user.id, name: catName, type: "expense", icon: "users", color: "#6366F1", is_system: false })
        .select("id")
        .single();
      categoryId = (created as { id: string } | null)?.id ?? null;
    }

    const { data: tx, error: txErr } = await supabase
      .schema("money_schema")
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: rp.account_id,
        category_id: categoryId,
        type: "expense",
        amount,
        currency: "MZN",
        description: rp.name,
        date,
        status: "completed",
        tags: [`rp:${id}`, rp.name],
      })
      .select("id, account_id")
      .single();

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    if (tx?.account_id) {
      await persistAccountBalances(supabase, user.id, [tx.account_id]);
    }

    return NextResponse.json({ success: true, transactionId: tx?.id, amount, date });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
