import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
import { CategoryBadge } from '../components/ui/CategoryBadge.js';
import { CategoryIconBox } from '../components/ui/CategoryIconBox.js';
import { resolveCategoryMeta } from '../constants/categories.js';
import { CATEGORY_ICON_NAMES } from '../constants/categoryIcons.js';

const PRESET_COLORS = [
  '#f97316', '#10b981', '#ec4899', '#3b82f6',
  '#ef4444', '#eab308', '#8b5cf6', '#a855f7',
  '#14b8a6', '#6366f1', '#06b6d4', '#f43f5e',
  '#d946ef', '#059669', '#0284c7', '#84cc16',
];

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const categories = useAppSelector((state) => state.categories.categories);

  const getInitialTab = (): 'profile' | 'security' | 'sessions' | 'categories' | 'privacy' | 'danger' => {
    if (location.pathname.includes('/categories')) return 'categories';
    const tabParam = searchParams.get('tab');
    if (tabParam && ['profile', 'security', 'sessions', 'categories', 'privacy', 'danger'].includes(tabParam)) {
      return tabParam as any;
    }
    return 'profile';
  };

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'sessions' | 'categories' | 'privacy' | 'danger'>(getInitialTab);

  useEffect(() => {
    if (location.pathname.includes('/categories')) {
      setActiveTab('categories');
    } else {
      const tabParam = searchParams.get('tab');
      if (tabParam && ['profile', 'security', 'sessions', 'categories', 'privacy', 'danger'].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
  }, [location.pathname, searchParams]);

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
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'expense' | 'income' | 'both'>('all');

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
    icon: React.ComponentType<{ className?: string; color?: string }>;
    color: string;
    danger?: boolean;
  }

  const tabs: TabItem[] = [
    { id: 'profile', label: 'Profile', icon: User, color: '#3b82f6' },
    { id: 'security', label: 'Security & Passkeys', icon: Fingerprint, color: '#10b981' },
    { id: 'sessions', label: 'Sessions', icon: Laptop, color: '#6366f1' },
    { id: 'categories', label: 'Categories', icon: Tag, color: '#f97316' },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield, color: '#14b8a6' },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, color: '#ef4444', danger: true },
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
      <div className="flex bg-slate-100 dark:bg-surface-elevated/90 p-1.5 rounded-2xl border border-slate-200/60 dark:border-white/5 overflow-x-auto scrollbar-none gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (location.pathname.includes('/categories')) {
                  if (tab.id !== 'categories') {
                    navigate(`/settings?tab=${tab.id}`);
                  }
                } else {
                  setSearchParams({ tab: tab.id });
                }
              }}
              style={
                isActive
                  ? {
                      backgroundColor: `${tab.color}18`,
                      borderColor: `${tab.color}35`,
                      color: tab.color,
                    }
                  : undefined
              }
              className={`flex items-center gap-2 py-2 px-3.5 text-xs sm:text-sm font-semibold rounded-xl transition-[background-color,border-color,color] duration-150 ease-out-expo whitespace-nowrap border ${
                isActive
                  ? 'shadow-2xs font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: isActive ? `${tab.color}25` : `${tab.color}15`,
                  color: tab.color,
                }}
              >
                <Icon className="w-3 h-3" color={tab.color} />
              </div>
              <span>{tab.label}</span>
              {tab.id === 'categories' && categories.length > 0 && (
                <span
                  className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${tab.color}22`,
                    color: tab.color,
                  }}
                >
                  {categories.length}
                </span>
              )}
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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-2xs">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Spending & Income Taxonomy</CardTitle>
                <CardDescription className="text-xs">
                  System default ledgers and your personalized classification categories.
                </CardDescription>
              </div>
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

          {/* Flow Category Filter Pills */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All Categories', count: categories.length, color: '#f97316' },
              {
                id: 'expense',
                label: 'Expenses Only',
                count: categories.filter((c) => c.type === 'expense').length,
                color: '#ef4444',
              },
              {
                id: 'income',
                label: 'Income Only',
                count: categories.filter((c) => c.type === 'income').length,
                color: '#10b981',
              },
              {
                id: 'both',
                label: 'Bi-directional / Both',
                count: categories.filter((c) => c.type === 'both' || (c as any).type === 'transfer').length,
                color: '#8b5cf6',
              },
            ].map((f) => {
              const isSelected = categoryFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setCategoryFilter(f.id as any)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                    isSelected
                      ? 'shadow-2xs font-bold'
                      : 'border-slate-200/80 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: `${f.color}18`,
                          borderColor: `${f.color}40`,
                          color: f.color,
                        }
                      : undefined
                  }
                >
                  <span>{f.label}</span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                    style={{
                      backgroundColor: isSelected ? `${f.color}25` : 'currentColor',
                      opacity: isSelected ? 1 : 0.15,
                    }}
                  >
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {categories
              .filter((c) => {
                if (categoryFilter === 'all') return true;
                if (categoryFilter === 'expense') return c.type === 'expense';
                if (categoryFilter === 'income') return c.type === 'income';
                if (categoryFilter === 'both') return c.type === 'both' || (c as any).type === 'transfer';
                return true;
              })
              .map((c) => {
                const meta = resolveCategoryMeta(c, categories);
                return (
                  <div
                    key={c._id}
                    className="p-3.5 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 group hover:scale-[1.02] shadow-2xs relative overflow-hidden"
                    style={{
                      backgroundColor: `${meta.color}0a`,
                      borderColor: `${meta.color}25`,
                    }}
                  >
                    <div
                      className="absolute top-0 right-0 w-16 h-16 rounded-full blur-xl pointer-events-none opacity-20"
                      style={{ backgroundColor: meta.color }}
                    />
                    <CategoryIconBox category={c} categories={categories} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">
                          {c.name}
                        </p>
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-xs border border-white dark:border-[#0b101d]"
                          style={{ backgroundColor: meta.color }}
                          title={`Color: ${meta.color}`}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-[10px] font-mono font-semibold"
                          style={{ color: meta.color }}
                        >
                          {meta.color}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {c.type === 'both' ? 'Both' : c.type}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Add Category Modal */}
          <Modal
            isOpen={isAddCatModalOpen}
            onClose={() => setIsAddCatModalOpen(false)}
            title="Create Custom Classification"
            description="Add a personalized category with tailored iconography and color accents."
          >
            <form onSubmit={handleCreateCategory} className="space-y-4">
              {/* Real-time Category Visual Preview Card */}
              <div
                className="p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-2xs transition-all duration-200"
                style={{
                  backgroundColor: `${newCatColor}12`,
                  borderColor: `${newCatColor}35`,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-2xs"
                    style={{
                      backgroundColor: `${newCatColor}20`,
                      borderColor: `${newCatColor}40`,
                      color: newCatColor,
                    }}
                  >
                    <CategoryIcon name={newCatIcon} className="w-5 h-5" color={newCatColor} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                      {newCatName || 'Category Preview'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-mono font-bold" style={{ color: newCatColor }}>
                        {newCatColor}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-[11px] uppercase font-semibold text-slate-500">
                        {newCatType}
                      </span>
                    </div>
                  </div>
                </div>

                <CategoryBadge
                  category={{ name: newCatName || 'Preview', icon: newCatIcon, color: newCatColor }}
                  size="sm"
                />
              </div>

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
                    Custom Hex Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-10 h-10 p-1 bg-white dark:bg-surface-elevated/80 border border-slate-200 dark:border-white/10 rounded-xl cursor-pointer flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-full py-2 px-3 font-mono text-xs bg-white dark:bg-surface-elevated/80 border border-slate-200 dark:border-white/10 rounded-xl font-bold uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Preset Colors Palette */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Curated Fintech Color Palette
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((hex) => {
                    const isSelected = newCatColor.toLowerCase() === hex.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={hex}
                        onClick={() => setNewCatColor(hex)}
                        className={`w-7 h-7 rounded-lg transition-transform duration-150 flex items-center justify-center ${
                          isSelected ? 'scale-110 ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: hex }}
                        title={hex}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Select Visual Icon
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {iconOptions.map((iconName) => {
                    const isSelected = newCatIcon === iconName;
                    return (
                      <button
                        type="button"
                        key={iconName}
                        onClick={() => setNewCatIcon(iconName)}
                        className="p-2.5 rounded-xl border flex items-center justify-center transition-all duration-150"
                        style={
                          isSelected
                            ? {
                                borderColor: newCatColor,
                                backgroundColor: `${newCatColor}20`,
                                color: newCatColor,
                              }
                            : undefined
                        }
                      >
                        <CategoryIcon
                          name={iconName}
                          className="w-4 h-4"
                          color={isSelected ? newCatColor : undefined}
                        />
                      </button>
                    );
                  })}
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
