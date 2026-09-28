import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, PiggyBank, Plus, Menu } from 'lucide-react';

interface MobileNavigationProps {
  onOpenAddModal: () => void;
  onOpenMoreMenu: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  onOpenAddModal,
  onOpenMoreMenu,
}) => {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 dark:bg-[#0b101d]/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/5 z-40 px-4 flex items-center justify-around shadow-fintech-lg">
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-1 px-2 gap-1 text-[10px] font-bold tracking-tight transition-all duration-150 ${
            isActive
              ? 'text-brand-600 dark:text-brand-400 scale-105'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`
        }
      >
        <LayoutDashboard className="w-5 h-5" />
        <span>Home</span>
      </NavLink>

      <NavLink
        to="/transactions"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-1 px-2 gap-1 text-[10px] font-bold tracking-tight transition-all duration-150 ${
            isActive
              ? 'text-brand-600 dark:text-brand-400 scale-105'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`
        }
      >
        <Receipt className="w-5 h-5" />
        <span>Transactions</span>
      </NavLink>

      {/* Floating Center Add Button */}
      <div className="-mt-7">
        <button
          onClick={onOpenAddModal}
          className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 text-white flex items-center justify-center shadow-glow-emerald active:scale-95 transition-transform border border-emerald-300/30"
          aria-label="Add transaction"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      <NavLink
        to="/budgets"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-1 px-2 gap-1 text-[10px] font-bold tracking-tight transition-all duration-150 ${
            isActive
              ? 'text-brand-600 dark:text-brand-400 scale-105'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`
        }
      >
        <PiggyBank className="w-5 h-5" />
        <span>Budgets</span>
      </NavLink>

      <button
        onClick={onOpenMoreMenu}
        aria-label="Open more navigation"
        className="flex flex-col items-center justify-center py-1 px-2 gap-1 text-[10px] font-bold tracking-tight text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        <Menu className="w-5 h-5" />
        <span>More</span>
      </button>
    </nav>
  );
};
