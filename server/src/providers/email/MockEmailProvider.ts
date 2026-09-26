import { EmailMessage, EmailProvider } from '../../types/index.js';

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
    ];

    return allMockMessages.slice(0, maxResults);
  }

  async sync(cursor?: string): Promise<{ messages: EmailMessage[]; newCursor?: string }> {
    const messages = await this.getMessages(undefined, 5);
    const newCursor = `mock-cursor-${Date.now()}`;
    return { messages, newCursor };
  }
}
