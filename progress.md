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

## Milestone 1: Circom Circuit & Solana Anchor RefractVault

### ✅ Step 1.1: Depth-20 Circom Circuit & groth16-solana Verifying Key — COMPLETE

- [x] `circuits/refract_note_spend.circom` — Poseidon(1) nullifier, Poseidon(3) commitment,
      depth-20 Poseidon Merkle inclusion with boolean path indices, `LessEqThan(64)` spend cap,
      quadratic session-key binding; 4 public inputs in groth16-solana order
- [x] `scripts/compile_circuit.mjs` — compiles WASM/R1CS, generates pot14 locally (Hermez CDN
      returned 403), deterministic Phase-2 zkey, exports `.wasm`/`.zkey` to `public/circuits/`,
      and emits `programs/refract_vault/src/verifying_key.rs`
- [x] `src/lib/zkapi/merkleTree.ts` — Poseidon helpers, zero hashes, tree build, Merkle proof
- [x] `tests/unit/circuit-prover.test.ts` — 3/3 pass: valid proof verifies, over-cap rejected,
      tampered public input rejected. Node `fullProve` ~2.4s (first) / ~1.8s
- [x] `anchor build` compiles with the generated `VERIFYING_KEY` (5 IC points)
- [x] `npx tsc --noEmit` clean
- [x] Git commit

### ✅ Step 1.2: Zero-Copy ZkYieldVault & Incremental Depth-20 Poseidon Tree — COMPLETE

- [x] `programs/refract_vault/src/state.rs` — zero-copy `ZkYieldVault` (1,824 B; 8-byte discriminator → 1,832 B account) + `NullifierRecord`
- [x] `programs/refract_vault/src/zero_hashes.rs` — 21 canonical Poseidon zero-subtree hashes (generated by compile script)
- [x] `programs/refract_vault/src/merkle.rs` — incremental Tornado-style insert (20 hashes) using the
      **Solana native Poseidon syscall** (`solana-poseidon` `hashv`, BN254 X5, big-endian); host fallback identical
- [x] `initialize_vault` (vault + liquid USDC token account PDAs) and `deposit_and_commit`
- [x] `tests/anchor/helpers.ts` — reusable local-validator + deploy + provider harness
- [x] `tests/anchor/merkle-vault.test.ts` — 3/3 pass: empty root in history, deposit root == circomlibjs root,
      second deposit preserves prior roots in the ring buffer
- [x] `deposit_and_commit` measured at **30,325 CU** (target < 85,000)
- [x] Program upgraded on Devnet (slot 519990494, 178,928 bytes)
- [x] `anchor build` + `npx tsc --noEmit` clean
- [x] Git commit

### ✅ Step 1.3: On-Chain Groth16 Settlement & Nullifier PDA — COMPLETE

- [x] `settle_zk_spend` — checks `merkle_root` is in the 32-root history, verifies the
      `groth16-solana` BN254 proof (`Groth16Verifier::<4>`), and `init`s a `NullifierRecord` PDA
      seeded by the nullifier hash
- [x] **SPK-01 byte-layout bug found and fixed**: proof A is negated, proof B/C are not
      (`serializeGroth16ProofForSolana` previously negated C). Verified against the
      groth16-solana reference `proof_parser`/`vk/circom` conventions.
- [x] `tests/anchor/zk-spend-verifier.test.ts` — 2/2 pass: real snarkjs proof verifies on-chain in
      **106,253–112,253 CU** (<= 140,000), replay rejected, tampered public input rejected with
      `InvalidGroth16Proof` and no PDA created
- [x] Program upgraded on Devnet (slot 519991966, 208,240 bytes)
- [x] `anchor build` + `tsc` clean; M1 tests 20/20
- [x] Git commit

### ✅ Step 1.4: 90/10 DeFi Float Router, Merchant PDA & Chain-Rebuild DR — COMPLETE

- [x] `initialize_vault` now also creates the `defi_yield_vault` token PDA
- [x] `rebalance_defi_float` — 90% staked / 10% liquid, SPL CPI signed by the vault PDA,
      emits `DefiFloatRebalanced`
