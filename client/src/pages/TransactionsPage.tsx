import React, { useEffect, useState } from 'react';
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
import { CategoryIcon } from '../components/ui/CategoryIcon.js';
import { TableRowSkeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { formatINR, formatDate } from '../utils/format.js';
import { TransactionModal } from '../features/transactions/TransactionModal.js';
import { TransactionDrawer } from '../features/transactions/TransactionDrawer.js';
import { CSVImportModal } from '../features/importExport/CSVImportModal.js';
import { Transaction } from '../types/index.js';

export const TransactionsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { transactions, total, page, totalPages, filters, selectedIds, loading } =
    useAppSelector((state) => state.transactions);
  const categories = useAppSelector((state) => state.categories.categories);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isCategorizeModalOpen, setIsCategorizeModalOpen] = useState(false);
  const [selectedBulkCategory, setSelectedBulkCategory] = useState('');

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

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.categoryId) params.append('categoryId', filters.categoryId);
    if (filters.type) params.append('type', filters.type);
    window.open(`/api/v1/transactions/export?${params.toString()}`, '_blank');
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

  const isAllSelected =
    transactions.length > 0 && selectedIds.length === transactions.length;

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
          >
            Import CSV
          </Button>

          <Button
            size="sm"
            variant="outline"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={filters.search}
              onChange={handleSearchChange}
              placeholder="Search merchant, notes, UPI UTR..."
              className="w-full bg-slate-100 dark:bg-slate-800 text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-colors"
            />
          </div>

          {/* Quick Filter Selects */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {/* Category Filter */}
            <select
              value={filters.categoryId || ''}
              onChange={(e) => {
                dispatch(setFilters({ categoryId: e.target.value }));
                dispatch(fetchTransactionsThunk({ categoryId: e.target.value, page: 1 }));
              }}
              className="text-xs py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={filters.type || ''}
              onChange={(e) => {
                dispatch(setFilters({ type: e.target.value }));
                dispatch(fetchTransactionsThunk({ type: e.target.value, page: 1 }));
              }}
              className="text-xs py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-300 font-medium"
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
              className="text-xs py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-300 font-medium"
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
              className="text-xs py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-300 font-medium"
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
                className="text-xs text-rose-500 hover:underline font-semibold whitespace-nowrap px-2"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Bulk Action Bar (if items selected) */}
        {selectedIds.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-brand-50/60 dark:bg-brand-950/40 p-3 rounded-xl">
            <span className="text-xs font-bold text-brand-900 dark:text-brand-200">
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

      {/* Transactions Table Card */}
      <Card className="p-0 overflow-hidden">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => dispatch(selectAllIds(e.target.checked))}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                  </th>
                  <th className="py-3 px-4">Merchant / Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Method & Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {transactions.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  const cat =
                    typeof tx.categoryId === 'object' && tx.categoryId !== null
                      ? tx.categoryId
                      : null;
                  const isSelected = selectedIds.includes(tx._id);

                  return (
                    <tr
                      key={tx._id}
                      onClick={() => setSelectedTx(tx)}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        isSelected ? 'bg-brand-50/30 dark:bg-brand-950/20' : ''
                      }`}
                    >
                      <td
                        className="py-3.5 px-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch(toggleSelectId(tx._id));
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isExpense
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                            }`}
                          >
                            <CategoryIcon name={cat?.icon || 'Tag'} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                              {tx.merchant}
                            </span>
                            {tx.notes && (
                              <span className="text-[11px] text-slate-400 truncate block">
                                {tx.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {cat?.name || 'Uncategorized'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold uppercase">
                          <span>{tx.paymentMethod}</span>
                          {tx.source === 'email' && (
                            <span
                              title="Synced from Email"
                              className="text-brand-600 dark:text-brand-400"
                            >
                              <Mail className="w-3.5 h-3.5 inline" />
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {formatDate(tx.transactionDate, 'dd MMM yyyy')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-extrabold text-sm sm:text-base">
                        <span
                          className={
                            isExpense
                              ? 'text-slate-900 dark:text-slate-100'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {isExpense ? '-' : '+'}
                          {formatINR(tx.amount)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {page} of {totalPages} ({total} total transactions)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
            <select
              value={selectedBulkCategory}
              onChange={(e) => setSelectedBulkCategory(e.target.value)}
              className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
            >
              <option value="">Select Category...</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
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

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Transaction Details Drawer */}
      <TransactionDrawer
        transaction={selectedTx}
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        onDelete={handleDeleteSingle}
      />
    </div>
  );
};
