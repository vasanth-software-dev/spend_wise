import { ICategory } from '../types/index.js';

interface CategoryRule {
  name: string;
  pattern: RegExp;
}

export const CATEGORY_RULES: CategoryRule[] = [
  {
    name: 'Health & Medical',
    pattern: /apollo|pharmacy|pharmeasy|1mg|netmeds|medplus|practo|lal\s*path|metropolis|hospital|clinic|chemist|medical|medicine|doctor|dent|dr\b|diagnost|healthcare|wellness|cult\.fit|gym|fitness/i,
  },
  {
    name: 'Food & Dining',
    pattern: /swiggy|zomato|eats|starbucks|mcdonald|kfc|burger|pizza|domino|subway|restaurant|cafe|bakery|dining|chaayos|chai|haldiram|food|dhaba|bistro|snacks|tiffin|sweets|juice|tea|coffee|mess|canteen|hotel|bites|kitchen|caterers|fast\s*food|shawarma|ice\s*cream|parlour|biryani|darshini/i,
  },
  {
    name: 'Groceries',
    pattern: /grocer|blinkit|zepto|bigbasket|instamart|dmart|grofers|supermarket|provision|nature'?s\s*basket|country\s*delight|milk|veggie|fruit/i,
  },
  {
    name: 'Shopping',
    pattern: /amazon|flipkart|myntra|ajio|meesho|nykaa|zara|h&m|uniqlo|shopping|retail|cloth|dress|croma|reliancedigital|electronics|fashion/i,
  },
  {
    name: 'Transport',
    pattern: /uber|ola|rapido|metro|irctc|redbus|rail|transit|auto|taxi|cab|bus|train/i,
  },
  {
    name: 'Travel',
    pattern: /makemytrip|goibibo|easemytrip|indigo|air\s*india|flight|airline|hotel|resort|airbnb|booking\.com/i,
  },
  {
    name: 'Fuel',
    pattern: /fuel|petrol|diesel|cng|hpcl|bpcl|iocl|shell|gas\s*station/i,
  },
  {
    name: 'Bills & Utilities',
    pattern: /electric|tneb|bescom|cesc|tata\s*power|airtel|jio|vi\b|vodafone|broadband|water|gas|utility|bill|recharge|dth|postpaid/i,
  },
  {
    name: 'Subscriptions',
    pattern: /netflix|spotify|prime|hotstar|disney|apple|youtube|sony\s*liv|zee5|subscri|patreon|medium/i,
  },
  {
    name: 'Investments',
    pattern: /zerodha|groww|kuvera|angel\s*one|upstox|indmoney|mutual\s*fund|sip\b|stocks|shares|securities|smallcase/i,
  },
  {
    name: 'Rent',
    pattern: /rent|landlord|maintenance|society|housing|apartment|pg\b|hostel/i,
  },
  {
    name: 'Salary',
    pattern: /salary|payroll|stipend|bonus|pension/i,
  },
];

export interface CategoryPredictOptions {
  merchant?: string;
  vpa?: string;
}

/**
 * Predict category name based on merchant name, notes, raw email content, or VPA.
 */
export function predictCategoryName(
  text: string,
  options?: CategoryPredictOptions
): string {
  const combined = `${options?.merchant || ''} ${options?.vpa || ''} ${text || ''}`.trim();
  if (!combined) return 'Other';

  const merchant = (options?.merchant || '').trim();
  const vpa = (options?.vpa || '').trim();

  // 1. Check commercial/business rules first
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(merchant || combined)) {
      return rule.name;
    }
  }

  // 2. Check Friend / Personal Peer-to-Peer Transfer heuristics
  // Patterns:
  // - VPA is a 10-digit mobile number (e.g., 8489906290@yapl, 9876543210@paytm)
  // - Person's name with an initial (e.g., ABIRAMI P, PRIYA R, KUMAR S)
  // - P2P/Friend keywords
  const isP2PPhoneVpa = /^\d{10}@[a-zA-Z0-9.-]+/i.test(vpa);
  const isPersonInitialName = /^[A-Za-z]{2,20}(\s+[A-Za-z]{2,20})?\s+[A-Za-z](\.?)$/i.test(merchant);
  const hasFriendKeywords = /friend|splitwise|roommate|colleague|family|brother|sister|mom|dad|relative|p2p/i.test(combined);

  const isBusiness = /pvt|ltd|store|shop|mart|bazaar|enterprises|agency|foods|snacks|pharmacy|fuel|hospital|hotel|bakery|restaurant|cafe|sweets/i.test(
    merchant || combined
  );

  if ((isP2PPhoneVpa || isPersonInitialName || hasFriendKeywords) && !isBusiness) {
    return 'Friends & Family';
  }

  return 'Other';
}

/**
 * Find matching Category MongoDB ID from a list of user categories based on predicted name.
 */
export function findMatchingCategoryId(
  categories: ICategory[],
  predictedName: string
): string | null {
  if (!predictedName || predictedName === 'Other') {
    const otherCat = categories.find((c) => /other/i.test(c.name));
    return otherCat ? String(otherCat._id) : null;
  }

  // Exact or fuzzy match on category name
  const found = categories.find((c) =>
    c.name.toLowerCase() === predictedName.toLowerCase() ||
    c.name.toLowerCase().includes(predictedName.toLowerCase()) ||
    predictedName.toLowerCase().includes(c.name.toLowerCase())
  );

  if (found) return String(found._id);

  // Fallback for Friends & Family / Transfers
  if (/friend|family/i.test(predictedName)) {
    const p2pCat = categories.find((c) => /friend|family|transfer|personal/i.test(c.name));
    if (p2pCat) return String(p2pCat._id);
  }

  return null;
}
