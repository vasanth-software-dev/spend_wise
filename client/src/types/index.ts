export type TransactionType = 'expense' | 'income' | 'transfer';
export type PaymentMethod = 'upi' | 'bank' | 'cash' | 'card' | 'wallet' | 'other';
export type TransactionSource = 'manual' | 'email' | 'import';
export type TransactionStatus = 'pending' | 'confirmed' | 'ignored';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  currency: string;
  timezone: string;
  isEmailVerified: boolean;
  authProvider?: 'local' | 'google';
  createdAt: string;
}

export interface Category {
  _id: string;
  userId?: string | null;
  name: string;
  type: 'expense' | 'income' | 'both';
  icon: string;
  color: string;
  isDefault: boolean;
}

export interface Transaction {
  _id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  categoryId?: Category | string | null;
  merchant: string;
  description?: string;
  paymentMethod: PaymentMethod;
  source: TransactionSource;
  sourceAccountId?: { _id: string; email: string; provider: string } | string | null;
  externalTransactionId?: string;
  transactionDate: string;
  notes?: string;
  status: TransactionStatus;
  isRecurring: boolean;
  personId?: Person | string | null;
  person_id?: Person | string | null;
  vpa?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Person {
  _id: string;
  name: string;
  normalizedName?: string;
  vpa?: string | null;
  email?: string | null;
  transactionCount?: number;
  totalAmount?: number;
  totalSent?: number;
  totalReceived?: number;
  lastTransactionDate?: string | null;
  recentTransactions?: {
    _id: string;
    amount: number;
    type: TransactionType;
    merchant: string;
    transactionDate: string;
    paymentMethod?: string;
    notes?: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DetectedTransaction {
  _id: string;
  userId: string;
  emailAccountId: string;
  emailMessageId: string;
  amount: number;
  currency: string;
  merchant: string;
  transactionDate: string;
  transactionType: 'expense' | 'income';
  upiReference?: string;
  bankReference?: string;
  sender: string;
  subject: string;
  rawMetadata?: Record<string, unknown>;
  confidenceScore: number;
  suggestedCategory?: string;
  categoryId?: string;
  status: 'detected' | 'confirmed' | 'rejected' | 'duplicate';
  createdAt: string;
}

export interface EmailAccount {
  _id: string;
  userId: string;
  provider: 'gmail' | 'mock' | 'outlook' | 'yahoo' | 'imap' | 'forwarding';
  email: string;
  providerAccountId?: string;
  forwardingAddress?: string;
  forwardingToken?: string;
  lastVerificationCode?: string;
  lastVerificationSubject?: string;
  status: 'active' | 'paused' | 'error' | 'revoked';
  lastSyncAt?: string;
  syncCursor?: string;
  syncError?: string;
  detectedCount: number;
  syncFrequencyMinutes: number;
  createdAt: string;
}

export interface Budget {
  _id: string;
  userId: string;
  categoryId?: Category | string | null;
  name: string;
  amount: number;
  period: 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  notificationThreshold: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  isExceeded: boolean;
  isWarning: boolean;
}

export interface RecurringTransaction {
  _id: string;
  userId: string;
  name: string;
  amount: number;
  currency: string;
  type: TransactionType;
  categoryId?: Category | string | null;
  merchant: string;
  paymentMethod: PaymentMethod;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string | null;
  nextDueDate: string;
  isActive: boolean;
}

export interface NotificationItem {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardSummary {
  totalBalance: number;
  incomeThisMonth: number;
  expensesThisMonth: number;
  savingsThisMonth: number;
  savingsRate: number;
}

export interface SpendingTrendPoint {
  date: string;
  income: number;
  expense: number;
  savings: number;
}

export interface CategoryBreakdownItem {
  _id: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  totalAmount: number;
  count: number;
}

export interface TopMerchantItem {
  merchant: string;
  totalAmount: number;
  count: number;
}

export interface PaymentDistributionItem {
  paymentMethod: string;
  totalAmount: number;
  count: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
