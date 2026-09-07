// Point Prisma at a separate database so e2e tests never touch dev data.
// Must run before AppModule (and therefore PrismaClient) is constructed —
// Jest's `setupFiles` run before the test file is even loaded, which is why
// this works even though it just mutates process.env.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://budget_app:budget_app_dev@localhost:5432/budget_app_test?schema=public';
