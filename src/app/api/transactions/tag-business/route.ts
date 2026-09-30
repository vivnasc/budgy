import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { isBusinessTagged, withBusinessTag } from "@/lib/business";

/**
 * POST /api/transactions/tag-business
 *
 * Marca (ou desmarca) como "negócio" um conjunto de transações que a
 * UTILIZADORA escolheu — nada é adivinhado. Recebe os ids e se é para ligar ou
 * desligar a etiqueta. Só mexe na etiqueta, não muda mais nada.
 *
 * Body: { ids: string[], on: boolean }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
    const on = body?.on !== false; // por omissão liga
    if (ids.length === 0) return NextResponse.json({ error: "Sem transações selecionadas" }, { status: 400 });

    // Lê as tags actuais das transações escolhidas (para preservar as outras).
    const rows: { id: string; tags: string[] | null }[] = [];
    const READ = 300;
    for (let i = 0; i < ids.length; i += READ) {
      const chunk = ids.slice(i, i + READ);
      const { data, error } = await supabase
        .schema("money_schema")
        .from("transactions")
        .select("id, tags")
        .eq("user_id", user.id)
        .in("id", chunk);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      rows.push(...((data || []) as { id: string; tags: string[] | null }[]));
    }

    // Actualiza só as que precisam mudar.
    let changed = 0;
    for (const r of rows) {
      const already = isBusinessTagged(r.tags);
      if (already === on) continue;
      const { error } = await supabase
        .schema("money_schema")
        .from("transactions")
        .update({ tags: withBusinessTag(r.tags, on) })
        .eq("id", r.id)
        .eq("user_id", user.id);
      if (!error) changed++;
    }

    return NextResponse.json({ success: true, changed });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
