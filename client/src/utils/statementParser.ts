import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker for Vite browser environment
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export interface ParsedTransaction {
  id: string; // temporary client-side ID for list key
  date: string; // ISO string or YYYY-MM-DD
  amount: number;
  type: 'expense' | 'income' | 'transfer';
  merchant: string;
  category?: string;
  payment_method: 'upi' | 'bank' | 'card' | 'cash' | 'wallet' | 'other';
  refNo?: string;
  notes?: string;
  rawText?: string;
  selected?: boolean;
}

export interface ParseResult {
  fileName: string;
  fileType: 'pdf' | 'xlsx' | 'xls' | 'csv' | 'txt';
  transactions: ParsedTransaction[];
  totalRows: number;
  error?: string;
}

// Category keyword mappings for auto-categorization
const CATEGORY_RULES: Record<string, string[]> = {
  'Entertainment': [
    'cinema', 'cinemas', 'theatre', 'theatres', 'theater', 'theaters', 'multiplex', 'movie', 'movies',
    'film', 'films', 'screen', 'screens', 'imax', 'bookmyshow', 'pvr', 'inox', 'cinepolis', 'carnival',
    'ticket', 'tickets', 'show', 'shows', 'concert', 'event', 'amusement', 'bowling',
    'gaming', 'steam', 'playstation', 'xbox', 'arcade', 'fun city', 'wonderla', 'circus', 'water park'
  ],
  'Salon & Grooming': [
    'salon', 'salons', 'saloon', 'saloons', 'parlour', 'parlours', 'parlor', 'parlors', 'barber', 'barbers',
    'spa', 'spas', 'haircut', 'hair', 'grooming', 'beauty', 'naturals', 'enrich', 'green trends',
    'jawed habib', 'looks salon', 'best look', 'looks', 'look', 'toni & guy', 'massage', 'facial', 'waxing', 'manicure', 'pedicure',
    'unisex', 'styling', 'skin care', 'cosmetics', 'makeover', 'hair studio'
  ],
  'ATM & Cash': [
    'atm', 'atm wdl', 'atm withdrawal', 'cash wdl', 'cash withdrawal', 'nfs atm', 'matm',
    'self wdl', 'cash deposit', 'atm cash', 'cash disp', 'vault', 'cashier'
  ],
  'Food & Dining': [
    'swiggy', 'zomato', 'mcdonald', 'kfc', 'starbucks', 'burger king', 'domino',
    'pizza', 'subway', 'chai', 'cafe', 'restaurant', 'dhaba', 'bakery', 'bakeries', 'bistro', 'food', 'foods',
    'dining', 'eats', 'hotel', 'hotels', 'canteen', 'tiffin', 'mess', 'biryani', 'biryan', 'biriyani', 'briyani', 'chettinad', 'chettinadu', 'asda biryan', 'kitchen', 'sweet', 'sweets',
    'mithai', 'juice', 'tea stall', 'tea', 'coffee', 'snack', 'snacks', 'bar', 'pub', 'brewery', 'chutney',
    'idli', 'dosa', 'dosai', 's d o sa', 'chat stall', 'chaat stall', 'food stall', 'stall', 'stalls', 'chat', 'chaat',
    'shawarma', 'bbq', 'barbeque', 'haldiram', 'saravana bhavan', 'a2b',
    'ananda bhavan', 'taco', 'krispy kreme', 'dunkin', 'baskin', 'ice cream', 'dessert', 'desserts',
    'grill', 'bhatura', 'roll', 'rolls', 'momos', 'chinese', 'punjabi', 'udupi', 'south indian', 'north indian',
    'meals', 'curry', 'thali', 'paratha', 'fast food', 'treat', 'darshini', 'bites', 'caterer', 'caterers'
  ],
  'Groceries': [
    'blinkit', 'zepto', 'instamart', 'bigbasket', 'dmart', 'nature basket',
    'supermarket', 'super market', 'grocer', 'groceries', 'grocery', 'spencer', 'more retail', 'reliance fresh', 'milkbasket',
    'vegetable', 'vegetables', 'fruit', 'fruits', 'kirana', 'provision', 'provisions', 'bazaar', 'smart bazaar', 'hypermarket',
    'meat', 'licious', 'country delight', 'fresh to home', 'dairy', 'milk', 'egg', 'eggs', 'organic'
  ],
  'Shopping': [
    'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tata cliq',
    'zara', 'h&m', 'uniqlo', 'croma', 'reliance digital', 'ikea', 'decathlon',
    'clothing', 'apparel', 'footwear', 'trends', 'westside', 'shoppers stop', 'lifestyle',
    'pantaloons', 'max fashion', 'zudio', 'lenskart', 'titan', 'fastrack', 'electronics', 'retail',
    'store', 'stores', 'agn store', 'textile', 'textiles', 'silks', 'jewel', 'jewellery', 'jewellers', 'boutique', 'mall', 'fashion',
    'electrical', 'electricals', 'hardware', 'appliances', 'home appliances', 'electric store'
  ],
  'Transport': [
    'uber', 'ola', 'rapido', 'irctc', 'metro', 'makemytrip', 'redbus', 'abhibus', 'zingbus', 'chalo', 'intrcity',
    'fastag', 'toll', 'indianoil fastag', 'nhai', 'auto', 'cab', 'taxi', 'railway', 'railways', 'flight', 'flights',
    'indigo', 'air india', 'spicejet', 'bus', 'buses', 'parking', 'transit', 'train', 'travels', 'kallada', 'srs travels',
    'kpn', 'orange travels', 'vrl travels', 'parveen travels', 'ksrtc', 'setc', 'tnstc', 'msrtc', 'apsrtc', 'tsrtc'
  ],
  'Fuel': [
    'petrol', 'fuel', 'hpcl', 'bpcl', 'iocl', 'shell', 'hindustan petroleum',
    'bharat petroleum', 'indian oil', 'diesel', 'cng', 'gas station', 'petrol bunk', 'bunk', 'bunks',
    'auto lpg', 'ev charging', 'petrol pump', 'fuel station'
  ],
  'Bills & Utilities': [
    'airtel', 'jio', 'vi', 'vodafone', 'bescom', 'tata power', 'electricity',
    'water board', 'gas', 'adani electricity', 'billdesk', 'broadband', 'act fibernet',
    'godaddy', 'domain', 'domains', 'hosting', 'web hosting', 'namecheap', 'hostinger', 'cloudflare', 'aws',
    'payzapp', 'payzapp wallet', 'payzappwallet', 'wallet recharge',
    'recharge', 'dth', 'tata sky', 'tataplay', 'sun direct', 'dish tv', 'piped gas', 'utility', 'utilities',
    'cesc', 'tneb', 'bsnl', 'postpaid', 'cylinder', 'gas bill', 'electric'
  ],
  'Subscriptions': [
    'netflix', 'spotify', 'hotstar', 'disney', 'prime video', 'youtube',
    'apple.com/bill', 'google play', 'chatgpt', 'openai', 'github',
    'icloud', 'dropbox', 'medium', 'adobe', 'play store', 'patreon', 'times prime', 'subscription'
  ],
  'Salary': [
    'salary', 'payroll', 'stipend', 'wages', 'compensation', 'pension',
    'remuneration', 'monthly pay', 'salary credit', 'a2aint', 'elito innovations', 'innovations private'
  ],
  'Investments': [
    'zerodha', 'groww', 'kuvera', 'upstox', 'angel one', 'mutual fund', 'sip',
    'camsonline', 'kfintech', 'uti mf', 'hdfc mf', 'icici pru', 'sbi mf',
    'sharekhan', 'motilal', '5paisa', 'kite', 'coin', 'bse', 'nse', 'gold', 'sovereign gold', 'ppf', 'nps',
    'stocks', 'shares', 'securities'
  ],
  'Health & Medical': [
    'apollo', 'netmeds', 'pharmeasy', '1mg', 'tata 1mg', 'hospital', 'hospitals', 'clinic', 'clinics',
    'pharmacy', 'pharmacies', 'chemist', 'chemists', 'medplus', 'diagnostic', 'diagnostics', 'dr.', 'doctor', 'doctors',
    'lab', 'labs', 'pathology', 'dental', 'dentist', 'dentists', 'eyecare', 'optical', 'opticals',
    'medicine', 'medicines', 'meds', 'medicals', 'medical', 'physio', 'healthcare', 'ayurveda', 'wellness',
    'scan', 'scans', 'xray', 'care', 'fitness', 'gym', 'cult.fit'
  ],
  'Education': [
    'school', 'schools', 'college', 'colleges', 'university', 'universities', 'tuition', 'tuitions',
    'udemy', 'coursera', 'unacademy', 'byju', 'coaching', 'academy', 'course', 'courses', 'fees',
    'exam fee', 'bookstore', 'stationery', 'class', 'classes', 'institute', 'institution'
  ],
  'Rent': [
    'rent', 'house rent', 'flat rent', 'society maintenance', 'nobroker',
    'maintenance fee', 'apartment maintenance', 'landlord', 'pg rent', 'hostel'
  ],
  'Self Transfer': [
    'self transfer', 'self-transfer', 'self transfer to', 'self credit', 'self debit',
    'self neft', 'self rtgs', 'self imps', 'self upi', 'to own account', 'own account',
    'own a/c', 'own accounts', 'between own', 'between my accounts', 'internal transfer',
    'transfer to self', 'transferred to self', 'self transfer in'
  ],
};

