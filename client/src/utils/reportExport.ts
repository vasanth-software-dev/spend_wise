import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { api } from '../services/api.js';
import { formatDate } from './format.js';

export interface ReportExportSummary {
  incomeThisMonth: number;
  expensesThisMonth: number;
  savingsThisMonth: number;
  savingsRate: number;
  transactionCount?: number;
}

export interface CategoryBreakdownItem {
  _id: string;
  name: string;
  color?: string;
  total: number;
  count: number;
}

export interface MerchantBreakdownItem {
  merchant: string;
  total: number;
  count: number;
}

export interface ReportExportData {
  summary?: ReportExportSummary;
  breakdown?: {
    expensesByCategory?: CategoryBreakdownItem[];
    incomeByCategory?: CategoryBreakdownItem[];
    topMerchants?: MerchantBreakdownItem[];
    paymentMethods?: Array<{ paymentMethod: string; total: number; count: number }>;
  };
}

export interface TransactionExportItem {
  _id?: string;
  transactionDate: string | Date;
  type: string;
  amount: number;
  currency?: string;
  merchant: string;
  categoryId?: { name?: string } | string;
  categoryName?: string;
  paymentMethod?: string;
  source?: string;
  refNo?: string;
  externalTransactionId?: string;
  notes?: string;
}

export interface ExportReportSections {
  income?: boolean;
  expenses?: boolean;
  accounts?: boolean;
  budgets?: boolean;
  debts?: boolean;
  categories?: boolean;
  merchants?: boolean;
  transactions?: boolean;
}

export interface ExportReportOptions {
  startDate: string;
  endDate: string;
  reportData: ReportExportData | null;
  transactions?: TransactionExportItem[];
  userName?: string;
  title?: string;
  accountFilter?: string;
  typeFilter?: string;
  sections?: ExportReportSections;
  budgets?: any[];
  debts?: any[];
}

