import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface AIClassificationInput {
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  date: string;
  merchant?: string;
  vpa?: string;
  sender?: string;
  subject?: string;
}

export interface AIClassificationResult {
  name: string;
  category: string;
}

const ALLOWED_CATEGORIES = [
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
];

const SYSTEM_PROMPT = `You are an expense transaction classification agent for an Indian personal expense tracker.

Analyze the complete bank/UPI transaction information.

Your job is to identify:

The clean merchant, business, service, or person's name.

The most appropriate expense category.

Use the complete transaction context and your knowledge of merchants/businesses.

Do not rely only on simple keyword matching.

Allowed categories

Use ONLY one of these categories:

Food & Dining
Groceries
Shopping
Travel / Transport
Medical / Pharmacy
Bills & Utilities
Rent
Education
Entertainment
Subscriptions
Software / Digital Services
Personal Care
Electronics
Fuel
Insurance
Investments
Banking / Fees
Wallet / Transfer
Person-to-Person
Salary / Income
Refund
Cash Withdrawal
Uncategorized

Never create a new category.

Merchant/name extraction

Extract the actual merchant, business, service, or person's name.

Bank descriptions may contain:

UPI IDs
@handles
IFSC codes
Bank codes
Transaction IDs
Reference numbers
Razorpay
PayU
Paytm
Airtel Payments
PhonePe
Google Pay
UPIINTENT
NOREMARK
PAYMENT
PAY
WALLETTOPUP

Ignore these when they are payment-processing or transaction metadata.

Do not use the payment gateway as the merchant when the real merchant is present.

Clean ALL CAPS names into readable names.

Preserve well-known brand spelling.

Examples:

INDIANRAILWAYS
→ Indian Railways

RABIKRAJASNACKS
→ Rabikraja Snacks

ABHIBUS
→ AbhiBus

OMSRISARAVANBAVA
→ Om Sri Saravanabava

FLIPKARTINTERNETPV
→ Flipkart

APOLLOPHARMACY
→ Apollo Pharmacy

BALA CATERERS
→ Bala Caterers

PAYZAPPWALLET
→ PayZapp Wallet

MMINDIAMEDICALSER
→ M M India Medicals

YUVARAJ
→ N Yuvaraj

KARPAGAVALLI
→ Karpagavalli V

SARATH ENTERPRISES
→ Sarath Enterprises

MALINI
→ Malini V

Payment gateway handling

Do NOT classify the payment gateway as the merchant.

Example:

FLIPKART...PAYU@AXISBANK

Return:

{
"name": "Flipkart",
"category": "Shopping"
}

Example:

APOLLOPHARMACY...PAYTM

Return:

{
"name": "Apollo Pharmacy",
"category": "Medical / Pharmacy"
}

Example:

ABHIBUS...RAZORPAY

Return:

{
"name": "AbhiBus",
"category": "Travel / Transport"
}

The payment processor is not the expense merchant.

Person detection

If the transaction is clearly a payment to an individual, use:

Person-to-Person

Examples:

ABIRAMI P
→ Abirami P
→ Person-to-Person

N YUVARAJ
→ N Yuvaraj
→ Person-to-Person

KARPAGAVALLI V
→ Karpagavalli V
→ Person-to-Person

MALINI V
→ Malini V
→ Person-to-Person

Do not assume every name is a person.

If the name clearly represents a business, classify it according to the business type.

Example:

BALA CATERERS
→ Bala Caterers
→ Food & Dining

SARATH ENTERPRISES
→ Sarath Enterprises
→ Shopping

Wallet handling

If the transaction explicitly represents a wallet top-up:

WALLETTOPUP

classify as:

Wallet / Transfer

Example:

PAYZAPPWALLET
→ PayZapp Wallet
→ Wallet / Transfer

Do not treat wallet top-ups as the final purchase expense.

Merchant/category examples

INDIANRAILWAYS
→ Indian Railways
→ Travel / Transport

RABIKRAJASNACKS
→ Rabikraja Snacks
→ Food & Dining

ABHIBUS
→ AbhiBus
→ Travel / Transport

OMSRISARAVANBAVA
→ Om Sri Saravanabava
→ Food & Dining

FLIPKART
→ Flipkart
→ Shopping

APOLLOPHARMACY
→ Apollo Pharmacy
→ Medical / Pharmacy

BALA CATERERS
→ Bala Caterers
→ Food & Dining

PAYZAPPWALLET
→ PayZapp Wallet
→ Wallet / Transfer

MMINDIAMEDICAL
→ M M India Medicals
→ Medical / Pharmacy

YUVARAJ
→ N Yuvaraj
→ Person-to-Person

KARPAGAVALLI
→ Karpagavalli V
→ Person-to-Person

SARATH ENTERPRISES
→ Sarath Enterprises
→ Shopping

MALINI
→ Malini V
→ Person-to-Person

Unknown merchants

If the merchant cannot be identified with confidence:

Use the best readable merchant/person name available.

Do not invent a name.

Use Uncategorized if the category cannot reasonably be determined.

Output

Return ONLY valid JSON:

{
"name": "Merchant or Person Name",
"category": "One allowed category"
}

No markdown.
No explanation.
No comments.
No additional text.`;

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

