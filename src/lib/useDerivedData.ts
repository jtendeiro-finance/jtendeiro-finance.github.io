import { useMemo } from 'react';
import { useProfile } from '../store/useProfile';
import { useTransactions } from '../store/useTransactions';
import { useInvoices } from '../store/useInvoices';
import { useObligations } from '../store/useObligations';
import { computeKpis } from './kpi/kpi';
import { generateCalendar, nextDeadlines } from './fiscal/generateCalendar';
import { paymentForecast } from './forecast/paymentForecast';
import { computeAlerts } from './alerts/alertRules';
import { isoToday } from './dates';

/**
 * Dados derivados partilhados (KPIs, calendário, previsão, alertas).
 * Tudo calculado em memória a partir das stores — uma única fonte de verdade.
 */
export function useDerivedData() {
  const profile = useProfile((s) => s.profile);
  const transactions = useTransactions((s) => s.transactions);
  const invoices = useInvoices((s) => s.invoices);
  const status = useObligations((s) => s.status);

  return useMemo(() => {
    const today = new Date();
    const todayIso = isoToday(today);
    const kpis = computeKpis(transactions, today);
    const year = today.getFullYear();
    const calendar = profile ? generateCalendar(profile, year, year + 1) : [];
    const deadlines = nextDeadlines(calendar, status, 6, todayIso);
    const forecast = profile
      ? paymentForecast({ transactions, invoices, profile, calendar, kpis, today })
      : [];
    const alerts = profile
      ? computeAlerts({ kpis, calendar, status, profile, forecast, invoices, today })
      : [];
    return { kpis, calendar, deadlines, forecast, alerts, todayIso };
  }, [profile, transactions, invoices, status]);
}
