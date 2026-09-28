import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { TopMerchantItem } from '../../types/index.js';
import { formatINR } from '../../utils/format.js';

interface TopMerchantsChartProps {
  data: TopMerchantItem[];
}

export const TopMerchantsChart: React.FC<TopMerchantsChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-medium">
        No merchant spending data available
      </div>
    );
  }

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as TopMerchantItem;
      return (
        <div className="bg-white/95 dark:bg-[#0c121e]/95 backdrop-blur-md border border-slate-200/90 dark:border-white/10 p-3 rounded-2xl shadow-fintech-lg text-xs font-mono">
          <p className="font-bold text-slate-800 dark:text-slate-200 font-sans tracking-tight mb-1">
            {item.merchant}
          </p>
          <p className="text-slate-600 dark:text-slate-300 font-bold">
            Total Spent: {formatINR(item.totalAmount)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {item.count} transaction{item.count !== 1 ? 's' : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-72 w-full pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.9} />
            </linearGradient>
          </defs>
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
          />
          <YAxis
            type="category"
            dataKey="merchant"
            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip content={customTooltip} />
          <Bar dataKey="totalAmount" fill="url(#barGrad)" radius={[0, 6, 6, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
