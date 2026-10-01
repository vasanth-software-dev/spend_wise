import { describe, it, expect } from 'vitest';
import { buildExtractedReceiptData } from '../receiptExtractionService.js';
import { suggestCategory } from '../categorySuggestion.js';
import { looksLikeImage } from '../imageValidation.js';

const CATEGORIES = [
  { _id: 'c_food', name: 'Food & Dining', type: 'expense' as const },
  { _id: 'c_grocery', name: 'Groceries', type: 'expense' as const },
  { _id: 'c_transport', name: 'Transport', type: 'expense' as const },
  { _id: 'c_fuel', name: 'Fuel', type: 'expense' as const },
  { _id: 'c_entertainment', name: 'Entertainment', type: 'expense' as const },
  { _id: 'c_other', name: 'Other', type: 'both' as const },
];

const GOOD_CONFIDENCE = 92;

describe('amount extraction', () => {
  it('prefers a labelled total over any other figure on the receipt', () => {
    const result = buildExtractedReceiptData({
      text: [
        'MTC Chennai',
        'Ticket No: MTC4821',
        'Fare 20.00',
        'Service Charge 3.00',
        'Grand Total 23.00',
        'Paid by Cash',
      ].join('\n'),
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });

    expect(result.amount).toBe(23);
    expect(result.confidence.amount).toBeGreaterThan(0);
  });

  it('reads a plain rupee total', () => {
    const result = buildExtractedReceiptData({
      text: 'PVR Cinemas\nTotal Amount: Rs. 350.00',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });

    expect(result.amount).toBe(350);
  });

  it('never guesses an amount when no currency figure is readable', () => {
    const result = buildExtractedReceiptData({
      text: 'BLURRED TICKET\nTOTAL ???\nNO READABLE FIGURES',
      engineConfidence: 30,
      categories: CATEGORIES,
    });

    // A missing amount must be null, never a plausible-looking number.
    expect(result.amount).toBeNull();
    expect(result.confidence.amount).toBe(0);
  });

  it('never guesses an amount on a low-confidence read', () => {
    const result = buildExtractedReceiptData({
      text: 'TOTAL 480.00',
      engineConfidence: 40,
      categories: CATEGORIES,
    });

    expect(result.amount).toBeNull();
  });

  it('does not mistake a phone number for the amount', () => {
    const result = buildExtractedReceiptData({
      text: 'Sunrise Bakery\nContact 9876543210\nTotal 145',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });

    expect(result.amount).toBe(145);
  });
});

describe('date extraction', () => {
  it('reads a day-first numeric date', () => {
    const result = buildExtractedReceiptData({
      text: 'MTC\nDate 01/10/2026\nFare 20',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });

    expect(result.date).toBe('2026-10-01');
  });

  it('reads a spelled-out month', () => {
    const result = buildExtractedReceiptData({
      text: 'PVR Cinemas\n01 Oct 2026\nTotal 350',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });

    expect(result.date).toBe('2026-10-01');
  });

  it('rejects a future date rather than trusting the OCR', () => {
    const result = buildExtractedReceiptData({
      text: 'Some Shop\nDate 01/01/2099\nTotal 100',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });

    expect(result.date).toBeNull();
  });

  it('rejects an impossible calendar date', () => {
    const result = buildExtractedReceiptData({
      text: 'Some Shop\nDate 31/02/2026\nTotal 100',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });

    expect(result.date).toBeNull();
  });

  it('leaves the date null when none is present', () => {
    const result = buildExtractedReceiptData({
      text: 'City Bus Depot\nFare 20',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });

    expect(result.date).toBeNull();
  });
});

describe('merchant extraction', () => {
  it('reads the trading name from the header', () => {
    const result = buildExtractedReceiptData({
      text: 'PVR Cinemas\nScreen 4\nTotal 350',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });

    expect(result.merchant).toBe('PVR Cinemas');
  });

  it('leaves the merchant null when no line looks like a business name', () => {
    const result = buildExtractedReceiptData({
      text: '9823012345\nREF 88213\nTOTAL',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });

    expect(result.merchant).toBeNull();
  });
});

