import * as XLSX from 'xlsx';

export interface ExampleStatementRow {
  date: string;
  narration: string;
  refNo: string;
  withdrawal: number | string;
  deposit: number | string;
  balance: number | string;
}

export const EXAMPLE_TRANSACTIONS: ExampleStatementRow[] = [
  {
    date: '2026-09-01',
    narration: 'Salary Credit - ACME CORP PVT LTD',
    refNo: '0000130408174425',
    withdrawal: '',
    deposit: '75000.00',
    balance: '85000.00',
  },
  {
    date: '2026-09-02',
    narration: 'UPI-SWIGGY-swiggy@icici-145853247378-FOOD ORDER',
    refNo: '145853247378',
    withdrawal: '450.00',
    deposit: '',
    balance: '84550.00',
  },
  {
    date: '2026-09-03',
    narration: 'UPI-BLINKIT-blinkit@kotak-428194018291-GROCERY STORE',
    refNo: '428194018291',
    withdrawal: '1250.00',
    deposit: '',
    balance: '83300.00',
  },
  {
    date: '2026-09-04',
    narration: 'UPI-UBER-uber@axis-918237192831-CAB RIDE',
    refNo: '918237192831',
    withdrawal: '380.00',
    deposit: '',
    balance: '82920.00',
  },
  {
    date: '2026-09-05',
    narration: 'ELECTRICITY BILL TATA POWER-BILLDESK-982371029384',
    refNo: '982371029384',
    withdrawal: '1850.00',
    deposit: '',
    balance: '81070.00',
  },
  {
    date: '2026-09-06',
    narration: 'UPI-APOLLO PHARMACY-apollo@hdfcbank-559182371928',
    refNo: '559182371928',
    withdrawal: '620.00',
    deposit: '',
    balance: '80450.00',
  },
  {
    date: '2026-09-07',
    narration: 'UPI-ABIRAMI P-abirami@okhdfcbank-662918273918-TRANSFER',
    refNo: '662918273918',
    withdrawal: '',
    deposit: '3500.00',
    balance: '83950.00',
  },
  {
    date: '2026-09-08',
    narration: 'SELF TRANSFER TO SAVINGS-NEFT-771829381920',
    refNo: '771829381920',
    withdrawal: '10000.00',
    deposit: '',
    balance: '73950.00',
  },
];

export type ExampleFormat = 'pdf' | 'xlsx' | 'csv' | 'txt';

export interface FormatMeta {
  id: ExampleFormat;
  name: string;
  extension: string;
  mimeType: string;
  badge: string;
  badgeColor: string;
  description: string;
  columnsHelp: string;
  features: string[];
}

export const EXAMPLE_FORMATS_META: Record<ExampleFormat, FormatMeta> = {
  pdf: {
    id: 'pdf',
    name: 'PDF Statement',
    extension: '.pdf',
    mimeType: 'application/pdf',
    badge: 'PDF',
    badgeColor: 'rose',
    description: 'Official bank e-statement exported from HDFC, SBI, ICICI, Axis, Kotak, etc.',
    columnsHelp: 'Standard tabular layout with Date, Narration / Description, Ref/Chq No, Withdrawal (Dr), Deposit (Cr), and Balance.',
    features: ['Password-protected PDF support', 'Auto-detects debit/credit columns', 'Extracts 12-digit UPI RRN / UTRs'],
  },
  xlsx: {
    id: 'xlsx',
    name: 'Excel Spreadsheet',
    extension: '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    badge: 'Excel',
    badgeColor: 'emerald',
    description: 'Microsoft Excel workbook (.xlsx / .xls) with columns for date, particulars, and amounts.',
    columnsHelp: 'Headers: Date | Narration | Ref No | Withdrawal (Dr) | Deposit (Cr) | Balance',
    features: ['Standard Excel workbooks (.xlsx, .xls)', 'Handles debit/credit or single amount column', 'Multi-sheet detection'],
  },
  csv: {
    id: 'csv',
    name: 'CSV Delimited',
    extension: '.csv',
    mimeType: 'text/csv',
    badge: 'CSV',
    badgeColor: 'blue',
    description: 'Comma-separated values exported from net banking, accounting apps, or UPI statements.',
    columnsHelp: 'Headers: Date, Narration, RefNo, Withdrawal, Deposit, Balance',
    features: ['Universal CSV standard', 'Handles quotes & commas in narrations', 'Fast client-side parsing'],
  },
  txt: {
    id: 'txt',
    name: 'Text / TSV Export',
    extension: '.txt',
    mimeType: 'text/plain',
    badge: 'TXT',
    badgeColor: 'amber',
    description: 'Tab-delimited or plain text statement export commonly provided by internet banking portals.',
    columnsHelp: 'Tab-delimited format: Date [TAB] Narration [TAB] RefNo [TAB] Withdrawal [TAB] Deposit [TAB] Balance',
    features: ['Tab, comma, pipe, or semicolon separated', 'Lightweight plain text format', 'Auto-detects delimiters'],
  },
};

