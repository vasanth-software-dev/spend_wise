import { detectedTransactionRepository } from '../repositories/DetectedTransactionRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { categoryRepository } from '../repositories/CategoryRepository.js';
import { IDetectedTransaction, ITransaction } from '../types/index.js';
import { Types } from 'mongoose';
import { predictCategoryName, findMatchingCategoryId } from '../utils/categoryPredictor.js';
import { personService } from './PersonService.js';
import { debtCandidateService } from './DebtCandidateService.js';

export interface ConfirmDetectedDTO {
  categoryId?: string;
  notes?: string;
  merchant?: string;
  amount?: number;
  transactionDate?: Date | string;
}

export class DetectedTransactionService {
  async getPending(userId: string, limit = 500): Promise<IDetectedTransaction[]> {
    return detectedTransactionRepository.findPendingByUserId(userId, limit);
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
    let categoryId = overrides?.categoryId || (detected.categoryId ? String(detected.categoryId) : undefined);
    if (!categoryId) {
      const categories = await categoryRepository.findByUserId(userId);
      const targetText = `${overrides?.merchant || detected.merchant} ${detected.subject || ''}`;
      const predicted = detected.suggestedCategory || predictCategoryName(targetText);
      const matched = findMatchingCategoryId(categories, predicted);
      if (matched) categoryId = matched;
    }

    const parsedVpa = typeof detected.rawMetadata?.vpa === 'string' ? detected.rawMetadata.vpa : undefined;
    const finalMerchant = (overrides?.merchant || detected.merchant).trim();
    const person = await personService.identifyAndLinkPerson(userId, {
      merchant: finalMerchant,
      vpa: parsedVpa,
    });

    // Create confirmed transaction in financial ledger
    const transaction = await transactionRepository.create({
      userId: new Types.ObjectId(userId),
      type: detected.transactionType,
      amount: overrides?.amount || detected.amount,
      currency: detected.currency,
      categoryId: categoryId && Types.ObjectId.isValid(categoryId) ? new Types.ObjectId(categoryId) : null,
      merchant: finalMerchant,
      description: `Detected from ${detected.sender} (${detected.subject})`,
      paymentMethod: detected.upiReference ? 'upi' : 'bank',
      source: 'email',
      sourceAccountId: new Types.ObjectId(detected.emailAccountId),
      personId: person?._id ? new Types.ObjectId(person._id) : null,
      vpa: parsedVpa || person?.vpa || null,
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
        vpa: parsedVpa || person?.vpa || null,
        personName: person?.name || undefined,
      },
    });

    // Mark detected transaction status as confirmed
    await detectedTransactionRepository.updateStatus(detectedId, userId, 'confirmed');

    // Every confirmed person-to-person payment becomes a debt candidate for review.
    // This never writes a Debt on its own: a P2P UPI payment may just be a purchase.
    try {
      await debtCandidateService.detectFromTransaction({
        userId,
        amount: Number(transaction.amount),
        direction: transaction.type === 'income' ? 'OWED_TO_ME' : 'I_OWE',
        merchant: finalMerchant,
        vpa: parsedVpa || person?.vpa || null,
        refNo: detected.upiReference || detected.bankReference || null,
        transactionDate: new Date(transaction.transactionDate),
        source: 'email',
        transactionId: String(transaction._id),
        sourceAccountId: String(detected.emailAccountId),
        personId: person?._id ? String(person._id) : null,
      });
    } catch (_) {
      // Candidate detection must never block confirming the transaction
    }

    return transaction;
  }

  async update(
    userId: string,
    detectedId: string,
    updates: {
      merchant?: string;
      amount?: number;
      categoryId?: string | null;
      suggestedCategory?: string;
      notes?: string;
    }
  ): Promise<IDetectedTransaction> {
    const detected = await detectedTransactionRepository.findById(detectedId, userId);
    if (!detected) {
      throw new Error('Detected transaction not found');
    }

    const updateData: Partial<IDetectedTransaction> = {};
    if (updates.merchant !== undefined) updateData.merchant = updates.merchant.trim();
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.categoryId !== undefined) {
      if (updates.categoryId && Types.ObjectId.isValid(updates.categoryId)) {
        updateData.categoryId = new Types.ObjectId(updates.categoryId) as any;
        const category = await categoryRepository.findById(updates.categoryId);
        if (category) {
          updateData.suggestedCategory = category.name;
        }
      } else {
        updateData.categoryId = null as any;
      }
    }
    if (updates.suggestedCategory !== undefined && updates.categoryId === undefined) {
      updateData.suggestedCategory = updates.suggestedCategory;
    }

    const updated = await detectedTransactionRepository.update(detectedId, userId, updateData);
    if (!updated) {
      throw new Error('Failed to update detected transaction');
    }
    return updated;
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
