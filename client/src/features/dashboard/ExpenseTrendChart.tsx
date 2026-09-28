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
      <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-medium">
        No spending data for this period
      </div>
    );
  }

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 dark:bg-[#0c121e]/95 backdrop-blur-md border border-slate-200/90 dark:border-white/10 p-3 rounded-2xl shadow-fintech-lg text-xs">
          <p className="font-bold text-slate-800 dark:text-slate-200 mb-2 border-b border-slate-100 dark:border-white/5 pb-1 tracking-tight">
            {label}
          </p>
          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Income
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatINR(payload[0]?.value || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Expense
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {formatINR(payload[1]?.value || 0)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-72 w-full pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#64748b" strokeOpacity={0.12} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
          />
          <Tooltip content={customTooltip} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ fontSize: 11, paddingBottom: 12, fontWeight: 600 }}
          />
          <Area
            type="monotone"
            name="Income"
            dataKey="income"
            stroke="#10B981"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#incomeGrad)"
          />
          <Area
            type="monotone"
            name="Expense"
            dataKey="expense"
            stroke="#F43F5E"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#expenseGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
