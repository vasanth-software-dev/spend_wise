import { EmailMessage, ParsedTransaction, TransactionEmailParser } from '../../types/index.js';

export class PhonePeParser implements TransactionEmailParser {
  public name = 'PhonePeParser';

  canParse(email: EmailMessage): boolean {
    const text = `${email.sender} ${email.subject} ${email.snippet || ''}`.toLowerCase();
    return text.includes('phonepe') || text.includes('noreply@phonepe.com');
  }

  parse(email: EmailMessage): Promise<ParsedTransaction | null> {
    const content = `${email.subject}\n${email.snippet || ''}\n${email.bodyText}`;

    // Amount match
    const amountRegex = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i;
    const amountMatch = content.match(amountRegex);
    if (!amountMatch) return Promise.resolve(null);

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return Promise.resolve(null);

    const isIncome = /(?:received|credited|refund)\b/i.test(email.subject) || /(?:received from|credited with)\b/i.test(content);
    const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

    // Merchant / Payee
    let merchant = 'Unknown Merchant';
    const payeeMatch = content.match(/(?:Paid to|Sent to|To)\s+([A-Za-z0-9\s&'.-]{2,30}?)(?:\s+(?:from|using|on|via|with|\.|\n))/i);
    if (payeeMatch && payeeMatch[1]) {
      merchant = payeeMatch[1].trim();
    } else {
      const subjMatch = email.subject.match(/(?:to|for)\s+([A-Za-z0-9\s&'.-]{2,30})/i);
      if (subjMatch && subjMatch[1]) {
        merchant = subjMatch[1].trim();
      }
    }

    // UTR / Transaction ID (prioritize 12-digit UTR if present)
    let upiReference: string | undefined;
    const utrExplicitMatch = content.match(/(?:UTR(?: No\.?)?|UPI Ref(?:erence)?(?:\s*No\.?)?)[:\s]+([0-9]{12})/i);
    if (utrExplicitMatch && utrExplicitMatch[1]) {
      upiReference = utrExplicitMatch[1].trim();
    } else {
      const generalMatch = content.match(/(?:UTR(?: No\.?)?|UPI Ref(?:erence)?|Txn ID)[:\s]+([A-Za-z0-9]{10,22})/i);
      if (generalMatch && generalMatch[1]) {
        upiReference = generalMatch[1].trim();
      }
    }

    let confidenceScore = 85;
    if (upiReference) confidenceScore += 10;
    if (merchant !== 'Unknown Merchant') confidenceScore += 4;
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
      notes: `Parsed from PhonePe notification (${email.subject})`,
      sender: email.sender,
      rawDetails: { subject: email.subject, messageId: email.id },
    });
  }
}
