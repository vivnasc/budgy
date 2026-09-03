/**
 * Browser-side PDF text extraction for M-Pesa statements.
 *
 * Runs pdfjs-dist in the browser to pull every positioned text fragment out of
 * the PDF, then hands them to the environment-agnostic `parseMpesaPdfItems`.
 * Kept in its own module (dynamically imported by the import page) so pdfjs is
 * only pulled into the bundle when the user actually drops a PDF.
 */

import { parseMpesaPdfItems, type MpesaTextItem } from "./mpesa-pdf";
import type { ImportResult } from "./mobills-import";

let workerConfigured = false;

/**
 * Extracts positioned text items from a PDF ArrayBuffer in the browser.
 * Configures the pdfjs worker from the bundled asset; if that fails we retry
 * once with the worker disabled (slower, but dependable in any bundler).
 */
async function extractItems(buffer: ArrayBuffer): Promise<MpesaTextItem[]> {
  const pdfjs = await import("pdfjs-dist");

  if (!workerConfigured) {
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    } catch {
      // Bundler could not resolve the worker URL — fall back to inline below.
    }
    workerConfigured = true;
  }

  const load = (opts: Record<string, unknown>) =>
    pdfjs.getDocument({ data: new Uint8Array(buffer), ...opts }).promise;

  let doc;
  try {
    doc = await load({});
  } catch {
    // Worker path problematic — run the parser on the main thread instead.
    doc = await load({ disableWorker: true });
  }

  const items: MpesaTextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!("str" in it)) continue;
      const t = it as { str: string; transform: number[] };
      items.push({
        str: t.str,
        x: t.transform[4] ?? 0,
        y: t.transform[5] ?? 0,
        page: p,
      });
    }
  }
  return items;
}

/**
 * Reads an M-Pesa PDF File in the browser and returns the shared ImportResult.
 * Throws with a clear Portuguese message when the PDF is not an M-Pesa extract.
 */
export async function parseMpesaPdfFile(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const items = await extractItems(buffer);
  return parseMpesaPdfItems(items);
}
