import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

function uniqueEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok', service: 'api' });
  });

  describe('auth', () => {
    const email = uniqueEmail('auth');
    const password = 'supersecret123';

    it('registers a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('rejects registering the same email twice', () => {
      return request(app.getHttpServer()).post('/auth/register').send({ email, password }).expect(409);
    });

    it('rejects login with the wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
    });

    it('logs in with the correct password', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
      expect(res.body).toHaveProperty('accessToken');
    });
  });

  describe('projects: ownership, plan limits, and sharing', () => {
    let ownerToken: string;
    let memberToken: string;
    let memberEmail: string;
    let strangerToken: string;
    let projectId: string;

    beforeAll(async () => {
      const owner = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: uniqueEmail('owner'), password: 'supersecret123' });
      ownerToken = owner.body.accessToken;

      memberEmail = uniqueEmail('member');
      const member = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: memberEmail, password: 'supersecret123' });
      memberToken = member.body.accessToken;

      const stranger = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: uniqueEmail('stranger'), password: 'supersecret123' });
      strangerToken = stranger.body.accessToken;
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
