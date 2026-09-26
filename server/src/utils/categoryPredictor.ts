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
    pattern: /swiggy|zomato|eats|starbucks|mcdonald|kfc|burger|pizza|domino|subway|restaurant|cafe|bakery|dining|chaayos|chai|haldiram|food|dhaba|bistro/i,
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

/**
 * Predict category name based on merchant name, notes, or raw email content.
 */
export function predictCategoryName(text: string): string {
  if (!text) return 'Other';

  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      return rule.name;
    }
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

  return found ? String(found._id) : null;
}
