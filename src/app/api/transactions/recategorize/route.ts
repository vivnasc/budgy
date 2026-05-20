import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { autoCategorize } from "@/lib/auto-categorize";

/**
 * POST /api/transactions/recategorize
 *
 * Backfills the category_id of transactions that are uncategorised. The
 * resolution order for each transaction is:
 *
 *   1. autoCategorize() rules with confidence >= 0.5 → use that category
 *   2. autoCategorize() rules with confidence >= 0.3 AND the transaction
 *      currently has no category → use that category (better than null)
 *   3. Look at OTHER transactions of the same user with the same description:
 *      if any of them have a category set, use the most common one (this is
 *      how we "learn" from manual edits and from the import-time mapping)
 *
 * Categories are created on demand under the user's account when they don't
 * yet exist in the categories table. Returns { success, updated, total }.
 */
export async function POST() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: txs, error: txErr } = await supabase
      .schema("money_schema")
      .from("transactions")
      .select("id, description, type, amount, category_id, categories(id, name)")
      .eq("user_id", user.id);
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    const transactions = (txs || []) as unknown as {
      id: string;
      description: string | null;
      type: "income" | "expense" | "transfer";
      amount: number;
      category_id: string | null;
      categories?: { id: string; name: string } | { id: string; name: string }[] | null;
    }[];

    const currentCategory = (
      cats: { id: string; name: string } | { id: string; name: string }[] | null | undefined
    ): { id: string; name: string } | undefined => {
      if (!cats) return undefined;
      if (Array.isArray(cats)) return cats[0];
      return cats;
    };

    // Build a description → most common categoryId map from already-categorised
    // transactions (this is how we propagate manual edits to similar rows)
    const descToCategory = new Map<string, Map<string, number>>();
    for (const tx of transactions) {
      const cat = currentCategory(tx.categories);
      if (!cat || !tx.description) continue;
      const key = tx.description.toLowerCase().trim();
      if (!key) continue;
      let counts = descToCategory.get(key);
      if (!counts) {
        counts = new Map();
        descToCategory.set(key, counts);
      }
      counts.set(cat.id, (counts.get(cat.id) ?? 0) + 1);
    }
    const learnedCategoryFor = (description: string): string | undefined => {
      const key = description.toLowerCase().trim();
      const counts = descToCategory.get(key);
      if (!counts) return undefined;
      let bestId: string | undefined;
      let bestCount = 0;
      for (const [id, c] of counts) {
        if (c > bestCount) {
          bestCount = c;
          bestId = id;
        }
      }
      return bestId;
    };

    // Categories accessible to this user (system + own)
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
      // Transfers don't get categories
      if (tx.type === "transfer") continue;

      const desc = (tx.description || "").trim();
      if (!desc) continue;

      const current = currentCategory(tx.categories);
      const isUncategorised = !tx.category_id || (current && current.name === "Outros");

      const result = autoCategorize(desc, tx.type, Number(tx.amount));
      const catType: "income" | "expense" = tx.type === "income" ? "income" : "expense";

      let nextCategoryId: string | undefined;

      // Preserve manual edits. Only categorize if the row is currently
      // uncategorised (NULL or "Outros"). Any reasonable match (≥0.3)
      // is acceptable in that case — beats leaving it as "Outros".
      if (
        isUncategorised &&
        result.category &&
        result.category !== "Outros" &&
        result.category !== "Outro Rendimento" &&
        result.confidence >= 0.3
      ) {
        nextCategoryId = await ensureCategory(result.category, catType);
      }

      // Fall back to learning from siblings with the same description
      if (!nextCategoryId && isUncategorised) {
        const learned = learnedCategoryFor(desc);
        if (learned && learned !== current?.id) nextCategoryId = learned;
      }

      if (!nextCategoryId || nextCategoryId === current?.id) continue;

      const { error: updErr } = await supabase
        .schema("money_schema")
        .from("transactions")
        .update({ category_id: nextCategoryId })
        .eq("id", tx.id)
        .eq("user_id", user.id);
      if (!updErr) {
        updated++;
        // Update our in-memory description map so subsequent uncategorised
        // rows benefit immediately
        const key = desc.toLowerCase().trim();
        let counts = descToCategory.get(key);
        if (!counts) {
          counts = new Map();
          descToCategory.set(key, counts);
        }
        counts.set(nextCategoryId, (counts.get(nextCategoryId) ?? 0) + 1);
      }
    }

    return NextResponse.json({ success: true, updated, total: transactions.length });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

