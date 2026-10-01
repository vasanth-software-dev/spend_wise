import { describe, it, expect } from 'vitest';
import { extractReceiptBreakdown } from '../receiptBreakdown.js';
import { analyzeFrame } from '../receiptDetection.js';
import { ACCEPTED_IMAGE_TYPES, ACCEPT_ATTRIBUTE } from '../imageValidation.js';

const SAMPLE = [
  'ABC Supermarket',
  'Milk 2 x 60.00 120.00',
  'Rice 1 x 500.00 500.00',
  'Vegetables 1 x 380.00 380.00',
  'Subtotal 1000.00',
  'Discount 50.00',
  'CGST 47.50',
  'SGST 47.50',
  'Total 1045.00',
].join('\n');

describe('receipt breakdown', () => {
  it('parses subtotal/discount/taxes/total', () => {
    const b = extractReceiptBreakdown(SAMPLE);
    expect(b.subtotal).toBe(1000);
    expect(b.discount).toBe(50);
    expect(b.cgst).toBe(47.5);
    expect(b.sgst).toBe(47.5);
    expect(b.total).toBe(1045);
    expect(b.taxTotal).toBe(95);
  });

  it('extracts quantity line items', () => {
    const b = extractReceiptBreakdown(SAMPLE);
    expect(b.items.length).toBeGreaterThanOrEqual(3);
    expect(b.items[0].name.toLowerCase()).toContain('milk');
    expect(b.items[0].quantity).toBe(2);
  });

  it('stays null on garbage text instead of guessing', () => {
    const b = extractReceiptBreakdown('BLURRY\n???\nNO FIGURES');
    expect(b.total).toBeNull();
    expect(b.items).toEqual([]);
  });
});

describe('receipt detection', () => {
  it('reports NO_RECEIPT on a dark frame', () => {
    const w = 48; const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 10; data[i + 1] = 10; data[i + 2] = 10; data[i + 3] = 255;
    }
    const r = analyzeFrame(data, w, h, null);
    expect(['NO_RECEIPT', 'LOW_LIGHT']).toContain(r.guidance);
    expect(r.guidance === 'READY').toBe(false);
  });

  describe('receipt image formats', () => {
    it('offers only the supported receipt image formats', () => {
      expect(ACCEPTED_IMAGE_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
      expect(ACCEPT_ATTRIBUTE).toContain('image/jpeg');
      expect(ACCEPT_ATTRIBUTE).toContain('image/png');
      expect(ACCEPT_ATTRIBUTE).toContain('image/webp');
      expect(ACCEPT_ATTRIBUTE).not.toContain('image/*');
    });
  });

  it('detects a bright paper-like frame', () => {
    const w = 48; const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        const inGuide = x > 7 && x < 40 && y > 5 && y < 24;
        const v = inGuide ? 235 : 40;
        // Add texture so sharpness is non-zero.
        const tex = ((x * 7 + y * 13) % 5 === 0) ? 60 : 0;
        data[i] = v - tex; data[i + 1] = v - tex; data[i + 2] = v - tex; data[i + 3] = 255;
      }
    }
    const r = analyzeFrame(data, w, h, null);
    expect(r.coverage).toBeGreaterThan(0.1);
    expect(r.quad).not.toBeNull();
    expect(r.insideFrame).toBe(true);
    expect(r.guidance).toBe('READY');
  });

  it('asks the user to center a receipt that crosses the scanning frame', () => {
    const w = 48; const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        const onPaper = x > 7 && x < 40 && y > 1 && y < 22;
        const value = onPaper ? 235 : 40;
        data[i] = value; data[i + 1] = value; data[i + 2] = value; data[i + 3] = 255;
      }
    }
    const r = analyzeFrame(data, w, h, null);
    expect(r.insideFrame).toBe(false);
    expect(r.guidance).toBe('CENTER_RECEIPT');
  });
});
