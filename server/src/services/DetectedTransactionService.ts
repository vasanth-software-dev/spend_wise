import { detectedTransactionRepository } from '../repositories/DetectedTransactionRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { categoryRepository } from '../repositories/CategoryRepository.js';
import { IDetectedTransaction, ITransaction } from '../types/index.js';
import { Types } from 'mongoose';

export interface ConfirmDetectedDTO {
  categoryId?: string;
  notes?: string;
  merchant?: string;
  amount?: number;
  transactionDate?: Date | string;
}

export class DetectedTransactionService {
  async getPending(userId: string): Promise<IDetectedTransaction[]> {
    return detectedTransactionRepository.findPendingByUserId(userId);
  }

  async getAll(userId: string, status?: string): Promise<IDetectedTransaction[]> {
    return detectedTransactionRepository.findAllByUserId(userId, status);
  }

  async confirm(
    userId: string,
    detectedId: string,
    overrides?: ConfirmDetectedDTO
  ): Promise<ITransaction> {
    const detected = await detectedTransactionRepository.findById(detectedId, userId);
    if (!detected) {
      throw new Error('Detected transaction not found');
    }

    if (detected.status === 'confirmed') {
      throw new Error('Transaction has already been confirmed');
    }

    // Auto-match category based on merchant if not provided
    let categoryId = overrides?.categoryId;
    if (!categoryId) {
      const merchantLower = (overrides?.merchant || detected.merchant).toLowerCase();
      const categories = await categoryRepository.findByUserId(userId);

      if (/swiggy|zomato|eats|starbucks|mcdonalds|kfc|burger|restaurant|food/i.test(merchantLower)) {
        const found = categories.find((c) => /food/i.test(c.name));
        if (found) categoryId = String(found._id);
      } else if (/groceries|blinkit|zepto|bigbasket|instamart|dmart/i.test(merchantLower)) {
        const found = categories.find((c) => /grocer/i.test(c.name));
        if (found) categoryId = String(found._id);
      } else if (/amazon|flipkart|myntra|ajio|meesho|shopping|zara/i.test(merchantLower)) {
        const found = categories.find((c) => /shop/i.test(c.name));
        if (found) categoryId = String(found._id);
      } else if (/uber|ola|rapido|metro|irctc|redbus/i.test(merchantLower)) {
        const found = categories.find((c) => /transport/i.test(c.name));
        if (found) categoryId = String(found._id);
      } else if (/fuel|petrol|hpcl|bpcl|iocl|shell/i.test(merchantLower)) {
        const found = categories.find((c) => /fuel/i.test(c.name));
        if (found) categoryId = String(found._id);
      } else if (/electric|tneb|bescom|airtel|jio|vi|broadband|water|gas|utility|bill/i.test(merchantLower)) {
        const found = categories.find((c) => /bill/i.test(c.name));
        if (found) categoryId = String(found._id);
      } else if (/netflix|spotify|prime|hotstar|apple|youtube/i.test(merchantLower)) {
        const found = categories.find((c) => /subscri/i.test(c.name));
        if (found) categoryId = String(found._id);
      } else if (/salary/i.test(merchantLower) || detected.transactionType === 'income') {
        const found = categories.find((c) => /salary|income/i.test(c.name));
        if (found) categoryId = String(found._id);
      }
    }

    // Create confirmed transaction in financial ledger
    const transaction = await transactionRepository.create({
      userId: new Types.ObjectId(userId),
      type: detected.transactionType,
      amount: overrides?.amount || detected.amount,
      currency: detected.currency,
      categoryId: categoryId ? new Types.ObjectId(categoryId) : null,
      merchant: (overrides?.merchant || detected.merchant).trim(),
      description: `Detected from ${detected.sender} (${detected.subject})`,
      paymentMethod: detected.upiReference ? 'upi' : 'bank',
      source: 'email',
      sourceAccountId: new Types.ObjectId(detected.emailAccountId),
      externalTransactionId: detected.upiReference || detected.bankReference || undefined,
      transactionDate: overrides?.transactionDate ? new Date(overrides.transactionDate) : detected.transactionDate,
      notes: overrides?.notes || undefined,
      status: 'confirmed',
      metadata: {
        detectedTransactionId: String(detected._id),
        emailMessageId: detected.emailMessageId,
        confidenceScore: detected.confidenceScore,
        sender: detected.sender,
        subject: detected.subject,
      },
    });

    // Mark detected transaction status as confirmed
    await detectedTransactionRepository.updateStatus(detectedId, userId, 'confirmed');

    return transaction;
  }

  async reject(userId: string, detectedId: string): Promise<boolean> {
    const updated = await detectedTransactionRepository.updateStatus(detectedId, userId, 'rejected');
    return !!updated;
  }

  async markDuplicate(userId: string, detectedId: string): Promise<boolean> {
    const updated = await detectedTransactionRepository.updateStatus(detectedId, userId, 'duplicate');
    return !!updated;
  }
}

export const detectedTransactionService = new DetectedTransactionService();
