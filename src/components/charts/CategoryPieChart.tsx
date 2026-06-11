import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { categoryLabel } from '../../lib/categories/categories';
import { formatCents } from '../../lib/money';

const COLORS = ['#0f766e', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export function CategoryPieChart({
  data,
}: {
  data: { categoryId: string; totalCents: number }[];
}) {
  const rows = data.slice(0, 6).map((d) => ({
    name: categoryLabel(d.categoryId),
    value: d.totalCents / 100,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
          {rows.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatCents(Math.round((v as number) * 100))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
