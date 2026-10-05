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
    <div className="space-y-4 pt-2">
      {/* Visual Bar Distribution */}
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.85} />
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
            <Bar dataKey="totalAmount" fill="url(#barGrad)" radius={[0, 6, 6, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* List breakdown with % change and transaction count */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 pt-2 border-t border-slate-100 dark:border-slate-800">
        {data.slice(0, 5).map((m) => {
          const change = m.changePercentage;
          const hasChange = change !== undefined && change !== null;

          return (
            <div
              key={m.merchant}
              onClick={() => {
                window.location.href = `/transactions?search=${encodeURIComponent(m.merchant)}`;
              }}
              className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl cursor-pointer transition-colors group"
              title={`View all transactions with ${m.merchant}`}
            >
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-brand-500 transition-colors">
                  {m.merchant}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  {m.count} transaction{m.count !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="text-right flex items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-900 dark:text-white tabular-financial">
                  {formatINR(m.totalAmount)}
                </span>
                {hasChange && (
                  <span
                    className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                      change > 0
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : change < 0
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {change > 0 ? `+${change}%` : `${change}%`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
