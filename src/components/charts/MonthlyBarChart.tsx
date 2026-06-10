import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyTotal } from '../../types/models';
import { formatCents, formatCentsCompact } from '../../lib/money';
import { monthLabelPt } from '../../lib/dates';

export function MonthlyBarChart({ data }: { data: MonthlyTotal[] }) {
  const rows = data.map((m) => ({
    name: monthLabelPt(m.month),
    Receitas: m.incomeCents / 100,
    Despesas: m.expenseCents / 100,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v: number) => formatCentsCompact(v * 100)} tick={{ fontSize: 11 }} width={56} />
        <Tooltip formatter={(v) => formatCents(Math.round((v as number) * 100))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Receitas" fill="#0d9488" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Despesas" fill="#f87171" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