describe('category suggestion', () => {
  it('maps a bus ticket to Transport', () => {
    const suggestion = suggestCategory('MTC Chennai City Bus Ticket Fare 20', CATEGORIES);
    expect(suggestion.category).toBe('Transport');
    expect(suggestion.categoryId).toBe('c_transport');
  });

  it('maps a movie ticket to Entertainment', () => {
    const suggestion = suggestCategory('PVR Cinemas Multiplex Movie Screen 4', CATEGORIES);
    expect(suggestion.category).toBe('Entertainment');
  });

  it('maps a restaurant bill to Food & Dining', () => {
    const suggestion = suggestCategory('Hotel Grand Cafe Restaurant Bill', CATEGORIES);
    expect(suggestion.category).toBe('Food & Dining');
  });

  it('maps a grocery receipt to Groceries', () => {
    const suggestion = suggestCategory('Fresh Basket Supermarket Grocery', CATEGORIES);
    expect(suggestion.category).toBe('Groceries');
  });

  it('maps a fuel receipt to Fuel rather than the broader Transport', () => {
    const suggestion = suggestCategory('HPCL Petrol Pump Diesel', CATEGORIES);
    expect(suggestion.category).toBe('Fuel');
  });

  it('never proposes a category the user does not have', () => {
    const suggestion = suggestCategory('PVR Cinemas Multiplex Movie', [
      { _id: 'c_other', name: 'Other', type: 'both' as const },
    ]);

    // Entertainment does not exist in this list, so it must not be suggested.
    expect(suggestion.category).toBe('Other');
    expect(suggestion.isFallback).toBe(true);
  });

  it('falls back without inventing a category id', () => {
    const suggestion = suggestCategory('QQQ ZZZ', []);
    expect(suggestion.isFallback).toBe(true);
    expect(suggestion.categoryId).toBeNull();
  });
});

describe('payment method', () => {
  it('detects cash', () => {
    const result = buildExtractedReceiptData({
      text: 'MTC\nFare 20\nPaid by Cash',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });
    expect(result.paymentMethod).toBe('cash');
  });

  it('detects UPI', () => {
    const result = buildExtractedReceiptData({
      text: 'Swiggy\nPaid via UPI\nTotal 320',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });
    expect(result.paymentMethod).toBe('upi');
  });

  it('stays null when no payment method is legible, leaving the cash default to the UI', () => {
    const result = buildExtractedReceiptData({
      text: 'MTC\nFare 20',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });
    expect(result.paymentMethod).toBeNull();
  });
});

describe('ticket number', () => {
  it('reads a labelled ticket number', () => {
    const result = buildExtractedReceiptData({
      text: 'MTC Chennai\nTicket No: TKT4821\nFare 20',
      engineConfidence: GOOD_CONFIDENCE,
      categories: CATEGORIES,
    });
    expect(result.ticketNumber).toBe('TKT4821');
  });
});

describe('image header validation', () => {
  const bytes = (...values: number[]) => new Uint8Array(values);

  it('accepts JPEG, PNG and WEBP headers', () => {
    expect(looksLikeImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe(true);
    expect(
      looksLikeImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0))
    ).toBe(true);
    expect(
      looksLikeImage(
        bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)
      )
    ).toBe(true);
  });

  it('rejects a non-image regardless of its declared type', () => {
    // ELF executable header: a renamed binary must never reach the canvas.
    expect(
      looksLikeImage(bytes(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0, 0, 0, 0, 0))
    ).toBe(false);
    // PDF header.
    expect(looksLikeImage(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0, 0, 0, 0, 0))).toBe(false);
  });

  it('rejects a truncated header', () => {
    expect(looksLikeImage(bytes(0xff, 0xd8))).toBe(false);
  });
});
