import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { CategoryBreakdownItem } from '../../types/index.js';
import { formatINR } from '../../utils/format.js';
import { useAppSelector } from '../../store/index.js';
import { resolveCategoryMeta } from '../../constants/categories.js';

interface CategoryBreakdownChartProps {
  data: CategoryBreakdownItem[];
}

const DEFAULT_COLORS = [
  '#10B981', '#6366F1', '#F59E0B', '#F43F5E', '#8B5CF6', '#06B6D4', '#64748B', '#EC4899'
];

export const CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = ({ data }) => {
  const categories = useAppSelector((state) => state.categories?.categories);

  const getEntryColor = (entry: CategoryBreakdownItem, index: number) => {
    if (entry.categoryColor && entry.categoryColor !== '#64748b') {
      return entry.categoryColor;
    }
    const meta = resolveCategoryMeta(entry.categoryName, categories);
    return meta.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-medium">
        No category spending recorded
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.totalAmount, 0);

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as CategoryBreakdownItem;
      const percentage = total > 0 ? Math.round((item.totalAmount / total) * 100) : 0;
      return (
        <div className="bg-white/95 dark:bg-[#0c121e]/95 backdrop-blur-md border border-slate-200/90 dark:border-white/10 p-3 rounded-2xl shadow-fintech-lg text-xs">
          <p className="font-bold text-slate-800 dark:text-slate-200">{item.categoryName}</p>
          <p className="text-slate-600 dark:text-slate-400 mt-1 font-mono">
            {formatINR(item.totalAmount)} <span className="text-slate-400">({percentage}%)</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 h-auto sm:h-72 pt-2">
      <div className="w-full sm:w-1/2 h-56 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={customTooltip} />
            <Pie
              data={data}
              dataKey="totalAmount"
              nameKey="categoryName"
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={82}
              paddingAngle={3}
              stroke="transparent"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getEntryColor(entry, index)}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Donut Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            Total Spent
          </span>
          <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white tabular-financial">
            {formatINR(total)}
          </span>
        </div>
      </div>

      <div className="w-full sm:w-1/2 max-h-60 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {data.slice(0, 6).map((item, index) => {
          const percentage = total > 0 ? Math.round((item.totalAmount / total) * 100) : 0;
          const color = getEntryColor(item, index);
          return (
            <div
              key={item._id || index}
              onClick={() => {
                if (item._id && item._id !== 'uncategorized') {
                  window.location.href = `/transactions?categoryId=${item._id}`;
                } else {
                  window.location.href = '/transactions';
                }
              }}
              className="space-y-1 group cursor-pointer p-1.5 rounded-lg hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
              title={`View ${item.categoryName} transactions`}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="truncate text-slate-700 dark:text-slate-300 font-semibold tracking-tight text-[11px] sm:text-xs group-hover:text-brand-500 transition-colors">
                    {item.categoryName}
                  </span>
                </div>
                <div className="text-right flex items-center gap-2 font-mono">
                  <span className="font-bold text-slate-900 dark:text-white tabular-financial text-xs">
                    {formatINR(item.totalAmount)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold w-7 text-right">
                    {percentage}%
                  </span>
                </div>
              </div>
              {/* Subtle Progress Bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-out-expo"
                  style={{ width: `${percentage}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
