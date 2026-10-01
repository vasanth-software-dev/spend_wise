import { describe, it, expect } from 'vitest';
import { matchAgainstOpenDebts } from '../src/services/DebtCandidateService.js';
import { normalizeRefNo } from '../src/utils/referenceNumber.js';
import type { DebtWithBalance } from '../src/repositories/DebtRepository.js';

function openDebt(id: string, remainingAmount: number, direction = 'I_OWE'): DebtWithBalance {
  return {
    _id: id,
    userId: 'u1',
    personId: 'p1',
    personName: 'Sivashakthi',
    originalAmount: remainingAmount,
    direction,
    debtDate: new Date('2026-01-01'),
    dueDate: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    totalPaid: 0,
    remainingAmount,
    status: 'ACTIVE',
    isOverdue: false,
  } as unknown as DebtWithBalance;
}

describe('Debt candidate matching', () => {
  it('flags no match when the person has no open debt', () => {
    const result = matchAgainstOpenDebts([], 2000);
    expect(result.match).toBe('NO_MATCH');
    expect(result.suggestedDebtId).toBeNull();
  });

  it('flags an exact settlement when the payment clears the outstanding balance', () => {
    const result = matchAgainstOpenDebts([openDebt('d1', 2000)], 2000);
    expect(result.match).toBe('EXACT_SETTLEMENT');
    expect(result.suggestedDebtId).toBe('d1');
  });

  it('flags a partial payment when the amount is below the outstanding balance', () => {
    const result = matchAgainstOpenDebts([openDebt('d1', 5000)], 2000);
    expect(result.match).toBe('PARTIAL_PAYMENT');
    expect(result.suggestedDebtId).toBe('d1');
    expect(result.suggestedDebtRemaining).toBe(5000);
  });

  it('picks the debt whose balance the payment actually clears', () => {
    const result = matchAgainstOpenDebts([openDebt('d1', 5000), openDebt('d2', 2000)], 2000);
    expect(result.suggestedDebtId).toBe('d2');
    expect(result.match).toBe('EXACT_SETTLEMENT');
  });

  it('treats an overpayment as the weakest partial match on the largest open debt', () => {
    const result = matchAgainstOpenDebts([openDebt('d1', 500)], 2000);
    expect(result.match).toBe('PARTIAL_PAYMENT');
    expect(result.suggestedDebtId).toBe('d1');
    expect(result.confidence).toBeLessThan(70);
  });

  it('matches an owed-to-me debt the same way as a debt the user owes', () => {
    const result = matchAgainstOpenDebts([openDebt('d1', 2000, 'OWED_TO_ME')], 2000);
    expect(result.match).toBe('EXACT_SETTLEMENT');
  });
});

describe('Debt candidate dedupe key', () => {
  it('normalizes zero-padded statement references to the email UPI reference', () => {
    expect(normalizeRefNo('0000130408174425')).toBe('130408174425');
    expect(normalizeRefNo('130408174425')).toBe('130408174425');
  });

  it('strips the UPI prefix before comparing', () => {
    expect(normalizeRefNo('UPI/130408174425')).toBe('130408174425');
  });
});