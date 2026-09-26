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
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        No merchant spending data available
      </div>
    );
  }

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as TopMerchantItem;
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl shadow-lg text-xs">
          <p className="font-bold text-slate-800 dark:text-slate-200">{item.merchant}</p>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
            Total Spent: {formatINR(item.totalAmount)}
          </p>
          <p className="text-[11px] text-slate-400">Transactions: {item.count}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-72 w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 35, bottom: 5 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
          />
          <YAxis
            type="category"
            dataKey="merchant"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={75}
          />
          <Tooltip content={customTooltip} />
          <Bar dataKey="totalAmount" fill="#6366F1" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
