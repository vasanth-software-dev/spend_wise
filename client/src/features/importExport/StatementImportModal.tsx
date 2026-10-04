import React, { useState, useRef } from 'react';
import {
  Upload,
  CheckCircle,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  FileCode,
  Lock,
  ArrowRight,
  CheckSquare,
  Square,
  Sparkles,
  Loader2,
  Trash2,
  Hash,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { api } from '../../services/api.js';
import { useAppDispatch, useAppSelector } from '../../store/index.js';
import { fetchTransactionsThunk } from '../../store/slices/transactionSlice.js';
import { fetchDashboardThunk } from '../../store/slices/dashboardSlice.js';
import {
  parseStatementFile,
  ParsedTransaction,
  ParseResult,
  getCategoryType,
  predictCategoryAndType,
} from '../../utils/statementParser.js';
import { formatINR } from '../../utils/format.js';
import {
  SELF_TRANSFER_CATEGORY,
  isTransferCategoryName,
} from '../../constants/categories.js';
import { CategorySelect } from '../../components/ui/CategorySelect.js';

interface StatementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StatementImportModal: React.FC<StatementImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const categories = useAppSelector((state) => state.categories.categories);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [fileType, setFileType] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [pdfPassword, setPdfPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [result, setResult] = useState<{
    importedCount: number;
    skippedCount: number;
    skipped?: Array<{ row: unknown; reason: string }>;
    debtCandidateCount?: number;
  } | null>(null);

  const [knownPeople, setKnownPeople] = useState<string[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      api.get('/people')
        .then((res) => {
          const list = res.data.data.people || [];
          setKnownPeople(list.map((p: any) => p.name).filter(Boolean));
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const resetState = () => {
    setFile(null);
    setIsParsing(false);
    setIsImporting(false);
    setParsedTransactions([]);
    setFileType('');
    setError(null);
    setPdfPassword('');
    setNeedsPassword(false);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleModalClose = () => {
    resetState();
    onClose();
  };

  const processFile = async (selectedFile: File, password?: string) => {
    setError(null);
    setIsParsing(true);
    setNeedsPassword(false);

    try {
      const res: ParseResult = await parseStatementFile(selectedFile, password, knownPeople);

      if (!res.transactions || res.transactions.length === 0) {
        setError(
          'No transaction records could be extracted from this file. Please check if the file contains tabular transaction records.'
        );
        setIsParsing(false);
        return;
      }

      let finalTransactions = res.transactions;
      try {
        const batchRes = await api.post('/transactions/predict-categories-batch', {
          items: res.transactions.map((t) => ({
            id: t.id,
            merchant: t.merchant,
            notes: t.notes,
            description: t.notes || t.merchant,
            amount: t.amount,
            date: t.date,
            type: t.type,
            category: t.category,
          })),
        });
        if (batchRes.data?.data?.predictions) {
          const predMap = new Map(batchRes.data.data.predictions.map((p: any) => [p.id, p]));
          finalTransactions = res.transactions.map((t) => {
            const pred = predMap.get(t.id) as any;
            if (pred && pred.category) {
              return {
                ...t,
                merchant: pred.name || pred.merchant || t.merchant,
                category: pred.category,
                type: pred.type || t.type,
              };
            }
            return t;
          });
        }
      } catch {
        // Fallback gracefully to client-parsed transactions
      }

      setFile(selectedFile);
      setFileType(res.fileType);
      setParsedTransactions(finalTransactions);
      setIsParsing(false);
    } catch (err: any) {
      setIsParsing(false);
      const errMsg = err?.message || String(err);
      if (
        errMsg.toLowerCase().includes('password') ||
        err?.name === 'PasswordException'
      ) {
        setFile(selectedFile);
        setNeedsPassword(true);
        setError('This PDF bank statement is password-protected. Please enter your password below to unlock.');
      } else {
        setError(`Failed to parse file: ${errMsg}`);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processFile(selected);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleUnlockPdf = () => {
    if (!file || !pdfPassword) return;
    processFile(file, pdfPassword);
  };

  // Toggle selection for a single row
  const toggleSelectRow = (id: string) => {
    setParsedTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  // Toggle all rows
  const allSelected =
    parsedTransactions.length > 0 &&
    parsedTransactions.every((t) => t.selected);

  const toggleSelectAll = () => {
    setParsedTransactions((prev) =>
      prev.map((t) => ({ ...t, selected: !allSelected }))
    );
  };

  // Toggle transaction type (Expense -> Income -> Transfer -> Expense) and auto-select compatible Category
  const toggleRowType = (id: string) => {
    setParsedTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const newType: 'expense' | 'income' | 'transfer' =
          t.type === 'expense' ? 'income' : t.type === 'income' ? 'transfer' : 'expense';

        // Self Transfer only makes sense for the transfer type
        if (isTransferCategoryName(t.category)) {
          if (newType === 'transfer') return { ...t, type: newType };
          const predicted = predictCategoryAndType(t.notes || t.merchant, newType, undefined, knownPeople);
          return { ...t, type: newType, category: predicted.category };
        }

        // If Friends & Family, it supports both income and expense
        if (t.category === 'Friends & Family') {
          return { ...t, type: newType };
        }

        // Check if current category is compatible with newType
        const currentCatType = getCategoryType(t.category);
        let newCategory = t.category;

        if (newType === 'income' && currentCatType === 'expense') {
          // Auto-select best income category
          const predicted = predictCategoryAndType(t.notes || t.merchant, 'income', undefined, knownPeople);
          newCategory = predicted.category;
          if (newCategory === 'Other' && (t.merchant || t.notes)) {
            newCategory = 'Friends & Family';
          }
        } else if (newType === 'expense' && currentCatType === 'income') {
          // Auto-select best expense category
          const predicted = predictCategoryAndType(t.notes || t.merchant, 'expense', undefined, knownPeople);
          newCategory = predicted.category;
        } else if (newType === 'transfer') {
          newCategory = SELF_TRANSFER_CATEGORY;
        }

        return { ...t, type: newType, category: newCategory };
      })
    );
  };

  // Update row category and auto-select matching Transaction Type
  const updateRowCategory = (id: string, newCategory: string) => {
    setParsedTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (newCategory === 'Friends & Family') {
          return { ...t, category: newCategory };
        }

        // Self Transfer maps to the transfer transaction type
        if (isTransferCategoryName(newCategory)) {
          return { ...t, category: newCategory, type: 'transfer' };
        }

        const matchedCat = categories.find(
          (c) => c.name.toLowerCase() === newCategory.toLowerCase()
        );
        let newType: 'expense' | 'income' | 'transfer' = t.type;
        if (matchedCat) {
          if (matchedCat.type === 'income') newType = 'income';
          else if (matchedCat.type === 'expense') newType = 'expense';
        } else {
          const deduced = getCategoryType(newCategory);
          if (deduced === 'income') newType = 'income';
          else if (deduced === 'expense') newType = 'expense';
        }

        return { ...t, category: newCategory, type: newType };
      })
    );
  };

  // Delete row from preview
  const removeRow = (id: string) => {
    setParsedTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // Calculate statistics of selected rows
  const selectedTransactions = parsedTransactions.filter((t) => t.selected);
  const totalExpense = selectedTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = selectedTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  // Submit to backend
  const handleImportConfirmed = async () => {
    if (selectedTransactions.length === 0) return;
    setIsImporting(true);
    setError(null);

    try {
      const rows = selectedTransactions.map((t) => ({
        date: t.date,
        amount: t.amount,
        type: t.type,
        merchant: t.merchant || 'Statement Entry',
        category: t.category || undefined,
        payment_method: t.payment_method || 'upi',
        refNo: t.refNo || undefined,
        externalTransactionId: t.refNo || undefined,
        notes: t.notes || undefined,
      }));

      const res = await api.post('/transactions/import', { rows });
      setResult(res.data.data);
      dispatch(fetchTransactionsThunk(undefined));
      dispatch(fetchDashboardThunk('30d'));
      setIsImporting(false);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Failed to complete transaction import'
      );
      setIsImporting(false);
    }
  };

  const getFormatBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> PDF Statement
          </span>
        );
      case 'xlsx':
      case 'xls':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel Spreadsheet
          </span>
        );
      case 'csv':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5" /> CSV Delimited
          </span>
        );
      case 'txt':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Text Export
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Import Transactions"
      description="Upload your bank statement or transaction export in PDF, Excel, CSV, or TXT format."
      maxWidth="5xl"
    >
      <div className="space-y-5">
        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Success View */}
        {result ? (
          <div className="p-8 text-center space-y-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-3xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Import Successful!
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-md mx-auto">
                Successfully added{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {result.importedCount} transactions
                </strong>{' '}
                to your ledger.
                {result.skippedCount > 0 &&
                  ` (${result.skippedCount} duplicates/existing rows skipped automatically).`}
              </p>
            </div>

            {(result.debtCandidateCount ?? 0) > 0 && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-left text-xs text-amber-800 dark:text-amber-200">
                <strong>{result.debtCandidateCount}</strong> person-to-person payment
                {result.debtCandidateCount === 1 ? '' : 's'} flagged as a possible debt
                repayment. Review them on the Debts page — nothing was recorded as a debt
                automatically.
              </div>
            )}

            {result.skipped && result.skipped.length > 0 && (
              <div className="mt-3 p-3 bg-white/80 dark:bg-slate-900/60 rounded-xl text-left border border-slate-200 dark:border-slate-800 max-h-36 overflow-y-auto custom-scrollbar text-[11px]">
                <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  Skipped Duplicates:
                </p>
                <ul className="space-y-1 text-slate-500 dark:text-slate-400">
                  {result.skipped.slice(0, 8).map((s: any, idx: number) => (
                    <li key={idx} className="truncate">
                      • {s.reason || 'Duplicate transaction'}
                    </li>
                  ))}
                  {result.skipped.length > 8 && (
                    <li className="text-slate-400 italic">...and {result.skipped.length - 8} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="pt-2 flex items-center justify-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={resetState}
              >
                Import Another File
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleModalClose}
              >
                View in Ledger
              </Button>
            </div>
          </div>
        ) : parsedTransactions.length === 0 ? (
          /* File Upload State */
          <div className="space-y-4">
            {/* Format support pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 py-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <FileText className="w-3.5 h-3.5" /> PDF Statements (HDFC, SBI, ICICI, etc.)
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.XLSX, .XLS)
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <FileCode className="w-3.5 h-3.5" /> CSV Delimited
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <FileText className="w-3.5 h-3.5" /> Text (.TXT / .TSV)
              </span>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700/80 hover:border-brand-500 dark:hover:border-brand-400 rounded-3xl p-8 sm:p-10 text-center bg-slate-50/50 dark:bg-[#121927]/60 cursor-pointer relative transition-[border-color,box-shadow] duration-150 ease-out-expo group shadow-sm hover:shadow-md"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.txt,.tsv"
                onChange={handleFileChange}
                className="hidden"
              />

              {isParsing ? (
                <div className="py-6 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Extracting transactions from {file?.name || 'file'}...
                  </p>
                  <p className="text-xs text-slate-400">
                    Auto-detecting dates, amounts, categories & payment methods
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-500/10 group-hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center transition-colors">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                      Click to choose or drag & drop statement file
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports PDF bank statements, Excel workbooks, CSV tables, and plain text
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Auto-categorizes Swiggy, Zomato, Salary, Fuel, Bills & more</span>
                  </div>
                </div>
              )}
            </div>

            {/* Password Prompt if PDF is encrypted */}
            {needsPassword && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Lock className="w-4 h-4" />
                  <span>PDF Password Required (e.g. PAN card number or DOB)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter PDF password"
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlockPdf()}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleUnlockPdf}
                    isLoading={isParsing}
                  >
                    Unlock & Parse
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Preview and Selection Table */
          <div className="space-y-4">
            {/* Header info bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                {getFormatBadge(fileType)}
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-xs">
                  {file?.name}
                </span>
                <span className="text-xs text-slate-400">
                  ({parsedTransactions.length} records found)
                </span>
              </div>

              {/* Summary Stats */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Selected: <strong className="text-slate-800 dark:text-slate-100">{selectedTransactions.length}</strong>
                </span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  Expense: {formatINR(totalExpense)}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Income: {formatINR(totalIncome)}
                </span>
              </div>
            </div>

            {/* Smart Auto Type & Person Detection Banner */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-[11px] text-brand-700 dark:text-brand-300">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-brand-500" />
              <span>
                <strong>Smart Auto-Detect:</strong> Received amounts from individuals (e.g. <em>ABIRAMI P</em>, <em>BOOBAL</em>) are automatically classified under <strong>Friends & Family</strong> as <strong>Income</strong>.
              </span>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto max-h-[380px] border border-slate-200 dark:border-slate-800/90 rounded-2xl custom-scrollbar shadow-inner">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100/90 dark:bg-slate-800/80 text-slate-500 font-semibold sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3 w-10">
                      <button
                        onClick={toggleSelectAll}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title={allSelected ? 'Deselect all' : 'Select all'}
                      >
                        {allSelected ? (
                          <CheckSquare className="w-4 h-4 text-brand-500" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Merchant / Narration</th>
                    <th className="p-3">Ref.No</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Method</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
                  {parsedTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        !tx.selected ? 'opacity-40 bg-slate-50/40 dark:bg-slate-900/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3">
                        <button
                          onClick={() => toggleSelectRow(tx.id)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {tx.selected ? (
                            <CheckSquare className="w-4 h-4 text-brand-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Date */}
                      <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {tx.date}
                      </td>

                      {/* Merchant */}
                      <td className="p-3 max-w-[220px]">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {tx.merchant}
                        </p>
                        {tx.notes && tx.notes !== tx.merchant && (
                          <p className="text-[10px] text-slate-400 truncate max-w-[200px]" title={tx.notes}>
                            {tx.notes}
                          </p>
                        )}
                      </td>

                      {/* Ref.No */}
                      <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                        {tx.refNo ? (
                          <span
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-brand-700 dark:text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20"
                            title={`Reference: ${tx.refNo}`}
                          >
                            <Hash className="w-2.5 h-2.5 text-brand-500" />
                            {tx.refNo}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                        )}
                      </td>

                      {/* Category selector with auto-type indicator */}
                      <td className="p-3 min-w-[180px]">
                        <CategorySelect
                          categories={categories}
                          value={tx.category || 'Other'}
                          onChange={(value) => updateRowCategory(tx.id, value)}
                          valueMode="name"
                          grouped
                          size="sm"
                          typeFilter={tx.type}
                          triggerClassName="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:border-brand-400 focus-visible:ring-1 focus-visible:ring-brand-500 shadow-2xs"
                          title="Map this statement row to a category"
                        />
                      </td>

                      {/* Type toggle */}
                      <td className="p-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleRowType(tx.id)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold capitalize transition-colors ${
                            tx.type === 'income'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                              : tx.type === 'transfer'
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                          }`}
                          title="Click to toggle between Expense, Income and Transfer"
                        >
                          {tx.type}
                        </button>
                      </td>

                      {/* Amount with exact decimals */}
                      <td
                        className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                          tx.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'transfer'
                            ? 'text-sky-600 dark:text-sky-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {formatINR(tx.amount)}
                      </td>

                      {/* Payment Method */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          {tx.payment_method}
                        </span>
                      </td>

                      {/* Delete */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => removeRow(tx.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={resetState}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Choose Different File
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <Button variant="outline" size="sm" onClick={handleModalClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={selectedTransactions.length === 0}
                  isLoading={isImporting}
                  onClick={handleImportConfirmed}
                  leftIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Import {selectedTransactions.length} Transactions
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
