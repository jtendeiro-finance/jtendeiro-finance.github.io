import { useMemo } from 'react';
import { useAuth } from '../store/useAuth';
import { useObligations } from '../store/useObligations';
import { useDerivedData } from '../lib/useDerivedData';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { daysUntil, formatDatePt, monthKey, monthLabelPt } from '../lib/dates';
import { toast } from '../components/ui/Toast';

export default function FiscalCalendarPage() {
  const uid = useAuth((s) => s.user!.uid);
  const { calendar, todayIso } = useDerivedData();
  const { status, toggle } = useObligations();

  const upcoming = useMemo(
    () => calendar.filter((o) => o.dueDate >= todayIso),
    [calendar, todayIso],
  );

  const byMonth = useMemo(() => {
    const map = new Map<string, typeof upcoming>();
    for (const o of upcoming) {
      const k = monthKey(o.dueDate);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(o);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [upcoming]);

  const pendingCount = upcoming.filter((o) => status[o.key] !== 'done').length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Calendário fiscal</h1>
        <p className="text-sm text-slate-500">
          Gerado a partir do perfil da sua empresa — {pendingCount} obrigações pendentes nos
          próximos meses. Confirme sempre os prazos com o seu contabilista.
        </p>
      </div>

      {byMonth.map(([month, items]) => (
        <Card key={month} title={monthLabelPt(month)}>
          <ul className="flex flex-col divide-y divide-slate-100">
            {items.map((o) => {
              const done = status[o.key] === 'done';
              const days = daysUntil(o.dueDate);
              return (
                <li key={o.key} className="flex items-start gap-3 py-3">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() =>
                      void toggle(uid, o.key).catch(() => toast('error', 'Não foi possível atualizar.'))
                    }
                    className="mt-1 size-4 accent-brand-700"
                    aria-label={`Marcar «${o.title}» como ${done ? 'pendente' : 'feita'}`}
                  />
                  <div className={`min-w-0 flex-1 ${done ? 'opacity-50' : ''}`}>
                    <p className={`text-sm font-medium ${done ? 'line-through' : ''}`}>
                      {o.title}
                      {o.periodLabel && <span className="ml-1 text-xs font-normal text-slate-400">({o.periodLabel})</span>}
                    </p>
                    <p className="text-xs text-slate-500">{o.description}</p>
                  </div>
                  <Badge tone={done ? 'success' : days <= 2 ? 'danger' : days <= 7 ? 'warning' : 'neutral'}>
                    {done ? 'feito' : formatDatePt(o.dueDate)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
