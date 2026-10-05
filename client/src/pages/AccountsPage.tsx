import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Landmark,
  CreditCard,
  Wallet,
  TrendingUp,
  Banknote,
  Trash2,
  Edit2,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Building,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import {
  fetchAccountsThunk,
  fetchNetWorthThunk,
  createAccountThunk,
  updateAccountThunk,
  deleteAccountThunk,
} from '../store/slices/accountSlice.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { formatINR } from '../utils/format.js';
import { Account, AccountType } from '../types/index.js';

export const AccountsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const accounts = useAppSelector((state) => state.accounts.accounts);
  const netWorthSummary = useAppSelector((state) => state.accounts.netWorthSummary);
  const loading = useAppSelector((state) => state.accounts.loading);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balance, setBalance] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [accountNumberMasked, setAccountNumberMasked] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    dispatch(fetchAccountsThunk());
    dispatch(fetchNetWorthThunk());
  }, [dispatch]);

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setName('');
    setType('bank');
    setBalance('0');
    setInstitutionName('');
    setAccountNumberMasked('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setBalance(String(acc.balance));
    setInstitutionName(acc.institutionName || '');
    setAccountNumberMasked(acc.accountNumberMasked || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numBalance = parseFloat(balance);
    if (!name.trim() || isNaN(numBalance)) return;

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        await dispatch(
          updateAccountThunk({
            id: editingAccount._id,
            data: {
              name: name.trim(),
              type,
              balance: numBalance,
              institutionName: institutionName.trim() || undefined,
              accountNumberMasked: accountNumberMasked.trim() || undefined,
            },
          })
        ).unwrap();
      } else {
        await dispatch(
          createAccountThunk({
            name: name.trim(),
            type,
            balance: numBalance,
            institutionName: institutionName.trim() || undefined,
            accountNumberMasked: accountNumberMasked.trim() || undefined,
          })
        ).unwrap();
      }
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (acc: Account) => {
    if (confirm(`Delete account "${acc.name}"? This will not affect past transaction history.`)) {
      dispatch(deleteAccountThunk(acc._id));
    }
  };

  const getAccountIcon = (accType: AccountType) => {
    switch (accType) {
      case 'bank':
        return <Landmark className="w-5 h-5 text-sky-400" />;
      case 'credit_card':
        return <CreditCard className="w-5 h-5 text-rose-400" />;
      case 'wallet':
        return <Wallet className="w-5 h-5 text-amber-400" />;
      case 'cash':
        return <Banknote className="w-5 h-5 text-emerald-400" />;
      case 'investment':
        return <TrendingUp className="w-5 h-5 text-purple-400" />;
      default:
        return <Building className="w-5 h-5 text-slate-400" />;
    }
  };

  // Group accounts by type for intuitive organization
  const groupedAccounts = useMemo(() => {
    const banks = accounts.filter((a) => a.type === 'bank');
    const creditCards = accounts.filter((a) => a.type === 'credit_card');
    const cashAndWallets = accounts.filter((a) => a.type === 'cash' || a.type === 'wallet');
    const investments = accounts.filter((a) => a.type === 'investment' || a.type === 'other');

    return { banks, creditCards, cashAndWallets, investments };
  }, [accounts]);

  const netWorth = netWorthSummary?.netWorth ?? 0;
  const totalAssets = netWorthSummary?.totalAssets ?? 0;
  const totalLiabilities = netWorthSummary?.totalLiabilities ?? 0;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Accounts & Net Worth
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track bank accounts, credit cards, cash in hand, investments, and overall financial balance sheet.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
          onClick={handleOpenCreate}
        >
          Add Financial Account
        </Button>
      </div>

      {/* Net Worth Command Summary Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-6 bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border-emerald-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Net Worth
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ASSETS - LIABILITIES
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span
              className={`text-3xl sm:text-4xl font-extrabold font-mono tabular-financial ${
                netWorth >= 0 ? 'text-white' : 'text-rose-400'
              }`}
            >
              {formatINR(netWorth)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Consolidated net balance across all linked accounts, cash reserves, and liabilities.
          </p>
        </Card>

        <Card className="p-6 bg-slate-900/40 border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Assets
              </span>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-financial text-emerald-400 mt-3">
              {formatINR(totalAssets)}
            </div>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between pt-3 border-t border-slate-800">
            <span>Bank: {formatINR(netWorthSummary?.assetsBreakdown.bank || 0)}</span>
            <span>Cash/Wallet: {formatINR((netWorthSummary?.assetsBreakdown.cash || 0) + (netWorthSummary?.assetsBreakdown.wallet || 0))}</span>
          </div>
        </Card>

        <Card className="p-6 bg-slate-900/40 border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Liabilities
              </span>
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-financial text-rose-400 mt-3">
              {formatINR(totalLiabilities)}
            </div>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between pt-3 border-t border-slate-800">
            <span>Cards: {formatINR(netWorthSummary?.liabilitiesBreakdown.creditCards || 0)}</span>
            <span>Debts Owed: {formatINR(netWorthSummary?.liabilitiesBreakdown.debtsOwed || 0)}</span>
          </div>
        </Card>
      </div>

      {accounts.length === 0 && !loading ? (
        <EmptyState
          icon={<Landmark className="w-8 h-8 text-slate-400" />}
          title="No financial accounts registered"
          description="Add your salary bank account, credit cards, or cash wallet to monitor balances and net worth."
          actionText="Add your first account"
          onAction={handleOpenCreate}
          className="py-16"
        />
      ) : (
        <div className="space-y-8">
          {/* Bank Accounts Section */}
          {groupedAccounts.banks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Bank Accounts ({groupedAccounts.banks.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedAccounts.banks.map((acc) => (
                  <AccountCard
                    key={acc._id}
                    account={acc}
                    onEdit={() => handleOpenEdit(acc)}
                    onDelete={() => handleDelete(acc)}
                    icon={getAccountIcon(acc.type)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Credit Cards Section */}
          {groupedAccounts.creditCards.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Credit Cards ({groupedAccounts.creditCards.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedAccounts.creditCards.map((acc) => (
                  <AccountCard
                    key={acc._id}
                    account={acc}
                    onEdit={() => handleOpenEdit(acc)}
                    onDelete={() => handleDelete(acc)}
                    icon={getAccountIcon(acc.type)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Cash & Wallets Section */}
          {groupedAccounts.cashAndWallets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Cash & Digital Wallets ({groupedAccounts.cashAndWallets.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedAccounts.cashAndWallets.map((acc) => (
                  <AccountCard
                    key={acc._id}
                    account={acc}
                    onEdit={() => handleOpenEdit(acc)}
                    onDelete={() => handleDelete(acc)}
                    icon={getAccountIcon(acc.type)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Investments Section */}
          {groupedAccounts.investments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Investments & Assets ({groupedAccounts.investments.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedAccounts.investments.map((acc) => (
                  <AccountCard
                    key={acc._id}
                    account={acc}
                    onEdit={() => handleOpenEdit(acc)}
                    onDelete={() => handleDelete(acc)}
                    icon={getAccountIcon(acc.type)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Account Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAccount ? 'Edit Account' : 'Add Financial Account'}
        description="Configure account name, type, and current balance for balance sheet reconciliation."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Account Name"
            placeholder="e.g. HDFC Salary Account, SBI Credit Card, Cash in Hand"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Account Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white"
              >
                <option value="bank">Bank Account</option>
                <option value="credit_card">Credit Card</option>
                <option value="cash">Cash In Hand</option>
                <option value="wallet">Digital Wallet</option>
                <option value="investment">Investment</option>
                <option value="other">Other Asset</option>
              </select>
            </div>

            <Input
              label="Current Balance (INR)"
              type="number"
              step="any"
              placeholder="e.g. 42850 (or negative for credit card outstanding)"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Bank / Provider (Optional)"
              placeholder="e.g. HDFC, ICICI, SBI, Paytm"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
            />

            <Input
              label="Account / Card Digits (Optional)"
              placeholder="e.g. •••• 4123"
              value={accountNumberMasked}
              onChange={(e) => setAccountNumberMasked(e.target.value)}
            />
          </div>

          <div className="p-3 bg-slate-800/40 rounded-xl flex items-start gap-2 border border-white/5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-400">
              Only manually managed balances and masked reference numbers are saved. No actual bank passwords or full credentials are ever collected.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              {editingAccount ? 'Save Changes' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

interface AccountCardProps {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
  icon: React.ReactNode;
}

const AccountCard: React.FC<AccountCardProps> = ({ account, onEdit, onDelete, icon }) => {
  const isCreditCard = account.type === 'credit_card';
  const isNegative = account.balance < 0;

  return (
    <Card interactive className="p-5 flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800/70 border border-white/5 flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {account.name}
              </h4>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                {account.institutionName && <span>{account.institutionName}</span>}
                {account.accountNumberMasked && (
                  <>
                    <span>•</span>
                    <span className="font-mono">{account.accountNumberMasked}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <Badge variant={isCreditCard ? 'rose' : 'slate'} size="sm">
            {account.type.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        <div className="mt-5">
          <span className="text-xs text-slate-400 uppercase font-semibold">
            {isCreditCard ? 'Outstanding Balance' : 'Available Balance'}
          </span>
          <div
            className={`text-2xl font-extrabold font-mono tabular-financial mt-0.5 ${
              isCreditCard || isNegative ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {formatINR(account.balance)}
          </div>
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-slate-800/60 flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800"
          title="Edit account"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10"
          title="Delete account"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </Card>
  );
};
