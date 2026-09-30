import { createHash } from 'crypto';
import { env } from '../config/env.js';
import { getCache } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export const AI_TRANSACTION_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Shopping',
  'Travel / Transport',
  'Medical / Pharmacy',
  'Bills & Utilities',
  'Rent',
  'Education',
  'Entertainment',
  'Subscriptions',
  'Software / Digital Services',
  'Personal Care',
  'Electronics',
  'Fuel',
  'Insurance',
  'Investments',
  'Banking / Fees',
  'Wallet / Transfer',
  'Person-to-Person',
  'Salary / Income',
  'Refund',
  'Cash Withdrawal',
  'Uncategorized',
] as const;

export type AITransactionCategory = (typeof AI_TRANSACTION_CATEGORIES)[number];

export interface TransactionClassification {
  name: string;
  category: AITransactionCategory;
}

export interface TransactionClassificationInput {
  description: string;
  amount: number;
  type: string;
  date: string | Date;
  merchant?: string;
}

interface ClassificationCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
}

interface ClassificationServiceOptions {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  timeoutMs?: number;
  cache?: ClassificationCache;
  fetcher?: typeof fetch;
}

const CLASSIFICATION_INSTRUCTIONS = `You are an expense transaction classification agent for an Indian personal expense tracker.

Analyze the complete bank/UPI transaction information.

Your job is to identify:
1. The clean merchant, business, service, or person's name.
2. The most appropriate expense category.

Use the complete transaction context and your knowledge of merchants/businesses. Do not rely only on simple keyword matching.

Allowed categories (use exactly one):
${AI_TRANSACTION_CATEGORIES.map((category) => `- ${category}`).join('\n')}

Never create a new category. Extract the actual merchant, business, service, or person's name. Ignore UPI IDs, @handles, IFSC codes, bank codes, transaction IDs, reference numbers, Razorpay, PayU, Paytm, Airtel Payments, PhonePe, Google Pay, UPIINTENT, NOREMARK, PAYMENT, PAY, and transaction metadata when they are not the merchant. Do not use a payment gateway as the merchant when the real merchant is present. Clean ALL CAPS names into readable names and preserve well-known brand spelling.

Examples:
INDIANRAILWAYS → Indian Railways / Travel / Transport
RABIKRAJASNACKS → Rabikraja Snacks / Food & Dining
ABHIBUS → AbhiBus / Travel / Transport
OMSRISARAVANABAVA → Om Sri Saravanabava / Food & Dining
FLIPKARTINTERNETPV → Flipkart / Shopping
APOLLOPHARMACY → Apollo Pharmacy / Medical / Pharmacy
BALA CATERERS → Bala Caterers / Food & Dining
MMINDIAMEDICALS → M M India Medicals / Medical / Pharmacy
SARATH ENTERPRISES → Sarath Enterprises / Shopping
PAYZAPPWALLET top-up → PayZapp Wallet / Wallet / Transfer
An identifiable individual payee → their readable name / Person-to-Person

Do not assume every name is a person; classify businesses by their business type. If the merchant cannot be identified with confidence, use the best readable name available without inventing one, and use Uncategorized if its category cannot reasonably be determined.

Return ONLY valid JSON with exactly these properties:
{"name":"Merchant or Person Name","category":"One allowed category"}
No markdown, explanation, comments, or additional text.`;

let missingApiKeyWarningLogged = false;

function normalizeCategory(value: unknown): AITransactionCategory | null {
  if (typeof value !== 'string') return null;
  const match = AI_TRANSACTION_CATEGORIES.find(
    (category) => category.toLowerCase() === value.trim().toLowerCase()
  );
  return match || null;
}

function normalizeFallbackCategory(value: unknown): AITransactionCategory {
  const category = normalizeCategory(value);
  if (category) return category;
  if (typeof value !== 'string') return 'Uncategorized';

  const legacyCategory = value.trim().toLowerCase();
  const aliases: Record<string, AITransactionCategory> = {
    transport: 'Travel / Transport',
    travel: 'Travel / Transport',
    'health & medical': 'Medical / Pharmacy',
    'medical / pharmacy': 'Medical / Pharmacy',
    'friends & family': 'Person-to-Person',
    'person-to-person': 'Person-to-Person',
    salary: 'Salary / Income',
    income: 'Salary / Income',
    'atm & cash': 'Cash Withdrawal',
    'cash withdrawal': 'Cash Withdrawal',
    'salon & grooming': 'Personal Care',
    'other': 'Uncategorized',
  };
  return aliases[legacyCategory] || 'Uncategorized';
}

