import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch } from '../store/index.js';
import { checkAuthThunk } from '../store/slices/authSlice.js';
import { MainLayout } from '../layouts/MainLayout.js';

// Pages
import { DashboardPage } from '../pages/DashboardPage.js';
import { TransactionsPage } from '../pages/TransactionsPage.js';
import { BudgetsPage } from '../pages/BudgetsPage.js';
import { RecurringPage } from '../pages/RecurringPage.js';
import { EmailSyncPage } from '../pages/EmailSyncPage.js';
import { ReportsPage } from '../pages/ReportsPage.js';
import { SettingsPage } from '../pages/SettingsPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { RegisterPage } from '../pages/RegisterPage.js';
import { AuthCallbackPage } from '../pages/AuthCallbackPage.js';
import { PeoplePage } from '../pages/PeoplePage.js';
import { DebtsPage } from '../pages/DebtsPage.js';
import { GoalsPage } from '../pages/GoalsPage.js';
import { GoalDetailsPage } from '../pages/GoalDetailsPage.js';
import { CalendarPage } from '../pages/CalendarPage.js';
import { ToastContainer } from '../components/ui/Toast.js';

export const App: React.FC = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Attempt automatic authentication on initial load via HttpOnly refresh cookie
    dispatch(checkAuthThunk());
  }, [dispatch]);

  return (
    <>
      <ToastContainer />
      <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Protected App Routes */}
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="people/:id" element={<PeoplePage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="goals/:id" element={<GoalDetailsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="recurring" element={<RecurringPage />} />
        <Route path="email-sync" element={<EmailSyncPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="debts" element={<DebtsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </>
  );
};
