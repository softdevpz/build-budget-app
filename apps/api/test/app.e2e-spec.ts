import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DEFAULT_PASSWORD = 'supersecret123!';

function uniqueEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

describe('App (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  // Registration only sends a verification email — there's no inbox to read
  // in this test environment, so we mark the account verified directly via
  // Prisma, the same way clicking the email link would via /auth/verify-email.
  async function registerAndVerify(email: string, password = DEFAULT_PASSWORD) {
    await request(app.getHttpServer()).post('/auth/register').send({ email, password }).expect(201);
    await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
  }

  async function registerVerifyAndLogin(email: string, password = DEFAULT_PASSWORD): Promise<string> {
    await registerAndVerify(email, password);
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return res.body.accessToken;
  }

  it('GET /health', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok', service: 'api' });
  });

  describe('auth', () => {
    const email = uniqueEmail('auth');

    it('registers a new user but does not log them in yet', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: DEFAULT_PASSWORD })
        .expect(201);

      expect(res.body).not.toHaveProperty('accessToken');
      expect(res.body.message).toMatch(/verify/i);
    });

    it('rejects registering the same email twice', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: DEFAULT_PASSWORD })
        .expect(409);
    });

    it('rejects a password with no digit or special character', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: uniqueEmail('weak-pw'), password: 'onlylowercase' })
        .expect(400);
    });

    it('rejects login before the email is verified', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: DEFAULT_PASSWORD })
        .expect(403);
    });

    it('rejects an invalid verification token', () => {
      return request(app.getHttpServer()).post('/auth/verify-email').send({ token: 'not-a-real-token' }).expect(400);
    });

    it('rejects login with the wrong password (once verified)', async () => {
      await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });

      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong-password1!' })
        .expect(401);
    });

    it('logs in with the correct password once verified', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: DEFAULT_PASSWORD })
        .expect(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('resend-verification always responds the same way, whether or not the email exists', async () => {
      const knownRes = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email })
        .expect(200);
      const unknownRes = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: uniqueEmail('ghost') })
        .expect(200);

      expect(knownRes.body).toEqual(unknownRes.body);
    });
  });

  describe('projects: ownership, plan limits, and sharing', () => {
    let ownerToken: string;
    let memberToken: string;
    let memberEmail: string;
    let strangerToken: string;
    let projectId: string;

    beforeAll(async () => {
      ownerToken = await registerVerifyAndLogin(uniqueEmail('owner'));
      memberEmail = uniqueEmail('member');
      memberToken = await registerVerifyAndLogin(memberEmail);
      strangerToken = await registerVerifyAndLogin(uniqueEmail('stranger'));
    });

    it('rejects unauthenticated requests', () => {
      return request(app.getHttpServer()).get('/projects').expect(401);
    });

    it('creates the first project for a free-plan user', async () => {
      const res = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Dom nad jeziorem' })
        .expect(201);

      projectId = res.body.id;
      expect(projectId).toBeDefined();
    });

    it('blocks a second project on the free plan with 402', () => {
      return request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Drugi dom' })
        .expect(402);
    });

    it("hides the project from a user who isn't a member (404, not 403)", () => {
      return request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(404);
    });

    it('lets the owner invite a member by email', () => {
      return request(app.getHttpServer())
        .post(`/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: memberEmail })
        .expect(201)
        .expect((res) => {
          expect(res.body.role).toBe('editor');
        });
    });

    it('lets the invited member access the project afterwards', () => {
      return request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });

    it('lets the invited member create a stage (editor permission)', () => {
      return request(app.getHttpServer())
        .post(`/projects/${projectId}/stages`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Fundamenty', order: 1 })
        .expect(201);
    });

    it('still hides the project from an unrelated stranger', () => {
      return request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(404);
    });

    it("does not let a non-owner member invite others (403 — they're a member, just not the owner)", () => {
      return request(app.getHttpServer())
        .post(`/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ email: uniqueEmail('third') })
        .expect(403);
    });

    it('does not let a non-owner member delete the project', () => {
      return request(app.getHttpServer())
        .delete(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('lets the owner delete the project', () => {
      return request(app.getHttpServer())
        .delete(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
    });
  });
});
