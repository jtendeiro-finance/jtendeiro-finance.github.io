import type { Transaction } from '../../types/models';
import { parsePtAmountToCents } from '../money';
import { parsePtDate } from '../dates';
import { autoCategorize, normalizeText } from '../categories/autoCategorize';

export interface ColumnMapping {
  dateCol: number;
  descriptionCol: number;
  /** Coluna única de montante com sinal… */
  amountCol: number | null;
  /** …ou par débito/crédito (comum em extratos PT). */
  debitCol: number | null;
  creditCol: number | null;
}

export interface RowError {
  rowIndex: number;
  reason: string;
}

const DATE_RE = /\bdata\b|valuta|^date$/;
const DESC_RE = /descri|movimento|designa|detalhe|historico|histórico|descricao/;
const AMOUNT_RE = /montante|valor|import[aâ]n|quantia|^amount$/;
const DEBIT_RE = /d[eé]bito|^debit/;
const CREDIT_RE = /cr[eé]dito|^credit/;

export function guessMapping(headers: string[], sampleRows: string[][]): ColumnMapping {
  const norm = headers.map((h) => normalizeText(h));
  const find = (re: RegExp) => norm.findIndex((h) => re.test(h));

  let dateCol = find(DATE_RE);
  let descriptionCol = find(DESC_RE);
  const debitCol = find(DEBIT_RE);
  const creditCol = find(CREDIT_RE);
  let amountCol = debitCol >= 0 && creditCol >= 0 ? -1 : find(AMOUNT_RE);

  // Heurísticas por conteúdo quando os cabeçalhos não ajudam.
  if (dateCol < 0) {
    dateCol = norm.findIndex((_, i) =>
      sampleRows.some((r) => parsePtDate(r[i] ?? '') !== null),
    );
  }
  if (amountCol < 0 && debitCol < 0) {
    amountCol = norm.findIndex(
      (_, i) =>
        i !== dateCol &&
        sampleRows.length > 0 &&
        sampleRows.every((r) => parsePtAmountToCents(r[i] ?? '') !== null),
    );
  }
  if (descriptionCol < 0) {
    descriptionCol = norm.findIndex((_, i) => i !== dateCol && i !== amountCol);
  }

  return {
    dateCol: Math.max(dateCol, 0),
    descriptionCol: Math.max(descriptionCol, 0),
    amountCol: amountCol >= 0 ? amountCol : null,
    debitCol: debitCol >= 0 ? debitCol : null,
    creditCol: creditCol >= 0 ? creditCol : null,
  };
}

export function applyMapping(
  rows: string[][],
  m: ColumnMapping,
): { ok: Omit<Transaction, 'id'>[]; errors: RowError[] } {
  const ok: Omit<Transaction, 'id'>[] = [];
  const errors: RowError[] = [];
  const importedAt = new Date().toISOString();

  rows.forEach((row, i) => {
    const date = parsePtDate(row[m.dateCol] ?? '');
    if (!date) {
      errors.push({ rowIndex: i, reason: `Data inválida: «${row[m.dateCol] ?? ''}»` });
      return;
    }
    const description = (row[m.descriptionCol] ?? '').trim() || '(sem descrição)';

    let amountCents: number | null = null;
    if (m.amountCol !== null) {
      amountCents = parsePtAmountToCents(row[m.amountCol] ?? '');
    } else if (m.debitCol !== null && m.creditCol !== null) {
      const debit = parsePtAmountToCents(row[m.debitCol] ?? '') ?? 0;
      const credit = parsePtAmountToCents(row[m.creditCol] ?? '') ?? 0;
      amountCents = Math.abs(credit) - Math.abs(debit);
    }
    if (amountCents === null) {
      errors.push({ rowIndex: i, reason: 'Montante inválido' });
      return;
    }

    ok.push({
      date,
      description,
      amountCents,
      categoryId: autoCategorize(description, amountCents),
      source: 'csv',
      importedAt,
    });
  });

  return { ok, errors };
}

/** Chave de duplicado: data+montante+descrição normalizada. */
export function dedupeKey(t: { date: string; amountCents: number; description: string }): string {
  return `${t.date}|${t.amountCents}|${normalizeText(t.description)}`;
}