interface CacheEntry {
  result: AIClassificationResult;
  timestamp: number;
}

class AIClassificationService {
  private cache = new Map<string, CacheEntry>();
  private apiKey: string | undefined;
  private model: string = 'gpt-4o-mini';
  private enabled: boolean = true;

  constructor() {
    this.apiKey = env.OPENAI_API_KEY || env.AI_API_KEY;
    this.enabled = !!this.apiKey;
    
    if (!this.enabled) {
      logger.warn('AI Classification Service: No API key found (OPENAI_API_KEY or AI_API_KEY). AI classification disabled, using fallback only.');
    }
  }

  private normalizeCacheKey(input: AIClassificationInput): string {
    const desc = input.description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const parts = desc.split(' ');
    const merchantPart = parts.slice(0, 5).join(' ');
    
    return `${input.type}:${merchantPart}:${Math.round(input.amount)}`;
  }

  private getCached(key: string): AIClassificationResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.result;
  }

  private setCache(key: string, result: AIClassificationResult): void {
    this.cache.set(key, { result, timestamp: Date.now() });
    
    if (this.cache.size > 10000) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < entries.length - 5000; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  private validateResult(result: unknown): AIClassificationResult | null {
    if (!result || typeof result !== 'object') return null;
    
    const obj = result as Record<string, unknown>;
    
    if (typeof obj.name !== 'string' || !obj.name.trim()) return null;
    if (typeof obj.category !== 'string' || !obj.category.trim()) return null;
    
    if (!ALLOWED_CATEGORIES.includes(obj.category)) {
      logger.warn(`AI Classification: Invalid category "${obj.category}", defaulting to Uncategorized`);
      return { name: obj.name.trim(), category: 'Uncategorized' };
    }
    
    return {
      name: obj.name.trim(),
      category: obj.category.trim(),
    };
  }

  private buildUserPrompt(input: AIClassificationInput): string {
    const parts = [
      `Description: ${input.description}`,
      `Amount: ${input.amount}`,
      `Type: ${input.type}`,
      `Date: ${input.date}`,
    ];
    
    if (input.merchant) parts.push(`Extracted Merchant: ${input.merchant}`);
    if (input.vpa) parts.push(`VPA: ${input.vpa}`);
    if (input.sender) parts.push(`Sender: ${input.sender}`);
    if (input.subject) parts.push(`Subject: ${input.subject}`);
    
    return parts.join('\n');
  }

  async classify(input: AIClassificationInput): Promise<AIClassificationResult | null> {
    if (!this.enabled || !this.apiKey) {
      return null;
    }

    const cacheKey = this.normalizeCacheKey(input);
    const cached = this.getCached(cacheKey);
    if (cached) {
      logger.debug(`AI Classification: Cache hit for "${cacheKey}"`);
      return cached;
    }

    try {
      const userPrompt = this.buildUserPrompt(input);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.warn(`AI Classification API error: ${response.status} ${errorText}`);
        return null;
      }
      
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        logger.warn('AI Classification: Empty response content');
        return null;
      }
      
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        logger.warn(`AI Classification: Failed to parse JSON response: ${content}`);
        return null;
      }
      
      const validated = this.validateResult(parsed);
      if (!validated) {
        logger.warn('AI Classification: Validation failed');
        return null;
      }
      
      this.setCache(cacheKey, validated);
      logger.debug(`AI Classification: Success for "${cacheKey}" -> ${validated.name} / ${validated.category}`);
      
      return validated;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('AI Classification: Request timeout');
      } else {
        logger.warn(`AI Classification: Error - ${(error as Error).message}`);
      }
      return null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

export const aiClassificationService = new AIClassificationService();