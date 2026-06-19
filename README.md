# Fintech Wallet - QA Automation System

A QA automation system for a fintech wallet/payment platform, built around an Express-based sandbox API and Playwright test suite. Demonstrates test coverage strategy, framework design, and CI quality gates.

> **Note:** This repo uses an Express-based sandbox API (`server/`) that emulates backend behavior – JWT auth, payment flows, KYC gates, webhooks, notifications. In a real project setup, the same framework can target dev/staging environments via environment variables.

---

## Tech Stack

| Layer | Tools |
|-------|-------|
| Test runner | Playwright (TypeScript) |
| API contract checks | Newman / Postman |
| Performance | k6 |
| Security | OWASP ZAP (separate repo) |
| Test management | Qase |
| Reporting | Allure + Playwright HTML |
| CI/CD | GitHub Actions |
| Alerts | Slack |

---

## Test Suite – 153 active tests

```
tests/
├── api/           116 tests – Playwright request context
│   ├── auth.spec.ts             (10)  login, JWT, SQL injection, JWT tamper
│   ├── auth.register.spec.ts    (11)  register, logout, token blacklist
│   ├── payments.spec.ts         (27)  initiate, webhook, IDOR, idempotency
│   ├── transactions.spec.ts     (28)  list, filters, pagination, CSV/PDF export
│   ├── account.spec.ts           (8)  balance, KYC status
│   ├── admin.spec.ts            (13)  user management, KYC queue, role guards
│   ├── notifications.spec.ts    (14)  list, unread count, mark read, KYC webhook
│   └── error-scenarios.spec.ts   (5)  503 simulation, partial failures
│
├── ui/             22 tests – browser-based with Page Object Model
│   ├── login.spec.ts             (4)  form, redirect, error, auth guard
│   ├── dashboard.spec.ts         (6)  balance card, KYC badge, nav, logout
│   ├── payment.spec.ts           (5)  form, success, reset, KYC block
│   ├── history.spec.ts           (5)  table, filter, row schema, export
│   └── auth.storage.spec.ts      (2)  localStorage + httpOnly cookie
│
├── e2e/            15 tests – critical business journeys (API chains)
│   └── e2e.spec.ts              (15)  full payment flow, KYC gate, IDOR,
│                                      idempotency, admin flows, CSV export
│
├── fixtures/
│   └── baseTest.ts              extended test with auth + POM fixtures
│
├── pages/
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   ├── PaymentPage.ts
│   └── HistoryPage.ts
│
└── [external coverage references – skipped stubs]
    ├── contract/   PACT contract tests     → playwright-tests-new
    ├── visual/     Percy visual regression  → playwright-tests-new
    ├── a11y/       axe WCAG 2.1 AA         → playwright-tests-new
    ├── db/         PostgreSQL assertions    → api-db-tests
    ├── performance/ k6 scenarios           → k6/payment-load.js
    └── security/   OWASP ZAP              → zap-security-tests
```

---

## Sandbox API

The `server/` directory contains an Express API that emulates a fintech backend:

**Endpoints:** Auth (login, register, logout) · Payments (initiate, get, webhook) · Transactions (list, filter, export) · Account (balance, KYC status) · Admin (users, KYC queue) · Notifications · GraphQL (transactions, balance) · Webhooks (payment, KYC)

**Test users:**

| Email | Role | KYC | Balance |
|-------|------|-----|---------|
| user@test.com | user | approved | 1250 EUR |
| kyc-pending@test.com | user | pending | – |
| user-b@test.com | user | approved | 800 EUR |
| admin@test.com | admin | – | – |

---

## Local Setup

**Prerequisites:** Node.js 20+

```bash
# Install dependencies
npm ci

# Install Playwright browsers
npx playwright install chromium

# Run all tests (server starts automatically via webServer config)
npm test

# Run by layer
npm run test:smoke        # @smoke – 27 tests (PR gate)
npm run test:api          # API tests only
npm run test:ui           # UI tests only
npm run test:e2e          # E2E business chains

# Newman contract validation
npm run newman

# k6 performance (quick)
k6 run --vus 2 --duration 30s k6/payment-load.js

# k6 full profile (5 min, 20 VU)
k6 run k6/payment-load.js
```

---

## CI Pipeline

| Trigger | Job | What runs | Time |
|---------|-----|-----------|------|
| Pull Request | `smoke` | Newman + @smoke (27 tests) | ~3 min |
| Push to `main` | `regression` | Newman + full suite + Qase Test Run | ~15 min |
| Nightly 06:00 UTC | `regression` + `performance` | Full suite + k6 | ~22 min |
| Manual `prod-smoke` | `prod-smoke` | @prod-smoke (20 tests, GET-only) | ~2 min |
| Manual `security` | `security` | OWASP ZAP baseline scan on staging, release gate on confirmed High/Critical findings | ~45 min |

**Environment targeting (real project setup):**

```
Pull Request → Local sandbox / Dev-like env   smoke gate before merge
Push main   → Dev or Staging                  regression before release
Nightly     → Staging                         overnight regression + performance
Manual      → Prod                            post-deploy read-only smoke
```

**Tags:**
- `@smoke` – 27 tests, runs on every PR
- `@prod-smoke` – 20 tests, GET-only, safe for production

---

## Page Object Model

UI tests use POM via shared fixture in `tests/fixtures/baseTest.ts`. Each page has a dedicated class in `tests/pages/` with typed locators and action methods. Tests receive page objects as fixture parameters – no raw selectors in test files.

---

## Contract Validation (Newman)

`postman/fintech-collection.json` – 15 requests, 30 assertions.

Covers REST + GraphQL endpoints. Runs before every Playwright suite in CI as a fast contract gate (~30 sec).

---

## Performance (k6)

`k6/payment-load.js` – lightweight performance regression, not a stress test.

- **Profile:** 20 VU · 5 min total (ramp-up → sustained → ramp-down)
- **Endpoints:** GET /account/balance · GET /transactions · POST /payments/initiate
- **SLA thresholds:** `p95 < 500ms` · `error rate < 1%`
- Runs against sandbox only – no real financial transactions

---

## Related Repositories

| Repo | What's there |
|------|-------------|
| [playwright-tests-new](https://github.com/roman-captain/playwright-tests-new) | Percy visual regression, axe accessibility (WCAG 2.1 AA), PACT contracts, AI pipeline (DeepEval + LLM Judge) |
| [api-db-tests](https://github.com/roman-captain/api-db-tests) | PostgreSQL DB assertions – API response vs database state |
| [k6-petstore](https://github.com/roman-captain/k6-petstore) | k6 performance testing patterns, reused here for the fintech k6 profile |
| [zap-security-tests](https://github.com/roman-captain/zap-security-tests) | OWASP ZAP DAST security scanning |
