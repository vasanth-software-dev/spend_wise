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

interface CategoryBreakdownChartProps {
  data: CategoryBreakdownItem[];
}

const DEFAULT_COLORS = [
  '#10B981', '#6366F1', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4', '#64748B'
];

export const CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl shadow-lg text-xs">
          <p className="font-bold text-slate-800 dark:text-slate-200">{item.categoryName}</p>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
            {formatINR(item.totalAmount)} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 h-72">
      <div className="w-full sm:w-1/2 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={customTooltip} />
            <Pie
              data={data}
              dataKey="totalAmount"
              nameKey="categoryName"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.categoryColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full sm:w-1/2 max-h-56 overflow-y-auto space-y-2 pr-2">
        {data.slice(0, 6).map((item, index) => {
          const percentage = total > 0 ? Math.round((item.totalAmount / total) * 100) : 0;
          const color = item.categoryColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
          return (
            <div key={item._id || index} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                  {item.categoryName}
                </span>
              </div>
              <div className="text-right flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {formatINR(item.totalAmount)}
                </span>
                <span className="text-[11px] text-slate-400 font-mono w-7 text-right">
                  {percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
