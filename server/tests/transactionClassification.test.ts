import { describe, expect, it, vi } from 'vitest';
import {
  AI_TRANSACTION_CATEGORIES,
  mapToExistingCategoryName,
  TransactionClassificationService,
  TransactionClassificationInput,
} from '../src/services/TransactionClassificationService.js';

const memoryCache = () => {
  const entries = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => entries.get(key) || null),
    set: vi.fn(async (key: string, value: string) => {
      entries.set(key, value);
      return 'OK';
    }),
  };
};

function createService(
  fetcher: typeof fetch,
  cache = memoryCache(),
  timeoutMs = 100
) {
  return new TransactionClassificationService({
    apiKey: 'test-key',
    apiUrl: 'https://ai.example.test/v1/chat/completions',
    model: 'test-model',
    timeoutMs,
    cache,
    fetcher,
  });
}

function jsonResponse(classification: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(classification) } }],
    }),
  } as Response;
}

function makeInput(
  merchant: string,
  description = `UPI-${merchant}-PAYMENT`
): TransactionClassificationInput {
  return {
    description,
    amount: 281.8,
    type: 'expense',
    date: '2026-09-17',
    merchant,
  };
}

describe('TransactionClassificationService', () => {
  const examples = [
    ['INDIANRAILWAYS', 'Indian Railways', 'Travel / Transport', '17/09/26 UPI-INDIANRAILWAYS-BDPG2.IR@SBI-SBIN0016209-122437378610-NOREMARK'],
    ['ABHIBUS', 'AbhiBus', 'Travel / Transport', 'UPI-ABHIBUS-ABHIBUS586028.RZP@RXAIRTEL-PAYVIARAZORPAY'],
    ['FLIPKARTINTERNETPV', 'Flipkart', 'Shopping', 'UPI-FLIPKARTINTERNETPV-FLIPKART1247444.PAYU@AXISBANK'],
    ['APOLLOPHARMACY', 'Apollo Pharmacy', 'Medical / Pharmacy', 'UPI-APOLLOPHARMACY-APOLLOPHARMACYTNPL@YBL-PAYTM'],
    ['MMINDIAMEDICALS', 'M M India Medicals', 'Medical / Pharmacy'],
    ['BALA CATERERS', 'Bala Caterers', 'Food & Dining'],
    ['ABIRAMI P', 'Abirami P', 'Person-to-Person'],
    ['N YUVARAJ', 'N Yuvaraj', 'Person-to-Person'],
    ['KARPAGAVALLI V', 'Karpagavalli V', 'Person-to-Person'],
    ['SARATH ENTERPRISES', 'Sarath Enterprises', 'Shopping'],
    ['MALINI V', 'Malini V', 'Person-to-Person'],
  ] as const;

  it.each(examples)('classifies %s as %s / %s', async (merchant, name, category, description) => {
    const fetcher = vi.fn(async () => jsonResponse({ name, category }));
    const service = createService(fetcher as typeof fetch);

    const result = await service.classify(makeInput(merchant, description || `UPI-${merchant}-PAYMENT`), {
      name: merchant,
      category: 'Other',
    });

    expect(result).toEqual({ name, category });
    expect(AI_TRANSACTION_CATEGORIES).toContain(result.category);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('classifies a PayZapp wallet top-up without reusing a merchant purchase category', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ name: 'PayZapp Wallet', category: 'Shopping' }));
    const service = createService(fetcher as typeof fetch);

    const result = await service.classify(
      makeInput('PAYZAPPWALLET', 'POS...MUMBAIPAYZAPPWALLET top-up'),
      { name: 'PayZapp Wallet', category: 'Bills & Utilities' }
    );

    expect(result).toEqual({ name: 'PayZapp Wallet', category: 'Wallet / Transfer' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses Uncategorized for an unknown merchant whose category is unknown', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ name: 'Qrxz Services', category: 'Uncategorized' }));
    const service = createService(fetcher as typeof fetch);

    const result = await service.classify(makeInput('QRXZ SERVICES'), {
      name: 'QRXZ SERVICES',
      category: 'Other',
    });

    expect(result).toEqual({ name: 'Qrxz Services', category: 'Uncategorized' });
  });

  it.each(['not-json', '{"name":"Merchant","category":"New Category"}'])(
    'falls back to parser values for invalid AI output %s',
    async (content) => {
      const fetcher = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content } }] }),
      }) as Response);
      const service = createService(fetcher as typeof fetch);

      const result = await service.classify(makeInput('BALA CATERERS'), {
        name: 'Bala Caterers',
        category: 'Food & Dining',
      });

      expect(result).toEqual({ name: 'Bala Caterers', category: 'Food & Dining' });
    }
  );

  it('uses parser values when the API key is missing', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ name: 'Flipkart', category: 'Shopping' }));
    const service = new TransactionClassificationService({
      apiKey: '',
      cache: memoryCache(),
      fetcher: fetcher as typeof fetch,
    });

    const result = await service.classify(makeInput('FLIPKART'), {
      name: 'Flipkart',
      category: 'Shopping',
    });

    expect(result).toEqual({ name: 'Flipkart', category: 'Shopping' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not reuse merchant-only cache entries for income/refund context', async () => {
    const cache = memoryCache();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ name: 'Flipkart', category: 'Shopping' }))
      .mockResolvedValueOnce(jsonResponse({ name: 'Flipkart', category: 'Refund' }));
    const service = createService(fetcher as typeof fetch, cache);

    await service.classify(makeInput('FLIPKART'), { name: 'Flipkart', category: 'Shopping' });
    const refund = await service.classify(
      { ...makeInput('FLIPKART'), type: 'income', description: 'FLIPKART REFUND' },
      { name: 'Flipkart', category: 'Shopping' }
    );

    expect(refund).toEqual({ name: 'Flipkart', category: 'Refund' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not expose full account or card identifiers in the AI prompt', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ name: 'Indian Railways', category: 'Travel / Transport' }));
    const service = createService(fetcher as typeof fetch);

    const input = makeInput(
      'A/C number 1234567890123456',
      'A/C number 1234567890123456 UPI-INDIANRAILWAYS-123456789012'
    );

    await service.classify(input, { name: 'Indian Railways', category: 'Travel / Transport' });

    const request = JSON.parse(String(fetcher.mock.calls[0][1]?.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(JSON.stringify(request.messages)).not.toContain('1234567890123456');
    expect(request.messages[1].content).toContain('[REDACTED');
  });

  it('falls back when the AI provider fails', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network unavailable');
    });
    const service = createService(fetcher as typeof fetch);

    const result = await service.classify(makeInput('ABHIBUS'), {
      name: 'AbhiBus',
      category: 'Transport',
    });

    expect(result).toEqual({ name: 'AbhiBus', category: 'Travel / Transport' });
  });

  it('falls back when the AI provider times out', async () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
    const service = createService(fetcher as typeof fetch, memoryCache(), 10);

    const result = await service.classify(makeInput('FLIPKART'), {
      name: 'Flipkart',
      category: 'Shopping',
    });

    expect(result).toEqual({ name: 'Flipkart', category: 'Shopping' });
  });

  it('reuses a cached classification for normalized merchant variants', async () => {
    const cache = memoryCache();
    const fetcher = vi.fn(async () => jsonResponse({ name: 'Flipkart', category: 'Shopping' }));
    const service = createService(fetcher as typeof fetch, cache);

    await service.classify(makeInput('FLIPKART'), { name: 'FLIPKART', category: 'Shopping' });
    const next = await service.classify(
      makeInput('FLIPKARTINTERNETPV'),
      { name: 'FLIPKARTINTERNETPV', category: 'Shopping' }
    );

    expect(next).toEqual({ name: 'Flipkart', category: 'Shopping' });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(cache.set).toHaveBeenCalledOnce();
  });

  it('maps AI categories onto existing application categories without creating new ones', () => {
    const categories = [
      { name: 'Transport' },
      { name: 'Health & Medical' },
      { name: 'Friends & Family' },
      { name: 'Other' },
    ];

    expect(mapToExistingCategoryName(categories, 'Travel / Transport')).toBe('Transport');
    expect(mapToExistingCategoryName(categories, 'Medical / Pharmacy')).toBe('Health & Medical');
    expect(mapToExistingCategoryName(categories, 'Person-to-Person')).toBe('Friends & Family');
    expect(mapToExistingCategoryName(categories, 'Wallet / Transfer')).toBe('Other');
  });
});
