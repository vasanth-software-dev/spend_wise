import { EmailMessage, EmailProvider, SyncOptions } from '../../types/index.js';

export class MockEmailProvider implements EmailProvider {
  public name = 'MockEmailProvider';
  private userEmail: string;

  constructor(userEmail = 'user@example.com') {
    this.userEmail = userEmail;
  }

  async connect(): Promise<boolean> {
    return true;
  }

  async disconnect(): Promise<boolean> {
    return true;
  }

  async getMessages(query?: string, maxResults = 10): Promise<EmailMessage[]> {
    const allMockMessages: EmailMessage[] = [
      {
        id: `mock-msg-${Date.now()}-1`,
        sender: 'payments-noreply@google.com',
        recipient: this.userEmail,
        subject: 'You paid ₹450 to Swiggy using Google Pay',
        date: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
        snippet: 'You paid ₹450.00 to Swiggy. UPI transaction ID: 426819284192. Google transaction ID: CICAgKDL849',
        bodyText: `Dear Customer,
You paid ₹450.00 to Swiggy on ${new Date().toLocaleDateString('en-IN')}.
UPI transaction ID: 426819284192
Google transaction ID: CICAgKDL849
Payment method: HDFC Bank A/C XX1234
Thank you for using Google Pay.`,
      },
      {
        id: `mock-msg-${Date.now()}-2`,
        sender: 'noreply@phonepe.com',
        recipient: this.userEmail,
        subject: 'Transaction Successful! Paid ₹1,299 to Amazon',
        date: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hrs ago
        snippet: 'Your payment of ₹1,299 to Amazon Pay was successful. UTR No. 426811209384',
        bodyText: `Hi there,
Your payment of ₹1,299 to Amazon Pay was successful.
Txn ID: T240926123456789
UTR: 426811209384
Debited from: State Bank of India **5678
Enjoy your shopping!`,
      },
      {
        id: `mock-msg-${Date.now()}-3`,
        sender: 'alerts@hdfcbank.net',
        recipient: this.userEmail,
        subject: 'Alert: Your HDFC Bank A/C has been debited',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        snippet: 'Your A/C XX1234 has been debited by INR 1,850.00 on 25-Sep-26 towards Electricity Bill. Info: UPI/TNEB/426899120943',
        bodyText: `Dear Customer,
Your A/C XX1234 has been debited by INR 1,850.00 on 25-Sep-26 towards Electricity Bill.
Info: UPI/TNEB/426899120943.
Available Balance: INR 1,24,500.00.
If not done by you, report immediately to HDFC Bank.`,
      },
      {
        id: `mock-msg-${Date.now()}-4`,
        sender: 'no-reply@paytm.com',
        recipient: this.userEmail,
        subject: 'Paid ₹230 to Uber using Paytm UPI',
        date: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
        snippet: 'Payment of ₹230 to Uber India was successful. UPI Ref: 426800119283',
        bodyText: `Your payment of ₹230 to Uber India was successful.
UPI Ref No: 426800119283
Order ID: PTM-UBER-982137
Payment Mode: Paytm UPI`,
      },
      {
        id: `mock-msg-${Date.now()}-5`,
        sender: 'alerts@icicibank.com',
        recipient: this.userEmail,
        subject: 'Account Credited: Salary for September 2026',
        date: new Date(Date.now() - 72 * 60 * 60 * 1000), // 3 days ago
        snippet: 'Dear Customer, INR 75,000.00 credited to your A/C XX9876. Info: SALARY CREDITED COMPANY TECH PVT LTD',
        bodyText: `Dear Customer,
INR 75,000.00 credited to your ICICI Bank A/C XX9876 on 23-Sep-2026.
Info: SALARY CREDITED COMPANY TECH PVT LTD.
Ref No: SAL20260923001928.
Available Balance: INR 1,99,500.00.`,
      },
      {
        id: `mock-msg-${Date.now()}-6`,
        sender: 'alerts@hdfcbank.net',
        recipient: this.userEmail,
        subject: 'Alert: Your HDFC Bank account has been debited',
        date: new Date(Date.now() - 12 * 60 * 60 * 1000),
        snippet: 'Rs.1.00 is debited from your account ending 7079 towards VPA 8489906290@yapl (ABIRAMI P) on 26-09-26.',
        bodyText: `Rs.1.00 is debited from your account ending 7079 towards VPA 8489906290@yapl (ABIRAMI P) on 26-09-26.
UPI transaction reference no.: 130279331928.
Available balance: INR 45,230.00.`,
      },
      {
        id: `mock-msg-${Date.now()}-7`,
        sender: 'payments-noreply@google.com',
        recipient: this.userEmail,
        subject: 'You paid ₹320 to RAHUL SHARMA using Google Pay',
        date: new Date(Date.now() - 18 * 60 * 60 * 1000),
        snippet: 'You paid ₹320.00 to RAHUL SHARMA towards VPA rahul@okhdfcbank. UPI Ref: 426899123456.',
        bodyText: `Dear Customer,
You paid ₹320.00 to RAHUL SHARMA (rahul@okhdfcbank) on ${new Date().toLocaleDateString('en-IN')}.
UPI transaction ID: 426899123456
Google transaction ID: CICAgKDL991
Payment method: SBI Bank A/C XX5678`,
      },
      {
        id: `mock-msg-${Date.now()}-8`,
        sender: 'alerts@axisbank.com',
        recipient: this.userEmail,
        subject: 'Transaction Alert: INR 2,150.00 spent on Axis Bank Card',
        date: new Date(Date.now() - 36 * 60 * 60 * 1000),
        snippet: 'Transaction alert: INR 2,150.00 spent on your Axis Bank card ending 4012 at FLIPKART on 25-09-26.',
        bodyText: `Dear Cardholder,
INR 2,150.00 has been spent on your Axis Bank Card XX4012 at FLIPKART on 25-09-26 at 02:45 PM.
Available Limit: INR 85,000.00.
If this was not done by you, report immediately.`,
      },
      {
        id: `mock-msg-${Date.now()}-9`,
        sender: 'noreply@phonepe.com',
        recipient: this.userEmail,
        subject: 'Paid ₹650 to Zomato using PhonePe',
        date: new Date(Date.now() - 50 * 60 * 60 * 1000),
        snippet: 'Your payment of ₹650 to Zomato was successful. UTR No. 426888129034',
        bodyText: `Your payment of ₹650 to Zomato was successful.
Txn ID: T240925789123456
UTR: 426888129034
Paid from: HDFC Bank **1234`,
      },
      {
        id: `mock-msg-${Date.now()}-10`,
        sender: 'alerts@hdfcbank.net',
        recipient: this.userEmail,
        subject: 'Alert: Your HDFC Bank account has been credited',
        date: new Date(Date.now() - 60 * 60 * 60 * 1000),
        snippet: 'INR 1,500.00 credited to account ending 7079. Sender: PRIYA PATEL (VPA: priya@icici).',
        bodyText: `Dear Customer,
INR 1,500.00 credited to your HDFC Bank account ending 7079 on 24-09-26.
Sender: PRIYA PATEL (VPA: priya@icici).
UPI Ref: 426877665544.
Available Balance: INR 46,730.00.`,
      },
      {
        id: `mock-msg-${Date.now()}-11`,
        sender: 'no-reply@paytm.com',
        recipient: this.userEmail,
        subject: 'Paid ₹149 to Spotify India using Paytm',
        date: new Date(Date.now() - 80 * 60 * 60 * 1000),
        snippet: 'Paid ₹149.00 for Spotify Premium monthly subscription. UPI Ref: 426855443322',
        bodyText: `Your payment of ₹149 to Spotify India was successful.
UPI Ref No: 426855443322
Order ID: SPOTIFY-SUB-4412
Payment Mode: Paytm UPI`,
      },
      {
        id: `mock-msg-${Date.now()}-12`,
        sender: 'alerts@sbi.co.in',
        recipient: this.userEmail,
        subject: 'SBI Account Debit Alert: INR 4,500.00 withdrawn',
        date: new Date(Date.now() - 90 * 60 * 60 * 1000),
        snippet: 'Your A/C XX5678 debited by INR 4,500.00 on 22-Sep-26 at ATM T NAGAR CHENNAI.',
        bodyText: `Dear Customer,
Your A/C ending 5678 has been debited by INR 4,500.00 on 22-09-26 at ATM T NAGAR CHENNAI.
Txn Ref: ATM20260922441.
Available Balance: INR 32,100.00.`,
      },
    ];

    return allMockMessages.slice(0, maxResults);
  }

  async sync(cursor?: string, options?: SyncOptions): Promise<{ messages: EmailMessage[]; newCursor?: string }> {
    let messages = await this.getMessages(undefined, 20);
    if (options?.month && options?.year) {
      messages = messages.filter((m) => {
        const d = new Date(m.date);
        return d.getMonth() + 1 === options.month && d.getFullYear() === options.year;
      });
    }
    const newCursor = `mock-cursor-${Date.now()}`;
    return { messages, newCursor };
  }
}
