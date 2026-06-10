import type {
  Alert,
  CompanyProfile,
  FiscalObligation,
  ForecastWeek,
  Invoice,
  Kpis,
  ObligationStatusMap,
} from '../../types/models';
import { daysUntil, formatDatePt, isoToday } from '../dates';
import { formatCents } from '../money';
import { categoryLabel } from '../categories/categories';

export interface AlertContext {
  kpis: Kpis;
  calendar: FiscalObligation[];
  status: ObligationStatusMap;
  profile: CompanyProfile;
  forecast?: ForecastWeek[];
  invoices?: Invoice[];
  today?: Date;
}

type AlertRule = (ctx: AlertContext) => Alert[];

const negativeTrend: AlertRule = ({ kpis }) => {
  const last3 = kpis.monthly.slice(-4, -1);
  if (last3.length < 3) return [];
  const allNegative = last3.every((m) => m.incomeCents - m.expenseCents < 0);
  if (!allNegative) return [];
  return [
    {
      id: 'negative-trend',
      severity: 'warning',
      title: 'Resultados negativos há 3 meses',
      detail:
        'A empresa gastou mais do que faturou em cada um dos últimos 3 meses. Reveja custos e preços.',
    },
  ];
};

const lowRunway: AlertRule = ({ kpis }) => {
  if (kpis.runwayMonths === null || kpis.runwayMonths >= 3) return [];
  return [
    {
      id: 'low-runway',
      severity: 'critical',
      title: `Tesouraria para ${kpis.runwayMonths.toLocaleString('pt-PT')} meses`,
      detail: `Ao ritmo atual de gastos (${formatCents(
        kpis.avgMonthlyBurnCents,
      )}/mês), o saldo disponível esgota-se em menos de 3 meses.`,
    },
  ];
};

const categorySpike: AlertRule = ({ kpis }) => {
  // Compara o mês corrente com a média dos 3 anteriores por categoria — usamos o top de despesa.
  const months = kpis.monthly;
  if (months.length < 4) return [];
  const current = months[months.length - 1];
  const prev = months.slice(-4, -1);
  const avgExpense = prev.reduce((a, m) => a + m.expenseCents, 0) / prev.length;
  if (avgExpense > 0 && current.expenseCents > avgExpense * 1.5 && current.expenseCents > 10000) {
    return [
      {
        id: 'expense-spike',
        severity: 'warning',
        title: 'Despesas acima do habitual este mês',
        detail: `As despesas deste mês (${formatCents(
          current.expenseCents,
        )}) estão 50% acima da média dos últimos 3 meses (${formatCents(Math.round(avgExpense))}).`,
      },
    ];
  }
  return [];
};

const upcomingDeadlines: AlertRule = ({ calendar, status, today }) => {
  const todayIso_ = isoToday(today ?? new Date());
  const out: Alert[] = [];
  for (const o of calendar) {
    if (status[o.key] === 'done') continue;
    const d = daysUntil(o.dueDate, today ?? new Date());
    if (d < 0 || d > 7) continue;
    out.push({
      id: `deadline:${o.key}`,
      severity: d <= 2 ? 'critical' : 'warning',
      title: d === 0 ? `Hoje: ${o.title}` : `Em ${d} dia${d === 1 ? '' : 's'}: ${o.title}`,
      detail: `${o.description} Prazo: ${formatDatePt(o.dueDate)}.`,
    });
  }
  void todayIso_;
  return out.slice(0, 5);
};

const ivaEstimate: AlertRule = ({ kpis }) => {
  if (kpis.estimatedIvaDueCents == null || kpis.estimatedIvaDueCents <= 0) return [];
  return [
    {
      id: 'iva-estimate',
      severity: 'info',
      title: `IVA estimado do período: ${formatCents(kpis.estimatedIvaDueCents)}`,
      detail:
        'Estimativa com base no IVA liquidado nas faturas importadas. Reserve este valor para o pagamento.',
    },
  ];
};

const negativeForecast: AlertRule = ({ forecast }) => {
  if (!forecast) return [];
  const firstNegative = forecast.slice(0, 4).find((w) => w.projectedBalanceCents < 0);
  if (!firstNegative) return [];
  return [
    {
      id: 'negative-forecast',
      severity: 'critical',
      title: 'Saldo projetado negativo nas próximas 4 semanas',
      detail: `Na semana de ${formatDatePt(firstNegative.weekStart)} o saldo projetado é ${formatCents(
        firstNegative.projectedBalanceCents,
      )}. Antecipe recebimentos ou adie pagamentos.`,
    },
  ];
};

const overdue: AlertRule = ({ invoices, today }) => {
  if (!invoices) return [];
  const todayIso_ = isoToday(today ?? new Date());
  const late = invoices.filter(
    (i) =>
      i.status !== 'reconciled' &&
      i.status !== 'paid' &&
      i.direction === 'payable' &&
      i.dueDate != null &&
      i.dueDate < todayIso_,
  );
  if (late.length === 0) return [];
  const total = late.reduce((a, i) => a + i.grossCents, 0);
  return [
    {
      id: 'overdue-invoices',
      severity: 'warning',
      title: `${late.length} fatura${late.length === 1 ? '' : 's'} vencida${late.length === 1 ? '' : 's'} por pagar`,
      detail: `Total em atraso: ${formatCents(total)}. Evite juros e penalizações junto dos fornecedores.`,
    },
  ];
};

const RULES: AlertRule[] = [
  lowRunway,
  negativeForecast,
  negativeTrend,
  categorySpike,
  upcomingDeadlines,
  overdue,
  ivaEstimate,
];

const SEVERITY_ORDER: Record<Alert['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function computeAlerts(ctx: AlertContext): Alert[] {
  return RULES.flatMap((rule) => rule(ctx)).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

export { categoryLabel };
