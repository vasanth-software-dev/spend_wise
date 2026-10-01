export interface ReceiptLineItem {
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  raw: string;
}

export interface ReceiptBreakdown {
  subtotal: number | null;
  discount: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  taxTotal: number | null;
  total: number | null;
  items: ReceiptLineItem[];
  rawText: string;
}

function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  const value = parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
  return Math.round(value * 100) / 100;
}

/** Last numeric token on a line (the line total / amount column). */
function lastAmount(line: string): number | null {
  const matches = line.match(/(\d[\d,]*\.?\d{0,2})/g);
  if (!matches || matches.length === 0) return null;
  // Avoid phone numbers / long digit runs.
  const candidate = matches[matches.length - 1];
  if (candidate.replace(/\D/g, '').length >= 10) return null;
  return toNumber(candidate);
}

const SUBTOTAL_RE = /(sub\s*total|subtotal|bill\s*total|net\s*amount(?!\s*pay)|gross\s*amount)/i;
const DISCOUNT_RE = /(discount|disc\.?|promo|coupon|offer|savings)/i;
const CGST_RE = /(cgst|central\s*gst)/i;
const SGST_RE = /(sgst|state\s*gst)/i;
const IGST_RE = /(igst|integrated\s*gst)/i;
const TOTAL_RE = /(grand\s*total|net\s*payable|total\s*payable|amount\s*payable|total\s*amount|\btotal\b|amount\s*due|balance\s*due|to\s*pay|payable)/i;
const TAX_RE = /\b(tax|gst|vat)\b/i;
const ITEM_QTY_RE = /(\d+(?:\.\d+)?)\s*[x×]\s*(?:Rs\.?|₹)?\s*(\d[\d,]*\.?\d{0,2})/i;
const NOISE_LINE_RE =
  /^(thank|welcome|visit again|gstin|fssai|phone|mobile|tel|address|date|time|bill no|invoice|receipt|cashier|counter|powered|software|www\.|http|upi|card|change|tender|cash\b)/i;

/**
 * Lightweight, dependency-free breakdown parser over OCR text.
 *
 * Runs AFTER OCR (never on camera frames). Anything uncertain stays `null`
 * so the review screen renders an empty editable input instead of a guess.
 */
export function extractReceiptBreakdown(text: string): ReceiptBreakdown {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let subtotal: number | null = null;
  let discount: number | null = null;
  let cgst: number | null = null;
  let sgst: number | null = null;
  let igst: number | null = null;
  let taxTotal: number | null = null;
  let total: number | null = null;

  for (const line of lines) {
    // Order matters: check specific tax lines before generic total.
    if (cgst === null && CGST_RE.test(line)) {
      const v = lastAmount(line);
      if (v !== null) {
        cgst = v;
        continue;
      }
    }
    if (sgst === null && SGST_RE.test(line)) {
      const v = lastAmount(line);
      if (v !== null) {
        sgst = v;
        continue;
      }
    }
    if (igst === null && IGST_RE.test(line)) {
      const v = lastAmount(line);
      if (v !== null) {
        igst = v;
        continue;
      }
    }
    if (discount === null && DISCOUNT_RE.test(line)) {
      const v = lastAmount(line);
      if (v !== null) {
        discount = v;
        continue;
      }
    }
    if (subtotal === null && SUBTOTAL_RE.test(line)) {
      const v = lastAmount(line);
      if (v !== null) {
        subtotal = v;
        continue;
      }
    }
    if (TAX_RE.test(line) && taxTotal === null && !CGST_RE.test(line) && !SGST_RE.test(line) && !IGST_RE.test(line)) {
      // Generic "Tax 47.50" line — keep only when no split taxes found.
      const v = lastAmount(line);
      if (v !== null && v > 0 && v < 100000) taxTotal = v;
    }
    if (TOTAL_RE.test(line)) {
      const v = lastAmount(line);
      if (v !== null) total = v; // last labelled total wins
    }
  }

  if (taxTotal === null) {
    const parts = [cgst, sgst, igst].filter((v): v is number => v !== null);
    if (parts.length > 0) taxTotal = Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100;
  }

  const items = extractLineItems(lines);

  return { subtotal, discount, cgst, sgst, igst, taxTotal, total, items, rawText: text };
}

function extractLineItems(lines: string[]): ReceiptLineItem[] {
  const items: ReceiptLineItem[] = [];
  for (const line of lines) {
    if (line.length < 3 || line.length > 80) continue;
    if (NOISE_LINE_RE.test(line)) continue;
    if (SUBTOTAL_RE.test(line) || TOTAL_RE.test(line) || CGST_RE.test(line) || SGST_RE.test(line) || IGST_RE.test(line) || DISCOUNT_RE.test(line)) continue;
    if (!/\d/.test(line)) continue;

    const qtyMatch = line.match(ITEM_QTY_RE);
    if (qtyMatch) {
      const qty = parseFloat(qtyMatch[1]);
      const unit = toNumber(qtyMatch[2]);
      const lineTotal = lastAmount(line);
      const name = line
        .slice(0, qtyMatch.index ?? line.length)
        .replace(/[*#~|]+/g, ' ')
        .trim();
      if (name.length < 2) continue;
      if (!Number.isFinite(qty) || qty <= 0 || qty > 1000) continue;
      items.push({
        name: cleanItemName(name),
        quantity: qty,
        unitPrice: unit,
        lineTotal: lineTotal,
        raw: line,
      });
      continue;
    }

    // Fallback: "<name> .... <price>" with at least 2 spaces or a trailing price.
    const tail = line.match(/^(.{2,40}?)\s{2,}(\d[\d,]*\.?\d{0,2})\s*$/);
    if (tail) {
      const name = cleanItemName(tail[1]);
      const price = toNumber(tail[2]);
      if (!name || price === null) continue;
      if (/\b(total|balance|change|tender)\b/i.test(name)) continue;
      items.push({ name, quantity: null, unitPrice: null, lineTotal: price, raw: line });
    }
  }
  // Cap to avoid turning a full-page printout into a huge editable list.
  return items.slice(0, 30);
}

function cleanItemName(raw: string): string {
  return raw
    .replace(/[*#~|]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
    .trim()
    .slice(0, 48);
}
