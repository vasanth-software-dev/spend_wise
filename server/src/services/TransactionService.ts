import { transactionRepository, TransactionFilterParams } from '../repositories/TransactionRepository.js';
import { categoryRepository } from '../repositories/CategoryRepository.js';
import { duplicateDetectionService } from './DuplicateDetectionService.js';
import { personService, isIdentifiablePerson } from './PersonService.js';
import { debtCandidateService } from './DebtCandidateService.js';
import { ITransaction, TransactionType, PaymentMethod, TransactionSource } from '../types/index.js';
import { roundTo2Decimals } from '../utils/currency.js';
import { Types } from 'mongoose';

export interface CreateTransactionDTO {
  type: TransactionType;
  amount: number;
  currency?: string;
  categoryId?: string | null;
  merchant: string;
  description?: string;
  paymentMethod: PaymentMethod;
  source?: TransactionSource;
  sourceAccountId?: string | null;
  externalTransactionId?: string;
  refNo?: string;
  transactionDate?: Date | string;
  notes?: string;
  isRecurring?: boolean;
  personId?: string | null;
  vpa?: string | null;
  metadata?: Record<string, unknown>;
}

export class TransactionService {
  async createTransaction(userId: string, data: CreateTransactionDTO): Promise<ITransaction> {
    const amount = roundTo2Decimals(Number(data.amount));
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const txDate = data.transactionDate ? new Date(data.transactionDate) : new Date();
    const refNo = data.refNo?.trim() || data.externalTransactionId?.trim() || undefined;

    // Check duplicate
    const dupCheck = await duplicateDetectionService.checkDuplicate(userId, {
      amount,
      currency: data.currency || 'INR',
      type: data.type === 'income' ? 'income' : 'expense',
      merchant: data.merchant,
      transactionDate: txDate,
      upiReference: refNo,
      bankReference: refNo,
      refNo: refNo,
      paymentMethod: data.paymentMethod,
      confidenceScore: 100,
    });

    if (dupCheck.isDuplicate) {
      console.warn(`Duplicate transaction noticed: ${dupCheck.reason}`);
    }

    const transaction = await transactionRepository.create({
      userId: new Types.ObjectId(userId),
      type: data.type,
      amount,
      currency: data.currency || 'INR',
      categoryId: data.categoryId ? new Types.ObjectId(data.categoryId) : null,
      merchant: data.merchant.trim(),
      description: data.description?.trim(),
      paymentMethod: data.paymentMethod,
      source: data.source || 'manual',
      sourceAccountId: data.sourceAccountId ? new Types.ObjectId(data.sourceAccountId) : null,
      externalTransactionId: refNo,
      refNo: refNo,
      transactionDate: txDate,
      notes: data.notes?.trim(),
      status: 'confirmed',
      isRecurring: !!data.isRecurring,
      personId: data.personId ? new Types.ObjectId(data.personId) : null,
      vpa: data.vpa ? data.vpa.trim().toLowerCase() : null,
      metadata: data.metadata || {},
    });

    return transaction;
  }

  async getTransactionById(id: string, userId: string): Promise<ITransaction | null> {
    return transactionRepository.findById(id, userId);
  }

  async getTransactions(params: TransactionFilterParams) {
    return transactionRepository.findWithFilters(params);
  }

  async updateTransaction(id: string, userId: string, updateData: Partial<CreateTransactionDTO>): Promise<ITransaction | null> {
    const payload: Partial<ITransaction> = {};

    if (updateData.amount !== undefined) payload.amount = roundTo2Decimals(Number(updateData.amount));
    if (updateData.type) payload.type = updateData.type;
    if (updateData.currency) payload.currency = updateData.currency;
    if (updateData.merchant) payload.merchant = updateData.merchant.trim();
    if (updateData.description !== undefined) payload.description = updateData.description?.trim();
    if (updateData.notes !== undefined) payload.notes = updateData.notes?.trim();
    if (updateData.paymentMethod) payload.paymentMethod = updateData.paymentMethod;
    if (updateData.transactionDate) payload.transactionDate = new Date(updateData.transactionDate);
    if (updateData.refNo !== undefined || updateData.externalTransactionId !== undefined) {
      const ref = (updateData.refNo ?? updateData.externalTransactionId)?.trim() || undefined;
      payload.refNo = ref;
      payload.externalTransactionId = ref;
    }
    if (updateData.categoryId !== undefined) {
      payload.categoryId = updateData.categoryId ? new Types.ObjectId(updateData.categoryId) : null;
    }
    if (updateData.personId !== undefined) {
      payload.personId = updateData.personId ? new Types.ObjectId(updateData.personId) : null;
    }
    if (updateData.vpa !== undefined) {
      payload.vpa = updateData.vpa ? updateData.vpa.trim().toLowerCase() : null;
    }

    return transactionRepository.update(id, userId, payload);
  }

  async deleteTransaction(id: string, userId: string): Promise<boolean> {
    return transactionRepository.delete(id, userId);
  }

