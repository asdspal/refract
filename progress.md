# Refract — Implementation Progress Log

Toolchain now installed (user-space, no sudo):
- Solana CLI 4.3.2 + cargo-build-sbf 4.4.0 + platform-tools v1.57 (`~/.local/share/solana`)
- Anchor CLI 1.2.2 (`~/.cargo/bin/anchor`)
- Circom 2.2.3 (`~/.cargo/bin/circom`; v2.2.2 prebuilt unavailable)
- `circomlib` 2.0.5 npm dev dependency
- Docker Postgres 16.15 on `localhost:5433`; system Chrome for Playwright

Wallets: devnet deployer `Eu5JuwNr6FjHAZjCtuXMZnhY9Qk8tTrQuVHtwmTzyp3F`
(`SOLANA_DEPLOYER_PUBKEY` in `.env`; keypair at `~/.config/solana/id.json`).
Serverless Redis: Upstash (REST) configured via `UPSTASH_REDIS_REST_URL/TOKEN`.

## Milestone 0: Foundation & Validation

### ✅ Step 0.1: Monorepo, Pinned Dependencies & Anchor Scaffold — COMPLETE

- [x] Directory structure (`programs/refract_vault`, `circuits`, `src`, `tests`, `scripts`, `blueprint`)
- [x] `package.json` with exact pinned dependencies (`npm install --legacy-peer-deps`)
- [x] `Anchor.toml`, `Cargo.toml`, `programs/refract_vault/Cargo.toml`
- [x] `ping_vault` scaffold instruction + `VaultPinged` event (`cargo check` passes)
- [x] `.env.example` (23 variables, includes `SOLANA_DEPLOYER_PUBKEY`) and `.env`
- [x] `tests/unit/env-and-versions.test.ts`, `tests/anchor/scaffold.test.ts` — 9/9 pass
- [x] `anchor build` succeeds; program deployed and verified on local `solana-test-validator`
      (Program ID `HyeAVxJxt37ndAE2LJBKJ36j8vKLv6PezvwxA2NsmhvH`, Owner BPFLoaderUpgrade, 52,296 bytes)
- [x] `tests/anchor/ping-vault.test.ts` — real on-chain `ping_vault` invocation on a throwaway
      local validator: **1,036 CU** (< 5,000), deploy + invoke + teardown automated
- [x] Devnet deployed: `anchor program deploy --provider.cluster devnet`
      (slot 519982867, 52,296 bytes, BPFLoaderUpgrade)
      https://explorer.solana.com/address/HyeAVxJxt37ndAE2LJBKJ36j8vKLv6PezvwxA2NsmhvH?cluster=devnet
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
- [x] `src/lib/x402/runtimeKeyMeter.ts` — Postgres atomic `UPDATE ... RETURNING` fallback,
      per-request cap, daily cap, rollback
- [x] `tests/integration/db-schema-and-meter.test.ts` — 7/7 pass (PostgreSQL 16.15 in Docker on :5433)
      incl. 10-way concurrency => exactly 3 succeeds / 7 insufficient, and $2.50 vs $0.10 cap blocked with 0 deducted
- [x] SEC-04 verified: 0 FKs between `intent_deposits` and `zk_runtime_sessions`
- [x] `npx tsc --noEmit` clean
- [x] Git commit

- [x] Upstash Redis Lua fast path (serverless REST, Vercel-friendly): atomic authorize,
      seed-on-miss from Postgres, synchronous write-through, compensating rollback,
      automatic Postgres fallback on Redis outage
- [x] `tests/integration/runtime-key-redis.test.ts` — 7/7 pass against live Upstash
      (atomic deduction + write-through, 10-way race = exactly 3, rollback both stores, forcePostgres,
      cap block, unknown key)
- [x] Latency measured locally: **p50 42ms / p95 55ms** (local -> Upstash -> Postgres).
      The 15ms p95 NFR must be re-measured on Vercel colocated with Upstash/Neon (`TEST-PERF-001`).
- [x] Git commit

ponytail: Redis write-through is synchronous for durability; move it to Next.js `after()` only
if Vercel p95 needs the extra milliseconds.

### ✅ Step 0.4: Hour-1 Spike, BN254 Serializer & Telemetry Endpoints — COMPLETE

- [x] `src/lib/zkapi/bn254Serializer.ts` — BE 32-byte encoding, G1 y-negation mod q, EIP-197 G2 order, Poseidon commitment
- [x] `blueprint/spikes/verify_stack.ts` — live Aurora check: **READY_FOR_BUILD**, 216 tokens / 39 chains / 596ms
- [x] `GET /api/v1/health` and `GET /api/v1/defi/vault-stats` with `X-Correlation-Id`
- [x] `blueprint/openapi.yaml` — Redocly lint: **valid, 0 errors** (5 warnings)
- [x] `tests/unit/crypto-parity.test.ts` (8) + `tests/integration/health-and-stats.test.ts` (2) pass
- [x] Full suite: **40/40 tests pass** (unit + integration + anchor); `npx tsc --noEmit` clean
- [x] Git commit

**Milestone 0 COMPLETE.** Open deviation: `npm audit` transitive advisories (no upstream fix).
Next: Milestone 1 (Step 1.1).
