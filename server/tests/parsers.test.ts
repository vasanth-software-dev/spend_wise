import { describe, it, expect } from 'vitest';
import { GPayParser } from '../src/providers/parsers/GPayParser.js';
import { PhonePeParser } from '../src/providers/parsers/PhonePeParser.js';
import { BankParser } from '../src/providers/parsers/BankParser.js';
import { EmailParserRegistry } from '../src/providers/parsers/EmailParserRegistry.js';
import { EmailMessage } from '../src/types/index.js';

describe('UPI & Email Parser Framework', () => {
  const gpayParser = new GPayParser();
  const phonepeParser = new PhonePeParser();
  const bankParser = new BankParser();
  const registry = new EmailParserRegistry();

  it('correctly parses Google Pay payment notification', () => {
    const email: EmailMessage = {
      id: 'gpay-msg-1',
      sender: 'payments-noreply@google.com',
      subject: 'You paid ₹500 to Swiggy using Google Pay',
      date: new Date('2026-09-25T14:30:00Z'),
      snippet: 'You paid ₹500.00 to Swiggy. UPI transaction ID: 426819284192',
      bodyText: `Dear User,
You paid ₹500.00 to Swiggy.
UPI transaction ID: 426819284192
Google transaction ID: CICAgKDL849
Payment method: HDFC Bank A/C XX1234`,
    };

    expect(gpayParser.canParse(email)).toBe(true);
    const parsed = gpayParser.parse(email);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(500);
    expect(parsed?.merchant).toBe('Swiggy');
    expect(parsed?.type).toBe('expense');
    expect(parsed?.upiReference).toBe('426819284192');
    expect(parsed?.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it('correctly parses PhonePe transaction email', () => {
    const email: EmailMessage = {
      id: 'phonepe-msg-1',
      sender: 'noreply@phonepe.com',
      subject: 'Transaction Successful! Paid ₹1,299 to Amazon',
      date: new Date('2026-09-26T10:15:00Z'),
      snippet: 'Your payment of ₹1,299 to Amazon Pay was successful.',
      bodyText: `Hi Vasanth,
Your payment of ₹1,299 to Amazon Pay was successful.
Txn ID: T240926123456789
UTR: 426811209384
Debited from: SBI **5678`,
    };

    expect(phonepeParser.canParse(email)).toBe(true);
    const parsed = phonepeParser.parse(email);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(1299);
    expect(parsed?.merchant).toContain('Amazon');
    expect(parsed?.type).toBe('expense');
    expect(parsed?.upiReference).toBe('426811209384');
    expect(parsed?.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it('correctly parses HDFC Bank debit alert email', () => {
    const email: EmailMessage = {
      id: 'hdfc-msg-1',
      sender: 'alerts@hdfcbank.net',
      subject: 'Alert: Your HDFC Bank A/C has been debited',
      date: new Date('2026-09-25T18:00:00Z'),
      snippet: 'Your A/C XX1234 has been debited by INR 1,850.00 on 25-Sep-26 towards Electricity Bill. Info: UPI/TNEB/426899120943',
      bodyText: `Dear Customer,
Your A/C XX1234 has been debited by INR 1,850.00 on 25-Sep-26 towards Electricity Bill.
Info: UPI/TNEB/426899120943.
Available Balance: INR 1,24,500.00.`,
    };

    expect(bankParser.canParse(email)).toBe(true);
    const parsed = bankParser.parse(email);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(1850);
    expect(parsed?.type).toBe('expense');
    expect(parsed?.upiReference).toBe('426899120943');
    expect(parsed?.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it('uses Registry to parse and rank highest confidence result', () => {
    const email: EmailMessage = {
      id: 'reg-msg-1',
      sender: 'payments-noreply@google.com',
      subject: 'You paid ₹450 to Swiggy using Google Pay',
      date: new Date('2026-09-25T14:30:00Z'),
      snippet: 'You paid ₹450.00 to Swiggy. UPI transaction ID: 426819284192',
      bodyText: 'UPI transaction ID: 426819284192',
    };

    const best = registry.parse(email);
    expect(best).not.toBeNull();
    expect(best?.amount).toBe(450);
    expect(best?.upiReference).toBe('426819284192');
  });
});
