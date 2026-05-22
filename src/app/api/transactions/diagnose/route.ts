import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { autoCategorize } from "@/lib/auto-categorize";

/**
 * GET /api/transactions/diagnose
 *
 * Returns every transaction of the user grouped by current category, with
 * what autoCategorize WOULD return if re-run today. Lets us see exactly
 * which descriptions are falling through to "Outros" / "Compras" and why.
 *
 * Response shape:
 *   {
 *     totalTransactions: number,
 *     byCurrentCategory: { [name]: number },
 *     stillOutros: Array<{ description, type, amount, suggested, confidence }>,
 *     ruleHits: { [pattern]: number },  // how often each rule fired
 *   }
 */
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: txs, error } = await supabase
      .schema("money_schema")
      .from("transactions")
      .select("id, description, type, amount, status, categories(name)")
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const transactions = (txs || []) as unknown as Array<{
      id: string;
      description: string | null;
      type: "income" | "expense" | "transfer";
      amount: number;
      status?: string | null;
      categories?: { name: string } | { name: string }[] | null;
    }>;

    const currentCategory = (
      cats: { name: string } | { name: string }[] | null | undefined
    ): string => {
      if (!cats) return "(sem categoria)";
      if (Array.isArray(cats)) return cats[0]?.name ?? "(sem categoria)";
      return cats.name;
    };

    const byCurrentCategory: Record<string, number> = {};
    const stillProblematic: Array<{
      description: string;
      type: string;
      amount: number;
      currentCategory: string;
      suggestedCategory: string;
      confidence: number;
      reason: string;
    }> = [];

    for (const tx of transactions) {
      if (tx.type === "transfer") continue;
      const curName = currentCategory(tx.categories);
      byCurrentCategory[curName] = (byCurrentCategory[curName] ?? 0) + 1;

      const desc = (tx.description ?? "").trim();
      if (!desc) continue;
      const suggestion = autoCategorize(desc, tx.type, Number(tx.amount));

      const isProblematic =
        curName === "Outros" || curName === "(sem categoria)" || curName === "Compras";

      if (isProblematic && stillProblematic.length < 50) {
        stillProblematic.push({
          description: desc,
          type: tx.type,
          amount: Number(tx.amount),
          currentCategory: curName,
          suggestedCategory: suggestion.category,
          confidence: suggestion.confidence,
          reason: suggestion.reason,
        });
      }
    }

    return NextResponse.json({
      totalTransactions: transactions.length,
      byCurrentCategory,
      stillProblematic,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
