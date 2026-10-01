export type TransactionType = 'expense' | 'income' | 'transfer';
export type PaymentMethod = 'upi' | 'bank' | 'cash' | 'card' | 'wallet' | 'other';
/**
 * `receipt_scan` is an attribution label for expenses created from the on-device
 * receipt/ticket scanner. It is a normal transaction everywhere else: dashboard,
 * transactions, calendar, reports, category totals and account balance all treat
 * it identically to `manual`. No receipt image is ever stored.
 */
export type TransactionSource = 'manual' | 'email' | 'import' | 'receipt_scan';
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
  refNo?: string;
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
  isDeleted?: boolean;
  isFavorite?: boolean;
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

export type GoalStatus = 'active' | 'completed';

export interface GoalContribution {
  _id: string;
  goalId: string;
  amount: number;
  accountId?: { _id: string; email: string; provider: string } | string | null;
  contributionDate: string;
  note?: string;
  createdAt: string;
}

export interface GoalComputed {
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  percentageComplete: number;
  monthsRemaining: number | null;
  requiredMonthlyContribution: number | null;
  expectedCompletionDate: string | null;
  isCompleted: boolean;
  isOverdue: boolean;
}

export interface Goal {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string | null;
  monthlyContribution?: number | null;
  categoryId?: Category | string | null;
  accountId?: { _id: string; email: string; provider: string } | string | null;
  icon: string;
  color: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  // Computed fields returned by the backend
  contributionCount?: number;
  computed?: GoalComputed;
  contributions?: GoalContribution[];
}

export interface GoalSummary {
  totalTargetAmount: number;
  totalSavedAmount: number;
  totalRemainingAmount: number;
  percentageComplete: number;
  activeCount: number;
  completedCount: number;
}

/** Per-day aggregate of confirmed transactions for the calendar grid. */
export interface CalendarDaySummary {
  date: string;
  income: number;
  expense: number;
  transfer: number;
  net: number;
  count: number;
}

/** A scheduled (not yet recorded) occurrence of an existing recurring item. */
export interface UpcomingOccurrence {
  recurringTransactionId: string;
  name: string;
  merchant: string;
  type: TransactionType;
  amount: number;
  categoryId?: Category | null;
  date: string;
  frequency: RecurringFrequency;
}

/** A goal deadline (`targetDate`) rendered as a calendar marker. */
export interface CalendarGoalMarker {
  id: string;
  name: string;
  date: string;
  targetAmount: number;
  remainingAmount: number;
  percentageComplete: number;
  icon: string;
  color: string;
  status: GoalStatus;
  isOverdue: boolean;
}

/** A debt due date rendered as a calendar marker. */
export interface CalendarDebtMarker {
  id: string;
  personName: string;
  date: string;
  originalAmount: number;
  remainingAmount: number;
  direction: DebtDirection;
  status: DebtStatus;
  isOverdue: boolean;
}

export interface CalendarDayDetail {
  date: string;
  transactions: Transaction[];
  summary: {
    income: number;
    expense: number;
    transfer: number;
    net: number;
    count: number;
  };
  scheduled: UpcomingOccurrence[];
  goals: CalendarGoalMarker[];
  debts: CalendarDebtMarker[];
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

export type DebtDirection = 'I_OWE' | 'OWED_TO_ME';
export type DebtStatus = 'ACTIVE' | 'PARTIALLY_PAID' | 'OVERDUE' | 'SETTLED';

export interface DebtPayment {
  _id: string;
  debtId: string;
  amount: number;
  paymentDate: string;
  accountId?: { _id: string; email: string; provider: string } | string | null;
  note?: string;
  createdAt: string;
}

export interface Debt {
  _id: string;
  userId: string;
  personId?: Person | string | null;
  personName: string;
  description?: string;
  originalAmount: number;
  direction: DebtDirection;
  debtDate: string;
  dueDate?: string | null;
  categoryId?: Category | string | null;
  accountId?: { _id: string; email: string; provider: string } | string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields returned by the backend
  totalPaid?: number;
  remainingAmount?: number;
  status?: DebtStatus;
  isOverdue?: boolean;
  payments?: DebtPayment[];
}

export type DebtCandidateStatus = 'PENDING' | 'ACCEPTED' | 'MATCHED' | 'IGNORED';
export type DebtCandidateMatch = 'EXACT_SETTLEMENT' | 'PARTIAL_PAYMENT' | 'NO_MATCH';

export interface DebtCandidate {
  _id: string;
  userId: string;
  personId?: Person | string | null;
  personName: string;
  vpa?: string | null;
  amount: number;
  currency: string;
  direction: DebtDirection;
  transactionDate: string;
  source: 'email' | 'import';
  refNo?: string | null;
  transactionId?: string | null;
  merchant: string;
  status: DebtCandidateStatus;
  match: DebtCandidateMatch;
  suggestedDebtId?: string | Debt | null;
  suggestedDebtRemaining?: number | null;
  confidence: number;
  createdAt: string;
}

export interface DebtSummary {
  totalIOwe: number;
  totalOwedToMe: number;
  netBalance: number;
  activeDebts: number;
  overdueDebts: number;
  settledDebts: number;
  partiallyPaidDebts: number;
}
