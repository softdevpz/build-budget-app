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
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { SALT_ROUNDS, VERIFICATION_TOKEN_TTL_HOURS } from './auth.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
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
    if (!user) {
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

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
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

  private async getTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: process.env.JWT_SECRET,
          expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
        },
      ),
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
