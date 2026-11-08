# Refract — Implementation Progress Log

Environment note: this machine has Node 26, Rust 1.96, Docker, and system Chrome.
Solana CLI / Anchor CLI / Circom are NOT installed, so on-chain Devnet deployment
in Steps 0.1 and 1.x is toolchain-gated; TypeScript, Rust (`cargo check`), Docker
Postgres/Redis, and Playwright runs are executed.

## Milestone 0: Foundation & Validation

### ✅ Step 0.1: Monorepo, Pinned Dependencies & Anchor Scaffold — COMPLETE

- [x] Directory structure (`programs/refract_vault`, `circuits`, `src`, `tests`, `scripts`, `blueprint`)
- [x] `package.json` with exact pinned dependencies (`npm install --legacy-peer-deps`)
- [x] `Anchor.toml`, `Cargo.toml`, `programs/refract_vault/Cargo.toml`
- [x] `ping_vault` scaffold instruction + `VaultPinged` event (`cargo check` passes)
- [x] `.env.example` (22 variables) and `.env`
- [x] `tests/unit/env-and-versions.test.ts`, `tests/anchor/scaffold.test.ts` — 9/9 pass
- [ ] Toolchain-gated: `anchor build` / Devnet deployment (no Solana CLI)
- [x] Git commit `chore(init): step 0.1 monorepo, pinned deps and anchor scaffold`

Deviation: `npm audit` reports transitive vulnerabilities from the Aurora swap
widget / TON SDK trees (no upstream fix available); direct pinned deps are clean.

### ✅ Step 0.2: Testing Frameworks & WCAG 2.2 AA Tokens — COMPLETE

- [x] `vitest.config.ts`, `playwright.config.ts` (system Chrome channel for a11y)
- [x] `scripts/verify_contrast.mjs` — 13/13 pairs pass AA (text >= 4.5, borders >= 3.0)
- [x] `blueprint/design-tokens.json` + `src/app/globals.css` + `src/app/layout.tsx` + `src/app/page.tsx`
- [x] `tests/unit/tokens.test.ts` — 5/5 pass
- [x] `tests/e2e/a11y.spec.ts` — 6/6 pass (0 axe violations at 1440px & 375px, 44px targets, no overflow)
- [x] Git commit

### ✅ Step 0.3: PostgreSQL 16 Schema + Migrations & Atomic Spend Meter — COMPLETE

- [x] `blueprint/schema.sql` — 6 tables, 8 named indexes, CHECK constraints, seed (2 merchants, 1 snapshot)
- [x] Reversible migrations (`0001_init_refract_schema.up.sql` / `.down.sql`)
- [x] `src/db/index.ts` (pg Pool + health check), `scripts/migrate.ts`
- [x] `src/lib/x402/runtimeKeyMeter.ts` — atomic `UPDATE ... RETURNING`, per-request cap, daily cap, rollback
- [x] `tests/integration/db-schema-and-meter.test.ts` — 7/7 pass (PostgreSQL 16.15 in Docker on :5433)
      incl. 10-way concurrency => exactly 3 succeeds / 7 insufficient, and $2.50 vs $0.10 cap blocked with 0 deducted
- [x] SEC-04 verified: 0 FKs between `intent_deposits` and `zk_runtime_sessions`
- [x] `npx tsc --noEmit` clean
- [x] Git commit

ponytail: spend meter is a single Postgres atomic UPDATE path (correct + race-safe).
Add the Upstash Redis Lua fast path when measured p95 exceeds the 15ms NFR.
