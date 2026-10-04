const fetch = globalThis.fetch;

const CLASSIFICATION_INSTRUCTIONS = `You are an expense transaction classification agent for an Indian personal expense tracker.
Analyze the complete bank/UPI transaction information.
Your job is to identify:
1. The clean merchant, business, service, or person's name.
2. The most appropriate expense category.

Allowed categories (use exactly one):
- Food & Dining
- Groceries
- Shopping
- Travel / Transport
- Medical / Pharmacy
- Bills & Utilities
- Rent
- Education
- Entertainment
- Subscriptions
- Software / Digital Services
- Personal Care
- Electronics
- Fuel
- Insurance
- Investments
- Banking / Fees
- Wallet / Transfer
- Person-to-Person
- Salary / Income
- Refund
- Cash Withdrawal
- Uncategorized

Examples:
INDIANRAILWAYS -> Indian Railways / Travel / Transport
RABIKRAJASNACKS -> Rabikraja Snacks / Food & Dining
ALTHAF BRIYANI -> Althaf Briyani / Food & Dining
FLIPKARTINTERNETPV -> Flipkart / Shopping

Return ONLY valid JSON with exactly these properties:
{"name":"Merchant or Person Name","category":"One allowed category"}
No markdown, explanation, comments, or additional text.`;

async function testClassification(model) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Set GROQ_API_KEY before running this script.');
  }
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  
  const testInputs = [
    { description: 'UPI/ALTHAF BRIYANI/REF492019/PAYMENT', amount: 350, type: 'expense' },
    { description: 'UPI/SARAVANA BHAVAN/CHETPET', amount: 240, type: 'expense' },
    { description: 'UPI/IOCL PETROL PUMP/4819', amount: 500, type: 'expense' },
    { description: 'UPI/RAMESH KUMAR/PERSONAL', amount: 1000, type: 'expense' }
  ];

  console.log('--- Testing model:', model, '---');
  for (const input of testInputs) {
    const start = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CLASSIFICATION_INSTRUCTIONS },
          { role: 'user', content: JSON.stringify(input) }
        ]
      })
    });
    const duration = Date.now() - start;
    const data = await res.json();
    console.log(`[${duration}ms]`, input.description, '->', data.choices?.[0]?.message?.content || data.error);
  }
}

async function run() {
  await testClassification('openai/gpt-oss-120b');
  console.log('\n--- Testing qwen ---');
  await testClassification('qwen/qwen3.8-27b');
}
run().catch(console.error);
