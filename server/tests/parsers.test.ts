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

  it('correctly parses Google Pay payment notification', async () => {
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
    const parsed = await gpayParser.parse(email);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(500);
    expect(parsed?.merchant).toBe('Swiggy');
    expect(parsed?.type).toBe('expense');
    expect(parsed?.upiReference).toBe('426819284192');
    expect(parsed?.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it('correctly parses PhonePe transaction email', async () => {
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
    const parsed = await phonepeParser.parse(email);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(1299);
    expect(parsed?.merchant).toContain('Amazon');
    expect(parsed?.type).toBe('expense');
    expect(parsed?.upiReference).toBe('426811209384');
    expect(parsed?.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it('correctly parses HDFC Bank debit alert email', async () => {
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
    const parsed = await bankParser.parse(email);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(1850);
    expect(parsed?.type).toBe('expense');
    expect(parsed?.upiReference).toBe('426899120943');
    expect(parsed?.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it('correctly parses an HDFC UPI credit alert with sender and Date fields', async () => {
    const email: EmailMessage = {
      id: 'hdfc-credit-msg-1',
      sender: 'alerts@hdfcbank.net',
      subject: 'HDFC Bank transaction notification',
      date: new Date('2026-09-26T18:00:00Z'),
      snippet: 'Rs.1.00 has been successfully credited to your HDFC Bank account ending in 7079.',
      bodyText: `Dear Customer,

Greetings from HDFC Bank!

We're writing to inform you that Rs.1.00 has been successfully credited to your HDFC Bank account ending in 7079.

Transaction Details:
a. Date: 26-09-26
b. Sender: ABIRAMI P (VPA: abirami24011998@oksbi)
c. UPI Reference No.: 626938962830`,
    };

    const parsed = await bankParser.parse(email);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(1);
    expect(parsed?.type).toBe('income');
    expect(parsed?.merchant).toBe('Abirami P');
    expect(parsed?.upiReference).toBe('626938962830');
    expect(parsed?.transactionDate.toISOString().slice(0, 10)).toBe('2026-09-26');
  });

  it('preserves exact email time for debit alert without hardcoding 12:00 PM', async () => {
    const email: EmailMessage = {
      id: 'flipkart-msg-1',
      sender: 'HDFC Bank InstaAlerts <alerts@hdfcbank.bank.in>',
      subject: '❗ You have done a UPI txn. Check details!',
      date: new Date('2026-09-27T03:20:04.000Z'),
      snippet: 'Dear Customer, Greetings from HDFC Bank! Rs.1289.00 is debited from your account ending 7079 towards VPA flipkart1.payu@hdfcbank (FLIPKART PAYMENTS) on 27-09-26. UPI transaction reference no.: 085003279578',
      bodyText: `Dear Customer,
Greetings from HDFC Bank!
Rs.1289.00 is debited from your account ending 7079 towards VPA flipkart1.payu@hdfcbank (FLIPKART PAYMENTS) on 27-09-26.
UPI transaction reference no.: 085003279578.`,
    };

    const parsed = await bankParser.parse(email);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(1289);
    expect(parsed?.merchant).toBe('Flipkart Payments');
    // Ensure time was preserved from email header and not hardcoded to 12:00 PM (06:30 UTC)
    expect(parsed?.transactionDate.getTime()).toBe(new Date('2026-09-27T03:20:04.000Z').getTime());
  });

  it('uses Registry to parse and rank highest confidence result', async () => {
    const email: EmailMessage = {
      id: 'reg-msg-1',
      sender: 'payments-noreply@google.com',
      subject: 'You paid ₹450 to Swiggy using Google Pay',
      date: new Date('2026-09-25T14:30:00Z'),
      snippet: 'You paid ₹450.00 to Swiggy. UPI transaction ID: 426819284192',
      bodyText: 'UPI transaction ID: 426819284192',
    };

    const best = await registry.parse(email);
    expect(best).not.toBeNull();
    expect(best?.amount).toBe(450);
    expect(best?.upiReference).toBe('426819284192');
  });

  it('rejects unwanted marketing, job alerts, loan/card offers, and travel booking confirmations', async () => {
    const unwantedEmails: EmailMessage[] = [
      {
        id: 'unwanted-1',
        sender: 'HDFC Bank <information@mailers.hdfcbank.bank.in>',
        subject: 'Vasanth, your birthday gift is waiting 🎂',
        date: new Date(),
        snippet: 'Celebrate your birthday with exclusive vouchers up to ₹2,000 Off.',
        bodyText: 'Your birthday gift is waiting. Get ₹2,000 Off today.',
      },
      {
        id: 'unwanted-2',
        sender: 'Indeed <donotreply@match.indeed.com>',
        subject: 'Credit Manager @ PARIKA INVESTMENT',
        date: new Date(),
        snippet: 'Job opening: Credit Manager @ PARIKA INVESTMENT. Salary: ₹4 Lakh per annum.',
        bodyText: 'Credit Manager @ PARIKA INVESTMENT. Apply now.',
      },
      {
        id: 'unwanted-3',
        sender: 'HDFC Bank <information@mailers.hdfcbank.bank.in>',
        subject: 'A/c xx7079: Your Credit Card is ready!',
        date: new Date(),
        snippet: 'Your pre-approved lifetime free credit card is ready with limit up to ₹2,75,000.',
        bodyText: 'Your Credit Card is ready. Lifetime free.',
      },
      {
        id: 'unwanted-4',
        sender: 'ticketadmin@irctc.co.in',
        subject: 'Booking Confirmation on IRCTC, Train: 16103, 17-Sept-2026, SL, TBM - ATQ',
        date: new Date(),
        snippet: 'Booking confirmation for PNR 1234567890. Total fare ₹270.',
        bodyText: 'Booking Confirmation on IRCTC. Ticket fare: ₹270.',
      },
      {
        id: 'unwanted-5',
        sender: 'Flipkart <no-reply@rmp.flipkart.com>',
        subject: '🔥 Up to ₹2 Lakh credit + ₹1,000 Off* | Only for you! 🎉',
        date: new Date(),
        snippet: 'Get up to ₹2 Lakh credit line on Flipkart Pay Later. Extra ₹1,000 Off.',
        bodyText: 'Pay Later credit limit. UPI accepted.',
      },
    ];

    for (const email of unwantedEmails) {
      expect(await registry.parse(email)).toBeNull();
    }
  });
});