  /**
   * Read-only duplicate probe used by the receipt scanner review screen.
   *
   * Nothing is created here. The scanned expense is still created through the
   * normal `createTransaction` path only after the user explicitly confirms, so
   * this only informs the "Possible duplicate expense" prompt. Uses the same
   * `DuplicateDetectionService` as every other write path, so the scanner never
   * invents a second, divergent notion of duplication.
   */
  async checkPossibleDuplicate(
    userId: string,
    input: {
      amount: number;
      merchant: string;
      transactionDate: Date;
      refNo?: string;
      type?: 'expense' | 'income';
      paymentMethod?: PaymentMethod;
    }
  ) {
    const merchant = input.merchant.trim();
    if (!merchant) {
      // An unidentified merchant cannot be compared reliably; reporting a
      // duplicate here would be a guess, so treat it as "no match".
      return { isDuplicate: false as const, matchedTransaction: null };
    }

    const result = await duplicateDetectionService.checkDuplicate(userId, {
      amount: roundTo2Decimals(Number(input.amount)),
      currency: 'INR',
      type: input.type === 'income' ? 'income' : 'expense',
      merchant,
      transactionDate: input.transactionDate,
      upiReference: input.refNo,
      bankReference: input.refNo,
      refNo: input.refNo,
      paymentMethod: input.paymentMethod || 'other',
      confidenceScore: 100,
    });

    if (!result.isDuplicate || !result.matchedTransactionId) {
      return { isDuplicate: false as const, matchedTransaction: null };
    }

    const matchedTransaction = await transactionRepository.findById(
      result.matchedTransactionId,
      userId
    );

    return {
      isDuplicate: true as const,
      duplicateType: result.duplicateType,
      reason: result.reason,
      matchedTransaction,
    };
  }

  async bulkDelete(ids: string[], userId: string): Promise<number> {
    return transactionRepository.deleteMany(ids, userId);
  }

  async bulkCategorize(ids: string[], userId: string, categoryId: string): Promise<number> {
    return transactionRepository.updateMany(ids, userId, {
      categoryId: new Types.ObjectId(categoryId),
    });
  }

