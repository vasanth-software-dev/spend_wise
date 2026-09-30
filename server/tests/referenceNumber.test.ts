import { describe, it, expect } from 'vitest';
import { normalizeRefNo, isSameReference, buildRefNoQueryPattern } from '../src/utils/referenceNumber.js';

describe('referenceNumber utility', () => {
  it('normalizes zero-padded reference numbers matching user example', () => {
    // 0000130408174425 from import and 130408174425 from email
    expect(normalizeRefNo('0000130408174425')).toBe('130408174425');
    expect(normalizeRefNo('130408174425')).toBe('130408174425');
    expect(isSameReference('0000130408174425', '130408174425')).toBe(true);
    expect(isSameReference('130408174425', '0000130408174425')).toBe(true);
  });

  it('normalizes prefixed reference numbers', () => {
    expect(normalizeRefNo('UPI/130408174425')).toBe('130408174425');
    expect(normalizeRefNo('UPI/0000130408174425')).toBe('130408174425');
    expect(normalizeRefNo('UTR: 130408174425')).toBe('130408174425');
    expect(normalizeRefNo('REF:0000130408174425/')).toBe('130408174425');
    expect(isSameReference('UPI/130408174425', '0000130408174425')).toBe(true);
  });

  it('returns false for different reference numbers', () => {
    expect(isSameReference('0000130408174425', '130408174426')).toBe(false);
    expect(isSameReference('', '130408174425')).toBe(false);
    expect(isSameReference(null, undefined)).toBe(false);
  });

  it('buildRefNoQueryPattern creates regex that matches zero-padded and plain variants', () => {
    const pattern = buildRefNoQueryPattern('0000130408174425');
    expect(pattern).not.toBeNull();
    expect(pattern!.test('130408174425')).toBe(true);
    expect(pattern!.test('0000130408174425')).toBe(true);
    expect(pattern!.test('UPI/130408174425')).toBe(true);
    expect(pattern!.test('UPI/0000130408174425')).toBe(true);
    expect(pattern!.test('130408174426')).toBe(false);
  });
});