/**
 * Generate an Example CSV File
 */
export function createExampleCsvFile(): File {
  const headers = ['Date', 'Narration', 'RefNo', 'Withdrawal', 'Deposit', 'Balance'];
  const lines = [
    headers.join(','),
    ...EXAMPLE_TRANSACTIONS.map((row) =>
      [
        row.date,
        `"${row.narration.replace(/"/g, '""')}"`,
        row.refNo,
        row.withdrawal,
        row.deposit,
        row.balance,
      ].join(',')
    ),
  ];
  const content = lines.join('\n');
  return new File([content], 'example_statement.csv', { type: 'text/csv' });
}

/**
 * Generate an Example TXT (Tab-Delimited) File
 */
export function createExampleTxtFile(): File {
  const headers = ['Date', 'Narration', 'RefNo', 'Withdrawal', 'Deposit', 'Balance'];
  const lines = [
    headers.join('\t'),
    ...EXAMPLE_TRANSACTIONS.map((row) =>
      [
        row.date,
        row.narration,
        row.refNo,
        row.withdrawal,
        row.deposit,
        row.balance,
      ].join('\t')
    ),
  ];
  const content = lines.join('\n');
  return new File([content], 'example_statement.txt', { type: 'text/plain' });
}

/**
 * Generate an Example Excel (.xlsx) File
 */
