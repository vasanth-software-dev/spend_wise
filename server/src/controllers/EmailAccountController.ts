import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { emailSyncService } from '../services/EmailSyncService.js';
import { GmailProvider } from '../providers/gmail/GmailProvider.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

export class EmailAccountController {
  async getAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const accounts = await emailSyncService.getAccounts(userId);
      sendSuccess(res, { accounts });
    } catch (err) {
      next(err);
    }
  }

  async connectMock(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { email = 'user@gmail.com' } = req.body;
      const account = await emailSyncService.connectMockAccount(userId, email);

      // Trigger first mock sync immediately
      const syncResult = await emailSyncService.syncAccount(userId, String(account._id));

      sendSuccess(
        res,
        { account, syncResult },
        'Mock email account connected and synced successfully!',
        201
      );
    } catch (err) {
      next(err);
    }
  }

  async getGmailAuthUrl(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        sendError(
          res,
          'Google OAuth credentials not configured on server. Use local Mock Email Provider for development.',
          400,
          'GMAIL_NOT_CONFIGURED'
        );
        return;
      }
      const userId = req.user!.userId;
      const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64');
      const authUrl = GmailProvider.getAuthUrl(state);
      sendSuccess(res, { authUrl });
    } catch (err) {
      next(err);
    }
  }

  async handleGmailCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state } = req.query;
      if (!code || !state) {
        res.redirect(`${env.CLIENT_URL}/email-sync?error=missing_oauth_code`);
        return;
      }

      let decoded: any;
      try {
        decoded = JSON.parse(Buffer.from(state as string, 'base64').toString('utf8'));
      } catch {
        decoded = {};
      }

      // If state indicates socialite login flow, delegate to authController
      if (decoded.flow === 'social_login' || decoded.action === 'login') {
        const { authController } = await import('./AuthController.js');
        return authController.googleCallback(req, res, next);
      }

      const userId = decoded.userId;
      if (!userId) {
        res.redirect(`${env.CLIENT_URL}/email-sync?error=invalid_user_state`);
        return;
      }

      await emailSyncService.handleGmailCallback(userId, code as string);
      res.redirect(`${env.CLIENT_URL}/email-sync?connected=gmail_success`);
    } catch (err: any) {
      console.error('handleGmailCallback error:', err);
      res.redirect(
        `${env.CLIENT_URL}/email-sync?error=${encodeURIComponent(
          err.message || 'Failed to connect Gmail account'
        )}`
      );
    }
  }

  async sync(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const month = req.body?.month || req.query?.month;
      const year = req.body?.year || req.query?.year;
      const options = (month && year) ? {
        month: parseInt(String(month), 10),
        year: parseInt(String(year), 10),
      } : undefined;

      const result = await emailSyncService.syncAccount(userId, id, options);
      sendSuccess(res, result, 'Email sync completed');
    } catch (err) {
      next(err);
    }
  }

  async pause(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const account = await emailSyncService.pauseAccount(userId, id);
      sendSuccess(res, { account }, 'Email sync paused');
    } catch (err) {
      next(err);
    }
  }

  async resume(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const account = await emailSyncService.resumeAccount(userId, id);
      sendSuccess(res, { account }, 'Email sync resumed');
    } catch (err) {
      next(err);
    }
  }

  async setupForwarding(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const account = await emailSyncService.setupForwardingAccount(userId);
      sendSuccess(
        res,
        { account },
        'Inbound forwarding address ready! Any emails forwarded to this address will be automatically parsed.',
        201
      );
    } catch (err) {
      next(err);
    }
  }

  async handleInboundWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (env.INBOUND_WEBHOOK_SECRET) {
        const headerSecret = req.headers['x-webhook-secret'] || req.query.secret;
        if (headerSecret !== env.INBOUND_WEBHOOK_SECRET) {
          sendError(res, 'Unauthorized inbound webhook signature', 401, 'INVALID_WEBHOOK_SECRET');
          return;
        }
      }

      const result = await emailSyncService.processInboundEmail(req.body);
      // Inbound webhooks must always return 200 OK so sending providers do not retry endlessly
      sendSuccess(res, result, result.message, 200);
    } catch (err) {
      console.error('Inbound webhook error:', err);
      // Still acknowledge with 200 to prevent webhook storms
      res.status(200).json({
        success: false,
        message: (err as Error).message || 'Failed to process inbound email',
      });
    }
  }

  async simulateInbound(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { accountId, templateKey, customData } = req.body;
      if (!accountId) {
        sendError(res, 'accountId is required for simulating inbound email', 400, 'MISSING_ACCOUNT_ID');
        return;
      }

      const result = await emailSyncService.simulateInboundEmail(
        userId,
        accountId,
        templateKey,
        customData
      );
      sendSuccess(res, result, result.message, 200);
    } catch (err) {
      next(err);
    }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      await emailSyncService.removeAccount(userId, id);
      sendSuccess(res, null, 'Email account removed');
    } catch (err) {
      next(err);
    }
  }
}

export const emailAccountController = new EmailAccountController();
