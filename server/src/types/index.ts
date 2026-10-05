import { Types } from 'mongoose';

/**
 * Mongoose's `Binary` wrapper, as returned by `.lean()` for Buffer fields.
 * Declared structurally so the types file keeps a single mongoose import.
 */
export type BinaryLike = { buffer: Uint8Array };

export type TransactionType = 'expense' | 'income' | 'transfer';
export type PaymentMethod = 'upi' | 'bank' | 'cash' | 'card' | 'wallet' | 'other';
/**
 * `receipt_scan` marks a transaction created from the on-device receipt/ticket
 * scanner. It behaves exactly like `manual` everywhere in the ledger and is
 * only an attribution label, so scanned expenses flow through the dashboard,
 * calendar, reports and category totals without any special casing.
 */
export type TransactionSource = 'manual' | 'email' | 'import' | 'receipt_scan';
export type TransactionStatus = 'pending' | 'confirmed' | 'ignored';

export type EmailProviderType = 'gmail' | 'mock' | 'outlook' | 'yahoo' | 'imap' | 'forwarding';
export type EmailAccountStatus = 'active' | 'paused' | 'error' | 'revoked';
export type DetectedTransactionStatus = 'detected' | 'confirmed' | 'rejected' | 'duplicate';

export type NotificationType = 
  | 'detected_transaction' 
  | 'budget_warning' 
  | 'budget_exceeded' 
  | 'sync_completed' 
  | 'sync_failed' 
  | 'system';

