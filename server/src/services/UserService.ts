import { UserModel } from '../models/User.js';
import { TransactionModel } from '../models/Transaction.js';
import { CategoryModel } from '../models/Category.js';
import { BudgetModel } from '../models/Budget.js';
import { RecurringTransactionModel } from '../models/RecurringTransaction.js';
import { EmailAccountModel } from '../models/EmailAccount.js';
import { DetectedTransactionModel } from '../models/DetectedTransaction.js';
import { NotificationModel } from '../models/Notification.js';
import { SessionModel } from '../models/Session.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { WebAuthnCredentialModel } from '../models/WebAuthnCredential.js';
import { auditLogRepository } from '../repositories/AuditLogRepository.js';
import { GmailProvider } from '../providers/gmail/GmailProvider.js';
import { IUser } from '../types/index.js';
import { Types } from 'mongoose';

export class UserService {
  async updateProfile(
    userId: string,
    data: { name?: string; currency?: string; timezone?: string; avatar?: string }
  ): Promise<Partial<IUser> | null> {
    const user = await UserModel.findByIdAndUpdate(userId, { $set: data }, { new: true })
      .select('-passwordHash')
      .lean();
    return user;
  }

  /**
   * Complete account deletion cascade (Privacy-first requirement 76)
   */
  async deleteAccount(userId: string): Promise<void> {
    const userObjId = new Types.ObjectId(userId);

    // 1. Revoke any Gmail OAuth tokens
    const emailAccounts = await EmailAccountModel.find({ userId: userObjId });
    for (const acc of emailAccounts) {
      if (acc.provider === 'gmail' && acc.encryptedAccessToken) {
        try {
          const provider = new GmailProvider(acc.encryptedAccessToken, acc.encryptedRefreshToken);
          await provider.disconnect();
        } catch {
          // Continue deletion even if token revocation fails
        }
      }
    }

    // 2. Cascade delete all user records
    await Promise.all([
      TransactionModel.deleteMany({ userId: userObjId }),
      CategoryModel.deleteMany({ userId: userObjId }),
      BudgetModel.deleteMany({ userId: userObjId }),
      RecurringTransactionModel.deleteMany({ userId: userObjId }),
      EmailAccountModel.deleteMany({ userId: userObjId }),
      DetectedTransactionModel.deleteMany({ userId: userObjId }),
      NotificationModel.deleteMany({ userId: userObjId }),
      SessionModel.deleteMany({ userId: userObjId }),
      // Passkeys are personal security material; they must not outlive the account.
      WebAuthnCredentialModel.deleteMany({ userId: userObjId }),
    ]);

    await auditLogRepository.log({
      userId: userObjId,
      action: 'ACCOUNT_DELETED',
    });

    // 3. Delete user document
    await UserModel.findByIdAndDelete(userObjId);
  }
}

export const userService = new UserService();
