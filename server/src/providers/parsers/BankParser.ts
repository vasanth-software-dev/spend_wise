import { EmailMessage, ParsedTransaction, TransactionEmailParser, PaymentMethod } from '../../types/index.js';

export class BankParser implements TransactionEmailParser {
  public name = 'BankParser';

  canParse(email: EmailMessage): boolean {
    const text = `${email.sender} ${email.subject} ${email.snippet || ''}`.toLowerCase();
    const bankKeywords = [
      'hdfc', 'icici', 'sbi', 'axis', 'kotak', 'punjab national',
      'alerts@hdfcbank.net', 'alerts@icicibank.com', 'sbialerts', 'axisbank.com',
      'debited', 'credited', 'account has been debited', 'account has been credited',
    ];
    return bankKeywords.some((kw) => text.includes(kw));
  }

  parse(email: EmailMessage): ParsedTransaction | null {
    const content = `${email.subject}\n${email.snippet || ''}\n${email.bodyText}`;

    // Match amount
    const amountRegex = /(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
    const amountMatch = content.match(amountRegex);
    if (!amountMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return null;

    // Detect debited vs credited
    const isIncome = /(?:credited|deposited|refunded)\b/i.test(content) && !/(?:debited)\b/i.test(email.subject);
    const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

    // Payment method detection
    let paymentMethod: PaymentMethod = 'bank';
    if (/upi|vpa|google pay|phonepe|paytm/i.test(content)) {
      paymentMethod = 'upi';
    } else if (/debit card|pos|atm/i.test(content)) {
      paymentMethod = 'card';
    } else if (/net banking|neft|rtgs|imps/i.test(content)) {
      paymentMethod = 'bank';
    }

    // Extract merchant or info
    let merchant = 'Bank Transaction';
    const infoMatch = content.match(/(?:Info[:\s]+|towards\s+|at\s+|to\s+)([A-Za-z0-9\s&'./-]{2,30}?)(?:\s+(?:on|via|ref|bal|\.|\n))/i);
    if (infoMatch && infoMatch[1]) {
      merchant = infoMatch[1].replace(/^(UPI\/|POS\/|NEFT\/|IMPS\/)/i, '').trim();
    } else if (type === 'income' && /salary/i.test(content)) {
      merchant = 'Salary Credit';
    }

    // Reference number extraction
    let upiReference: string | undefined;
    let bankReference: string | undefined;

    // First check UPI/merchant/ref format (e.g. Info: UPI/TNEB/426899120943)
    const upiSlashMatch = content.match(/UPI\/[A-Za-z0-9._-]+\/([0-9]{10,16})/i);
    if (upiSlashMatch && upiSlashMatch[1]) {
      upiReference = upiSlashMatch[1].trim();
      paymentMethod = 'upi';
    } else {
      const refMatch = content.match(/(?:UPI Ref(?:\s*No)?|Ref No\.?|UTR|Txn No)[:\s]+([A-Za-z0-9]{8,22})/i);
      if (refMatch && refMatch[1]) {
        if (paymentMethod === 'upi') {
          upiReference = refMatch[1].trim();
        } else {
          bankReference = refMatch[1].trim();
        }
      }
    }

    let confidenceScore = 90;
    if (upiReference || bankReference) confidenceScore += 6;
    confidenceScore = Math.min(99, confidenceScore);

    return {
      amount,
      currency: 'INR',
      type,
      merchant,
      transactionDate: email.date || new Date(),
      upiReference,
      bankReference,
      paymentMethod,
      confidenceScore,
      notes: `Bank Alert: ${email.subject}`,
      sender: email.sender,
      rawDetails: { subject: email.subject, messageId: email.id },
    };
  }
}
