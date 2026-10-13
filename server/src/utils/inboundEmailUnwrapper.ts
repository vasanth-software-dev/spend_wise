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
 * Decodes RFC 2047 encoded words commonly found in email headers.
 * Example: "=?UTF-8?B?WW91IHBhaWQ=?=" or "=?UTF-8?Q?You_paid_=E2=82=B9500?="
 */
export function decodeRfc2047(header: string): string {
  if (!header || !header.includes('=?')) return header;

  return header.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, _charset, encoding, data) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(data, 'base64').toString('utf-8');
      } else if (encoding.toUpperCase() === 'Q') {
        const unscore = data.replace(/_/g, ' ');
        return decodeQuotedPrintable(unscore);
      }
    } catch {
      return data;
    }
    return data;
  });
}

/**
 * Decodes quoted-printable string into UTF-8.
 * Handles soft line breaks (=\r?\n) and UTF-8 multi-byte hex sequences (=E2=82=B9 -> ₹).
 */
export function decodeQuotedPrintable(input: string): string {
  if (!input) return '';
  // Remove soft linebreaks
  const withoutSoftBreaks = input.replace(/=(?:\r\n|\n|\r)/g, '');
  // Group contiguous =XX sequences into Buffer to correctly decode multibyte UTF-8 characters
  return withoutSoftBreaks.replace(/(?:=[0-9A-Fa-f]{2})+/g, (match) => {
    try {
      const hexParts = match.split('=').filter(Boolean);
      const buffer = Buffer.from(hexParts.map((h) => parseInt(h, 16)));
      return buffer.toString('utf-8');
    } catch {
      return match;
    }
  });
}

/**
 * Decodes base64 string to UTF-8.
 */
export function decodeBase64(input: string): string {
  if (!input) return '';
  try {
    const clean = input.replace(/\s+/g, '');
    return Buffer.from(clean, 'base64').toString('utf-8');
  } catch {
    return input;
  }
}

export interface ParsedMimeEmail {
  to?: string;
  from?: string;
  subject?: string;
  text: string;
  html?: string;
}

/**
 * Detects and parses a raw RFC 5322 / MIME email string (as delivered by Cloudflare Email Routing message.raw or SendGrid).
 * Extracts text/plain and text/html bodies, decoding quoted-printable and base64 parts.
 */
