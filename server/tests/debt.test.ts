import { describe, it, expect } from 'vitest';
import { DebtRepository } from '../src/repositories/DebtRepository.js';
describe('DebtRepository.calculateStatus', () => {
const repo = new DebtRepository();
const base: any = { originalAmount: 2000, dueDate: null };
it('settled at zero remaining', () => { expect(repo.calculateStatus(base, 2000).status).toBe('SETTLED'); });
it('partial when paid', () => { const r = repo.calculateStatus(base, 500); expect(r.status).toBe('PARTIALLY_PAID'); expect(r.remainingAmount).toBe(1500); });
it('overdue when past due', () => { const r = repo.calculateStatus({ ...base, dueDate: new Date(Date.now() - 86400000) }, 0); expect(r.status).toBe('OVERDUE'); expect(r.isOverdue).toBe(true); });
it('active otherwise', () => { const r = repo.calculateStatus({ ...base, dueDate: new Date(Date.now() + 86400000) }, 0); expect(r.status).toBe('ACTIVE'); });
it('settled wins over overdue', () => { const r = repo.calculateStatus({ ...base, dueDate: new Date(Date.now() - 86400000) }, 2000); expect(r.status).toBe('SETTLED'); });
});
