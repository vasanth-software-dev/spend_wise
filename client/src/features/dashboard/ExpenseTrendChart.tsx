import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { SpendingTrendPoint } from '../../types/index.js';
import { formatINR } from '../../utils/format.js';

interface ExpenseTrendChartProps {
  data: SpendingTrendPoint[];
}

export const ExpenseTrendChart: React.FC<ExpenseTrendChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        No spending data for this range
      </div>
    );
  }

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-lg text-xs">
          <p className="font-bold text-slate-800 dark:text-slate-200 mb-1.5">{label}</p>
          <div className="space-y-1">
            <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Income: {formatINR(payload[0]?.value || 0)}
            </p>
            <p className="text-rose-600 dark:text-rose-400 font-semibold">
              Expense: {formatINR(payload[1]?.value || 0)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-72 w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b830" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
          />
          <Tooltip content={customTooltip} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
          />
          <Area
            type="monotone"
            name="Income"
            dataKey="income"
            stroke="#10B981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#incomeGrad)"
          />
          <Area
            type="monotone"
            name="Expense"
            dataKey="expense"
            stroke="#EF4444"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#expenseGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