export function parseRawMimeEmail(raw: string): ParsedMimeEmail {
  if (!raw) return { text: '' };

  // If it's already plain text (doesn't look like raw MIME headers)
  const isMime =
    /^(?:Received|From|To|Subject|MIME-Version|Content-Type):/im.test(raw) ||
    /Content-Type:\s*multipart/i.test(raw);

  if (!isMime) {
    return { text: decodeQuotedPrintable(raw) };
  }

  // Split headers and body at first empty line (\r\n\r\n or \n\n)
  const splitMatch = raw.match(/\r?\n\r?\n/);
  if (!splitMatch || splitMatch.index === undefined) {
    return { text: decodeQuotedPrintable(raw) };
  }

  const rawHeaders = raw.slice(0, splitMatch.index);
  const rawBody = raw.slice(splitMatch.index + splitMatch[0].length);

  // Unfold multi-line headers (RFC 2822: lines starting with space or tab continue previous header)
  const unfoldedHeaders = rawHeaders.replace(/\r?\n[ \t]+/g, ' ');

  // Extract common top-level headers
  const getHeader = (name: string): string | undefined => {
    const m = unfoldedHeaders.match(new RegExp(`^${name}:\\s*(.+)`, 'im'));
    return m ? decodeRfc2047(m[1].trim()) : undefined;
  };

  const subject = getHeader('Subject');
  const from = getHeader('From');
  const to = getHeader('To');
  const contentType = getHeader('Content-Type') || '';
  const contentTransferEncoding = (getHeader('Content-Transfer-Encoding') || '').toLowerCase();

  // Check for multipart boundary
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : undefined;

  let textBody = '';
  let htmlBody = '';

  if (boundary) {
    // Split body into multipart chunks
    const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = rawBody.split(new RegExp(`--${escapedBoundary}(?:--)?`));

    for (const part of parts) {
      const partSplit = part.match(/\r?\n\r?\n/);
      if (!partSplit || partSplit.index === undefined) continue;

      const partHeaders = part.slice(0, partSplit.index).replace(/\r?\n[ \t]+/g, ' ');
      const partBody = part.slice(partSplit.index + partSplit[0].length).trim();

      const partContentType = partHeaders.match(/^Content-Type:\s*([^;\r\n]+)/im)?.[1]?.toLowerCase() || '';
      const partEncoding = partHeaders.match(/^Content-Transfer-Encoding:\s*([^\r\n]+)/im)?.[1]?.trim().toLowerCase() || '';

      let decodedPart = partBody;
      if (partEncoding === 'quoted-printable') {
        decodedPart = decodeQuotedPrintable(partBody);
      } else if (partEncoding === 'base64') {
        decodedPart = decodeBase64(partBody);
      }

      if (partContentType.includes('text/plain') && !textBody) {
        textBody = decodedPart;
      } else if (partContentType.includes('text/html') && !htmlBody) {
        htmlBody = decodedPart;
      }
    }
  } else {
    // Single-part body
    let decoded = rawBody;
    if (contentTransferEncoding === 'quoted-printable') {
      decoded = decodeQuotedPrintable(rawBody);
    } else if (contentTransferEncoding === 'base64') {
      decoded = decodeBase64(rawBody);
    }

    if (contentType.toLowerCase().includes('text/html')) {
      htmlBody = decoded;
    } else {
      textBody = decoded;
    }
  }

  return {
    to,
    from,
    subject,
    text: textBody || decodeQuotedPrintable(rawBody),
    html: htmlBody,
  };
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
  const decodedSubject = decodeRfc2047(subject || '');
  const decodedText = decodeQuotedPrintable(bodyText || '');
  const combinedText = `${decodedSubject}\n${decodedText}\n${bodyHtml || ''}`;
  const isGmailConfirmation =
    /Gmail Forwarding Confirmation/i.test(decodedSubject) ||
    /Google Gmail Forwarding Confirmation/i.test(combinedText) ||
    /requested to automatically forward mail/i.test(combinedText);

  if (!isGmailConfirmation) {
    return { isVerification: false };
  }

  // Extract confirmation code (usually a 9-digit or alphanumeric code)
  // Example: "Confirmation code: 894178523" or "code is 894178523"
  const codeMatch =
    combinedText.match(/Confirmation\s+code:\s*([0-9a-zA-Z]{6,12})/i) ||
    combinedText.match(/code\s+(?:is|:)\s*([0-9a-zA-Z]{6,12})/i) ||
    combinedText.match(/(?:confirmation|verification)\s+code\s*(?:is|:)?\s*([0-9a-zA-Z]{6,12})/i);

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
  const text = decodeQuotedPrintable(email.bodyText || '');
  const cleanBaseSubject = decodeRfc2047(email.subject || '');

  // Look for standard forward markers:
  // "---------- Forwarded message ---------" (Gmail)
  // "-----Original Message-----" (Outlook)
  // "Begin forwarded message:" (Apple Mail)
  const forwardHeaderRegex =
    /(?:---------- Forwarded message ---------|-----Original Message-----|Begin forwarded message:)\s*\r?\n([\s\S]*?)(?:\r?\n\r?\n)/i;

  const headerMatch = text.match(forwardHeaderRegex);

  if (!headerMatch) {
    // Check if subject is Fwd: but no text header
    const cleanSubject = cleanBaseSubject.replace(/^(?:fwd?|re|fw):\s*/i, '').trim();
    return {
      unwrapped: {
        ...email,
        subject: cleanSubject,
        bodyText: text,
      },
      isForwarded: cleanBaseSubject.toLowerCase().startsWith('fwd:'),
    };
  }

  const headerBlock = headerMatch[1];
  const bodyAfterHeader = text.slice(headerMatch.index! + headerMatch[0].length).trim();

  // Extract original From
  const fromMatch = headerBlock.match(/From:\s*([^\r\n]+)/i);
  let originalSender = email.sender;
  if (fromMatch) {
    const rawFrom = decodeRfc2047(fromMatch[1].trim());
    const emailInBracket = rawFrom.match(/<([^>]+)>/);
    originalSender = emailInBracket ? emailInBracket[1].trim() : rawFrom;
  }

  // Extract original Subject
  const subjectMatch = headerBlock.match(/Subject:\s*([^\r\n]+)/i);
  const originalSubject = subjectMatch
    ? decodeRfc2047(subjectMatch[1].trim())
    : cleanBaseSubject.replace(/^(?:fwd?|re|fw):\s*/i, '').trim();

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
    bodyText: bodyAfterHeader || text,
  };

  return {
    unwrapped,
    isForwarded: true,
    originalSender,
    originalSubject,
    originalDate,
  };
}
