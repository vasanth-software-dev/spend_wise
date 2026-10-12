import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from './slices/authSlice.js';
import dashboardReducer from './slices/dashboardSlice.js';
import transactionReducer from './slices/transactionSlice.js';
import categoryReducer from './slices/categorySlice.js';
import budgetReducer from './slices/budgetSlice.js';
import recurringReducer from './slices/recurringSlice.js';
import emailAccountReducer from './slices/emailAccountSlice.js';
import detectedTransactionReducer from './slices/detectedTransactionSlice.js';
import notificationReducer from './slices/notificationSlice.js';
import themeReducer from './slices/themeSlice.js';
import debtReducer from './slices/debtSlice.js';
import debtCandidateReducer from './slices/debtCandidateSlice.js';
import goalReducer from './slices/goalSlice.js';
import calendarReducer from './slices/calendarSlice.js';
import accountReducer from './slices/accountSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    transactions: transactionReducer,
    categories: categoryReducer,
    budgets: budgetReducer,
    recurring: recurringReducer,
    emailAccounts: emailAccountReducer,
    detectedTransactions: detectedTransactionReducer,
    notifications: notificationReducer,
    theme: themeReducer,
    debts: debtReducer,
    debtCandidates: debtCandidateReducer,
    goals: goalReducer,
    calendar: calendarReducer,
    accounts: accountReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
