import { EmailMessage, ParsedTransaction, TransactionEmailParser } from '../../types/index.js';

export class GenericUPIParser implements TransactionEmailParser {
  public name = 'GenericUPIParser';

  canParse(email: EmailMessage): boolean {
    const text = `${email.subject} ${email.snippet || ''} ${email.bodyText}`.toLowerCase();
    return (
      text.includes('upi') ||
      text.includes('vpa') ||
      text.includes('bhim') ||
      text.includes('amazon pay') ||
      text.includes('cred')
    );
  }

  parse(email: EmailMessage): ParsedTransaction | null {
    const content = `${email.subject}\n${email.snippet || ''}\n${email.bodyText}`;

    // Regex for amount: ₹ 500, Rs. 500, INR 500
    const amountRegex = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i;
    const amountMatch = content.match(amountRegex);
    if (!amountMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return null;

    const isIncome = /(?:received|credited|cashback|refund)\b/i.test(content);
    const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

    let merchant = 'UPI Payee';
    const payeeMatch = content.match(/(?:to|towards|at|for|paid to)\s+([A-Za-z0-9\s&'.-]{2,30}?)(?:\s+(?:on|via|using|with|\.|\n))/i);
    if (payeeMatch && payeeMatch[1]) {
      merchant = payeeMatch[1].trim();
    }

    let upiReference: string | undefined;
    const refMatch = content.match(/(?:UPI Ref|UTR|Ref No|Txn ID)[:\s]+([A-Za-z0-9]{8,22})/i);
    if (refMatch && refMatch[1]) {
      upiReference = refMatch[1].trim();
    }

    const confidenceScore = upiReference ? 75 : 60;

    return {
      amount,
      currency: 'INR',
      type,
      merchant,
      transactionDate: email.date || new Date(),
      upiReference,
      paymentMethod: 'upi',
      confidenceScore,
      notes: `Generic UPI: ${email.subject}`,
      sender: email.sender,
      rawDetails: { subject: email.subject, messageId: email.id },
    };
  }
}