export function createExampleExcelFile(): File {
  const rows = [
    ['Date', 'Narration', 'RefNo', 'Withdrawal', 'Deposit', 'Balance'],
    ...EXAMPLE_TRANSACTIONS.map((row) => [
      row.date,
      row.narration,
      row.refNo,
      row.withdrawal ? Number(row.withdrawal) : '',
      row.deposit ? Number(row.deposit) : '',
      row.balance ? Number(row.balance) : '',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Date
    { wch: 45 }, // Narration
    { wch: 18 }, // RefNo
    { wch: 14 }, // Withdrawal
    { wch: 14 }, // Deposit
    { wch: 14 }, // Balance
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Account Statement');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const bytes = new Uint8Array(buf as ArrayBuffer);
  return new File([bytes], 'example_statement.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Helper to build a minimal valid PDF-1.4 file binary with Helvetica font and tabular transaction layout.
 * Ensures pdfjs-dist can read text items and their coordinates accurately.
 */
export function createExamplePdfFile(): File {
  // We'll generate a valid PDF 1.4 document string with cross reference table
  // Layout coordinates (origin at bottom-left of 612 x 792 letter page)
  const streamCommands: string[] = [];

  // Title & Header info
  streamCommands.push('BT');
  streamCommands.push('/F1 16 Tf');
  streamCommands.push('50 740 Td');
  streamCommands.push('(SPENDWISE SAMPLE BANK STATEMENT) Tj');
  streamCommands.push('ET');

  streamCommands.push('BT');
  streamCommands.push('/F1 10 Tf');
  streamCommands.push('50 720 Td');
  streamCommands.push('(Account: 50100492819401 | Branch: Bengaluru Indiranagar | Period: 01/09/2026 to 08/09/2026) Tj');
  streamCommands.push('ET');

  // Table Headers
  // Positions:
  // Date: X=50
  // Narration: X=110
  // Ref: X=310
  // Withdrawal Amt (Debit): X=400
  // Deposit Amt (Credit): X=470
  // Balance: X=540
  const headerY = 680;
  streamCommands.push('BT');
  streamCommands.push('/F1 9 Tf');
  streamCommands.push(`50 ${headerY} Td (Date) Tj`);
  streamCommands.push(`60 0 Td (Narration / Description) Tj`);
  streamCommands.push(`200 0 Td (Chq / Ref No) Tj`);
  streamCommands.push(`90 0 Td (Withdrawal Amt) Tj`);
  streamCommands.push(`70 0 Td (Deposit Amt) Tj`);
  streamCommands.push(`70 0 Td (Balance) Tj`);
  streamCommands.push('ET');

  // Separator line under headers
  streamCommands.push('0.5 w');
  streamCommands.push(`50 ${headerY - 4} m 580 ${headerY - 4} l S`);

  // Rows
  let currentY = headerY - 20;
  for (const row of EXAMPLE_TRANSACTIONS) {
    const [year, month, day] = row.date.split('-');
    const formattedDate = `${day}/${month}/${year}`;
    const withdrawalStr = row.withdrawal ? Number(row.withdrawal).toFixed(2) : '0.00';
    const depositStr = row.deposit ? Number(row.deposit).toFixed(2) : '0.00';
    const balanceStr = Number(row.balance).toFixed(2);
    // Truncate narration to fit nicely
    const shortNarration = row.narration.substring(0, 36);

    streamCommands.push('BT');
    streamCommands.push('/F1 8 Tf');
    streamCommands.push(`50 ${currentY} Td (${formattedDate}) Tj`);
    streamCommands.push(`60 0 Td (${shortNarration}) Tj`);
    streamCommands.push(`200 0 Td (${row.refNo}) Tj`);
    streamCommands.push(`90 0 Td (${withdrawalStr}) Tj`);
    streamCommands.push(`70 0 Td (${depositStr}) Tj`);
    streamCommands.push(`70 0 Td (${balanceStr}) Tj`);
    streamCommands.push('ET');

    currentY -= 16;
  }

  const streamContent = streamCommands.join('\n');
  const streamLength = Buffer.byteLength ? Buffer.byteLength(streamContent, 'utf-8') : streamContent.length;

  const objects: string[] = [];
  // Object 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  // Object 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  // Object 3: Page
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj');
  // Object 4: Font
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  // Object 5: Contents
  objects.push(`5 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj`);

  let pdfString = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(pdfString.length);
    pdfString += obj + '\n';
  }

  const startxref = pdfString.length;
  pdfString += 'xref\n';
  pdfString += `0 ${objects.length + 1}\n`;
  pdfString += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    const offsetStr = String(offsets[i]).padStart(10, '0');
    pdfString += `${offsetStr} 00000 n \n`;
  }
  pdfString += 'trailer\n';
  pdfString += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdfString += 'startxref\n';
  pdfString += `${startxref}\n`;
  pdfString += '%%EOF\n';

  const encoder = new TextEncoder();
  const bytes = encoder.encode(pdfString);
  return new File([bytes], 'example_statement.pdf', { type: 'application/pdf' });
}

/**
 * Return an example statement file for the requested format
 */
export function getExampleStatementFile(format: ExampleFormat): File {
  switch (format) {
    case 'pdf':
      return createExamplePdfFile();
    case 'xlsx':
      return createExampleExcelFile();
    case 'csv':
      return createExampleCsvFile();
    case 'txt':
      return createExampleTxtFile();
  }
}

/**
 * Trigger download of the example statement file in the browser
 */
export function downloadExampleStatementFile(format: ExampleFormat): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const file = getExampleStatementFile(format);
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
