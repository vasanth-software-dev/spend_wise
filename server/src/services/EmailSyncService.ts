import { emailAccountRepository } from '../repositories/EmailAccountRepository.js';
import { detectedTransactionRepository } from '../repositories/DetectedTransactionRepository.js';
import { notificationRepository } from '../repositories/NotificationRepository.js';
import { auditLogRepository } from '../repositories/AuditLogRepository.js';
import { duplicateDetectionService } from './DuplicateDetectionService.js';
import { emailParserRegistry } from '../providers/parsers/EmailParserRegistry.js';
import { GmailProvider } from '../providers/gmail/GmailProvider.js';
import { MockEmailProvider } from '../providers/email/MockEmailProvider.js';
import { encrypt } from '../utils/encryption.js';
import { EmailProvider, IEmailAccount, IDetectedTransaction, EmailMessage } from '../types/index.js';
import { Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { env } from '../config/env.js';
import {
  extractForwardingToken,
  extractGmailVerificationCode,
  unwrapForwardedEmail,
} from '../utils/inboundEmailUnwrapper.js';

export class EmailSyncService {
  /**
   * Connect a mock email account for instant local zero-cost testing.
   */
  async connectMockAccount(userId: string, email: string): Promise<IEmailAccount> {
    const existing = await emailAccountRepository.findByEmail(userId, email);
    if (existing) {
      return existing;
    }

    const account = await emailAccountRepository.create({
      userId: new Types.ObjectId(userId),
      provider: 'mock',
      email: email.toLowerCase(),
      status: 'active',
      syncFrequencyMinutes: 30,
    });

    await auditLogRepository.log({
      userId,
      action: 'EMAIL_CONNECTED',
      metadata: { provider: 'mock', email },
    });

    return account;
  }

  /**
   * Set up a unique auto-forwarding email address for the user.
   * Completely bypasses Google OAuth verification and allows instant ingestion.
   */
  async setupForwardingAccount(userId: string): Promise<IEmailAccount> {
    const existing = await emailAccountRepository.findForwardingByUserId(userId);
    if (existing) {
      return existing;
    }

    const token = randomBytes(4).toString('hex').toLowerCase();
    const domain = env.INBOUND_FORWARDING_DOMAIN || 'sync.spendwise.local';
    const forwardingAddress = `sync-${token}@${domain}`;

    const account = await emailAccountRepository.create({
      userId: new Types.ObjectId(userId),
      provider: 'forwarding',
      email: forwardingAddress,
      forwardingAddress,
      forwardingToken: token,
      status: 'active',
      syncFrequencyMinutes: 0, // Real-time push
    });

    await auditLogRepository.log({
      userId,
      action: 'EMAIL_CONNECTED',
      metadata: { provider: 'forwarding', forwardingAddress, token },
    });

    return account;
  }

  /**
   * Connect a Gmail account with OAuth code.
   */
  async handleGmailCallback(userId: string, code: string): Promise<IEmailAccount> {
    const { tokens, email, providerAccountId } = await GmailProvider.exchangeCode(code);
    const account = await this.connectGmailWithTokens(userId, email || '', tokens, providerAccountId);
    return account!;
  }

  /**
   * Connect Gmail account using pre-exchanged tokens (used by Socialite login).
   */
  async connectGmailWithTokens(
    userId: string,
    email: string,
    tokens: any,
    providerAccountId?: string | null
  ): Promise<IEmailAccount | null> {
    const encryptedAccessToken = tokens.access_token ? encrypt(tokens.access_token) : undefined;
    const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined;

    let account = await emailAccountRepository.findByEmail(userId, email || '');
    if (account) {
      account = await emailAccountRepository.update(String(account._id), userId, {
        encryptedAccessToken: encryptedAccessToken || account.encryptedAccessToken,
        encryptedRefreshToken: encryptedRefreshToken || account.encryptedRefreshToken,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : account.tokenExpiresAt,
        status: 'active',
      });
    } else {
      account = await emailAccountRepository.create({
        userId: new Types.ObjectId(userId),
        provider: 'gmail',
        email: email || `gmail_${providerAccountId || Date.now()}@gmail.com`,
        providerAccountId: providerAccountId || undefined,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        status: 'active',
        syncFrequencyMinutes: 60,
      });
    }

    await auditLogRepository.log({
      userId,
      action: 'EMAIL_CONNECTED',
      metadata: { provider: 'gmail', email: account?.email, method: 'socialite_login' },
    });

    // Run initial sync in background if access token is available
    if (account && encryptedAccessToken) {
      this.syncAccount(userId, String(account._id)).catch((err) => {
        console.error('Initial sync error:', err);
      });
    }

    return account;
  }

  /**
   * Run sync on an email account:
   * Fetch emails -> Parse with parsers -> Run duplicate detection -> Save detected transactions
   */
  async syncAccount(
    userId: string,
    emailAccountId: string
  ): Promise<{ scanned: number; detected: number; duplicates: number }> {
    const account = await emailAccountRepository.findById(emailAccountId, userId);
    if (!account) {
      throw new Error('Email account not found');
    }

    if (account.status === 'paused') {
      throw new Error('Email account synchronization is currently paused');
    }

    await auditLogRepository.log({
      userId,
      action: 'SYNC_STARTED',
      metadata: { emailAccountId, email: account.email },
    });

    if (account.provider === 'forwarding') {
      // Inbound email forwarding is event-driven via webhooks.
      await emailAccountRepository.updateSyncStatus(emailAccountId, new Date(), undefined, 0, null);
      return {
        scanned: 0,
        detected: 0,
        duplicates: 0,
      };
    }

    let provider: EmailProvider;
    if (account.provider === 'mock') {
      provider = new MockEmailProvider(account.email);
    } else if (account.provider === 'gmail') {
      provider = new GmailProvider(account.encryptedAccessToken, account.encryptedRefreshToken);
    } else {
      throw new Error(`Unsupported email provider: ${account.provider}`);
    }

    try {
      const { messages, newCursor } = await provider.sync(account.syncCursor);
      let detectedCount = 0;
      let duplicateCount = 0;

      for (const msg of messages) {
        // Parse email using registered parsers
        const parsed = emailParserRegistry.parse(msg);
        if (!parsed) continue;

        // Check duplicates
        const dupResult = await duplicateDetectionService.checkDuplicate(userId, parsed, msg.id);

        if (dupResult.isDuplicate) {
          duplicateCount++;
          // Still register as duplicate status if not already recorded
          const existingDetected = await detectedTransactionRepository.findByMessageId(userId, msg.id);
          if (!existingDetected) {
            await detectedTransactionRepository.create({
              userId: new Types.ObjectId(userId),
              emailAccountId: new Types.ObjectId(emailAccountId),
              emailMessageId: msg.id,
              amount: parsed.amount,
              currency: parsed.currency,
              merchant: parsed.merchant,
              transactionDate: parsed.transactionDate,
              transactionType: parsed.type,
              upiReference: parsed.upiReference,
              bankReference: parsed.bankReference,
              sender: parsed.sender || msg.sender,
              subject: msg.subject,
              rawMetadata: parsed.rawDetails,
              confidenceScore: parsed.confidenceScore,
              status: 'duplicate',
            });
          }
          continue;
        }

        // New transaction detected!
        await detectedTransactionRepository.create({
          userId: new Types.ObjectId(userId),
          emailAccountId: new Types.ObjectId(emailAccountId),
          emailMessageId: msg.id,
          amount: parsed.amount,
          currency: parsed.currency,
          merchant: parsed.merchant,
          transactionDate: parsed.transactionDate,
          transactionType: parsed.type,
          upiReference: parsed.upiReference,
          bankReference: parsed.bankReference,
          sender: parsed.sender || msg.sender,
          subject: msg.subject,
          rawMetadata: parsed.rawDetails,
          confidenceScore: parsed.confidenceScore,
          status: 'detected',
        });

        detectedCount++;
      }

      await emailAccountRepository.updateSyncStatus(
        emailAccountId,
        new Date(),
        newCursor,
        detectedCount,
        null
      );

      if (detectedCount > 0) {
        await notificationRepository.create({
          userId: new Types.ObjectId(userId),
          title: 'New Transactions Detected',
          message: `${detectedCount} new transaction${detectedCount > 1 ? 's' : ''} detected from ${account.email}. Ready for your review.`,
          type: 'detected_transaction',
          data: { emailAccountId, detectedCount },
        });
      }

      await auditLogRepository.log({
        userId,
        action: 'SYNC_COMPLETED',
        metadata: {
          emailAccountId,
          scanned: messages.length,
          detected: detectedCount,
          duplicates: duplicateCount,
        },
      });

      return {
        scanned: messages.length,
        detected: detectedCount,
        duplicates: duplicateCount,
      };
    } catch (err) {
      const errorMsg = (err as Error).message;
      await emailAccountRepository.updateSyncStatus(emailAccountId, new Date(), undefined, 0, errorMsg);
      await notificationRepository.create({
        userId: new Types.ObjectId(userId),
        title: 'Email Sync Failed',
        message: `Failed to sync transactions for ${account.email}: ${errorMsg}`,
        type: 'sync_failed',
        data: { emailAccountId, error: errorMsg },
      });
      await auditLogRepository.log({
        userId,
        action: 'SYNC_FAILED',
        metadata: { emailAccountId, error: errorMsg },
      });
      throw err;
    }
  }

  /**
   * Process an inbound forwarded email webhook.
   * Handles SendGrid, Postmark, Mailgun, and custom JSON payloads.
   * Extracts verification codes or unwraps transaction emails.
   */
  async processInboundEmail(rawPayload: {
    to?: string;
    recipient?: string;
    To?: string;
    OriginalRecipient?: string;
    from?: string;
    sender?: string;
    From?: string;
    subject?: string;
    Subject?: string;
    text?: string;
    bodyText?: string;
    'body-plain'?: string;
    TextBody?: string;
    html?: string;
    bodyHtml?: string;
    'body-html'?: string;
    HtmlBody?: string;
    messageId?: string;
    MessageID?: string;
    'Message-Id'?: string;
  }): Promise<{
    success: boolean;
    message: string;
    isVerification?: boolean;
    verificationCode?: string;
    detected?: any;
    accountId?: string;
  }> {
    const toField =
      rawPayload.to ||
      rawPayload.recipient ||
      rawPayload.To ||
      rawPayload.OriginalRecipient ||
      '';
    const fromField = rawPayload.from || rawPayload.sender || rawPayload.From || 'unknown@sender.com';
    const subject = rawPayload.subject || rawPayload.Subject || '(No Subject)';
    const textBody =
      rawPayload.text ||
      rawPayload.bodyText ||
      rawPayload['body-plain'] ||
      rawPayload.TextBody ||
      '';
    const htmlBody =
      rawPayload.html ||
      rawPayload.bodyHtml ||
      rawPayload['body-html'] ||
      rawPayload.HtmlBody ||
      '';
    const messageId =
      rawPayload.messageId ||
      rawPayload.MessageID ||
      rawPayload['Message-Id'] ||
      `inbound_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 1. Resolve forwarding account by token or address
    const { token, cleanAddress } = extractForwardingToken(toField);
    let account: IEmailAccount | null = null;

    if (token) {
      account = await emailAccountRepository.findByForwardingToken(token);
    }
    if (!account && cleanAddress) {
      account = await emailAccountRepository.findByForwardingAddress(cleanAddress);
    }

    if (!account) {
      console.warn(`[Inbound] No matching SpendWise forwarding account found for recipient: "${toField}" (token: ${token})`);
      return {
        success: false,
        message: `No active SpendWise account registered for forwarding address ${toField}`,
      };
    }

    const userId = String(account.userId);

    // 2. Check if account is paused
    if (account.status === 'paused') {
      return {
        success: false,
        message: 'Account sync is currently paused by user',
        accountId: String(account._id),
      };
    }

    // 3. Check for Gmail forwarding verification email
    const verification = extractGmailVerificationCode(subject, textBody, htmlBody);
    if (verification.isVerification) {
      await emailAccountRepository.update(String(account._id), userId, {
        lastVerificationCode: verification.code,
        lastVerificationSubject: subject,
        lastSyncAt: new Date(),
      });

      await notificationRepository.create({
        userId: new Types.ObjectId(userId),
        title: 'Gmail Forwarding Verification Code Received',
        message: verification.code
          ? `Your Gmail confirmation code is ${verification.code}. Enter this code in Gmail settings to complete forwarding setup.`
          : 'Gmail forwarding confirmation received. Please check your forwarding account in SpendWise.',
        type: 'system',
        data: {
          emailAccountId: String(account._id),
          verificationCode: verification.code,
          confirmationLink: verification.confirmationLink,
        },
      });

      return {
        success: true,
        isVerification: true,
        verificationCode: verification.code,
        message: 'Gmail forwarding verification code captured successfully',
        accountId: String(account._id),
      };
    }

    // 4. Unwrap email client forward wrappers (Fwd: headers)
    const rawEmailMessage: EmailMessage = {
      id: messageId,
      sender: fromField,
      recipient: toField,
      subject,
      date: new Date(),
      bodyText: textBody,
      bodyHtml: htmlBody,
    };

    const { unwrapped, isForwarded } = unwrapForwardedEmail(rawEmailMessage);

    // 5. Parse with Transaction Parser Registry
    const parsed = emailParserRegistry.parse(unwrapped);

    if (!parsed) {
      await emailAccountRepository.update(String(account._id), userId, {
        lastSyncAt: new Date(),
      });
      return {
        success: true,
        message: 'Email received and analyzed, but no financial transaction patterns were detected',
        accountId: String(account._id),
      };
    }

    // 6. Duplicate Detection
    const dupResult = await duplicateDetectionService.checkDuplicate(userId, parsed, unwrapped.id);

    if (dupResult.isDuplicate) {
      const existing = await detectedTransactionRepository.findByMessageId(userId, unwrapped.id);
      if (!existing) {
        await detectedTransactionRepository.create({
          userId: new Types.ObjectId(userId),
          emailAccountId: new Types.ObjectId(account._id),
          emailMessageId: unwrapped.id,
          amount: parsed.amount,
          currency: parsed.currency,
          merchant: parsed.merchant,
          transactionDate: parsed.transactionDate,
          transactionType: parsed.type,
          upiReference: parsed.upiReference,
          bankReference: parsed.bankReference,
          sender: parsed.sender || unwrapped.sender,
          subject: unwrapped.subject,
          rawMetadata: { ...parsed.rawDetails, isForwarded, forwardedBy: fromField },
          confidenceScore: parsed.confidenceScore,
          status: 'duplicate',
        });
      }

      await emailAccountRepository.update(String(account._id), userId, {
        lastSyncAt: new Date(),
      });

      return {
        success: true,
        message: `Duplicate detected: ${dupResult.reason || 'Already processed'}`,
        accountId: String(account._id),
      };
    }

    // 7. Save new detected transaction
    const newDetected = await detectedTransactionRepository.create({
      userId: new Types.ObjectId(userId),
      emailAccountId: new Types.ObjectId(account._id),
      emailMessageId: unwrapped.id,
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      transactionDate: parsed.transactionDate,
      transactionType: parsed.type,
      upiReference: parsed.upiReference,
      bankReference: parsed.bankReference,
      sender: parsed.sender || unwrapped.sender,
      subject: unwrapped.subject,
      rawMetadata: { ...parsed.rawDetails, isForwarded, forwardedBy: fromField },
      confidenceScore: parsed.confidenceScore,
      status: 'detected',
    });

    // 8. Update account stats
    await emailAccountRepository.updateSyncStatus(
      String(account._id),
      new Date(),
      undefined,
      1,
      null
    );

    // 9. Send real-time notification
    await notificationRepository.create({
      userId: new Types.ObjectId(userId),
      title: 'New Transaction Auto-Forwarded',
      message: `₹${parsed.amount.toLocaleString('en-IN')} paid to ${parsed.merchant} via ${parsed.paymentMethod.toUpperCase()} detected from forwarded email. Ready for review.`,
      type: 'detected_transaction',
      data: {
        emailAccountId: String(account._id),
        detectedTransactionId: String(newDetected._id),
        amount: parsed.amount,
        merchant: parsed.merchant,
      },
    });

    await auditLogRepository.log({
      userId,
      action: 'INBOUND_EMAIL_PROCESSED',
      metadata: {
        emailAccountId: String(account._id),
        merchant: parsed.merchant,
        amount: parsed.amount,
        isForwarded,
      },
    });

    return {
      success: true,
      message: `Transaction of ₹${parsed.amount} at ${parsed.merchant} parsed and added to Review Queue!`,
      detected: newDetected,
      accountId: String(account._id),
    };
  }

  /**
   * Simulate an inbound email for zero-setup developer and user testing.
   */
  async simulateInboundEmail(
    userId: string,
    accountId: string,
    templateKey = 'gpay_swiggy',
    customData?: { subject?: string; bodyText?: string; sender?: string }
  ) {
    const account = await emailAccountRepository.findById(accountId, userId);
    if (!account) {
      throw new Error('Forwarding account not found');
    }

    const recipient = account.forwardingAddress || account.email;
    const now = new Date();

    const templates: Record<string, { sender: string; subject: string; bodyText: string }> = {
      gpay_swiggy: {
        sender: 'payments-noreply@google.com',
        subject: 'Fwd: You paid ₹489.00 to Swiggy using Google Pay',
        bodyText: `---------- Forwarded message ---------
From: Google Pay <payments-noreply@google.com>
Date: ${now.toUTCString()}
Subject: You paid ₹489.00 to Swiggy using Google Pay
To: <user@gmail.com>

Dear Customer,
You paid ₹489.00 to Swiggy.
UPI transaction ID: ${Date.now().toString().slice(-12)}
Google transaction ID: CICAgKDL_${Math.floor(Math.random() * 10000)}
Payment method: HDFC Bank A/C XX4821`,
      },
      phonepe_chai: {
        sender: 'noreply@phonepe.com',
        subject: 'Fwd: Transaction Successful! Paid ₹220 to Chai Point',
        bodyText: `---------- Forwarded message ---------
From: PhonePe <noreply@phonepe.com>
Date: ${now.toUTCString()}
Subject: Transaction Successful! Paid ₹220 to Chai Point
To: <user@gmail.com>

Hi,
Your payment of ₹220 to Chai Point was successful.
Txn ID: T${Date.now()}
UTR: ${Date.now().toString().slice(-12)}
Debited from: State Bank of India **5678`,
      },
      hdfc_debit: {
        sender: 'alerts@hdfcbank.net',
        subject: 'Fwd: Alert: Your HDFC Bank A/C has been debited',
        bodyText: `---------- Forwarded message ---------
From: HDFC Bank Alerts <alerts@hdfcbank.net>
Date: ${now.toUTCString()}
Subject: Alert: Your HDFC Bank A/C has been debited
To: <user@gmail.com>

Dear Customer,
Your A/C XX4821 has been debited by INR 1,250.00 on ${now.toISOString().split('T')[0]} towards Zomato Order.
Info: UPI/Zomato/${Date.now().toString().slice(-12)}.
Available Balance: INR 48,250.00.`,
      },
      amazon_order: {
        sender: 'payments-noreply@google.com',
        subject: 'You paid ₹1,899.00 to Amazon Pay using Google Pay',
        bodyText: `Dear Customer,
You paid ₹1,899.00 to Amazon Pay.
UPI transaction ID: ${Date.now().toString().slice(-12)}
Payment method: ICICI Bank A/C XX9812`,
      },
      gmail_verification: {
        sender: 'forwarding-noreply@google.com',
        subject: `Google Gmail Forwarding Confirmation - Receive Mail from ${account.email}`,
        bodyText: `user.test@gmail.com has requested to automatically forward mail to your email address ${recipient}.
Confirmation code: ${Math.floor(100000000 + Math.random() * 900000000)}
To allow this, enter this confirmation code in your Gmail forwarding settings:
https://isolated.mail.google.com/mail/vf-8291048102`,
      },
    };

    const chosen = customData?.bodyText
      ? {
          sender: customData.sender || 'alerts@bank.in',
          subject: customData.subject || 'Transaction Alert',
          bodyText: customData.bodyText,
        }
      : templates[templateKey] || templates.gpay_swiggy;

    return this.processInboundEmail({
      to: recipient,
      from: chosen.sender,
      subject: chosen.subject,
      text: chosen.bodyText,
      messageId: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    });
  }

  async getAccounts(userId: string): Promise<IEmailAccount[]> {
    return emailAccountRepository.findByUserId(userId);
  }

  async pauseAccount(userId: string, accountId: string): Promise<IEmailAccount | null> {
    return emailAccountRepository.update(accountId, userId, { status: 'paused' });
  }

  async resumeAccount(userId: string, accountId: string): Promise<IEmailAccount | null> {
    return emailAccountRepository.update(accountId, userId, { status: 'active' });
  }

  async removeAccount(userId: string, accountId: string): Promise<boolean> {
    const account = await emailAccountRepository.findById(accountId, userId);
    if (!account) return false;

    await auditLogRepository.log({
      userId,
      action: 'EMAIL_DISCONNECTED',
      metadata: { emailAccountId: accountId, email: account.email },
    });

    return emailAccountRepository.delete(accountId, userId);
  }
}

export const emailSyncService = new EmailSyncService();
