import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  Plus,
  LogOut,
  User as UserIcon,
  CheckCircle,
  AlertTriangle,
  Mail,
  ChevronDown,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../store/index.js';
import { logoutThunk } from '../store/slices/authSlice.js';
import { markReadThunk, markAllReadThunk } from '../store/slices/notificationSlice.js';
import { Button } from '../components/ui/Button.js';
import { setFilters } from '../store/slices/transactionSlice.js';

interface NavbarProps {
  onToggleMobileMenu: () => void;
  onOpenAddModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleMobileMenu,
  onOpenAddModal,
}) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { notifications, unreadCount } = useAppSelector((state) => state.notifications);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      dispatch(setFilters({ search: searchQuery.trim() }));
      navigate('/transactions');
    }
  };

  const handleLogout = () => {
    dispatch(logoutThunk());
    navigate('/login');
  };

  return (
    <header className="h-16 px-4 sm:px-6 bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/5 flex items-center justify-between sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        {/* Mobile menu button */}
        <button
          onClick={onToggleMobileMenu}
          aria-label="Toggle mobile menu"
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="hidden sm:flex items-center relative w-full max-w-sm group">
          <Search className="w-4 h-4 text-slate-400 group-focus-within:text-brand-500 absolute left-3.5 pointer-events-none transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search merchant, UPI ID, amount..."
            className="w-full bg-slate-100/80 dark:bg-slate-850/80 text-xs sm:text-sm pl-10 pr-12 py-2 rounded-xl border border-transparent focus:border-brand-500/50 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-[border-color,background-color,box-shadow] duration-150 ease-out-expo placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
          />
          <div className="absolute right-3 hidden lg:flex items-center pointer-events-none">
            <kbd className="text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
              /
            </kbd>
          </div>
        </form>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* "+ Add Transaction" button */}
        <Button
          onClick={onOpenAddModal}
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
          className="shadow-2xs"
        >
          <span className="hidden sm:inline">Add Transaction</span>
          <span className="sm:hidden">Add</span>
        </Button>

        {/* Notification Center */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            aria-label="Open notifications"
            className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 border border-transparent hover:border-slate-200 dark:hover:border-white/5 transition-[background-color,border-color] duration-150 ease-out-expo"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#090d16]" />
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#0e1424] border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-fintech-lg p-4 z-50 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => dispatch(markAllReadThunk())}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800/80 max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No new notifications
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n._id}
                      onClick={() => !n.isRead && dispatch(markReadThunk(n._id))}
                      className={`py-3 px-2 flex items-start gap-3 rounded-xl cursor-pointer transition-colors ${
                        n.isRead
                          ? 'opacity-70 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          : 'bg-brand-500/10 dark:bg-brand-950/30 border border-brand-500/15'
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {n.type === 'detected_transaction' && (
                          <Mail className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        )}
                        {(n.type === 'budget_warning' || n.type === 'budget_exceeded') && (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        )}
                        {n.type === 'system' && (
                          <CheckCircle className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 text-xs">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {n.title}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed font-normal">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile & Menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            aria-label="User account menu"
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-850 border border-transparent hover:border-slate-200 dark:hover:border-white/5 transition-[background-color,border-color] duration-150 ease-out-expo"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-emerald-400 ring-2 ring-brand-500/20 flex items-center justify-center text-white text-xs font-bold uppercase shadow-2xs">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="hidden md:block text-left text-xs leading-tight">
              <span className="font-bold text-slate-800 dark:text-slate-200 block truncate max-w-[120px]">
                {user?.name || 'User'}
              </span>
              <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-mono font-semibold block mt-0.5">
                {user?.currency || 'INR'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#0e1424] border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-fintech-lg p-2 z-50 animate-in zoom-in-95 duration-150">
              <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">Signed in as</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                  {user?.email}
                </span>
              </div>
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  navigate('/settings');
                }}
                className="w-full mt-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-2.5 text-left transition-colors"
              >
                <UserIcon className="w-4 h-4 text-slate-400" />
                Settings & Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 text-left transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
