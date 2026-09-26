import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Laptop,
  Trash2,
  Plus,
  CheckCircle,
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
import { formatRelativeDate } from '../utils/format.js';
import { CategoryIcon } from '../components/ui/CategoryIcon.js';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const categories = useAppSelector((state) => state.categories.categories);

  const [activeTab, setActiveTab] = useState<'profile' | 'sessions' | 'categories' | 'privacy' | 'danger'>('profile');

  // Profile Form state
  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState(user?.currency || 'INR');
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata');
  const [profileSaved, setProfileSaved] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  // Custom Category state
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income' | 'both'>('expense');
  const [newCatIcon, setNewCatIcon] = useState('Tag');
  const [newCatColor, setNewCatColor] = useState('#10b981');

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
    try {
      await api.patch('/users/profile', { name, currency, timezone });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      console.error(err);
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

  const iconOptions = [
    'Tag', 'Utensils', 'ShoppingBag', 'ShoppingCart', 'Car', 'Fuel', 'Zap',
    'Home', 'Film', 'HeartPulse', 'GraduationCap', 'Plane', 'CreditCard',
    'Briefcase', 'TrendingUp', 'Coffee'
  ];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Account Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal details, sessions, custom categories, and security parameters.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'sessions'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Active Sessions
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Categories
        </button>
        <button
          onClick={() => setActiveTab('privacy')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'privacy'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Privacy & Security
        </button>
        <button
          onClick={() => setActiveTab('danger')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all text-rose-600 dark:text-rose-400 whitespace-nowrap ${
            activeTab === 'danger'
              ? 'bg-rose-50 dark:bg-rose-950/60 shadow-xs font-bold'
              : 'hover:bg-rose-50/50'
          }`}
        >
          Danger Zone
        </button>
      </div>

      {/* Tab: Profile */}
      {activeTab === 'profile' && (
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Profile & Regional Preferences</CardTitle>
            <CardDescription>Configure your personal identification and default currency.</CardDescription>
          </CardHeader>

          {profileSaved && (
            <div className="p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="Email Address"
              value={user?.email || ''}
              disabled
              helperText="Email cannot be changed directly."
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Default Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm"
                >
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" size="sm">
                Save Preferences
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab: Sessions (Requirement 10) */}
      {activeTab === 'sessions' && (
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <CardTitle>Active Multi-Device Sessions</CardTitle>
              <CardDescription>
                Track devices, browsers, and IP addresses authenticated to your SpendWise account.
              </CardDescription>
            </div>
            {sessions.length > 1 && (
              <Button size="sm" variant="outline" onClick={handleLogoutAllOther}>
                Logout Other Devices
              </Button>
            )}
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {sessions.map((sess) => {
              const isCurrent = sess._id === currentSessionId;
              return (
                <div
                  key={sess._id}
                  className="py-3.5 flex items-center justify-between text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <Laptop className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        {sess.browser} on {sess.os}
                        {isCurrent && (
                          <Badge variant="emerald" size="sm">
                            CURRENT SESSION
                          </Badge>
                        )}
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        IP: {sess.ipAddress} • Last active: {formatRelativeDate(sess.lastActive)}
                      </p>
                    </div>
                  </div>

                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRevokeSession(sess._id)}
                      className="text-rose-600 hover:text-rose-700"
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

      {/* Tab: Categories */}
      {activeTab === 'categories' && (
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <CardTitle>Spending & Income Categories</CardTitle>
              <CardDescription>System default categories and your custom categories.</CardDescription>
            </div>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddCatModalOpen(true)}
            >
              Add Category
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categories.map((c) => (
              <div
                key={c._id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 bg-slate-50/50 dark:bg-slate-800/40"
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
                  <span className="text-[10px] uppercase font-semibold text-slate-400">
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
            title="Create Custom Category"
            description="Add a personalized category for transaction tracking."
          >
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <Input
                label="Category Name"
                placeholder="e.g. Pet Care, Gadgets"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Type
                  </label>
                  <select
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value as any)}
                    className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="w-full h-10 p-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Select Icon
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {iconOptions.map((iconName) => (
                    <button
                      type="button"
                      key={iconName}
                      onClick={() => setNewCatIcon(iconName)}
                      className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                        newCatIcon === iconName
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-600'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <CategoryIcon name={iconName} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsAddCatModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Save Category
                </Button>
              </div>
            </form>
          </Modal>
        </Card>
      )}

      {/* Tab: Privacy & Security (Requirement 48) */}
      {activeTab === 'privacy' && (
        <Card className="p-6 space-y-4">
          <CardHeader>
            <CardTitle>Security Architecture & Privacy Policy</CardTitle>
            <CardDescription>
              How SpendWise guarantees the confidentiality and security of your financial data.
            </CardDescription>
          </CardHeader>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              1. Zero-Credential Financial Model
            </h4>
            <p className="leading-relaxed">
              SpendWise never asks for, captures, or stores your banking passwords, Net Banking PINs, ATM PINs, UPI PINs, or One-Time Passwords (OTPs). All email access is negotiated using Google OAuth 2.0 with minimal read-only transaction search scopes.
            </p>

            <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 pt-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              2. AES-256-GCM Token Encryption at Rest
            </h4>
            <p className="leading-relaxed">
              Every third-party OAuth access token and refresh token is encrypted with military-grade AES-256-GCM authenticated cipher before being saved to the database. Tokens are never exposed to the frontend browser or recorded in server log files.
            </p>

            <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 pt-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              3. Data Minimization Principle
            </h4>
            <p className="leading-relaxed">
              We never store full marketing or personal email bodies permanently. Only parsed transaction metadata (Amount, Merchant, UTR, Date) is saved, leaving sensitive inbox content untouched.
            </p>
          </div>
        </Card>
      )}

      {/* Tab: Danger Zone (Requirement 76) */}
      {activeTab === 'danger' && (
        <Card className="p-6 border-rose-200 dark:border-rose-900/60">
          <CardHeader>
            <CardTitle className="text-rose-600 dark:text-rose-400">
              Danger Zone — Permanent Data Erasure
            </CardTitle>
            <CardDescription>
              Permanently delete your account and all associated transactions, categories, budgets, and email links.
            </CardDescription>
          </CardHeader>

          <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/80 text-xs text-rose-800 dark:text-rose-200 space-y-2">
            <p className="font-bold">This action cannot be undone.</p>
            <p className="leading-relaxed">
              All financial records, manually added transactions, linked email providers, active sessions, and budgets will be permanently destroyed from the database in compliance with privacy regulations.
            </p>
          </div>

          <div className="mt-6">
            <Button
              variant="danger"
              size="md"
              leftIcon={<Trash2 className="w-4 h-4" />}
              onClick={() => setIsDeleteModalOpen(true)}
            >
              Delete Entire SpendWise Account
            </Button>
          </div>

          {/* Delete Confirmation Modal */}
          <Modal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            title="Confirm Account Deletion"
            description="Type DELETE below to confirm irreversible removal of your account."
          >
            <div className="space-y-4">
              <Input
                label='Type "DELETE" to confirm'
                placeholder="DELETE"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
              />

              <div className="flex justify-end gap-2 pt-2">
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
                  Permanently Delete Everything
                </Button>
              </div>
            </div>
          </Modal>
        </Card>
      )}
    </div>
  );
};
