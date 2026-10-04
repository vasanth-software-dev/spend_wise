import React, { useState, useEffect } from 'react';
import { Check, X, Copy, Mail, Sparkles, Edit2, Tag, Save, CheckCheck, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/index.js';
import {
  confirmDetectedThunk,
  rejectDetectedThunk,
  markDuplicateDetectedThunk,
  updateDetectedThunk,
  confirmAllDetectedThunk,
  rejectAllDetectedThunk,
} from '../../store/slices/detectedTransactionSlice.js';
import { fetchCategoriesThunk } from '../../store/slices/categorySlice.js';
import { formatINR, formatDate, getConfidenceBadge } from '../../utils/format.js';
import { Button } from '../../components/ui/Button.js';
import { Modal } from '../../components/ui/Modal.js';
import { Input } from '../../components/ui/Input.js';
import { CategorySelect } from '../../components/ui/CategorySelect.js';
import { toast } from '../../components/ui/Toast.js';
import { DetectedTransaction } from '../../types/index.js';

export const DetectedTransactionReviewCenter: React.FC = () => {
  const dispatch = useAppDispatch();
  const { pendingTransactions, actionLoading, bulkConfirmLoading, bulkRejectLoading } = useAppSelector(
    (state) => state.detectedTransactions
  );
  const categories = useAppSelector((state) => state.categories.categories);

  const [editingItem, setEditingItem] = useState<DetectedTransaction | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [editMerchant, setEditMerchant] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Ensure categories are loaded so dropdowns are always populated
  useEffect(() => {
    if (categories.length === 0) {
      dispatch(fetchCategoriesThunk());
    }
  }, [dispatch, categories.length]);

  const getSelectedCategoryId = (tx: DetectedTransaction): string => {
    if (tx.categoryId) return String(tx.categoryId);
    if (tx.suggestedCategory && categories.length > 0) {
      const match = categories.find(
        (c) =>
          c.name.toLowerCase() === tx.suggestedCategory?.toLowerCase() ||
          c.name.toLowerCase().includes(tx.suggestedCategory?.toLowerCase() || '')
      );
      if (match) return match._id;
    }
    if (categories.length > 0) {
      const matchMerchant = categories.find((c) =>
        c.name.toLowerCase().includes(tx.merchant.toLowerCase())
      );
      if (matchMerchant) return matchMerchant._id;
    }
    return '';
  };

  const handleOpenEdit = (item: DetectedTransaction) => {
    setEditingItem(item);
    setEditMerchant(item.merchant);
    setEditAmount(String(item.amount));
    setEditNotes('');
    setEditCategory(getSelectedCategoryId(item));
  };

  const handleInlineCategoryChange = async (tx: DetectedTransaction, catId: string) => {
    const selected = categories.find((c) => c._id === catId);
    await dispatch(
      updateDetectedThunk({
        id: tx._id,
        updates: {
          categoryId: catId || null,
          suggestedCategory: selected ? selected.name : undefined,
        },
      })
    );
  };

  const handleSaveEditOnly = async () => {
    if (!editingItem) return;
    setIsSaving(true);
    try {
      const selected = categories.find((c) => c._id === editCategory);
      await dispatch(
        updateDetectedThunk({
          id: editingItem._id,
          updates: {
            merchant: editMerchant,
            amount: parseFloat(editAmount) || editingItem.amount,
            categoryId: editCategory || null,
            suggestedCategory: selected ? selected.name : undefined,
          },
        })
      ).unwrap();
      setEditingItem(null);
    } catch (err) {
      console.error('Failed to update detected transaction:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmEdit = async () => {
    if (!editingItem) return;
    setIsSaving(true);
    try {
      await dispatch(
        confirmDetectedThunk({
          id: editingItem._id,
          overrides: {
            merchant: editMerchant,
            amount: parseFloat(editAmount) || editingItem.amount,
            categoryId: editCategory || undefined,
            notes: editNotes || undefined,
          },
        })
      ).unwrap();
      setEditingItem(null);
    } catch (err) {
      console.error('Failed to confirm detected transaction:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmCard = (tx: DetectedTransaction) => {
    const catId = getSelectedCategoryId(tx);
    dispatch(
      confirmDetectedThunk({
        id: tx._id,
        overrides: catId ? { categoryId: catId } : undefined,
      })
    );
  };

  const handleClearAll = async () => {
    try {
      await dispatch(rejectAllDetectedThunk(undefined)).unwrap();
      toast.success('Cleared all detected transactions');
      setShowClearModal(false);
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'Failed to clear transactions');
    }
  };

  const handleAcceptAll = async () => {
    try {
      const items = pendingTransactions.map((tx) => ({
        id: tx._id,
        categoryId: getSelectedCategoryId(tx) || undefined,
      }));
      await dispatch(confirmAllDetectedThunk(items)).unwrap();
      toast.success(`Accepted all ${pendingTransactions.length} transactions`);
      setShowAcceptModal(false);
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'Failed to accept all transactions');
    }
  };

  if (pendingTransactions.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-brand-900/10 via-emerald-900/5 to-slate-900/10 dark:from-brand-950/40 dark:to-slate-900/40 border border-brand-500/30 rounded-2xl p-5 sm:p-6 mb-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-200/40 dark:border-brand-900/40">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-brand-500 text-white shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Transaction Review Center
              <span className="bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingTransactions.length} pending
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Transactions auto-discovered from your email inbox. Select category and confirm to add to your ledger.
            </p>
          </div>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Trash2 className="w-4 h-4 text-rose-500" />}
            onClick={() => setShowClearModal(true)}
            disabled={bulkRejectLoading || bulkConfirmLoading}
            className="hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800"
          >
            Clear All
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<CheckCheck className="w-4 h-4" />}
            onClick={() => setShowAcceptModal(true)}
            disabled={bulkConfirmLoading || bulkRejectLoading}
            isLoading={bulkConfirmLoading}
          >
            Accept All ({pendingTransactions.length})
          </Button>
        </div>
      </div>

      {/* Detected Transactions List */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingTransactions.map((tx) => {
          const confidence = getConfidenceBadge(tx.confidenceScore);
          const isBusy = actionLoading[tx._id];
          const selectedCatId = getSelectedCategoryId(tx);

          return (
            <div
              key={tx._id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-subtle flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      {tx.transactionType}
                    </span>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatINR(tx.amount)}
                    </h4>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {tx.merchant}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${confidence.color}`}
                  >
                    {confidence.label}
                  </span>
                </div>

                {/* Editable Category Selector directly on the card */}
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-brand-500" />
                    Category:
                  </span>
                  <CategorySelect
                    categories={categories}
                    value={selectedCatId}
                    onChange={(value) => handleInlineCategoryChange(tx, value)}
                    grouped
                    placeholder="Uncategorized / Other"
                    className="flex-1 min-w-0"
                    size="sm"
                    typeFilter={tx.transactionType === 'income' ? 'income' : 'expense'}
                    triggerClassName="w-full py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 hover:border-brand-400 focus-visible:ring-1 focus-visible:ring-brand-500 transition-colors shadow-2xs"
                    title="Change category for this transaction"
                  />
                </div>

                <div className="mt-3 text-xs space-y-1 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{tx.subject}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span>{formatDate(tx.transactionDate, 'dd MMM yyyy, h:mm a')}</span>
                    {tx.upiReference && (
                      <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">
                        Ref: {tx.upiReference}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={isBusy}
                    onClick={() => dispatch(rejectDetectedThunk(tx._id))}
                    title="Ignore"
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    disabled={isBusy}
                    onClick={() => dispatch(markDuplicateDetectedThunk(tx._id))}
                    title="Mark as duplicate"
                    className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-medium transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    disabled={isBusy}
                    onClick={() => handleOpenEdit(tx)}
                    title="Edit all fields"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  isLoading={isBusy}
                  leftIcon={<Check className="w-4 h-4" />}
                  onClick={() => handleConfirmCard(tx)}
                  className="px-3"
                >
                  Confirm
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Detected Modal */}
      {editingItem && (
        <Modal
          isOpen={true}
          onClose={() => setEditingItem(null)}
          title="Edit & Confirm Transaction"
          description="Adjust details before recording in your financial ledger."
        >
          <div className="space-y-3.5">
            <Input
              label="Merchant / Payee"
              value={editMerchant}
              onChange={(e) => setEditMerchant(e.target.value)}
            />
            <Input
              label="Amount (INR)"
              type="number"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
            />
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Category
                </label>
                <span className="text-[11px] text-slate-400">Choose or change category</span>
              </div>
              <CategorySelect
                categories={categories}
                value={editCategory}
                onChange={setEditCategory}
                placeholder="Select Category..."
                grouped
                typeFilter={editingItem.transactionType === 'income' ? 'income' : 'expense'}
              />
            </div>
            <Input
              label="Notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Add optional notes"
            />
            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setEditingItem(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Save className="w-3.5 h-3.5" />}
                onClick={handleSaveEditOnly}
                isLoading={isSaving}
              >
                Save Details
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Check className="w-3.5 h-3.5" />}
                onClick={handleConfirmEdit}
                isLoading={isSaving}
              >
                Confirm &amp; Add
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear All Confirmation Modal */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear All Detected Transactions"
        description="Are you sure you want to dismiss all pending transactions? They will be ignored and won't be added to your ledger."
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This will dismiss <strong>{pendingTransactions.length}</strong> pending transaction{pendingTransactions.length === 1 ? '' : 's'}. You can still sync again later if needed.
          </p>
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearModal(false)}
              disabled={bulkRejectLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="w-4 h-4" />}
              onClick={handleClearAll}
              isLoading={bulkRejectLoading}
            >
              Clear All ({pendingTransactions.length})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Accept All Confirmation Modal */}
      <Modal
        isOpen={showAcceptModal}
        onClose={() => setShowAcceptModal(false)}
        title="Accept All Detected Transactions"
        description="Confirm and record all pending transactions into your ledger."
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This will record <strong>{pendingTransactions.length}</strong> transaction{pendingTransactions.length === 1 ? '' : 's'} into your accounts with their currently selected categories.
          </p>
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAcceptModal(false)}
              disabled={bulkConfirmLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<CheckCheck className="w-4 h-4" />}
              onClick={handleAcceptAll}
              isLoading={bulkConfirmLoading}
            >
              Accept All ({pendingTransactions.length})
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
