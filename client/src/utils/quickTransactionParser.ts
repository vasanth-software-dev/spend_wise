import { TransactionType, PaymentMethod, Category } from '../types/index.js';

export interface ParsedQuickEntry {
  amount: number | null;
  merchant: string;
  type: TransactionType;
  categoryId: string | null;
  categoryName: string | null;
  paymentMethod: PaymentMethod;
  notes?: string;
  confidence: number;
}

const PAYMENT_METHOD_KEYWORDS: Record<string, PaymentMethod> = {
  upi: 'upi',
  gpay: 'upi',
  phonepe: 'upi',
  paytm: 'upi',
  card: 'card',
  debit: 'card',
  credit: 'card',
  visa: 'card',
  mastercard: 'card',
  cash: 'cash',
  bank: 'bank',
  netbanking: 'bank',
  imps: 'bank',
  neft: 'bank',
  wallet: 'wallet',
};

const INCOME_KEYWORDS = [
  'salary',
  'stipend',
  'payroll',
  'bonus',
  'freelance',
  'dividend',
  'refund',
  'cashback',
  'received',
  'credit',
  'deposit',
];

const TRANSFER_KEYWORDS = ['transfer', 'self', 'savings account', 'move', 'sweep'];

/**
 * Fast natural text parser for Indian personal finance transactions.
 * Interprets queries like:
 * - "Swiggy 420 food"
 * - "Salary 68000"
 * - "Uber 280 transport upi"
 * - "Paid 1500 to Priya dinner"
 * - "1250 groceries blinkit"
 */
export function parseQuickTransaction(
  input: string,
  categories: Category[] = []
): ParsedQuickEntry {
  const cleanInput = input.trim();
  if (!cleanInput) {
    return {
      amount: null,
      merchant: '',
      type: 'expense',
      categoryId: null,
      categoryName: null,
      paymentMethod: 'upi',
      confidence: 0,
    };
  }

  const tokens = cleanInput.split(/\s+/);
  let parsedAmount: number | null = null;
  let parsedMethod: PaymentMethod = 'upi';
  let parsedType: TransactionType = 'expense';
  let matchedCategory: Category | null = null;
  const merchantTokens: string[] = [];
  const noteTokens: string[] = [];

  // 1. Extract Amount
  // Matches ₹420, Rs. 420, 420, 1,250.50
  const amountRegex = /^(?:(?:rs|inr|₹)\.?)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)$/i;

  const remainingTokens: string[] = [];
  for (const token of tokens) {
    const match = token.replace(/,/g, '').match(amountRegex);
    if (!parsedAmount && match && !isNaN(parseFloat(match[1]))) {
      parsedAmount = parseFloat(match[1]);
    } else {
      remainingTokens.push(token);
    }
  }

  // 2. Identify Keywords (Payment Method, Category, Type)
  for (let i = 0; i < remainingTokens.length; i++) {
    const token = remainingTokens[i];
    const lower = token.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Ignore filler words
    if (['paid', 'to', 'for', 'at', 'on', 'via', 'with', 'using', 'rs', 'inr'].includes(lower)) {
      continue;
    }

    // Check payment method keyword
    if (PAYMENT_METHOD_KEYWORDS[lower]) {
      parsedMethod = PAYMENT_METHOD_KEYWORDS[lower];
      continue;
    }

    // Check income keyword
    if (INCOME_KEYWORDS.includes(lower)) {
      parsedType = 'income';
    }

    // Check transfer keyword
    if (TRANSFER_KEYWORDS.includes(lower)) {
      parsedType = 'transfer';
    }

    // Check category match
    if (!matchedCategory && categories.length > 0) {
      const directCat = categories.find((c) => {
        const catLower = c.name.toLowerCase();
        return (
          catLower === lower ||
          catLower.includes(lower) ||
          (lower.length >= 4 && catLower.startsWith(lower))
        );
      });

      if (directCat) {
        matchedCategory = directCat;
        continue;
      }
    }

    // Otherwise, this token is part of merchant or description
    merchantTokens.push(token);
  }

  // If type is income and no merchant token exists, default merchant to 'Salary' or 'Income'
  let merchant = merchantTokens.join(' ').trim();
  if (!merchant) {
    if (parsedType === 'income') {
      merchant = 'Salary / Inflow';
    } else if (matchedCategory) {
      merchant = matchedCategory.name;
    } else {
      merchant = 'Expense';
    }
  }

  // Auto-resolve Category if not explicitly mentioned
  if (!matchedCategory && categories.length > 0) {
    const merchantLower = merchant.toLowerCase();

    // Heuristics for popular Indian fintech merchants
    if (/swiggy|zomato|starbucks|mcdonalds|kfc|burger|chai|cafe|restaurant|baking|pizza/i.test(merchantLower)) {
      matchedCategory = categories.find((c) => /food|dining/i.test(c.name)) || null;
    } else if (/blinkit|zepto|bigbasket|dmart|instamart|grocery|supermarket/i.test(merchantLower)) {
      matchedCategory = categories.find((c) => /grocer/i.test(c.name)) || null;
    } else if (/uber|ola|rapido|metro|auto|train|irctc|flight|indigo/i.test(merchantLower)) {
      matchedCategory = categories.find((c) => /transport|commute|cab/i.test(c.name)) || null;
    } else if (/amazon|flipkart|myntra|ajio|zara|h&m|clothing/i.test(merchantLower)) {
      matchedCategory = categories.find((c) => /shopping/i.test(c.name)) || null;
    } else if (/petrol|fuel|hpcl|bpcl|ioc|diesel/i.test(merchantLower)) {
      matchedCategory = categories.find((c) => /fuel/i.test(c.name)) || null;
    } else if (/airtel|jio|vi|broadband|electricity|tneb|bescom|water|bill/i.test(merchantLower)) {
      matchedCategory = categories.find((c) => /bill|utilit/i.test(c.name)) || null;
    } else if (/netflix|spotify|prime|youtube|hotstar|pvr|inox|cinema/i.test(merchantLower)) {
      matchedCategory = categories.find((c) => /entertainment|subscript/i.test(c.name)) || null;
    } else if (/pharmacy|apollo|1mg|cult|hospital|doctor|clinic/i.test(merchantLower)) {
      matchedCategory = categories.find((c) => /health|medical/i.test(c.name)) || null;
    } else if (/salary|payroll|stipend|freelance/i.test(merchantLower)) {
      matchedCategory = categories.find((c) => /salary|income/i.test(c.name)) || null;
      parsedType = 'income';
    }
  }

  // Calculate confidence score (0 - 100)
  let confidence = 40;
  if (parsedAmount && parsedAmount > 0) confidence += 30;
  if (merchant) confidence += 15;
  if (matchedCategory) confidence += 15;

  return {
    amount: parsedAmount,
    merchant,
    type: parsedType,
    categoryId: matchedCategory?._id || null,
    categoryName: matchedCategory?.name || null,
    paymentMethod: parsedMethod,
    notes: noteTokens.join(' ') || undefined,
    confidence: Math.min(100, confidence),
  };
}
