import { EmailMessage, ParsedTransaction, TransactionEmailParser, PaymentMethod } from '../../types/index.js';
import { predictCategoryName } from '../../utils/categoryPredictor.js';
import { aiClassificationService } from '../../services/AIClassificationService.js';

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
    const text = `${email.sender} ${email.subject} ${email.snippet || ''} ${email.bodyText || ''}`.toLowerCase();
    const bankKeywords = [
      'hdfc', 'icici', 'sbi', 'axis', 'kotak', 'punjab national', 'pnb',
      'idfc', 'indusind', 'canara', 'baroda', 'federal', 'yes bank', 'rbl',
      'alerts@hdfcbank.net', 'alerts@icicibank.com', 'sbialerts', 'axisbank.com',
      'debited', 'credited', 'spent', 'paid', 'transferred', 'withdrawn',
      'account has been debited', 'account has been credited',
      'account ending', 'card ending', 'a/c ending', 'acct ending',
      'bank alert', 'transaction alert', 'txn alert', 'statement',
    ];
    return bankKeywords.some((kw) => text.includes(kw));
  }

  parse(email: EmailMessage): Promise<ParsedTransaction | null> {
    const content = `${email.subject}\n${email.snippet || ''}\n${email.bodyText}`;

    // Match amount
    const amountRegex = /(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
    const amountMatch = content.match(amountRegex);
    if (!amountMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return null;

    // Ensure the email expresses an actual financial debit or credit transaction event
    const isActualTxn = /(?:debited|credited|deposited|refunded|spent|paid|withdrawn|transferred)\b/i.test(content);
    if (!isActualTxn) return null;

    // Reject credit card sales/approval advertisements, loan marketing, and gift promotions
    if (/(?:credit card is ready|apply for|pre-approved|loan offer|birthday gift|gift voucher|internship|booking confirmation)/i.test(content)) {
      return null;
    }

    // Detect debited vs credited
    const isIncome = /(?:credited|deposited|refunded)\b/i.test(content) && !/(?:debited|spent|paid)\b/i.test(email.subject);
    const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

    // Payment method detection
    let paymentMethod: PaymentMethod = 'bank';
    if (/upi|vpa|google pay|phonepe|paytm/i.test(content)) {
      paymentMethod = 'upi';
    } else if (/debit card|credit card|pos|atm/i.test(content)) {
      paymentMethod = 'card';
    } else if (/net banking|neft|rtgs|imps/i.test(content)) {
      paymentMethod = 'bank';
    }

    // Extract merchant or info
    let merchant = 'Bank Transaction';
    let extractedVpa: string | undefined;
    const senderMatch = content.match(/\bSender\s*:\s*([^\n(]{2,80}?)(?:\s*\(\s*VPA\s*:|\s*\n|$)/i);
    const vpaMatch = content.match(/\bVPA\s*:\s*([A-Za-z0-9._-]+@[A-Za-z0-9._-]+)/i);

    // HDFC UPI credit alert: "Sender: NAME (VPA: name@bank)".
    // Check this before generic "to ..." matching, which would otherwise pick up
    // "credited to your HDFC Bank account" as the merchant.
    if (senderMatch) {
      merchant = formatMerchantName(senderMatch[1]);
      if (vpaMatch) extractedVpa = vpaMatch[1];
    } else {
      // Priority 1: Check VPA with parenthesized merchant name, e.g., "towards VPA xyz@ybl (APOLLO PHARMACY)"
      const vpaParenMatch = content.match(/(?:towards|to)\s+VPA\s+([^\s(]+)(?:\s*\(([^)]+)\))?/i);
      if (vpaParenMatch) {
        extractedVpa = vpaParenMatch[1];
        if (vpaParenMatch[2] && vpaParenMatch[2].trim().length > 1) {
          merchant = formatMerchantName(vpaParenMatch[2]);
        } else if (vpaParenMatch[1]) {
          merchant = formatMerchantName(vpaParenMatch[1].split('@')[0]);
        }
      } else {
        // Priority 2: General info/towards/at pattern
        const infoMatch = content.match(/(?:Info[:\s]+|towards\s+|at\s+|to\s+|paid to\s+|for\s+)([A-Za-z0-9\s&'./-]{2,40}?)(?:\s+(?:on|via|ref|bal|\.|\n))/i);
        if (infoMatch && infoMatch[1]) {
          merchant = formatMerchantName(infoMatch[1]);
        } else if (type === 'income' && /salary/i.test(content)) {
          merchant = 'Salary Credit';
        }
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

    // Date extraction: e.g. "on 23-09-26", "Date: 23-09-26", or "on 23/09/2026"
    // along with optional time, e.g. "at 10:30:00", "at 10:30 AM", "10:30:00 hrs"
    let transactionDate: Date = email.date || new Date();

    const timeMatch = content.match(/(?:\bat\s+|time\s*:\s*|,\s*|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|hrs)?\b/i);
    const dateMatch = content.match(/(?:\bon\s+|\bDate\s*:\s*)(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/i);

    if (dateMatch) {
      let [_, dStr, mStr, yStr] = dateMatch;
      let year = parseInt(yStr, 10);
      if (year < 100) year += 2000;
      const month = parseInt(mStr, 10) - 1;
      const day = parseInt(dStr, 10);

      const baseTime = email.date && !isNaN(email.date.getTime()) ? email.date : new Date();

      if (timeMatch) {
        let h = parseInt(timeMatch[1], 10);
        const m = parseInt(timeMatch[2], 10);
        const s = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
        const meridian = timeMatch[4]?.toLowerCase();

        if (meridian === 'pm' && h < 12) h += 12;
        if (meridian === 'am' && h === 12) h = 0;

        if (h >= 0 && h < 24 && m >= 0 && m < 60) {
          const parsed = new Date(year, month, day, h, m, s);
          if (!isNaN(parsed.getTime())) {
            transactionDate = parsed;
          }
        }
      } else {
        // No explicit time in text: preserve the exact time of day from the email header
        const parsed = new Date(baseTime.getTime());
        parsed.setFullYear(year, month, day);
        if (!isNaN(parsed.getTime())) {
          transactionDate = parsed;
        }
      }
    }

    let confidenceScore = 92;
    if (upiReference || bankReference) confidenceScore += 5;
    if (merchant !== 'Bank Transaction') confidenceScore += 2;
    confidenceScore = Math.min(99, confidenceScore);

    let categoryHint = predictCategoryName(content, { merchant, vpa: extractedVpa });
    let aiMerchantName = merchant;
    let aiCategory: string | null = null;

    try {
      const aiInput = {
        description: content,
        amount,
        type: type === 'income' ? 'credit' as const : 'debit' as const,
        date: transactionDate.toISOString().split('T')[0],
        merchant,
        vpa: extractedVpa,
        sender: email.sender,
        subject: email.subject,
      };

      const aiResult = await aiClassificationService.classify(aiInput);
      if (aiResult) {
        aiMerchantName = aiResult.name;
        aiCategory = aiResult.category;
        categoryHint = aiCategory;
      }
    } catch (_) {
      // Fallback to existing prediction
    }

    return {
      amount,
      currency: 'INR',
      type,
      merchant: aiMerchantName,
      transactionDate,
      upiReference,
      bankReference,
      paymentMethod,
      confidenceScore,
      notes: `Bank Alert: ${email.subject}`,
      sender: email.sender,
      categoryHint,
      rawDetails: { subject: email.subject, messageId: email.id, categoryHint, vpa: extractedVpa, aiCategory, aiMerchant: aiMerchantName },
    };
  }
}
