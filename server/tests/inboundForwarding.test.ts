import { describe, it, expect } from 'vitest';
import {
  extractForwardingToken,
  extractGmailVerificationCode,
  unwrapForwardedEmail,
} from '../src/utils/inboundEmailUnwrapper.js';
import { emailParserRegistry } from '../src/providers/parsers/EmailParserRegistry.js';
import { EmailMessage } from '../src/types/index.js';

describe('Email Auto-Forwarding (Inbound Parsing) Framework', () => {
  it('extracts forwarding tokens accurately from various recipient formats', () => {
    expect(extractForwardingToken('sync-8f2a6b41@sync.spendwise.local').token).toBe('8f2a6b41');
    expect(extractForwardingToken('"SpendWise Sync" <sync-8f2a6b41@sync.spendwise.app>').token).toBe('8f2a6b41');
    expect(extractForwardingToken('sync+8f2a6b41@sync.spendwise.local').token).toBe('8f2a6b41');
    expect(extractForwardingToken('sync.8f2a6b41@sync.spendwise.local').token).toBe('8f2a6b41');
    expect(extractForwardingToken('8f2a6b41@sync.spendwise.local').token).toBe('8f2a6b41');
  });

  it('detects and extracts Gmail forwarding verification confirmation codes', () => {
    const subject = 'Google Gmail Forwarding Confirmation - Receive Mail from user@gmail.com';
    const body = `user@gmail.com has requested to automatically forward mail to your email address sync-8f2a6b41@sync.spendwise.local.
Confirmation code: 894178523
To allow this, please click the link below to confirm the request:
https://isolated.mail.google.com/mail/vf-9812498124`;

    const result = extractGmailVerificationCode(subject, body);
    expect(result.isVerification).toBe(true);
    expect(result.code).toBe('894178523');
    expect(result.confirmationLink).toContain('https://isolated.mail.google.com/mail/vf-9812498124');
    expect(result.requestedByEmail).toBe('user@gmail.com');
  });

  it('unwraps forwarded message headers and feeds into parser registry', async () => {
    const rawForwardedEmail: EmailMessage = {
      id: 'fwd-msg-1',
      sender: 'my-personal-gmail@gmail.com', // The user's Gmail forwarded it
      recipient: 'sync-8f2a6b41@sync.spendwise.local',
      subject: 'Fwd: You paid ₹500 to Swiggy using Google Pay',
      date: new Date('2026-09-26T12:00:00Z'),
      bodyText: `FYI

---------- Forwarded message ---------
From: Google Pay <payments-noreply@google.com>
Date: Fri, 26 Sep 2026 at 11:58
Subject: You paid ₹500 to Swiggy using Google Pay
To: <my-personal-gmail@gmail.com>

Dear User,
You paid ₹500.00 to Swiggy.
UPI transaction ID: 426819284192
Google transaction ID: CICAgKDL849
Payment method: HDFC Bank A/C XX1234`,
    };

    const { unwrapped, isForwarded, originalSender, originalSubject } =
      unwrapForwardedEmail(rawForwardedEmail);

    expect(isForwarded).toBe(true);
    expect(originalSender).toBe('payments-noreply@google.com');
    expect(originalSubject).toBe('You paid ₹500 to Swiggy using Google Pay');

    // Feed unwrapped email into parser registry
    const parsed = await emailParserRegistry.parse(unwrapped);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(500);
    expect(parsed?.merchant).toBe('Swiggy');
    expect(parsed?.upiReference).toBe('426819284192');
  });

  it('parses forwarded HDFC Bank debit alerts correctly', async () => {
    const rawHdfcForwarded: EmailMessage = {
      id: 'fwd-hdfc-1',
      sender: 'user@gmail.com',
      recipient: 'sync-8f2a6b41@sync.spendwise.local',
      subject: 'Fwd: Alert: Your HDFC Bank A/C has been debited',
      date: new Date('2026-09-26T12:30:00Z'),
      bodyText: `---------- Forwarded message ---------
From: HDFC Bank Alerts <alerts@hdfcbank.net>
Date: Fri, 26 Sep 2026, 12:28
Subject: Alert: Your HDFC Bank A/C has been debited
To: <user@gmail.com>

Dear Customer,
Your A/C XX1234 has been debited by INR 1,850.00 on 26-Sep-26 towards Electricity Bill.
Info: UPI/TNEB/426899120943.
Available Balance: INR 1,24,500.00.`,
    };

    const { unwrapped } = unwrapForwardedEmail(rawHdfcForwarded);
    const parsed = await emailParserRegistry.parse(unwrapped);

    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(1850);
    expect(parsed?.upiReference).toBe('426899120943');
    expect(parsed?.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it('correctly decodes quoted-printable and RFC 2047 Indian Rupee symbols and headers', async () => {
    const { decodeQuotedPrintable, decodeRfc2047 } = await import('../src/utils/inboundEmailUnwrapper.js');

    const qpEncoded = 'You paid =E2=82=B91,250.00 to Swiggy=\r\n on Google Pay';
    const decoded = decodeQuotedPrintable(qpEncoded);
    expect(decoded).toBe('You paid ₹1,250.00 to Swiggy on Google Pay');

    const rfc2047Header = '=?UTF-8?Q?You_paid_=E2=82=B9489.00_to_Swiggy?=';
    expect(decodeRfc2047(rfc2047Header)).toBe('You paid ₹489.00 to Swiggy');

    const base64Header = '=?UTF-8?B?U3dpZ2d5IE9yZGVyIFJlY2VpcHQ=?=';
    expect(decodeRfc2047(base64Header)).toBe('Swiggy Order Receipt');
  });

  it('parses raw multipart RFC 5322 MIME messages as delivered by Cloudflare Email Routing', async () => {
    const { parseRawMimeEmail } = await import('../src/utils/inboundEmailUnwrapper.js');

    const rawCloudflareMime = `Received: by mail-ed1-f67.google.com with SMTP id 12345
From: "Google Pay" <payments-noreply@google.com>
To: <sync-e7a2647e@myspendwise.dpdns.org>
Subject: =?UTF-8?Q?You_paid_=E2=82=B9750.00_to_Zomato?=
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="===============7381928491=="

--===============7381928491==
Content-Type: text/plain; charset="utf-8"
Content-Transfer-Encoding: quoted-printable

---------- Forwarded message ---------
From: Google Pay <payments-noreply@google.com>
Date: Fri, 26 Sep 2026 at 12:00
Subject: You paid =E2=82=B9750.00 to Zomato using Google Pay
To: <user@gmail.com>

Dear User,
You paid =E2=82=B9750.00 to Zomato.
UPI transaction ID: 987654321098
Google transaction ID: CICAgKDL999
Payment method: HDFC Bank A/C XX4321

--===============7381928491==
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: quoted-printable

<div>You paid ₹750.00 to Zomato</div>

--===============7381928491==--
`;

    const parsedMime = parseRawMimeEmail(rawCloudflareMime);
    expect(parsedMime.to).toBe('<sync-e7a2647e@myspendwise.dpdns.org>');
    expect(parsedMime.subject).toBe('You paid ₹750.00 to Zomato');
    expect(parsedMime.text).toContain('---------- Forwarded message ---------');
    expect(parsedMime.text).toContain('You paid ₹750.00 to Zomato');
    expect(parsedMime.text).toContain('UPI transaction ID: 987654321098');

    // Feed through unwrapForwardedEmail
    const { unwrapped } = unwrapForwardedEmail({
      id: 'cf-test-1',
      sender: 'user@gmail.com',
      recipient: parsedMime.to!,
      subject: parsedMime.subject!,
      date: new Date(),
      bodyText: parsedMime.text,
      bodyHtml: parsedMime.html,
    });

    const parsedTransaction = await emailParserRegistry.parse(unwrapped);
    expect(parsedTransaction).not.toBeNull();
    expect(parsedTransaction?.amount).toBe(750);
    expect(parsedTransaction?.merchant).toBe('Zomato');
    expect(parsedTransaction?.upiReference).toBe('987654321098');
  });
});
