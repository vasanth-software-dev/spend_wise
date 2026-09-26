import { transactionRepository } from '../repositories/TransactionRepository.js';

export class ReportService {
  async generateComprehensiveReport(userId: string, startDate: Date, endDate: Date) {
    const [
      summary,
      dailyTrend,
      monthlyTrend,
      categoryExpenses,
      categoryIncome,
      topMerchants,
      paymentMethods,
    ] = await Promise.all([
      transactionRepository.getDashboardSummary(userId, startDate, endDate),
      transactionRepository.getSpendingTrend(userId, startDate, endDate, 'day'),
      transactionRepository.getSpendingTrend(userId, startDate, endDate, 'month'),
      transactionRepository.getCategoryBreakdown(userId, startDate, endDate, 'expense'),
      transactionRepository.getCategoryBreakdown(userId, startDate, endDate, 'income'),
      transactionRepository.getTopMerchants(userId, startDate, endDate, 15),
      transactionRepository.getPaymentMethodDistribution(userId, startDate, endDate),
    ]);

    return {
      period: {
        startDate,
        endDate,
      },
      summary,
      dailyTrend,
      monthlyTrend,
      breakdown: {
        expensesByCategory: categoryExpenses,
        incomeByCategory: categoryIncome,
        topMerchants,
        paymentMethods,
      },
    };
  }
}

export const reportService = new ReportService();
