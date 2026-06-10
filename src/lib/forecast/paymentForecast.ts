import type {
  CompanyProfile,
  FiscalObligation,
  ForecastItem,
  ForecastWeek,
  Invoice,
  Kpis,
  Transaction,
} from '../../types/models';
import { addDays, isoToday, lastDayOfMonth, mondayOf, monthKey, toIso } from '../dates';
import { normalizeText } from '../categories/autoCategorize';

const UNPAID_STATUSES = new Set(['extracted', 'confirmed', 'uploaded', 'processing']);

/**
 * Despesas recorrentes: mesma categoria+contraparte (ou descrição) com valor estável (±5%)
 * em pelo menos 3 dos últimos 4 meses. Projetamos no mesmo dia do mês.
 */
export function detectRecurringExpenses(
  transactions: Transaction[],
  todayIso_: string,
): { label: string; dayOfMonth: number; amountCents: number }[] {
  const nowKey = monthKey(todayIso_);
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.amountCents >= 0) continue;
    if (t.categoryId === 'salarios' || t.categoryId === 'seguranca-social' || t.categoryId === 'impostos') {
      continue; // já cobertos por payroll/fiscal
    }
    const label = t.counterparty ?? t.description;
    const key = `${t.categoryId}|${normalizeText(label).slice(0, 24)}`;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const out: { label: string; dayOfMonth: number; amountCents: number }[] = [];
  for (const txs of groups.values()) {
    const byMonth = new Map<string, Transaction>();
    for (const t of txs) byMonth.set(monthKey(t.date), t);
    // últimos 4 meses completos anteriores ao corrente
    const recent: Transaction[] = [];
    for (let i = 1; i <= 4; i++) {
      const [y, m] = nowKey.split('-').map(Number);
      const total = y * 12 + (m - 1) - i;
      const k = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
      const t = byMonth.get(k);
      if (t) recent.push(t);
    }
    if (recent.length < 3) continue;
    const amounts = recent.map((t) => -t.amountCents);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (avg < 1000) continue; // ignora valores < 10 €
    const stable = amounts.every((a) => Math.abs(a - avg) / avg <= 0.05);
    if (!stable) continue;
    const days = recent.map((t) => Number(t.date.slice(8, 10)));
    const dayOfMonth = Math.min(28, Math.round(days.reduce((a, b) => a + b, 0) / days.length));
    out.push({
      label: recent[0].counterparty ?? recent[0].description,
      dayOfMonth,
      amountCents: Math.round(avg),
    });
  }
  return out;
}

export interface ForecastInput {
  transactions: Transaction[];
  invoices: Invoice[];
  profile: CompanyProfile;
  calendar: FiscalObligation[];
  kpis: Kpis;
  weeks?: number;
  today?: Date;
}

/**
 * Previsão semanal de pagamentos: faturas a pagar por vencimento, salários mensais,
 * pagamentos fiscais do calendário e despesas recorrentes detetadas.
 * Saldo projetado parte da posição de tesouraria atual.
 */
export function paymentForecast(input: ForecastInput): ForecastWeek[] {
  const weeks = input.weeks ?? 8;
  const today = input.today ?? new Date();
  const start = isoToday(today);
  const horizonEnd = addDays(start, weeks * 7);

  const items: ForecastItem[] = [];

  // 1) Faturas a pagar (não liquidadas), pelo vencimento (ou data de emissão + 30 dias).
  for (const inv of input.invoices) {
    if (inv.direction !== 'payable' || !UNPAID_STATUSES.has(inv.status)) continue;
    const due = inv.dueDate ?? addDays(inv.issueDate, 30);
    const clamped = due < start ? start : due; // vencidas entram já esta semana
    if (clamped >= horizonEnd) continue;
    items.push({
      kind: 'invoice',
      label: `Fatura ${inv.number ?? ''} — ${inv.counterparty}`.trim(),
      dueDate: clamped,
      amountCents: inv.grossCents,
      sourceId: inv.id,
    });
  }

  // 2) Salários mensais.
  const payroll = input.profile.monthlyPayrollCents ?? 0;
  if (payroll > 0) {
    const day = Math.min(28, input.profile.payrollDayOfMonth ?? 25);
    for (let i = 0; i <= Math.ceil(weeks / 4) + 1; i++) {
      const [y, m] = monthKey(start).split('-').map(Number);
      const total = y * 12 + (m - 1) + i;
      const yy = Math.floor(total / 12);
      const mm = (total % 12) + 1;
      const d = toIso(yy, mm, Math.min(day, lastDayOfMonth(yy, mm)));
      if (d >= start && d < horizonEnd) {
        items.push({
          kind: 'payroll',
          label: 'Salários (incl. encargos)',
          dueDate: d,
          amountCents: payroll,
        });
      }
    }
  }

  // 3) Pagamentos fiscais do calendário dentro do horizonte.
  for (const o of input.calendar) {
    if (o.dueDate < start || o.dueDate >= horizonEnd) continue;
    if (o.obligationId === 'iva-pagamento' && input.kpis.estimatedIvaDueCents != null) {
      if (input.kpis.estimatedIvaDueCents > 0) {
        items.push({
          kind: 'iva',
          label: 'IVA (estimativa)',
          dueDate: o.dueDate,
          amountCents: input.kpis.estimatedIvaDueCents,
          sourceId: o.key,
        });
      }
    } else if (o.obligationId === 'ss-pagamento' && payroll > 0) {
      // TSU ≈ 23,75% sobre salários brutos; usamos 25% do custo mensal como aproximação prudente.
      items.push({
        kind: 'tsu',
        label: 'Segurança Social (TSU, estimativa)',
        dueDate: o.dueDate,
        amountCents: Math.round(payroll * 0.25),
        sourceId: o.key,
      });
    }
  }

  // 4) Despesas recorrentes detetadas.
  for (const rec of detectRecurringExpenses(input.transactions, start)) {
    for (let i = 0; i <= Math.ceil(weeks / 4) + 1; i++) {
      const [y, m] = monthKey(start).split('-').map(Number);
      const total = y * 12 + (m - 1) + i;
      const yy = Math.floor(total / 12);
      const mm = (total % 12) + 1;
      const d = toIso(yy, mm, Math.min(rec.dayOfMonth, lastDayOfMonth(yy, mm)));
      if (d >= start && d < horizonEnd) {
        items.push({
          kind: 'recurring',
          label: `${rec.label} (recorrente)`,
          dueDate: d,
          amountCents: rec.amountCents,
        });
      }
    }
  }

  // Agrupar por semana (segunda-feira) e calcular saldo projetado.
  const firstMonday = mondayOf(start);
  const weeksOut: ForecastWeek[] = [];
  let balance = input.kpis.cashPositionCents;
  for (let w = 0; w < weeks; w++) {
    const weekStart = addDays(firstMonday, w * 7);
    const weekEnd = addDays(weekStart, 7);
    const weekItems = items
      .filter((it) => it.dueDate >= weekStart && it.dueDate < weekEnd)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const totalOutCents = weekItems.reduce((acc, it) => acc + it.amountCents, 0);
    balance -= totalOutCents;
    weeksOut.push({ weekStart, items: weekItems, totalOutCents, projectedBalanceCents: balance });
  }
  return weeksOut;
}
