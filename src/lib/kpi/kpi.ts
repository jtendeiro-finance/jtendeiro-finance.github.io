import type { Kpis, MonthlyTotal, Transaction } from '../../types/models';
import { addMonthsToKey, monthKey } from '../dates';

/**
 * Calcula todos os indicadores a partir das transações.
 * Função pura — única fonte de verdade para dashboard, alertas, previsão e contexto de IA.
 */
export function computeKpis(transactions: Transaction[], today: Date = new Date()): Kpis {
  const cashPositionCents = transactions.reduce((acc, t) => acc + t.amountCents, 0);

  const nowKey = monthKey(today.toISOString().slice(0, 10));
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(addMonthsToKey(nowKey, -i));

  const byMonth = new Map<string, MonthlyTotal>(
    months.map((m) => [m, { month: m, incomeCents: 0, expenseCents: 0 }]),
  );
  for (const t of transactions) {
    const k = monthKey(t.date);
    const slot = byMonth.get(k);
    if (!slot) continue;
    if (t.amountCents >= 0) slot.incomeCents += t.amountCents;
    else slot.expenseCents += -t.amountCents;
  }
  const monthly = months.map((m) => byMonth.get(m)!);

  // Top categorias de despesa nos últimos 90 dias.
  const cutoff = new Date(today.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
  const catTotals = new Map<string, number>();
  let income90 = 0;
  let expense90 = 0;
  for (const t of transactions) {
    if (t.date < cutoff) continue;
    if (t.amountCents >= 0) {
      income90 += t.amountCents;
    } else {
      expense90 += -t.amountCents;
      catTotals.set(t.categoryId, (catTotals.get(t.categoryId) ?? 0) + -t.amountCents);
    }
  }
  const topExpenseCategories = [...catTotals.entries()]
    .map(([categoryId, totalCents]) => ({ categoryId, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 6);

  const profitMarginPct =
    income90 > 0 ? Math.round(((income90 - expense90) / income90) * 1000) / 10 : null;

  // Burn médio dos últimos 3 meses completos (exclui o mês corrente).
  const last3 = monthly.slice(-4, -1);
  const nets = last3.map((m) => m.incomeCents - m.expenseCents);
  const avgNet = nets.length > 0 ? nets.reduce((a, b) => a + b, 0) / nets.length : 0;
  const avgMonthlyBurnCents = avgNet < 0 ? Math.round(-avgNet) : 0;

  const runwayMonths =
    avgMonthlyBurnCents > 0 && cashPositionCents > 0
      ? Math.round((cashPositionCents / avgMonthlyBurnCents) * 10) / 10
      : avgMonthlyBurnCents > 0
        ? 0
        : null;

  // IVA estimado do período corrente: Σ vatCents das vendas SAF-T no mês corrente.
  let iva = 0;
  let hasVat = false;
  for (const t of transactions) {
    if (t.vatCents != null && monthKey(t.date) === nowKey) {
      iva += t.vatCents;
      hasVat = true;
    }
  }
  const estimatedIvaDueCents = hasVat ? iva : null;

  return {
    cashPositionCents,
    monthly,
    topExpenseCategories,
    profitMarginPct,
    avgMonthlyBurnCents,
    runwayMonths,
    estimatedIvaDueCents,
  };
}
