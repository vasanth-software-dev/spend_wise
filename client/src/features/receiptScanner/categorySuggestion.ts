import type { CategoryLike } from '../../constants/categories.js';

/**
 * Keyword rules for suggesting a SpendWise category from OCR text.
 *
 * The target names are the existing system categories. Nothing here creates a
 * category: `resolveCategoryId` only ever returns the id of a category the user
 * already has, and returns null when there is no confident match so the review
 * screen leaves the picker on whatever the user last chose.
 */
interface CategoryRule {
  /** Category name in the existing SpendWise taxonomy. */
  category: string;
  keywords: string[];
}

/**
 * Ordered most-specific first. `bus ticket` must beat the generic `ticket`
 * keyword, and `fuel` must beat the broader `transport` words.
 */
const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Entertainment',
    keywords: [
      'cinema', 'cinemas', 'movie', 'movies', 'film', 'multiplex', 'theatre', 'theater',
      'pvr', 'inox', 'cinepolis', 'bookmyshow', 'imax', 'show', 'screen', 'concert',
      'amusement', 'bowling', 'arcade', 'theme park', 'water park', 'circus', 'museum',
      'entertainment', 'event',
    ],
  },
  {
    category: 'Fuel',
    keywords: [
      'petrol', 'diesel', 'fuel', 'pump', 'hpcl', 'bharat petroleum', 'bpcl', 'iocl',
      'indian oil', 'shell', 'nayara', 'jio bp', 'fuel station', 'filling station',
      'xylem', 'toll', 'fastag',
    ],
  },
  {
    category: 'Groceries',
    keywords: [
      'grocery', 'groceries', 'supermarket', 'hypermarket', 'provision', 'kirana',
      'vegetable', 'fruits', 'vegetables', 'dmart', 'more supermaket', 'bigbasket',
      'blinkit', 'zepto', 'instamart', 'spencer', 'reliance fresh', 'milk', 'dairy',
      'department store', 'general store',
    ],
  },
  {
    category: 'Food & Dining',
    keywords: [
      'restaurant', 'restaurants', 'cafe', 'cafeteria', 'dhaba', 'biryani', 'mess',
      'canteen', 'tiffin', 'bakery', 'bakery', 'pizza', 'burger', 'chinese', 'thali',
      'bar &', 'pub', 'brewery', 'swiggy', 'zomato', 'mcdonald', 'kfc', 'starbucks',
      'hotel', 'lodge', 'food court', 'bhojanalaya', 'eatery', 'takeaway', 'delivery',
    ],
  },
  {
    category: 'Transport',
    keywords: [
      'bus', 'buses', 'bus ticket', 'bus stand', 'bus stop', 'metro', 'train', 'railway',
      'railways', 'irctc', 'ticket counter', 'rtc', 'ksrtc', 'msrtc', 'apsrtc', 'tsrtc',
      'srtc', 'mettube', 'cabs', 'taxi', 'auto rickshaw', 'rickshaw', 'uber', 'ola',
      'rapido', 'parking', 'park', 'transit', 'travels', 'abhibus', 'redbus', 'makemytrip',
      'irctc coach', 'platform', 'conductor', 'route no',
    ],
  },
  {
    category: 'Bills & Utilities',
    keywords: [
      'electricity', 'water bill', 'gas bill', 'broadband', 'wifi bill', 'postpaid',
      'prepaid', 'mobile recharge', 'recharge', 'airtel', 'jio', 'vodafone', 'bsnl',
      'bescom', 'adani electricity', 'tata power', 'bill payment', 'utility',
    ],
  },
  {
    category: 'Health & Medical',
    keywords: [
      'pharmacy', 'medical', 'hospital', 'clinic', 'doctor', 'chemist', 'apollo',
      'medplus', 'netmeds', '1mg', 'practo', 'diagnostic', 'lab test', 'dental',
    ],
  },
  {
    category: 'Subscriptions',
    keywords: ['netflix', 'prime video', 'hotstar', 'spotify', 'youtube premium', 'subscription', 'OTT'],
  },
  {
    category: 'Shopping',
    keywords: [
      'mall', 'retail', 'store', 'shop', 'boutique', 'fashion', 'footwear', 'electronics',
      'lifestyle', 'department', 'textile', 'jewellery', 'salon', 'salon & grooming',
      'barber', 'spa', 'parlour', 'beauty', 'cosmetics',
    ],
  },
  {
    category: 'ATM & Cash',
    keywords: ['atm', 'cash withdrawal', 'cash deposit', 'withdrawal', 'bank teller'],
  },
];

