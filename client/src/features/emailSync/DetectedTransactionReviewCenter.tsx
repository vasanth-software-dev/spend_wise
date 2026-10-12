import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  X,
  Copy,
  Mail,
  Edit2,
  Tag,
  Save,
  CheckCheck,
  Trash2,
  MailCheck,
  SlidersHorizontal,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/index.js';
import {
  confirmDetectedThunk,
  rejectDetectedThunk,
  markDuplicateDetectedThunk,
  updateDetectedThunk,
  confirmAllDetectedThunk,
  rejectAllDetectedThunk,
  fetchPendingDetectedThunk,
} from '../../store/slices/detectedTransactionSlice.js';
import {
  fetchAccountsThunk,
  syncAccountThunk,
  simulateInboundThunk,
} from '../../store/slices/emailAccountSlice.js';
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
  const navigate = useNavigate();
  const { pendingTransactions, actionLoading, bulkConfirmLoading, bulkRejectLoading } = useAppSelector(
    (state) => state.detectedTransactions
  );
  const { accounts, isSyncing } = useAppSelector((state) => state.emailAccounts);
  const categories = useAppSelector((state) => state.categories.categories);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [editingItem, setEditingItem] = useState<DetectedTransaction | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [editMerchant, setEditMerchant] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Quick simulator state inside settings modal
  const [simTemplate, setSimTemplate] = useState('gpay_swiggy');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Ensure categories and accounts are loaded
  useEffect(() => {
    if (categories.length === 0) {
      dispatch(fetchCategoriesThunk());
    }
    dispatch(fetchAccountsThunk());
  }, [dispatch, categories.length]);

  // Only display review center when there are actual detected transactions requiring review
  if (pendingTransactions.length === 0) {
    return null;
  }

  const activeItems = pendingTransactions;
  const flaggedCount = activeItems.length;
  const autoCategorizedCount = activeItems.filter(
    (tx) => Boolean(tx.suggestedCategory || tx.categoryId)
  ).length;

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

  const handleRejectCard = (tx: DetectedTransaction) => {
    dispatch(rejectDetectedThunk(tx._id));
  };

  const handleDuplicateCard = (tx: DetectedTransaction) => {
    dispatch(markDuplicateDetectedThunk(tx._id));
  };

  const handleClearAll = async () => {
    try {
      await dispatch(rejectAllDetectedThunk(undefined)).unwrap();
      toast.success('Cleared all detected transactions');
      setShowClearModal(false);
      setIsExpanded(false);
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
      toast.success(`Accepted all ${flaggedCount} transactions`);
      setShowAcceptModal(false);
      setIsExpanded(false);
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'Failed to accept all transactions');
    }
  };

  // Dynamic sync calculation
  const latestSyncDate = useMemo(() => {
    const dates = accounts
      .map((a) => a.lastSyncAt)
      .filter(Boolean)
      .map((d) => new Date(d!).getTime());
    return dates.length > 0 ? new Date(Math.max(...dates)) : null;
  }, [accounts]);

  const isAnySyncing = useMemo(() => {
    return isManualSyncing || Object.values(isSyncing).some(Boolean);
  }, [isManualSyncing, isSyncing]);

  const syncTimeBadgeText = useMemo(() => {
    if (isAnySyncing) return 'Syncing...';
    if (!latestSyncDate) return 'Live Sync Active';
    const diffSec = Math.floor((Date.now() - latestSyncDate.getTime()) / 1000);
    if (diffSec < 60) return 'Synced just now';
    if (diffSec < 3600) return `Synced ${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `Synced ${Math.floor(diffSec / 3600)}h ago`;
    return `Synced ${Math.floor(diffSec / 86400)}d ago`;
  }, [isAnySyncing, latestSyncDate]);

  const handleTriggerSync = async () => {
    if (accounts.length === 0) {
      toast.info('No email or sync accounts connected yet.');
      return;
    }
    setIsManualSyncing(true);
    try {
      for (const account of accounts) {
        if (account.status !== 'paused') {
          await dispatch(syncAccountThunk(account._id)).unwrap();
        }
      }
      await dispatch(fetchPendingDetectedThunk()).unwrap();
      toast.success('Sync complete. Detected transactions updated.');
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'Failed to sync transactions');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleSimulateAlert = async () => {
    const forwardingAcc = accounts.find((a) => a.provider === 'forwarding') || accounts[0];
    if (!forwardingAcc) {
      toast.error('Please configure a sync account first.');
      return;
    }
    setIsSimulating(true);
    try {
      const res = await dispatch(
        simulateInboundThunk({ accountId: forwardingAcc._id, templateKey: simTemplate })
      ).unwrap();
      toast.success(res.message || 'Simulated transaction processed successfully!');
      dispatch(fetchPendingDetectedThunk());
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden transition-all duration-200">
      {/* Main Header Row */}
      <div className="p-3.5 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        {/* Left Side: Email Icon + Title + Status Badge + Subtitle */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-[#4f46e5] dark:text-indigo-400 flex-shrink-0 shadow-2xs">
            <MailCheck className="w-5 h-5 stroke-[2.2]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Smart Bank &amp; SMS Sync
              </h3>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/60 dark:border-emerald-800/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1.5">
                {isAnySyncing ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                {syncTimeBadgeText}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {flaggedCount} incoming transaction{flaggedCount === 1 ? '' : 's'} detected from bank alerts &amp; SMS ({autoCategorizedCount} auto-categorized). Review &amp; confirm to update your balances.
            </p>
          </div>
        </div>

        {/* Right Side: Primary "Review Flagged" Button + Settings Sliders Icon Button */}
        <div className="flex items-center gap-2.5 flex-shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={() => {
              if (flaggedCount > 0) {
                setIsExpanded(!isExpanded);
              } else {
                setIsSettingsModalOpen(true);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#4f46e5] hover:bg-[#4338ca] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-2xs hover:shadow-indigo-500/25 transition-all duration-150 ease-out active:scale-[0.98] cursor-pointer"
          >
            <span>
              {flaggedCount > 0 ? `Review Flagged (${flaggedCount})` : 'All Synced'}
            </span>
            <ArrowRight
              className={`w-4 h-4 stroke-[2.5] transition-transform duration-200 ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-[background-color,border-color] duration-150 ease-out shadow-2xs cursor-pointer group"
            title="Configure Sync Engine settings &amp; status in dashboard"
            aria-label="Configure Sync Engine settings &amp; status in dashboard"
          >
            <SlidersHorizontal className="w-4 h-4 group-hover:text-[#4f46e5] dark:group-hover:text-indigo-400 transition-colors" />
          </button>
        </div>
      </div>

      {/* Expandable Review Section */}
      {isExpanded && flaggedCount > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 p-4 sm:p-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70 dark:border-slate-800">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Pending Verification ({flaggedCount})
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Confirm transactions to record them in your accounts or edit details below.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                onClick={() => setShowClearModal(true)}
                disabled={bulkRejectLoading || bulkConfirmLoading}
                className="text-xs hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800"
              >
                Clear All
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
                onClick={() => setShowAcceptModal(true)}
                disabled={bulkConfirmLoading || bulkRejectLoading}
                isLoading={bulkConfirmLoading}
                className="text-xs"
              >
                Accept All ({flaggedCount})
              </Button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activeItems.map((tx) => {
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
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          {tx.transactionType}
                        </span>
                        <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                          {formatINR(tx.amount)}
                        </h4>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {tx.merchant}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${confidence.color}`}
                      >
                        {confidence.label}
                      </span>
                    </div>

                    {/* Category Selector on the card */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-[#4f46e5]" />
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
                        triggerClassName="w-full py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 hover:border-brand-400 focus-visible:ring-1 focus-visible:ring-brand-500 transition-colors shadow-2xs text-xs"
                        title="Change category for this transaction"
                      />
                    </div>

                    <div className="mt-2.5 text-xs space-y-1 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate text-[11px]">{tx.subject}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] pt-0.5">
                        <span>{formatDate(tx.transactionDate, 'dd MMM yyyy, h:mm a')}</span>
                        {tx.upiReference && (
                          <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">
                            Ref: {tx.upiReference}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRejectCard(tx)}
                        title="Ignore transaction"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDuplicateCard(tx)}
                        title="Mark as duplicate"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleOpenEdit(tx)}
                        title="Edit all fields"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <Button
                      size="sm"
                      variant="primary"
                      isLoading={isBusy}
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                      onClick={() => handleConfirmCard(tx)}
                      className="px-3 text-xs"
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingItem(null)}
                disabled={isSaving}
              >
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
            This will dismiss <strong>{flaggedCount}</strong> pending transaction
            {flaggedCount === 1 ? '' : 's'}. You can still sync again later if needed.
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
              Clear All ({flaggedCount})
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
            This will record <strong>{flaggedCount}</strong> transaction
            {flaggedCount === 1 ? '' : 's'} into your accounts with their currently selected
            categories.
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
              Accept All ({flaggedCount})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sync Engine Settings Modal (Opens directly in Dashboard) */}
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="Sync Engine Settings & Status"
        description="Real-time transaction detection preferences, connected channels, and sync status."
      >
        <div className="space-y-4">
          {/* Status & Quick Stats */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Engine Status:
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active &amp; Monitoring
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {latestSyncDate
                    ? `Last checked: ${formatDate(latestSyncDate, 'dd MMM yyyy, h:mm a')}`
                    : 'Ready for incoming bank transactions'}
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isAnySyncing ? 'animate-spin text-brand-600' : ''}`} />}
              onClick={handleTriggerSync}
              disabled={isAnySyncing || accounts.length === 0}
              isLoading={isAnySyncing}
              className="text-xs"
            >
              Sync Now
            </Button>
          </div>

          {/* Connected Sync Accounts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Connected Inboxes &amp; Channels ({accounts.length})
              </span>
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {flaggedCount} pending review
              </span>
            </div>

            {accounts.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {accounts.map((acc) => (
                  <div
                    key={acc._id}
                    className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {acc.email || acc.forwardingAddress || 'Sync Channel'}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                          {acc.provider} &bull; {acc.status} &bull; {acc.detectedCount || 0} detected
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        acc.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                      }`}
                    >
                      {acc.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                No active sync inboxes connected yet.
              </div>
            )}
          </div>

          {/* Quick Bank Alert Test / Simulator */}
          <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
                Test Transaction Simulation
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Instantly test how SpendWise parses Indian bank SMS, UPI, or statement alerts without waiting for an actual email.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <select
                value={simTemplate}
                onChange={(e) => setSimTemplate(e.target.value)}
                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="gpay_swiggy">Swiggy ₹489 (Google Pay UPI)</option>
                <option value="hdfc_debit">HDFC Bank ₹1,250 Debit Alert</option>
                <option value="phonepe_chai">PhonePe ₹220 (Chai Point)</option>
                <option value="amazon_order">Amazon ₹1,899 Order Receipt</option>
              </select>
              <Button
                size="sm"
                variant="primary"
                isLoading={isSimulating}
                onClick={handleSimulateAlert}
                className="text-xs whitespace-nowrap"
              >
                Simulate Alert
              </Button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setIsSettingsModalOpen(false);
                navigate('/email-sync');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer"
            >
              <span>Open Full Email &amp; Statement Sync Hub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsSettingsModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
