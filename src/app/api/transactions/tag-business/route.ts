import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { isLikelyBusiness, isBusinessTagged, withBusinessTag } from "@/lib/business";

/**
 * POST /api/transactions/tag-business
 *
 * Marca automaticamente com a etiqueta "negócio" as transações cujos
 * fornecedores são claramente do negócio (anúncios, ferramentas de IA,
 * infraestrutura...). Não apaga nem muda mais nada — só acrescenta a etiqueta.
 *
 * Body opcional { dryRun: true } → só conta, sem gravar.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;

    const PAGE = 1000;
    type Row = { id: string; description: string | null; notes: string | null; tags: string[] | null };
    const rows: Row[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase
        .schema("money_schema")
        .from("transactions")
        .select("id, description, notes, tags")
        .eq("user_id", user.id)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const batch = (data || []) as Row[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }

    const toTag = rows.filter(
      (r) =>
        !isBusinessTagged(r.tags) &&
        (isLikelyBusiness(r.description) || isLikelyBusiness(r.notes))
    );

    if (dryRun) return NextResponse.json({ success: true, matched: toTag.length, dryRun: true });
    if (toTag.length === 0) return NextResponse.json({ success: true, tagged: 0 });

    let tagged = 0;
    for (const r of toTag) {
      const { error } = await supabase
        .schema("money_schema")
        .from("transactions")
        .update({ tags: withBusinessTag(r.tags, true) })
        .eq("id", r.id)
        .eq("user_id", user.id);
      if (!error) tagged++;
    }

    return NextResponse.json({ success: true, tagged });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
