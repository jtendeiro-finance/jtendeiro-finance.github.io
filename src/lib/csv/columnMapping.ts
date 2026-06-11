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

interface ColStats {
  nonBlank: number;
  blank: number;
  parsedAmount: number;
  hasDecimal: boolean;
  neg: number;
  pos: number;
  dates: number;
  distinct: number;
  avgLen: number;
}

function columnStats(sampleRows: string[][], i: number): ColStats {
  const values = sampleRows.map((r) => (r[i] ?? '').trim());
  const nonBlank = values.filter((v) => v !== '');
  const seen = new Set(nonBlank);
  let parsedAmount = 0;
  let hasDecimal = false;
  let neg = 0;
  let pos = 0;
  let dates = 0;
  let totalLen = 0;
  for (const v of nonBlank) {
    totalLen += v.length;
    if (parsePtDate(v) !== null) dates += 1;
    const cents = parsePtAmountToCents(v);
    if (cents !== null) {
      parsedAmount += 1;
      if (/[.,]\d{1,2}\s*€?$/.test(v)) hasDecimal = true;
      if (cents < 0) neg += 1;
      else if (cents > 0) pos += 1;
    }
  }
  return {
    nonBlank: nonBlank.length,
    blank: values.length - nonBlank.length,
    parsedAmount,
    hasDecimal,
    neg,
    pos,
    dates,
    distinct: seen.size,
    avgLen: nonBlank.length > 0 ? totalLen / nonBlank.length : 0,
  };
}

export function guessMapping(headers: string[], sampleRows: string[][]): ColumnMapping {
  const norm = headers.map((h) => normalizeText(h));
  const find = (re: RegExp) => norm.findIndex((h) => re.test(h));
  const nCols = Math.max(headers.length, ...sampleRows.map((r) => r.length));
  const stats = Array.from({ length: nCols }, (_, i) => columnStats(sampleRows, i));

  let dateCol = find(DATE_RE);
  let descriptionCol = find(DESC_RE);
  let debitCol = find(DEBIT_RE);
  let creditCol = find(CREDIT_RE);
  let amountCol = debitCol >= 0 && creditCol >= 0 ? -1 : find(AMOUNT_RE);

  // Heurísticas por conteúdo quando os cabeçalhos não ajudam (ou não existem).
  if (dateCol < 0) {
    dateCol = stats.findIndex((s) => s.nonBlank > 0 && s.dates === s.nonBlank);
  }

  // Colunas com aspeto de montante: todos os valores não vazios interpretáveis,
  // com casas decimais (exclui n.ºs de conta/códigos) e não constantes.
  const amountLike = stats.map(
    (s, i) =>
      i !== dateCol &&
      s.nonBlank > 0 &&
      s.parsedAmount === s.nonBlank &&
      s.hasDecimal &&
      s.dates === 0 &&
      // Exclui colunas constantes (n.º de conta…); com vazios não é constante.
      (s.distinct > 1 || s.blank > 0),
  );

  if (amountCol < 0 && debitCol < 0 && creditCol < 0) {
    // Coluna única com sinais mistos = montante com sinal.
    amountCol = stats.findIndex((s, i) => amountLike[i] && s.neg > 0 && s.pos > 0);
    if (amountCol < 0) {
      // Par débito/crédito: débito só tem negativos; crédito só positivos e tem
      // linhas vazias (ao contrário da coluna de saldo, preenchida em todas).
      debitCol = stats.findIndex((s, i) => amountLike[i] && s.neg > 0 && s.pos === 0);
      creditCol = stats.findIndex(
        (s, i) => i !== debitCol && amountLike[i] && s.pos > 0 && s.neg === 0 && s.blank > 0,
      );
      if (debitCol < 0 && creditCol < 0) {
        amountCol = amountLike.findIndex(Boolean);
      }
    }
  }

  if (descriptionCol < 0) {
    // A descrição é a coluna de texto mais longa que não é data nem montante,
    // preferindo colunas não constantes (exclui n.º de conta, códigos fixos…).
    const candidates = stats
      .map((s, i) => ({ s, i }))
      .filter(
        ({ s, i }) =>
          i !== dateCol &&
          i !== amountCol &&
          i !== debitCol &&
          i !== creditCol &&
          !amountLike[i] &&
          s.nonBlank > 0 &&
          s.dates < s.nonBlank, // exclui segunda coluna de data (data-valor)
      );
    const pool = candidates.some(({ s }) => s.distinct > 1)
      ? candidates.filter(({ s }) => s.distinct > 1)
      : candidates;
    descriptionCol = pool.reduce(
      (best, c) => (best < 0 || c.s.avgLen > stats[best].avgLen ? c.i : best),
      -1,
    );
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
    const description =
      (row[m.descriptionCol] ?? '').trim().replace(/\s+/g, ' ') || '(sem descrição)';

    let amountCents: number | null = null;
    if (m.amountCol !== null) {
      amountCents = parsePtAmountToCents(row[m.amountCol] ?? '');
    } else if (m.debitCol !== null || m.creditCol !== null) {
      const debit = m.debitCol !== null ? (parsePtAmountToCents(row[m.debitCol] ?? '') ?? 0) : 0;
      const credit =
        m.creditCol !== null ? (parsePtAmountToCents(row[m.creditCol] ?? '') ?? 0) : 0;
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
