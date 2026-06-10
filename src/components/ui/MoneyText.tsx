import { formatCents } from '../../lib/money';

export function MoneyText({ cents, signed = false }: { cents: number; signed?: boolean }) {
  const color = !signed ? '' : cents > 0 ? 'text-emerald-700' : cents < 0 ? 'text-red-700' : '';
  return <span className={`tabular-nums ${color}`}>{formatCents(cents)}</span>;
}
