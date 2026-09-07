# build-budget-app

A budgeting and documentation tracker for people managing a house construction project — projects, stages, expenses vs. planned budget, documents, and (planned) bank-ready PDF reports.

Monorepo: Next.js (`apps/web`) + Nest.js (`apps/api`), PostgreSQL + Redis via Docker.

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, TanStack Query, Recharts
- **Backend:** Nest.js, TypeScript, Prisma, PostgreSQL
- **Auth:** JWT access + refresh tokens (Passport.js)
- **Infra (planned):** Redis + BullMQ (background jobs), AWS S3 (file uploads), Stripe (billing), WebSockets (real-time collaboration)

## Getting started

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Start Postgres and Redis
npm run docker:up

# 3. Install dependencies (root + both workspaces)
npm install

# 4. Generate the Prisma client and apply the schema
cd apps/api
npx prisma generate
npx prisma migrate dev --name init
cd ../..

# 5. Run backend and frontend (two terminals)
npm run dev:api
npm run dev:web
```

Frontend: http://localhost:3000
API health check: http://localhost:4000/health

To test Stripe webhooks locally, forward events with the [Stripe CLI](https://docs.stripe.com/stripe-cli): `stripe listen --forward-to localhost:4000/billing/webhook` (its output gives you `STRIPE_WEBHOOK_SECRET`).

## Project structure

```
apps/
  web/    -> Next.js (App Router, TS, Tailwind, React Query, Recharts)
  api/    -> Nest.js (Prisma, PostgreSQL, Redis/BullMQ, JWT auth)
docker-compose.yml -> Postgres + Redis + Mailpit (dev SMTP catcher, UI at http://localhost:8025) for local development
```

## Status

- [x] Auth (JWT + refresh tokens) — `POST /auth/register`, `/login`, `/refresh`, `/logout`
- [x] Projects / Stages / Expenses CRUD — `/projects`, `/projects/:id/stages`, `/projects/:id/expenses`, `/projects/:id/summary`
- [x] Document uploads (S3 presigned URLs) — `/projects/:id/documents`, `/documents/presign`
- [x] Background jobs (BullMQ) — async PDF bank reports: `POST /projects/:id/reports`, `GET /projects/:id/reports[/:reportId]`
- [x] Notifications — daily deadline check (BullMQ + `@nestjs/schedule`) emails a reminder for tasks due within 3 days; `POST /notifications/check-deadlines-now` to trigger on demand
- [x] Billing (Stripe) — free plan limited to 1 project; `POST /billing/checkout-session`, `GET /billing/status`, `POST /billing/webhook`
- [x] Benchmark stats — nightly anonymized cost-per-m² aggregation, cached in Redis; public `GET /benchmark[?region=&stageCategory=]`, `POST /benchmark/recompute-now`
- [x] Real-time collaboration (WebSockets) — project sharing (`POST /projects/:id/members`, owner/editor roles) + a Socket.io gateway that pushes live stage/expense changes to everyone viewing that project