export const TRANSFER_CATEGORIES = new Set([
  'self transfer', 'transfer', 'transfers', 'account transfer'
]);

export const INCOME_CATEGORIES = new Set([
  'salary', 'investments', 'rental income', 'freelance', 'dividend', 'interest', 'bonus', 'refund', 'cashback', 'income'
]);

export const EXPENSE_CATEGORIES = new Set([
  'food & dining', 'food', 'groceries', 'shopping', 'transport', 'fuel', 'bills & utilities', 'bills',
  'rent', 'entertainment', 'health & medical', 'health', 'education', 'travel', 'subscriptions', 'expense',
  'salon & grooming', 'salon', 'atm & cash', 'atm'
]);

const SELF_TRANSFER_REGEX = /\bself[\s\-_]*(transfer|credit|debit|neft|rtgs|imps|upi)\b|\btransfer\w*\s+(to|received\s+from)\s+self\b|\bown\s+(account|a\/c|accounts)\b|\bbetween\s+(my\s+)?own\b|\binternal\s+transfer\b/i;

export function isSelfTransferText(text?: string | null): boolean {
  if (!text || !text.trim()) return false;
  return SELF_TRANSFER_REGEX.test(text) || TRANSFER_CATEGORIES.has(text.trim().toLowerCase());
}

export function getCategoryType(categoryName?: string): 'expense' | 'income' | 'both' {
  if (!categoryName) return 'both';
  const lower = categoryName.trim().toLowerCase();
  if (TRANSFER_CATEGORIES.has(lower)) return 'both';
  if (INCOME_CATEGORIES.has(lower) || lower.includes('salary') || lower.includes('dividend') || lower.includes('investment')) {
    return 'income';
  }
  if (EXPENSE_CATEGORIES.has(lower) || lower.includes('food') || lower.includes('dining') || lower.includes('grocer') || lower.includes('bill') || lower.includes('fuel')) {
    return 'expense';
  }
  return 'both';
}

export const BUSINESS_KEYWORDS_REGEX = /\b(pvt|ltd|limited|inc|corp|corporation|store|stores|shop|shops|mart|marts|bazaar|foods?|pharmacy|pharmacies|fuel|hospital|hospitals|hotel|hotels|bakery|bakeries|restaurant|restaurants|cafe|cafes|sweets?|supermarket|supermarkets|cinema|cinemas|theatre|theatres|theater|theaters|multiplex|screen|screens|stall|stalls|broadband|telecom|technologies|solutions|bank|petrol|pump|bunk|bunks|hpcl|bpcl|iocl|shell|airtel|jio|vodafone|swiggy|zomato|amazon|flipkart|uber|ola|abhibus|redbus|travels|bus|blinkit|zepto|netflix|spotify|pvr|irctc|makemytrip|myntra|nykaa|paytm|phonepe|google|apple|starbucks|fastag|recharge|bill|agency|agencies|enterprises?|innovations|godaddy|salon|salons|look|looks|spa|electrical|electricals|hardware|appliances)\b/i;

/**
 * Detects category by checking whole text, multi-word phrases, and EVERY individual word / token
 * (e.g. "REMY CINEMAS" -> "cinemas" -> "Entertainment", "SRI MURUGAN BAKERY" -> "bakery" -> "Food & Dining")
 */
