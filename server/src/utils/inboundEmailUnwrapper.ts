import { EmailMessage } from '../types/index.js';

export interface UnwrappedEmailResult {
  unwrapped: EmailMessage;
  isForwarded: boolean;
  originalSender?: string;
  originalSubject?: string;
  originalDate?: Date;
}

export interface GmailVerificationInfo {
  isVerification: boolean;
  code?: string;
  confirmationLink?: string;
  requestedByEmail?: string;
}

/**
 * Extracts the user's forwarding token or clean address from a recipient string.
 * Examples:
 *   "SpendWise <sync-8f2a6b41@sync.spendwise.local>" -> "8f2a6b41"
 *   "sync-8f2a6b41@sync.spendwise.app" -> "8f2a6b41"
 *   "sync+8f2a6b41@..." -> "8f2a6b41"
 */
export function extractForwardingToken(recipientStr: string): { token?: string; cleanAddress: string } {
  if (!recipientStr) return { cleanAddress: '' };

  // Extract email inside brackets if present (e.g., "Name <email@domain.com>")
  const bracketMatch = recipientStr.match(/<([^>]+)>/);
  const email = (bracketMatch ? bracketMatch[1] : recipientStr).trim().toLowerCase();

  // Extract local part before @
  const localPart = email.split('@')[0] || '';

  // Match sync-TOKEN, sync+TOKEN, sync.TOKEN, or plain TOKEN
  const tokenMatch = localPart.match(/(?:sync[-_.+])([a-f0-9]{8,16})/i) || localPart.match(/^([a-f0-9]{8,16})$/i);

  return {
    token: tokenMatch ? tokenMatch[1].toLowerCase() : undefined,
    cleanAddress: email,
  };
}

/**
 * Detects whether an incoming email is a Gmail/Outlook forwarding verification request,
 * and extracts the confirmation code or approval link.
 */
export function extractGmailVerificationCode(
  subject: string,
  bodyText: string,
  bodyHtml?: string
): GmailVerificationInfo {
  const combinedText = `${subject}\n${bodyText}\n${bodyHtml || ''}`;
  const isGmailConfirmation =
    /Gmail Forwarding Confirmation/i.test(subject) ||
    /Google Gmail Forwarding Confirmation/i.test(combinedText) ||
    /requested to automatically forward mail/i.test(combinedText);

  if (!isGmailConfirmation) {
    return { isVerification: false };
  }

  // Extract confirmation code (usually a 9-digit or alphanumeric code)
  // Example: "Confirmation code: 894178523" or "code is 894178523"
  const codeMatch =
    combinedText.match(/Confirmation\s+code:\s*([0-9a-zA-Z]{6,12})/i) ||
    combinedText.match(/code\s+(?:is|:)\s*([0-9a-zA-Z]{6,12})/i);

  // Extract confirmation link
  const linkMatch = combinedText.match(
    /https:\/\/(?:isolated\.)?mail\.google\.com\/mail\/[^\s"')]+/i
  );

  // Extract requesting email
  const emailMatch = combinedText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s+has requested to automatically forward/i);

  return {
    isVerification: true,
    code: codeMatch ? codeMatch[1].trim() : undefined,
    confirmationLink: linkMatch ? linkMatch[0].trim() : undefined,
    requestedByEmail: emailMatch ? emailMatch[1].trim() : undefined,
  };
}

/**
 * Unwraps email client forwarding headers to recover original sender, subject, and transaction body.
 */
export function unwrapForwardedEmail(email: EmailMessage): UnwrappedEmailResult {
  const text = email.bodyText || '';
  const html = email.bodyHtml || '';

  // Look for standard forward markers:
  // "---------- Forwarded message ---------" (Gmail)
  // "-----Original Message-----" (Outlook)
  // "Begin forwarded message:" (Apple Mail)
  const forwardHeaderRegex =
    /(?:---------- Forwarded message ---------|-----Original Message-----|Begin forwarded message:)\s*\n([\s\S]*?)(?:\n\n|\r\n\r\n)/i;

  const headerMatch = text.match(forwardHeaderRegex);

  if (!headerMatch) {
    // Check if subject is Fwd: but no text header
    const cleanSubject = email.subject.replace(/^(?:fwd?|re|fw):\s*/i, '').trim();
    return {
      unwrapped: {
        ...email,
        subject: cleanSubject,
      },
      isForwarded: email.subject.toLowerCase().startsWith('fwd:'),
    };
  }

  const headerBlock = headerMatch[1];
  const bodyAfterHeader = text.slice(headerMatch.index! + headerMatch[0].length).trim();

  // Extract original From
  const fromMatch = headerBlock.match(/From:\s*([^\r\n]+)/i);
  let originalSender = email.sender;
  if (fromMatch) {
    const rawFrom = fromMatch[1].trim();
    const emailInBracket = rawFrom.match(/<([^>]+)>/);
    originalSender = emailInBracket ? emailInBracket[1].trim() : rawFrom;
  }

  // Extract original Subject
  const subjectMatch = headerBlock.match(/Subject:\s*([^\r\n]+)/i);
  const originalSubject = subjectMatch ? subjectMatch[1].trim() : email.subject.replace(/^(?:fwd?|re|fw):\s*/i, '').trim();

  // Extract original Date
  const dateMatch = headerBlock.match(/Date:\s*([^\r\n]+)/i);
  let originalDate = email.date;
  if (dateMatch) {
    const parsedDate = new Date(dateMatch[1].trim());
    if (!isNaN(parsedDate.getTime())) {
      originalDate = parsedDate;
    }
  }

  const unwrapped: EmailMessage = {
    ...email,
    sender: originalSender,
    subject: originalSubject,
    date: originalDate,
    bodyText: bodyAfterHeader || email.bodyText,
  };

  return {
    unwrapped,
    isForwarded: true,
    originalSender,
    originalSubject,
    originalDate,
  };
}