function parseClassification(content: string): TransactionClassification | null {
  const candidates = [content];
  const jsonObject = content.match(/\{[\s\S]*\}/);
  if (jsonObject && jsonObject[0] !== content) candidates.push(jsonObject[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { name?: unknown; category?: unknown };
      const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
      const category = normalizeCategory(parsed.category);
      if (name && category && name.length <= 120) return { name, category };
    } catch {
      continue;
    }
  }

  return null;
}

function sanitizeDescription(description: string): string {
  return description
    .replace(/\b(?:account|acct|a\/c|card)\s*(?:number|no\.?|#)\s*[:#-]?\s*[A-Z0-9 -]{4,}\b/gi, '[REDACTED ACCOUNT/CARD]')
    .replace(/\b(?:\d[ -]?){12,19}\b/g, '[REDACTED NUMBER]')
    .replace(/\b\d{8,}\b/g, '[REDACTED REFERENCE]')
    .slice(0, 2500);
}

function merchantCacheKey(input: TransactionClassificationInput): string | null {
  let candidate = (input.merchant || '').trim();
  if (!candidate || /^(unknown|transaction|statement entry|bank transaction|upi payee)$/i.test(candidate)) {
    candidate = input.description
      .replace(/^\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s*/i, '')
      .replace(/^\s*(?:UPI|POS|NEFT|IMPS)[-/\s:]*/i, '')
      .split(/[-/|]/, 1)[0]
      .trim();
  }

  const compact = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (compact.length < 3 || /^(unknown|transaction|statemententry|banktransaction|upipayee)$/.test(compact)) {
    return null;
  }

  const knownMerchants: Array<[string, string]> = [
    ['flipkart', 'flipkart'],
    ['abhibus', 'abhibus'],
    ['indianrailways', 'indianrailways'],
    ['apollo pharmacy', 'apollopharmacy'],
    ['apollopharmacy', 'apollopharmacy'],
    ['mmindiamedical', 'mmindiamedical'],
    ['payzapp', 'payzapp'],
  ];
  const alias = knownMerchants.find(([prefix]) => compact.startsWith(prefix.replace(/[^a-z0-9]/g, '')));
  if (alias) return alias[1];

  const normalized = candidate
    .replace(/\b(?:razorpay|payu|paytm|phonepe|googlepay|airtelpayments|upiintent|payment|payments|private|pvt|limited|ltd)\b/gi, ' ')
    .replace(/\b(?:p|pv)\b/gi, ' ')
    .replace(/\d+/g, ' ')
    .replace(/[^a-zA-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (normalized.length < 3 || /^[a-z]\s+[a-z]$/.test(normalized)) return null;
  return normalized;
}

function isWalletTopUp(input: TransactionClassificationInput): boolean {
  const text = `${input.merchant || ''} ${input.description}`.toLowerCase();
  return /payzapp\s*wallet|payzappwallet|wallet\s*(?:top[\s-]?up|load|recharge)|wallet(?:topup|load|recharge)|(?:top[\s-]?up|load|recharge).{0,30}wallet/.test(text);
}

export class TransactionClassificationService {
  private readonly apiKey?: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly cache?: ClassificationCache;
  private readonly fetcher: typeof fetch;
  private readonly inFlight = new Map<string, Promise<TransactionClassification | null>>();

  constructor(options: ClassificationServiceOptions = {}) {
    this.apiKey = options.apiKey ?? env.AI_API_KEY;
    this.apiUrl = options.apiUrl ?? env.AI_API_URL;
    this.model = options.model ?? env.AI_MODEL;
    this.timeoutMs = options.timeoutMs ?? env.AI_TIMEOUT_MS;
    this.cache = options.cache;
    this.fetcher = options.fetcher ?? fetch;
  }

  async classify(
    input: TransactionClassificationInput,
    fallback: { name?: string; category?: string }
  ): Promise<TransactionClassification> {
    const fallbackResult: TransactionClassification = {
      name: fallback.name?.trim() || input.merchant?.trim() || 'Unknown merchant',
      category: normalizeFallbackCategory(fallback.category),
    };

    if (isWalletTopUp(input)) {
      return {
        name: /payzapp/i.test(`${input.merchant} ${input.description}`)
          ? 'PayZapp Wallet'
          : fallbackResult.name,
        category: 'Wallet / Transfer',
      };
    }

    const contextNeedsFreshClassification = input.type.toLowerCase() !== 'expense'
      || /\b(refund|cashback|reversal|chargeback|salary|credit)\b/i.test(input.description);
    const cacheKey = contextNeedsFreshClassification ? null : merchantCacheKey(input);
    if (cacheKey) {
      const cached = await this.readCache(cacheKey);
      if (cached) return cached;
    }

    if (!this.apiKey) {
      if (!missingApiKeyWarningLogged) {
        logger.warn('AI_API_KEY is not configured; transaction classification is using existing parser results');
        missingApiKeyWarningLogged = true;
      }
      return fallbackResult;
    }

    const cacheable = cacheKey && fallbackResult.category !== 'Person-to-Person';
    const requestKey = cacheable ? cacheKey : null;
    let request = requestKey ? this.inFlight.get(requestKey) : undefined;

    if (!request) {
      request = this.requestClassification(input);
      if (requestKey) this.inFlight.set(requestKey, request);
    }

    try {
      const classified = await request;
      if (!classified) {
        logger.warn('AI transaction classification returned invalid structured output; using existing parser results');
        return fallbackResult;
      }

      if (
        cacheable
        && requestKey
        && classified.category !== 'Person-to-Person'
        && request === this.inFlight.get(requestKey)
      ) {
        await this.writeCache(requestKey, classified);
      }
      return classified;
    } catch (error) {
      logger.warn('AI transaction classification failed; using existing parser results', {
        reason: error instanceof Error ? error.message : 'Unknown AI provider error',
      });
      return fallbackResult;
    } finally {
      if (requestKey && this.inFlight.get(requestKey) === request) {
        this.inFlight.delete(requestKey);
      }
    }
  }

  private async requestClassification(
    input: TransactionClassificationInput
  ): Promise<TransactionClassification | null> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error(`AI classification timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });

    try {
      const response = await Promise.race([
        this.fetcher(this.apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: CLASSIFICATION_INSTRUCTIONS },
              {
                role: 'user',
                content: JSON.stringify({
                  description: sanitizeDescription(input.description),
                  amount: input.amount,
                  type: input.type,
                  date: input.date instanceof Date ? input.date.toISOString() : input.date,
                  ...(input.merchant ? { parsedMerchant: sanitizeDescription(input.merchant) } : {}),
                }),
              },
            ],
          }),
        }),
        timeoutPromise,
      ]);

      if (!response.ok) {
        throw new Error(`AI provider returned HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      return typeof content === 'string' ? parseClassification(content) : null;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async readCache(key: string): Promise<TransactionClassification | null> {
    try {
      const value = await (this.cache ?? getCache()).get(this.cacheName(key));
      if (!value) return null;
      return parseClassification(value);
    } catch (error) {
      logger.warn('AI merchant cache read failed; continuing without cached classification', {
        reason: error instanceof Error ? error.message : 'Unknown cache error',
      });
      return null;
    }
  }

  private async writeCache(key: string, value: TransactionClassification): Promise<void> {
    try {
      await (this.cache ?? getCache()).set(this.cacheName(key), JSON.stringify(value), 'EX', 60 * 60 * 24 * 180);
    } catch (error) {
      logger.warn('AI merchant cache write failed; classification result was not cached', {
        reason: error instanceof Error ? error.message : 'Unknown cache error',
      });
    }
  }

  private cacheName(key: string): string {
    const digest = createHash('sha256').update(key).digest('hex');
    return `ai-transaction-classification:${digest}`;
  }
}

export const transactionClassificationService = new TransactionClassificationService();

const EXISTING_CATEGORY_ALIASES: Partial<Record<AITransactionCategory, string[]>> = {
  'Travel / Transport': ['Transport', 'Travel'],
  'Medical / Pharmacy': ['Health & Medical'],
  'Software / Digital Services': ['Subscriptions', 'Bills & Utilities'],
  'Personal Care': ['Salon & Grooming'],
  Electronics: ['Shopping'],
  'Banking / Fees': ['Other', 'ATM & Cash'],
  'Wallet / Transfer': ['Other', 'Friends & Family'],
  'Person-to-Person': ['Friends & Family'],
  'Salary / Income': ['Salary'],
  Refund: ['Other'],
  'Cash Withdrawal': ['ATM & Cash'],
  Uncategorized: ['Other'],
};

export function mapToExistingCategoryName(
  categories: Array<{ name: string }>,
  category: AITransactionCategory
): string | null {
  const exact = categories.find((candidate) => candidate.name.toLowerCase() === category.toLowerCase());
  if (exact) return exact.name;

  const aliases = EXISTING_CATEGORY_ALIASES[category] || [];
  for (const alias of aliases) {
    const match = categories.find((candidate) => candidate.name.toLowerCase() === alias.toLowerCase());
    if (match) return match.name;
  }

  return categories.find((candidate) => candidate.name.toLowerCase() === 'other')?.name || null;
}
