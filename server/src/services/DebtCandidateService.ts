import { Types } from 'mongoose';
import { debtCandidateRepository } from '../repositories/DebtCandidateRepository.js';
import { debtRepository, DebtWithBalance } from '../repositories/DebtRepository.js';
import { PersonModel } from '../models/Person.js';
import { TransactionModel } from '../models/Transaction.js';
import { IDebtCandidate, DebtDirection } from '../types/index.js';
import { roundTo2Decimals } from '../utils/currency.js';
import { normalizeRefNo } from '../utils/referenceNumber.js';
import { personService, normalizePersonName, isIdentifiablePerson } from './PersonService.js';

export interface DetectDebtCandidateInput {
  userId: string;
  amount: number;
  direction: DebtDirection;
  merchant: string;
  vpa?: string | null;
  refNo?: string | null;
  transactionDate: Date;
  source: 'email' | 'import';
  transactionId?: string | null;
  sourceAccountId?: string | null;
  personId?: string | null;
}

interface MatchResult {
  match: 'EXACT_SETTLEMENT' | 'PARTIAL_PAYMENT' | 'NO_MATCH';
  suggestedDebtId: string | null;
  suggestedDebtRemaining: number | null;
  confidence: number;
}

/**
 * Decide whether a person-to-person payment looks like a repayment of an
 * existing debt. Purely numeric and person-scoped: no keyword heuristics, since
 * bank UPI alerts carry no debt wording.
 */
export function matchAgainstOpenDebts(
  openDebts: DebtWithBalance[],
  amount: number
): MatchResult {
  if (openDebts.length === 0) {
    return { match: 'NO_MATCH', suggestedDebtId: null, suggestedDebtRemaining: null, confidence: 30 };
  }

  // A payment reduces a debt regardless of direction: paying someone you owe
  // (I_OWE) and receiving from someone who owes you (OWED_TO_ME) both settle.
  const exact = openDebts.find(
    (d) => Math.abs(d.remainingAmount - amount) < 0.01
  );
  if (exact) {
    return {
      match: 'EXACT_SETTLEMENT',
      suggestedDebtId: String(exact._id),
      suggestedDebtRemaining: exact.remainingAmount,
      confidence: 95,
    };
  }

  const partial = openDebts.find((d) => amount > 0 && amount < d.remainingAmount);
  if (partial) {
    return {
      match: 'PARTIAL_PAYMENT',
      suggestedDebtId: String(partial._id),
      suggestedDebtRemaining: partial.remainingAmount,
      confidence: 70,
    };
  }

  // Amount exceeds every open balance: still the most likely debt, but weaker.
  const largest = openDebts.reduce((a, b) => (a.remainingAmount >= b.remainingAmount ? a : b));
  return {
    match: 'PARTIAL_PAYMENT',
    suggestedDebtId: String(largest._id),
    suggestedDebtRemaining: largest.remainingAmount,
    confidence: 45,
  };
}