// Clean number formatting for PDF/Excel (without non-ASCII symbols)
function formatCurrencyNumber(val: number): string {
  const abs = Math.abs(val);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${val < 0 ? '-' : ''}Rs. ${formatted}`;
}

function resolveCategoryName(tx: TransactionExportItem): string {
  if (tx.categoryName) return tx.categoryName;
  if (typeof tx.categoryId === 'object' && tx.categoryId?.name) return tx.categoryId.name;
  if (typeof tx.categoryId === 'string') return tx.categoryId;
  return 'Uncategorized';
}

/**
 * Builds a jsPDF document containing the complete Executive Statement & Analytics report.
 */
export function buildPdfReportDoc(options: ExportReportOptions): jsPDF {
  const {
    startDate,
    endDate,
    reportData,
    transactions = [],
    userName,
    title = 'FINANCIAL INTELLIGENCE & STATEMENT REPORT',
    accountFilter = 'all',
    sections = {
      income: true,
      expenses: true,
      accounts: true,
      budgets: true,
      debts: true,
      categories: true,
      merchants: true,
      transactions: true,
    },
    budgets = [],
    debts = [],
  } = options;

  // Filter transactions by account / payment method if specific method chosen
  const filteredTransactions = transactions.filter((t) => {
    if (!accountFilter || accountFilter === 'all') return true;
    return (t.paymentMethod || '').toLowerCase() === accountFilter.toLowerCase();
  });

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = margin;

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');

  // SpendWise Logo / Brand Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('SPENDWISE', margin + 6, currentY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(title, margin + 6, currentY + 17);

  if (userName) {
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(`Account Holder: ${userName}${accountFilter !== 'all' ? ` • Mode: ${accountFilter.toUpperCase()}` : ''}`, margin + 6, currentY + 23);
  } else if (accountFilter !== 'all') {
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Account Filter: ${accountFilter.toUpperCase()}`, margin + 6, currentY + 23);
  }

  // Metadata block on right side
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  const periodText = `Period: ${formatDate(startDate, 'dd MMM yyyy')} - ${formatDate(endDate, 'dd MMM yyyy')}`;
  doc.text(periodText, pageWidth - margin - 6, currentY + 10, { align: 'right' });

  const generatedText = `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  doc.setTextColor(148, 163, 184);
  doc.text(generatedText, pageWidth - margin - 6, currentY + 16, { align: 'right' });

  currentY += 34;

  // 2. Executive KPI Cards (Income & Expenses)
  const summary = reportData?.summary;
  const showIncome = sections.income !== false;
  const showExpenses = sections.expenses !== false;

  if (summary && (showIncome || showExpenses)) {
    const rawCards: Array<{ label: string; value: string; color: number[]; bg: number[] }> = [];

    if (showIncome) {
      rawCards.push({
        label: 'TOTAL INFLOW',
        value: `+${formatCurrencyNumber(summary.incomeThisMonth)}`,
        color: [16, 185, 129], // emerald-500
        bg: [240, 253, 244],
      });
    }

    if (showExpenses) {
      rawCards.push({
        label: 'TOTAL OUTFLOW',
        value: formatCurrencyNumber(summary.expensesThisMonth),
        color: [225, 29, 72], // rose-600
        bg: [255, 241, 242],
      });
    }

    if (showIncome && showExpenses) {
      rawCards.push({
        label: 'NET RETAINED',
        value: formatCurrencyNumber(summary.savingsThisMonth),
        color: summary.savingsThisMonth >= 0 ? [15, 23, 42] : [225, 29, 72],
        bg: [248, 250, 252],
      });
      rawCards.push({
        label: 'SAVINGS RATIO',
        value: `${summary.savingsRate ?? 0}%`,
        color: [37, 99, 235], // blue-600
        bg: [239, 246, 255],
      });
    }

    const cardGap = 3.5;
    const cardCount = rawCards.length;
    const totalGap = cardGap * (cardCount - 1);
    const cardWidth = (pageWidth - margin * 2 - totalGap) / cardCount;
    const cardHeight = 20;

    rawCards.forEach((c, idx) => {
      const cardX = margin + idx * (cardWidth + cardGap);
      doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

      // Top indicator
      doc.setFillColor(c.color[0], c.color[1], c.color[2]);
      doc.rect(cardX, currentY, cardWidth, 1.5, 'F');

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(c.label, cardX + 3.5, currentY + 7);

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(cardCount > 2 ? 9 : 11);
      doc.setTextColor(c.color[0], c.color[1], c.color[2]);
      doc.text(c.value, cardX + 3.5, currentY + 14.5);
    });

    currentY += cardHeight + 8;
  }

  // 3. Category Breakdown
  const expensesByCategory = reportData?.breakdown?.expensesByCategory || [];
  const topMerchants = reportData?.breakdown?.topMerchants || [];
  const paymentMethods = reportData?.breakdown?.paymentMethods || [];
  const totalExpense = summary?.expensesThisMonth || expensesByCategory.reduce((sum, item) => sum + item.total, 0) || 1;

  if (sections.categories !== false && expensesByCategory.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Expense Distribution by Category', margin, currentY);
    currentY += 3;

    const catRows = expensesByCategory.slice(0, 10).map((cat) => {
      const share = ((cat.total / totalExpense) * 100).toFixed(1);
      return [
        cat.name,
        cat.count ? String(cat.count) : '-',
        `${share}%`,
        formatCurrencyNumber(cat.total),
      ];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Category', 'Count', '% of Outflow', 'Amount']],
      body: catRows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 28 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 35 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable to doc
    currentY = doc.lastAutoTable.finalY + 8;
  }

  // 4. Accounts / Payment Methods Distribution
  if (sections.accounts !== false && paymentMethods.length > 0) {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Accounts & Payment Methods Activity', margin, currentY);
    currentY += 3;

    const methodRows = paymentMethods.map((pm) => [
      pm.paymentMethod.toUpperCase(),
      String(pm.count),
      formatCurrencyNumber(pm.total),
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Account / Payment Mode', 'Transactions', 'Total Volume']],
      body: methodRows,
      theme: 'grid',
      headStyles: {
        fillColor: [2, 132, 199], // sky-600
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 30 },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 42 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable to doc
    currentY = doc.lastAutoTable.finalY + 8;
  }

  // 5. Budgets Report
  if (sections.budgets !== false && budgets.length > 0) {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Active Budgets Status', margin, currentY);
    currentY += 3;

    const budgetRows = budgets.map((b) => {
      const spent = b.spent || 0;
      const limit = b.amount || 1;
      const pct = Math.round((spent / limit) * 100);
      const remaining = limit - spent;
      const statusText = pct > 100 ? `Over by ${pct - 100}%` : `${pct}% used`;

      return [
        b.name || (b.categoryId?.name) || 'Budget',
        b.period ? b.period.toUpperCase() : 'MONTHLY',
        formatCurrencyNumber(limit),
        formatCurrencyNumber(spent),
        formatCurrencyNumber(remaining),
        statusText,
      ];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Budget Name', 'Period', 'Limit', 'Spent', 'Remaining', 'Status']],
      body: budgetRows,
      theme: 'grid',
      headStyles: {
        fillColor: [16, 185, 129], // emerald-600
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'right', cellWidth: 26 },
        3: { halign: 'right', cellWidth: 26 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
        5: { halign: 'center', cellWidth: 26 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable to doc
    currentY = doc.lastAutoTable.finalY + 8;
  }

  // 6. Debts & Loans Report
  if (sections.debts !== false && debts.length > 0) {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Debts & Loans Position', margin, currentY);
    currentY += 3;

    const debtRows = debts.map((d) => {
      const isOwedToMe = d.direction === 'OWED_TO_ME';
      const personName = d.personId?.name || d.counterparty || 'Counterparty';
      const directionLabel = isOwedToMe ? 'Owed to Me' : 'I Owe';
      const remainingAmount = d.remainingAmount ?? (d.totalAmount - (d.settledAmount || 0));

      return [
        personName,
        directionLabel,
        formatCurrencyNumber(d.totalAmount || 0),
        formatCurrencyNumber(remainingAmount),
        d.status ? d.status.toUpperCase() : 'ACTIVE',
        d.dueDate ? formatDate(d.dueDate, 'dd MMM yyyy') : 'No due date',
      ];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Counterparty', 'Direction', 'Original Amount', 'Balance Due', 'Status', 'Due Date']],
      body: debtRows,
      theme: 'grid',
      headStyles: {
        fillColor: [245, 158, 11], // amber-500
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 26 },
        2: { halign: 'right', cellWidth: 26 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
        4: { halign: 'center', cellWidth: 22 },
        5: { halign: 'center', cellWidth: 28 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable to doc
    currentY = doc.lastAutoTable.finalY + 8;
  }

  // 7. Top Merchants Table
  if (sections.merchants !== false && topMerchants.length > 0) {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Top Counterparties & Merchants', margin, currentY);
    currentY += 3;

    const merchantRows = topMerchants.slice(0, 8).map((m) => [
      m.merchant,
      String(m.count),
      formatCurrencyNumber(m.total),
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Merchant / Payee', 'Frequency', 'Total Volume']],
      body: merchantRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 28 },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 42 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable to doc
    currentY = doc.lastAutoTable.finalY + 8;
  }

  // 8. Itemized Transactions Ledger
  if (sections.transactions !== false && filteredTransactions.length > 0) {
    if (currentY > pageHeight - 75) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Itemized Statement (${filteredTransactions.length} Transactions)`, margin, currentY);
    currentY += 3;

    const txRows = filteredTransactions.map((tx) => {
      const isIncome = tx.type === 'income';
      const isTransfer = tx.type === 'transfer';
      const sign = isIncome ? '+' : isTransfer ? '' : '-';
      const formattedAmount = `${sign}${formatCurrencyNumber(tx.amount)}`;

      return [
        formatDate(tx.transactionDate, 'dd-MM-yyyy'),
        tx.merchant || '-',
        resolveCategoryName(tx),
        tx.paymentMethod ? tx.paymentMethod.toUpperCase() : 'UPI',
        tx.type ? tx.type.toUpperCase() : 'EXPENSE',
        formattedAmount,
      ];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 15 },
      head: [['Date', 'Payee / Description', 'Category', 'Mode', 'Type', 'Amount']],
      body: txRows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 2,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 32 },
        3: { halign: 'center', cellWidth: 16 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  }

  // 9. Global Page Numbers & Footer Watermark
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    // Left footer
    doc.text(
      'SpendWise • Personal Financial Intelligence • Confidential',
      margin,
      pageHeight - 7
    );

    // Right footer
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 7,
      { align: 'right' }
    );
  }

  return doc;
}

