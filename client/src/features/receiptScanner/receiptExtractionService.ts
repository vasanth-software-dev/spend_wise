import type { CategoryLike } from '../../constants/categories.js';
import type { ExtractedReceiptData, OCRTextResult } from './types.js';
import {
  AMOUNT_CONFIDENCE_THRESHOLD,
  CATEGORY_CONFIDENCE_THRESHOLD,
  DATE_CONFIDENCE_THRESHOLD,
  MERCHANT_CONFIDENCE_THRESHOLD,
  extractAmount,
  extractCurrency,
  extractDate,
  extractMerchant,
  extractPaymentMethod,
  extractTicketNumber,
  extractTime,
  type ExtractionInput,
} from './receiptExtraction.js';
import { suggestCategory, suggestDescription } from './categorySuggestion.js';

export interface BuildExtractionOptions {
  text: string;
  engineConfidence?: number | null;
  categories?: CategoryLike[];
}

/**
 * Turns raw OCR text into a review-ready extraction.
 *
 * The single most important rule in this file: anything below its confidence
 * threshold comes back as `null`, not as a best guess. The review screen renders
 * `null` as an empty input the user must fill in, which is the intended
 * behaviour for a blurry photo, a faded thermal print or an unsupported script.
 * No field is ever invented.
 */
export function buildExtractedReceiptData(options: BuildExtractionOptions): ExtractedReceiptData {
  const input: ExtractionInput = {
    text: options.text,
    engineConfidence: options.engineConfidence ?? null,
    categories: options.categories,
  };

  const amount = extractAmount(input);
  const date = extractDate(input);
  const merchant = extractMerchant(input);
  const category = suggestCategory(options.text, options.categories || []);

  const amountValue =
    Number.isFinite(amount.value) && amount.confidence >= AMOUNT_CONFIDENCE_THRESHOLD
      ? amount.value
      : null;

  const dateValue = date.value && date.confidence >= DATE_CONFIDENCE_THRESHOLD ? date.value : null;

  const merchantValue =
    merchant.value && merchant.confidence >= MERCHANT_CONFIDENCE_THRESHOLD
      ? merchant.value
      : null;

  // The category is only offered when a rule fired confidently AND the user
  // already owns that category. A fallback suggestion is surfaced separately by
  // the review screen as a soft hint rather than a pre-selected value.
  const categoryValue =
    !category.isFallback &&
    category.categoryId &&
    category.confidence >= CATEGORY_CONFIDENCE_THRESHOLD
      ? category.category
      : null;

  return {
    merchant: merchantValue,
    amount: amountValue,
    date: dateValue,
    time: extractTime(input),
    category: categoryValue,
    description: suggestDescription(options.text, merchantValue),
    currency: extractCurrency(input),
    paymentMethod: extractPaymentMethod(input),
    ticketNumber: extractTicketNumber(input),
    location: null,
    confidence: {
      merchant: merchantValue ? merchant.confidence : 0,
      amount: amountValue !== null ? amount.confidence : 0,
      date: dateValue ? date.confidence : 0,
      category: categoryValue ? category.confidence : 0,
    },
  };
}

/** Convenience wrapper for the common "OCR result straight to extraction" path. */
export function extractReceiptData(
  result: OCRTextResult,
  categories: CategoryLike[] = []
): ExtractedReceiptData {
  return buildExtractedReceiptData({
    text: result.text,
    engineConfidence: result.confidence,
    categories,
  });
}

/** Empty extraction used to reset the review form between scans. */
export function createEmptyExtraction(): ExtractedReceiptData {
  return {
    merchant: null,
    amount: null,
    date: null,
    time: null,
    category: null,
    description: null,
    currency: null,
    paymentMethod: null,
    ticketNumber: null,
    location: null,
    confidence: { merchant: 0, amount: 0, date: 0, category: 0 },
  };
}

export { AMOUNT_CONFIDENCE_THRESHOLD, DATE_CONFIDENCE_THRESHOLD, MERCHANT_CONFIDENCE_THRESHOLD };
