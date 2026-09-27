import React, { useEffect, useState } from 'react';
import {
  Mail,
  Plus,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Forward,
  Copy,
  Check,
  Send,
  Calendar,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import {
  fetchAccountsThunk,
  connectMockThunk,
  setupForwardingThunk,
  simulateInboundThunk,
  syncAccountThunk,
  pauseAccountThunk,
  resumeAccountThunk,
  removeAccountThunk,
} from '../store/slices/emailAccountSlice.js';
import { fetchPendingDetectedThunk } from '../store/slices/detectedTransactionSlice.js';
import { fetchCategoriesThunk } from '../store/slices/categorySlice.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { formatRelativeDate } from '../utils/format.js';
import { DetectedTransactionReviewCenter } from '../features/emailSync/DetectedTransactionReviewCenter.js';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

export const EmailSyncPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const { accounts, isSyncing } = useAppSelector((state) => state.emailAccounts);
  const { user } = useAppSelector((state) => state.auth);

  const currentDate = new Date();
  const [selectedMonths, setSelectedMonths] = useState<Record<string, number>>({});
  const [selectedYears, setSelectedYears] = useState<Record<string, number>>({});

  const handleSyncMonth = (accountId: string) => {
    const month = selectedMonths[accountId] ?? (currentDate.getMonth() + 1);
    const year = selectedYears[accountId] ?? currentDate.getFullYear();
    dispatch(syncAccountThunk({ accountId, month, year }));
  };

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectTab, setConnectTab] = useState<'forwarding' | 'mock' | 'gmail'>('forwarding');
  const [mockEmail, setMockEmail] = useState(user?.email || 'vasanth.personal@gmail.com');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSettingUpForwarding, setIsSettingUpForwarding] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedFilter, setCopiedFilter] = useState(false);
  const [simTemplate, setSimTemplate] = useState('gpay_swiggy');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simFeedback, setSimFeedback] = useState<string | null>(null);

  const urlConnected = searchParams.get('connected');
  const urlError = searchParams.get('error');

  useEffect(() => {
    dispatch(fetchAccountsThunk());
    dispatch(fetchPendingDetectedThunk());
    dispatch(fetchCategoriesThunk());

    if (urlConnected === 'gmail_success') {
      setBannerNotice({
        type: 'success',
        message: 'Gmail account connected with full transaction parsing permissions! Initial sync initiated.',
      });
    } else if (urlError) {
      setBannerNotice({
        type: 'error',
        message: decodeURIComponent(urlError),
      });
    }
  }, [dispatch, urlConnected, urlError]);

  const handleConnectMock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockEmail.trim()) return;

    setIsConnecting(true);
    setConnectError(null);
    try {
      await dispatch(connectMockThunk(mockEmail.trim())).unwrap();
      setIsConnectModalOpen(false);
      setMockEmail('');
    } catch (err: any) {
      setConnectError(err || 'Failed to connect email account');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    setConnectError(null);
    try {
      const res = await api.get('/email-accounts/gmail/auth-url');
      if (res.data.data.authUrl) {
        window.location.href = res.data.data.authUrl;
      }
    } catch (err: any) {
      setConnectError(
        err.response?.data?.message ||
          'Google OAuth not configured on local server. Please use the Dev Mock Email option for zero-cost instant testing.'
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const forwardingAccount = accounts.find((a) => a.provider === 'forwarding');

  const handleSetupForwarding = async () => {
    setIsSettingUpForwarding(true);
    setConnectError(null);
    try {
      await dispatch(setupForwardingThunk()).unwrap();
    } catch (err: any) {
      setConnectError(err || 'Failed to setup email forwarding');
    } finally {
      setIsSettingUpForwarding(false);
    }
  };

  const handleSimulateForward = async (accountId: string, templateKey = simTemplate) => {
    setIsSimulating(true);
    setSimFeedback(null);
    try {
      const res = await dispatch(
        simulateInboundThunk({ accountId, templateKey })
      ).unwrap();
      setSimFeedback(res.message || 'Simulated email processed successfully!');
      setTimeout(() => setSimFeedback(null), 6000);
    } catch (err: any) {
      setSimFeedback(`Error: ${err || 'Simulation failed'}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Email & UPI Sync Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Connect personal or work inboxes to automatically discover and parse Indian UPI payment alerts.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsConnectModalOpen(true)}
        >
          Connect Email Account
        </Button>
      </div>

      {/* Banner Notice */}
      {bannerNotice && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold ${
            bannerNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerNotice.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{bannerNotice.message}</span>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Review Center Banner if any detected transactions pending */}
      <DetectedTransactionReviewCenter />

      {/* Security & Zero-Password Guarantee Banner (Requirement 6 & 48) */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-sm flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-emerald-950 dark:text-emerald-100">
                Your Privacy & Financial Security is 100% Protected
              </h3>
              <p className="text-xs text-emerald-800/90 dark:text-emerald-300 mt-1 max-w-2xl leading-relaxed">
                SpendWise strictly uses authorized read-only OAuth access or development mock streams.
                We <strong className="font-bold underline">NEVER</strong> request, store, or have access to your:
                Gmail Password, UPI PIN, Bank Password, ATM PIN, Net Banking Credentials, OTP, or CVV.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
            <Badge variant="emerald" className="font-bold py-1 px-3">
              ZERO-CREDENTIAL ACCESS
            </Badge>
          </div>
        </div>
      </div>

      {/* Connected Accounts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            Connected Email Accounts ({accounts.length})
          </h2>
          <button
            onClick={() => dispatch(fetchAccountsThunk())}
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Accounts
          </button>
        </div>

        {accounts.length === 0 ? (
          <EmptyState
            icon={<Mail className="w-8 h-8 text-slate-400" />}
            title="No email accounts connected"
            description="Connect your Gmail or local test email stream to automatically detect UPI and bank payment notifications."
            actionText="Connect Email Account"
            onAction={() => setIsConnectModalOpen(true)}
            className="py-12"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              const syncing = isSyncing[acc._id];
              const isPaused = acc.status === 'paused';

              return (
                <Card key={acc._id} className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                          acc.provider === 'forwarding'
                            ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                            : acc.provider === 'gmail'
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {acc.provider === 'forwarding' ? (
                            <Forward className="w-5 h-5" />
                          ) : acc.provider === 'gmail' ? (
                            'G'
                          ) : (
                            'M'
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                            {acc.email}
                          </p>
                          <span className={`text-[11px] uppercase font-semibold ${
                            acc.provider === 'forwarding'
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-400'
                          }`}>
                            {acc.provider === 'forwarding' ? 'AUTO-FORWARDING' : `${acc.provider.toUpperCase()} PROVIDER`}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant={
                          syncing
                            ? 'blue'
                            : isPaused
                            ? 'amber'
                            : acc.status === 'active'
                            ? 'emerald'
                            : 'rose'
                        }
                      >
                        {syncing
                          ? 'SYNCING...'
                          : isPaused
                          ? 'PAUSED'
                          : acc.status.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Forwarding address display with quick copy */}
                    {acc.provider === 'forwarding' && (
                      <div className="mt-3 flex items-center justify-between gap-1 p-2 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                        <div className="min-w-0">
                          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider">
                            Inbound Address
                          </p>
                          <p className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                            {acc.forwardingAddress || acc.email}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(acc.forwardingAddress || acc.email);
                            setCopiedAddress(true);
                            setTimeout(() => setCopiedAddress(false), 2000);
                          }}
                          className="p-1.5 rounded text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                          title="Copy forwarding address"
                        >
                          {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}

                    {/* Gmail Verification Code Alert on Card */}
                    {acc.lastVerificationCode && (
                      <div className="mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">
                            Gmail Confirmation Code
                          </p>
                          <p className="text-sm font-extrabold font-mono text-emerald-900 dark:text-emerald-200">
                            {acc.lastVerificationCode}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(acc.lastVerificationCode!);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }}
                          className="px-2 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 transition-colors shadow-xs"
                        >
                          {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedCode ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}

                    <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                      <div className="flex justify-between">
                        <span>Last activity:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {acc.lastSyncAt ? formatRelativeDate(acc.lastSyncAt) : 'Never synced'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transactions detected:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {acc.detectedCount}
                        </span>
                      </div>
                      {acc.syncError && (
                        <div className="pt-2 text-rose-500 text-[11px] space-y-1.5 border-t border-rose-100 dark:border-rose-900/40 mt-1.5">
                          <div className="flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="font-semibold">{acc.syncError}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Month & Year Selection for Email Sync */}
                  {acc.provider !== 'forwarding' && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                          Sync Month & Year:
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">Only that data syncs</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={selectedMonths[acc._id] ?? (currentDate.getMonth() + 1)}
                          onChange={(e) =>
                            setSelectedMonths((prev) => ({
                              ...prev,
                              [acc._id]: parseInt(e.target.value, 10),
                            }))
                          }
                          className="w-full py-1.5 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          {MONTH_OPTIONS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={selectedYears[acc._id] ?? currentDate.getFullYear()}
                          onChange={(e) =>
                            setSelectedYears((prev) => ({
                              ...prev,
                              [acc._id]: parseInt(e.target.value, 10),
                            }))
                          }
                          className="w-full py-1.5 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          {YEAR_OPTIONS.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    {acc.provider === 'forwarding' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={isSimulating}
                        leftIcon={<Send className="w-3.5 h-3.5 text-indigo-600" />}
                        onClick={() => handleSimulateForward(acc._id, 'gpay_swiggy')}
                      >
                        Test Inbound
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        isLoading={syncing}
                        leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />}
                        onClick={() => handleSyncMonth(acc._id)}
                      >
                        Sync {MONTH_OPTIONS.find((m) => m.value === (selectedMonths[acc._id] ?? (currentDate.getMonth() + 1)))?.label?.slice(0, 3)} {selectedYears[acc._id] ?? currentDate.getFullYear()}
                      </Button>
                    )}

                    <div className="flex items-center gap-1">
                      {isPaused ? (
                        <button
                          onClick={() => dispatch(resumeAccountThunk(acc._id))}
                          title="Resume sync"
                          className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => dispatch(pauseAccountThunk(acc._id))}
                          title="Pause sync"
                          className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (confirm(`Remove email account ${acc.email}?`)) {
                            dispatch(removeAccountThunk(acc._id));
                          }
                        }}
                        title="Remove account"
                        className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect Email Modal */}
      <Modal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        title="Connect Email Account"
        description="Link your email to parse Swiggy, Amazon, Uber, PhonePe, and Bank notifications."
        maxWidth="md"
      >
        <div className="space-y-4">
          {connectError && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
              {connectError}
            </div>
          )}

          {/* Provider Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setConnectTab('forwarding')}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                connectTab === 'forwarding'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Forward className="w-4 h-4 text-indigo-600" />
              Auto-Forwarding (Bypass Google Review)
            </button>
            <button
              onClick={() => setConnectTab('mock')}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                connectTab === 'mock'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 text-brand-600" />
              Dev Mock Email (Free)
            </button>
            <button
              onClick={() => setConnectTab('gmail')}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                connectTab === 'gmail'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Google OAuth (Live Gmail)
            </button>
          </div>

          {connectTab === 'forwarding' ? (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-300">
                <p className="font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
                  <ShieldCheck className="w-4 h-4" />
                  Zero Google Verification Hurdles &amp; Bank-Grade Privacy
                </p>
                <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-400">
                  Forward payment alert emails (Swiggy, Amazon, UPI, Bank SMS/Emails) to your private SpendWise sync address. Works with Gmail, Outlook, Apple Mail, and corporate inboxes without Google Cloud verification!
                </p>
              </div>

              {forwardingAccount ? (
                <div className="space-y-3">
                  {/* Inbound address */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Your Private Inbound Address
                      </span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Ready &amp; Listening
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={forwardingAccount.forwardingAddress || forwardingAccount.email}
                        className="flex-1 text-xs sm:text-sm font-mono font-medium px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 select-all"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(forwardingAccount.forwardingAddress || forwardingAccount.email);
                          setCopiedAddress(true);
                          setTimeout(() => setCopiedAddress(false), 2000);
                        }}
                        leftIcon={copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      >
                        {copiedAddress ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </div>

                  {/* Gmail verification code callout if received */}
                  {forwardingAccount.lastVerificationCode && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          Latest Gmail Confirmation Code
                        </p>
                        <p className="text-base font-extrabold font-mono text-emerald-900 dark:text-emerald-200">
                          {forwardingAccount.lastVerificationCode}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          navigator.clipboard.writeText(forwardingAccount.lastVerificationCode!);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        leftIcon={copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      >
                        {copiedCode ? 'Copied' : 'Copy Code'}
                      </Button>
                    </div>
                  )}

                  {/* Setup steps */}
                  <div className="text-xs space-y-2 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                    <p className="font-bold text-slate-800 dark:text-slate-200">How to automate in Gmail (2 mins):</p>
                    <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                      <li>
                        In Gmail, open <strong>Settings (⚙️) &rarr; See all settings &rarr; Forwarding and POP/IMAP</strong>.
                      </li>
                      <li>
                        Click <strong>Add a forwarding address</strong> and paste your SpendWise address above.
                      </li>
                      <li>
                        Gmail sends a confirmation email. SpendWise captures the confirmation code automatically!
                      </li>
                      <li>
                        Create a filter for payment alerts:
                        <div className="mt-1 flex items-center gap-1.5">
                          <code className="text-[11px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded font-mono truncate max-w-[280px]">
                            from:(alerts@hdfcbank.net OR noreply@swiggy.in OR no-reply@phonepe.com OR auto-confirm@amazon.in)
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText('from:(alerts@hdfcbank.net OR noreply@swiggy.in OR no-reply@phonepe.com OR auto-confirm@amazon.in)');
                              setCopiedFilter(true);
                              setTimeout(() => setCopiedFilter(false), 2000);
                            }}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                            title="Copy filter query"
                          >
                            {copiedFilter ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        Check <strong>"Forward it to your SpendWise address"</strong> &rarr; Done!
                      </li>
                    </ol>
                  </div>

                  {/* Live Simulator Test Box */}
                  <div className="p-3 bg-brand-50/50 dark:bg-brand-950/30 rounded-xl border border-brand-200 dark:border-brand-900/50 space-y-2">
                    <p className="text-xs font-bold text-brand-900 dark:text-brand-300 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-brand-600" />
                      Test Inbound Ingestion (Instant Simulation)
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={simTemplate}
                        onChange={(e) => setSimTemplate(e.target.value)}
                        className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      >
                        <option value="gpay_swiggy">Swiggy ₹489 (Google Pay UPI)</option>
                        <option value="hdfc_debit">HDFC Bank ₹1,250 Debit Alert</option>
                        <option value="phonepe_chai">PhonePe ₹220 (Chai Point)</option>
                        <option value="amazon_order">Amazon ₹1,899 Order Receipt</option>
                        <option value="gmail_verification">Gmail Forwarding Confirmation Code</option>
                      </select>
                      <Button
                        size="sm"
                        variant="primary"
                        isLoading={isSimulating}
                        onClick={() => handleSimulateForward(forwardingAccount._id)}
                      >
                        Send Test Forward
                      </Button>
                    </div>
                    {simFeedback && (
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {simFeedback}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                    <Forward className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Generate Your Private SpendWise Sync Address
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                      Get a unique forwarding email (e.g. <code>sync-8a9f2b@...</code>) that parses transaction alerts automatically.
                    </p>
                  </div>
                  <Button
                    size="md"
                    variant="primary"
                    isLoading={isSettingUpForwarding}
                    onClick={handleSetupForwarding}
                    leftIcon={<Sparkles className="w-4 h-4" />}
                  >
                    Generate Forwarding Address
                  </Button>
                </div>
              )}
            </div>
          ) : connectTab === 'mock' ? (
            <form onSubmit={handleConnectMock} className="space-y-4">
              <div className="p-3 bg-brand-50/70 dark:bg-brand-950/40 rounded-xl border border-brand-200 dark:border-brand-900/60 text-xs text-brand-900 dark:text-brand-300">
                <p className="font-bold">Zero-Cost Development Mode</p>
                <p className="mt-0.5 leading-relaxed">
                  Simulates incoming Indian UPI transactions (Swiggy, Amazon, Uber, Electricity, Salary) without requiring paid APIs or live Google Cloud credentials.
                </p>
              </div>

              <Input
                label="Account Email Label"
                placeholder="user.personal@gmail.com"
                value={mockEmail}
                onChange={(e) => setMockEmail(e.target.value)}
                required
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsConnectModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isConnecting}>
                  Connect & Sync
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Connect via official Google OAuth consent screen. SpendWise will only request read-only access to transaction emails with search filters applied.
              </p>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Google Verification & Test Users</span>
                </div>
                <p className="leading-relaxed">
                  If Google blocks access with <em>"SpendWise has not completed verification"</em>, your Google account must be added to <strong>Test users</strong> in your Google Cloud Console (OAuth consent screen).
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-400">
                  When prompted with <em>"Google hasn't verified this app"</em>, click <strong>Advanced &rarr; Go to SpendWise (unsafe)</strong>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1 text-slate-500">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Google OAuth 2.0 Security Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Encrypted OAuth tokens stored at rest with AES-256-GCM</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsConnectModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  isLoading={isConnecting}
                  onClick={handleConnectGmail}
                >
                  Continue to Google
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
