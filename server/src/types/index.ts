import { Types } from 'mongoose';

export type TransactionType = 'expense' | 'income' | 'transfer';
export type PaymentMethod = 'upi' | 'bank' | 'cash' | 'card' | 'wallet' | 'other';
export type TransactionSource = 'manual' | 'email' | 'import';
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
  | 'INBOUND_EMAIL_PROCESSED';

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
  transactionDate: Date;
  notes?: string;
  status: TransactionStatus;
  isRecurring: boolean;
  recurringTransactionId?: Types.ObjectId | string | null;
  metadata?: Record<string, unknown>;
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
  parse(email: EmailMessage): ParsedTransaction | null;
}

export interface EmailProvider {
  name: string;
  connect(authData?: unknown): Promise<boolean>;
  disconnect(): Promise<boolean>;
  sync(cursor?: string): Promise<{ messages: EmailMessage[]; newCursor?: string }>;
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
