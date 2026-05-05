import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { autoCategorize } from "@/lib/auto-categorize";

/**
 * POST /api/transactions/recategorize
 *
 * Re-runs the auto-categorize engine on every transaction belonging to the
 * authenticated user. Categories are created on demand (per user) when they
 * don't yet exist. Useful after import bugs that left transactions with no
 * category, or after improvements to the categorization rules.
 *
 * Returns: { success: true, updated: <count>, total: <count> }
 */
export async function POST() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: txs, error: txErr } = await supabase
      .schema("money_schema")
      .from("transactions")
      .select("id, description, type, amount, category_id, categories(name)")
      .eq("user_id", user.id);
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    const transactions = (txs || []) as unknown as {
      id: string;
      description: string | null;
      type: "income" | "expense" | "transfer";
      amount: number;
      category_id: string | null;
      categories?: { name: string } | { name: string }[] | null;
    }[];

    const currentCategoryName = (
      cats: { name: string } | { name: string }[] | null | undefined
    ): string | undefined => {
      if (!cats) return undefined;
      if (Array.isArray(cats)) return cats[0]?.name;
      return cats.name;
    };

    // Load categories accessible to this user (system + own)
    const { data: existingCats } = await supabase
      .schema("money_schema")
      .from("categories")
      .select("id, name, type, user_id")
      .or(`user_id.is.null,user_id.eq.${user.id}`);

    const categoryByName = new Map<string, string>();
    for (const c of (existingCats || []) as { id: string; name: string }[]) {
      categoryByName.set(c.name.toLowerCase(), c.id);
    }

    const ensureCategory = async (name: string, type: "income" | "expense"): Promise<string | undefined> => {
      const key = name.toLowerCase();
      if (categoryByName.has(key)) return categoryByName.get(key);
      const { data: created } = await supabase
        .schema("money_schema")
        .from("categories")
        .insert({ user_id: user.id, name, type, is_system: false })
        .select("id")
        .single();
      const id = (created as { id: string } | null)?.id;
      if (id) categoryByName.set(key, id);
      return id;
    };

    let updated = 0;
    for (const tx of transactions) {
      // Skip transfers — they don't need categories
      if (tx.type === "transfer") continue;

      // Skip if description is empty (nothing to match against)
      const desc = (tx.description || "").trim();
      if (!desc) continue;

      const result = autoCategorize(desc, tx.type, Number(tx.amount));
      // Only update if we got a confident match AND it differs from current
      if (!result.category || result.category === currentCategoryName(tx.categories)) continue;
      if (result.confidence < 0.5) continue;

      const catType = tx.type === "income" ? "income" : "expense";
      const categoryId = await ensureCategory(result.category, catType);
      if (!categoryId) continue;

      const { error: updErr } = await supabase
        .schema("money_schema")
        .from("transactions")
        .update({ category_id: categoryId })
        .eq("id", tx.id)
        .eq("user_id", user.id);
      if (!updErr) updated++;
    }

    return NextResponse.json({ success: true, updated, total: transactions.length });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
