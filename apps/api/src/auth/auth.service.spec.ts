import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

function makePrismaMock() {
  return {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
}

function makeJwtServiceMock() {
  return { signAsync: jest.fn().mockResolvedValue('signed-token') } as any;
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let jwtService: ReturnType<typeof makeJwtServiceMock>;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrismaMock();
    jwtService = makeJwtServiceMock();
    service = new AuthService(prisma as any, jwtService);
  });

  describe('register', () => {
    it('rejects a duplicate email with 409', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register({ email: 'taken@example.com', password: 'supersecret123' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password before storing it (never stores it in plain text)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-1', email: 'new@example.com' });

      await service.register({ email: 'new@example.com', password: 'supersecret123' });

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).not.toBe('supersecret123');
      expect(await bcrypt.compare('supersecret123', createArgs.data.passwordHash)).toBe(true);
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
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com', passwordHash });

      await expect(service.login({ email: 'a@example.com', password: 'wrong-password' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('issues tokens and stores a hashed refresh token on success', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com', passwordHash });

      const tokens = await service.login({ email: 'a@example.com', password: 'correct-password' });

      expect(tokens).toEqual({ accessToken: 'signed-token', refreshToken: 'signed-token' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data.hashedRefreshToken).not.toBe('signed-token');
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
