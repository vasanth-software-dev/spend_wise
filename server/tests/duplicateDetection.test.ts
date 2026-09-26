import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DuplicateDetectionService } from '../src/services/DuplicateDetectionService.js';
import { transactionRepository } from '../src/repositories/TransactionRepository.js';
import { detectedTransactionRepository } from '../src/repositories/DetectedTransactionRepository.js';

describe('DuplicateDetectionService', () => {
  let dupService: DuplicateDetectionService;

  beforeEach(() => {
    dupService = new DuplicateDetectionService();
    vi.restoreAllMocks();
  });

  it('detects duplicate when emailMessageId already exists in inbox', async () => {
    vi.spyOn(detectedTransactionRepository, 'findByMessageId').mockResolvedValueOnce({
      _id: 'det-123',
    } as any);

    const result = await dupService.checkDuplicate(
      'user-1',
      {
        amount: 500,
        currency: 'INR',
        merchant: 'Swiggy',
        transactionDate: new Date(),
        paymentMethod: 'upi',
        confidenceScore: 90,
        type: 'expense',
      },
      'msg-dup-1'
    );

    expect(result.isDuplicate).toBe(true);
    expect(result.duplicateType).toBe('external_id');
  });

  it('detects duplicate when UPI reference matches confirmed transaction', async () => {
    vi.spyOn(detectedTransactionRepository, 'findByMessageId').mockResolvedValueOnce(null);
    vi.spyOn(transactionRepository, 'findPotentialDuplicate').mockResolvedValueOnce({
      _id: 'tx-999',
      amount: 450,
      merchant: 'Swiggy',
    } as any);

    const result = await dupService.checkDuplicate('user-1', {
      amount: 450,
      currency: 'INR',
      merchant: 'Swiggy',
      transactionDate: new Date(),
      paymentMethod: 'upi',
      upiReference: '426819284192',
      confidenceScore: 95,
      type: 'expense',
    });

    expect(result.isDuplicate).toBe(true);
    expect(result.duplicateType).toBe('upi_reference');
    expect(result.matchedTransactionId).toBe('tx-999');
  });

  it('returns isDuplicate false for fresh unique transaction', async () => {
    vi.spyOn(detectedTransactionRepository, 'findByMessageId').mockResolvedValueOnce(null);
    vi.spyOn(transactionRepository, 'findPotentialDuplicate').mockResolvedValue(null);
    vi.spyOn(detectedTransactionRepository, 'findPotentialDuplicate').mockResolvedValue(null);

    const result = await dupService.checkDuplicate('user-1', {
      amount: 2500,
      currency: 'INR',
      merchant: 'Cult.fit',
      transactionDate: new Date(),
      paymentMethod: 'upi',
      upiReference: '999888777111',
      confidenceScore: 95,
      type: 'expense',
    });

    expect(result.isDuplicate).toBe(false);
  });
});
