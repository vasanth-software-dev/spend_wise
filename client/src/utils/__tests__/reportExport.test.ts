import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildPdfReportDoc,
  buildExcelWorkbook,
  exportReportToPDF,
  exportReportToExcel,
  downloadTransactionsCSV,
} from '../reportExport.js';

describe('Report Export Utilities', () => {
  const mockReportData = {
    summary: {
      incomeThisMonth: 85000,
      expensesThisMonth: 32450,
      savingsThisMonth: 52550,
      savingsRate: 61.8,
      transactionCount: 2,
    },
    breakdown: {
      expensesByCategory: [
        { _id: 'cat-1', name: 'Food & Dining', total: 12500, count: 5 },
        { _id: 'cat-2', name: 'Shopping', total: 8200, count: 2 },
      ],
      topMerchants: [
        { merchant: 'Swiggy', total: 6400, count: 4 },
        { merchant: 'Amazon', total: 8200, count: 2 },
      ],
    },
  };

  const mockTransactions = [
    {
      _id: 'tx-1',
      transactionDate: '2026-09-02',
      type: 'expense',
      amount: 450,
      currency: 'INR',
      merchant: 'Swiggy',
      categoryId: { name: 'Food & Dining' },
      paymentMethod: 'upi',
      refNo: '145853247378',
      notes: 'Dinner with family',
    },
    {
      _id: 'tx-2',
      transactionDate: '2026-09-01',
      type: 'income',
      amount: 85000,
      currency: 'INR',
      merchant: 'ACME Corp',
      categoryId: 'Salary',
      paymentMethod: 'bank',
      refNo: '0000130408174425',
      notes: 'Monthly salary credit',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('PDF Report generation', () => {
    it('builds a valid jsPDF document with pages and content', () => {
      const doc = buildPdfReportDoc({
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        reportData: mockReportData,
        transactions: mockTransactions,
        userName: 'John Doe',
      });

      expect(doc).toBeDefined();
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('builds a PDF cleanly when reportData has empty breakdown and no transactions', () => {
      const doc = buildPdfReportDoc({
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        reportData: null,
        transactions: [],
      });

      expect(doc).toBeDefined();
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('calls exportReportToPDF without throwing', () => {
      expect(() => {
        exportReportToPDF({
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          reportData: mockReportData,
          transactions: mockTransactions,
        });
      }).not.toThrow();
    });
  });

  describe('Excel Report generation', () => {
    it('creates an Excel workbook with Summary and Transactions sheets', () => {
      const wb = buildExcelWorkbook({
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        reportData: mockReportData,
        transactions: mockTransactions,
      });

      expect(wb.SheetNames).toContain('Summary');
      expect(wb.SheetNames).toContain('Transactions');

      const summarySheet = wb.Sheets['Summary'];
      expect(summarySheet).toBeDefined();
      const rawCsv = XLSX.utils.sheet_to_csv(summarySheet);
      expect(rawCsv).toContain('SPENDWISE FINANCIAL INTELLIGENCE REPORT');
      expect(rawCsv).toContain('Total Income (Inflow)');
      expect(rawCsv).toContain('85000');
      expect(rawCsv).toContain('Food & Dining');

      const txSheet = wb.Sheets['Transactions'];
      expect(txSheet).toBeDefined();
      const txCsv = XLSX.utils.sheet_to_csv(txSheet);
      expect(txCsv).toContain('Swiggy');
      expect(txCsv).toContain('ACME Corp');
    });

    it('calls exportReportToExcel without throwing in non-browser context', () => {
      const wb = exportReportToExcel({
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        reportData: mockReportData,
        transactions: mockTransactions,
      });
      expect(wb).toBeDefined();
    });
  });

  describe('CSV statement export fallback', () => {
    it('generates valid RFC-4180 CSV rows from transactions when server fails', async () => {
      const csv = await downloadTransactionsCSV('2026-09-01', '2026-09-30', mockTransactions);

      expect(csv).toContain('Date,Type,Amount,Currency,Category,Merchant,Payment Method,Ref.No,Notes');
      expect(csv).toContain('2026-09-02,expense,450,INR,"Food & Dining","Swiggy",upi,"145853247378","Dinner with family"');
      expect(csv).toContain('2026-09-01,income,85000,INR,"Salary","ACME Corp",bank,"0000130408174425","Monthly salary credit"');
    });
  });
});
