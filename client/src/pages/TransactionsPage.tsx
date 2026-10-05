import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus,
  Search,
  Download,
  Upload,
  Trash2,
  Tag,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Mail,
  UserRound,
  Hash,
  Edit3,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import {
  fetchTransactionsThunk,
  setFilters,
  resetFilters,
  toggleSelectId,
  selectAllIds,
  bulkDeleteThunk,
  bulkCategorizeThunk,
  deleteTransactionThunk,
} from '../store/slices/transactionSlice.js';
import { fetchCategoriesThunk } from '../store/slices/categorySlice.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Modal } from '../components/ui/Modal.js';
import { CategoryBadge } from '../components/ui/CategoryBadge.js';
import { CategoryIconBox } from '../components/ui/CategoryIconBox.js';
import { resolveCategoryMeta } from '../constants/categories.js';
import { CategorySelect } from '../components/ui/CategorySelect.js';
import { TableRowSkeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { formatINR, formatDate } from '../utils/format.js';
import { TransactionModal } from '../features/transactions/TransactionModal.js';
import { TransactionDrawer } from '../features/transactions/TransactionDrawer.js';
import { StatementImportModal } from '../features/importExport/StatementImportModal.js';
import { Transaction } from '../types/index.js';
import { AgGridTable } from '../components/ui/AgGridTable.js';
import type { ColDef } from 'ag-grid-community';
import type { CustomCellRendererProps } from 'ag-grid-react';
import { api } from '../services/api.js';
import { toast } from '../components/ui/Toast.js';

export const TransactionsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { transactions, total, page, totalPages, filters, selectedIds, loading } =
    useAppSelector((state) => state.transactions);
  const categories = useAppSelector((state) => state.categories.categories);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isCategorizeModalOpen, setIsCategorizeModalOpen] = useState(false);
  const [selectedBulkCategory, setSelectedBulkCategory] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('import') === 'true') {
      setIsImportModalOpen(true);
    }
  }, [location.search]);

  useEffect(() => {
    dispatch(fetchTransactionsThunk(undefined));
    dispatch(fetchCategoriesThunk());
  }, [dispatch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setFilters({ search: e.target.value }));
    dispatch(fetchTransactionsThunk({ search: e.target.value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      dispatch(setFilters({ page: newPage }));
      dispatch(fetchTransactionsThunk({ page: newPage }));
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.type) params.append('type', filters.type);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const res = await api.get(`/transactions/export?${params.toString()}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `spendwise-transactions-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Transactions CSV exported successfully');
    } catch (err: any) {
      console.error('Export CSV error:', err);
      toast.error(err?.response?.data?.message || 'Failed to export transactions CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.length} transactions?`)) {
      dispatch(bulkDeleteThunk(selectedIds));
    }
  };

  const handleConfirmBulkCategorize = () => {
    if (!selectedBulkCategory) return;
    dispatch(
      bulkCategorizeThunk({ ids: selectedIds, categoryId: selectedBulkCategory })
    );
    setIsCategorizeModalOpen(false);
  };

  const handleDeleteSingle = (id: string) => {
    if (confirm('Delete this transaction?')) {
      dispatch(deleteTransactionThunk(id));
      setSelectedTx(null);
    }
  };

  const bulkTypeFilter = useMemo(() => {
    const selectedTxs = transactions.filter((t) => selectedIds.includes(t._id));
    if (selectedTxs.length === 0) return 'all';
    const firstType = selectedTxs[0].type;
    const allSame = selectedTxs.every((t) => t.type === firstType);
    if (allSame && (firstType === 'expense' || firstType === 'income' || firstType === 'transfer')) {
      return firstType;
    }
    return 'all';
  }, [transactions, selectedIds]);

  const isAllSelected =
    transactions.length > 0 && selectedIds.length === transactions.length;

  const rowClassRules = useMemo(
    () => ({
      'bg-brand-500/10 dark:bg-brand-950/20 font-medium': (params: any) =>
        Boolean(params.data && selectedIds.includes(params.data._id)),
    }),
    [selectedIds]
  );

  const columnDefs = useMemo<ColDef<Transaction>[]>(() => {
    return [
      {
        colId: 'select',
        field: '_id',
        headerName: '',
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        sortable: false,
        resizable: false,
        suppressMovable: true,
        headerComponent: () => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={(e) => dispatch(selectAllIds(e.target.checked))}
              className="rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 cursor-pointer"
              aria-label="Select all transactions"
            />
          </div>
        ),
        cellRenderer: (params: CustomCellRendererProps<Transaction>) => {
          const tx = params.data;
          if (!tx) return null;
          const isSelected = selectedIds.includes(tx._id);
          return (
            <div
              className="flex items-center justify-center w-full h-full cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                dispatch(toggleSelectId(tx._id));
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(toggleSelectId(tx._id));
                }}
                className="rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 cursor-pointer"
                aria-label={`Select transaction ${tx.merchant}`}
              />
            </div>
          );
        },
      },
      {
        field: 'merchant',
        headerName: 'Merchant / Description',
        flex: 2.2,
        minWidth: 260,
        comparator: (a, b) => (a || '').localeCompare(b || ''),
        cellRenderer: (params: CustomCellRendererProps<Transaction>) => {
          const tx = params.data;
          if (!tx) return null;

          return (
            <div className="flex items-center gap-3 py-1 min-w-0 h-full">
              <CategoryIconBox category={tx.categoryId} categories={categories} size="md" />
              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block truncate tracking-tight text-xs sm:text-sm">
                    {tx.merchant}
                  </span>
                  {tx.personId && typeof tx.personId === 'object' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">
                      <UserRound className="w-2.5 h-2.5" />
                      {tx.personId.name}
                    </span>
                  )}
                </div>
                {tx.vpa && (
                  <span className="text-[11px] font-mono text-slate-400 truncate block mt-0.5">
                    VPA: {tx.vpa}
                  </span>
                )}
                {tx.notes && tx.notes !== tx.merchant && (
                  <span className="text-[11px] text-slate-400 truncate block mt-0.5 font-normal">
                    {tx.notes}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        headerName: 'Category',
        valueGetter: (params) => {
          const catMeta = resolveCategoryMeta(params.data?.categoryId, categories);
          return catMeta.name;
        },
        flex: 1.2,
        minWidth: 150,
        cellRenderer: (params: CustomCellRendererProps<Transaction>) => {
          if (!params.data) return null;
          return (
            <div className="flex items-center h-full w-full">
              <CategoryBadge category={params.data.categoryId} categories={categories} size="sm" />
            </div>
          );
        },
      },
      {
        headerName: 'Ref.No',
        field: 'refNo',
        valueGetter: (params) => params.data?.refNo || params.data?.externalTransactionId || '',
        flex: 1.1,
        minWidth: 140,
        cellRenderer: (params: CustomCellRendererProps<Transaction>) => {
          const ref = params.data?.refNo || params.data?.externalTransactionId;
          if (!ref) {
            return (
              <div className="flex items-center h-full w-full">
                <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">-</span>
              </div>
            );
          }
          return (
            <div className="flex items-center h-full w-full">
              <span
                className="inline-flex items-center gap-1 font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/90 px-2 py-0.5 rounded-lg border border-slate-200/70 dark:border-slate-700/70 hover:border-brand-500/40 transition-colors"
                title={`Reference: ${ref}`}
              >
                <Hash className="w-3 h-3 text-brand-500 flex-shrink-0" />
                <span className="truncate max-w-[130px]">{ref}</span>
              </span>
            </div>
          );
        },
      },
      {
        headerName: 'Method & Date',
        field: 'transactionDate',
        flex: 1.3,
        minWidth: 150,
        comparator: (a, b) => new Date(a || 0).getTime() - new Date(b || 0).getTime(),
        cellRenderer: (params: CustomCellRendererProps<Transaction>) => {
          const tx = params.data;
          if (!tx) return null;
          return (
            <div className="flex flex-col justify-center leading-tight h-full">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                <span>{tx.paymentMethod}</span>
                {tx.source === 'email' && (
                  <span title="Synced from Email" className="text-brand-600 dark:text-brand-400">
                    <Mail className="w-3.5 h-3.5 inline" />
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5 font-medium">
                {formatDate(tx.transactionDate, 'dd MMM yyyy')}
              </span>
            </div>
          );
        },
      },
      {
        field: 'amount',
        headerName: 'Amount',
        width: 140,
        minWidth: 130,
        comparator: (a, b) => (Number(a) || 0) - (Number(b) || 0),
        cellClass: 'ag-cell-right',
        headerClass: 'ag-right-aligned-header',
        cellRenderer: (params: CustomCellRendererProps<Transaction>) => {
          const tx = params.data;
          if (!tx) return null;
          const isExpense = tx.type === 'expense';
          return (
            <div className="flex items-center justify-end w-full h-full font-extrabold text-sm sm:text-base font-mono tabular-financial">
              <span className={isExpense ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}>
                {isExpense ? '-' : '+'}
                {formatINR(tx.amount)}
              </span>
            </div>
          );
        },
      },
      {
        colId: 'actions',
        headerName: 'Actions',
        field: '_id' as any,
        width: 100,
        minWidth: 90,
        maxWidth: 110,
        sortable: false,
        resizable: false,
        suppressMovable: true,
        cellClass: 'ag-cell-center',
        headerClass: 'ag-center-aligned-header',
        cellRenderer: (params: CustomCellRendererProps<Transaction>) => {
          const tx = params.data;
          if (!tx) return null;
          return (
            <div className="flex items-center justify-center gap-1.5 w-full h-full">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTx(tx);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-500/10 dark:text-slate-400 dark:hover:text-brand-400 dark:hover:bg-brand-500/20 transition-colors"
                title="Edit Transaction"
                aria-label={`Edit ${tx.merchant}`}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSingle(tx._id);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-500/20 transition-colors"
                title="Delete Transaction"
                aria-label={`Delete ${tx.merchant}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        },
      },
    ];
  }, [dispatch, isAllSelected, selectedIds]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Transactions Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Browse, search, categorize, and export your entire financial history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => setIsImportModalOpen(true)}
            title="Import bank statements in PDF, Excel (XLSX/XLS), CSV, or TXT"
          >
            Import Statement
          </Button>

          <Button
            size="sm"
            variant="outline"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
            isLoading={isExporting}
          >
            Export CSV
          </Button>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          {/* Search Field */}
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 text-slate-400 group-focus-within:text-brand-500 absolute left-3.5 top-3 pointer-events-none transition-colors" />
            <input
              type="text"
              value={filters.search}
              onChange={handleSearchChange}
              placeholder="Search merchant, Ref.No, notes, UPI UTR..."
              className="w-full bg-slate-100/80 dark:bg-slate-800/80 text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl border border-transparent focus:border-brand-500/50 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-[border-color,background-color,box-shadow] duration-150 ease-out-expo placeholder:text-slate-400 shadow-2xs"
            />
          </div>

          {/* Quick Filter Selects */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 custom-scrollbar">
            {/* Category Filter */}
            <CategorySelect
              categories={categories}
              value={filters.categoryId || ''}
              onChange={(value) => {
                dispatch(setFilters({ categoryId: value }));
                dispatch(fetchTransactionsThunk({ categoryId: value, page: 1 }));
              }}
              placeholder="All Categories"
              grouped
              size="sm"
              className="min-w-[190px] flex-shrink-0"
              typeFilter={
                filters.type === 'expense'
                  ? 'expense'
                  : filters.type === 'income'
                  ? 'income'
                  : filters.type === 'transfer'
                  ? 'transfer'
                  : 'all'
              }
              triggerClassName="w-full px-3 py-2 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200/60 dark:border-white/5 focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 text-slate-700 dark:text-slate-200 font-semibold shadow-2xs"
            />

            {/* Type Filter */}
            <select
              value={filters.type || ''}
              onChange={(e) => {
                const nextType = e.target.value;
                const currentCat = categories.find((c) => c._id === filters.categoryId);
                const isMismatch =
                  Boolean(nextType) &&
                  Boolean(currentCat) &&
                  currentCat?.type !== nextType &&
                  currentCat?.type !== 'both';

                const newFilters: Record<string, string> = { type: nextType };
                if (isMismatch) {
                  newFilters.categoryId = '';
                }
                dispatch(setFilters(newFilters));
                dispatch(fetchTransactionsThunk({ ...newFilters, page: 1 }));
              }}
              className="text-xs py-2 px-3 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200/60 dark:border-white/5 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-700 dark:text-slate-200 font-semibold shadow-2xs flex-shrink-0"
            >
              <option value="">All Types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>

            {/* Payment Method Filter */}
            <select
              value={filters.paymentMethod || ''}
              onChange={(e) => {
                dispatch(setFilters({ paymentMethod: e.target.value }));
                dispatch(fetchTransactionsThunk({ paymentMethod: e.target.value, page: 1 }));
              }}
              className="text-xs py-2 px-3 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200/60 dark:border-white/5 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-700 dark:text-slate-200 font-semibold shadow-2xs"
            >
              <option value="">All Methods</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank">Bank / Net Banking</option>
              <option value="cash">Cash</option>
            </select>

            {/* Sort Order */}
            <select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-') as any;
                dispatch(setFilters({ sortBy, sortOrder }));
                dispatch(fetchTransactionsThunk({ sortBy, sortOrder, page: 1 }));
              }}
              className="text-xs py-2 px-3 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200/60 dark:border-white/5 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-700 dark:text-slate-200 font-semibold shadow-2xs"
            >
              <option value="transactionDate-desc">Latest First</option>
              <option value="transactionDate-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
            </select>

            {(filters.search || filters.categoryId || filters.type || filters.paymentMethod) && (
              <button
                onClick={() => {
                  dispatch(resetFilters());
                  dispatch(fetchTransactionsThunk({ page: 1 }));
                }}
                className="text-xs text-rose-500 hover:text-rose-600 font-bold whitespace-nowrap px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Bulk Action Bar (if items selected) */}
        {selectedIds.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-brand-500/10 dark:bg-brand-950/40 p-3 rounded-xl border border-brand-500/20 animate-in fade-in">
            <span className="text-xs font-extrabold text-brand-900 dark:text-brand-200">
              {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
            </span>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Tag className="w-3.5 h-3.5" />}
                onClick={() => setIsCategorizeModalOpen(true)}
              >
                Categorize
              </Button>
              <Button
                size="sm"
                variant="danger"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={handleBulkDelete}
              >
                Delete Selected
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Transactions Ledger Card */}
      <Card className="p-0 overflow-hidden shadow-fintech">
        {loading && transactions.length === 0 ? (
          <div className="p-4 space-y-2">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-8 h-8 text-slate-400" />}
            title="No transactions found"
            description="Try changing your search filters or record a new transaction to start tracking."
            actionText="Add your first transaction"
            onAction={() => setIsAddModalOpen(true)}
            className="border-none py-16"
          />
        ) : (
          <>
            {/* Desktop Table View powered by AgGridTable */}
            <div className="hidden md:block">
              <AgGridTable<Transaction>
                rowData={transactions}
                columnDefs={columnDefs}
                domLayout="autoHeight"
                onCellClicked={(event) => {
                  const colId = event.column?.getColId();
                  if (colId === 'select' || colId === 'actions' || colId === '_id') {
                    return;
                  }
                  const target = event.event?.target as HTMLElement | null;
                  if (target?.closest('input, button, a')) {
                    return;
                  }
                  if (event.data) setSelectedTx(event.data);
                }}
                rowClassRules={rowClassRules}
              />
            </div>

            {/* Mobile Stacked Card View (transformed for mobile, no horizontal scrolling!) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
              {transactions.map((tx) => {
                const isExpense = tx.type === 'expense';
                const isSelected = selectedIds.includes(tx._id);

                return (
                  <div
                    key={tx._id}
                    onClick={(e) => {
                      const target = e.target as HTMLElement | null;
                      if (target?.closest('input, button, a')) return;
                      setSelectedTx(tx);
                    }}
                    className={`p-4 flex items-center justify-between gap-3 active:bg-slate-50 dark:active:bg-slate-800/60 transition-colors ${
                      isSelected ? 'bg-brand-500/10 dark:bg-brand-950/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch(toggleSelectId(tx._id));
                        }}
                        className="pr-1 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch(toggleSelectId(tx._id));
                          }}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </div>

                      <CategoryIconBox category={tx.categoryId} categories={categories} size="lg" />

                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white truncate text-xs sm:text-sm tracking-tight">
                          {tx.merchant}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400 flex-wrap">
                          <span>{formatDate(tx.transactionDate, 'dd MMM')}</span>
                          <span>•</span>
                          <CategoryBadge category={tx.categoryId} categories={categories} size="xs" />
                          {(tx.refNo || tx.externalTransactionId) && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-brand-600 dark:text-brand-400 truncate max-w-[110px]" title={tx.refNo || tx.externalTransactionId}>
                                #{tx.refNo || tx.externalTransactionId}
                              </span>
                            </>
                          )}
                        </div>
                        {tx.notes && (
                          <span className="text-[11px] text-slate-400 truncate block mt-0.5 font-normal">
                            {tx.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <div className="text-right">
                        <span
                          className={`text-sm font-extrabold font-mono tabular-financial block ${
                            isExpense
                              ? 'text-slate-900 dark:text-white'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isExpense ? '-' : '+'}
                          {formatINR(tx.amount)}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mt-0.5 block">
                          {tx.paymentMethod}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTx(tx);
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-brand-600 hover:bg-brand-500/10 dark:hover:text-brand-400 dark:hover:bg-brand-500/20 transition-colors border border-slate-200/60 dark:border-slate-800"
                        title="Edit Transaction"
                        aria-label={`Edit ${tx.merchant}`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>
              Showing page {page} of {totalPages} ({total} total transactions)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Bulk Categorize Modal */}
      {isCategorizeModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCategorizeModalOpen(false)}
          title={`Categorize ${selectedIds.length} Transactions`}
          description="Select a target category to apply to all selected items."
        >
          <div className="space-y-4">
            <CategorySelect
              categories={categories}
              value={selectedBulkCategory}
              onChange={setSelectedBulkCategory}
              placeholder="Select Category..."
              grouped
              typeFilter={bulkTypeFilter}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCategorizeModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedBulkCategory}
                onClick={handleConfirmBulkCategorize}
              >
                Apply Category
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Transaction Entry Modal */}
      <TransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Statement Import Modal (PDF, Excel, CSV, TXT) */}
      <StatementImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Transaction Details Drawer */}
      <TransactionDrawer
        transaction={selectedTx}
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        onDelete={handleDeleteSingle}
        onEdit={(tx) => {
          setSelectedTx(null);
          setEditingTx(tx);
        }}
      />

      {/* Edit Transaction Modal */}
      {editingTx && (
        <TransactionModal
          isOpen={true}
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSuccess={() => {
            dispatch(fetchTransactionsThunk(undefined));
          }}
        />
      )}
    </div>
  );
};
