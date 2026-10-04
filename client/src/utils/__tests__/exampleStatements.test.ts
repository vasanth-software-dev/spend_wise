import { describe, it, expect } from 'vitest';
import {
  createExampleCsvFile,
  createExampleTxtFile,
  createExampleExcelFile,
  createExamplePdfFile,
  getExampleStatementFile,
  EXAMPLE_TRANSACTIONS,
} from '../exampleStatements.js';
import { parseStatementFile } from '../statementParser.js';

describe('Example statement generators', () => {
  it('creates a valid CSV file that parses correctly into transactions', async () => {
    const csvFile = createExampleCsvFile();
    expect(csvFile.name).toBe('example_statement.csv');
    const result = await parseStatementFile(csvFile);

    expect(result.fileType).toBe('csv');
    expect(result.transactions.length).toBe(EXAMPLE_TRANSACTIONS.length);

    // Verify key transactions
    const salary = result.transactions.find((t) => t.category === 'Salary');
    expect(salary).toBeDefined();
    expect(salary?.amount).toBe(75000);
    expect(salary?.type).toBe('income');
    expect(salary?.refNo).toMatch(/130408174425/);

    const swiggy = result.transactions.find((t) => t.merchant.includes('SWIGGY'));
    expect(swiggy).toBeDefined();
    expect(swiggy?.amount).toBe(450);
    expect(swiggy?.type).toBe('expense');
  });

  it('creates a valid TXT file that parses correctly into transactions', async () => {
    const txtFile = createExampleTxtFile();
    expect(txtFile.name).toBe('example_statement.txt');
    const result = await parseStatementFile(txtFile);

    expect(result.transactions.length).toBe(EXAMPLE_TRANSACTIONS.length);
    const blinkit = result.transactions.find((t) => t.merchant.includes('BLINKIT'));
    expect(blinkit).toBeDefined();
    expect(blinkit?.amount).toBe(1250);
  });

  it('creates a valid Excel (XLSX) file that parses correctly into transactions', async () => {
    const xlsxFile = createExampleExcelFile();
    expect(xlsxFile.name).toBe('example_statement.xlsx');
    const result = await parseStatementFile(xlsxFile);

    expect(result.fileType).toBe('xlsx');
    expect(result.transactions.length).toBe(EXAMPLE_TRANSACTIONS.length);

    const uber = result.transactions.find((t) => t.merchant.includes('UBER'));
    expect(uber).toBeDefined();
    expect(uber?.amount).toBe(380);
    expect(uber?.refNo).toBe('918237192831');
  });

  it('creates a valid PDF file that parses correctly into transactions', async () => {
    const pdfFile = createExamplePdfFile();
    expect(pdfFile.name).toBe('example_statement.pdf');

    const result = await parseStatementFile(pdfFile);
    expect(result.fileType).toBe('pdf');
    expect(result.transactions.length).toBeGreaterThanOrEqual(1);

    for (const tx of result.transactions) {
      expect(tx.refNo).toBeDefined();
      expect(tx.amount).toBeGreaterThan(0);
      expect(['expense', 'income', 'transfer']).toContain(tx.type);
    }
  });

  it('provides getExampleStatementFile for all 4 supported formats', () => {
    const formats = ['pdf', 'xlsx', 'csv', 'txt'] as const;
    for (const fmt of formats) {
      const file = getExampleStatementFile(fmt);
      expect(file).toBeInstanceOf(File);
      expect(file.name.endsWith(`.${fmt}`)).toBe(true);
    }
  });
});