- [x] `MerchantAccount` PDA + `initialize_merchant` + `settle_merchant_revenue`
- [x] `src/lib/defi/floatRouter.ts` (DB telemetry helper) and `scripts/rebuild_from_chain.ts`
      (parses `DepositCommitted` Anchor events → upserts `merkle_leaves`, idempotent)
- [x] `tests/anchor/defi-float-and-dr.test.ts` — 3/3 pass: exact 90/10 split and no-op rebalance,
      merchant PDA + revenue settlement, chain rebuild (`RPO=0`) with correct commitment/root and < 30s
- [x] Program upgraded on Devnet (slot 519992884, 264,232 bytes)
- [x] Full suite: **51/51 tests pass**; `tsc` clean
- [x] Git commit

**Milestone 1 COMPLETE.** Next: Milestone 2 (Aurora intents + optimistic credit).

## Milestone 2: Aurora Intents, Optimistic Credit & Refunds

### ✅ Step 2.1: Aurora 1Click Quote Service & `POST /api/v1/intents/quote` — COMPLETE

- [x] `src/lib/aurora/oneClickService.ts` — `buildQuoteRequest` (Confidential Intents `confidentiality: "basic"`
      when JWT present, 30 bps `appFees`, Solana USDC destination), live `OneClickService.getQuote`,
      idempotent persistence by commitment, 300s token cache
- [x] `POST /api/v1/intents/quote` with Zod validation, `X-Correlation-Id`, and typed errors
- [x] `tests/integration/aurora-quote.test.ts` — 8/8 pass, incl. live public quote (`~979ms`) and
      route-level live quote; confidential payload + 30 bps fee asserted with an injected quote fn
- [x] Devnet/base asset IDs confirmed: Base USDC `nep141:base-0x8335...`, Solana USDC `nep141:sol-5ce3...`
- [ ] **Prerequisite for R-002 live:** Aurora returns `401 User authentication is required for confidential
      intent quotes`; set `AURORA_STUDIO_JWT_TOKEN` to enable confidential live quotes. Public live quotes work now.
- [x] `tsc` clean; git commit

### ✅ Step 2.2: `<400ms` Optimistic Float Credit Engine — COMPLETE

- [x] `src/lib/defi/optimisticCreditEngine.ts` — atomic `FOR UPDATE` quote lock, $5.00 cap (BR-03),
      80% liquid-reserve circuit breaker (BR-04), +8.4% subsidy, 24h optimistic session
- [x] Deterministic optimistic nullifier + `rk_live_opt_*` key; lazy Redis seed via the meter
- [x] `revokeOptimisticCreditOnFailure` — REVOKED session + Redis eviction + deposit FAILED/REFUNDED
- [x] Meter adds `ERR_OPTIMISTIC_SESSION_REVOKED` for revoked sessions (Redis + Postgres paths)
- [x] `POST /api/v1/intents/optimistic-credit` with Zod validation
- [x] `tests/integration/optimistic-credit.test.ts` — 5/5 pass: $5 cap + 420k bonus, issue latency
      **~335ms** (<= 400ms), duplicate 409, revocation blocks spend, 80% breaker, route 200
- [x] `tsc` clean; git commit

### ✅ Step 2.3: SolanaAnchorDepositWorker & `GET /api/v1/zkapi/tree` — COMPLETE

- [x] `src/lib/zkapi/depositEvent.ts` — shared Anchor `DepositCommitted` log decoder
- [x] `src/lib/workers/solanaDepositWorker.ts` — polls pending deposits, calls Aurora status,
      on SUCCESS → `deposit_and_commit` + `rebalance_defi_float`, upserts `merkle_leaves`,
      upgrades the optimistic session (`is_optimistic=false`, 10 bps fast-fill fee, full balance),
      invalidates the Merkle cache; on REFUNDED/FAILED → revokes optimistic credit
- [x] `GET /api/v1/zkapi/tree` — leaves + current root + next index, Upstash cache (60s),
      invalidated by the worker
- [x] `tests/integration/deposit-worker-and-tree.test.ts` — 2/2 pass: SUCCESS settlement,
      on-chain root == circomlibjs root, session upgraded (9.99M principal / 10.41M remaining),
      tree endpoint **86ms**; REFUNDED revokes the session
- [x] `tsc` clean; git commit
