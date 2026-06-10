import type { Alert } from '../../types/models';

const SEVERITY_STYLE: Record<Alert['severity'], string> = {
  critical: 'border-red-300 bg-red-50',
  warning: 'border-amber-300 bg-amber-50',
  info: 'border-sky-200 bg-sky-50',
};

const SEVERITY_ICON: Record<Alert['severity'], string> = {
  critical: '🔴',
  warning: '🟠',
  info: 'ℹ️',
};

export function AlertsList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return <p className="text-sm text-slate-500">Sem alertas ativos. Tudo em ordem. ✅</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((a) => (
        <li key={a.id} className={`rounded-lg border p-3 ${SEVERITY_STYLE[a.severity]}`}>
          <p className="text-sm font-medium">
            <span className="mr-1" aria-hidden>{SEVERITY_ICON[a.severity]}</span>
            {a.title}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">{a.detail}</p>
        </li>
      ))}
    </ul>
  );
}