/**
 * Generates and downloads a high-fidelity Executive PDF Report.
 */
export function exportReportToPDF(options: ExportReportOptions): jsPDF {
  const doc = buildPdfReportDoc(options);
  const filename = `spendwise-report-${options.startDate}-to-${options.endDate}.pdf`;
  if (typeof window !== 'undefined' && doc.save) {
    doc.save(filename);
  }
  return doc;
}

/**
 * Builds a multi-sheet formatted Excel workbook (.xlsx).
 */
export function buildExcelWorkbook(options: ExportReportOptions): XLSX.WorkBook {
  const {
    startDate,
    endDate,
    reportData,
    transactions = [],
    accountFilter = 'all',
    sections = {
      income: true,
      expenses: true,
      accounts: true,
      budgets: true,
      debts: true,
      categories: true,
      merchants: true,
      transactions: true,
    },
    budgets = [],
    debts = [],
  } = options;

  const filteredTransactions = transactions.filter((t) => {
    if (!accountFilter || accountFilter === 'all') return true;
    return (t.paymentMethod || '').toLowerCase() === accountFilter.toLowerCase();
  });

  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: Executive Summary
  const summary = reportData?.summary;
  const expensesByCategory = reportData?.breakdown?.expensesByCategory || [];
  const topMerchants = reportData?.breakdown?.topMerchants || [];
  const paymentMethods = reportData?.breakdown?.paymentMethods || [];

  const summaryRows: Array<Array<string | number>> = [
    ['SPENDWISE FINANCIAL INTELLIGENCE REPORT'],
    [`Period: ${startDate} to ${endDate}`],
    [`Exported On: ${new Date().toLocaleString('en-IN')}`],
    [`Account Filter: ${accountFilter.toUpperCase()}`],
    [],
  ];

  if (summary && (sections.income !== false || sections.expenses !== false)) {
    summaryRows.push(['EXECUTIVE SUMMARY', 'AMOUNT (INR)']);
    if (sections.income !== false) {
      summaryRows.push(['Total Income (Inflow)', summary.incomeThisMonth]);
    }
    if (sections.expenses !== false) {
      summaryRows.push(['Total Expenses (Outflow)', summary.expensesThisMonth]);
    }
    if (sections.income !== false && sections.expenses !== false) {
      summaryRows.push(['Net Retained Capital', summary.savingsThisMonth]);
      summaryRows.push(['Savings Rate (%)', `${summary.savingsRate}%`]);
    }
    summaryRows.push(['Total Transactions Count', filteredTransactions.length]);
    summaryRows.push([]);
  }

  if (sections.categories !== false && expensesByCategory.length > 0) {
    summaryRows.push(['EXPENSES BY CATEGORY', 'COUNT', 'TOTAL SPENT (INR)', '% SHARE']);
    const totalExpense = summary?.expensesThisMonth || 1;
    expensesByCategory.forEach((cat) => {
      const share = ((cat.total / totalExpense) * 100).toFixed(1);
      summaryRows.push([cat.name, cat.count || 0, cat.total, `${share}%`]);
    });
    summaryRows.push([]);
  }

  if (sections.accounts !== false && paymentMethods.length > 0) {
    summaryRows.push(['ACCOUNTS & PAYMENT MODES', 'TRANSACTIONS', 'TOTAL VOLUME (INR)']);
    paymentMethods.forEach((pm) => {
      summaryRows.push([pm.paymentMethod.toUpperCase(), pm.count, pm.total]);
    });
    summaryRows.push([]);
  }

  if (sections.budgets !== false && budgets.length > 0) {
    summaryRows.push(['BUDGETS TRACKING', 'PERIOD', 'LIMIT (INR)', 'SPENT (INR)', 'REMAINING (INR)']);
    budgets.forEach((b) => {
      const spent = b.spent || 0;
      const limit = b.amount || 0;
      summaryRows.push([
        b.name || b.categoryId?.name || 'Budget',
        (b.period || 'monthly').toUpperCase(),
        limit,
        spent,
        limit - spent,
      ]);
    });
    summaryRows.push([]);
  }

  if (sections.debts !== false && debts.length > 0) {
    summaryRows.push(['DEBTS & LOANS', 'DIRECTION', 'TOTAL (INR)', 'REMAINING (INR)', 'STATUS']);
    debts.forEach((d) => {
      summaryRows.push([
        d.personId?.name || d.counterparty || 'Counterparty',
        d.direction === 'OWED_TO_ME' ? 'Owed to Me' : 'I Owe',
        d.totalAmount || 0,
        d.remainingAmount ?? (d.totalAmount - (d.settledAmount || 0)),
        (d.status || 'active').toUpperCase(),
      ]);
    });
    summaryRows.push([]);
  }

  if (sections.merchants !== false && topMerchants.length > 0) {
    summaryRows.push(['TOP MERCHANTS / PAYEES', 'TRANSACTIONS', 'TOTAL VOLUME (INR)']);
    topMerchants.forEach((m) => {
      summaryRows.push([m.merchant, m.count, m.total]);
    });
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 32 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // 2. Sheet 2: Itemized Transactions Ledger
  if (sections.transactions !== false && filteredTransactions.length > 0) {
    const txHeaders = [
      'Date',
      'Type',
      'Payee / Merchant',
      'Category',
      'Amount (INR)',
      'Currency',
      'Payment Method',
      'Reference No',
      'Notes',
    ];

    const txRows = filteredTransactions.map((t) => [
      formatDate(t.transactionDate, 'yyyy-MM-dd'),
      t.type ? t.type.toUpperCase() : 'EXPENSE',
      t.merchant || '',
      resolveCategoryName(t),
      t.amount,
      t.currency || 'INR',
      (t.paymentMethod || 'upi').toUpperCase(),
      t.refNo || t.externalTransactionId || '',
      t.notes || '',
    ]);

    const wsTx = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows]);
    wsTx['!cols'] = [
      { wch: 13 },
      { wch: 12 },
      { wch: 30 },
      { wch: 22 },
      { wch: 15 },
      { wch: 10 },
      { wch: 15 },
      { wch: 22 },
      { wch: 35 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTx, 'Transactions');
  }

  return wb;
}

