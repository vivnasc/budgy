import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/auth/server";
import { parseMobillsCSV, getCategoryConsolidationPreview } from "@/lib/mobills-import";
import {
  parseBankStatement,
  parseExcelFile,
  detectBankFormat,
  type BankFormat,
} from "@/lib/bank-statement-parser";

/**
 * POST /api/import
 *
 * Parse a bank statement file and return structured data
 * with category mapping preview. Does NOT save to database yet.
 *
 * Body: { csvContent?: string, format?: BankFormat, filename?: string }
 * Or: FormData with file + format
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

    const contentType = request.headers.get("content-type") ?? "";

    // Handle FormData (file upload including Excel)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const format = (formData.get("format") as BankFormat) || "auto";

      if (!file) {
        return NextResponse.json(
          { error: "Ficheiro é obrigatório" },
          { status: 400 }
        );
      }

      const filename = file.name.toLowerCase();

      // Excel files
      if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const result = await parseExcelFile(buffer, format === "auto" ? detectExcelFormat(file.name) : format);

        if (!result.success) {
          return NextResponse.json(
            { error: result.errors[0] || "Erro ao processar ficheiro Excel", ...result },
            { status: 200 }
          );
        }

        const consolidation = getCategoryConsolidationPreview(result);
        return NextResponse.json({ ...result, categoryConsolidation: consolidation });
      }

      // CSV files
      const csvContent = await file.text();
      return parseAndRespond(csvContent, format, file.name);
    }

    // Handle JSON body (legacy CSV content)
    const body = await request.json();
    const { csvContent, format, filename } = body;

    if (!csvContent || typeof csvContent !== "string") {
      return NextResponse.json(
        { error: "Conteúdo CSV é obrigatório" },
        { status: 400 }
      );
    }

    return parseAndRespond(csvContent, format || "auto", filename);
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

function parseAndRespond(csvContent: string, format: BankFormat, filename?: string) {
  const detectedFormat = format === "auto" ? detectBankFormat(csvContent, filename) : format;

  let result;
  if (detectedFormat === "mobills") {
    result = parseMobillsCSV(csvContent);
  } else {
    result = parseBankStatement(csvContent, detectedFormat, filename);
  }

  if (!result.success) {
    return NextResponse.json(
      { error: result.errors[0] || "Erro ao processar ficheiro", ...result },
      { status: 200 }
    );
  }

  const consolidation = getCategoryConsolidationPreview(result);
  return NextResponse.json({
    ...result,
    detectedFormat,
    categoryConsolidation: consolidation,
  });
}

function detectExcelFormat(filename: string): BankFormat {
  const lower = filename.toLowerCase();
  if (lower.includes("mobills")) return "mobills";
  if (lower.includes("standard")) return "standard-bank";
  return "mobills"; // default for Excel
}
