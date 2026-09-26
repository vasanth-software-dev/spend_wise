import { google } from 'googleapis';
import { env } from '../../config/env.js';
import { decrypt } from '../../utils/encryption.js';
import { EmailMessage, EmailProvider } from '../../types/index.js';

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

  async getMessages(query?: string, maxResults = 20): Promise<EmailMessage[]> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    // Targeted query for Indian financial emails to reduce API calls
    const defaultQuery = 'subject:(UPI OR debited OR credited OR payment OR "Google Pay" OR PhonePe OR Paytm OR "Bank Alert")';
    const searchQuery = query || defaultQuery;

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults,
    });

    const messages = listRes.data.messages || [];
    const parsedMessages: EmailMessage[] = [];

    for (const msg of messages) {
      if (!msg.id) continue;
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
        // Extract body plain text if present
        const parts = msgDetail.data.payload?.parts;
        if (parts && parts.length) {
          const textPart = parts.find((p) => p.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf8');
          }
        }

        parsedMessages.push({
          id: msg.id,
          threadId: msg.threadId || undefined,
          sender,
          subject,
          date,
          snippet: msgDetail.data.snippet || '',
          bodyText,
        });
      } catch (err) {
        console.warn(`Error fetching message ${msg.id}:`, err);
      }
    }

    return parsedMessages;
  }

  async sync(cursor?: string): Promise<{ messages: EmailMessage[]; newCursor?: string }> {
    const messages = await this.getMessages(undefined, 25);
    return {
      messages,
      newCursor: new Date().toISOString(),
    };
  }
}
