import type { Debt, DebtDirection, DebtStatus, DebtSummary } from '../../types/index.js';

/** Single source of truth for client-side status derivation (mirrors backend). */
export function deriveDebtStatus(
  originalAmount: number,
  totalPaid: number,
  dueDate?: string | null
): { remainingAmount: number; status: DebtStatus; isOverdue: boolean } {
  const remainingAmount = Math.max(0, originalAmount - totalPaid);
  const isOverdue = !!(dueDate && new Date(dueDate) < new Date() && remainingAmount > 0);
  let status: DebtStatus;
  if (remainingAmount === 0) status = 'SETTLED';
  else if (isOverdue) status = 'OVERDUE';
  else if (totalPaid > 0) status = 'PARTIALLY_PAID';
  else status = 'ACTIVE';
  return { remainingAmount, status, isOverdue };
}

export function getDebtRemaining(debt: Debt): number {
  if (typeof debt.remainingAmount === 'number') return debt.remainingAmount;
  return Math.max(0, debt.originalAmount - (debt.totalPaid ?? 0));
}

export function getDebtStatus(debt: Debt): DebtStatus {
  if (debt.status) return debt.status;
  return deriveDebtStatus(debt.originalAmount, debt.totalPaid ?? 0, debt.dueDate ?? null).status;
}

/** Net = owed-to-me − I-owe, always from remaining balances. */
export function computeDebtSummary(debts: Debt[]): DebtSummary {
  let totalIOwe = 0;
  let totalOwedToMe = 0;
  let activeDebts = 0;
  let overdueDebts = 0;
  let settledDebts = 0;
  let partiallyPaidDebts = 0;

  for (const debt of debts) {
    const remaining = getDebtRemaining(debt);
    if (debt.direction === 'I_OWE') totalIOwe += remaining;
    else totalOwedToMe += remaining;

    switch (getDebtStatus(debt)) {
      case 'ACTIVE':
        activeDebts++;
        break;
      case 'OVERDUE':
        overdueDebts++;
        break;
      case 'SETTLED':
        settledDebts++;
        break;
      case 'PARTIALLY_PAID':
        partiallyPaidDebts++;
        break;
    }
  }

  return {
    totalIOwe,
    totalOwedToMe,
    netBalance: totalOwedToMe - totalIOwe,
    activeDebts,
    overdueDebts,
    settledDebts,
    partiallyPaidDebts,
  };
}

export const DEBT_STATUS_META: Record<DebtStatus, { label: string; variant: 'slate' | 'blue' | 'amber' | 'rose' | 'emerald' }> = {
  ACTIVE: { label: 'Active', variant: 'blue' },
  PARTIALLY_PAID: { label: 'Partial', variant: 'amber' },
  OVERDUE: { label: 'Overdue', variant: 'rose' },
  SETTLED: { label: 'Settled', variant: 'emerald' },
};

export const DEBT_DIRECTION_META: Record<DebtDirection, { label: string; hint: string }> = {
  I_OWE: { label: 'I Owe', hint: 'You borrowed — money flows out when you repay' },
  OWED_TO_ME: { label: 'Owed to Me', hint: 'You lent — money flows in when they repay' },
};

export type DebtFilterValue = 'ALL' | DebtDirection | DebtStatus;
export type DebtSortValue = 'DUE_DATE' | 'AMOUNT' | 'PERSON' | 'RECENT';

export interface DebtListQuery {
  search: string;
  filter: DebtFilterValue;
  sort: DebtSortValue;
}

export function filterAndSortDebts(debts: Debt[], query: DebtListQuery): Debt[] {
  const q = query.search.trim().toLowerCase();

  let result = debts.filter((debt) => {
    if (query.filter !== 'ALL') {
      if (query.filter === 'I_OWE' || query.filter === 'OWED_TO_ME') {
        if (debt.direction !== query.filter) return false;
      } else if (getDebtStatus(debt) !== query.filter) {
        return false;
      }
    }
    if (q) {
      const hay = `${debt.personName} ${debt.description ?? ''} ${debt.notes ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  result = [...result].sort((a, b) => {
    switch (query.sort) {
      case 'AMOUNT':
        return getDebtRemaining(b) - getDebtRemaining(a);
      case 'PERSON':
        return a.personName.localeCompare(b.personName);
      case 'RECENT':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'DUE_DATE':
      default: {
        const at = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bt = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return at - bt;
      }
    }
  });

  return result;
}
