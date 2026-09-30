import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseStatementFile } from '../statementParser.js';

const ROWS = [
  ['Date', 'Narration', 'Withdrawal', 'Deposit', 'Balance'],
  ['2026-09-01', 'UPI-25151 APOLLO PHARMAC-PAYTM.D19587523720@PTY-YESB0MCHUPI-145853247378-NO REMARK', 250, '', 9000],
  ['2026-09-02', 'ATM WITHDRAWAL AT BRANCH', 500, '', 8500],
  ['2026-09-03', 'FLIPKARTINTERNETPV-PAYU.AXIS1234567890-UTR-0000130408174425', 1200, '', 7300],
];

async function makeXlsxFile(): Promise<File> {
  const ws = XLSX.utils.aoa_to_sheet(ROWS);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Statement');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const bytes = new Uint8Array(buf as ArrayBuffer);
  return new File([bytes], 'statement.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('Excel import pipeline', () => {
  it('keeps only rows with a reference number and extracts the merchant', async () => {
    const result = await parseStatementFile(await makeXlsxFile());

    expect(result.totalRows).toBe(2);
    expect(result.transactions).toHaveLength(2);

    const apollo = result.transactions[0];
    expect(apollo.merchant).toBe('APOLLO PHARMACY');
    expect(apollo.refNo).toBe('145853247378');
    expect(apollo.category).toBe('Health & Medical');

    expect(result.transactions.map((t) => t.refNo)).toEqual([
      '145853247378',
      '0000130408174425',
    ]);
  });
});