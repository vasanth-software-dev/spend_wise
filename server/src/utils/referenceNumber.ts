/**
 * Utility for normalizing and comparing transaction reference numbers (Ref.No / UTR / UPI RRN).
 *
 * In Indian banking, the same transaction often carries different representations of the same reference number:
 * - Bank statement export: "0000130408174425" (zero-padded 16 digits)
 * - Email / App notification: "130408174425" (12 digits UPI reference / RRN)
 * - UPI narration: "UPI/130408174425" or "UPI/0000130408174425"
 */

/**
 * Normalizes a reference number by trimming, removing common prefixes (UPI/, UTR/, REF:),
 * and stripping leading zeroes for numeric references.
 */
export function normalizeRefNo(ref?: string | null): string {
  if (!ref) return '';
  let cleaned = String(ref).trim().toUpperCase();

  // Strip common transaction type / provider prefixes
  cleaned = cleaned.replace(/^(?:UPI|UTR|RRN|REF|TXN|IMPS|NEFT|CHQ|CHEQUE)[-/:#\s]+/i, '');

  // Strip trailing slashes or symbols
  cleaned = cleaned.replace(/[-/:#\s]+$/, '').trim();

  // If numeric with leading zeroes and has at least 4 digits, strip leading zeroes
  // e.g. "0000130408174425" -> "130408174425"
  if (/^0+[1-9]\d{3,}$/.test(cleaned)) {
    cleaned = cleaned.replace(/^0+/, '');
  }

  return cleaned;
}

/**
 * Compares two reference numbers to check if they point to the same underlying transaction.
 * e.g. "0000130408174425" and "130408174425" return true.
 */
export function isSameReference(refA?: string | null, refB?: string | null): boolean {
  if (!refA || !refB) return false;
  const normA = normalizeRefNo(refA);
  const normB = normalizeRefNo(refB);
  if (!normA || !normB) return false;
  return normA === normB;
}

/**
 * Builds a RegExp for querying MongoDB that matches any representation of the given reference number,
 * including leading zero padding, "UPI/" prefix, etc.
 */
export function buildRefNoQueryPattern(ref?: string | null): RegExp | null {
  const norm = normalizeRefNo(ref);
  if (!norm || norm.length < 4) return null;

  // Escape special regex characters in norm just in case
  const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Matches optional (UPI/ or UPI-), optional leading zeros, then the normalized reference
  return new RegExp(`^(?:UPI[/-]?)?0*${escaped}$`, 'i');
}
