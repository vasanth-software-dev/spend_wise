import { ICategory } from '../types/index.js';

interface CategoryRule {
  name: string;
  pattern: RegExp;
}

export const CATEGORY_RULES: CategoryRule[] = [
  {
    name: 'Self Transfer',
    pattern: /self[\s\-_]*(transfer|credit|debit|neft|rtgs|imps|upi)|\btransfer\w*\s+(to|received\s+from)\s+self\b|\bown\s+(account|a\/c|accounts)\b|\bbetween\s+(my\s+)?own\b|\binternal\s+transfer\b/i,
  },
  {
    name: 'Health & Medical',
    pattern: /apollo|pharmacy|pharmeasy|1mg|netmeds|medplus|practo|lal\s*path|metropolis|hospital|clinic|chemist|medical|medicine|doctor|dent|dr\b|diagnost|healthcare|wellness|cult\.fit|gym|fitness/i,
  },
  {
    name: 'Food & Dining',
    pattern: /swiggy|zomato|eats|starbucks|mcdonald|kfc|burger|pizza|domino|subway|restaurant|cafe|bakery|dining|chaayos|chai|haldiram|food|dhaba|bistro|snacks|tiffin|sweets|juice|tea|coffee|mess|canteen|hotel|bites|kitchen|caterers|fast\s*food|shawarma|ice\s*cream|parlour|biryani|biryan|biriyani|darshini|stall|stalls|chat|chaat|dosa|dosai|s\s*d\s*o\s*sa|dish|cuisine/i,
  },
  {
    name: 'Groceries',
    pattern: /grocer|blinkit|zepto|bigbasket|instamart|dmart|grofers|supermarket|provision|nature'?s\s*basket|country\s*delight|milk|veggie|fruit/i,
  },
  {
    name: 'Shopping',
    pattern: /amazon|flipkart|myntra|ajio|meesho|nykaa|zara|h&m|uniqlo|shopping|retail|cloth|dress|croma|reliancedigital|electronics?|electricals?|hardware|appliances?|electric\s*store|fashion|store|stores|agn\s*store/i,
  },
  {
    name: 'Transport',
    pattern: /uber|ola|rapido|metro|irctc|redbus|abhibus|zingbus|travels|rail|transit|auto|taxi|cab|bus|train|ticketing|transportation/i,
  },
  {
    name: 'Travel',
    pattern: /makemytrip|goibibo|easemytrip|indigo|air\s*india|flight|airline|hotel|resort|airbnb|booking\.com/i,
  },
  {
    name: 'Fuel',
    pattern: /fuel|petrol|diesel|cng|hpcl|bpcl|iocl|shell|gas\s*station|petrol\s*bunk|bunk/i,
  },
  {
    name: 'Bills & Utilities',
    pattern: /electric|tneb|bescom|cesc|tata\s*power|airtel|jio|vi\b|vodafone|broadband|water|gas|utility|bill|recharge|dth|postpaid|godaddy|domain|hosting|web\s*hosting|registrar|cloudflare|aws|payzapp|wallet/i,
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
    name: 'Salon & Grooming',
    pattern: /salon|saloon|parlour|parlor|barber|spa|haircut|hair|grooming|beauty|naturals|enrich|green\s*trends|jawed\s*habib|best\s*look|looks|look|facial|waxing|manicure|pedicure|massage/i,
  },
  {
    name: 'ATM & Cash',
    pattern: /atm|atm\s*wdl|atm\s*withdrawal|cash\s*wdl|cash\s*withdrawal|nfs\s*atm|matm|self\s*wdl|cash\s*deposit|atm\s*cash/i,
  },
  {
    name: 'Entertainment',
    pattern: /cinema|cinemas|theatre|theatres|theater|theaters|multiplex|screen|screens|movie|movies|film|films|imax|ticket|tickets|bookmyshow|pvr|inox|cinepolis|carnival|gaming|steam|playstation|xbox|amusement|concert|event|show|shows|bowling|fun\s*city|wonderla/i,
  },
  {
    name: 'Education',
    pattern: /school|college|university|tuition|udemy|coursera|unacademy|byju|coaching|academy|course|fees|exam\s*fee|bookstore|stationery|class/i,
  },
  {
    name: 'Salary',
    pattern: /\b(salary|payroll|stipend|wages|bonus|pension|remuneration|monthly\s*pay|a2aint|a2a|elito|innovations)\b/i,
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
  // Strip reference/cheque/account numbers from inputs
  let rawMerchant = (options?.merchant || '').replace(/\b0+\d{4,}\b/g, '').replace(/\b\d{7,}\b/g, '').trim();
  let rawText = (text || '').replace(/\b0+\d{4,}\b/g, '').replace(/\b\d{7,}\b/g, '').trim();

  // Strip leading date prefixes (e.g. /09/26, 12SEP2, 12SEP24)
  rawMerchant = rawMerchant.replace(/^[/.\-]?\d{1,2}[/.\-]\d{1,2}([/.\-]\d{2,4})?\s*/, '').replace(/^\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{0,4}\s*/i, '');
  rawText = rawText.replace(/^[/.\-]?\d{1,2}[/.\-]\d{1,2}([/.\-]\d{2,4})?\s*/, '').replace(/^\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{0,4}\s*/i, '');

  // Strip prefixes like UPI- (preserve 'S' so names like 'UPI-SUDHA' keep 'SUDHA')
  rawMerchant = rawMerchant.replace(/^UPI[-\s:/_]*(CR|DR|REV)?[-\s:/_]*/i, '');
  rawText = rawText.replace(/^UPI[-\s:/_]*(CR|DR|REV)?[-\s:/_]*/i, '');

  // Strip single-letter series prefix before name (e.g. "S SUDHA" -> "SUDHA")
  rawMerchant = rawMerchant.replace(/^[A-Za-z]\s+(?=[A-Za-z]{3,})/i, '');
  rawMerchant = rawMerchant.replace(/\bPAYZAPP(?:WALLET|\s*WALLET)?\b/gi, 'PAYZAPP WALLET');
  rawText = rawText.replace(/\bPAYZAPP(?:WALLET|\s*WALLET)?\b/gi, 'PAYZAPP WALLET');

  // Strip concatenated business roots like ELECTRICALSHAP / ELECTRICALSHAR -> ELECTRICAL
  const rootReplacements: Array<{ pattern: RegExp; fix?: string }> = [
    { pattern: /\b(ELECTRICAL)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(ELECTRONIC)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(ENTERPRISE)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(STORE)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(TRADER)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(HARDWARE)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(PROVISION)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(TEXTILE)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(GARMENT)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(BAKERY|BAKERIES)[A-Za-z0-9]*\b/gi, fix: 'BAKERY' },
    { pattern: /\b(PHARMACY|PHARMACIES)[A-Za-z0-9]*\b/gi, fix: 'PHARMACY' },
    { pattern: /\b(SUPERMARKET)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(MART)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(HOTEL)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(RESTAURANT)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(HOSPITAL)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(CLINIC)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(CINEMA)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(THEAT(?:RE|ER))[A-Za-z0-9]*\b/gi },
    { pattern: /\b(SALON)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(JEWELLER)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(AUTOMOBILE)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(MOTOR)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(SWEET)[A-Za-z0-9]*\b/gi, fix: 'SWEETS' },
    { pattern: /\b(BAZAAR|BAZAR)[A-Za-z0-9]*\b/gi },
  ];
  for (const { pattern, fix } of rootReplacements) {
    rawMerchant = rawMerchant.replace(pattern, (_m, p1) => fix || (p1 ? p1.toUpperCase() : ''));
    rawText = rawText.replace(pattern, (_m, p1) => fix || (p1 ? p1.toUpperCase() : ''));
  }

  const combined = `${rawMerchant} ${options?.vpa || ''} ${rawText}`.trim();
  if (!combined) return 'Other';

  const merchant = rawMerchant;
  const vpa = (options?.vpa || '').trim();

  // 1. Strict Salary check: ONLY if explicitly mentions salary/payroll/wages or corporate credit
  const hasSalaryKeywords = /\b(salary|payroll|stipend|wages|remuneration|pension|monthly\s*pay|a2aint|elito\s*innovations|innovations\s*private)\b/i.test(combined);

  // 2. Check commercial/business rules first
  for (const rule of CATEGORY_RULES) {
    if (rule.name === 'Salary') {
      if (hasSalaryKeywords) return 'Salary';
      continue;
    }
    if (rule.pattern.test(merchant || combined)) {
      return rule.name;
    }
  }

  // 3. Check Friend / Personal Peer-to-Peer Transfer heuristics
  const isP2PPhoneVpa = /^\d{10}@[a-zA-Z0-9.-]+/i.test(vpa);
  const isPersonName =
    /^[A-Za-z]{2,25}(\s+[A-Za-z]{2,25})*\s+[A-Za-z](\.?)$/i.test(merchant) ||
    /^[A-Za-z](\.?)\s+[A-Za-z]{2,25}/i.test(merchant) ||
    /^[A-Za-z.-]{2,25}(\s+[A-Za-z.-]{1,25}){0,3}$/i.test(merchant);
  const hasFriendKeywords = /friend|splitwise|roommate|colleague|family|brother|sister|mom|dad|relative|p2p/i.test(combined);

  const isBusiness = /pvt|ltd|store|stores|shop|shops|mart|bazaar|enterprises|agency|foods|snacks|pharmacy|fuel|hospital|hotel|bakery|restaurant|cafe|sweets|stall|stalls|abhibus|redbus|travels|bus|godaddy|innovations|cinema|cinemas|theatre|salon|salons|look|looks|spa|electrical|electricals|hardware|appliances|payzapp|payzappwallet/i.test(
    merchant || combined
  );

  if ((isP2PPhoneVpa || isPersonName || hasFriendKeywords) && !isBusiness) {
    return 'Friends & Family';
  }

  return 'Other';
}

// In-memory cache for Open Source API predictions so we never re-query identical merchant/brand names
const apiCategoryCache = new Map<string, string>();

/**
 * Detect category using Open Source APIs (DuckDuckGo Instant Answer API & Wikipedia Summary API).
 * Queries public knowledge graphs to classify merchant names into personal finance categories.
 */
export async function detectCategoryWithOpenSourceAPI(nameOrNarration: string): Promise<string | null> {
  if (!nameOrNarration) return null;
  let query = nameOrNarration
    .replace(/^UPI[-\s:/_]*/i, '')
    .replace(/\b0+\d{4,}\b/g, '')
    .replace(/\b\d{5,}\b/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (query.length < 3) return null;

  const cacheKey = query.toLowerCase();
  if (apiCategoryCache.has(cacheKey)) {
    return apiCategoryCache.get(cacheKey)!;
  }

  // Strategy 1: DuckDuckGo Instant Answer API (Free, open, fast, zero auth required)
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const res = await fetch(ddgUrl, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = (await res.json()) as any;
      const combinedDdgText = [
        data.AbstractText,
        data.Heading,
        data.meta?.description,
        data.Entity,
      ]
        .filter(Boolean)
        .join(' ');

      if (combinedDdgText) {
        for (const rule of CATEGORY_RULES) {
          if (rule.name === 'Salary') continue;
          if (rule.pattern.test(combinedDdgText)) {
            apiCategoryCache.set(cacheKey, rule.name);
            return rule.name;
          }
        }
      }
    }
  } catch {
    // Continue to Wikipedia fallback
  }

  // Strategy 2: Wikipedia REST Summary API (Public encyclopedia knowledge)
  try {
    const words = query.split(/\s+/).slice(0, 3).join(' ');
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(words)}`;
    const res = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'SpendWiseApp/1.0 (contact@spendwise.local)' },
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const combinedWikiText = [data.title, data.description, data.extract].filter(Boolean).join(' ');
      if (combinedWikiText) {
        for (const rule of CATEGORY_RULES) {
          if (rule.name === 'Salary') continue;
          if (rule.pattern.test(combinedWikiText)) {
            apiCategoryCache.set(cacheKey, rule.name);
            return rule.name;
          }
        }
      }
    }
  } catch {
    // Fallback gracefully
  }

  return null;
}

/**
 * Predicts category with instant local rule evaluation first,
 * falling back to Open Source APIs (DuckDuckGo + Wikipedia) if category is unknown/Other.
 */
export async function predictCategoryWithAPI(
  text: string,
  options?: CategoryPredictOptions
): Promise<string> {
  const localPrediction = predictCategoryName(text, options);
  if (localPrediction && localPrediction !== 'Other') {
    return localPrediction;
  }

  const target = options?.merchant || text || '';
  const apiDetected = await detectCategoryWithOpenSourceAPI(target);
  if (apiDetected) {
    return apiDetected;
  }

  return localPrediction || 'Other';
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

  // Map AI categories to existing system categories
  const aiCategoryMap: Record<string, string[]> = {
    'Travel / Transport': ['Transport', 'Travel'],
    'Medical / Pharmacy': ['Health & Medical'],
    'Bills & Utilities': ['Bills & Utilities'],
    'Person-to-Person': ['Friends & Family'],
    'Salary / Income': ['Salary'],
    'Cash Withdrawal': ['ATM & Cash'],
    'Wallet / Transfer': ['Friends & Family', 'Other'],
    'Self Transfer': ['Self Transfer'],
    'Software / Digital Services': ['Subscriptions', 'Shopping'],
    'Banking / Fees': ['Bills & Utilities', 'Other'],
    'Uncategorized': ['Other'],
    'Food & Dining': ['Food & Dining'],
    'Groceries': ['Groceries'],
    'Shopping': ['Shopping'],
    'Rent': ['Rent'],
    'Education': ['Education'],
    'Entertainment': ['Entertainment'],
    'Subscriptions': ['Subscriptions'],
    'Personal Care': ['Salon & Grooming', 'Health & Medical'],
    'Electronics': ['Shopping'],
    'Fuel': ['Fuel'],
    'Insurance': ['Bills & Utilities', 'Investments'],
    'Investments': ['Investments'],
    'Refund': ['Other'],
  };

  // Try AI category mapping first
  const mappedCategories = aiCategoryMap[predictedName];
  if (mappedCategories) {
    for (const mappedName of mappedCategories) {
      const found = categories.find((c) => c.name.toLowerCase() === mappedName.toLowerCase());
      if (found) return String(found._id);
    }
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
