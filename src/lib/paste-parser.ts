/**
 * Colar transacções — leitor de texto colado do internet-banking.
 *
 * A Vivianne nem sempre consegue exportar CSV. Muitas vezes só tem um bloco de
 * texto copiado do ecrã do banco (CPC). Este leitor transforma esse texto em
 * transações, reutilizando a MESMA classificação (tipo/categoria) do leitor de
 * CSV do CPC — ver `classifyCpcRecord` em `bank-statement-parser.ts`.
 *
 * Formato suportado (CPC internet-banking):
 *   - Cada registo começa com uma data `DD MON YYYY` (mês em 3 letras maiúsculas).
 *   - Os campos vêm separados por TAB ou vários espaços.
 *   - A descrição pode ocupar VÁRIAS linhas físicas (dá a volta / "wrap").
 *   - Existe uma referência tipo `FT2623333454`.
 *   - O valor aparece como `-3,220.38` (vírgula = milhares, ponto = decimais),
 *     normalmente seguido de `MZN`.
 *
 * É uma função PURA — sem dependências de browser — para poder ser testada com
 * `npx tsx src/lib/paste-parser.test.ts`.
 */

import { classifyCpcRecord } from "./bank-statement-parser";

export interface ParsedPastedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  category: string;
}

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/** Uma linha que ARRANCA um registo começa com `DD MON YYYY`. */
const DATE_START = /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\b/;

/** Um valor monetário: opcional sinal, milhares com vírgula, 2 casas decimais. */
const AMOUNT = /-?\d[\d,]*\.\d{2}/;
const AMOUNT_GLOBAL = /-?\d[\d,]*\.\d{2}/g;

function toISODate(day: string, mon: string, year: string): string | null {
  const month = MONTHS[mon.toUpperCase()];
  if (month === undefined) return null;
  const d = day.padStart(2, "0");
  return `${year}-${String(month + 1).padStart(2, "0")}-${d}`;
}

/**
 * Parte o texto colado em registos. Um registo arranca numa linha que começa
 * com data e acumula linhas seguintes (descrição que dá a volta) até encontrar
 * um valor OU até arrancar o próximo registo com nova data.
 */
function splitIntoRecords(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const records: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length > 0) {
      records.push(current.join(" "));
      current = [];
    }
  };

  for (const line of lines) {
    if (DATE_START.test(line)) {
      // Nova data → fecha o registo anterior (rede de segurança) e arranca outro.
      flush();
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    } else {
      // Lixo antes do primeiro registo — ignora.
      continue;
    }
    // Se o registo acumulado já tem um valor, está completo.
    if (current.length > 0 && AMOUNT.test(current.join(" "))) {
      flush();
    }
  }
  flush();

  return records;
}

function parseRecord(record: string): ParsedPastedTransaction | null {
  // Normaliza espaços (tabs e espaços múltiplos → um espaço).
  const text = record.replace(/\t/g, " ").replace(/\s+/g, " ").trim();

  // Data (a primeira `DD MON YYYY`).
  const dateMatch = text.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!dateMatch) return null;
  const iso = toISODate(dateMatch[1]!, dateMatch[2]!, dateMatch[3]!);
  if (!iso) return null;

  // Valor: o ÚLTIMO valor monetário do registo (o saldo, quando aparece, vem
  // depois — mas neste formato o valor do movimento é o último antes de "MZN").
  let last: { value: string; index: number } | null = null;
  let m: RegExpExecArray | null;
  AMOUNT_GLOBAL.lastIndex = 0;
  while ((m = AMOUNT_GLOBAL.exec(text)) !== null) {
    last = { value: m[0], index: m.index };
  }
  if (!last) return null;

  const signed = parseFloat(last.value.replace(/,/g, ""));
  if (!isFinite(signed) || signed === 0) return null;
  const magnitude = Math.abs(signed);

  // Descrição = tudo entre a referência e o valor, sem as datas nem o FT.
  let desc = text.slice(0, last.index).trim();
  desc = desc.replace(/^(?:\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s*){1,2}/, "").trim(); // data(s)
  desc = desc.replace(/^(?:FT|TR|DO|MC)\w+\s*/i, "").trim(); // referência
  desc = desc.replace(/\bMZN\b\s*$/i, "").trim(); // moeda residual

  const { displayDescription, type, category } = classifyCpcRecord(
    desc,
    magnitude,
    signed > 0
  );

  // Transferências para contas PRÓPRIAS ("MINHA CONTA ...") — no texto colado a
  // referência do beneficiário vem a seguir a "Enviada", pelo que a regra base
  // as deixaria como saída. Aqui reconhecemo-las como transferência.
  let finalType = type;
  let finalCategory = category;
  if (/MINHA CONTA/i.test(desc) && /(?:Transf|METIX|Interb|Intrab|Conta a Conta)/i.test(desc)) {
    finalType = "transfer";
    finalCategory = "Transferência";
  }

  return {
    date: iso,
    description: displayDescription || desc,
    amount: magnitude,
    type: finalType,
    category: finalCategory,
  };
}

/**
 * Lê um bloco de texto colado do banco e devolve as transações reconhecidas.
 * Tolera espaços/tabs baralhados, falta de "MZN" e separadores de milhares.
 */
export function parsePastedTransactions(text: string): ParsedPastedTransaction[] {
  if (!text || !text.trim()) return [];
  const records = splitIntoRecords(text);
  const out: ParsedPastedTransaction[] = [];
  for (const record of records) {
    const parsed = parseRecord(record);
    if (parsed) out.push(parsed);
  }
  return out;
}
