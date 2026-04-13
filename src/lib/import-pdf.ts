/**
 * Import PDF Report Generator
 *
 * Generates a printable HTML report from import results using a hidden iframe
 * and the browser's built-in window.print() functionality.
 * No external PDF library needed.
 */

import type { ImportResult } from "./mobills-import";

// ─── Number Formatting ─────────────────────────────────────────────────────

function formatMZN(value: number): string {
  return value.toLocaleString("pt-MZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Category Breakdown ─────────────────────────────────────────────────────

interface CategoryBreakdown {
  category: string;
  subcategory: string;
  count: number;
  totalAmount: number;
}

function buildCategoryBreakdown(result: ImportResult): CategoryBreakdown[] {
  const map = new Map<string, CategoryBreakdown>();

  for (const tx of result.imported) {
    const cat = tx.mappedCategory || "Sem categoria";
    const sub = tx.mappedSubcategory || "—";
    const key = `${cat}||${sub}`;

    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalAmount += Math.abs(tx.amount);
    } else {
      map.set(key, {
        category: cat,
        subcategory: sub,
        count: 1,
        totalAmount: Math.abs(tx.amount),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

// ─── Accounts Summary ───────────────────────────────────────────────────────

interface AccountSummary {
  account: string;
  transactionCount: number;
  totalIncome: number;
  totalExpenses: number;
}

function buildAccountsSummary(result: ImportResult): AccountSummary[] {
  const map = new Map<string, AccountSummary>();

  for (const tx of result.imported) {
    const acc = tx.account || "Sem conta";
    const existing = map.get(acc);
    if (existing) {
      existing.transactionCount += 1;
      if (tx.type === "income") {
        existing.totalIncome += Math.abs(tx.amount);
      } else if (tx.type === "expense") {
        existing.totalExpenses += Math.abs(tx.amount);
      }
    } else {
      map.set(acc, {
        account: acc,
        transactionCount: 1,
        totalIncome: tx.type === "income" ? Math.abs(tx.amount) : 0,
        totalExpenses: tx.type === "expense" ? Math.abs(tx.amount) : 0,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.transactionCount - a.transactionCount
  );
}

// ─── HTML Generation ────────────────────────────────────────────────────────

function buildReportHTML(result: ImportResult): string {
  const now = new Date();
  const importDate = now.toLocaleDateString("pt-MZ", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const periodFrom = result.dateRange?.from ?? "—";
  const periodTo = result.dateRange?.to ?? "—";

  const categoryBreakdown = buildCategoryBreakdown(result);
  const top10Categories = categoryBreakdown.slice(0, 10);
  const accountsSummary = buildAccountsSummary(result);

  const categoryRows = categoryBreakdown
    .map(
      (row) => `
      <tr>
        <td>${escapeHTML(row.category)}</td>
        <td>${escapeHTML(row.subcategory)}</td>
        <td style="text-align:center">${row.count}</td>
        <td style="text-align:right">${formatMZN(row.totalAmount)} MZN</td>
      </tr>`
    )
    .join("");

  const top10Rows = top10Categories
    .map(
      (row, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${escapeHTML(row.category)}</td>
        <td style="text-align:center">${row.count}</td>
        <td style="text-align:right">${formatMZN(row.totalAmount)} MZN</td>
      </tr>`
    )
    .join("");

  const accountRows = accountsSummary
    .map(
      (row) => `
      <tr>
        <td>${escapeHTML(row.account)}</td>
        <td style="text-align:center">${row.transactionCount}</td>
        <td style="text-align:right;color:#059669">+${formatMZN(row.totalIncome)} MZN</td>
        <td style="text-align:right;color:#dc2626">-${formatMZN(row.totalExpenses)} MZN</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>BUDGY — Relatório de Importação</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937;
      font-size: 12px;
      line-height: 1.5;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      font-size: 20px;
      color: #059669;
      margin-bottom: 4px;
    }
    h2 {
      font-size: 14px;
      color: #374151;
      margin: 20px 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 2px solid #d1fae5;
    }
    .subtitle {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 16px;
    }
    .header-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .summary-box {
      text-align: center;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .summary-box .value {
      font-size: 18px;
      font-weight: 700;
    }
    .summary-box .label {
      font-size: 10px;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 0.05em;
      margin-top: 2px;
    }
    .income { background: #ecfdf5; }
    .income .value { color: #059669; }
    .expense { background: #fef2f2; }
    .expense .value { color: #dc2626; }
    .transfer { background: #eff6ff; }
    .transfer .value { color: #2563eb; }
    .neutral { background: #f9fafb; }
    .neutral .value { color: #1f2937; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 11px;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
      text-align: left;
      padding: 8px 10px;
      border-bottom: 2px solid #e5e7eb;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
    }
    td {
      padding: 6px 10px;
      border-bottom: 1px solid #f3f4f6;
    }
    tr:nth-child(even) { background: #fafafa; }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #9ca3af;
      text-align: center;
    }
    .period {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 12px;
    }
    @media print {
      body { padding: 12px; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header-line">
    <div>
      <h1>BUDGY — Relatório de Importação</h1>
      <div class="subtitle">Gerado em ${escapeHTML(importDate)}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;color:#6b7280">Período</div>
      <div style="font-size:12px;font-weight:600">${escapeHTML(periodFrom)} a ${escapeHTML(periodTo)}</div>
    </div>
  </div>

  <h2>Resumo Geral</h2>
  <div class="summary-grid">
    <div class="summary-box neutral">
      <div class="value">${result.imported.length}</div>
      <div class="label">Transações</div>
    </div>
    <div class="summary-box neutral">
      <div class="value">${result.accountsFound.length}</div>
      <div class="label">Contas</div>
    </div>
    <div class="summary-box neutral">
      <div class="value">${Object.keys(result.summary.categoryCounts).length}</div>
      <div class="label">Categorias</div>
    </div>
  </div>
  <div class="summary-grid">
    <div class="summary-box income">
      <div class="value">+${formatMZN(result.summary.totalIncome)}</div>
      <div class="label">Rendimentos (MZN)</div>
    </div>
    <div class="summary-box expense">
      <div class="value">-${formatMZN(result.summary.totalExpenses)}</div>
      <div class="label">Despesas (MZN)</div>
    </div>
    <div class="summary-box transfer">
      <div class="value">${formatMZN(result.summary.totalTransfers)}</div>
      <div class="label">Transferências (MZN)</div>
    </div>
  </div>

  <h2>Top 10 Categorias por Valor</h2>
  <table>
    <thead>
      <tr>
        <th style="text-align:center">#</th>
        <th>Categoria</th>
        <th style="text-align:center">Transações</th>
        <th style="text-align:right">Total (MZN)</th>
      </tr>
    </thead>
    <tbody>
      ${top10Rows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">Sem dados</td></tr>'}
    </tbody>
  </table>

  <h2>Detalhe por Categoria e Subcategoria</h2>
  <table>
    <thead>
      <tr>
        <th>Categoria</th>
        <th>Subcategoria</th>
        <th style="text-align:center">Transações</th>
        <th style="text-align:right">Total (MZN)</th>
      </tr>
    </thead>
    <tbody>
      ${categoryRows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">Sem dados</td></tr>'}
    </tbody>
  </table>

  <h2>Resumo por Conta</h2>
  <table>
    <thead>
      <tr>
        <th>Conta</th>
        <th style="text-align:center">Transações</th>
        <th style="text-align:right">Rendimentos</th>
        <th style="text-align:right">Despesas</th>
      </tr>
    </thead>
    <tbody>
      ${accountRows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">Sem dados</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    BUDGY — A tua app de finanças pessoais em Moçambique
  </div>
</body>
</html>`;
}

// ─── Escape HTML ────────────────────────────────────────────────────────────

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generates a printable PDF report from import results.
 * Opens a hidden iframe with formatted HTML and triggers window.print().
 */
export function generateImportPDF(result: ImportResult): void {
  const html = buildReportHTML(result);

  // Create a hidden iframe to render the report
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  iframe.style.width = "800px";
  iframe.style.height = "600px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for content to render, then print
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch {
      // Fallback: open in new window
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
    }

    // Clean up iframe after a delay to allow print dialog to finish
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 250);
}
