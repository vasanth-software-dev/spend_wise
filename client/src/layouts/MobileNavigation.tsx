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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 z-40 px-3 flex items-center justify-around shadow-premium">
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors ${
            isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`
        }
      >
        <LayoutDashboard className="w-5 h-5" />
        <span>Home</span>
      </NavLink>

      <NavLink
        to="/transactions"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors ${
            isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`
        }
      >
        <Receipt className="w-5 h-5" />
        <span>Transactions</span>
      </NavLink>

      {/* Floating Center Add Button */}
      <div className="-mt-6">
        <button
          onClick={onOpenAddModal}
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-brand-600 to-emerald-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          aria-label="Add transaction"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      <NavLink
        to="/budgets"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors ${
            isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`
        }
      >
        <PiggyBank className="w-5 h-5" />
        <span>Budgets</span>
      </NavLink>

      <button
        onClick={onOpenMoreMenu}
        className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
      >
        <Menu className="w-5 h-5" />
        <span>More</span>
      </button>
    </nav>
  );
};
