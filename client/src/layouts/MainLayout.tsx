import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAppSelector } from '../store/index.js';
import { Sidebar } from './Sidebar.js';
import { Navbar } from './Navbar.js';
import { MobileNavigation } from './MobileNavigation.js';
import { TransactionModal } from '../features/transactions/TransactionModal.js';
import { Loader2 } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const { isAuthenticated, isInitializing } = useAppSelector((state) => state.auth);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Still checking initial HttpOnly cookie refresh token
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-bold text-xl mb-4 animate-pulse">
          ₹
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
          <span>Starting SpendWise Session...</span>
        </div>
      </div>
    );
  }

  // Not authenticated -> redirect to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors">
      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden lg:block w-64 h-screen sticky top-0 flex-shrink-0 z-30">
        <Sidebar />
      </div>

      {/* Mobile Drawer (visible when isMobileMenuOpen) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-64 h-full bg-white dark:bg-slate-900 z-10 shadow-2xl">
            <Sidebar onCloseMobile={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-6">
        <Navbar
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenAddModal={() => setIsAddModalOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNavigation
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenMoreMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* Global Quick Add Transaction Modal */}
      <TransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};
