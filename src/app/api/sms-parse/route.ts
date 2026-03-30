import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { parseSMS, parseBulkSMS } from "@/lib/sms-parser";

/**
 * POST /api/sms-parse
 *
 * Parse SMS messages and return structured transaction data.
 * Does NOT save to database — returns parsed data for user validation.
 *
 * Body: { text: string, bulk?: boolean }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { text, bulk = false } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Texto SMS é obrigatório" },
        { status: 400 }
      );
    }

    if (bulk) {
      const results = parseBulkSMS(text);
      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      return NextResponse.json({
        total: results.length,
        parsed: successful.length,
        failed: failed.length,
        transactions: successful.map((r) => r.transaction),
        errors: failed.map((r) => r.error),
      });
    }

    const result = parseSMS(text);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, parsed: false },
        { status: 200 }
      );
    }

    return NextResponse.json({
      parsed: true,
      transaction: result.transaction,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
