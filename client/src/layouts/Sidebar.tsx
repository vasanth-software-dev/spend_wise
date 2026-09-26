import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Repeat,
  MailCheck,
  BarChart3,
  Settings,
  ShieldCheck,
  Moon,
  Sun,
  Laptop,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../store/index.js';
import { setThemeMode } from '../store/slices/themeSlice.js';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((state) => state.theme.mode);
  const pendingCount = useAppSelector(
    (state) => state.detectedTransactions.pendingTransactions.length
  );

  const navItems = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Transactions', to: '/transactions', icon: Receipt },
    { label: 'Budgets', to: '/budgets', icon: PiggyBank },
    { label: 'Recurring Bills', to: '/recurring', icon: Repeat },
    {
      label: 'Email Sync',
      to: '/email-sync',
      icon: MailCheck,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    { label: 'Reports', to: '/reports', icon: BarChart3 },
    { label: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 h-full flex flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-colors">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-sm font-bold text-lg">
            ₹
          </div>
          <div>
            <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-lg">
              SpendWise
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-brand-600 dark:text-brand-400 font-semibold">
              Fintech Intelligence
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="bg-brand-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Theme Control */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
        {/* Privacy Note */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Bank-Grade Privacy:</span>{' '}
            Zero PINs, passwords, or OTPs stored.
          </div>
        </div>

        {/* Theme Mode Selector */}
        <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => dispatch(setThemeMode('light'))}
            className={`flex-1 py-1 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
              themeMode === 'light'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Sun className="w-3.5 h-3.5 mr-1" />
            Light
          </button>
          <button
            onClick={() => dispatch(setThemeMode('dark'))}
            className={`flex-1 py-1 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
              themeMode === 'dark'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Moon className="w-3.5 h-3.5 mr-1" />
            Dark
          </button>
          <button
            onClick={() => dispatch(setThemeMode('system'))}
            className={`flex-1 py-1 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
              themeMode === 'system'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 mr-1" />
            Auto
          </button>
        </div>
      </div>
    </aside>
  );
};
