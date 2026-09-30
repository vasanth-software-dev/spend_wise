import { describe, it, expect } from 'vitest';
import { deriveDebtStatus, computeDebtSummary, filterAndSortDebts } from '../debtUtils.js';
import type { Debt } from '../../../types/index.js';
const debt = (over: Partial<Debt>): Debt => ({ _id: 'a', userId: 'u', personName: 'Rahul', originalAmount: 2000, direction: 'I_OWE', debtDate: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), totalPaid: 0, remainingAmount: 2000, status: 'ACTIVE', ...over } as Debt);
describe('debt status logic', () => {
it('marks settled when fully paid', () => { expect(deriveDebtStatus(2000, 2000).status).toBe('SETTLED'); });
it('marks partial when some paid', () => { expect(deriveDebtStatus(2000, 1000).status).toBe('PARTIALLY_PAID'); });
it('marks overdue when due passed', () => { const past = new Date(Date.now() - 86400000).toISOString(); expect(deriveDebtStatus(2000, 0, past).status).toBe('OVERDUE'); });
it('marks active otherwise', () => { const fut = new Date(Date.now() + 86400000).toISOString(); expect(deriveDebtStatus(2000, 0, fut).status).toBe('ACTIVE'); });
});
describe('debt summary', () => {
it('uses remaining balances not originals', () => {
const debts = [debt({ direction: 'I_OWE', remainingAmount: 1000 }), debt({ direction: 'OWED_TO_ME', remainingAmount: 5000 })];
const s = computeDebtSummary(debts);
expect(s.totalIOwe).toBe(1000); expect(s.totalOwedToMe).toBe(5000); expect(s.netBalance).toBe(4000);
});
});
describe('debt filters', () => {
it('searches person and description', () => {
const debts = [debt({ personName: 'Rahul', description: 'Dinner' }), debt({ personName: 'Priya', description: 'Loan' })];
expect(filterAndSortDebts(debts, { search: 'rahul', filter: 'ALL', sort: 'RECENT' })).toHaveLength(1);
expect(filterAndSortDebts(debts, { search: 'loan', filter: 'ALL', sort: 'RECENT' })[0].personName).toBe('Priya');
});
it('filters by direction', () => {
const debts = [debt({ direction: 'I_OWE' }), debt({ direction: 'OWED_TO_ME' })];
expect(filterAndSortDebts(debts, { search: '', filter: 'I_OWE', sort: 'RECENT' })).toHaveLength(1);
});
});
