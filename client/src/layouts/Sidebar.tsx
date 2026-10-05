import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  Tags,
  Settings,
  ShieldCheck,
  Moon,
  Sun,
  Laptop,
  Coins,
  ChevronDown,
  ChevronRight,
  FileText,
  FileSpreadsheet,
  UploadCloud,
  Landmark,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../store/index.js';
import { setThemeMode } from '../store/slices/themeSlice.js';
import { fetchCategoriesThunk } from '../store/slices/categorySlice.js';

interface SidebarProps {
  onCloseMobile?: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string; color?: string }>;
  color: string;
  badge?: number | string;
  badgeVariant?: 'brand' | 'neutral';
}

interface NavSection {
  id: string;
  title: string;
  accentColor: string;
  items: NavItem[];
}

const STORAGE_KEY = 'spendwise_sidebar_collapsed_sections_v1';

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const themeMode = useAppSelector((state) => state.theme.mode);
  const pendingCount = useAppSelector(
    (state) => state.detectedTransactions.pendingTransactions.length
  );
  const categories = useAppSelector((state) => state.categories.categories);

  // Fetch categories if not yet present to show category count badge
  useEffect(() => {
    if (categories.length === 0) {
      dispatch(fetchCategoriesThunk());
    }
  }, [dispatch, categories.length]);

  // Collapsible section state with local storage persistence
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  };

  const navSections: NavSection[] = useMemo(
    () => [
      {
        id: 'overview',
        title: 'Overview',
        accentColor: '#4f46e5',
        items: [
          { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, color: '#4f46e5' },
        ],
      },
      {
        id: 'finances',
        title: 'Finances',
        accentColor: '#f43f5e',
        items: [
          { label: 'Transactions', to: '/transactions', icon: Receipt, color: '#f43f5e' },
          { label: 'Accounts', to: '/accounts', icon: Landmark, color: '#0ea5e9' },
          { label: 'Recurring Bills', to: '/recurring', icon: Repeat, color: '#8b5cf6' },
          { label: 'Debts & Loans', to: '/debts', icon: Coins, color: '#f59e0b' },
          { label: 'People & Splits', to: '/people', icon: Users, color: '#ec4899' },
        ],
      },
      {
        id: 'planning',
        title: 'Planning & Budgets',
        accentColor: '#10b981',
        items: [
          { label: 'Budgets', to: '/budgets', icon: PiggyBank, color: '#10b981' },
          { label: 'Financial Goals', to: '/goals', icon: Target, color: '#14b8a6' },
          { label: 'Calendar', to: '/calendar', icon: CalendarDays, color: '#0ea5e9' },
        ],
      },
      {
        id: 'intelligence',
        title: 'Intelligence & Reports',
        accentColor: '#3b82f6',
        items: [
          {
            label: 'Email Sync',
            to: '/email-sync',
            icon: MailCheck,
            color: '#3b82f6',
            badge: pendingCount > 0 ? pendingCount : undefined,
            badgeVariant: 'brand',
          },
          { label: 'Reports', to: '/reports', icon: BarChart3, color: '#a855f7' },
        ],
      },
      {
        id: 'import_export',
        title: 'Import / Export',
        accentColor: '#06b6d4',
        items: [
          { label: 'Export PDF file', to: '/export/pdf', icon: FileText, color: '#f43f5e' },
          { label: 'Export Excel/CSV file', to: '/export/excel', icon: FileSpreadsheet, color: '#10b981' },
          { label: 'Import CSV/XLS file', to: '/transactions?import=true', icon: UploadCloud, color: '#06b6d4' },
        ],
      },
      {
        id: 'settings',
        title: 'Settings & Config',
        accentColor: '#f97316',
        items: [
          {
            label: 'Categories',
            to: '/categories',
            icon: Tags,
            color: '#f97316',
            badge: categories.length > 0 ? categories.length : undefined,
            badgeVariant: 'neutral',
          },
          { label: 'Settings', to: '/settings', icon: Settings, color: '#6366f1' },
        ],
      },
    ],
    [pendingCount, categories.length]
  );

  // Auto-expand any collapsed section if active route falls inside it
  useEffect(() => {
    const currentPath = location.pathname;
    navSections.forEach((section) => {
      const hasActiveChild = section.items.some(
        (item) => currentPath === item.to || currentPath.startsWith(`${item.to}/`)
      );
      if (hasActiveChild && collapsedSections[section.id]) {
        setCollapsedSections((prev) => {
          const next = { ...prev, [section.id]: false };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
    });
  }, [location.pathname, navSections, collapsedSections]);

  return (
    <aside className="w-64 h-full flex flex-col justify-between bg-white dark:bg-[#0b101d] border-r border-slate-200/80 dark:border-white/5 transition-colors select-none">
      {/* Brand Header */}
      <div className="h-16 flex-shrink-0 flex items-center gap-3 px-6 border-b border-slate-100 dark:border-white/5">
        <NavLink
          to="/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-3 group focus:outline-none"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-emerald-700 flex items-center justify-center text-white shadow-glow-emerald font-extrabold text-base tracking-tighter group-hover:scale-105 transition-transform">
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
        </NavLink>
      </div>

      {/* Categorized Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4">
        {navSections.map((section) => {
          const isCollapsed = !!collapsedSections[section.id];
          const hasActiveChild = section.items.some(
            (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
          );
          const sectionBadgeCount = section.items.reduce((acc, curr) => {
            return typeof curr.badge === 'number' ? acc + curr.badge : acc;
          }, 0);

          return (
            <div key={section.id} className="space-y-1">
              {/* Category Section Header */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-left group hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors focus:outline-none"
                aria-expanded={!isCollapsed}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: section.accentColor }}
                  />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                    {section.title}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Collapsed Pill Badge Indicator */}
                  {isCollapsed && sectionBadgeCount > 0 && (
                    <span className="bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/30 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                      {sectionBadgeCount}
                    </span>
                  )}
                  {/* Collapsed Active Indicator Dot */}
                  {isCollapsed && hasActiveChild && !sectionBadgeCount && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400" />
                  )}
                  <span className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </span>
                </div>
              </button>

              {/* Category Section Items */}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={onCloseMobile}
                        className={({ isActive }) =>
                          `group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold tracking-tight transition-[background-color,border-color,color] duration-150 ease-out-expo relative border ${
                            isActive
                              ? 'shadow-2xs font-bold'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 border-transparent'
                          }`
                        }
                        style={({ isActive }) =>
                          isActive
                            ? {
                                backgroundColor: `${item.color}15`,
                                borderColor: `${item.color}35`,
                                color: item.color,
                              }
                            : undefined
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span
                                className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
                                style={{ backgroundColor: item.color }}
                              />
                            )}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 border"
                                style={{
                                  backgroundColor: isActive ? `${item.color}22` : `${item.color}10`,
                                  borderColor: isActive ? `${item.color}45` : `${item.color}20`,
                                  color: item.color,
                                }}
                              >
                                <Icon className="w-3.5 h-3.5" color={item.color} />
                              </div>
                              <span className="truncate">{item.label}</span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {item.to === '/categories' && categories.length > 0 && (
                                <div className="flex items-center -space-x-1 mr-0.5">
                                  {categories.slice(0, 4).map((c, i) => (
                                    <span
                                      key={c._id || i}
                                      className="w-2 h-2 rounded-full border border-white dark:border-[#0b101d]"
                                      style={{ backgroundColor: c.color || '#f97316' }}
                                      title={c.name}
                                    />
                                  ))}
                                </div>
                              )}

                              {item.badge !== undefined && (
                                <span
                                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                                    item.badgeVariant === 'brand' || !item.badgeVariant
                                      ? 'bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/30'
                                      : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/50 dark:border-white/5'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Info & Theme Control */}
      <div className="flex-shrink-0 p-4 border-t border-slate-100 dark:border-white/5 space-y-3">
        {/* Privacy Note */}
        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-xl p-2.5 flex items-start gap-2.5 border border-slate-200/60 dark:border-white/5">
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
            className={`flex-1 py-1 flex items-center justify-center rounded-lg text-xs font-semibold tracking-tight transition-[background-color,border-color,color] duration-150 ease-out-expo ${
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
            className={`flex-1 py-1 flex items-center justify-center rounded-lg text-xs font-semibold tracking-tight transition-[background-color,border-color,color] duration-150 ease-out-expo ${
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
            className={`flex-1 py-1 flex items-center justify-center rounded-lg text-xs font-semibold tracking-tight transition-[background-color,border-color,color] duration-150 ease-out-expo ${
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
