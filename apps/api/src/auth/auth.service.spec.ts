import { ConflictException, ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { authenticator } from 'otplib';
import { AuthService } from './auth.service';

function makePrismaMock() {
  return {
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
}

function makeJwtServiceMock() {
  return { signAsync: jest.fn().mockResolvedValue('signed-token') } as any;
}

function makeMailServiceMock() {
  return { sendMail: jest.fn().mockResolvedValue(undefined) };
}

function makeRedisServiceMock() {
  const store = new Map<string, string>();
  return {
    client: {
      set: jest.fn((key: string, value: string, ..._ttlArgs: unknown[]) => {
        store.set(key, value);
        return Promise.resolve('OK');
      }),
      get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      del: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve(1);
      }),
    },
  };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let jwtService: ReturnType<typeof makeJwtServiceMock>;
  let mailService: ReturnType<typeof makeMailServiceMock>;
  let redis: ReturnType<typeof makeRedisServiceMock>;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrismaMock();
    jwtService = makeJwtServiceMock();
    mailService = makeMailServiceMock();
    redis = makeRedisServiceMock();
    service = new AuthService(prisma as any, jwtService, mailService as any, redis as any);
  });

  describe('register', () => {
    it('rejects a duplicate email with 409', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register({ email: 'taken@example.com', password: 'supersecret123!' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password before storing it (never stores it in plain text)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-1', email: 'new@example.com' });

      await service.register({ email: 'new@example.com', password: 'supersecret123!' });

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).not.toBe('supersecret123!');
      expect(await bcrypt.compare('supersecret123!', createArgs.data.passwordHash)).toBe(true);
    });

    it('does not issue login tokens — sends a verification email instead', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-1', email: 'new@example.com' });

      const result = await service.register({ email: 'new@example.com', password: 'supersecret123!' });

      expect(result).not.toHaveProperty('accessToken');
      expect(mailService.sendMail).toHaveBeenCalledTimes(1);
      expect(mailService.sendMail.mock.calls[0][0]).toBe('new@example.com');

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.emailVerificationTokenHash).toEqual(expect.any(String));
      expect(createArgs.data.emailVerificationExpiresAt).toBeInstanceOf(Date);
    });
  });

  describe('login', () => {
    it('rejects an unknown email with 401 (same message as wrong password, to avoid leaking which emails exist)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'ghost@example.com', password: 'whatever1' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a Google-only account (no passwordHash) with the same 401, not a crash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        passwordHash: null,
        emailVerifiedAt: new Date(),
      });

      await expect(service.login({ email: 'a@example.com', password: 'whatever1' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a wrong password with 401', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        passwordHash,
        emailVerifiedAt: new Date(),
      });

      await expect(service.login({ email: 'a@example.com', password: 'wrong-password' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a correct password with 403 when the email is not verified yet', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        passwordHash,
        emailVerifiedAt: null,
      });

      await expect(service.login({ email: 'a@example.com', password: 'correct-password' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('issues tokens and stores a hashed refresh token once verified', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        passwordHash,
        emailVerifiedAt: new Date(),
      });

      const tokens = await service.login({ email: 'a@example.com', password: 'correct-password' });

      expect(tokens).toEqual({ accessToken: 'signed-token', refreshToken: 'signed-token' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data.hashedRefreshToken).not.toBe('signed-token');
    });

    it('holds back tokens and returns a challenge id when the account has 2FA enabled', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        passwordHash,
        emailVerifiedAt: new Date(),
        twoFactorEnabled: true,
      });

      const result = await service.login({ email: 'a@example.com', password: 'correct-password' });

      expect(result).toEqual({ twoFactorRequired: true, challengeId: expect.any(String) });
      // No session granted yet — the password check alone must not issue tokens.
      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(redis.client.set).toHaveBeenCalledWith(
        expect.stringContaining('2fa-challenge:'),
        'user-1',
        'EX',
        300,
      );
    });
  });

  describe('verifyEmail', () => {
    it('rejects an unknown or already-used token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail({ token: 'bogus-token' })).rejects.toThrow(BadRequestException);
    });

    it('rejects an expired token', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        emailVerificationExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.verifyEmail({ token: 'expired-token' })).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('marks the user verified, clears the token, and logs them in', async () => {
      const rawToken = 'a-valid-raw-token';
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        emailVerificationExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });

      const tokens = await service.verifyEmail({ token: rawToken });

      expect(tokens).toEqual({ accessToken: 'signed-token', refreshToken: 'signed-token' });
      const [findArgs] = prisma.user.findUnique.mock.calls[0];
      expect(findArgs.where.emailVerificationTokenHash).toBe(createHash('sha256').update(rawToken).digest('hex'));

      const verifyUpdateArgs = prisma.user.update.mock.calls[0][0];
      expect(verifyUpdateArgs.data.emailVerifiedAt).toBeInstanceOf(Date);
      expect(verifyUpdateArgs.data.emailVerificationTokenHash).toBeNull();
    });
  });

  describe('resendVerification', () => {
    it('sends a new email for an existing, unverified account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com', emailVerifiedAt: null });

      await service.resendVerification({ email: 'a@example.com' });

      expect(mailService.sendMail).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });

    it('does nothing for an already-verified account, but responds the same either way', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com', emailVerifiedAt: new Date() });

      const result = await service.resendVerification({ email: 'a@example.com' });

      expect(mailService.sendMail).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'If that email is registered and unverified, a new link has been sent.' });
    });

    it('does nothing for an unknown email, but responds the same either way (no account-enumeration leak)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.resendVerification({ email: 'ghost@example.com' });

      expect(mailService.sendMail).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'If that email is registered and unverified, a new link has been sent.' });
    });
  });

  describe('refreshTokens', () => {
    it('rejects when the user has no stored refresh token (e.g. already logged out)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', hashedRefreshToken: null });

      await expect(service.refreshTokens('user-1', 'some-refresh-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a refresh token that does not match the stored hash', async () => {
      const hashedRefreshToken = await bcrypt.hash('the-real-refresh-token', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com', hashedRefreshToken });

      await expect(service.refreshTokens('user-1', 'a-different-token')).rejects.toThrow(UnauthorizedException);
    });

    it('reuses the same refresh token instead of rotating it, so concurrent refreshes stay idempotent', async () => {
      const hashedRefreshToken = await bcrypt.hash('the-real-refresh-token', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com', hashedRefreshToken });

      const result = await service.refreshTokens('user-1', 'the-real-refresh-token');

      expect(result).toEqual({ accessToken: 'signed-token', refreshToken: 'the-real-refresh-token' });
      // Two independent requests racing on the same expired access token
      // must not invalidate each other's refresh token — asserted here by
      // checking neither call writes hashedRefreshToken at all.
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('findOrCreateGoogleUser', () => {
    it('creates a new, already-verified user on first Google sign-in', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null); // no match by googleId
      prisma.user.findUnique.mockResolvedValueOnce(null); // no match by email either
      prisma.user.create.mockResolvedValue({ id: 'user-1', email: 'new@example.com' });

      const tokens = await service.findOrCreateGoogleUser({ googleId: 'google-1', email: 'new@example.com' });

      expect(tokens).toEqual({ accessToken: 'signed-token', refreshToken: 'signed-token' });
      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data).toEqual(
        expect.objectContaining({ email: 'new@example.com', googleId: 'google-1', emailVerifiedAt: expect.any(Date) }),
      );
    });

    it('links to an existing password-based account with the same email instead of making a duplicate', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null); // no match by googleId yet
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'existing-user',
        email: 'a@example.com',
        emailVerifiedAt: null,
      });
      prisma.user.update.mockResolvedValueOnce({ id: 'existing-user', email: 'a@example.com' });

      await service.findOrCreateGoogleUser({ googleId: 'google-2', email: 'a@example.com' });

      expect(prisma.user.create).not.toHaveBeenCalled();
      const linkArgs = prisma.user.update.mock.calls[0][0];
      expect(linkArgs.where).toEqual({ id: 'existing-user' });
      expect(linkArgs.data.googleId).toBe('google-2');
      // Was never verified by email — Google's own OAuth consent screen
      // just verified ownership of this address, so this account becomes
      // verified too, instead of staying permanently locked out.
      expect(linkArgs.data.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('reuses the existing account on repeat Google sign-ins, without creating or re-linking anything', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', email: 'a@example.com' });

      await service.findOrCreateGoogleUser({ googleId: 'google-1', email: 'a@example.com' });

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      // update() is still called once here — to store the new hashed
      // refresh token, same as any other login, not to re-link anything.
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      expect(prisma.user.update.mock.calls[0][0].data).toHaveProperty('hashedRefreshToken');
    });

    it('holds back tokens for a Google sign-in on an account with 2FA enabled', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', email: 'a@example.com', twoFactorEnabled: true });

      const result = await service.findOrCreateGoogleUser({ googleId: 'google-1', email: 'a@example.com' });

      expect(result).toEqual({ twoFactorRequired: true, challengeId: expect.any(String) });
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('issueOAuthCode / exchangeOAuthCode', () => {
    it('round-trips a token pair through a one-time code', async () => {
      const tokens = { accessToken: 'at', refreshToken: 'rt' };

      const code = await service.issueOAuthCode(tokens);
      const result = await service.exchangeOAuthCode(code);

      expect(result).toEqual(tokens);
      expect(redis.client.set).toHaveBeenCalledWith(expect.stringContaining(code), JSON.stringify(tokens), 'EX', 60);
    });

    it('can only be exchanged once — the code is deleted on first use', async () => {
      const code = await service.issueOAuthCode({ accessToken: 'at', refreshToken: 'rt' });

      await service.exchangeOAuthCode(code);

      await expect(service.exchangeOAuthCode(code)).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown or already-expired code', async () => {
      await expect(service.exchangeOAuthCode('never-issued')).rejects.toThrow(BadRequestException);
    });
  });

  describe('two-factor authentication', () => {
    it('setupTwoFactor stores an unconfirmed secret and returns a scannable QR code', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', email: 'a@example.com' });

      const result = await service.setupTwoFactor('user-1');

      expect(result.secret).toEqual(expect.any(String));
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data.twoFactorSecret).toBe(result.secret);
    });

    describe('enableTwoFactor', () => {
      it('rejects if setupTwoFactor was never called', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', twoFactorSecret: null });

        await expect(service.enableTwoFactor('user-1', '123456')).rejects.toThrow(BadRequestException);
      });

      it('rejects a wrong 6-digit code', async () => {
        const secret = authenticator.generateSecret();
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', twoFactorSecret: secret });

        await expect(service.enableTwoFactor('user-1', '000000')).rejects.toThrow(BadRequestException);
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('turns 2FA on and returns backup codes for a correct code, keeping only hashes in the DB', async () => {
        const secret = authenticator.generateSecret();
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', twoFactorSecret: secret });
        const validCode = authenticator.generate(secret);

        const result = await service.enableTwoFactor('user-1', validCode);

        expect(result.backupCodes).toHaveLength(8);
        const updateArgs = prisma.user.update.mock.calls[0][0];
        expect(updateArgs.data.twoFactorEnabled).toBe(true);
        expect(updateArgs.data.twoFactorBackupCodes).toHaveLength(8);
        // The stored values must be hashes, not the plaintext codes handed back once.
        expect(updateArgs.data.twoFactorBackupCodes).not.toEqual(result.backupCodes);
        expect(updateArgs.data.twoFactorBackupCodes[0]).toBe(
          createHash('sha256').update(result.backupCodes[0]).digest('hex'),
        );
      });
    });

    describe('disableTwoFactor', () => {
      it('rejects when 2FA is not currently enabled', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', twoFactorEnabled: false });

        await expect(service.disableTwoFactor('user-1', '123456')).rejects.toThrow(BadRequestException);
      });

      it('rejects an invalid code and leaves 2FA enabled', async () => {
        const secret = authenticator.generateSecret();
        prisma.user.findUniqueOrThrow.mockResolvedValue({
          id: 'user-1',
          twoFactorEnabled: true,
          twoFactorSecret: secret,
          twoFactorBackupCodes: [],
        });

        await expect(service.disableTwoFactor('user-1', '000000')).rejects.toThrow(BadRequestException);
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('turns 2FA off given a valid TOTP code', async () => {
        const secret = authenticator.generateSecret();
        prisma.user.findUniqueOrThrow.mockResolvedValue({
          id: 'user-1',
          twoFactorEnabled: true,
          twoFactorSecret: secret,
          twoFactorBackupCodes: [],
        });

        await service.disableTwoFactor('user-1', authenticator.generate(secret));

        const updateArgs = prisma.user.update.mock.calls[0][0];
        expect(updateArgs.data).toEqual({
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
        });
      });

      it('also accepts a valid backup code', async () => {
        const backupCodeHash = createHash('sha256').update('a-real-backup-code').digest('hex');
        prisma.user.findUniqueOrThrow.mockResolvedValue({
          id: 'user-1',
          twoFactorEnabled: true,
          twoFactorSecret: authenticator.generateSecret(),
          twoFactorBackupCodes: [backupCodeHash],
        });

        await expect(service.disableTwoFactor('user-1', 'a-real-backup-code')).resolves.toBeUndefined();
      });
    });

    describe('verifyTwoFactorChallenge', () => {
      it('rejects an unknown or expired challenge id', async () => {
        await expect(service.verifyTwoFactorChallenge('bogus-challenge', '123456')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('rejects a wrong code without issuing tokens', async () => {
        const secret = authenticator.generateSecret();
        await redis.client.set('2fa-challenge:chal-1', 'user-1', 'EX', 300);
        prisma.user.findUniqueOrThrow.mockResolvedValue({
          id: 'user-1',
          email: 'a@example.com',
          twoFactorSecret: secret,
          twoFactorBackupCodes: [],
        });

        await expect(service.verifyTwoFactorChallenge('chal-1', '000000')).rejects.toThrow(BadRequestException);
        expect(jwtService.signAsync).not.toHaveBeenCalled();
      });

      it('issues real tokens and consumes the challenge on a correct TOTP code', async () => {
        const secret = authenticator.generateSecret();
        await redis.client.set('2fa-challenge:chal-2', 'user-1', 'EX', 300);
        prisma.user.findUniqueOrThrow.mockResolvedValue({
          id: 'user-1',
          email: 'a@example.com',
          twoFactorSecret: secret,
          twoFactorBackupCodes: [],
        });

        const tokens = await service.verifyTwoFactorChallenge('chal-2', authenticator.generate(secret));

        expect(tokens).toEqual({ accessToken: 'signed-token', refreshToken: 'signed-token' });
        // One-time use: the challenge itself is gone after a successful redemption.
        expect(await redis.client.get('2fa-challenge:chal-2')).toBeNull();
      });

      it('accepts a backup code and removes it so it cannot be reused', async () => {
        const backupCodeHash = createHash('sha256').update('a-real-backup-code').digest('hex');
        await redis.client.set('2fa-challenge:chal-3', 'user-1', 'EX', 300);
        prisma.user.findUniqueOrThrow.mockResolvedValue({
          id: 'user-1',
          email: 'a@example.com',
          twoFactorSecret: authenticator.generateSecret(),
          twoFactorBackupCodes: [backupCodeHash],
        });

        await service.verifyTwoFactorChallenge('chal-3', 'a-real-backup-code');

        const updateArgs = prisma.user.update.mock.calls[0][0];
        expect(updateArgs.data.twoFactorBackupCodes).toEqual([]);
      });
    });
  });
});
