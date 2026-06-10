import type {
  Invoice,
  ReconciliationResult,
  Transaction,
} from '../../types/models';
import { daysUntil, isoToDate } from '../dates';
import { normalizeText } from '../categories/autoCategorize';

const AUTO_MATCH_THRESHOLD = 0.8;
const SUGGESTION_THRESHOLD = 0.45;

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalizeText(a).split(/[^a-z0-9]+/).filter((t) => t.length >= 3));
  const tb = new Set(normalizeText(b).split(/[^a-z0-9]+/).filter((t) => t.length >= 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits++;
  return hits / Math.min(ta.size, tb.size);
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Math.round((isoToDate(a).getTime() - isoToDate(b).getTime()) / 86_400_000));
}

/** Pontuação 0–1 para o par (fatura, movimento bancário). */
export function scorePair(invoice: Invoice, tx: Transaction): number {
  // Direção: fatura a pagar ↔ movimento negativo; a receber ↔ positivo.
  if (invoice.direction === 'payable' && tx.amountCents >= 0) return 0;
  if (invoice.direction === 'receivable' && tx.amountCents <= 0) return 0;

  const txAbs = Math.abs(tx.amountCents);
  const gross = Math.abs(invoice.grossCents);
  if (gross === 0) return 0;

  let amountScore = 0;
  if (txAbs === gross) amountScore = 1;
  else if (Math.abs(txAbs - gross) / gross <= 0.01) amountScore = 0.7;
  else return 0;

  const ref = invoice.dueDate ?? invoice.issueDate;
  const dd = Math.min(daysBetween(tx.date, ref), daysBetween(tx.date, invoice.issueDate));
  let dateScore = 0;
  if (dd <= 7) dateScore = 1;
  else if (dd <= 30) dateScore = 0.5;
  else if (dd <= 60) dateScore = 0.2;
  else return 0;

  const nameScore = tokenOverlap(
    invoice.counterparty,
    `${tx.description} ${tx.counterparty ?? ''}`,
  );

  return 0.5 * amountScore + 0.3 * dateScore + 0.2 * nameScore;
}

/**
 * Conciliação automática entre faturas e movimentos bancários.
 * Auto-associa apenas pares inequívocos acima do limiar; o resto fica como sugestão.
 */
export function reconcile(
  transactions: Transaction[],
  invoices: Invoice[],
): ReconciliationResult {
  const openInvoices = invoices.filter(
    (i) => i.status !== 'reconciled' && i.status !== 'paid',
  );
  const freeTxs = transactions.filter((t) => !t.reconciledInvoiceId);

  // Matriz de candidatos.
  const candidates = new Map<string, { transactionId: string; score: number }[]>();
  for (const inv of openInvoices) {
    const list: { transactionId: string; score: number }[] = [];
    for (const tx of freeTxs) {
      const s = scorePair(inv, tx);
      if (s >= SUGGESTION_THRESHOLD) list.push({ transactionId: tx.id, score: Math.round(s * 100) / 100 });
    }
    list.sort((a, b) => b.score - a.score);
    if (list.length > 0) candidates.set(inv.id, list.slice(0, 5));
  }

  const autoMatched: ReconciliationResult['autoMatched'] = [];
  const suggestions: ReconciliationResult['suggestions'] = [];
  const usedTx = new Set<string>();

  // Auto-match guloso por pontuação descendente, apenas pares inequívocos.
  const flat = [...candidates.entries()]
    .map(([invoiceId, list]) => ({ invoiceId, list }))
    .sort((a, b) => (b.list[0]?.score ?? 0) - (a.list[0]?.score ?? 0));

  for (const { invoiceId, list } of flat) {
    const avail = list.filter((c) => !usedTx.has(c.transactionId));
    if (avail.length === 0) continue;
    const [best, second] = avail;
    const unambiguous =
      best.score >= AUTO_MATCH_THRESHOLD && (second === undefined || best.score - second.score >= 0.2);
    if (unambiguous) {
      autoMatched.push({ invoiceId, transactionId: best.transactionId, score: best.score });
      usedTx.add(best.transactionId);
    } else {
      suggestions.push({ invoiceId, candidates: avail });
    }
  }

  const matchedInvoiceIds = new Set([
    ...autoMatched.map((m) => m.invoiceId),
    ...suggestions.map((s) => s.invoiceId),
  ]);
  const unmatchedInvoiceIds = openInvoices
    .filter((i) => !matchedInvoiceIds.has(i.id))
    .map((i) => i.id);
  const unmatchedTransactionIds = freeTxs
    .filter((t) => !usedTx.has(t.id))
    .map((t) => t.id);

  return { autoMatched, suggestions, unmatchedInvoiceIds, unmatchedTransactionIds };
}

/** Faturas vencidas e por liquidar (para alertas/relatório). */
export function overdueInvoices(invoices: Invoice[], todayIso: string): Invoice[] {
  return invoices.filter(
    (i) =>
      i.status !== 'reconciled' &&
      i.status !== 'paid' &&
      i.dueDate != null &&
      daysUntil(i.dueDate, isoToDate(todayIso)) < 0,
  );
}
