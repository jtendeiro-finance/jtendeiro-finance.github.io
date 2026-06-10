import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ForecastWeek } from '../../types/models';
import { formatCents, formatCentsCompact } from '../../lib/money';
import { formatDatePt } from '../../lib/dates';

export function ProjectedBalanceChart({ weeks }: { weeks: ForecastWeek[] }) {
  const rows = weeks.map((w) => ({
    name: formatDatePt(w.weekStart),
    Saldo: w.projectedBalanceCents / 100,
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={(v: number) => formatCentsCompact(v * 100)} tick={{ fontSize: 11 }} width={56} />
        <Tooltip formatter={(v) => formatCents(Math.round((v as number) * 100))} />
        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
        <Line type="monotone" dataKey="Saldo" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
