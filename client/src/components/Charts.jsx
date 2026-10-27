import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { BUCKETS, KEYS, PALETTE, money, moneyShort } from '../constants';

// Card wrapper that shows an empty state when there is no data
function ChartCard({ title, empty, children }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="h-64 sm:h-72">
        {empty
          ? <div className="grid h-full place-items-center text-sm text-muted">No data yet</div>
          : <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>}
      </div>
    </div>
  );
}

const axis = { fontSize: 12, fill: '#6b7385' };
const grid = { strokeDasharray: '3 3', stroke: '#e4e7ee', vertical: false };

export default function Charts({ period, income, spent, transactions, trend }) {
  // Target vs actual for the selected month
  const monthData = KEYS.map((k) => ({
    name: BUCKETS[k].label,
    Target: (income * BUCKETS[k].pct) / 100,
    Actual: spent[k],
    color: BUCKETS[k].color,
  }));

  // Spending by category for the selected month
  const catTotals = {};
  transactions.forEach((t) => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
  const catData = Object.entries(catTotals).map(([name, value]) => ({ name, value }));

  // 12-month series; the selected month uses the live values
  const series = [
    ...trend.filter((m) => m.period !== period),
    { period, income, needs: spent.needs, wants: spent.wants, savings: spent.savings },
  ].sort((a, b) => a.period.localeCompare(b.period));

  const trendData = series.map((m) => ({
    period: m.period,
    Needs: m.needs,
    Wants: m.wants,
    'Savings & debt': m.savings,
  }));

  const flowData = series.map((m) => ({
    period: m.period,
    Income: m.income,
    Spending: m.needs + m.wants,
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartCard title="Target vs actual this month" empty={income === 0 && transactions.length === 0}>
        <BarChart data={monthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={axis} tickFormatter={moneyShort} tickLine={false} axisLine={false} width={56} />
          <Tooltip formatter={(v) => money(v)} cursor={{ fill: '#f5f6f9' }} />
          <Legend verticalAlign="top" iconType="circle" />
          <Bar dataKey="Target" fill="#cfd5e2" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Actual" radius={[6, 6, 0, 0]}>
            {monthData.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ChartCard>

      <ChartCard title="Spending by category" empty={catData.length === 0}>
        <PieChart>
          <Pie data={catData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
            {catData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => money(v)} />
          <Legend verticalAlign="bottom" iconType="circle" />
        </PieChart>
      </ChartCard>

      <ChartCard title="12-month trend" empty={series.length === 0}>
        <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="period" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickFormatter={moneyShort} tickLine={false} axisLine={false} width={56} />
          <Tooltip formatter={(v) => money(v)} cursor={{ fill: '#f5f6f9' }} />
          <Legend verticalAlign="top" iconType="circle" />
          <Bar dataKey="Needs" stackId="a" fill={BUCKETS.needs.color} />
          <Bar dataKey="Wants" stackId="a" fill={BUCKETS.wants.color} />
          <Bar dataKey="Savings & debt" stackId="a" fill={BUCKETS.savings.color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Income vs spending" empty={series.length === 0}>
        <LineChart data={flowData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="period" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickFormatter={moneyShort} tickLine={false} axisLine={false} width={56} />
          <Tooltip formatter={(v) => money(v)} />
          <Legend verticalAlign="top" iconType="circle" />
          <Line type="monotone" dataKey="Income" stroke="#22b455" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="Spending" stroke="#f0392b" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ChartCard>
    </div>
  );
}
