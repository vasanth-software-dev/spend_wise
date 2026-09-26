import { transactionRepository } from '../repositories/TransactionRepository.js';
import { detectedTransactionRepository } from '../repositories/DetectedTransactionRepository.js';
import { ParsedTransaction } from '../types/index.js';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: 'upi_reference' | 'external_id' | 'exact_match' | 'fuzzy_match';
  matchedTransactionId?: string;
  matchedDetectedId?: string;
  reason?: string;
}

export class DuplicateDetectionService {
  /**
   * Checks both confirmed Transactions and already DetectedTransactions for duplicates.
   */
  async checkDuplicate(
    userId: string,
    parsed: ParsedTransaction,
    emailMessageId?: string
  ): Promise<DuplicateCheckResult> {
    // 1. Check if emailMessageId was already recorded
    if (emailMessageId) {
      const existingMsg = await detectedTransactionRepository.findByMessageId(userId, emailMessageId);
      if (existingMsg) {
        return {
          isDuplicate: true,
          duplicateType: 'external_id',
          matchedDetectedId: String(existingMsg._id),
          reason: `Email message ID ${emailMessageId} was already processed`,
        };
      }
    }

    // 2. Check by UPI Reference (strongest uniqueness guarantee in Indian payments)
    if (parsed.upiReference) {
      // Check in confirmed transactions
      const existingTx = await transactionRepository.findPotentialDuplicate(userId, {
        amount: parsed.amount,
        merchant: parsed.merchant,
        transactionDate: parsed.transactionDate,
        externalTransactionId: parsed.upiReference,
      });

      if (existingTx) {
        return {
          isDuplicate: true,
          duplicateType: 'upi_reference',
          matchedTransactionId: String(existingTx._id),
          reason: `Matching UPI Reference ${parsed.upiReference} already confirmed`,
        };
      }

      // Check in detected transactions
      const existingDetected = await detectedTransactionRepository.findPotentialDuplicate(
        userId,
        parsed.upiReference
      );

      if (existingDetected) {
        return {
          isDuplicate: true,
          duplicateType: 'upi_reference',
          matchedDetectedId: String(existingDetected._id),
          reason: `Matching UPI Reference ${parsed.upiReference} already detected in inbox`,
        };
      }
    }

    // 3. Check by Bank Reference
    if (parsed.bankReference) {
      const existingTx = await transactionRepository.findPotentialDuplicate(userId, {
        amount: parsed.amount,
        merchant: parsed.merchant,
        transactionDate: parsed.transactionDate,
        externalTransactionId: parsed.bankReference,
      });

      if (existingTx) {
        return {
          isDuplicate: true,
          duplicateType: 'external_id',
          matchedTransactionId: String(existingTx._id),
          reason: `Matching Bank Reference ${parsed.bankReference} already confirmed`,
        };
      }
    }

    // 4. Fuzzy match: same amount, normalized merchant, within 90 minutes
    const potentialTx = await transactionRepository.findPotentialDuplicate(userId, {
      amount: parsed.amount,
      merchant: parsed.merchant,
      transactionDate: parsed.transactionDate,
      toleranceMinutes: 90,
    });

    if (potentialTx) {
      return {
        isDuplicate: true,
        duplicateType: 'fuzzy_match',
        matchedTransactionId: String(potentialTx._id),
        reason: `Potential matching transaction of ₹${parsed.amount} at ${parsed.merchant} near ${parsed.transactionDate.toISOString()}`,
      };
    }

    return { isDuplicate: false };
  }
}

export const duplicateDetectionService = new DuplicateDetectionService();
