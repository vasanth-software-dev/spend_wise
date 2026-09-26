import React, { useEffect, useState } from 'react';
import { Download, Calendar, ArrowUpRight, ArrowDownLeft, PiggyBank } from 'lucide-react';
import { api } from '../services/api.js';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { formatINR } from '../utils/format.js';
import { CategoryBreakdownChart } from '../features/dashboard/CategoryBreakdownChart.js';
import { TopMerchantsChart } from '../features/dashboard/TopMerchantsChart.js';
import { ExpenseTrendChart } from '../features/dashboard/ExpenseTrendChart.js';

export const ReportsPage: React.FC = () => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports?startDate=${startDate}&endDate=${endDate}`);
      setReportData(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  const handleExportCSV = () => {
    window.open(`/api/v1/transactions/export?startDate=${startDate}&endDate=${endDate}`, '_blank');
  };

  const summary = reportData?.summary;
  const breakdown = reportData?.breakdown;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Financial Intelligence Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate and export custom date range analytics across categories, merchants, and income sources.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
          >
            Export Period CSV
          </Button>
        </div>
      </div>

      {/* Date Range Selector Card */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
            <Calendar className="w-4 h-4 text-brand-600" />
            <span>Select Statement Period:</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
            <Button size="sm" variant="secondary" onClick={fetchReport} isLoading={loading}>
              Apply
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Period Inflow (Income)</p>
              <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                +{formatINR(summary.incomeThisMonth)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 rounded-xl">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Period Outflow (Expense)</p>
              <h3 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                -{formatINR(summary.expensesThisMonth)}
              </h3>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 dark:bg-rose-950/60 rounded-xl">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Net Period Savings</p>
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {formatINR(summary.savingsThisMonth)}
              </h3>
              <span className="text-[11px] text-slate-400 font-semibold">
                Savings Rate: {summary.savingsRate}%
              </span>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 dark:bg-amber-950/60 rounded-xl">
              <PiggyBank className="w-5 h-5" />
            </div>
          </Card>
        </div>
      )}

      {/* Detailed Report Charts */}
      {reportData && (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle>Daily Cash Flow Timeline</CardTitle>
              <CardDescription>Income vs expense trends for selected period</CardDescription>
            </CardHeader>
            <ExpenseTrendChart data={reportData.dailyTrend || []} />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 sm:p-6">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle>Expenses by Category</CardTitle>
                <CardDescription>Breakdown of outflows by category</CardDescription>
              </CardHeader>
              <CategoryBreakdownChart data={breakdown?.expensesByCategory || []} />
            </Card>

            <Card className="p-5 sm:p-6">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle>Top Payees & Merchants</CardTitle>
                <CardDescription>Merchants ranked by spend</CardDescription>
              </CardHeader>
              <TopMerchantsChart data={breakdown?.topMerchants || []} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