export type AuditAction = 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'PASSWORD_CHANGED' 
  | 'EMAIL_CONNECTED' 
  | 'EMAIL_DISCONNECTED' 
  | 'SYNC_STARTED' 
  | 'SYNC_COMPLETED' 
  | 'SYNC_FAILED' 
  | 'ACCOUNT_DELETED'
  | 'INBOUND_EMAIL_PROCESSED'
  | 'PASSKEY_REGISTERED'
  | 'PASSKEY_REMOVED';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface IUser {
  _id: Types.ObjectId | string;
  name: string;
  email: string;
  avatar?: string;
  passwordHash?: string;
  authProvider?: 'local' | 'google';
  googleId?: string;
  isEmailVerified: boolean;
  currency: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISession {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  refreshTokenHash: string;
  userAgent: string;
  ipAddress: string;
  device: string;
  browser: string;
  os: string;
  lastActive: Date;
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A WebAuthn / passkey credential owned by a user.
 *
 * Only public WebAuthn material is stored here: the credential ID, the
 * credential public key, the signature counter and authenticator metadata.
 * No biometric data (fingerprint, face, template) and no private key ever
 * reaches the server — the private key stays inside the user's authenticator
 * and the biometric check happens entirely on the device.
 */
export interface IWebAuthnCredential {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  /** Base64URL-encoded credential ID (unique across all users). */
  credentialId: string;
  /**
   * COSE-encoded credential public key. `Buffer` when hydrated through a
   * document; Mongoose's `Binary` wrapper is what `.lean()` projections yield,
   * so both shapes are accepted here and normalised by the repository.
   */
  publicKey: Buffer | BinaryLike;
  /** Authenticator signature counter, used to detect cloned authenticators. */
  counter: number;
  credentialType: string;
  /** 'singleDevice' (phone/laptop-bound) or 'multiDevice' (synced passkey). */
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  /** Authenticator transport hints (e.g. internal, hybrid, usb, nfc). */
  transports: string[];
  /** Authenticator AAGUID, identifies the authenticator model. */
  aaguid: string;
  attestationFormat: string;
  deviceName?: string;
  lastUsedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategory {
  _id: Types.ObjectId | string;
  userId?: Types.ObjectId | string | null; // null for system defaults
  name: string;
  type: 'expense' | 'income' | 'both';
  icon: string;
  color: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransaction {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  type: TransactionType;
  amount: number;
  currency: string;
  categoryId?: Types.ObjectId | string | null;
  subcategoryId?: Types.ObjectId | string | null;
  merchant: string;
  description?: string;
  paymentMethod: PaymentMethod;
  source: TransactionSource;
  sourceAccountId?: Types.ObjectId | string | null;
  externalTransactionId?: string;
  refNo?: string;
  transactionDate: Date;
  notes?: string;
  status: TransactionStatus;
  isRecurring: boolean;
  recurringTransactionId?: Types.ObjectId | string | null;
  personId?: Types.ObjectId | string | null;
  person_id?: Types.ObjectId | string | null;
  vpa?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPerson {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  name: string;
  normalizedName: string;
  vpa?: string | null;
  email?: string | null;
  isDeleted?: boolean;
  isFavorite?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDetectedTransaction {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  emailAccountId: Types.ObjectId | string;
  emailMessageId: string;
  amount: number;
  currency: string;
  merchant: string;
  transactionDate: Date;
  transactionType: 'expense' | 'income';
  upiReference?: string;
  bankReference?: string;
  sender: string;
  subject: string;
  rawMetadata?: Record<string, unknown>;
  confidenceScore: number;
  suggestedCategory?: string;
  categoryId?: Types.ObjectId | string | null;
  status: DetectedTransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailAccount {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  provider: EmailProviderType;
  email: string;
  providerAccountId?: string;
  forwardingAddress?: string;
  forwardingToken?: string;
  lastVerificationCode?: string;
  lastVerificationSubject?: string;
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
  tokenExpiresAt?: Date;
  status: EmailAccountStatus;
  lastSyncAt?: Date;
  syncCursor?: string;
  syncError?: string;
  detectedCount: number;
  syncFrequencyMinutes: number; // e.g., 15, 30, 60
  createdAt: Date;
  updatedAt: Date;
}

export interface IBudget {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  categoryId?: Types.ObjectId | string | null;
  name: string;
  amount: number;
  period: 'monthly' | 'yearly';
  startDate: Date;
  endDate: Date;
  notificationThreshold: number; // e.g. 80 for 80%
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecurringTransaction {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  name: string;
  amount: number;
  currency: string;
  type: TransactionType;
  categoryId?: Types.ObjectId | string | null;
  merchant: string;
  paymentMethod: PaymentMethod;
  frequency: RecurringFrequency;
  startDate: Date;
  endDate?: Date | null;
  nextDueDate: Date;
  lastProcessedDate?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type GoalStatus = 'active' | 'completed';

export interface IGoalContribution {
  _id: Types.ObjectId | string;
  goalId: Types.ObjectId | string;
  amount: number;
  accountId?: Types.ObjectId | string | null;
  contributionDate: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGoal {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: Date | null;
  monthlyContribution?: number | null;
  categoryId?: Types.ObjectId | string | null;
  accountId?: Types.ObjectId | string | null;
  icon: string;
  color: string;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Derived goal figures computed by the goal service. Never persisted, so the
 * stored `currentAmount` stays the single source of truth for progress.
 */
export interface GoalComputed {
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  percentageComplete: number;
  monthsRemaining: number | null;
  requiredMonthlyContribution: number | null;
  expectedCompletionDate: Date | null;
  isCompleted: boolean;
  isOverdue: boolean;
}

export interface GoalWithProgress extends IGoal {
  contributionCount: number;
  computed: GoalComputed;
}

/** One projected occurrence of an existing recurring transaction. */
export interface UpcomingOccurrence {
  recurringTransactionId: string;
  name: string;
  merchant: string;
  type: TransactionType;
  amount: number;
  categoryId?: unknown;
  date: string;
  frequency: RecurringFrequency;
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

/** A goal deadline (its `targetDate`) rendered on the calendar. */
export interface CalendarGoalMarker {
  id: string;
  name: string;
  /** `YYYY-MM-DD` day key. */
  date: string;
  targetAmount: number;
  remainingAmount: number;
  percentageComplete: number;
  icon: string;
  color: string;
  status: GoalStatus;
  isOverdue: boolean;
}

/** A debt due date rendered on the calendar. */
export interface CalendarDebtMarker {
  id: string;
  personName: string;
  /** `YYYY-MM-DD` day key. */
  date: string;
  originalAmount: number;
  remainingAmount: number;
  direction: 'I_OWE' | 'OWED_TO_ME';
  status: 'ACTIVE' | 'PARTIALLY_PAID' | 'OVERDUE' | 'SETTLED';
  isOverdue: boolean;
}

export interface INotification {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditLog {
  _id: Types.ObjectId | string;
  userId?: Types.ObjectId | string | null;
  action: AuditAction;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Email & Parser Abstraction Types
export interface EmailMessage {
  id: string;
  threadId?: string;
  sender: string;
  recipient?: string;
  subject: string;
  date: Date;
  snippet?: string;
  bodyText: string;
  bodyHtml?: string;
  headers?: Record<string, string>;
}

export interface ParsedTransaction {
  amount: number;
  currency: string;
  type: 'expense' | 'income';
  merchant: string;
  transactionDate: Date;
  upiReference?: string;
  bankReference?: string;
  refNo?: string;
  paymentMethod: PaymentMethod;
  confidenceScore: number; // 0 to 100
  notes?: string;
  sender?: string;
  categoryHint?: string;
  rawDetails?: Record<string, unknown>;
}

export interface TransactionEmailParser {
  name: string;
  canParse(email: EmailMessage): boolean;
  parse(email: EmailMessage): Promise<ParsedTransaction | null>;
}

export interface SyncOptions {
  month?: number; // 1 - 12
  year?: number;  // e.g. 2026
}

export interface EmailProvider {
  name: string;
  connect(authData?: unknown): Promise<boolean>;
  disconnect(): Promise<boolean>;
  sync(cursor?: string, options?: SyncOptions): Promise<{ messages: EmailMessage[]; newCursor?: string }>;
  getMessages(query?: string, maxResults?: number): Promise<EmailMessage[]>;
}

// API Standard Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  errors?: unknown[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserSessionPayload {
  userId: string;
  email: string;
  sessionId: string;
}

export type DebtDirection = 'I_OWE' | 'OWED_TO_ME';
export type DebtStatus = 'ACTIVE' | 'PARTIALLY_PAID' | 'OVERDUE' | 'SETTLED';

export interface IDebtPayment {
  _id: Types.ObjectId | string;
  debtId: Types.ObjectId | string;
  amount: number;
  paymentDate: Date;
  accountId?: Types.ObjectId | string | null;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A P2P transaction that *may* represent a debt movement.
 * Created for every person-to-person UPI/payment detected via email sync or
 * statement import, never as an automatic debt. The user reviews each one and
 * decides: add a new debt, match an existing debt as a payment, or ignore.
 *
 * Detection is structural (is this P2P at all?) and relational (does an open
 * debt for this person fit?), never keyword based. Bank UPI alerts contain no
 * debt wording, so keywords are useless here.
 */
export type DebtCandidateStatus = 'PENDING' | 'ACCEPTED' | 'MATCHED' | 'IGNORED';
export type DebtCandidateMatch = 'EXACT_SETTLEMENT' | 'PARTIAL_PAYMENT' | 'NO_MATCH';

export interface IDebtCandidate {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  personId?: Types.ObjectId | string | null;
  personName: string;
  vpa?: string | null;
  amount: number;
  currency: string;
  direction: DebtDirection;
  transactionDate: Date;
  source: 'email' | 'import';
  refNo?: string | null;
  refNoNormalized?: string | null;
  transactionId?: Types.ObjectId | string | null;
  sourceAccountId?: Types.ObjectId | string | null;
  merchant: string;
  status: DebtCandidateStatus;
  match: DebtCandidateMatch;
  suggestedDebtId?: Types.ObjectId | string | null;
  suggestedDebtRemaining?: number | null;
  confidence: number;
  resolvedDebtId?: Types.ObjectId | string | null;
  resolvedPaymentId?: Types.ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDebt {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  personId?: Types.ObjectId | string | null;
  personName: string;
  description?: string;
  originalAmount: number;
  direction: DebtDirection;
  debtDate: Date;
  dueDate?: Date | null;
  categoryId?: Types.ObjectId | string | null;
  accountId?: Types.ObjectId | string | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AccountType = 'bank' | 'cash' | 'credit_card' | 'wallet' | 'investment' | 'other';

export interface IAccount {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  institutionName?: string;
  accountNumberMasked?: string;
  color?: string;
  isDefault?: boolean;
  isActive?: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

