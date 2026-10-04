import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectedTransactionService } from '../src/services/DetectedTransactionService.js';
import { debtCandidateService } from '../src/services/DebtCandidateService.js';
import { detectedTransactionRepository } from '../src/repositories/DetectedTransactionRepository.js';
import { debtCandidateRepository } from '../src/repositories/DebtCandidateRepository.js';

describe('Bulk Actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('DetectedTransactionService Bulk Actions', () => {
    it('confirmAll confirms all provided items', async () => {
      const confirmSpy = vi.spyOn(detectedTransactionService, 'confirm').mockImplementation(async () => ({} as any));

      const result = await detectedTransactionService.confirmAll('user-1', [
        { id: 'tx-1', categoryId: 'cat-1' },
        { id: 'tx-2', categoryId: 'cat-2' },
      ]);

      expect(result.confirmedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(confirmSpy).toHaveBeenCalledTimes(2);
      expect(confirmSpy).toHaveBeenNthCalledWith(1, 'user-1', 'tx-1', { categoryId: 'cat-1' });
      expect(confirmSpy).toHaveBeenNthCalledWith(2, 'user-1', 'tx-2', { categoryId: 'cat-2' });
    });

    it('confirmAll confirms pending transactions when no items array provided', async () => {
      vi.spyOn(detectedTransactionRepository, 'findPendingByUserId').mockResolvedValueOnce([
        { _id: 'tx-1', categoryId: 'cat-1' },
        { _id: 'tx-2' },
      ] as any);
      const confirmSpy = vi.spyOn(detectedTransactionService, 'confirm').mockImplementation(async () => ({} as any));

      const result = await detectedTransactionService.confirmAll('user-1');

      expect(result.confirmedCount).toBe(2);
      expect(confirmSpy).toHaveBeenCalledTimes(2);
    });

    it('rejectAll rejects multiple detected transactions', async () => {
      const spy = vi.spyOn(detectedTransactionRepository, 'updateManyStatus').mockResolvedValueOnce(5);

      const count = await detectedTransactionService.rejectAll('user-1', ['tx-1', 'tx-2']);

      expect(count).toBe(5);
      expect(spy).toHaveBeenCalledWith('user-1', 'rejected', ['tx-1', 'tx-2']);
    });
  });

  describe('DebtCandidateService Bulk Actions', () => {
    it('ignoreAll dismisses multiple debt candidates', async () => {
      const spy = vi.spyOn(debtCandidateRepository, 'ignoreMany').mockResolvedValueOnce(8);

      const count = await debtCandidateService.ignoreAll('user-1', ['cand-1', 'cand-2']);

      expect(count).toBe(8);
      expect(spy).toHaveBeenCalledWith('user-1', ['cand-1', 'cand-2']);
    });

    it('ignoreAll dismisses all pending when no ids provided', async () => {
      const spy = vi.spyOn(debtCandidateRepository, 'ignoreMany').mockResolvedValueOnce(8);

      const count = await debtCandidateService.ignoreAll('user-1');

      expect(count).toBe(8);
      expect(spy).toHaveBeenCalledWith('user-1', undefined);
    });
  });
});
