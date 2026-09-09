import { ConflictException, ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

function makePrismaMock() {
  return {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
}

function makeJwtServiceMock() {
  return { signAsync: jest.fn().mockResolvedValue('signed-token') } as any;
}

function makeMailServiceMock() {
  return { sendMail: jest.fn().mockResolvedValue(undefined) };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let jwtService: ReturnType<typeof makeJwtServiceMock>;
  let mailService: ReturnType<typeof makeMailServiceMock>;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrismaMock();
    jwtService = makeJwtServiceMock();
    mailService = makeMailServiceMock();
    service = new AuthService(prisma as any, jwtService, mailService as any);
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
  });
});
