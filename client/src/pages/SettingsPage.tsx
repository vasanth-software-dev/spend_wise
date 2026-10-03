import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Laptop,
  Trash2,
  Plus,
  CheckCircle,
  User,
  Shield,
  Tag,
  AlertTriangle,
  Fingerprint,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import { logoutThunk } from '../store/slices/authSlice.js';
import {
  fetchCategoriesThunk,
  createCategoryThunk,
} from '../store/slices/categorySlice.js';
import { api } from '../services/api.js';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Modal } from '../components/ui/Modal.js';
import { Badge } from '../components/ui/Badge.js';
import { BiometricSettingsCard } from '../components/auth/BiometricSettingsCard.js';
import { formatRelativeDate } from '../utils/format.js';
import { CategoryIcon } from '../components/ui/CategoryIcon.js';
import { CATEGORY_ICON_NAMES } from '../constants/categoryIcons.js';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const categories = useAppSelector((state) => state.categories.categories);

  const [activeTab, setActiveTab] = useState<
    'profile' | 'security' | 'sessions' | 'categories' | 'privacy' | 'danger'
  >('profile');

  // Profile Form state
  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState(user?.currency || 'INR');
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata');
  const [profileSaved, setProfileSaved] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  // Custom Category state
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income' | 'both'>('expense');
  const [newCatIcon, setNewCatIcon] = useState('Tag');
  const [newCatColor, setNewCatColor] = useState('#10b981');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Danger Zone
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    dispatch(fetchCategoriesThunk());
    loadSessions();
  }, [dispatch]);

  const loadSessions = async () => {
    try {
      const res = await api.get('/auth/sessions');
      setSessions(res.data.data.sessions || []);
      setCurrentSessionId(res.data.data.currentSessionId || '');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await api.patch('/users/profile', { name, currency, timezone });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      loadSessions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogoutAllOther = async () => {
    try {
      await api.post('/auth/sessions/logout-all');
      loadSessions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsCreatingCategory(true);
    try {
      await dispatch(
        createCategoryThunk({
          name: newCatName.trim(),
          type: newCatType,
          icon: newCatIcon,
          color: newCatColor,
        })
      ).unwrap();
      setIsAddCatModalOpen(false);
      setNewCatName('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await api.delete('/users/account');
      dispatch(logoutThunk());
      navigate('/login');
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  const iconOptions = CATEGORY_ICON_NAMES;

  interface TabItem {
    id: 'profile' | 'security' | 'sessions' | 'categories' | 'privacy' | 'danger';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    danger?: boolean;
  }

  const tabs: TabItem[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Fingerprint },
    { id: 'sessions', label: 'Sessions', icon: Laptop },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, danger: true },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Account Settings & Security
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal identity, device authorizations, spending taxonomy, and privacy controls.
        </p>
      </div>

      {/* Segmented Fintech Tab Bar */}
      <div className="flex bg-slate-100 dark:bg-surface-elevated/90 p-1.5 rounded-2xl border border-slate-200/60 dark:border-white/5 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-2 px-3.5 text-xs sm:text-sm font-semibold rounded-xl transition-[background-color,border-color,color] duration-150 ease-out-expo whitespace-nowrap ${
                isActive
                  ? tab.danger
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold'
                    : 'bg-white dark:bg-surface text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-white/10 font-bold'
                  : tab.danger
                  ? 'text-rose-500/80 hover:text-rose-600 hover:bg-rose-50/40 dark:hover:bg-rose-950/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: Profile */}
      {activeTab === 'profile' && (
        <Card variant="elevated" className="p-6 sm:p-7">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-white/5">
            <CardTitle className="text-lg font-bold">Profile & Regional Preferences</CardTitle>
            <CardDescription className="text-xs">
              Configure your primary identity parameters, operating currency, and financial timezone.
            </CardDescription>
          </CardHeader>

          {profileSaved && (
            <div className="p-3.5 mt-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Personal preferences successfully saved and synchronized.</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-5 mt-6 max-w-xl">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vasanth"
              required
            />

            <Input
              label="Email Address"
              value={user?.email || ''}
              disabled
              helperText="Managed by primary authentication provider."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Default Currency
                </label>
                <div className="relative">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full py-2.5 px-3.5 bg-white dark:bg-surface-elevated/80 border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Timezone Standard
                </label>
                <div className="relative">
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full py-2.5 px-3.5 bg-white dark:bg-surface-elevated/80 border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3">
              <Button type="submit" variant="primary" size="sm" isLoading={isSavingProfile}>
                Save Preferences
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab: Sessions */}
      {activeTab === 'sessions' && (
        <Card variant="elevated" className="p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 dark:border-white/5 gap-3">
            <div>
              <CardTitle className="text-lg font-bold">Active Device Sessions</CardTitle>
              <CardDescription className="text-xs">
                Review hardware, browser clients, and IP addresses authenticated to your financial portal.
              </CardDescription>
            </div>
            {sessions.length > 1 && (
              <Button size="sm" variant="outline" onClick={handleLogoutAllOther} className="self-start sm:self-auto">
                Revoke Other Sessions
              </Button>
            )}
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-white/5">
            {sessions.map((sess) => {
              const isCurrent = sess._id === currentSessionId;
              return (
                <div
                  key={sess._id}
                  className="py-4 flex items-center justify-between text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-surface-elevated text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        {sess.browser} on {sess.os}
                        {isCurrent && (
                          <Badge variant="emerald" size="sm" dot>
                            CURRENT
                          </Badge>
                        )}
                      </p>
                      <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                        IP: {sess.ipAddress} • Last active {formatRelativeDate(sess.lastActive)}
                      </p>
                    </div>
                  </div>

                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRevokeSession(sess._id)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Tab: Security (Biometric / Passkey) */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <BiometricSettingsCard />

          <Card variant="elevated" className="p-6 sm:p-7 space-y-3">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-white/5">
              <CardTitle className="text-lg font-bold">Google Account</CardTitle>
              <CardDescription className="text-xs">
                Your primary sign-in method. Biometric sign-in is an additional unlock method and never replaces it.
              </CardDescription>
            </CardHeader>
            <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200">{user?.email}</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Signed in with Google • Status: Connected
                </p>
              </div>
              <Badge variant="emerald" size="sm" dot>
                CONNECTED
              </Badge>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Categories */}
      {activeTab === 'categories' && (
        <Card variant="elevated" className="p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 dark:border-white/5 gap-3">
            <div>
              <CardTitle className="text-lg font-bold">Spending & Income Taxonomy</CardTitle>
              <CardDescription className="text-xs">
                System default ledgers and your personalized classification categories.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={() => setIsAddCatModalOpen(true)}
              className="self-start sm:self-auto shadow-2xs"
            >
              Add Category
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categories.map((c) => (
              <div
                key={c._id}
                className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center gap-3 bg-white dark:bg-surface-elevated/60 hover:border-slate-300 dark:hover:border-white/10 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${c.color}20` }}
                >
                  <CategoryIcon name={c.icon} className="w-4 h-4" color={c.color} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {c.name}
                  </p>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mt-0.5">
                    {c.isDefault ? 'Default' : 'Custom'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Add Category Modal */}
          <Modal
            isOpen={isAddCatModalOpen}
            onClose={() => setIsAddCatModalOpen(false)}
            title="Create Custom Classification"
            description="Add a personalized category with tailored iconography and color accents."
          >
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <Input
                label="Category Name"
                placeholder="e.g. Pet Care, Software Subscriptions"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Flow Classification
                  </label>
                  <select
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value as any)}
                    className="w-full py-2.5 px-3 bg-white dark:bg-surface-elevated/80 border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-medium"
                  >
                    <option value="expense">Expense Only</option>
                    <option value="income">Income Only</option>
                    <option value="both">Both (Bi-directional)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Accent Color
                  </label>
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="w-full h-10 p-1 bg-white dark:bg-surface-elevated/80 border border-slate-200 dark:border-white/10 rounded-xl cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Select Visual Icon
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {iconOptions.map((iconName) => (
                    <button
                      type="button"
                      key={iconName}
                      onClick={() => setNewCatIcon(iconName)}
                      className={`p-2.5 rounded-xl border flex items-center justify-center transition-[border-color,background-color,color] duration-150 ease-out-expo ${newCatIcon === iconName
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-slate-200 dark:border-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                    >
                      <CategoryIcon name={iconName} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-white/5">
                <Button variant="outline" size="sm" onClick={() => setIsAddCatModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isCreatingCategory}>
                  Create Category
                </Button>
              </div>
            </form>
          </Modal>
        </Card>
      )}

      {/* Tab: Privacy & Security */}
      {activeTab === 'privacy' && (
        <Card variant="elevated" className="p-6 sm:p-7 space-y-5">
          <CardHeader className="pb-4 border-b border-slate-100 dark:border-white/5">
            <CardTitle className="text-lg font-bold">Privacy Architecture & Security Model</CardTitle>
            <CardDescription className="text-xs">
              SpendWise is built upon strict zero-knowledge principles and encrypted storage guarantees.
            </CardDescription>
          </CardHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-surface-elevated/60 border border-slate-200/80 dark:border-white/5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Zero-Credential Access Guarantee
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                SpendWise never requests, inspects, or stores banking passwords, Net Banking logins, ATM PINs, UPI PINs, or One-Time Passwords (OTPs). All email access is performed through authorized read-only Google OAuth 2.0 transaction search scopes.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-surface-elevated/60 border border-slate-200/80 dark:border-white/5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                AES-256-GCM Authenticated Encryption at Rest
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                OAuth access tokens and refresh secrets are encrypted with authenticated military-grade AES-256-GCM cipher before writing to the database. Plaintext tokens never reach web browser clients or log files.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-surface-elevated/60 border border-slate-200/80 dark:border-white/5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Strict Data Minimization
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                Email bodies are discarded immediately after extraction. Only financial ledger transaction parameters (Amount, Merchant, Payment Method, Date, UTR) are persisted to your private ledger.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Tab: Danger Zone */}
      {activeTab === 'danger' && (
        <Card variant="elevated" className="p-6 sm:p-7 border-rose-500/20 dark:border-rose-500/20">
          <CardHeader className="pb-4 border-b border-rose-100 dark:border-rose-950/40">
            <CardTitle className="text-lg font-bold text-rose-600 dark:text-rose-400">
              Irreversible Account Erasure
            </CardTitle>
            <CardDescription className="text-xs">
              Permanently delete your profile, transaction ledger, connected email channels, and historical statements.
            </CardDescription>
          </CardHeader>

          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300 space-y-2">
            <p className="font-bold">Caution: This operation is immediate and permanent.</p>
            <p className="leading-relaxed">
              All financial history, manual entries, connected accounts, and user settings will be expunged from the database in compliance with GDPR and data privacy laws.
            </p>
          </div>

          <div className="mt-6">
            <Button
              variant="danger"
              size="md"
              leftIcon={<Trash2 className="w-4 h-4" />}
              onClick={() => setIsDeleteModalOpen(true)}
            >
              Permanently Delete Account
            </Button>
          </div>

          {/* Delete Confirmation Modal */}
          <Modal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            title="Confirm Account Deletion"
            description="Type DELETE below to confirm the irreversible removal of your account."
          >
            <div className="space-y-4">
              <Input
                label='Type "DELETE" to confirm'
                placeholder="DELETE"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={deleteConfirmation !== 'DELETE'}
                  isLoading={isDeleting}
                  onClick={handleDeleteAccount}
                >
                  Confirm Permanent Erasure
                </Button>
              </div>
            </div>
          </Modal>
        </Card>
      )}
    </div>
  );
};