export function matchCategoryFromText(text: string): string | null {
  if (!text || !text.trim()) return null;
  const clean = text.trim().toLowerCase();

  // 1. Direct multi-word phrase or word boundary match against category rules
  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    for (const kw of keywords) {
      const regex = new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
      if (regex.test(clean)) {
        return category;
      }
    }
  }

  // 2. Tokenize into individual words and examine every single word in multi-word merchant strings
  // e.g. "REMY CINEMAS" -> ["remy", "cinemas"]
  const words = clean.split(/[^a-z0-9]+/i).filter((w) => w.length >= 2);

  for (const word of words) {
    for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
      for (const kw of keywords) {
        if (!kw.includes(' ')) {
          // Exact word match
          if (word === kw) {
            return category;
          }
          // Plural / root matching: only if keyword is >= 4 chars and word starts with keyword
          // e.g. word "cinemas" starts with "cinema" -> matches Entertainment
          if (kw.length >= 4 && word.startsWith(kw) && word.length <= kw.length + 3) {
            return category;
          }
          // Truncated word matching: when a bank statement field truncates a word
          // e.g. word "biryan" (length 6) is a truncated form of "biryani" (length 7)
          if (word.length >= 5 && kw.length >= 5 && kw.startsWith(word) && (kw.length - word.length <= 2)) {
            return category;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Checks if a narration / string represents a Credit (Received amount / Income) in Indian banking
 */
export function isCreditTransaction(text: string): boolean {
  if (!text) return false;
  const upper = text.toUpperCase();

  // "BY TRANSFER" and "BY CLG" are standard Indian banking accounting terms for Credit (Receipt)
  if (
    upper.includes('BY TRANSFER') ||
    upper.includes('BY CLG') ||
    upper.includes('BY CLEARING') ||
    upper.includes('BY UPI') ||
    upper.startsWith('BY ') ||
    upper.includes('/BY/') ||
    upper.includes(' RECEIVED') ||
    upper.startsWith('RECEIVED') ||
    upper.includes('RECD FROM') ||
    upper.includes('AMT RECD') ||
    upper.includes('MONEY RECD') ||
    upper.includes('MONEY RECEIVED') ||
    upper.includes('INWARD') ||
    upper.includes('INW ') ||
    upper.includes('DEP ') ||
    upper.includes('DEPOSIT') ||
    upper.includes('CREDITED') ||
    upper.includes('CREDIT') ||
    upper.includes('UPI/CR') ||
    upper.includes('UPI-CR') ||
    upper.includes('UPI_CR') ||
    upper.includes('/CR/') ||
    upper.includes('/CR') ||
    upper.includes('-CR') ||
    upper.includes(' CR ') ||
    upper.includes('P2P CR') ||
    upper.includes('P2A CR') ||
    upper.includes('NEFT CR') ||
    upper.includes('IMPS CR') ||
    upper.includes('RTGS CR') ||
    upper.includes('SALARY') ||
    upper.includes('DIVIDEND') ||
    upper.includes('INTEREST') ||
    upper.includes('CASHBACK') ||
    upper.includes('REFUND') ||
    upper.includes('REVERSAL')
  ) {
    return true;
  }

  // Check word boundary for CR or CR.
  if (/\bCR\.?\b/i.test(text) && !/\bDR\.?\b/i.test(text)) {
    return true;
  }

  return false;
}

/**
 * Checks if a narration / string represents a Debit (Paid / Sent / Expense)
 */
export function isDebitTransaction(text: string): boolean {
  if (!text) return false;
  const upper = text.toUpperCase();

  if (
    upper.includes('TO TRANSFER') ||
    upper.includes('TO CLG') ||
    upper.includes('TO CLEARING') ||
    upper.includes('TO UPI') ||
    upper.startsWith('TO ') ||
    upper.includes('/TO/') ||
    upper.includes('PAID TO') ||
    upper.includes('SENT TO') ||
    upper.includes('WITHDRAWAL') ||
    upper.includes('OUTWARD') ||
    upper.includes('UPI/DR') ||
    upper.includes('UPI-DR') ||
    upper.includes('UPI_DR') ||
    upper.includes('/DR/') ||
    upper.includes('/DR') ||
    upper.includes('-DR') ||
    upper.includes(' DR ') ||
    upper.includes('P2P DR') ||
    upper.includes('P2A DR') ||
    upper.includes('NEFT DR') ||
    upper.includes('IMPS DR') ||
    upper.includes('RTGS DR')
  ) {
    return true;
  }

  if (/\bDR\.?\b/i.test(text) && !/\bCR\.?\b/i.test(text)) {
    return true;
  }

  return false;
}

/**
 * Determine if a payee name is likely an individual person (e.g. ABIRAMI P, BOOBAL, PRIYA S, RAHUL)
 */
export function isLikelyPersonName(name: string, knownPeopleNames: string[] = []): boolean {
  if (!name || !name.trim()) return false;
  const clean = name.trim().replace(/^[\W_]+|[\W_]+$/g, '');
  const lower = clean.toLowerCase();

  // 1. Matches user's known people directory
  if (knownPeopleNames.some((p) => p && p.trim().toLowerCase() === lower)) {
    return true;
  }

  // 2. Reject if contains commercial business keywords
  if (BUSINESS_KEYWORDS_REGEX.test(lower)) {
    return false;
  }

  // 3. Reject if contains obvious system/bank words
  if (/^(transfer|transaction|payment|deposit|withdrawal|salary|interest|dividend|charges|tax|gst)$/i.test(clean)) {
    return false;
  }

  // 4. Reject if contains digits or special symbols (except spaces, dots, hyphens)
  if (/[\d@#\$%\^&\*\(\)_=\+\[\]\{\}\|\\:;"<>\?\/]/.test(clean)) {
    return false;
  }

  // 5. Split into words
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) {
    return false;
  }

  // 6. Name with initial: e.g. "ABIRAMI P", "BOOBAL M", "P ABIRAMI", "M. BOOBAL"
  const hasInitial = words.some((w) => w.length === 1 || (w.length === 2 && w.endsWith('.')));
  if (hasInitial && words.every((w) => /^[a-zA-Z.]{1,25}$/.test(w))) {
    return true;
  }

  // 7. Single name or 2-3 word human name: e.g. "BOOBAL", "ABIRAMI", "RAHUL VERMA"
  if (words.length >= 1 && words.length <= 3 && words.every((w) => /^[a-zA-Z.-]{2,25}$/.test(w))) {
    return true;
  }

  return false;
}

/**
 * Predict both Category and Transaction Type (Expense vs Income) automatically.
 * Ensures people (ABIRAMI P, BOOBAL, etc.) are always Friends & Family and NEVER Salary.
 */
export function predictCategoryAndType(
  text: string,
  explicitType?: 'expense' | 'income' | 'transfer',
  explicitCategory?: string,
  knownPeopleNames: string[] = []
): { category: string; type: 'expense' | 'income' | 'transfer' } {
  const lower = (text || '').toLowerCase();
  const cleanedPayee = cleanMerchantName(text);

  // 1. If explicitCategory is passed (e.g. from file column)
  if (explicitCategory && explicitCategory.trim().length > 0) {
    const categoryName = explicitCategory.trim();
    if (TRANSFER_CATEGORIES.has(categoryName.toLowerCase())) {
      return { category: categoryName, type: 'transfer' };
    }
    const catType = getCategoryType(categoryName);
    let resolvedType: 'expense' | 'income' = explicitType === 'income' ? 'income' : 'expense';
    if (catType === 'income') {
      resolvedType = 'income';
    } else if (catType === 'expense') {
      resolvedType = 'expense';
    }
    return { category: categoryName, type: resolvedType };
  }

  // 2. Check Credit / Debit indications from text or explicitType
  const isCredit = explicitType === 'income' || isCreditTransaction(text);
  const isDebit = explicitType === 'expense' || isDebitTransaction(text);

  // 3. STRICT SALARY RULE:
  // Salary is selected if:
  // - text explicitly contains salary/payroll/wages words
  // - OR incoming credit from corporate employers / A2AINT (e.g. "A2AINT01 - ELITO INNOVATIONS PRIVATE LI", "ELITO INNOVATIONS PVT LTD", corporate company credits)
  const isCorporateSalaryCredit = isCredit && (
    lower.includes('a2aint') ||
    lower.includes('elito innovations') ||
    lower.includes('innovations private') ||
    /\b(a2aint|a2a\s*credit|cms\s*credit|ach\s*salary)\b/i.test(text) ||
    (/\b(private\s*li|private\s*limited|pvt\s*ltd|innovations)\b/i.test(text) && (lower.includes('a2a') || lower.includes('cms') || isCredit))
  );

  const isExplicitSalary =
    /\b(salary|payroll|stipend|wages|remuneration|pension|compensation|monthly\s*pay|salary\s*credit)\b/i.test(text) ||
    isCorporateSalaryCredit;

  if (isExplicitSalary) {
    return { category: 'Salary', type: 'income' };
  }

  // 4. EVERY WORD AUTO-DETECTION FOR CATEGORIES:
  // Check merchant, narration, and raw text across all category keywords (e.g. "REMY CINEMAS" -> "Entertainment", "MURUGAN BAKERY" -> "Food & Dining", "BEST LOOK" -> "Salon & Grooming")
  const detectedCategory = matchCategoryFromText(cleanedPayee) || matchCategoryFromText(text);
  if (detectedCategory) {
    // Self transfers are neither income nor expense - they move money between own accounts
    if (TRANSFER_CATEGORIES.has(detectedCategory.toLowerCase())) {
      return { category: detectedCategory, type: 'transfer' };
    }
    const catType = getCategoryType(detectedCategory);
    let resolvedType: 'expense' | 'income';
    if (catType === 'income') {
      resolvedType = 'income';
    } else if (catType === 'expense') {
      resolvedType = 'expense';
    } else {
      resolvedType = isCredit && !isDebit ? 'income' : 'expense';
    }
    return { category: detectedCategory, type: explicitType === 'income' ? 'income' : (explicitType === 'expense' ? 'expense' : resolvedType) };
  }

  // 5. SELF TRANSFER: money moved between the user's own accounts (narration only)
  if (isSelfTransferText(text)) {
    return { category: 'Self Transfer', type: 'transfer' };
  }

  // 6. PERSON CHECK (Friends & Family):
  // Check cleanedPayee or isolated words from narration for person names like "ABIRAMI P", "BOOBAL"
  const isPerson =
    isLikelyPersonName(cleanedPayee, knownPeopleNames) ||
    lower.includes('p2p') ||
    lower.includes('received from') ||
    lower.includes('paid to');

  if (isPerson) {
    // If credit / received -> Income under Friends & Family
    // If debit / sent -> Expense under Friends & Family
    const type: 'expense' | 'income' = isCredit && !isDebit ? 'income' : isDebit ? 'expense' : (explicitType === 'income' ? 'income' : 'expense');
    return {
      category: 'Friends & Family',
      type: explicitType === 'income' ? 'income' : (explicitType === 'expense' ? 'expense' : type),
    };
  }

  // 7. Check other Income indicators (Investments, Cashback, Refund, Received transfers)
  if (isCredit) {
    if (/\b(dividend|interest|mutual\s*fund|groww|zerodha|upstox|kuvera|sip|sebi|bse|nse|uti|camsonline)\b/i.test(lower)) {
      return { category: 'Investments', type: 'income' };
    }
    if (/\b(cashback|refund|reversal|chargeback)\b/i.test(lower)) {
      return { category: 'Other', type: 'income' };
    }
    // If received money via UPI/Transfer and not a commercial business -> Friends & Family
    if (!BUSINESS_KEYWORDS_REGEX.test(cleanedPayee) && !BUSINESS_KEYWORDS_REGEX.test(lower)) {
      return { category: 'Friends & Family', type: 'income' };
    }
    // Default fallback for income: Other (NEVER Salary!)
    return { category: 'Other', type: 'income' };
  }

  // 8. Non-commercial personal payee fallback -> Friends & Family
  if (!BUSINESS_KEYWORDS_REGEX.test(cleanedPayee) && !BUSINESS_KEYWORDS_REGEX.test(lower)) {
    if (cleanedPayee && cleanedPayee !== 'Unknown' && /^[a-zA-Z\s.]+$/.test(cleanedPayee)) {
      return { category: 'Friends & Family', type: 'expense' };
    }
  }

  // 9. Default fallback
  return { category: 'Other', type: 'expense' };
}

/**
 * Predict category from merchant or narration text
 */
export function predictCategory(text: string, type: 'expense' | 'income' | 'transfer'): string {
  return predictCategoryAndType(text, type).category;
}

/**
 * Detect payment method from narration/notes
 */
export function detectPaymentMethod(text: string): 'upi' | 'bank' | 'card' | 'cash' | 'wallet' | 'other' {
  const lower = text.toLowerCase();
  if (lower.includes('upi') || lower.includes('@') || lower.includes('/upi/')) return 'upi';
  if (lower.includes('pos ') || lower.includes('card') || lower.includes('e-comm') || lower.includes('visa') || lower.includes('mastercard')) return 'card';
  if (lower.includes('neft') || lower.includes('rtgs') || lower.includes('imps') || lower.includes('ach') || lower.includes('chq') || lower.includes('cheque')) return 'bank';
  if (lower.includes('atm') || lower.includes('cash')) return 'cash';
  if (lower.includes('wallet') || lower.includes('paytm w') || lower.includes('mobikwik') || lower.includes('amazon pay balance') || lower.includes('payzapp')) return 'wallet';
  return 'bank';
}

/**
 * Clean up messy bank statement narration strings to extract readable merchant or person name.
 * Handles Indian bank formats (SBI, HDFC, ICICI, Axis, Canara, PNB, BoB, etc.)
 */
export function cleanMerchantName(narration: string): string {
  if (!narration) return 'Unknown';
  let clean = narration.trim();

  // 1. Strip leading dates if present at the start of string (e.g. "/09/26", "12SEP2", "12SEP24", "12/09/2026", "2026-09-12")
  clean = clean.replace(/^[/.\-]?\d{1,2}[/.\-]\d{1,2}([/.\-]\d{2,4})?\s*/, '');
  clean = clean.replace(/^\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{0,4}\s*/i, '');
  clean = clean.replace(/^\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}\s*/, '');

  // 2. Strip leading Indian banking entry prefixes and codes:
  clean = clean.replace(/^(BY\s+TRANSFER|TO\s+TRANSFER|BY\s+CLG|TO\s+CLG|BY\s+CLEARING|TO\s+CLEARING)[-\s:/_]*/i, '');
  clean = clean.replace(/^(RECEIVED\s+FROM|PAID\s+TO|SENT\s+TO|TRANSFER\s+TO|CREDIT\s+FROM|DEBIT\s+TO)[-\s:/_]*/i, '');
  clean = clean.replace(/^(UPI)[-\s:/_]*(CR|DR|REV)?[-\s:/_]*\d{1,8}(?=\s)/i, '$1 ');
  clean = clean.replace(/^(INB\s+NEFT|INB\s+IMPS|NEFT|IMPS|RTGS|UPI|NACH|ACH|P2P|P2A)[-\s:/_]*(CR|DR|REV)?[-\s:/_]*/i, '');
  clean = clean.replace(/^UPI[-\s:/_]*(CR|DR|REV)?[-\s:/_]*/i, '');
  clean = clean.replace(/^A2AINT\d*[-\s:]*/i, '');

  // 3. Strip cheque numbers / series codes like "S 13", "S13", "S-13", "C 01" at start or anywhere:
  clean = clean.replace(/^[A-Za-z]\s*[-/]?\s*\d{1,6}\s+/i, '');
  clean = clean.replace(/\b[A-Za-z]\s*[-/]?\s*\d{1,6}\b/gi, '');

  // 4. Strip long numbers, cheque numbers, account numbers, and reference codes ANYWHERE:
  // e.g. "BOOBAL 0000130389969858" -> "BOOBAL"
  // e.g. "AGN 0000202356023631 STORE" -> "AGN STORE"
  clean = clean.replace(/\b0+\d{4,}\b/g, ''); // 0000130389969858, 0000202356023631
  clean = clean.replace(/\b\d{7,}\b/g, '');   // Any 7+ digit number
  clean = clean.replace(/\b(CHQ|REF|UTR|TXN|NO|CHEQUE)[.:\s\d-]*\b/gi, '');

  // 5. If text contains delimiters like /, *, -, :
  // e.g. "SUDHA-PAYTMQR70TKPO@PTYS-YESB0PTMU"
  if (clean.includes('/') || clean.includes('*') || clean.includes('-') || clean.includes(':')) {
    const rawTokens = clean.split(/[\/*:-]/).map((p) => p.trim()).filter(Boolean);
    const ignoreSet = new Set([
      'BY', 'TO', 'TRANSFER', 'CLG', 'CLEARING', 'INB', 'NEFT', 'IMPS', 'RTGS', 'UPI', 'NACH', 'ACH',
      'DR', 'CR', 'REV', 'P2P', 'P2A', 'P2M', 'PAYMENT', 'SENT', 'RECEIVED', 'RECD',
      'YESB', 'ICIC', 'HDFC', 'SBIN', 'UTIB', 'PAYTM', 'OKAXIS', 'OKHDFC', 'OKSBI', 'OKICICI',
      'AIRP', 'BARB', 'CNRB', 'PUNB', 'KKBK', 'IDFB', 'MAHB', 'IOBA', 'UBIN', 'CBIN', 'INDB',
      'PAY', 'BILL', 'COLLECT', 'REQUEST', 'DEP', 'WDL', 'INWARD', 'OUTWARD', 'A2A', 'A2AINT'
    ]);

    // Some tokens carry a leading numeric channel / transaction code that is not part of the name
    // e.g. "25151 APOLLO PHARMAC" -> "APOLLO PHARMAC", "05 ASDA BIRYAN" -> "ASDA BIRYAN"
    const normalizeToken = (p: string): string => p.replace(/^\d{1,8}(?:[-/]\d{1,8})*\s+/, '').trim();

    // Priority 1: Find a clean alphabetic name token that is not a QR handle or bank ID
    const cleanNameCandidate = rawTokens.map(normalizeToken).find((p) => {
      const u = p.toUpperCase();
      if (ignoreSet.has(u)) return false;
      if (/^\d+$/.test(p)) return false;
      if (/^[A-Za-z]\s*[-/]?\s*\d+$/i.test(p)) return false; // reject "S 13"
      if (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(p)) return false; // IFSC code
      if (/^[A-Z0-9]{12,}$/i.test(p) && /\d/.test(p)) return false; // Long txn/UTR id
      if (/@/.test(p) || /^PAYTMQR/i.test(p) || /^BHIM/i.test(p)) return false; // reject UPI QR IDs if clean name exists
      return /^[A-Za-z\s.]{2,30}$/.test(p);
    });

    if (cleanNameCandidate) {
      clean = cleanNameCandidate;
    } else {
      const candidate = rawTokens.map(normalizeToken).find((p) => {
        const u = p.toUpperCase();
        if (ignoreSet.has(u)) return false;
        if (/^\d+$/.test(p)) return false;
        if (/^[A-Za-z]\s*[-/]?\s*\d+$/i.test(p)) return false;
        if (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(p)) return false;
        if (/^[A-Z0-9]{12,}$/i.test(p) && /\d/.test(p)) return false;
        if (!/[A-Za-z]{2,}/.test(p)) return false;
        return p.length >= 2;
      });
      if (candidate) {
        clean = candidate;
      }
    }
  }

  // 6. Strip POS prefixes: POS 412345XXXXXX1234 MERCHANT NAME
  clean = clean.replace(/^POS\s+[X\d]+\s+/i, '');
  // Strip NEFT/IMPS prefixes: NEFT-N1234567-MERCHANT NAME-
  clean = clean.replace(/^(NEFT|IMPS|RTGS|ACH|NACH)[-\s]+[A-Z0-9]+[-\s]+/i, '');
  // Strip trailing counter numbers or branch numbers like " 05", " 13" (e.g. "AL ASDA BIRYAN 05" -> "AL ASDA BIRYAN")
  clean = clean.replace(/\s+\d{1,4}$/, '');
  // Strip trailing bank reference / transaction IDs
  clean = clean.replace(/\s+(REF|UTR|TXN|ID)[\s:0-9A-Z]+$/i, '');
  clean = clean.replace(/[-\s:]+\d{5,}$/, '');
  clean = clean.replace(/[*#]/g, '').trim();

  // Strip single letter series prefix before name (e.g. "S SUDHA" -> "SUDHA")
  clean = clean.replace(/^[A-Za-z]\s+(?=[A-Za-z]{3,})/i, '');
  clean = clean.replace(/\bPAYZAPP(?:WALLET|\s*WALLET)?\b/gi, 'PAYZAPP WALLET');

  // 7. Strip concatenated state/region codes from business words (e.g. "REKHA ELECTRICALSHAP" -> "REKHA ELECTRICAL")
  const BUSINESS_ROOT_NORMALIZERS: Array<{ pattern: RegExp; fix?: string }> = [
    { pattern: /\b(ELECTRICAL)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(ELECTRONIC)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(ENTERPRISE)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(STORE)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(TRADER)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(HARDWARE)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(PROVISION)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(TEXTILE)[A-Za-z0-9]*\b/gi },
    { pattern: /\b(GARMENT)[A-Za-z0-9]*\b/gi },
    { pattern: /\bBAKER(?:Y|IES)?[A-Za-z0-9]*\b/gi, fix: 'BAKERY' },
    { pattern: /\bPHARMAC(?:Y|IES)?[A-Za-z0-9]*\b/gi, fix: 'PHARMACY' },
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

  for (const { pattern, fix } of BUSINESS_ROOT_NORMALIZERS) {
    clean = clean.replace(pattern, (_match, p1) => fix || (p1 ? p1.toUpperCase() : ''));
  }

  // Normalize multiple spaces
  clean = clean.replace(/\s+/g, ' ').trim();

  if (!clean || clean.length < 2) return narration.substring(0, 30);
  return clean.substring(0, 45);
}

/**
 * Extract reference number (UPI Ref / UTR / Chq No / RRN / Zero-padded ID)
 * from explicit column or narration line.
 * Handles cases like "0000130408174425" from statements and "130408174425" from emails.
 */
export function extractReferenceNumber(text: string, explicitRefColVal?: unknown): string | undefined {
  if (explicitRefColVal !== undefined && explicitRefColVal !== null) {
    const cleanCol = String(explicitRefColVal).trim();
    if (cleanCol && cleanCol !== '-' && cleanCol.length >= 4) {
      return cleanCol;
    }
  }

  if (!text) return undefined;

  // 1. Explicit labels: UPI/REF/UTR/RRN/TXN followed by alphanumeric ID or digits
  // e.g. "UPI/0000130408174425/...", "UPI/130408174425", "UTR: 130408174425", "Ref: 0000130408174425"
  const labelMatch = text.match(/\b(?:UPI|UTR|RRN|REF|TXN|IMPS|NEFT)[-/:#\s]+([A-Za-z0-9]{8,22})\b/i);
  if (labelMatch && labelMatch[1] && /\d{4,}/.test(labelMatch[1])) {
    return labelMatch[1].trim();
  }

  // 2. Slashed segment with 12-16 digits: e.g. /0000130408174425/ or /130408174425/
  const slashMatch = text.match(/(?:^|[\s/])(0*\d{12})(?:[\s/]|$)/);
  if (slashMatch && slashMatch[1]) {
    return slashMatch[1].trim();
  }

  // 3. Leading-zero padded reference numbers (e.g. 0000130408174425) - classic Indian bank statement format
  const paddedMatch = text.match(/\b(0{2,}\d{8,16})\b/);
  if (paddedMatch && paddedMatch[1]) {
    return paddedMatch[1].trim();
  }

  // 4. Exactly 12-digit UPI RRN / reference
  const twelveDigitMatch = text.match(/\b(\d{12})\b/);
  if (twelveDigitMatch && twelveDigitMatch[1]) {
    return twelveDigitMatch[1].trim();
  }

  return undefined;
}

/**
 * A reference number is considered valid only when it carries a real transaction identifier
 * (UPI RRN, UTR, RRN, cheque series, ...). Placeholder values such as "-", "NA", "N/A" or a
 * short numeric counter are rejected so the row can be excluded from the imported list.
 */
export function hasValidReferenceNumber(refNo?: string | null): boolean {
  if (refNo === undefined || refNo === null) return false;

  const trimmed = String(refNo).trim();
  if (!trimmed) return false;
  if (/^(?:n\/?a|none|null|nil|na|-{1,3}|\.{1,3})$/i.test(trimmed)) return false;

  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 6 && trimmed.length >= 6;
}

/**
 * Robust date parser supporting DD/MM/YYYY, YYYY-MM-DD, DD-MMM-YYYY, Excel serial dates
 */
export function parseDateString(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];

  if (typeof val === 'number') {
    // Excel serial date (days since 1899-12-30)
    try {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // fallback
    }
  }

  const str = String(val).trim();

  // Pattern: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    // Swap day and month if month > 12 and day <= 12
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // Pattern: DD Mon YYYY or DD-Mon-YYYY (e.g. 15 Sep 2024, 05-AUG-2023)
  const dMonYMatch = str.match(/^(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-](\d{2,4})/);
  if (dMonYMatch) {
    const day = parseInt(dMonYMatch[1], 10);
    let year = parseInt(dMonYMatch[3], 10);
    if (year < 100) year += 2000;
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const mStr = dMonYMatch[2].toLowerCase().substring(0, 3);
    const month = months[mStr] || '01';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${year}-${month}-${pad(day)}`;
  }

  // Fallback to standard JS Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Clean amount string: handles commas, currency symbols, exact decimals
 */
export function parseAmount(val: any): { amount: number; isCredit?: boolean; isDebit?: boolean } {
  if (val === null || val === undefined) return { amount: 0 };
  if (typeof val === 'number') {
    return { amount: Math.abs(val), isCredit: val > 0, isDebit: val < 0 };
  }

  let str = String(val).trim();
  const isCredit = /\b(cr|credit|deposit)\b/i.test(str);
  const isDebit = /\b(dr|debit|withdrawal)\b/i.test(str);

  // Remove currency symbols, commas, spaces, Dr/Cr indicators
  str = str.replace(/[₹$€£\s,]/g, '').replace(/[a-zA-Z]/g, '');

  const num = parseFloat(str);
  if (isNaN(num)) return { amount: 0 };

  // Preserve exact paise decimals (e.g. 159.50)
  const cleanAmount = Math.round(Math.abs(num) * 100) / 100;
  return { amount: cleanAmount, isCredit, isDebit };
}

/**
 * Parse an Excel (.xlsx / .xls) file
 */
export async function parseExcelFile(file: File, knownPeopleNames: string[] = []): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  
  if (!workbook.SheetNames.length) {
    throw new Error('Excel workbook contains no sheets');
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // Convert to array of arrays to find real header row
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rawRows.length) {
    throw new Error('Excel sheet is empty');
  }

  // Find header row: look for row with keywords like date, narration/description/particulars, debit/withdrawal/amount
  let headerIndex = -1;
  for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
    const rowStr = rawRows[i].map((c) => String(c).toLowerCase()).join(' ');
    if (
      rowStr.includes('date') &&
      (rowStr.includes('narration') ||
       rowStr.includes('description') ||
       rowStr.includes('particulars') ||
       rowStr.includes('amount') ||
       rowStr.includes('withdrawal') ||
       rowStr.includes('debit') ||
       rowStr.includes('deposit') ||
       rowStr.includes('credit') ||
       rowStr.includes('details'))
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    // If not found, default to first non-empty row
    headerIndex = rawRows.findIndex((r) => r.some((c) => String(c).trim().length > 0));
    if (headerIndex === -1) headerIndex = 0;
  }

  const headers = rawRows[headerIndex].map((h) => String(h).trim().toLowerCase());
  
  // Find column indices
  const dateCol = headers.findIndex((h) => h.includes('date') && !h.includes('value'));
  const fallbackDateCol = dateCol !== -1 ? dateCol : headers.findIndex((h) => h.includes('date'));
  const descCol = headers.findIndex((h) =>
    h.includes('narration') || h.includes('description') || h.includes('particular') || h.includes('detail') || h.includes('payee') || h.includes('merchant') || h.includes('remarks')
  );
  const debitCol = headers.findIndex((h) => h.includes('withdrawal') || h.includes('debit') || h === 'dr');
  const creditCol = headers.findIndex((h) => h.includes('deposit') || h.includes('credit') || h === 'cr');
  const amountCol = headers.findIndex((h) => h.includes('amount') || h === 'amt');
  const typeCol = headers.findIndex((h) => h === 'type' || h.includes('cr/dr') || h.includes('dr/cr'));
  const catCol = headers.findIndex((h) => h.includes('categor'));
  const refCol = headers.findIndex((h) =>
    h.includes('ref') || h.includes('reference') || h.includes('chq') || h.includes('cheque') || h.includes('utr') || h.includes('rrn') || h.includes('txn id') || h.includes('trans id')
  );

  const transactions: ParsedTransaction[] = [];

  for (let r = headerIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !row.length) continue;

    const rawDate = row[fallbackDateCol];
    if (!rawDate && !row[descCol] && !row[amountCol] && !row[debitCol]) continue;

    const date = parseDateString(rawDate);
    const narration = String(row[descCol] || '').trim();
    if (!narration && !row[debitCol] && !row[creditCol] && !row[amountCol]) continue;

    let amount = 0;
    let type: 'expense' | 'income' = 'expense';

    if (debitCol !== -1 || creditCol !== -1) {
      const debitParsed = debitCol !== -1 ? parseAmount(row[debitCol]) : { amount: 0 };
      const creditParsed = creditCol !== -1 ? parseAmount(row[creditCol]) : { amount: 0 };

      if (creditParsed.amount > 0 && debitParsed.amount === 0) {
        amount = creditParsed.amount;
        type = 'income';
      } else if (debitParsed.amount > 0) {
        amount = debitParsed.amount;
        type = 'expense';
      } else if (amountCol !== -1) {
        const amtParsed = parseAmount(row[amountCol]);
        amount = amtParsed.amount;
        type = amtParsed.isCredit ? 'income' : 'expense';
      }
    } else if (amountCol !== -1) {
      const amtParsed = parseAmount(row[amountCol]);
      amount = amtParsed.amount;
      if (typeCol !== -1) {
        const typeVal = String(row[typeCol]).toLowerCase();
        type = (typeVal.includes('cr') || typeVal.includes('income') || typeVal.includes('credit')) ? 'income' : 'expense';
      } else {
        type = isCreditTransaction(narration) ? 'income' : isDebitTransaction(narration) ? 'expense' : (amtParsed.isCredit ? 'income' : 'expense');
      }
    }

    if (amount <= 0) continue;

    const merchant = cleanMerchantName(narration);
    const explicitCat = (catCol !== -1 && row[catCol]) ? String(row[catCol]).trim() : undefined;
    const { category, type: resolvedType } = predictCategoryAndType(narration || merchant, type, explicitCat, knownPeopleNames);
    const paymentMethod = detectPaymentMethod(narration);
    const refNo = extractReferenceNumber(narration, refCol !== -1 ? row[refCol] : undefined);

    transactions.push({
      id: `xlsx-${r}-${Date.now()}`,
      date,
      amount,
      type: resolvedType,
      merchant,
      category,
      payment_method: paymentMethod,
      refNo,
      notes: narration,
      rawText: JSON.stringify(row),
      selected: true,
    });
  }

  const ext = file.name.endsWith('.xls') ? 'xls' : 'xlsx';
  return {
    fileName: file.name,
    fileType: ext,
    transactions,
    totalRows: transactions.length,
  };
}

/**
 * Parse CSV or delimited text files
 */
export async function parseCSVOrText(file: File, knownPeopleNames: string[] = []): Promise<ParseResult> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('File has no transaction data lines');
  }

  // Detect delimiter: check comma, semicolon, tab, pipe in first line
  const firstLine = lines[0];
  let delimiter = ',';
  const delimiters = [',', '\t', ';', '|'];
  let maxCount = 0;
  for (const d of delimiters) {
    const count = (firstLine.match(new RegExp(`\\${d}`, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      delimiter = d;
    }
  }

  // Use SheetJS for standard CSV/TSV parsing as it handles quoted multiline fields
  const workbook = XLSX.read(text, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Fallback to manual line parsing if XLSX returned empty
  if (!rawRows || rawRows.length < 2) {
    return parseManualTextLines(file.name, lines, delimiter, knownPeopleNames);
  }

  // Find header row index
  let headerIndex = 0;
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const rowStr = rawRows[i].map((c) => String(c).toLowerCase()).join(' ');
    if (
      rowStr.includes('date') &&
      (rowStr.includes('narration') ||
       rowStr.includes('description') ||
       rowStr.includes('particulars') ||
       rowStr.includes('amount') ||
       rowStr.includes('withdrawal') ||
       rowStr.includes('debit') ||
       rowStr.includes('deposit') ||
       rowStr.includes('credit') ||
       rowStr.includes('details') ||
       rowStr.includes('merchant'))
    ) {
      headerIndex = i;
      break;
    }
  }

  const headers = rawRows[headerIndex].map((h) => String(h).trim().toLowerCase());
  const dateCol = headers.findIndex((h) => h.includes('date') && !h.includes('value'));
  const fallbackDateCol = dateCol !== -1 ? dateCol : headers.findIndex((h) => h.includes('date'));
  const descCol = headers.findIndex((h) =>
    h.includes('narration') || h.includes('description') || h.includes('particular') || h.includes('detail') || h.includes('payee') || h.includes('merchant') || h.includes('remarks')
  );
  const debitCol = headers.findIndex((h) => h.includes('withdrawal') || h.includes('debit') || h === 'dr');
  const creditCol = headers.findIndex((h) => h.includes('deposit') || h.includes('credit') || h === 'cr');
  const amountCol = headers.findIndex((h) => h.includes('amount') || h === 'amt');
  const typeCol = headers.findIndex((h) => h === 'type' || h.includes('cr/dr') || h.includes('dr/cr'));
  const catCol = headers.findIndex((h) => h.includes('categor'));
  const methodCol = headers.findIndex((h) => h.includes('method') || h.includes('payment_method'));
  const refCol = headers.findIndex((h) =>
    h.includes('ref') || h.includes('reference') || h.includes('chq') || h.includes('cheque') || h.includes('utr') || h.includes('rrn') || h.includes('txn id') || h.includes('trans id')
  );

  const transactions: ParsedTransaction[] = [];

  for (let r = headerIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !row.length) continue;

    const rawDate = row[fallbackDateCol];
    const narration = String(row[descCol] || '').trim();
    if (!rawDate && !narration) continue;

    let amount = 0;
    let type: 'expense' | 'income' = 'expense';

    if (debitCol !== -1 || creditCol !== -1) {
      const debitParsed = debitCol !== -1 ? parseAmount(row[debitCol]) : { amount: 0 };
      const creditParsed = creditCol !== -1 ? parseAmount(row[creditCol]) : { amount: 0 };

      if (creditParsed.amount > 0 && debitParsed.amount === 0) {
        amount = creditParsed.amount;
        type = 'income';
      } else if (debitParsed.amount > 0) {
        amount = debitParsed.amount;
        type = 'expense';
      } else if (amountCol !== -1) {
        const amtParsed = parseAmount(row[amountCol]);
        amount = amtParsed.amount;
        type = amtParsed.isCredit ? 'income' : 'expense';
      }
    } else if (amountCol !== -1) {
      const amtParsed = parseAmount(row[amountCol]);
      amount = amtParsed.amount;
      if (typeCol !== -1) {
        const typeVal = String(row[typeCol]).toLowerCase();
        type = (typeVal.includes('cr') || typeVal.includes('income') || typeVal.includes('credit')) ? 'income' : 'expense';
      } else {
        type = isCreditTransaction(narration) ? 'income' : isDebitTransaction(narration) ? 'expense' : (amtParsed.isCredit ? 'income' : 'expense');
      }
    }

    if (amount <= 0) continue;

    const date = parseDateString(rawDate);
    const merchant = cleanMerchantName(narration || 'Transaction');
    const explicitCat = (catCol !== -1 && row[catCol]) ? String(row[catCol]).trim() : undefined;
    const { category, type: resolvedType } = predictCategoryAndType(narration || merchant, type, explicitCat, knownPeopleNames);

    const paymentMethod = methodCol !== -1 && row[methodCol]
      ? (String(row[methodCol]).toLowerCase() as any)
      : detectPaymentMethod(narration);

    const refNo = extractReferenceNumber(narration, refCol !== -1 ? row[refCol] : undefined);

    transactions.push({
      id: `csv-${r}-${Date.now()}`,
      date,
      amount,
      type: resolvedType,
      merchant,
      category,
      payment_method: paymentMethod,
      refNo,
      notes: narration,
      selected: true,
    });
  }

  const isTxt = file.name.endsWith('.txt');
  return {
    fileName: file.name,
    fileType: isTxt ? 'txt' : 'csv',
    transactions,
    totalRows: transactions.length,
  };
}

/**
 * Fallback parser for plain text bank exports / logs
 */
function parseManualTextLines(fileName: string, lines: string[], delimiter = ',', knownPeopleNames: string[] = []): ParseResult {
  const transactions: ParsedTransaction[] = [];

  // Try parsing each line for date + amount
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check if line can be split with delimiter
    const parts = line.split(delimiter).map((p) => p.trim());
    if (parts.length >= 3) {
      // Delimited row
      const datePart = parts.find((p) => /\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/.test(p));
      const amtPart = parts.find((p) => /[\d,]+\.\d{2}/.test(p));
      if (datePart && amtPart) {
        const date = parseDateString(datePart);
        const { amount, isCredit: amtIsCredit } = parseAmount(amtPart);
        const isCredit = amtIsCredit || isCreditTransaction(line);
        const isDebit = isDebitTransaction(line);
        const type: 'expense' | 'income' = isCredit && !isDebit ? 'income' : isDebit ? 'expense' : 'expense';
        const descParts = parts.filter((p) => p !== datePart && p !== amtPart && p.length > 1);
        const desc = descParts.join(' ') || 'Transaction';
        if (amount > 0) {
          const { category, type: resolvedType } = predictCategoryAndType(line || desc, type, undefined, knownPeopleNames);
          const refNo = extractReferenceNumber(line);
          transactions.push({
            id: `txt-${i}-${Date.now()}`,
            date,
            amount,
            type: resolvedType,
            merchant: cleanMerchantName(desc),
            category,
            payment_method: detectPaymentMethod(desc),
            refNo,
            notes: line,
            selected: true,
          });
          continue;
        }
      }
    }

    // Check if line contains a date and amount
    const dateMatch = line.match(/\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/);
    const amountMatches = line.match(/[\d,]+\.\d{2}/g);

    if (dateMatch && amountMatches && amountMatches.length > 0) {
      const date = parseDateString(dateMatch[1]);
      const lastAmtStr = amountMatches[0];
      const { amount } = parseAmount(lastAmtStr);
      const isCredit = isCreditTransaction(line);
      const isDebit = isDebitTransaction(line);
      const type: 'expense' | 'income' = isCredit && !isDebit ? 'income' : isDebit ? 'expense' : 'expense';

      // Remove date and numbers to get description
      let desc = line
        .replace(dateMatch[0], '')
        .replace(/[\d,]+\.\d{2}/g, '')
        .replace(/[,\t|;]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (amount > 0) {
        const { category, type: resolvedType } = predictCategoryAndType(line || desc, type, undefined, knownPeopleNames);
        const refNo = extractReferenceNumber(line);
        transactions.push({
          id: `txt-${i}-${Date.now()}`,
          date,
          amount,
          type: resolvedType,
          merchant: cleanMerchantName(desc || 'Transaction'),
          category,
          payment_method: detectPaymentMethod(desc),
          refNo,
          notes: line,
          selected: true,
        });
      }
    }
  }

  return {
    fileName,
    fileType: 'txt',
    transactions,
    totalRows: transactions.length,
  };
}

/**
 * Parse Bank Statement PDF using pdfjs-dist
 */
export async function parsePDFFile(
  file: File,
  password?: string,
  knownPeopleNames: string[] = []
): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    password: password || undefined,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const transactions: ParsedTransaction[] = [];
  let previousBalance: number | null = null;

  // Track global detected column positions
  let detectedDebitX: number | null = null;
  let detectedCreditX: number | null = null;

  // Iterate all pages
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str: string; transform: number[] }>;

    if (!items || !items.length) continue;

    // Detect column header positions from page text items
    for (let i = 0; i < items.length; i++) {
      const str = items[i].str.trim().toLowerCase();
      const x = Math.round(items[i].transform[4]);
      if (str.includes('withdrawal') || str === 'debit' || str.includes('debit amt') || str.includes('withdrawal amt')) {
        detectedDebitX = x;
      } else if (str.includes('deposit') || str === 'credit' || str.includes('credit amt') || str.includes('deposit amt')) {
        detectedCreditX = x;
      }
    }

    // Group items into visual text lines based on Y-coordinate (transform[5])
    const lineMap = new Map<number, Array<{ str: string; x: number }>>();

    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);

      // Find an existing bucket within 4px tolerance of Y
      let matchedY: number | null = null;
      for (const existingY of lineMap.keys()) {
        if (Math.abs(existingY - y) <= 4) {
          matchedY = existingY;
          break;
        }
      }

      if (matchedY !== null) {
        lineMap.get(matchedY)!.push({ str: item.str, x });
      } else {
        lineMap.set(y, [{ str: item.str, x }]);
      }
    }

    // Sort lines top to bottom (descending Y)
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

    // Build raw line representations with item positions
    const visualLines: Array<{
      y: number;
      text: string;
      items: Array<{ str: string; x: number }>;
    }> = [];

    for (const y of sortedYs) {
      const lineItems = lineMap.get(y)!;
      lineItems.sort((a, b) => a.x - b.x);
      const text = lineItems.map((it) => it.str).join(' ').trim();
      if (text) {
        visualLines.push({ y, text, items: lineItems });
      }
    }

    // Process lines and stitch multi-line rows
    for (let i = 0; i < visualLines.length; i++) {
      const currentLine = visualLines[i];
      let lineText = currentLine.text;
      let lineItems = [...currentLine.items];

      // Check if currentLine starts with a date
      const dateMatch = lineText.match(/\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/) ||
                        lineText.match(/\b(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})\b/) ||
                        lineText.match(/\b(\d{1,2}[\s\-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-]\d{2,4})\b/i);

      if (!dateMatch) continue;

      let amountMatches = lineText.match(/[\d,]+\.\d{2}/g);

      // If line has date but no amount, peek at next line within 25px Y
      if (!amountMatches || amountMatches.length === 0) {
        if (i + 1 < visualLines.length) {
          const nextLine = visualLines[i + 1];
          const yDiff = Math.abs(currentLine.y - nextLine.y);
          if (yDiff <= 25) {
            const nextAmtMatches = nextLine.text.match(/[\d,]+\.\d{2}/g);
            if (nextAmtMatches && nextAmtMatches.length > 0) {
              lineText = `${lineText} ${nextLine.text}`;
              lineItems = [...lineItems, ...nextLine.items];
              amountMatches = nextAmtMatches;
              i++; // Advance counter
            }
          }
        }
      }

      if (!amountMatches || amountMatches.length === 0) continue;

      const date = parseDateString(dateMatch[1]);

      // Detect transaction amount, balance, and type
      let amount = 0;
      let type: 'expense' | 'income' = 'expense';
      let currentLineBalance: number | null = null;

      // Check if any amount item on this line is near detected Credit or Debit column
      let itemUnderCreditCol = false;
      let itemUnderDebitCol = false;

      const amountItems = lineItems.filter((it) => /[\d,]+\.\d{2}/.test(it.str));

      // Check explicit Cr/Dr indicators in line items
      const hasExplicitCr =
        isCreditTransaction(lineText) ||
        lineItems.some((it) => /\b(cr|credit|deposit|\(cr\))\b/i.test(it.str)) ||
        /\b[\d,]+\.\d{2}\s*\(?(cr)\b/i.test(lineText);

      const hasExplicitDr =
        isDebitTransaction(lineText) ||
        lineItems.some((it) => /\b(dr|debit|withdrawal|\(dr\))\b/i.test(it.str)) ||
        /\b[\d,]+\.\d{2}\s*\(?(dr)\b/i.test(lineText);

      if (detectedCreditX !== null && detectedDebitX !== null) {
        for (const it of amountItems) {
          const isNearCredit = Math.abs(it.x - detectedCreditX) < Math.abs(it.x - detectedDebitX) && Math.abs(it.x - detectedCreditX) < 65;
          const isNearDebit = Math.abs(it.x - detectedDebitX) < Math.abs(it.x - detectedCreditX) && Math.abs(it.x - detectedDebitX) < 65;
          if (isNearCredit) itemUnderCreditCol = true;
          if (isNearDebit) itemUnderDebitCol = true;
        }
      }

      if (amountMatches.length >= 3) {
        // Table with [Debit, Credit, Balance]
        const debitAmt = parseAmount(amountMatches[0]).amount;
        const creditAmt = parseAmount(amountMatches[1]).amount;
        currentLineBalance = parseAmount(amountMatches[2]).amount;

        if (creditAmt > 0 && debitAmt === 0) {
          amount = creditAmt;
          type = 'income';
        } else if (debitAmt > 0 && creditAmt === 0) {
          amount = debitAmt;
          type = 'expense';
        } else if (itemUnderCreditCol && !itemUnderDebitCol) {
          amount = creditAmt || parseAmount(amountMatches[1]).amount;
          type = 'income';
        } else {
          amount = debitAmt || creditAmt || parseAmount(amountMatches[0]).amount;
          type = hasExplicitCr && !hasExplicitDr ? 'income' : 'expense';
        }
      } else if (amountMatches.length === 2) {
        // Table with [Amount, Balance] or [Debit/Credit, Balance]
        const txnCandidate = parseAmount(amountMatches[0]).amount;
        const balCandidate = parseAmount(amountMatches[1]).amount;

        amount = txnCandidate;
        currentLineBalance = balCandidate;

        // Check 1: Balance delta (Mathematical ground truth)
        if (previousBalance !== null && currentLineBalance > 0) {
          const diff = Math.round((currentLineBalance - previousBalance) * 100) / 100;
          if (diff > 0) {
            type = 'income';
          } else if (diff < 0) {
            type = 'expense';
          }
        } else if (itemUnderCreditCol && !itemUnderDebitCol) {
          type = 'income';
        } else if (itemUnderDebitCol && !itemUnderCreditCol) {
          type = 'expense';
        } else if (hasExplicitCr && !hasExplicitDr) {
          type = 'income';
        } else if (hasExplicitDr && !hasExplicitCr) {
          type = 'expense';
        } else {
          type = isCreditTransaction(lineText) ? 'income' : 'expense';
        }
      } else {
        // Single amount on line
        amount = parseAmount(amountMatches[0]).amount;
        if (itemUnderCreditCol && !itemUnderDebitCol) {
          type = 'income';
        } else if (hasExplicitCr && !hasExplicitDr) {
          type = 'income';
        } else {
          type = isCreditTransaction(lineText) ? 'income' : 'expense';
        }
      }

      if (currentLineBalance !== null && currentLineBalance > 0) {
        previousBalance = currentLineBalance;
      }

      if (amount <= 0) continue;

      // Extract reference number before stripping
      const refNo = extractReferenceNumber(lineText);

      // Extract narration: remove date, amounts, CR/DR tokens, Chq/Ref series codes, and long numbers
      let narration = lineText
        .replace(dateMatch[0], '')
        .replace(/[\d,]+\.\d{2}/g, '')
        .replace(/\b(CR|DR|Cr|Dr|\(CR\)|\(DR\))\b/g, '')
        .replace(/\b[A-Za-z]\s*[-/]?\s*\d{1,6}\b/gi, '') // remove S 13, S-13, S13
        .replace(/\b0+\d{4,}\b/g, '')                     // remove 0000130389969858
        .replace(/\b\d{7,}\b/g, '')                       // remove long numbers
        .replace(/\s+\d{1,4}$/, '')                       // remove branch/counter like 05
        .replace(/\b(CHQ|REF|UTR|TXN|NO|CHEQUE)[.:\s\d-]*\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      const merchant = cleanMerchantName(narration);
      const { category, type: resolvedType } = predictCategoryAndType(
        narration || merchant,
        type,
        undefined,
        knownPeopleNames
      );
      const paymentMethod = detectPaymentMethod(narration);

      transactions.push({
        id: `pdf-${pageNum}-${i}-${transactions.length}`,
        date,
        amount,
        type: resolvedType,
        merchant,
        category,
        payment_method: paymentMethod,
        refNo,
        notes: narration || lineText,
        selected: true,
      });
    }
  }

  return {
    fileName: file.name,
    fileType: 'pdf',
    transactions,
    totalRows: transactions.length,
  };
}

/**
 * Apply the final import rules shared by every statement format (Excel, PDF, CSV, TXT).
 * Rows without a valid transaction/reference number are removed here, BEFORE the list is
 * displayed or sent for OpenAI merchant/category checking, so every format yields the
 * exact same processed dataset.
 */
function applyFinalImportRules(result: ParseResult): ParseResult {
  const transactions = result.transactions.filter((t) => hasValidReferenceNumber(t.refNo));
  return { ...result, transactions, totalRows: transactions.length };
}

/**
 * Universal Statement Parser Dispatcher
 */
export async function parseStatementFile(
  file: File,
  pdfPassword?: string,
  knownPeopleNames: string[] = []
): Promise<ParseResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) {
    return applyFinalImportRules(await parsePDFFile(file, pdfPassword, knownPeopleNames));
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return applyFinalImportRules(await parseExcelFile(file, knownPeopleNames));
  }

  if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) {
    return applyFinalImportRules(await parseCSVOrText(file, knownPeopleNames));
  }

  throw new Error(`Unsupported file type: ${file.name}. Please select a .pdf, .xlsx, .xls, .csv, or .txt file.`);
}
