import { TransactionModel } from '../models/Transaction.js';
import { ITransaction } from '../types/index.js';
import { Types } from 'mongoose';
import { buildRefNoQueryPattern } from '../utils/referenceNumber.js';

export interface TransactionFilterParams {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  type?: 'expense' | 'income' | 'transfer';
  paymentMethod?: string;
  source?: string;
  status?: string;
  minAmount?: number;
  maxAmount?: number;
  merchant?: string;
  personId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'transactionDate' | 'amount' | 'merchant' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export class TransactionRepository {
  async create(data: Partial<ITransaction>): Promise<ITransaction> {
    const tx = new TransactionModel(data);
    return (await tx.save()).toObject();
  }

  async createMany(data: Partial<ITransaction>[]): Promise<ITransaction[]> {
    const docs = await TransactionModel.insertMany(data);
    return docs.map((d) => d.toObject());
  }

  async findById(id: string, userId: string): Promise<ITransaction | null> {
    return TransactionModel.findOne({ _id: id, userId })
      .populate('categoryId')
      .populate('personId')
      .lean();
  }

  async update(id: string, userId: string, updateData: Partial<ITransaction>): Promise<ITransaction | null> {
    return TransactionModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: updateData },
      { new: true }
    )
      .populate('categoryId')
      .populate('personId')
      .lean();
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await TransactionModel.findOneAndDelete({ _id: id, userId });
    return !!res;
  }

  async deleteMany(ids: string[], userId: string): Promise<number> {
    const res = await TransactionModel.deleteMany({
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
      userId: new Types.ObjectId(userId),
    });
    return res.deletedCount;
  }

  async updateMany(ids: string[], userId: string, updateData: Partial<ITransaction>): Promise<number> {
    const res = await TransactionModel.updateMany(
      {
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        userId: new Types.ObjectId(userId),
      },
      { $set: updateData }
    );
    return res.modifiedCount;
  }

  async findWithFilters(params: TransactionFilterParams): Promise<{
    transactions: ITransaction[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(params.limit && params.limit > 100 ? 50000 : 100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(params.userId),
    };

    if (params.startDate || params.endDate) {
      query.transactionDate = {};
      if (params.startDate) (query.transactionDate as Record<string, unknown>).$gte = params.startDate;
      if (params.endDate) (query.transactionDate as Record<string, unknown>).$lte = params.endDate;
    }

    if (params.categoryId) {
      query.categoryId = new Types.ObjectId(params.categoryId);
    }

    if (params.type) {
      query.type = params.type;
    }

    if (params.paymentMethod) {
      query.paymentMethod = params.paymentMethod;
    }

    if (params.source) {
      query.source = params.source;
    }

    if (params.status) {
      query.status = params.status;
    }

    if (params.minAmount !== undefined || params.maxAmount !== undefined) {
      query.amount = {};
      if (params.minAmount !== undefined) (query.amount as Record<string, unknown>).$gte = params.minAmount;
      if (params.maxAmount !== undefined) (query.amount as Record<string, unknown>).$lte = params.maxAmount;
    }

    if (params.merchant) {
      query.merchant = { $regex: params.merchant, $options: 'i' };
    }

    if (params.personId) {
      query.personId = new Types.ObjectId(params.personId);
    }

    if (params.search) {
      const searchRegex = { $regex: params.search, $options: 'i' };
      const searchOr: Record<string, unknown>[] = [
        { merchant: searchRegex },
        { description: searchRegex },
        { notes: searchRegex },
        { externalTransactionId: searchRegex },
        { refNo: searchRegex },
        { vpa: searchRegex },
      ];
      const refPattern = buildRefNoQueryPattern(params.search);
      if (refPattern) {
        searchOr.push({ externalTransactionId: { $regex: refPattern } });
        searchOr.push({ refNo: { $regex: refPattern } });
      }
      query.$or = searchOr;
    }

    const sortField = params.sortBy || 'transactionDate';
    const sortDirection = params.sortOrder === 'asc' ? 1 : -1;

    const [transactions, total] = await Promise.all([
      TransactionModel.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .populate('categoryId')
        .populate('personId', 'name vpa email')
        .populate('sourceAccountId', 'email provider')
        .lean(),
      TransactionModel.countDocuments(query),
    ]);

    return {
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Dashboard Aggregation: Summary metrics for current period
  async getDashboardSummary(userId: string, startDate: Date, endDate: Date) {
    const pipeline = [
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: 'confirmed',
          transactionDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ];

    const result = await TransactionModel.aggregate(pipeline);
    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const item of result) {
      if (item._id === 'income') {
        totalIncome = item.totalAmount;
        incomeCount = item.count;
      }
      if (item._id === 'expense') {
        totalExpense = item.totalAmount;
        expenseCount = item.count;
      }
    }

    const totalSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

    // Salary breakdown
    const salaryResult = await TransactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: 'confirmed',
          type: 'income',
          transactionDate: { $gte: startDate, $lte: endDate },
          $or: [
            { merchant: { $regex: /salary|payroll|stipend/i } },
            { notes: { $regex: /salary|payroll/i } },
            { description: { $regex: /salary|payroll/i } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const salaryIncome = salaryResult[0]?.total || 0;
    const otherIncome = Math.max(0, totalIncome - salaryIncome);

    // Overall historical balance (all time confirmed)
    const balanceResult = await TransactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: 'confirmed',
        },
      },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] },
          },
        },
      },
    ]);

    const historicalIncome = balanceResult[0]?.totalIncome || 0;
    const historicalExpense = balanceResult[0]?.totalExpense || 0;
    const totalBalance = historicalIncome - historicalExpense;

    return {
      totalBalance,
      incomeThisMonth: totalIncome,
      expensesThisMonth: totalExpense,
      savingsThisMonth: totalSavings,
      savingsRate: Math.round(savingsRate * 100) / 100,
      incomeCount,
      expenseCount,
      salaryIncome,
      otherIncome,
    };
  }

  // Dashboard Aggregation: Expense trend over time
  async getSpendingTrend(userId: string, startDate: Date, endDate: Date, groupBy: 'day' | 'month' = 'day') {
    const dateFormat = groupBy === 'day' ? '%Y-%m-%d' : '%Y-%m';

    return TransactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: 'confirmed',
          transactionDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$transactionDate', timezone: 'Asia/Kolkata' } },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          income: {
            $sum: { $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0] },
          },
          expense: {
            $sum: { $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          income: 1,
          expense: 1,
          savings: { $subtract: ['$income', '$expense'] },
        },
      },
    ]);
  }

  // Category breakdown aggregation
  async getCategoryBreakdown(userId: string, startDate: Date, endDate: Date, type: 'expense' | 'income' = 'expense') {
    return TransactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: 'confirmed',
          type,
          transactionDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$categoryId',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
          categoryIcon: { $ifNull: ['$category.icon', 'Tag'] },
          categoryColor: { $ifNull: ['$category.color', '#64748b'] },
          totalAmount: 1,
          count: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);
  }

  // Top Merchants aggregation with previous period comparison
  async getTopMerchants(userId: string, startDate: Date, endDate: Date, limit = 6, prevStartDate?: Date, prevEndDate?: Date) {
    const merchants = await TransactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: 'confirmed',
          type: 'expense',
          transactionDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$merchant',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          merchant: '$_id',
          totalAmount: 1,
          count: 1,
        },
      },
    ]);

    if (!prevStartDate || !prevEndDate || merchants.length === 0) {
      return merchants.map((m) => ({
        ...m,
        previousAmount: 0,
        changePercentage: 0,
      }));
    }

    const merchantNames = merchants.map((m) => m.merchant);
    const prevMerchants = await TransactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: 'confirmed',
          type: 'expense',
          merchant: { $in: merchantNames },
          transactionDate: { $gte: prevStartDate, $lte: prevEndDate },
        },
      },
      {
        $group: {
          _id: '$merchant',
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const prevMap = new Map<string, number>();
    for (const pm of prevMerchants) {
      prevMap.set(pm._id, pm.totalAmount);
    }

    return merchants.map((m) => {
      const prevAmount = prevMap.get(m.merchant) || 0;
      let changePercentage = 0;
      if (prevAmount > 0) {
        changePercentage = Math.round(((m.totalAmount - prevAmount) / prevAmount) * 1000) / 10;
      } else if (m.totalAmount > 0) {
        changePercentage = 100;
      }

      return {
        ...m,
        previousAmount: prevAmount,
        changePercentage,
      };
    });
  }

  // Payment method distribution aggregation
  async getPaymentMethodDistribution(userId: string, startDate: Date, endDate: Date) {
    return TransactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: 'confirmed',
          transactionDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          paymentMethod: '$_id',
          totalAmount: 1,
          count: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);
  }

  /**
   * Per-day confirmed totals for the calendar grid. Day keys are rendered in
   * Asia/Kolkata, matching the timezone used by `getSpendingTrend`, so the
   * month grid and the day panel always agree on which date a transaction
   * belongs to.
   */
  async getCalendarDaySummaries(userId: string, start: Date, end: Date) {
    return TransactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: 'confirmed',
          transactionDate: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$transactionDate',
              timezone: 'Asia/Kolkata',
            },
          },
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
          transfer: { $sum: { $cond: [{ $eq: ['$type', 'transfer'] }, '$amount', 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  /** Confirmed transactions falling on a single calendar day. */
  async getTransactionsForDay(userId: string, start: Date, end: Date): Promise<ITransaction[]> {
    return TransactionModel.find({
      userId: new Types.ObjectId(userId),
      status: 'confirmed',
      transactionDate: { $gte: start, $lt: end },
    })
      .sort({ transactionDate: 1, createdAt: 1 })
      .populate('categoryId', 'name icon color type')
      .populate('sourceAccountId', 'email provider')
      .lean();
  }

  // Find possible existing transaction for duplicate detection
  async findPotentialDuplicate(
    userId: string,
    criteria: {
      amount: number;
      merchant: string;
      transactionDate: Date;
      externalTransactionId?: string;
      refNo?: string;
      toleranceMinutes?: number;
    }
  ): Promise<ITransaction | null> {
    const { amount, merchant, transactionDate, externalTransactionId, refNo, toleranceMinutes = 120 } = criteria;
    const refToSearch = refNo || externalTransactionId;

    if (refToSearch) {
      const refPattern = buildRefNoQueryPattern(refToSearch);
      const orClauses: Record<string, unknown>[] = [
        { externalTransactionId: refToSearch },
        { refNo: refToSearch },
      ];
      if (refPattern) {
        orClauses.push({ externalTransactionId: { $regex: refPattern } });
        orClauses.push({ refNo: { $regex: refPattern } });
      }

      const match = await TransactionModel.findOne({
        userId: new Types.ObjectId(userId),
        $or: orClauses,
      }).lean();
      if (match) return match;
    }

    const windowMs = toleranceMinutes * 60 * 1000;
    const minDate = new Date(transactionDate.getTime() - windowMs);
    const maxDate = new Date(transactionDate.getTime() + windowMs);

    return TransactionModel.findOne({
      userId: new Types.ObjectId(userId),
      amount: { $gte: amount - 0.01, $lte: amount + 0.01 },
      merchant: { $regex: new RegExp(`^${merchant.trim()}$`, 'i') },
      transactionDate: { $gte: minDate, $lte: maxDate },
    }).lean();
  }
}

export const transactionRepository = new TransactionRepository();
