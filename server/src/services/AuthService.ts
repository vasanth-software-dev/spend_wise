import crypto from 'crypto';
import { userRepository } from '../repositories/UserRepository.js';
import { sessionRepository } from '../repositories/SessionRepository.js';
import { categoryRepository } from '../repositories/CategoryRepository.js';
import { auditLogRepository } from '../repositories/AuditLogRepository.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { IUser, ISession, AuthTokens } from '../types/index.js';
import { GoogleProfile } from '../providers/social/GoogleSocialiteProvider.js';
import { emailSyncService } from './EmailSyncService.js';

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  currency?: string;
  timezone?: string;
}

export interface ClientMetadata {
  userAgent: string;
  ipAddress: string;
  device?: string;
  browser?: string;
  os?: string;
}

export class AuthService {
  async register(data: RegisterDTO, clientMeta: ClientMetadata): Promise<{ user: Partial<IUser>; tokens: AuthTokens; sessionId: string }> {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw new Error('An account with this email already exists');
    }

    const passwordHash = await hashPassword(data.password);
    const user = await userRepository.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      currency: data.currency || 'INR',
      timezone: data.timezone || 'Asia/Kolkata',
      isEmailVerified: true,
    });

    // Ensure default system categories exist
    await categoryRepository.ensureDefaultCategories();

    // Create session
    const { tokens, session } = await this.createSession(user, clientMeta);

    await auditLogRepository.log({
      userId: user._id,
      action: 'LOGIN',
      ipAddress: clientMeta.ipAddress,
      userAgent: clientMeta.userAgent,
      metadata: { method: 'registration' },
    });

    return {
      user: this.sanitizeUser(user),
      tokens,
      sessionId: String(session._id),
    };
  }

  async login(
    email: string,
    password: string,
    clientMeta: ClientMetadata
  ): Promise<{ user: Partial<IUser>; tokens: AuthTokens; sessionId: string }> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new Error('This account was created with Google Sign-In. Please sign in using Google.');
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    const { tokens, session } = await this.createSession(user, clientMeta);

    await auditLogRepository.log({
      userId: user._id,
      action: 'LOGIN',
      ipAddress: clientMeta.ipAddress,
      userAgent: clientMeta.userAgent,
    });

    return {
      user: this.sanitizeUser(user),
      tokens,
      sessionId: String(session._id),
    };
  }

  async refreshTokens(
    oldRefreshToken: string,
    clientMeta: ClientMetadata
  ): Promise<{ tokens: AuthTokens; sessionId: string; user: Partial<IUser> }> {
    let payload;
    try {
      payload = verifyRefreshToken(oldRefreshToken);
    } catch {
      throw new Error('Invalid or expired refresh token');
    }

    const session = await sessionRepository.findById(payload.sessionId);
    if (!session || !session.isValid) {
      throw new Error('Session is no longer valid');
    }

    const user = await userRepository.findById(payload.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Refresh token rotation: Invalidate old session and create a new session
    await sessionRepository.invalidate(String(session._id));
    const { tokens, session: newSession } = await this.createSession(user, clientMeta);

    return {
      tokens,
      sessionId: String(newSession._id),
      user: this.sanitizeUser(user),
    };
  }

  async logout(sessionId?: string, userId?: string, ipAddress?: string): Promise<void> {
    if (sessionId) {
      await sessionRepository.invalidate(sessionId);
    }
    if (userId) {
      await auditLogRepository.log({
        userId,
        action: 'LOGOUT',
        ipAddress,
      });
    }
  }

  async logoutAllSessions(userId: string, currentSessionId?: string): Promise<number> {
    return sessionRepository.invalidateAllForUser(userId, currentSessionId);
  }

  async getSessions(userId: string): Promise<ISession[]> {
    return sessionRepository.findActiveByUserId(userId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const session = await sessionRepository.findById(sessionId);
    if (!session || String(session.userId) !== userId) {
      throw new Error('Session not found or unauthorized');
    }
    return sessionRepository.invalidate(sessionId);
  }

  async handleGoogleAuth(
    profile: GoogleProfile,
    clientMeta: ClientMetadata,
    tokens?: any
  ): Promise<{ user: Partial<IUser>; tokens: AuthTokens; sessionId: string }> {
    const email = profile.email.toLowerCase().trim();
    let user = (await userRepository.findByGoogleId(profile.id)) || (await userRepository.findByEmail(email));

    if (user) {
      const updates: Partial<IUser> = {
        isEmailVerified: true,
      };
      if (!user.googleId) {
        updates.googleId = profile.id;
      }
      if (!user.avatar && profile.picture) {
        updates.avatar = profile.picture;
      }
      if (!user.authProvider) {
        updates.authProvider = 'google';
      }
      user = (await userRepository.update(String(user._id), updates)) || user;
    } else {
      user = await userRepository.create({
        name: profile.name || email.split('@')[0],
        email,
        avatar: profile.picture,
        authProvider: 'google',
        googleId: profile.id,
        isEmailVerified: true,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      });

      // Ensure default system categories exist
      await categoryRepository.ensureDefaultCategories();
    }

    // Connect Gmail for transaction tracking ONLY if gmail.readonly scope was actually granted
    const grantedScope = tokens?.scope || '';
    const hasGmailScope =
      grantedScope.includes('gmail.readonly') ||
      grantedScope.includes('mail.google.com') ||
      grantedScope.includes('https://www.googleapis.com/auth/gmail.readonly');

    if (tokens && (tokens.access_token || tokens.refresh_token) && hasGmailScope) {
      try {
        await emailSyncService.connectGmailWithTokens(
          String(user._id),
          email,
          tokens,
          profile.id
        );
      } catch (err) {
        console.warn('Optional Gmail sync auto-connect note:', err);
      }
    }

    // Create authenticated session
    const { tokens: authTokens, session } = await this.createSession(user, clientMeta);

    await auditLogRepository.log({
      userId: user._id,
      action: 'LOGIN',
      ipAddress: clientMeta.ipAddress,
      userAgent: clientMeta.userAgent,
      metadata: { method: 'google_socialite', email: user.email },
    });

    return {
      user: this.sanitizeUser(user),
      tokens: authTokens,
      sessionId: String(session._id),
    };
  }

  async handleGoogleDevLogin(
    data: { email?: string; name?: string; avatar?: string } = {},
    clientMeta: ClientMetadata
  ): Promise<{ user: Partial<IUser>; tokens: AuthTokens; sessionId: string }> {
    const mockEmail = data.email || 'vasanth.google@spendwise.dev';
    const mockName = data.name || 'Vasanth Kumar (Google)';
    const mockAvatar =
      data.avatar ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';

    const mockProfile: GoogleProfile = {
      id: `google_dev_${Buffer.from(mockEmail).toString('hex').slice(0, 16)}`,
      email: mockEmail,
      name: mockName,
      picture: mockAvatar,
      verifiedEmail: true,
    };

    return this.handleGoogleAuth(mockProfile, clientMeta);
  }

  async getCurrentUser(userId: string): Promise<Partial<IUser>> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return this.sanitizeUser(user);
  }

  private async createSession(
    user: IUser,
    clientMeta: ClientMetadata
  ): Promise<{ tokens: AuthTokens; session: ISession }> {
    // Generate dummy token hash for initial insert
    const tempHash = crypto.randomBytes(32).toString('hex');
    const session = await sessionRepository.create({
      userId: user._id,
      refreshTokenHash: tempHash,
      userAgent: clientMeta.userAgent,
      ipAddress: clientMeta.ipAddress,
      device: clientMeta.device || 'Desktop',
      browser: clientMeta.browser || 'Browser',
      os: clientMeta.os || 'OS',
      lastActive: new Date(),
      isValid: true,
    });

    const payload = {
      userId: String(user._id),
      email: user.email,
      sessionId: String(session._id),
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Hash the refresh token
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await sessionRepository.updateLastActive(String(session._id));

    return {
      tokens: { accessToken, refreshToken },
      session,
    };
  }

  public sanitizeUser(user: IUser): Partial<IUser> {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}

export const authService = new AuthService();
