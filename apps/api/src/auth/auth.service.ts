import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { GoogleProfile } from './strategies/google.strategy';
import {
  OAUTH_CODE_PREFIX,
  OAUTH_CODE_TTL_SECONDS,
  SALT_ROUNDS,
  VERIFICATION_TOKEN_TTL_HOURS,
} from './auth.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly redis: RedisService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const { rawToken, tokenHash, expiresAt } = this.generateVerificationToken();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    await this.sendVerificationEmail(user.email, rawToken);

    return { message: 'Check your email to verify your account before logging in.' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Same error for "no such user" and "this account has no password"
    // (e.g. it was created via Google sign-in) — otherwise the response
    // would leak which emails exist and how they registered.
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerifiedAt) {
      // 403, not 401: the credentials themselves are correct — the account
      // just isn't allowed to log in yet. Conflating the two would make
      // "please verify your email" indistinguishable from a wrong password.
      throw new ForbiddenException('Please verify your email before logging in');
    }

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = this.hashToken(dto.token);
    const user = await this.prisma.user.findUnique({ where: { emailVerificationTokenHash: tokenHash } });

    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException('Verification link is invalid or has expired');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Same response whether the account exists, is already verified, or
    // doesn't exist at all — otherwise this endpoint would let anyone probe
    // which emails are registered.
    if (user && !user.emailVerifiedAt) {
      const { rawToken, tokenHash, expiresAt } = this.generateVerificationToken();
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationTokenHash: tokenHash, emailVerificationExpiresAt: expiresAt },
      });
      await this.sendVerificationEmail(user.email, rawToken);
    }

    return { message: 'If that email is registered and unverified, a new link has been sent.' };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const refreshTokenMatches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Access denied');
    }

    // Deliberately does NOT rotate the refresh token here (only login/
    // verifyEmail do, since those start a genuinely new session). Several
    // requests routinely hit an expired access token at the same moment
    // (every panel's own query) and each independently calls this — if
    // refreshing rotated the stored hash, the first one to land would
    // invalidate the refresh token the others are still holding, logging
    // the user out mid-session. Reusing the same (still valid) refresh
    // token instead makes concurrent refreshes idempotent: every racer
    // succeeds against the same unchanged hash, no ordering dependency.
    const accessToken = await this.signAccessToken(user.id, user.email);
    return { accessToken, refreshToken };
  }

  /**
   * Called from the Google OAuth callback. Links to an existing account by
   * email when one exists — Google has already verified ownership of that
   * email (that's what the consent screen just did), so linking is safe
   * and lets someone who registered with a password also sign in with
   * Google later, or vice versa.
   */
  async findOrCreateGoogleUser(profile: GoogleProfile) {
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });

    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
      user = existingByEmail
        ? await this.prisma.user.update({
            where: { id: existingByEmail.id },
            data: { googleId: profile.googleId, emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date() },
          })
        : await this.prisma.user.create({
            data: { email: profile.email, googleId: profile.googleId, emailVerifiedAt: new Date() },
          });
    }

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  /**
   * Stashes a token pair behind a short-lived, single-use random code
   * instead of putting the tokens themselves in the OAuth redirect URL
   * (which browsers keep in history and servers tend to log).
   */
  async issueOAuthCode(tokens: { accessToken: string; refreshToken: string }): Promise<string> {
    const code = randomBytes(32).toString('hex');
    await this.redis.client.set(`${OAUTH_CODE_PREFIX}${code}`, JSON.stringify(tokens), 'EX', OAUTH_CODE_TTL_SECONDS);
    return code;
  }

  async exchangeOAuthCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const key = `${OAUTH_CODE_PREFIX}${code}`;
    const raw = await this.redis.client.get(key);
    if (!raw) {
      throw new BadRequestException('This sign-in link has expired or was already used');
    }
    await this.redis.client.del(key);
    return JSON.parse(raw) as { accessToken: string; refreshToken: string };
  }

  private generateVerificationToken() {
    const rawToken = randomBytes(32).toString('hex');
    return {
      rawToken,
      tokenHash: this.hashToken(rawToken),
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000),
    };
  }

  // Verification tokens are high-entropy random values, not low-entropy
  // secrets someone might guess — a fast SHA-256 lookup hash is appropriate
  // here, unlike passwords/refresh tokens, which use bcrypt.
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async sendVerificationEmail(email: string, rawToken: string) {
    const link = `${process.env.WEB_APP_URL}/verify-email?token=${rawToken}`;
    try {
      await this.mailService.sendMail(
        email,
        'Confirm your email address',
        `Confirm your email by visiting: ${link}\n\nThis link expires in ${VERIFICATION_TOKEN_TTL_HOURS} hours.`,
        `<p>Confirm your email by clicking the link below:</p><p><a href="${link}">${link}</a></p><p>This link expires in ${VERIFICATION_TOKEN_TTL_HOURS} hours.</p>`,
      );
    } catch (error) {
      // A transient SMTP failure shouldn't fail registration outright — the
      // account and its verification token still exist, so the user (or a
      // future retry) can fall back to POST /auth/resend-verification.
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send verification email to ${email}: ${message}`);
    }
  }

  private async updateRefreshTokenHash(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }

  private signAccessToken(userId: string, email: string) {
    return this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      },
    );
  }

  private async getTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(userId, email),
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }
}