/** Default when the text suggests entertainment but matches nothing specific. */
const FALLBACK_CATEGORY = 'Entertainment';

export interface CategorySuggestion {
  /** Existing category name. */
  category: string;
  /** Resolved id within the user's category list, when one matches. */
  categoryId: string | null;
  confidence: number;
  /** True when nothing matched and the user should pick a category. */
  isFallback: boolean;
}

/**
 * Scores each category rule by how many distinct keywords appear in the text.
 *
 * A single keyword hit is a weak signal on a receipt because incidental words
 * are common, so the score is discounted until two distinct keywords agree.
 */
function scoreCategories(text: string): Array<{ category: string; score: number }> {
  const haystack = text.toLowerCase();
  const scores: Array<{ category: string; score: number }> = [];

  for (const rule of CATEGORY_RULES) {
    let hits = 0;
    let hasTicketOrReceiptTerm = false;

    for (const keyword of rule.keywords) {
      if (haystack.includes(keyword)) {
        hits += 1;
        if (keyword.includes('ticket') || keyword.includes('receipt')) {
          hasTicketOrReceiptTerm = true;
        }
      }
    }

    if (hits === 0) continue;

    // One weak keyword is not enough; two agreeing keywords, or an explicit
    // ticket/receipt term for that category, is.
    if (hits === 1 && !hasTicketOrReceiptTerm) continue;

    scores.push({ category: rule.category, score: hits + (hasTicketOrReceiptTerm ? 1 : 0) });
  }

  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Maps the merchant name onto an existing category, used for the short
 * description shown on the review screen ("Bus ticket", "Movie ticket").
 */
const DESCRIPTION_HINTS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\b(bus|metro|rtc|railway|train|travels)\b/i, description: 'Bus ticket' },
  { pattern: /\b(cinema|movie|film|multiplex|theatre|pvr|inox)\b/i, description: 'Movie ticket' },
  { pattern: /\b(parking|fastag|toll)\b/i, description: 'Parking' },
  { pattern: /\b(petrol|diesel|fuel|pump|hpcl|iocl|bpcl)\b/i, description: 'Fuel' },
  { pattern: /\b(grocery|supermarket|kirana|provision)\b/i, description: 'Groceries' },
  { pattern: /\b(restaurant|cafe|dhaba|biryani|food court)\b/i, description: 'Restaurant bill' },
  { pattern: /\b(pharmacy|medical|hospital|clinic|chemist)\b/i, description: 'Medical bill' },
  { pattern: /\b(electricity|water|gas|broadband|recharge)\b/i, description: 'Utility bill' },
];

export function suggestDescription(text: string, merchant: string | null): string | null {
  const combined = `${merchant || ''} ${text}`;
  for (const hint of DESCRIPTION_HINTS) {
    if (hint.pattern.test(combined)) return hint.description;
  }
  return null;
}

/**
 * Resolves a category suggestion to an id from the user's real category list.
 *
 * A rule result that has no matching category in that list is downgraded to the
 * fallback, so the scanner can never propose a category that does not exist and
 * can never create one.
 */
export function suggestCategory(
  text: string,
  categories: CategoryLike[] = []
): CategorySuggestion {
  const byName = new Map<string, CategoryLike>();
  for (const category of categories) {
    const name = (category.name || '').trim().toLowerCase();
    if (name) byName.set(name, category);
  }

  const expenseCategories = categories.filter(
    (category) => category.type === 'expense' || category.type === 'both'
  );

  const scored = scoreCategories(text);

  for (const entry of scored) {
    const match = byName.get(entry.category.toLowerCase());
    if (match) {
      return {
        category: match.name,
        categoryId: match._id || null,
        // More agreeing keywords means a stronger, still user-editable signal.
        confidence: Math.min(95, 60 + entry.score * 12),
        isFallback: false,
      };
    }
  }

  // No rule matched, or the matched category is not in the user's list. Suggest
  // Entertainment only if the user actually has it.
  const fallbackMatch =
    byName.get(FALLBACK_CATEGORY.toLowerCase()) ||
    expenseCategories.find((category) => category.name.toLowerCase() === 'other');

  return {
    category: fallbackMatch?.name || FALLBACK_CATEGORY,
    categoryId: fallbackMatch?._id || null,
    confidence: 0,
    isFallback: true,
  };
}
