import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Users,
  PiggyBank,
  Repeat,
  Target,
  CalendarDays,
  MailCheck,
  BarChart3,
  Settings,
  ShieldCheck,
  Moon,
  Sun,
  Laptop,
  Coins,
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
    { label: 'People', to: '/people', icon: Users },
    { label: 'Budgets', to: '/budgets', icon: PiggyBank },
    { label: 'Goals', to: '/goals', icon: Target },
    { label: 'Calendar', to: '/calendar', icon: CalendarDays },
    { label: 'Debts', to: '/debts', icon: Coins },
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
    <aside className="w-64 h-full flex flex-col justify-between bg-white dark:bg-[#0b101d] border-r border-slate-200/80 dark:border-white/5 transition-colors">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100 dark:border-white/5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-emerald-700 flex items-center justify-center text-white shadow-glow-emerald font-extrabold text-base tracking-tighter">
            ₹
          </div>
          <div>
            <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-base sm:text-lg block leading-none">
              SpendWise
            </span>
            <span className="block text-[9px] uppercase tracking-widest text-brand-600 dark:text-brand-400 font-bold mt-1">
              Fintech Platform
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3.5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold tracking-tight transition-all duration-150 relative ${
                    isActive
                      ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive
                            ? 'text-brand-600 dark:text-brand-400'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className="bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/30 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Theme Control */}
      <div className="p-4 border-t border-slate-100 dark:border-white/5 space-y-3">
        {/* Privacy Note */}
        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-xl p-3 flex items-start gap-2.5 border border-slate-200/60 dark:border-white/5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Bank-Grade Privacy:</span>{' '}
            Zero PINs, passwords, or OTPs stored.
          </div>
        </div>

        {/* Theme Mode Selector */}
        <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-850 p-1 rounded-xl border border-slate-200/60 dark:border-white/5">
          <button
            onClick={() => dispatch(setThemeMode('light'))}
            className={`flex-1 py-1 flex items-center justify-center rounded-lg text-xs font-semibold tracking-tight transition-all ${
              themeMode === 'light'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Sun className="w-3.5 h-3.5 mr-1" />
            Light
          </button>
          <button
            onClick={() => dispatch(setThemeMode('dark'))}
            className={`flex-1 py-1 flex items-center justify-center rounded-lg text-xs font-semibold tracking-tight transition-all ${
              themeMode === 'dark'
                ? 'bg-[#151f34] text-white shadow-2xs font-bold border border-white/10'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Moon className="w-3.5 h-3.5 mr-1" />
            Dark
          </button>
          <button
            onClick={() => dispatch(setThemeMode('system'))}
            className={`flex-1 py-1 flex items-center justify-center rounded-lg text-xs font-semibold tracking-tight transition-all ${
              themeMode === 'system'
                ? 'bg-white dark:bg-[#151f34] text-slate-900 dark:text-white shadow-2xs font-bold'
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
