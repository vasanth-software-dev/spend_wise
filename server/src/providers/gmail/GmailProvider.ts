import { google } from 'googleapis';
import { env } from '../../config/env.js';
import { decrypt } from '../../utils/encryption.js';
import { EmailMessage, EmailProvider, SyncOptions } from '../../types/index.js';
import {
  formatGmailDate,
  getMonthYearRange,
  isValidMonthYear,
} from '../../utils/dateRange.js';

function decodeBody(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8');
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function findBodyPart(parts: any[] | undefined, mimeType: string): string | undefined {
  if (!parts) return undefined;

  for (const part of parts) {
    if (part.mimeType === mimeType && part.body?.data) {
      return decodeBody(part.body.data);
    }

    const nested = findBodyPart(part.parts, mimeType);
    if (nested) return nested;
  }
}

export class GmailProvider implements EmailProvider {
  public name = 'GmailProvider';
  private oauth2Client;

  constructor(encryptedAccessToken?: string, encryptedRefreshToken?: string) {
    this.oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );

    if (encryptedAccessToken) {
      try {
        const accessToken = decrypt(encryptedAccessToken);
        const refreshToken = encryptedRefreshToken ? decrypt(encryptedRefreshToken) : undefined;
        this.oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      } catch (err) {
        console.error('Failed to decrypt Gmail OAuth credentials:', err);
      }
    }
  }

  static getAuthUrl(state: string): string {
    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state,
    });
  }

  static async exchangeCode(code: string) {
    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user profile email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    return {
      tokens,
      email: userInfo.email,
      providerAccountId: userInfo.id,
    };
  }

  async connect(): Promise<boolean> {
    return true;
  }

  async disconnect(): Promise<boolean> {
    try {
      await this.oauth2Client.revokeCredentials();
    } catch {
      // Ignore revocation failure
    }
    return true;
  }

  async getMessages(query?: string, maxResults = 500): Promise<EmailMessage[]> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    // Broad search query matching UPI, cards, net banking, and alerts across major banks while excluding marketing, jobs, and travel ticket confirmations
    const defaultQuery = '{UPI VPA debited credited debit credit payment paid spent sent received transfer txn transaction "Bank Alert" alert "Google Pay" PhonePe Paytm "Amazon Pay" Cred BHIM HDFC ICICI SBI Axis Kotak "State Bank"} -category:promotions -category:spam -from:indeed.com -from:naukri.com -from:linkedin.com -from:irctc.co.in -from:mailers.hdfcbank.bank.in';
    const searchQuery = query || defaultQuery;

    // Paginate to retrieve up to maxResults message summaries
    const messageSummaries: Array<{ id?: string | null; threadId?: string | null }> = [];
    let pageToken: string | undefined = undefined;

    while (messageSummaries.length < maxResults) {
      const pageSize = Math.min(100, maxResults - messageSummaries.length);
      const listRes: any = await gmail.users.messages.list({
        userId: 'me',
        q: searchQuery,
        maxResults: pageSize,
        pageToken,
      });

      const pageMessages = listRes.data.messages || [];
      messageSummaries.push(...pageMessages);

      if (!listRes.data.nextPageToken || pageMessages.length === 0) {
        break;
      }
      pageToken = listRes.data.nextPageToken;
    }

    const parsedMessages: EmailMessage[] = [];
    const batchSize = 20;

    // Fetch message details in concurrent chunks of 20 to avoid sequential network delays
    for (let i = 0; i < messageSummaries.length; i += batchSize) {
      const batch = messageSummaries.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (msg) => {
          if (!msg.id) return null;
          try {
            const msgDetail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'full',
            });

            const headers = msgDetail.data.payload?.headers || [];
            const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || 'No Subject';
            const sender = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || 'Unknown';
            const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date')?.value;
            const date = dateHeader ? new Date(dateHeader) : new Date();

            let bodyText = msgDetail.data.snippet || '';
            const payload = msgDetail.data.payload;
            const textBody = payload?.mimeType === 'text/plain' && payload.body?.data
              ? decodeBody(payload.body.data)
              : findBodyPart(payload?.parts, 'text/plain');
            const htmlBody = payload?.mimeType === 'text/html' && payload.body?.data
              ? decodeBody(payload.body.data)
              : findBodyPart(payload?.parts, 'text/html');

            bodyText = textBody || (htmlBody ? htmlToText(htmlBody) : bodyText);

            return {
              id: msg.id,
              threadId: msg.threadId || undefined,
              sender,
              subject,
              date,
              snippet: msgDetail.data.snippet || '',
              bodyText,
            };
          } catch (err) {
            console.warn(`Error fetching message ${msg.id}:`, err);
            return null;
          }
        })
      );

      for (const res of batchResults) {
        if (res) parsedMessages.push(res);
      }
    }

    return parsedMessages;
  }

  async sync(cursor?: string, options?: SyncOptions): Promise<{ messages: EmailMessage[]; newCursor?: string }> {
    const defaultQuery = '{UPI VPA debited credited debit credit payment paid spent sent received transfer txn transaction "Bank Alert" alert "Google Pay" PhonePe Paytm "Amazon Pay" Cred BHIM HDFC ICICI SBI Axis Kotak "State Bank"} -category:promotions -category:spam -from:indeed.com -from:naukri.com -from:linkedin.com -from:irctc.co.in -from:mailers.hdfcbank.bank.in';

    let searchQuery = defaultQuery;

    if (isValidMonthYear(options?.month, options?.year)) {
      const { start, end } = getMonthYearRange(options!.month!, options!.year!);

      // Widen the Gmail query by one day on each side: message Date headers can trail the
      // transaction date by timezone boundaries. The sync service applies the strict
      // month/year filter on the parsed transaction date afterwards.
      const afterStr = formatGmailDate(new Date(start.getTime() - 86400 * 1000));
      const beforeStr = formatGmailDate(new Date(end.getTime() + 86400 * 1000));

      searchQuery = `${defaultQuery} after:${afterStr} before:${beforeStr}`;
    } else {
      // Default: 1st of current month (00:00:00) or at least 30 days back, whichever is earlier
      const now = new Date();
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const minTargetDate = startOfCurrentMonth < thirtyDaysAgo ? startOfCurrentMonth : thirtyDaysAgo;

      let effectiveDate = minTargetDate;
      if (cursor) {
        const cursorDate = new Date(cursor);
        if (!isNaN(cursorDate.getTime()) && cursorDate.getTime() < minTargetDate.getTime()) {
          effectiveDate = cursorDate;
        }
      }

      const afterDate = new Date(effectiveDate.getTime() - 86400 * 1000);
      const afterStr = formatGmailDate(afterDate);
      searchQuery = `${defaultQuery} after:${afterStr}`;
    }

    // Fetch messages in the specified date range, up to 500 messages
    const messages = await this.getMessages(searchQuery, 500);

    return {
      messages,
      newCursor: new Date().toISOString(),
    };
  }
}
