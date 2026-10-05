import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  Check,
  ChevronDown,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import { fetchBudgetsThunk } from '../store/slices/budgetSlice.js';
import { fetchDebtsThunk, fetchDebtSummaryThunk } from '../store/slices/debtSlice.js';
import { toast } from '../components/ui/Toast.js';
import {
  exportReportToPDF,
  exportReportToExcel,
  downloadTransactionsCSV,
  ExportReportSections,
} from '../utils/reportExport.js';

interface ExportPageProps {
  initialFormat?: 'pdf' | 'excel' | 'csv';
}

export const ExportPage: React.FC<ExportPageProps> = ({ initialFormat = 'pdf' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const budgets = useAppSelector((state) => state.budgets.budgets);
  const debts = useAppSelector((state) => state.debts.debts);

  // Format selection: 'pdf' | 'excel' | 'csv'
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>(() => {
    if (location.pathname.includes('/excel')) return 'excel';
    if (location.pathname.includes('/csv')) return 'csv';
    return initialFormat;
  });

  // Type: 'Report' | 'Transactions list' | 'Budgets' | 'Debts'
  const [reportType, setReportType] = useState<string>('Report');

  // Period: Month or preset or custom
  const [periodPreset, setPeriodPreset] = useState<string>('current_month');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Account / Payment Method Filter
  const [accountFilter, setAccountFilter] = useState<string>('all');

  // Include reports on checkboxes
  const [includeSections, setIncludeSections] = useState<ExportReportSections>({
    income: true,
    expenses: true,
    accounts: true,
    budgets: true,
    debts: true,
    categories: true,
    merchants: true,
    transactions: true,
  });

  const [isExporting, setIsExporting] = useState(false);

  // Load budgets and debts in background for report generation
  useEffect(() => {
    dispatch(fetchBudgetsThunk());
    dispatch(fetchDebtsThunk());
    dispatch(fetchDebtSummaryThunk());
  }, [dispatch]);

  // Sync format with route when pathname changes
  useEffect(() => {
    if (location.pathname.includes('/excel')) {
      setFormat('excel');
    } else if (location.pathname.includes('/csv')) {
      setFormat('csv');
    } else if (location.pathname.includes('/pdf')) {
      setFormat('pdf');
    }
  }, [location.pathname]);

  // Compute calculated start and end dates based on periodPreset
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let label = 'Current Month';

    if (periodPreset === 'current_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      label = start.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    } else if (periodPreset.startsWith('month_')) {
      const monthOffset = parseInt(periodPreset.split('_')[1], 10);
      start = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      end = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0);
      label = start.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    } else if (periodPreset === 'last_30_days') {
      start.setDate(now.getDate() - 30);
      label = 'Last 30 Days';
    } else if (periodPreset === 'last_7_days') {
      start.setDate(now.getDate() - 7);
      label = 'Last 7 Days';
    } else if (periodPreset === 'ytd') {
      start = new Date(now.getFullYear(), 0, 1);
      label = `Year to Date (${now.getFullYear()})`;
    } else if (periodPreset === 'custom') {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
        periodLabel: `${customStartDate} to ${customEndDate}`,
      };
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      periodLabel: label,
    };
  }, [periodPreset, customStartDate, customEndDate]);

  // Generate list of recent months for the Period dropdown
  const monthOptions = useMemo(() => {
    const options = [
      { id: 'current_month', label: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }) },
    ];
    for (let i = 1; i <= 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      options.push({
        id: `month_${i}`,
        label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      });
    }
    options.push(
      { id: 'last_30_days', label: 'Last 30 Days' },
      { id: 'last_7_days', label: 'Last 7 Days' },
      { id: 'ytd', label: `Year to Date (${new Date().getFullYear()})` },
      { id: 'custom', label: 'Custom Period...' }
    );
    return options;
  }, []);

  const toggleSection = (key: keyof ExportReportSections) => {
    setIncludeSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // 1. Fetch comprehensive report data
      let reportData: any = null;
      try {
        const res = await api.get(`/reports?startDate=${startDate}&endDate=${endDate}`);
        reportData = res.data?.data;
      } catch (e) {
        console.warn('Could not fetch report metrics:', e);
      }

      // 2. Fetch itemized transactions with account filter
      let transactions: any[] = [];
      try {
        const txParams: Record<string, any> = {
          startDate,
          endDate,
          limit: 5000,
        };
        if (accountFilter && accountFilter !== 'all') {
          txParams.paymentMethod = accountFilter;
        }

        const txRes = await api.get('/transactions', { params: txParams });
        transactions = txRes.data?.data?.transactions || [];
      } catch (e) {
        console.warn('Could not fetch transactions:', e);
      }

      const options = {
        startDate,
        endDate,
        reportData,
        transactions,
        userName: user?.name,
        accountFilter,
        typeFilter: reportType,
        sections: includeSections,
        budgets,
        debts,
      };

      if (format === 'pdf') {
        exportReportToPDF(options);
        toast.success('PDF report generated and downloaded');
      } else if (format === 'excel') {
        exportReportToExcel(options);
        toast.success('Excel workbook (.xlsx) downloaded');
      } else if (format === 'csv') {
        await downloadTransactionsCSV(startDate, endDate, transactions);
        toast.success('CSV transaction data downloaded');
      }
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to export file');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-start py-4 sm:py-8 px-3 sm:px-6 max-w-4xl mx-auto">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-slate-200/80 dark:border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Export {format.toUpperCase()} file
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Generate custom branded financial statements, reports, and spreadsheets
            </p>
          </div>
        </div>

        {/* Format Selector Pills */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-white/5">
          <button
            type="button"
            onClick={() => setFormat('pdf')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              format === 'pdf'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => setFormat('excel')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              format === 'excel'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => setFormat('csv')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              format === 'csv'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* Main Centered Card - Fast Budget Styling */}
      <div className="bg-[#1e232e] dark:bg-[#151923] text-white rounded-2xl shadow-2xl border border-slate-700/60 p-6 sm:p-10 max-w-2xl mx-auto w-full relative overflow-hidden">
        {/* Card Header Title */}
        <div className="text-center pb-6 border-b border-slate-700/50">
          <h2 className="text-lg sm:text-xl font-bold tracking-wide uppercase text-slate-100">
            CREATE FILE - {format.toUpperCase()}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure reporting period, account filters, and sections to include
          </p>
        </div>

        {/* Form Controls */}
        <div className="space-y-6 pt-6 text-sm">
          {/* Row 1: Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center">
            <label className="text-slate-300 font-medium sm:text-left">Type:</label>
            <div className="sm:col-span-2 relative">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full bg-[#2a303e] hover:bg-[#32394a] text-slate-100 font-medium py-2.5 px-4 pr-10 rounded-xl border border-slate-600/60 focus:border-sky-500 focus:outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="Report">Report</option>
                <option value="Transactions list">Transactions list</option>
                <option value="Budgets">Budgets & Planning</option>
                <option value="Debts">Debts & Loans</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Row 2: Period */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center">
            <label className="text-slate-300 font-medium sm:text-left">Period:</label>
            <div className="sm:col-span-2 relative">
              <select
                value={periodPreset}
                onChange={(e) => setPeriodPreset(e.target.value)}
                className="w-full bg-[#2a303e] hover:bg-[#32394a] text-slate-100 font-medium py-2.5 px-4 pr-10 rounded-xl border border-slate-600/60 focus:border-sky-500 focus:outline-none transition-colors appearance-none cursor-pointer"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Custom Date Range Picker (shown if periodPreset === 'custom') */}
          {periodPreset === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center bg-[#252b38] p-3 rounded-xl border border-slate-600/40">
              <label className="text-slate-400 text-xs sm:text-left">Custom Range:</label>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-1/2 bg-[#1a1e27] text-white text-xs py-2 px-3 rounded-lg border border-slate-600/60 focus:outline-none cursor-pointer font-mono"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-1/2 bg-[#1a1e27] text-white text-xs py-2 px-3 rounded-lg border border-slate-600/60 focus:outline-none cursor-pointer font-mono"
                />
              </div>
            </div>
          )}

          {/* Row 3: Account */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center">
            <label className="text-slate-300 font-medium sm:text-left">Account:</label>
            <div className="sm:col-span-2 relative">
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="w-full bg-[#2a303e] hover:bg-[#32394a] text-slate-100 font-medium py-2.5 px-4 pr-10 rounded-xl border border-slate-600/60 focus:border-sky-500 focus:outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="all">All accounts</option>
                <option value="upi">UPI Accounts</option>
                <option value="bank">Bank Accounts</option>
                <option value="cash">Cash in Hand</option>
                <option value="card">Cards (Credit / Debit)</option>
                <option value="wallet">Digital Wallets</option>
                <option value="other">Other Accounts</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Row 4: Include reports on Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-start pt-2">
            <label className="text-slate-300 font-medium sm:text-left pt-1">
              Include reports on:
            </label>
            <div className="sm:col-span-2 space-y-2.5">
              {[
                { id: 'income', label: 'Income', checked: includeSections.income !== false },
                { id: 'expenses', label: 'Expenses', checked: includeSections.expenses !== false },
                { id: 'accounts', label: 'Accounts & Payment Methods', checked: includeSections.accounts !== false },
                { id: 'budgets', label: 'Budgets & Planning', checked: includeSections.budgets !== false },
                { id: 'debts', label: 'Debts & Loans', checked: includeSections.debts !== false },
                { id: 'categories', label: 'Category Outflow Breakdown', checked: includeSections.categories !== false },
                { id: 'merchants', label: 'Top Payees & Merchants', checked: includeSections.merchants !== false },
                { id: 'transactions', label: 'Itemized Transactions List', checked: includeSections.transactions !== false },
              ].map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 cursor-pointer group select-none text-slate-300 hover:text-white"
                >
                  <div
                    onClick={() => toggleSection(item.id as keyof ExportReportSections)}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                      item.checked
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'border border-slate-600 bg-[#2a303e] group-hover:border-slate-500'
                    }`}
                  >
                    {item.checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span
                    onClick={() => toggleSection(item.id as keyof ExportReportSections)}
                    className="text-xs sm:text-sm font-medium"
                  >
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Card Footer: Action Button */}
        <div className="mt-8 pt-6 border-t border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span>Target Period: <strong className="text-slate-200">{periodLabel}</strong></span>
          </div>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className={`w-full sm:w-auto px-8 py-3 rounded-full font-bold uppercase text-xs tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
              isExporting
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : format === 'pdf'
                ? 'bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-sky-500/25 active:scale-98'
                : format === 'excel'
                ? 'bg-[#059669] hover:bg-[#047857] text-white shadow-emerald-500/25 active:scale-98'
                : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-blue-500/25 active:scale-98'
            }`}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>GENERATING {format.toUpperCase()}...</span>
              </>
            ) : (
              <>
                {format === 'pdf' ? (
                  <FileText className="w-4 h-4" />
                ) : format === 'excel' ? (
                  <FileSpreadsheet className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>EXPORT {format.toUpperCase()} FILE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
