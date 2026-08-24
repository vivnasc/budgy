import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";

/**
 * DELETE /api/accounts/[id]
 *
 * Apaga uma conta e TODAS as transações ligadas a ela (como origem ou como
 * destino de transferência). Usado para limpar contas duplicadas criadas por
 * engano (ex: "Mozabanco" quando já existe "Moza Banco").
 *
 * Devolve quantas transações foram removidas, para a app poder confirmar.
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

    // Confirma que a conta pertence ao utilizador.
    const { data: account } = await supabase
      .schema("money_schema")
      .from("accounts")
      .select("id, name")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    // Conta as transações que vão ser removidas (origem ou destino).
    const { count } = await supabase
      .schema("money_schema")
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .or(`account_id.eq.${id},transfer_to_account_id.eq.${id}`);

    // Remove as transações desta conta (origem OU destino de transferência).
    const { error: txErr } = await supabase
      .schema("money_schema")
      .from("transactions")
      .delete()
      .eq("user_id", user.id)
      .or(`account_id.eq.${id},transfer_to_account_id.eq.${id}`);
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    // Remove a conta.
    const { error: accErr } = await supabase
      .schema("money_schema")
      .from("accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      deletedAccount: account.name,
      deletedTransactions: count ?? 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno do servidor";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
