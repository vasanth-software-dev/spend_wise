import { EmailMessage, ParsedTransaction, TransactionEmailParser } from '../../types/index.js';

export class PaytmParser implements TransactionEmailParser {
  public name = 'PaytmParser';

  canParse(email: EmailMessage): boolean {
    const text = `${email.sender} ${email.subject} ${email.snippet || ''}`.toLowerCase();
    return text.includes('paytm') || text.includes('no-reply@paytm.com');
  }

  parse(email: EmailMessage): Promise<ParsedTransaction | null> {
    const content = `${email.subject}\n${email.snippet || ''}\n${email.bodyText}`;

    const amountRegex = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i;
    const amountMatch = content.match(amountRegex);
    if (!amountMatch) return Promise.resolve(null);

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return Promise.resolve(null);

    const isIncome = /(?:received|cashback|refund|credited)\b/i.test(email.subject) || /(?:cashback credited|money added)\b/i.test(content);
    const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

    let merchant = 'Paytm Merchant';
    const merchantMatch = content.match(/(?:Paid to|Sent to|Paid for|at)\s+([A-Za-z0-9\s&'.-]{2,30}?)(?:\s+(?:from|using|on|via|\.|\n))/i);
    if (merchantMatch && merchantMatch[1]) {
      merchant = merchantMatch[1].trim();
    } else {
      const subjMatch = email.subject.match(/(?:to|for)\s+([A-Za-z0-9\s&'.-]{2,30})/i);
      if (subjMatch && subjMatch[1]) {
        merchant = subjMatch[1].trim();
      }
    }

    let upiReference: string | undefined;
    const utrMatch = content.match(/(?:UPI Ref(?:erence)?|Txn ID|Order ID)[:\s]+([A-Za-z0-9]{10,24})/i);
    if (utrMatch && utrMatch[1]) {
      upiReference = utrMatch[1].trim();
    }

    let confidenceScore = 82;
    if (upiReference) confidenceScore += 10;
    if (merchant !== 'Paytm Merchant') confidenceScore += 5;
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
      notes: `Parsed from Paytm notification (${email.subject})`,
      sender: email.sender,
      rawDetails: { subject: email.subject, messageId: email.id },
    });
  }
}