  async getDashboardData(userId: string, timeRange: 'today' | '7d' | '30d' | '3m' | '6m' | '1y' = '30d') {
    const now = new Date();
    let startDate = new Date();
    let groupBy: 'day' | 'month' = 'day';

    switch (timeRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '3m':
        startDate.setMonth(now.getMonth() - 3);
        groupBy = 'month';
        break;
      case '6m':
        startDate.setMonth(now.getMonth() - 6);
        groupBy = 'month';
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        groupBy = 'month';
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Start of the current calendar month for summary stats
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [summary, spendingTrend, categoryBreakdown, topMerchants, paymentDistribution, recent] =
      await Promise.all([
        transactionRepository.getDashboardSummary(userId, startOfMonth, endOfMonth),
        transactionRepository.getSpendingTrend(userId, startDate, now, groupBy),
        transactionRepository.getCategoryBreakdown(userId, startDate, now, 'expense'),
        transactionRepository.getTopMerchants(userId, startDate, now, 6),
        transactionRepository.getPaymentMethodDistribution(userId, startDate, now),
        transactionRepository.findWithFilters({ userId, page: 1, limit: 5 }),
      ]);

    return {
      summary,
      spendingTrend,
      categoryBreakdown,
      topMerchants,
      paymentDistribution,
      recentTransactions: recent.transactions,
      timeRange,
    };
  }

  // Import transactions from parsed CSV rows
  async importTransactions(
    userId: string,
    rows: Array<{
      date: string;
      amount: number | string;
      type?: string;
      category?: string;
      merchant: string;
      payment_method?: string;
      refNo?: string;
      externalTransactionId?: string;
      notes?: string;
      vpa?: string;
    }>
  ) {
    const created: ITransaction[] = [];
    const skipped: Array<{ row: unknown; reason: string }> = [];
    const debtCandidateIds: string[] = [];

    // Cache categories for user
    const categories = await categoryRepository.findByUserId(userId);
    const catMap = new Map<string, { id: string; type: string }>();
    for (const c of categories) {
      catMap.set(c.name.toLowerCase(), { id: String(c._id), type: c.type });
    }

    for (const row of rows) {
      try {
        const amount = roundTo2Decimals(Number(row.amount));
        if (isNaN(amount) || amount <= 0) {
          skipped.push({ row, reason: 'Invalid or missing amount' });
          continue;
        }

        const date = new Date(row.date);
        if (isNaN(date.getTime())) {
          skipped.push({ row, reason: 'Invalid date format' });
          continue;
        }

        const merchant = (row.merchant || 'Unknown').trim();
        const typeStr = (row.type || '').toLowerCase();

        // Statement rows may carry the UPI handle (e.g. "sivashakthi@iob") in the
        // narration or notes; it is the strongest person-matching signal we have.
        const vpaSource = `${merchant} ${row.notes || ''}`;
        const vpaMatch = vpaSource.match(
          /\b([A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,})\b/i
        );
        const extractedVpa = (row.vpa || vpaMatch?.[1] || '').trim().toLowerCase() || null;

        let categoryId: string | null = null;
        let categoryType: string | null = null;
        if (row.category && catMap.has(row.category.toLowerCase())) {
          const matched = catMap.get(row.category.toLowerCase())!;
          categoryId = matched.id;
          categoryType = matched.type;
        }

        // Auto-select type from category type if not explicitly overridden
        let type: TransactionType;
        if (categoryType === 'income' && typeStr !== 'expense') {
          type = 'income';
        } else if (categoryType === 'expense' && typeStr !== 'income') {
          type = 'expense';
        } else if (typeStr === 'income') {
          type = 'income';
        } else if (typeStr === 'transfer') {
          type = 'transfer';
        } else {
          type = 'expense';
        }

        const paymentMethodStr = (row.payment_method || 'upi').toLowerCase();
        const validMethods: PaymentMethod[] = ['upi', 'bank', 'cash', 'card', 'wallet', 'other'];
        const paymentMethod: PaymentMethod = validMethods.includes(paymentMethodStr as PaymentMethod)
          ? (paymentMethodStr as PaymentMethod)
          : 'upi';

        const refNo = (row.refNo || row.externalTransactionId || '').trim() || undefined;

        // Check duplicate
        const dup = await duplicateDetectionService.checkDuplicate(userId, {
          amount,
          currency: 'INR',
          type: type === 'income' ? 'income' : 'expense',
          merchant,
          transactionDate: date,
          paymentMethod,
          upiReference: refNo,
          bankReference: refNo,
          refNo: refNo,
          confidenceScore: 100,
        });

        if (dup.isDuplicate) {
          skipped.push({ row, reason: `Duplicate detected: ${dup.reason}` });
          continue;
        }

        // Auto-detect individual person and link to Friends & Family
        let personId: Types.ObjectId | null = null;
        if (isIdentifiablePerson(merchant)) {
          const isSalaryCat = categoryId && catMap.get('salary')?.id === categoryId;
          const hasExplicitSalary = /\b(salary|payroll|stipend|wages|remuneration|pension|monthly\s*pay)\b/i.test(`${merchant} ${row.notes || ''}`);
          if ((!categoryId || (isSalaryCat && !hasExplicitSalary)) && catMap.has('friends & family')) {
            categoryId = catMap.get('friends & family')!.id;
          }
          const person = await personService.findOrCreate(
            userId,
            { name: merchant, vpa: extractedVpa || undefined },
            { isManual: false }
          );
          if (person) {
            personId = new Types.ObjectId(person._id);
          }
        }

        const tx = await transactionRepository.create({
          userId: new Types.ObjectId(userId),
          type,
          amount,
          currency: 'INR',
          categoryId: categoryId ? new Types.ObjectId(categoryId) : null,
          personId: personId || undefined,
          vpa: extractedVpa,
          merchant,
          paymentMethod,
          source: 'import',
          externalTransactionId: refNo,
          refNo: refNo,
          transactionDate: date,
          notes: row.notes?.trim(),
          status: 'confirmed',
        });

        created.push(tx);

        // Surface person-to-person imports as debt candidates for review only.
        // No Debt is created automatically.
        if (personId && (type === 'expense' || type === 'income')) {
          try {
            const candidate = await debtCandidateService.detectFromTransaction({
              userId,
              amount,
              direction: type === 'income' ? 'OWED_TO_ME' : 'I_OWE',
              merchant,
              vpa: extractedVpa,
              refNo,
              transactionDate: date,
              source: 'import',
              transactionId: String(tx._id),
              personId: personId.toString(),
            });
            if (candidate) debtCandidateIds.push(String(candidate._id));
          } catch (_) {
            // Candidate detection must never block the import
          }
        }
      } catch (err) {
        skipped.push({ row, reason: (err as Error).message });
      }
    }

    return {
      importedCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
      debtCandidateIds,
      debtCandidateCount: debtCandidateIds.length,
    };
  }

  // Export transactions to CSV format
  async exportTransactionsToCSV(params: TransactionFilterParams): Promise<string> {
    const result = await transactionRepository.findWithFilters({ ...params, limit: 10000 });
    const headers = ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Merchant', 'Payment Method', 'Source', 'Ref.No', 'Notes'];

    const lines = [headers.join(',')];

    for (const tx of result.transactions) {
      const cat = (tx.categoryId as unknown as { name?: string })?.name || '';
      const line = [
        new Date(tx.transactionDate).toISOString().split('T')[0],
        tx.type,
        tx.amount,
        tx.currency || 'INR',
        `"${cat.replace(/"/g, '""')}"`,
        `"${tx.merchant.replace(/"/g, '""')}"`,
        tx.paymentMethod,
        tx.source,
        `"${(tx.refNo || tx.externalTransactionId || '').replace(/"/g, '""')}"`,
        `"${(tx.notes || '').replace(/"/g, '""')}"`,
      ];
      lines.push(line.join(','));
    }

    return lines.join('\n');
  }
}

export const transactionService = new TransactionService();
