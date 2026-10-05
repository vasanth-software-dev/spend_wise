import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  PiggyBank,
  Filter,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAppSelector } from '../store/index.js';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { toast } from '../components/ui/Toast.js';
import { formatINR } from '../utils/format.js';
import {
  exportReportToPDF,
  exportReportToExcel,
  downloadTransactionsCSV,
} from '../utils/reportExport.js';
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
  const [activePreset, setActivePreset] = useState<string>('last_30_days');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'excel' | 'csv' | null>(null);

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyPreset = (preset: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'last_7_days') {
      start.setDate(now.getDate() - 7);
    } else if (preset === 'last_30_days') {
      start.setDate(now.getDate() - 30);
    } else if (preset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (preset === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === 'ytd') {
      start = new Date(now.getFullYear(), 0, 1);
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setActivePreset(preset);
  };

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

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExportMenuOpen(false);
    setExportingFormat(format);
    try {
      let transactions: any[] = [];
      try {
        const txRes = await api.get('/transactions', {
          params: {
            startDate,
            endDate,
            limit: 5000,
          },
        });
        transactions = txRes.data?.data?.transactions || [];
      } catch (e) {
        console.warn('Could not fetch itemized transactions for report export:', e);
      }

      if (format === 'pdf') {
        exportReportToPDF({
          startDate,
          endDate,
          reportData,
          transactions,
          userName: user?.name,
        });
        toast.success('PDF statement report generated successfully');
      } else if (format === 'excel') {
        exportReportToExcel({
          startDate,
          endDate,
          reportData,
          transactions,
          userName: user?.name,
        });
        toast.success('Excel report generated (.xlsx)');
      } else if (format === 'csv') {
        await downloadTransactionsCSV(startDate, endDate, transactions);
        toast.success('Transactions CSV statement downloaded');
      }
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to export report');
    } finally {
      setExportingFormat(null);
    }
  };

  const summary = reportData?.summary;
  const breakdown = reportData?.breakdown;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Financial Intelligence & Reports
            </h1>
            <Badge variant="blue" dot className="hidden sm:inline-flex">
              Analytics Engine
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Custom statement analytics across categories, merchants, and income-to-spend ratios.
          </p>
        </div>

        {/* Export Dropdown Toolbar */}
        <div className="flex items-center gap-2.5 relative" ref={exportMenuRef}>
          <Button
            size="sm"
            variant="outline"
            leftIcon={
              exportingFormat ? (
                <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              )
            }
            rightIcon={
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  isExportMenuOpen ? 'rotate-180' : ''
                }`}
              />
            }
            onClick={() => setIsExportMenuOpen((prev) => !prev)}
            disabled={loading || !!exportingFormat}
            className="shadow-2xs font-medium"
          >
            {exportingFormat ? `Generating ${exportingFormat.toUpperCase()}...` : 'Export Report'}
          </Button>

          {isExportMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-surface-elevated rounded-xl shadow-xl border border-slate-200/80 dark:border-white/10 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-white/5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Export Statement & Analytics
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  {startDate} to {endDate}
                </p>
              </div>

              {/* PDF Option */}
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                className="w-full text-left px-3.5 py-2.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
              >
                <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 mt-0.5">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400">
                      PDF Document (.pdf)
                    </span>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                      Statement
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Executive summary, KPI cards, category breakdown & itemized ledger
                  </p>
                </div>
              </button>

              {/* Excel Option */}
              <button
                type="button"
                onClick={() => handleExport('excel')}
                className="w-full text-left px-3.5 py-2.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
              >
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 mt-0.5">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      Excel Spreadsheet (.xlsx)
                    </span>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      Multi-Sheet
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Separate sheets for summary metrics and full transaction records
                  </p>
                </div>
              </button>

              {/* CSV Option */}
              <button
                type="button"
                onClick={() => handleExport('csv')}
                className="w-full text-left px-3.5 py-2.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
              >
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 mt-0.5">
                  <Download className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    CSV Statement (.csv)
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Raw tabular data compatible with accounting tools & Google Sheets
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Date Range Selector Toolbar */}
      <Card variant="elevated" className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-2 hidden sm:inline-flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Presets
            </span>
            {[
              { id: 'last_7_days', label: 'Last 7 Days' },
              { id: 'last_30_days', label: 'Last 30 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'ytd', label: 'Year to Date' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-[background-color,color] duration-150 ease-out-expo ${
                  activePreset === p.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-elevated/70'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Explicit Custom Date Inputs */}
          <div className="flex flex-wrap items-center gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-surface-elevated/80 border border-slate-200/80 dark:border-white/5 rounded-xl px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="bg-transparent text-xs font-mono font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              />
              <span className="text-slate-400 text-xs font-medium">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="bg-transparent text-xs font-mono font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              />
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={fetchReport}
              isLoading={loading}
              className="text-xs"
            >
              Apply Filter
            </Button>
          </div>
        </div>
      </Card>

      {/* Hero Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {/* Income Inflow Card */}
          <Card variant="elevated" className="p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Statement Inflow (Income)
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-financial tracking-tight">
                +{formatINR(summary.incomeThisMonth)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Total incoming deposits for period</p>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Card>

          {/* Expenses Outflow Card */}
          <Card variant="elevated" className="p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Statement Outflow (Expenses)
              </span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-financial tracking-tight">
                {formatINR(summary.expensesThisMonth)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Total debited spending across accounts</p>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-rose-500/0 via-rose-500/40 to-rose-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Card>

          {/* Net Savings & Retention Card */}
          <Card variant="elevated" className="p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Net Retained Capital
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40">
                <PiggyBank className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div
                className={`text-2xl sm:text-3xl font-extrabold tabular-financial tracking-tight ${
                  summary.savingsThisMonth >= 0
                    ? 'text-slate-900 dark:text-white'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatINR(summary.savingsThisMonth)}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-surface-subtle rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-[width] duration-300 ease-out-expo"
                    style={{
                      width: `${Math.min(Math.max(summary.savingsRate || 0, 0), 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {summary.savingsRate}% saved
                </span>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-brand-500/0 via-brand-500/40 to-brand-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Card>
        </div>
      )}

      {/* Detailed Analytics Visualizations */}
      {reportData && (
        <div className="space-y-6">
          {/* Daily Cash Flow Area Chart */}
          <Card variant="elevated" className="p-5 sm:p-6">
            <CardHeader className="pb-4 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold">
                    Daily Cash Flow Timeline
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Comparative income and expenditure progression for the selected timeframe
                  </CardDescription>
                </div>
                <Badge variant="slate" className="text-[11px] font-mono">
                  {reportData.dailyTrend?.length || 0} Data Points
                </Badge>
              </div>
            </CardHeader>
            <div className="pt-4">
              <ExpenseTrendChart data={reportData.dailyTrend || []} />
            </div>
          </Card>

          {/* Breakdown Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <Card variant="elevated" className="p-5 sm:p-6">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-white/5">
                <CardTitle className="text-base font-bold">Expenses by Category</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Proportional outflow distribution by budget classification
                </CardDescription>
              </CardHeader>
              <div className="pt-4">
                <CategoryBreakdownChart data={breakdown?.expensesByCategory || []} />
              </div>
            </Card>

            {/* Merchant Leaderboard */}
            <Card variant="elevated" className="p-5 sm:p-6">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-white/5">
                <CardTitle className="text-base font-bold">Top Payees & Merchants</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  High-frequency counterparties ranked by total expenditure volume
                </CardDescription>
              </CardHeader>
              <div className="pt-4">
                <TopMerchantsChart data={breakdown?.topMerchants || []} />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
