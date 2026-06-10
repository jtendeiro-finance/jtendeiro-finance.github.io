import { Link } from 'react-router-dom';
import { useDerivedData } from '../lib/useDerivedData';
import { useTransactions } from '../store/useTransactions';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { MonthlyBarChart } from '../components/charts/MonthlyBarChart';
import { CategoryPieChart } from '../components/charts/CategoryPieChart';
import { ProjectedBalanceChart } from '../components/charts/ProjectedBalanceChart';
import { AlertsList } from '../components/alerts/AlertsList';
import { formatCents } from '../lib/money';
import { daysUntil, formatDatePt } from '../lib/dates';

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { kpis, deadlines, forecast, alerts } = useDerivedData();
  const txCount = useTransactions((s) => s.transactions.length);

  if (txCount === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <EmptyState
            icon="🚀"
            title="Comece por importar os seus dados financeiros"
            hint="Importe um extrato bancário (CSV) ou um ficheiro SAF-T do seu programa de faturação. Também pode digitalizar faturas com a câmara."
            action={
              <div className="flex gap-2">
                <Link to="/movimentos" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
                  Importar movimentos
                </Link>
                <Link to="/faturas" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Digitalizar fatura
                </Link>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  const margin = kpis.profitMarginPct;
  const nextWeeks = forecast.slice(0, 4);
  const minProjected = nextWeeks.length
    ? Math.min(...nextWeeks.map((w) => w.projectedBalanceCents))
    : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">Painel</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Tesouraria" value={formatCents(kpis.cashPositionCents)} />
        <KpiCard
          label="Margem (últimos 90 dias)"
          value={margin == null ? '—' : `${margin.toFixed(1)} %`}
        />
        <KpiCard
          label="Runway"
          value={kpis.runwayMonths == null ? '∞' : `${kpis.runwayMonths.toFixed(1)} meses`}
          sub={kpis.runwayMonths == null ? 'fluxo de caixa positivo' : 'ao ritmo de gastos atual'}
        />
        <KpiCard
          label="IVA estimado (período atual)"
          value={kpis.estimatedIvaDueCents == null ? '—' : formatCents(kpis.estimatedIvaDueCents)}
          sub="com base nas vendas SAF-T"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Receitas vs. despesas (12 meses)" className="lg:col-span-2">
          <MonthlyBarChart data={kpis.monthly} />
        </Card>
        <Card title="Principais despesas (90 dias)">
          {kpis.topExpenseCategories.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Sem despesas registadas.</p>
          ) : (
            <CategoryPieChart data={kpis.topExpenseCategories} />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Previsão de saldo (8 semanas)"
          className="lg:col-span-2"
          action={
            minProjected != null && minProjected < 0 ? (
              <Badge tone="danger">saldo negativo previsto</Badge>
            ) : (
              <Link to="/previsao" className="text-xs text-brand-700 hover:underline">ver detalhe →</Link>
            )
          }
        >
          <ProjectedBalanceChart weeks={forecast} />
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Alertas">
            <AlertsList alerts={alerts} />
          </Card>
          <Card
            title="Próximos prazos fiscais"
            action={<Link to="/calendario" className="text-xs text-brand-700 hover:underline">calendário →</Link>}
          >
            {deadlines.length === 0 ? (
              <p className="text-sm text-slate-500">Sem prazos pendentes próximos.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {deadlines.map((d) => {
                  const days = daysUntil(d.dueDate);
                  return (
                    <li key={d.key} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{d.title}</span>
                      <Badge tone={days <= 2 ? 'danger' : days <= 7 ? 'warning' : 'neutral'}>
                        {formatDatePt(d.dueDate)}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
