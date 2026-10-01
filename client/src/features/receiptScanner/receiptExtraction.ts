import type { CategoryLike } from '../../constants/categories.js';
import type { PaymentMethod } from '../../types/index.js';

/**
 * Below this, a field is treated as unreadable and left blank for the user.
 *
 * A wrong amount is worse than no amount, so the bar is deliberately high for
 * money and dates. Merchant and category can be a little more forgiving because
 * both are fully visible and editable in the review screen.
 */
export const AMOUNT_CONFIDENCE_THRESHOLD = 70;
export const DATE_CONFIDENCE_THRESHOLD = 60;
export const MERCHANT_CONFIDENCE_THRESHOLD = 55;
export const CATEGORY_CONFIDENCE_THRESHOLD = 60;

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export interface ExtractedLine {
  text: string;
  confidence: number | null;
}

export interface ExtractionInput {
  text: string;
  /** Engine-reported mean confidence, used to dampen field scores. */
  engineConfidence?: number | null;
  /** Categories the user actually has, so suggestions never invent a new one. */
  categories?: CategoryLike[];
}

/**
 * Splits OCR output into scored lines.
 *
 * Tesseract's plain `text` output has no per-line confidence, so when blocks are
 * unavailable every line inherits the page confidence. That is enough to reject
 * a very poor read while still allowing the keyword rules to work on good ones.
 */
function toLines(input: ExtractionInput): ExtractedLine[] {
  return input.text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .map((text) => ({ text, confidence: input.engineConfidence ?? null }));
}

function scaleConfidence(base: number | null, factor: number, engine: number | null): number {
  const start = base === null ? 78 : base;
  const damped = engine === null ? start : start * 0.5 + engine * 0.5;
  return Math.max(0, Math.min(100, Math.round(damped * factor)));
}

/** OCR routinely swaps these, so they are normalised before parsing. */
function normalizeForParsing(text: string): string {
  return text
    .replace(/[₹]/g, ' INR ')
    .replace(/[–—]/g, '-')
    .replace(/(\d),(\d{3})\b/g, '$1$2')
    .replace(/[ \t]+/g, ' ');
}

const AMOUNT_LABEL =
  /(?:grand\s*total|net\s*amount|total\s*amount|total\s*payable|amount\s*payable|total|bill\s*total|amount|fare|price|paid|value|total\s*amt)/i;

const CURRENCY_SYMBOLS: Array<{ pattern: RegExp; currency: string }> = [
  { pattern: /[₹]|\bINR\b|\bRs\.?\b/i, currency: 'INR' },
  { pattern: /[$]\s?|\bUSD\b/i, currency: 'USD' },
  { pattern: /[€]|\bEUR\b/i, currency: 'EUR' },
  { pattern: /[£]|\bGBP\b/i, currency: 'GBP' },
  { pattern: /\bAED\b|\bد\.?إ\.?\b/i, currency: 'AED' },
];

const PAYMENT_KEYWORDS: Array<{ pattern: RegExp; method: PaymentMethod }> = [
  { pattern: /\b(cash|currency\s*note|notes?\s*received|paid\s*in\s*cash|by\s*cash)\b/i, method: 'cash' },
  { pattern: /\b(upi|gpay|google\s*pay|phonepe|phone\s*pe|paytm|bhim|cred)\b/i, method: 'upi' },
  { pattern: /\b(credit\s*card|debit\s*card|visa|mastercard|rupay|amex|maestro|card\s*no)\b/i, method: 'card' },
  { pattern: /\b(net\s*banking|imps|neft|rtgs|upi\s*ref|bank\s*transfer|account\s*transfer)\b/i, method: 'bank' },
  { pattern: /\b(wallet|amazon\s*pay|payzapp|mobikwik)\b/i, method: 'wallet' },
];

