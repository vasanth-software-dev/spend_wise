import { EmailMessage, ParsedTransaction, TransactionEmailParser } from '../../types/index.js';

export class GPayParser implements TransactionEmailParser {
  public name = 'GooglePayParser';

  canParse(email: EmailMessage): boolean {
    const text = `${email.sender} ${email.subject} ${email.snippet || ''}`.toLowerCase();
    return (
      text.includes('google pay') ||
      text.includes('googlepay-noreply@google.com') ||
      text.includes('payments-noreply@google.com') ||
      (text.includes('paid to') && text.includes('google'))
    );
  }

  parse(email: EmailMessage): Promise<ParsedTransaction | null> {
    const content = `${email.subject}\n${email.snippet || ''}\n${email.bodyText}`;

    // Regex for amount: ₹ 500, Rs. 500, INR 500, INR 1,299.50
    const amountRegex = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i;
    const amountMatch = content.match(amountRegex);
    if (!amountMatch) return Promise.resolve(null);

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return Promise.resolve(null);

    // Detect type: paid/debited = expense, received/credited = income
    const isIncome = /(?:received|credited to|got)\b/i.test(email.subject) || /(?:received|credited)\b/i.test(content);
    const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

    // Extract Merchant / Beneficiary
    let merchant = 'Unknown Merchant';
    const paidToMatch = content.match(/(?:paid to|sent to|to)\s+([A-Za-z0-9\s&'.-]{2,30}?)(?:\s+(?:using|on|via|with|at|\.|\n))/i);
    if (paidToMatch && paidToMatch[1]) {
      merchant = paidToMatch[1].trim();
    } else {
      // Try from subject: "You paid ₹500 to Swiggy"
      const subjMatch = email.subject.match(/to\s+([A-Za-z0-9\s&'.-]{2,30})/i);
      if (subjMatch && subjMatch[1]) {
        merchant = subjMatch[1].trim();
      }
    }

    // Extract UPI Reference / Google Transaction ID
    let upiReference: string | undefined;
    const upiMatch = content.match(/(?:UPI transaction ID|UPI Ref(?:erence)?(?:\s*No)?|Ref No\.?|UTR)[:\s]+([0-9]{10,16})/i);
    if (upiMatch && upiMatch[1]) {
      upiReference = upiMatch[1].trim();
    }

    // Calculate confidence score
    let confidenceScore = 80;
    if (upiReference) confidenceScore += 10;
    if (merchant !== 'Unknown Merchant') confidenceScore += 5;
    if (content.toLowerCase().includes('google pay')) confidenceScore += 4;
    confidenceScore = Math.min(99, confidenceScore);

    return Promise.resolve({
      amount,
      currency: 'INR',
      type,
      merchant,
      transactionDate: email.date || new Date(),
      upiReference,
      paymentMethod: 'upi',
      confidenceScore,
      notes: `Parsed from Google Pay notification (${email.subject})`,
      sender: email.sender,
      rawDetails: { subject: email.subject, messageId: email.id },
    });
  }
}