/**
 * Generates and downloads a multi-sheet formatted Excel workbook (.xlsx).
 */
export function exportReportToExcel(options: ExportReportOptions): XLSX.WorkBook {
  const wb = buildExcelWorkbook(options);
  const filename = `spendwise-report-${options.startDate}-to-${options.endDate}.xlsx`;
  if (typeof window !== 'undefined') {
    XLSX.writeFile(wb, filename);
  }
  return wb;
}

/**
 * Downloads transactions as RFC-4180 compliant CSV.
 * Uses authenticated API fetch if possible, or generates client-side as fallback.
 */
export async function downloadTransactionsCSV(
  startDate: string,
  endDate: string,
  transactionsFallback?: TransactionExportItem[]
): Promise<string> {
  const filename = `spendwise-transactions-${startDate}-to-${endDate}.csv`;

  try {
    const response = await api.get('/transactions/export', {
      params: { startDate, endDate },
      responseType: 'blob',
    });

    if (typeof document !== 'undefined') {
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return String(response.data);
  } catch (err) {
    // If backend export endpoint fails, generate client-side CSV from fallback transactions
    if (transactionsFallback && transactionsFallback.length > 0) {
      const headers = ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Merchant', 'Payment Method', 'Ref.No', 'Notes'];
      const lines = [headers.join(',')];

      for (const tx of transactionsFallback) {
        const line = [
          formatDate(tx.transactionDate, 'yyyy-MM-dd'),
          tx.type || 'expense',
          tx.amount,
          tx.currency || 'INR',
          `"${resolveCategoryName(tx).replace(/"/g, '""')}"`,
          `"${(tx.merchant || '').replace(/"/g, '""')}"`,
          tx.paymentMethod || 'upi',
          `"${(tx.refNo || tx.externalTransactionId || '').replace(/"/g, '""')}"`,
          `"${(tx.notes || '').replace(/"/g, '""')}"`,
        ];
        lines.push(line.join(','));
      }

      const csvContent = lines.join('\n');
      if (typeof document !== 'undefined') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return csvContent;
    }
    throw err;
  }
}