export class DebtCandidateService {
  /**
   * Resolve who a P2P payment belongs to, using VPA first (strongest signal),
   * then normalized name, then prior transaction history with that payee.
   */
  private async resolvePerson(
    userId: string,
    input: { merchant: string; vpa?: string | null; personId?: string | null }
  ): Promise<{ personId: string | null; personName: string } | null> {
    const userObjectId = new Types.ObjectId(userId);
    const vpa = input.vpa?.trim().toLowerCase() || undefined;
    const merchant = input.merchant.trim();

    if (input.personId && Types.ObjectId.isValid(input.personId)) {
      const linked = await PersonModel.findOne({
        _id: input.personId,
        userId: userObjectId,
        isDeleted: { $ne: true },
      }).lean();
      if (linked) return { personId: String(linked._id), personName: linked.name };
    }

    if (vpa) {
      const byVpa = await PersonModel.findOne({
        userId: userObjectId,
        vpa,
        isDeleted: { $ne: true },
      }).lean();
      if (byVpa) return { personId: String(byVpa._id), personName: byVpa.name };
    }

    const normalized = normalizePersonName(merchant);
    if (normalized) {
      const byName = await PersonModel.findOne({
        userId: userObjectId,
        normalizedName: normalized,
        isDeleted: { $ne: true },
      }).lean();
      if (byName) return { personId: String(byName._id), personName: byName.name };
    }

    // History fallback: this payee was linked to a person on an earlier transaction.
    const historyMatch = await TransactionModel.findOne({
      userId: userObjectId,
      personId: { $ne: null },
      $or: [
        ...(vpa ? [{ vpa }] : []),
        { merchant: { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      ],
    })
      .sort({ transactionDate: -1 })
      .populate('personId')
      .lean();

    if (historyMatch?.personId) {
      const person = historyMatch.personId as unknown as { _id: string; name: string } | null;
      if (person?._id) {
        return { personId: String(person._id), personName: person.name || merchant };
      }
    }

    // Unknown payee: only accept it as a person when the name genuinely looks
    // like one. Business-like payees are excluded by isIdentifiablePerson.
    if (isIdentifiablePerson(merchant, vpa)) {
      const person = await personService.findOrCreate(
        userId,
        { name: merchant, vpa },
        { isManual: false }
      );
      if (person) return { personId: String(person._id), personName: person.name };
    }

    return null;
  }

  /**
   * Create a P2P debt candidate for a freshly detected transaction.
   * Never creates a Debt: the caller always returns a candidate for user review.
   */
  async detectFromTransaction(input: DetectDebtCandidateInput): Promise<IDebtCandidate | null> {
    const amount = roundTo2Decimals(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const vpa = input.vpa?.trim().toLowerCase() || null;
    const normalizedRef = input.refNo ? normalizeRefNo(input.refNo) : '';
    // An empty normalized reference must stay null so it never hits the unique index.
    const refNoNormalized = normalizedRef || null;

    // Reference number is the primary dedupe key: the same payment can arrive
    // twice (bank email + statement import) with different padding or prefixes.
    if (refNoNormalized) {
      const existingByRef = await debtCandidateRepository.findExisting(input.userId, {
        refNoNormalized,
        amount,
        transactionDate: input.transactionDate,
        personName: input.merchant,
      });
      if (existingByRef) return existingByRef;
    }

    const person = await this.resolvePerson(input.userId, {
      merchant: input.merchant,
      vpa,
      personId: input.personId,
    });
    if (!person) return null;

    const openDebts = await debtRepository.findOpenByPerson(input.userId, {
      personId: person.personId,
      personName: person.personName,
    });
    const match = matchAgainstOpenDebts(openDebts, amount);

    const existing = await debtCandidateRepository.findExisting(input.userId, {
      refNoNormalized,
      personId: person.personId,
      personName: person.personName,
      amount,
      transactionDate: input.transactionDate,
    });
    if (existing) return existing;

    return debtCandidateRepository.create({
      userId: new Types.ObjectId(input.userId),
      personId: person.personId ? new Types.ObjectId(person.personId) : null,
      personName: person.personName,
      vpa,
      amount,
      currency: 'INR',
      direction: input.direction,
      transactionDate: input.transactionDate,
      source: input.source,
      refNo: input.refNo || null,
      refNoNormalized: refNoNormalized || null,
      transactionId: input.transactionId ? new Types.ObjectId(String(input.transactionId)) : null,
      sourceAccountId: input.sourceAccountId ? new Types.ObjectId(String(input.sourceAccountId)) : null,
      merchant: input.merchant.trim(),
      status: 'PENDING',
      match: match.match,
      suggestedDebtId: match.suggestedDebtId ? new Types.ObjectId(match.suggestedDebtId) : null,
      suggestedDebtRemaining: match.suggestedDebtRemaining,
      confidence: match.confidence,
    } as Partial<IDebtCandidate>);
  }

  async getCandidates(userId: string, status?: string): Promise<IDebtCandidate[]> {
    return debtCandidateRepository.findByUserId(userId, status);
  }

  async countPending(userId: string): Promise<number> {
    return debtCandidateRepository.countPending(userId);
  }

  async getCandidate(id: string, userId: string): Promise<IDebtCandidate | null> {
    return debtCandidateRepository.findById(id, userId);
  }

  /** User chose "this is not a debt". Nothing is written to the ledger. */
  async ignore(userId: string, id: string): Promise<IDebtCandidate | null> {
    return debtCandidateRepository.update(id, userId, { status: 'IGNORED' });
  }

  /**
   * User chose "this is a new debt". Direction follows the money flow:
   * money sent => I_OWE, money received => OWED_TO_ME.
   */
  async acceptAsNewDebt(
    userId: string,
    id: string,
    options?: { amount?: number; description?: string; debtDate?: Date | string }
  ): Promise<{ candidate: IDebtCandidate; debt: unknown }> {
    const candidate = await debtCandidateRepository.findById(id, userId);
    if (!candidate) throw new Error('CANDIDATE_NOT_FOUND');
    if (candidate.status !== 'PENDING') throw new Error('CANDIDATE_ALREADY_RESOLVED');

    const amount = options?.amount ? roundTo2Decimals(Number(options.amount)) : candidate.amount;
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');

    const { debtService } = await import('./DebtService.js');
    const debt = await debtService.createDebt(userId, {
      personId: candidate.personId ? String(candidate.personId) : null,
      personName: candidate.personName,
      direction: candidate.direction,
      originalAmount: amount,
      description:
        options?.description?.trim() ||
        `Auto-detected ${candidate.source === 'email' ? 'from email' : 'from import'}: ${candidate.merchant}`,
      debtDate: options?.debtDate || candidate.transactionDate,
      accountId: candidate.sourceAccountId ? String(candidate.sourceAccountId) : null,
    });

    const updated = await debtCandidateRepository.update(id, userId, {
      status: 'ACCEPTED',
      resolvedDebtId: String((debt as { _id: unknown })._id),
    });

    return { candidate: updated!, debt };
  }

  /**
   * User chose "this settles an existing debt". Records a DebtPayment against
   * the chosen debt and updates its remaining balance through DebtRepository.
   */
  async matchToExistingDebt(
    userId: string,
    id: string,
    options: { debtId?: string; amount?: number }
  ): Promise<{ candidate: IDebtCandidate; payment: unknown; debt: unknown }> {
    const candidate = await debtCandidateRepository.findById(id, userId);
    if (!candidate) throw new Error('CANDIDATE_NOT_FOUND');
    if (candidate.status !== 'PENDING') throw new Error('CANDIDATE_ALREADY_RESOLVED');

    const debtId = options.debtId || (candidate.suggestedDebtId ? String(candidate.suggestedDebtId) : null);
    if (!debtId) throw new Error('DEBT_NOT_FOUND');

    const amount = options.amount ? roundTo2Decimals(Number(options.amount)) : candidate.amount;
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');

    const { debtService } = await import('./DebtService.js');
    const result = await debtService.recordPayment(debtId, userId, {
      amount,
      paymentDate: candidate.transactionDate,
      accountId: candidate.sourceAccountId ? String(candidate.sourceAccountId) : null,
      note: `Auto-matched from ${candidate.source === 'email' ? 'email' : 'import'} (${candidate.merchant})`,
    });

    const updated = await debtCandidateRepository.update(id, userId, {
      status: 'MATCHED',
      resolvedDebtId: debtId,
      resolvedPaymentId: String((result.payment as { _id: unknown })._id),
    });

    return {
      candidate: updated!,
      payment: result.payment,
      debt: result.debt,
    };
  }
}

export const debtCandidateService = new DebtCandidateService();