import { describe, it, expect } from 'vitest';
import {
  cleanMerchantName,
  extractReferenceNumber,
  hasValidReferenceNumber,
  predictCategoryAndType,
} from '../statementParser.js';

const APOLLO_UPI =
  'UPI-25151 APOLLO PHARMAC-PAYTM.D19587523720@PTY-YESB0MCHUPI-145853247378-NO REMARK';

describe('UPI merchant extraction', () => {
  it('extracts APOLLO PHARMACY from a UPI narration instead of the remark', () => {
    expect(cleanMerchantName(APOLLO_UPI)).toBe('APOLLO PHARMACY');
  });

  it('detects the reference number on the same narration', () => {
    const ref = extractReferenceNumber(APOLLO_UPI);
    expect(ref).toBe('145853247378');
    expect(hasValidReferenceNumber(ref)).toBe(true);
  });

  it('keeps resolving the category from the improved merchant', () => {
    const { category, type } = predictCategoryAndType(APOLLO_UPI, 'expense');
    expect(category).toBe('Health & Medical');
    expect(type).toBe('expense');
  });

  it('still handles previously supported narration formats', () => {
    expect(cleanMerchantName('SUDHA-PAYTMQR70TKPO@PTYS-YESB0PTMU')).toBe('SUDHA');
    expect(cleanMerchantName('BOOBAL 0000130389969858')).toBe('BOOBAL');
    expect(cleanMerchantName('AGN 0000202356023631 STORE')).toBe('AGN STORE');
  });
});

describe('reference number validation', () => {
  it('rejects missing or placeholder reference numbers', () => {
    expect(hasValidReferenceNumber(undefined)).toBe(false);
    expect(hasValidReferenceNumber('')).toBe(false);
    expect(hasValidReferenceNumber('-')).toBe(false);
    expect(hasValidReferenceNumber('NA')).toBe(false);
    expect(hasValidReferenceNumber('N/A')).toBe(false);
    expect(hasValidReferenceNumber('123')).toBe(false);
  });

  it('accepts real UPI / UTR references', () => {
    expect(hasValidReferenceNumber('145853247378')).toBe(true);
    expect(hasValidReferenceNumber('0000130408174425')).toBe(true);
    expect(hasValidReferenceNumber('UTR1234567890')).toBe(true);
  });
});