const TICKET_NUMBER_LABELS = [
  /ticket\s*(?:no\.?|number|#|id)/i,
  /\b(?:tkt|txn|transaction|receipt|inv|invoice|bill|ref|reference|utr)\s*(?:no\.?|number|#|id)?/i,
  /\bserial\s*(?:no\.?|number|#)/i,
];

/** Lines that are never a merchant name. */
const MERCHANT_NOISE =
  /^(receipt|invoice|bill|tax\s*invoice|cash\s*memo|gst|thank\s*you|welcome|total|amount|grand\s*total|subtotal|cash|change|balance|date|time|customer|phone|mobile|gstin|pan)\b/i;

const MERCHANT_SUFFIX =
  /\b(pvt|private|ltd|limited|llp|inc|co|company|store|stores|shop|mart|supermarket|restaurant|restaurants|cafe|hotel|cinemas|cinema|theatre|mart|kiosk|centre|center|complex|station|bus\s*stand|hospital|pharmacy|fuel\s*station|pump)\b/i;

export interface AmountCandidate {
  value: number;
  confidence: number;
}

/**
 * Finds the amount to charge.
 *
 * Preference order, strongest evidence first:
 *  1. a number on a line explicitly labelled as a total/amount/fare
 *  2. the largest currency-looking number on the receipt
 *  3. nothing at all
 *
 * Option 3 is a real outcome. When no number clears the confidence bar the amount
 * is left null and the review screen asks the user to type it.
 */
export function extractAmount(input: ExtractionInput): AmountCandidate {
  const lines = toLines(input);
  const engine = input.engineConfidence ?? null;
  const candidates: AmountCandidate[] = [];

  // Many thermal tickets print the currency symbol once, on the header, or not
  // at all, so a clearly labelled line is allowed to stand on its own. It is
  // discounted so it still has to clear the same confidence bar, which keeps an
  // unlabelled bare number from ever being treated as an amount.
  for (const line of lines) {
    const normalized = normalizeForParsing(line.text);
    if (!/\d/.test(normalized)) continue;

    const lineHasCurrency = CURRENCY_SYMBOLS.some((entry) => entry.pattern.test(normalized));
    const labelled = AMOUNT_LABEL.test(normalized);

    if (!lineHasCurrency && !labelled) continue;
    // Phone numbers, dates and long digit runs are not money.
    if (/\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/.test(normalized)) continue;
    if (/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/.test(normalized)) continue;

    const values = readNumericValues(normalized);
    for (const value of values) {
      if (value <= 0 || value > 1_000_000) continue;
      // A GST/phone/card line is never the payable total.
      if (/(gstin|gst\s*no|phone|mobile|card\s*no|aadhaar|pan\s*no)/i.test(normalized)) continue;
      const factor = lineHasCurrency ? (labelled ? 1 : 0.62) : 0.78;
      candidates.push({
        value,
        confidence: scaleConfidence(line.confidence, factor, engine),
      });
    }
  }

  if (candidates.length === 0) {
    return { value: NaN, confidence: 0 };
  }

  // A labelled total wins outright. Otherwise the largest figure on a receipt
  // is nearly always the amount actually charged.
  const labelledCandidates = candidates.filter((candidate) => candidate.confidence >= 70);
  const pool = labelledCandidates.length > 0
    ? labelledCandidates
    : candidates;

  const best = pool.reduce((top, candidate) =>
    candidate.confidence > top.confidence ||
    (candidate.confidence === top.confidence && candidate.value > top.value)
      ? candidate
      : top
  );

  return best;
}

/** Reads every plausible number in a line, tolerating OCR digit noise. */
function readNumericValues(line: string): number[] {
  const values: number[] = [];
  const pattern = /\d+(?:[.,]\d{1,2})?/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    const raw = match[0];
    // Indian format 1,23,456.00 collapses to 123456.00.
    const normalized = raw.replace(/,/g, '');
    const value = parseFloat(normalized);
    if (!Number.isNaN(value)) {
      values.push(Math.round(value * 100) / 100);
    }
  }

  return values;
}

export interface DateCandidate {
  /** ISO `YYYY-MM-DD`. */
  value: string;
  confidence: number;
}

/**
 * Recognises the common Indian receipt date shapes: `01/10/2026`, `01-10-26`,
 * `1 Oct 2026`, `2026-10-01`, and `01/10/26 14:32`.
 *
 * Two-digit years are resolved to the most recent plausible year, and anything
 * dated in the future is rejected outright — a receipt cannot be dated ahead of
 * today, so a future value is an OCR mistake, not a real transaction.
 */
export function extractDate(input: ExtractionInput): DateCandidate {
  const text = normalizeForParsing(input.text);
  const engine = input.engineConfidence ?? null;
  const now = new Date();
  const candidates: DateCandidate[] = [];

  const isoPattern = /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g;
  for (const match of text.matchAll(isoPattern)) {
    const value = buildIso(Number(match[1]), Number(match[2]), Number(match[3]));
    if (value) candidates.push({ value, confidence: scaleConfidence(engine, 0.95, engine) });
  }

  const numericPattern = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g;
  for (const match of text.matchAll(numericPattern)) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const rawYear = Number(match[3]);

    let year = rawYear;
    if (rawYear < 100) {
      year = 2000 + rawYear;
    }

    // Indian receipts are day-first; a value above 12 in the first position
    // proves it, so only the unambiguous case is flipped.
    const dayFirst = first > 12 || second <= 12;
    const resolved = dayFirst
      ? buildIso(year, second, first)
      : buildIso(year, first, second);

    if (resolved) {
      candidates.push({
        value: resolved,
        // Numeric-only dates are common but ambiguous about day/month order.
        confidence: scaleConfidence(engine, dayFirst ? 0.9 : 0.72, engine),
      });
    }
  }

  const textPattern =
    /\b(\d{1,2})\s*([A-Za-z]{3,9})\.?\s*(\d{2,4})\b/g;
  for (const match of text.matchAll(textPattern)) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month === undefined) continue;
    const rawYear = Number(match[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const resolved = buildIso(year, month + 1, Number(match[1]));
    if (resolved) {
      candidates.push({ value: resolved, confidence: scaleConfidence(engine, 0.95, engine) });
    }
  }

  const usable = candidates.filter((candidate) => {
    const parsed = new Date(`${candidate.value}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() <= endOfToday(now);
  });

  if (usable.length === 0) {
    return { value: '', confidence: 0 };
  }

  return usable.reduce((top, candidate) => (candidate.confidence > top.confidence ? candidate : top));
}

function buildIso(year: number, month: number, day: number): string | null {
  if (year < 1990 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  // Rejects impossible dates like 31/02 by round-tripping through the calendar.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  const pad = (input: number) => String(input).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

function endOfToday(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
}

export function extractTime(input: ExtractionInput): string | null {
  const match = normalizeForParsing(input.text).match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function extractCurrency(input: ExtractionInput): string | null {
  const text = input.text;
  for (const entry of CURRENCY_SYMBOLS) {
    if (entry.pattern.test(text)) return entry.currency;
  }
  return null;
}

export function extractPaymentMethod(input: ExtractionInput): PaymentMethod | null {
  for (const entry of PAYMENT_KEYWORDS) {
    if (entry.pattern.test(input.text)) return entry.method;
  }
  return null;
}

export function extractTicketNumber(input: ExtractionInput): string | null {
  const lines = toLines(input);
  for (const line of lines) {
    for (const label of TICKET_NUMBER_LABELS) {
      const match = line.text.match(label);
      if (!match) continue;
      const after = line.text.slice((match.index ?? 0) + match[0].length);
      const value = after.match(/[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{3,19})/i);
      if (value && /\d/.test(value[1])) {
        return value[1].replace(/[.,;]+$/, '').toUpperCase();
      }
    }
  }
  return null;
}

/**
 * Picks the merchant name.
 *
 * On a paper receipt the trading name is the prominent text near the top, so the
 * first few non-noise lines that look like a business name are preferred. When
 * nothing qualifies, the merchant stays null and the user types it — a wrong
 * merchant name would silently corrupt future merchant-level reports.
 */
export function extractMerchant(input: ExtractionInput): { value: string | null; confidence: number } {
  const lines = toLines(input);
  const engine = input.engineConfidence ?? null;
  const header = lines.slice(0, 6);

  for (let index = 0; index < header.length; index += 1) {
    const line = header[index];
    const candidate = cleanMerchantCandidate(line.text);
    if (!candidate) continue;

    // Earlier lines are stronger evidence, and lines that carry a business
    // suffix are stronger still.
    const positionFactor = index === 0 ? 1 : index <= 2 ? 0.92 : 0.82;
    const suffixFactor = MERCHANT_SUFFIX.test(line.text) ? 1.05 : 1;
    const confidence = scaleConfidence(line.confidence, positionFactor * suffixFactor, engine);

    if (confidence >= MERCHANT_CONFIDENCE_THRESHOLD) {
      return { value: candidate, confidence };
    }
  }

  return { value: null, confidence: 0 };
}

function cleanMerchantCandidate(line: string): string | null {
  let candidate = line
    .replace(/[*#~|]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (candidate.length < 3 || candidate.length > 60) return null;
  if (MERCHANT_NOISE.test(candidate)) return null;
  // A line that is mostly digits is a phone number, date or reference.
  const digits = (candidate.match(/\d/g) || []).length;
  if (digits / candidate.replace(/\s/g, '').length > 0.4) return null;
  if (CURRENCY_SYMBOLS.some((entry) => entry.pattern.test(candidate))) return null;
  if (/\d{4,}/.test(candidate)) return null;
  if (!/[A-Za-z]{2}/.test(candidate)) return null;

  candidate = candidate
    .replace(/[.,;:]+$/, '')
    .replace(/\b(ph|phone|mobile|tel|www|http\S*)\b.*$/i, '')
    .trim();

  if (candidate.length < 3) return null;
  return candidate;
}
