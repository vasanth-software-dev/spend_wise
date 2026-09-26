import { EmailMessage, ParsedTransaction, TransactionEmailParser, PaymentMethod } from '../../types/index.js';
import { predictCategoryName } from '../../utils/categoryPredictor.js';

function formatMerchantName(raw: string): string {
  const cleaned = raw
    .replace(/^(UPI\/|POS\/|NEFT\/|IMPS\/|VPA\s+)/i, '')
    .replace(/[._-]+/g, ' ')
    .trim();

  if (!cleaned) return 'Bank Transaction';

  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

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

    // Priority 1: Check VPA with parenthesized merchant name, e.g., "towards VPA xyz@ybl (APOLLO PHARMACY)"
    const vpaParenMatch = content.match(/(?:towards|to)\s+VPA\s+([^\s(]+)(?:\s*\(([^)]+)\))?/i);
    if (vpaParenMatch) {
      if (vpaParenMatch[2] && vpaParenMatch[2].trim().length > 1) {
        merchant = formatMerchantName(vpaParenMatch[2]);
      } else if (vpaParenMatch[1]) {
        merchant = formatMerchantName(vpaParenMatch[1].split('@')[0]);
      }
    } else {
      // Priority 2: General info/towards/at pattern
      const infoMatch = content.match(/(?:Info[:\s]+|towards\s+|at\s+|to\s+)([A-Za-z0-9\s&'./-]{2,40}?)(?:\s+(?:on|via|ref|bal|\.|\n))/i);
      if (infoMatch && infoMatch[1]) {
        merchant = formatMerchantName(infoMatch[1]);
      } else if (type === 'income' && /salary/i.test(content)) {
        merchant = 'Salary Credit';
      }
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
      const refMatch = content.match(/(?:UPI(?:\s+transaction)?\s+ref(?:erence)?(?:\s*no\.?)?|Ref(?:\s*No\.?)?|UTR|Txn\s*No\.?)[:\s]+([A-Za-z0-9]{8,22})/i);
      if (refMatch && refMatch[1]) {
        if (paymentMethod === 'upi') {
          upiReference = refMatch[1].trim();
        } else {
          bankReference = refMatch[1].trim();
        }
      }
    }

    // Date extraction: e.g. "on 23-09-26" or "on 23/09/2026"
    let transactionDate: Date = email.date || new Date();
    const dateMatch = content.match(/\bon\s+(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/i);
    if (dateMatch) {
      let [_, dStr, mStr, yStr] = dateMatch;
      let year = parseInt(yStr, 10);
      if (year < 100) year += 2000;
      const month = parseInt(mStr, 10) - 1;
      const day = parseInt(dStr, 10);
      const parsedDate = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(parsedDate.getTime())) {
        transactionDate = parsedDate;
      }
    }

    let confidenceScore = 92;
    if (upiReference || bankReference) confidenceScore += 5;
    if (merchant !== 'Bank Transaction') confidenceScore += 2;
    confidenceScore = Math.min(99, confidenceScore);

    const categoryHint = predictCategoryName(`${merchant} ${content}`);

    return {
      amount,
      currency: 'INR',
      type,
      merchant,
      transactionDate,
      upiReference,
      bankReference,
      paymentMethod,
      confidenceScore,
      notes: `Bank Alert: ${email.subject}`,
      sender: email.sender,
      categoryHint,
      rawDetails: { subject: email.subject, messageId: email.id, categoryHint },
    };
  }
}
