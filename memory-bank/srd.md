# Refract — System Requirements Document (`srd.md`)

**Version:** 2.0.0
**Date:** November 7, 2026
**Status:** LOCKED FOR IMPLEMENTATION
**Companion Artifacts:** `blueprint/schema.sql`, `blueprint/openapi.yaml`, `blueprint/.env.example`, `blueprint/traceability.csv`, `blueprint/models/load_and_cost.py`, `blueprint/reviews/adversarial.md`, `blueprint/reviews/verification.md`

---

## 1. Summary

- **System Architecture:** **Modular Monolith** built on Next.js `15.2.4` (App Router UI + Node.js API Gateway), backed by a Solana **Anchor `1.2.2`** smart contract workspace (`RefractVault` with `groth16-solana` `0.2.0` and `light-poseidon` `0.4.1`), **Neon Serverless PostgreSQL `16.4`** (public Poseidon Merkle leaf cache & Schnorr usage ledger), **Upstash Redis `7.2`** (atomic `<15ms` Lua runtime-key spend meter), and **Aurora Intents** (`@defuse-protocol/one-click-sdk-typescript` `0.1.26` + `@aurora-is-near/intents-swap-widget` `7.24.0`).
- **Scale & Performance Targets (`COMPUTED` & `SOURCED`):**
  - **Throughput:** `0.15 RPS` peak at `1x` (150 DAU), `2.85 RPS` peak at `10x` (1,500 DAU), `42.50 RPS` peak at `100x` (15,000 DAU, `900,000` x402 calls/day).
  - **Latency Targets:** `<= 15 ms` (p95) `x402` Runtime-Key authorization (`NFR-001`), `<= 400 ms` (p95) Optimistic Cross-Chain Float Credit issuance (`NFR-002`), `<= 2,200 ms` (p95) browser WebWorker Groth16 proof generation (`NFR-003`), and `<= 140,000 CU` on-chain Solana Groth16 verification (`NFR-004`).
- **Three Riskiest Technical Assumptions:**
  1. `RA-01 (Endianness & G1 Negation):` Browser `snarkjs` `0.7.6` little-endian field elements and `proof_a` G1 point must be converted to big-endian with negated y-coordinate modulo BN254 prime $q$ for `groth16-solana` `0.2.0` (`SPK-01`).
  2. `RA-02 (Optimistic Float Safety):` Fronting up to `$5.00` from the Solana 10% Liquid Reserve upon origin-chain transaction broadcast (`R-010`) requires verifying that `originTxHash` exists on the origin RPC and revoking the key if Aurora `GET /status` transitions to `REFUNDED` or `FAILED`.
  3. `RA-03 (Mainnet Micro-Liquidity):` NEAR Intents / Aurora `1Click API` operates strictly on Mainnet (`VERIFIED`: `docs.near-intents.org`), requiring a `$15–$25` Mainnet USDC pool for live E2E execution (`ADR-006`).
- **Readiness Status:** **CONDITIONAL READY** — Static verification checks (traceability with `0` orphans, WCAG 2.2 AA contrast calculation, `.env.example` 100% match, and live package registry version checks) PASS; local database DDL execution (`psql -f schema.sql`) and Anchor SVM test execution (`anchor test`) are queued for immediate execution via the commands in Section 15.

---

## 2. Scope, Conventions, Priority Levels, and Gap Scan

### 2.1 Gap Scan Between PRD, Design Spec, and UI Spec (Work Order #1)
| Gap / Conflict ID | Source Documents Compared | Finding Description | Resolution Applied in SRD |
| :--- | :--- | :--- | :--- |
| **GS-01** | `prd.md` vs. `design-spec.md` | Encode track permits Solana Devnet, whereas Aurora Intents requires a live non-mocked flow and `1Click API` is Mainnet-only. | Configured dual-cluster deployment via `NEXT_PUBLIC_SOLANA_NETWORK` (`devnet` for CI unit tests, `mainnet-beta` with `$20` real USDC for live Aurora Intents demo). |
| **GS-02** | `ui-spec.md` vs. `schema.sql` | Screen 3 (`/merchant`) displays merchant `x402` revenue and DeFi yield, requiring an explicit merchant entity and receipt foreign key. | Added `x402_merchants` table and `idx_x402_receipts_merchant_created` index in `schema.sql` (`R-007`, `R-009`). |
| **GS-03** | `prd.md` (`R-004`) vs. `srd.md` Audit Logging | Standard SRD audit logging records client IP and user ID on API calls, which would violate `zkAPI` unlinkability (`R-004`, `R-015`). | Enforced a **Zero-Correlation Logging Rule** in Section 13: `x402` endpoints strip client IP headers and never join `intent_deposits` to `zk_runtime_sessions`. |

### 2.2 Priority Levels & Terminology
- **`P0 (Must Have — MVP Blocker):`** `R-001` through `R-010`, `R-012`, `R-016`.
- **`P1 (Should Have — High Judge Impact):`** `R-011`, `R-013`, `R-014`, `R-015`, `R-017`.
- **`P2 (Could Have — Post-Weekend Checkpoint):`** Multi-merchant NPM SDK wrapper (`@refract402/middleware`).
- **`P3 (Won't Have — Explicitly Excluded):`** `R-018` (Native mobile binaries, custom governance token).

---

## 3. Architecture and Capacity Model (`blueprint/models/load_and_cost.py`)

### 3.1 Derived Load, Storage Growth, and Stack Headroom
| Capacity Dimension | 1x (150 DAU) | 10x (1,500 DAU) | 100x (15,000 DAU) | Stack Limit (Current Tier) | Headroom at 1x / 10x | First Component to Saturate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Peak API Gateway RPS** (`R-007`, `R-008`, `R-016`) | `0.15 RPS` | `2.85 RPS` | `42.50 RPS` | `1,000 RPS` (Vercel Function + Upstash Redis) | `99.98%` / `99.71%` | None at 1x/10x |
| **Solana Relayer `sendTransaction` RPS** (`R-003`, `R-006`) | `0.015 RPS` | `0.25 RPS` | `3.55 RPS` | `2 RPS` (Helius Free) / `50 RPS` (Helius Dev `$49/mo`) | `99.25%` / `87.50%` | Helius Free RPC `sendTransaction` at `>8,000 DAU` |
| **PostgreSQL 16 Storage (12 Months)** (`schema.sql`) | `0.49 GB` | `9.51 GB` | `142.35 GB` | `0.50 GB` (Neon Free) / `10 GB` (Neon Launch `$19/mo`) | `2.0%` at Month 12 (1x) | **Neon Free 0.5 GB storage cap** at `>160 DAU` sustained for 12 months |
| **Solana On-Chain Merkle Tree Capacity** (`R-004`, `R-006`) | `54,750 leaves/yr` | `547,500 leaves/yr` | `6,570,000 leaves/yr` | $2^{20} = 1,048,576$ leaves per `ZkYieldVault` PDA | `94.7%` / `47.8%` | Depth-20 tree rotates to Epoch #2 PDA at `1,048,576` deposits |

---

## 4. Data Model (`blueprint/schema.sql`)

### 4.1 Database Selection & Tenancy Model
- **Engine:** PostgreSQL `16.4` (Neon Serverless with PgBouncer connection pooling) + Upstash Redis `7.2`.
- **Tenancy & Unlinkability Boundary:**
  - *Merchant Multi-Tenancy:* Isolated by `x402_merchants.id` (`solana_pubkey == jwt.sub`).
  - *Buyer Zero-Knowledge Isolation:* `intent_deposits` and `merkle_leaves` are **completely decoupled** (zero foreign keys, zero shared user IDs) from `zk_runtime_sessions` and `x402_usage_receipts`. Linking a deposit to a session is mathematically prevented by the BN254 Groth16 circuit (`R-004`, `R-005`).
- **Soft Deletion & Retention:** `intent_deposits.deleted_at` supports soft deletion; `merkle_leaves` are immutable append-only mirrors of on-chain Solana state; `x402_usage_receipts` are retained for 90 days for merchant accounting and Schnorr dispute resolution.

### 4.2 Per-Table Specification & Requirement Mapping
1. **`intent_deposits` (`R-001`, `R-002`, `R-003`, `R-010`, `R-014`):**
   - Primary Key: `id UUID DEFAULT gen_random_uuid()`
   - Unique Constraints: `UNIQUE(aurora_quote_id)`
   - Columns: `origin_chain VARCHAR(32)`, `origin_asset VARCHAR(128)`, `origin_amount_raw VARCHAR(64)`, `expected_solana_micro_usdc BIGINT CHECK (>0)`, `deposit_address VARCHAR(128)`, `refund_address VARCHAR(128)`, `confidential_mode BOOLEAN DEFAULT TRUE`, `integrator_fee_bps SMALLINT DEFAULT 30 CHECK (0..500)`, `poseidon_commitment_hex CHAR(66)`, `origin_tx_hash VARCHAR(128)`, `solana_settlement_sig VARCHAR(128)`, `optimistic_credit_issued BOOLEAN DEFAULT FALSE`, `optimistic_credit_micro_usdc BIGINT DEFAULT 0`, `status VARCHAR(32) CHECK (...)`, `created_at`, `updated_at`, `deleted_at`.
   - Indexes: `idx_intent_deposits_status_created`, `idx_intent_deposits_commitment`.
2. **`merkle_leaves` (`R-004`, `R-005`, `R-006`):**
   - Primary Key: `leaf_index INTEGER CHECK (0..1048575)`
   - Unique Constraints: `UNIQUE(commitment_hex)`
   - Columns: `commitment_hex CHAR(66)`, `merkle_root_after_hex CHAR(66)`, `solana_tx_sig VARCHAR(128)`, `inserted_at TIMESTAMPTZ`.
   - Indexes: `idx_merkle_leaves_root`.
3. **`zk_runtime_sessions` (`R-006`, `R-008`, `R-013`, `R-016`):**
   - Primary Key: `id UUID DEFAULT gen_random_uuid()`
   - Unique Constraints: `UNIQUE(nullifier_hash_hex)`, `UNIQUE(runtime_key_hash)`
   - Columns: `merkle_root_used_hex CHAR(66)`, `solana_verify_tx_sig VARCHAR(128)`, `principal_micro_usdc BIGINT CHECK (>0)`, `yield_subsidy_micro_usdc BIGINT DEFAULT 0`, `remaining_micro_usdc BIGINT CHECK (>=0)`, `max_per_request_micro_usdc BIGINT DEFAULT 100000`, `daily_cap_micro_usdc BIGINT DEFAULT 2000000`, `spent_today_micro_usdc BIGINT DEFAULT 0`, `is_optimistic BOOLEAN DEFAULT FALSE`, `status VARCHAR(24) CHECK ('ACTIVE','EXHAUSTED','CLOSED_REFUNDED','REVOKED')`, `expires_at TIMESTAMPTZ`, `created_at`, `updated_at`.
   - Indexes: `idx_zk_runtime_sessions_key_active` (partial index `WHERE status = 'ACTIVE'`).
4. **`x402_merchants` (`R-007`, `R-009`, `R-011`):**
   - Primary Key: `id UUID DEFAULT gen_random_uuid()`
   - Unique Constraints: `UNIQUE(solana_pubkey)`, `UNIQUE(endpoint_pattern)`
   - Columns: `name VARCHAR(120)`, `price_per_call_micro_usdc BIGINT CHECK (>0)`, `auto_compound_defi BOOLEAN DEFAULT TRUE`, `liquid_balance_micro_usdc BIGINT DEFAULT 0`, `defi_staked_micro_usdc BIGINT DEFAULT 0`, `yield_earned_micro_usdc BIGINT DEFAULT 0`, `created_at`.
5. **`x402_usage_receipts` (`R-007`, `R-008`, `R-011`, `R-012`, `R-015`):**
   - Primary Key: `id UUID DEFAULT gen_random_uuid()`
   - Foreign Keys: `session_id UUID REFERENCES zk_runtime_sessions(id) ON DELETE RESTRICT`, `merchant_id UUID REFERENCES x402_merchants(id) ON DELETE RESTRICT`
   - Unique Constraints: `UNIQUE(request_correlation_id)`
   - Columns: `payment_scheme VARCHAR(32)`, `charged_micro_usdc BIGINT`, `cumulative_session_spend_micro_usdc BIGINT`, `schnorr_signature_hex VARCHAR(140)`, `upstream_http_status SMALLINT`, `refund_triggered BOOLEAN DEFAULT FALSE`, `aurora_refund_quote_id VARCHAR(128)`, `created_at`.
   - Indexes: `idx_x402_receipts_session_created`, `idx_x402_receipts_merchant_created`.
6. **`defi_vault_snapshots` (`R-009`, `R-010`, `R-017`):**
   - Primary Key: `id BIGSERIAL`
   - Columns: `total_pool_micro_usdc BIGINT`, `kamino_staked_micro_usdc BIGINT`, `liquid_reserve_micro_usdc BIGINT`, `optimistic_utilized_micro_usdc BIGINT`, `current_apy_bps INTEGER`, `subsidy_bonus_bps INTEGER`, `solana_slot BIGINT`, `recorded_at TIMESTAMPTZ`.
   - Indexes: `idx_defi_snapshots_recorded`.

### 4.3 Migration Directory Skeleton & Order
```
src/db/migrations/
├── 0001_init_refract_schema.up.sql      # Exact DDL from blueprint/schema.sql
├── 0001_init_refract_schema.down.sql    # DROP TABLE IF EXISTS in reverse dependency order
└── meta/_journal.json                   # Drizzle / SQL migration state tracker
```
*Migration Order:* `x402_merchants` $\rightarrow$ `intent_deposits` $\rightarrow$ `merkle_leaves` $\rightarrow$ `zk_runtime_sessions` $\rightarrow$ `x402_usage_receipts` $\rightarrow$ `defi_vault_snapshots`.

---

## 5. API Specification and Endpoint Summary Table (`blueprint/openapi.yaml`)

### 5.1 API Conventions
- **Base Path & Versioning:** `/api/v1/*`
- **Idempotency:** Write endpoints accept `X-Idempotency-Key` (or natural cryptographic keys: `poseidonCommitmentHex`, `nullifierHashHex`, `auroraQuoteId`). Duplicate requests within 24 hours return the cached response without re-execution.
- **Correlation & Timing Headers:** Every response includes `X-Correlation-Id: req_<ulid>` and `Server-Timing: x402-verify-dur;dur=<ms>`.
- **Standard Error Format:** `{ "code": "ERR_...", "message": "Human-readable problem and fix", "correlationId": "req_..." }`.

### 5.2 Endpoint Summary Matrix
| Endpoint | Method | Auth Scheme | Rate Limit | Request Validation (Zod) | Status Codes | Audit & Events Emitted | Req IDs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/intents/quote` | `POST` | Public | `20/min/IP` | `originChain`, `originAsset`, `amountRaw >= 1e6`, `poseidonCommitmentHex` (`^0x[a-fA-F0-9]{64}$`) | `200`, `400`, `429`, `502` | Emits `prism.aurora_quote_created` (no IP stored). | `R-001`, `R-002`, `R-014` |
| `/api/v1/intents/optimistic-credit` | `POST` | Public (Groth16 Commit) | `10/min/IP` | `auroraQuoteId`, `originTxHash`, `groth16Proof`, `publicInputs` | `200`, `400`, `409`, `429` | Emits `float.optimistic_credit_issued`. | `R-010` |
| `/api/v1/zkapi/tree` | `GET` | Public | `60/min/IP` | Query param `sinceLeafIndex` (optional integer `>= 0`) | `200`, `304` | Cached in Redis (`refract:merkle:tree`). | `R-004`, `R-005` |
| `/api/v1/zkapi/runtime-key` | `POST` | Groth16 BN254 Proof | `15/min/IP` | `proofHex` (512 hex chars = 256B), `merkleRootHex`, `nullifierHashHex`, `spendCapMicroUsdc` | `200`, `400`, `409`, `502` | Submits Solana `settle_zk_spend` tx; emits `zkapi.solana_verified`. | `R-005`, `R-006`, `R-008`, `R-013` |
| `/api/v1/ai/chat` | `POST` | `PAYMENT-SIGNATURE` (`x402` v2) | `120/min/key` | `model` (`gpt-4o-mini` \| `claude-3-5-sonnet`), `messages[]` (`1..20` items, max `8000` chars) | `200`, `402`, `403`, `429`, `502` | Signs `X-ZKAPI-RECEIPT`; zero prompt/IP logging (`SEC-04`). | `R-007`, `R-008`, `R-012`, `R-013`, `R-015`, `R-016` |
| `/api/v1/intents/refund` | `POST` | `PAYMENT-SIGNATURE` | `10/min/key` | `destinationChain`, `destinationAsset`, `recipientAddress` | `200`, `400`, `403`, `409`, `502` | Initiates reverse Aurora `1Click` payout; marks session `CLOSED_REFUNDED`. | `R-011` |
| `/api/v1/defi/vault-stats` | `GET` | Public | `60/min/IP` | None | `200` | Cached 10s in Redis (`refract:defi:stats`). | `R-009`, `R-017` |

---

## 6. Core Data Flows, Failure Handling, and Compensation Workflows

### 6.1 Workflow A: Cross-Chain Deposit + `<400ms` Optimistic Float Credit + 90/10 DeFi Sweep (`R-001`–`R-004`, `R-009`, `R-010`, `R-014`)
- **Trigger:** Client calls `POST /api/v1/intents/quote` followed by `POST /api/v1/intents/optimistic-credit`.
- **Step-by-Step Execution & I/O:**
  1. `Client Browser` $\rightarrow$ Generates `(nullifier, trapdoor)`, computes `commitment = Poseidon(nullifier, trapdoor, amount)`, saves encrypted note to `IndexedDB`, and downloads `.json` backup (`R-004`).
  2. `AuroraOneClickService` $\rightarrow$ Calls `OneClickService.getQuote({ dry: false, confidentialMode: true, referralFees: [{ recipient, fee: 30 }] })` $\rightarrow$ Writes `QUOTE_CREATED` to `intent_deposits` (`R-001`, `R-002`, `R-014`).
  3. `OptimisticFloatCreditEngine` $\rightarrow$ Upon receiving `originTxHash`, verifies tx broadcast on origin RPC $\rightarrow$ Issues `rk_live_opt_*` in Redis/Postgres with `min(amount, $5.00)` credit in `<= 400ms` (`R-010`).
  4. `SolanaAnchorDepositWorker` $\rightarrow$ Polls `OneClickService.getExecutionStatus(depositAddress)` until `SUCCESS` $\rightarrow$ Submits `deposit_and_commit` to Solana Anchor program $\rightarrow$ Program inserts Poseidon leaf, recoups `$5.00` optimistic advance + `10 bps` fee, and executes CPI to supply `90%` of USDC into Kamino `kUSDC` reserve (`R-003`, `R-009`).
- **Compensation & Rollback on Failure:**
  - If `OneClickService.getExecutionStatus()` returns `REFUNDED` or `FAILED`: Worker immediately executes `DEL refract:rk:<hash>` in Redis and updates `zk_runtime_sessions.status = 'REVOKED'` in PostgreSQL. Aurora's solver automatically refunds the origin token to `refundAddress` on the origin chain.
  - **User-Visible Behavior:** Toast banner transitions to Warning/Error: *"Origin swap could not be completed by solver and was refunded to your origin wallet. Temporary optimistic credit has been closed."*

### 6.2 Workflow B: Unlinkable `x402` Spend, Policy Firewall & Automatic Upstream Error Rollback (`R-005`–`R-008`, `R-011`–`R-013`, `R-015`, `R-016`)
- **Trigger:** Client or AI Agent sends `POST /api/v1/ai/chat`.
- **Step-by-Step Execution & I/O:**
  1. `X402GatewayMiddleware` $\rightarrow$ If `PAYMENT-SIGNATURE` is missing, returns `HTTP 402` with base64 `PAYMENT-REQUIRED` header (`<= 50ms`) (`R-007`).
  2. `SnarkJsWebWorkerProver` (if minting key) $\rightarrow$ Fetches `GET /api/v1/zkapi/tree`, builds depth-20 Merkle path, generates 256B Groth16 proof (`<= 2,200ms`), and calls `POST /api/v1/zkapi/runtime-key` $\rightarrow$ Relayer invokes `settle_zk_spend` on Solana (`<= 140,000 CU`), writes `NullifierRecord` PDA, and issues `rk_live_zk_*` loaded with `principal + 8.4% DeFi yield subsidy` (`R-005`, `R-006`, `R-008`, `R-009`).
  3. `AgentSpendPolicyGuard` $\rightarrow$ Evaluates atomic Redis Lua script: checks `status == 'ACTIVE'`, `price_micro_usdc <= max_per_request_micro_usdc`, and `remaining_micro_usdc >= price_micro_usdc` in `<= 15ms` (`R-013`, `R-016`).
  4. `AiInferenceRouterService` $\rightarrow$ Calls `gpt-4o-mini` (or fails over to `claude-3-5-sonnet`), streams response, signs `X-ZKAPI-RECEIPT` Schnorr header, and records `x402_usage_receipts` (`R-008`, `R-012`).
- **Compensation & Rollback on Failure:**
  - If both OpenAI and Anthropic return `HTTP 5xx` or time out after the Redis Lua script reserved `15,000 micro-USDC`: The catch block immediately executes compensating credit `HINCRBY refract:rk:<hash> remaining_micro_usdc 15000` and writes a rollback audit row with `charged_micro_usdc = 0, refund_triggered = TRUE` (`R-011`).

---

## 7. Authentication and Authorization (`R-006`, `R-007`, `R-008`, `R-013`)

- **Buyer / Agent Auth (`PAYMENT-SIGNATURE` Capability Token):**
  - *Scheme 1 (`zkapi-runtime-key`):* Base64 JSON `{ "scheme": "zkapi-runtime-key", "token": "rk_live_..." }`. Token is hashed with `SHA-256` before lookup against `zk_runtime_sessions.runtime_key_hash` (preventing timing attacks and plaintext token DB leaks). TTL: `24 hours`.
  - *Scheme 2 (`zkapi-groth16-bn254`):* Stateless single-request Groth16 proof verified directly on Solana (`~400ms`).
  - *Scheme 3 (`solana-spl`):* Standard `x402` signed Solana SPL USDC transfer transaction for backwards compatibility with non-ZK `x402` agents.
- **Merchant Auth (`SIWS` Bearer JWT):** Ed25519 signature over canonical Sign-In With Solana message; issues a 4-hour `HttpOnly; Secure; SameSite=Strict` JWT scoped to `merchant.solana_pubkey`.
- **Service-to-Service Auth:** Internal cron/webhook endpoints require `X-Refract-Webhook-Secret` verified via constant-time `crypto.timingSafeEqual()`.

---

## 8. Asynchronous Processing (`Workers & Queues`)

| Worker ID | Trigger Mechanism | Payload Schema | Retry & Backoff Formula | Timeout | Dead-Letter Handling | Checkpointing & Idempotency | Monitoring Metric |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`W-01: SolanaAnchorDepositWorker`** (`R-003`, `R-004`, `R-010`) | Polls `intent_deposits WHERE status IN ('QUOTE_CREATED','OPTIMISTIC_CREDITED','PENDING_DEPOSIT')` every `3s`. | `{ quoteId, depositAddress, commitmentHex, expectedMicroUsdc }` | $T_k = 1000\text{ms} \times 2^k$ ($k \in [0..4]$, max 5 attempts). | `25,000 ms` | Sets `status = 'FAILED'`, revokes optimistic key in Redis, emits alert `worker.deposit.dlq`. | Checkpointed by `solana_settlement_sig` and on-chain `merkle_leaves.commitment_hex` uniqueness. | `refract_deposit_settlement_lag_seconds` |
| **`W-02: KaminoYieldRebalanceCrank`** (`R-009`) | Scheduled cron every `300s` (5m) + post-deposit hook when liquid ratio `> 15%`. | `{ vaultPda, targetStakedBps: 9000, reservePubkey }` | $T_k = 2000\text{ms} \times 2^k$ ($k \in [0..2]$, max 3 attempts). | `20,000 ms` | Retains USDC safely in `liquid_vault` PDA until next 5m tick; logs warning. | Idempotent: reads live on-chain SPL token balances at execution slot before computing delta. | `refract_defi_staked_ratio_bps` |
| **`W-03: AuroraReverseIntentRefundJob`** (`R-011`) | Invoked asynchronously on `POST /api/v1/intents/refund` or repeated upstream `5xx`. | `{ sessionId, refundMicroUsdc, destChain, destAsset, recipient }` | $T_k = 1000\text{ms} \times 3^k$ ($k \in [0..3]$, max 4 attempts). | `30,000 ms` | Transitions session to `REFUND_FALLBACK_SOLANA` so user can claim USDC directly on Solana if cross-chain bridge is down. | Locked via `UPDATE zk_runtime_sessions SET status = 'CLOSED_REFUNDED' WHERE id = $1 AND status = 'ACTIVE'`. | `refract_cross_chain_refund_duration_ms` |

---

## 9. AI and Blockchain Component Specifications

### 9.1 AI Module Specification (`R-012`, `R-013`, `R-015`)
- **Models & Pinned Versions:** `gpt-4o-mini-2024-07-18` (Primary, `$0.15/1M` input, `$0.60/1M` output) and `claude-3-5-sonnet-20241022` (Secondary/Fallback & Smart Contract Auditor, `$3.00/1M` input, `$15.00/1M` output).
- **Prompt Versioning & Storage:** System prompts stored in version-controlled `src/lib/ai/prompts.v2.ts` with SHA-256 content hashes logged in telemetry.
- **Token Budgets & Per-User Caps:** Max input context `4,096 tokens`; max completion `1,024 tokens`; per-request spend cap enforced by `AgentSpendPolicyGuard` (`default: 100,000 micro-USDC = $0.10`, hard ceiling `$50.00`) (`R-013`).
- **Observability Under Privacy Rules:** Logs record `{ correlationId, model, latencyMs, tokensUsed, chargedMicroUsdc }` and **strictly omit** `messages[]`, wallet addresses, and client IP addresses (`NFR-005`).

### 9.2 Blockchain Module Specification (`R-003`, `R-006`, `R-009`)
- **Chain & Clusters (`VERIFIED` Nov 7, 2026):** Solana Mainnet-Beta (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` canonical USDC) for live Aurora Intents execution (`ADR-006`), plus Solana Devnet / local Surfpool for automated Anchor CI tests.
- **Anchor Program Interface (`programs/refract_vault/src/lib.rs`, `anchor-lang = "1.2.2"`):**
  1. `initialize_vault(ctx, subsidy_bonus_bps: u16)`: Initializes zero-copy `ZkYieldVault` PDA (`1,840 bytes`) and `liquid_vault` SPL Token account.
  2. `deposit_and_commit(ctx, commitment: [u8; 32], amount_micro_usdc: u64)`: Transfers settled USDC into `ZkYieldVault`, computes incremental depth-20 Poseidon path via `light-poseidon = "0.4.1"`, updates `root_history` ring buffer, and triggers 90% Kamino CPI supply (`R-003`, `R-004`, `R-009`).
  3. `settle_zk_spend(ctx, proof_a: [u8; 64], proof_b: [u8; 128], proof_c: [u8; 64], public_inputs: [[u8; 32]; 4])`: Verifies `public_inputs[0]` (`merkle_root`) is in `root_history`, initializes `NullifierRecord` PDA for `public_inputs[1]` (`nullifier_hash`), and runs `Groth16Verifier::new(...).verify()` via `groth16-solana = "0.2.0"` in `<= 140,000 CU` (`R-006`).
  4. `rebalance_defi_float(ctx)`: Cranks the 90/10 split between Kamino `kUSDC` reserve and `liquid_vault` PDA (`R-009`).

---

## 10. Non-Functional Requirements (Quantified NFR Table)

| NFR ID | Requirement ID | Metric | Target | Critical Threshold | Measurement Method | Verifying Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **NFR-001** | `R-008`, `R-016` | `x402` Runtime-Key Authorization Latency | **`<= 15 ms` (p95)** | `> 40 ms` (p95) | `Server-Timing: x402-verify-dur` header under 50 RPS load for 60s. | `k6 run tests/load/x402_verify.js` (`TEST-PERF-001`) |
| **NFR-002** | `R-010` | Optimistic Cross-Chain Credit Latency | **`<= 400 ms` (p95)** | `> 1,500 ms` (p95) | End-to-end HTTP response time on `POST /api/v1/intents/optimistic-credit`. | `vitest run tests/integration/optimistic_credit.test.ts` (`TEST-INT-003`) |
| **NFR-003** | `R-005` | Browser WebWorker Groth16 Proof Time | **`<= 2,200 ms` (p95)** | `> 4,500 ms` (p95) | `performance.now()` delta across 10 proofs in headless Chromium. | `npx playwright test tests/e2e/zk_prover_perf.spec.ts` (`TEST-ZK-001`) |
| **NFR-004** | `R-006` | On-Chain Solana Groth16 Verification Cost | **`<= 140,000 CU`** | `> 195,000 CU` | `computeUnitsConsumed` from Solana transaction metadata logs. | `anchor test` (`TEST-CHAIN-002`) |
| **NFR-005** | `R-004`, `R-015` | Wallet-to-Prompt Identity Leakage | **`0 bytes leaked`** | `>= 1 byte` of EOA address in merchant request | Regex + entropy inspection of all headers/body received by merchant endpoint. | `vitest run tests/security/unlinkability.test.ts` (`TEST-SEC-001`) |
| **NFR-006** | `R-017` | WCAG 2.2 AA Contrast & A11y Compliance | **`100% pass` (`>= 4.5:1` text, `>= 3.0:1` UI)** | Any text pair `< 4.5:1` or serious `axe` violation | W3C relative luminance script + `@axe-core/playwright` scan. | `node scripts/verify_contrast.mjs` (`TEST-A11Y-001`) |
| **NFR-007** | `R-004`, `R-009` | Off-Chain Merkle DB Disaster Recovery | **`RPO = 0 blocks`, `RTO <= 5 min`** | `RPO > 0 blocks` or `RTO > 15 min` | Drop `merkle_leaves` table and reconstruct from Solana Anchor event logs. | `npm run db:rebuild-from-chain` drill |

---

## 11. Security Architecture & Data Classification

### 11.1 Data Classification & Regulatory Derivation (Ground Rule #5)
| Data Element | Classification | Storage Location | Derived Security Controls & Regulatory Scope |
| :--- | :--- | :--- | :--- |
| **Secret `zkAPI` Note (`nullifier`, `trapdoor`)** | **Restricted / Bearer Secret** | Client Browser `IndexedDB` (AES-GCM-256 encrypted) + User `.json` file | **Never transmitted over network (`0 bytes`).** Server cannot custody or recover lost notes (`R-004`). |
| **AI Chat Prompts & Completions (`messages[]`)** | **Confidential (Ephemeral)** | In-memory Node.js stream only | Zero persistent database storage; stripped from structured logs; unlinkable to wallet pubkeys (`SEC-04`). |
| **Poseidon Commitments, Merkle Roots & Nullifier Hashes** | **Public Cryptographic State** | Solana Blockchain + PostgreSQL `merkle_leaves` / `zk_runtime_sessions` | Immutable one-way hashes over BN254 scalar field; reveals zero PII (outside GDPR/CCPA personal-data scope once unlinked from IP). |
| **Server Keys (`SOLANA_RELAYER_PRIVATE_KEY_BASE58`, `AURORA_STUDIO_JWT_TOKEN`)** | **Internal Critical Secret** | Vercel Encrypted Environment Variables (`.env.example`) | Relayer holds only `0.1 SOL` gas and has zero smart-contract permission to withdraw vault USDC (`SEC-05`). |

### 11.2 STRIDE Controls & Supply-Chain Defenses
Full STRIDE table (`SEC-01` to `SEC-05`) is verified in `blueprint/reviews/adversarial.md`. Supply-chain security enforces exact version pinning in `package.json` (`@solana/web3.js` pinned to `1.99.0` to prevent `CVE-2024-54134`; `anchor-lang` pinned to `1.2.2` to prevent `RUSTSEC-2026-0146`).

---

## 12. Infrastructure, Deployment, and Configuration (`.env.example`)

- **IaC & Environments:** Declarative `vercel.json` + `Anchor.toml` + `blueprint/schema.sql`.
- **CI/CD Stages & Blocking Quality Gates (`.github/workflows/ci.yml`):**
  1. `Gate 1 (Schema & OpenAPI):` Loads `blueprint/schema.sql` into PostgreSQL 16 container and runs `@redocly/cli lint blueprint/openapi.yaml` (blocks on any SQL or schema error).
  2. `Gate 2 (Security & Supply Chain):` Runs `npm audit --audit-level=high`, `cargo audit`, and `TEST-SEC-001` (`0` wallet bytes leaked).
  3. `Gate 3 (Anchor SVM & ZK Proof CU):` Runs `anchor test` and asserts `settle_zk_spend` consumes `<= 140,000 CU`.
  4. `Gate 4 (WCAG 2.2 AA & E2E):` Runs `verify_contrast.mjs` and Playwright E2E flow.
- **Configuration Completeness:** All 22 environment variables (`AURORA_ONE_CLICK_BASE_URL`, `AURORA_STUDIO_JWT_TOKEN`, `NEXT_PUBLIC_AURORA_WIDGET_API_KEY`, `AURORA_INTEGRATOR_FEE_RECIPIENT`, `AURORA_INTEGRATOR_FEE_BPS`, `NEXT_PUBLIC_SOLANA_NETWORK`, `SOLANA_RPC_URL`, `NEXT_PUBLIC_SOLANA_RPC_URL`, `NEXT_PUBLIC_REFRACT_VAULT_PROGRAM_ID`, `NEXT_PUBLIC_SOLANA_USDC_MINT`, `SOLANA_RELAYER_PRIVATE_KEY_BASE58`, `SOLANA_KAMINO_USDC_RESERVE_PUBKEY`, `NEXT_PUBLIC_ZKAPI_WASM_URL`, `NEXT_PUBLIC_ZKAPI_ZKEY_URL`, `ZKAPI_SCHNORR_SIGNING_PRIVATE_KEY_HEX`, `OPTIMISTIC_CREDIT_MAX_MICRO_USDC`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `REFRACT_INTERNAL_WEBHOOK_SECRET`) are documented in `blueprint/.env.example`.

---

## 13. Observability, SLOs, and Operational Runbooks

- **Structured Logging Schema (JSON, Zero-PII):**
  `{ "ts": "2026-11-07T15:18:00Z", "level": "INFO", "correlationId": "req_...", "component": "X402Gateway", "event": "x402.payment_settled", "scheme": "zkapi-runtime-key", "verifyLatencyMs": 11, "chargedMicroUsdc": 15000 }` *(Client IP, wallet address, and prompt text are strictly forbidden in logs).*
- **SLOs & Alert Thresholds:**
  - `SLO-01:` `99.9%` availability on `/api/v1/ai/chat` and `/api/v1/zkapi/*` (Page alert if `5xx` rate `> 1.0%` over 5m).
  - `SLO-02:` `p95 <= 15ms` on `x402-verify-dur` (Warn alert if `p95 > 25ms` over 5m).
  - `SLO-03:` Relayer gas balance `>= 0.05 SOL` (Page alert if `< 0.02 SOL`).

---

## 14. Reliability, Disaster Recovery, and Failure-Mode Table

| Dependency | Failure Mode | User-Visible Impact | Automated System Response | Manual Operator Response (Runbook) |
| :--- | :--- | :--- | :--- | :--- |
| **Aurora `1Click API`** (`1click.chaindefuser.com`) | Timeout `>5s`, `HTTP 5xx`, or solver delay `>45s` | Cross-chain quote retries; if deposit already broadcast, **zero impact** for first `$5.00` because Optimistic Float Credit (`R-010`) unlocks in `<400ms`. | Retries quote 3x (`500ms, 1s, 2s`); keeps optimistic key active up to 15m while polling `GET /status`. | If `1Click` outage exceeds 15m, enable direct Solana USDC deposit banner on `/studio`. |
| **Upstash Redis** | Connection timeout or region outage | `x402` verification latency rises slightly from `~11ms` to `~22ms` (remains well under `40ms` critical threshold). | Circuit breaker trips after 2 consecutive `>100ms` Redis timeouts and routes runtime-key checks directly to Neon PostgreSQL atomic `UPDATE ... RETURNING`. | Verify Upstash status page; Redis state self-heals from PostgreSQL on recovery. |
| **Neon PostgreSQL 16** | Corrupted `merkle_leaves` table or bad migration | New browser Groth16 proofs fail with `ERR_STALE_MERKLE_ROOT`; existing `rk_live_*` keys continue working via Redis cache. | Serves last known valid Merkle tree snapshot from Redis cache (`refract:merkle:tree`). | Run `npm run db:rebuild-from-chain` to replay `DepositCommitted` Anchor events from Solana (`RTO <= 5 min`). |
| **Helius Solana RPC** | Rate limit (`HTTP 429`) or node lag | `POST /api/v1/zkapi/runtime-key` takes `1.2s` instead of `400ms`. | Connection pool automatically fails over to secondary Solana Mainnet RPC URL after `1,000ms` timeout. | Rotate Helius API key or upgrade tier if sustained RPS `> 40`. |
| **OpenAI API (`gpt-4o-mini`)** | `HTTP 429` or `503` outage | Subtle badge shows `"Switched to fallback model (Claude 3.5 Sonnet)"`; response still streams. | `AiInferenceRouterService` fails over to Anthropic `claude-3-5-sonnet` after `1,500ms` TTFT timeout; rolls back micro-USDC if both fail. | Check OpenAI credit quota in billing dashboard. |

---

## 15. Testing Strategy and CI Quality Gates (All 11 Test Layers)

| # | Test Layer | Framework / Command | Coverage Target & Scope | Verifying Test IDs | Blocking CI Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Unit Tests** | `vitest run tests/unit` | `>= 90%` line coverage on Poseidon commitment math, Groth16 big-endian G1 negation serializer, and Schnorr receipt signer. | `TEST-ZK-001`, `TEST-API-002` | `0` failing unit tests |
| **2** | **Integration Tests** | `vitest run tests/integration` | Aurora `OneClickService` quote creation (`confidentialMode: true`, `30 bps` fee), `<400ms` optimistic credit, and 1Click refund. | `TEST-INT-001` to `TEST-INT-005` | `100%` pass |
| **3** | **API Contract Tests** | `npx @redocly/cli lint blueprint/openapi.yaml` | Validates OpenAPI 3.1.0 spec + schema conformance of all `200`, `402`, `403`, `502` payloads. | `TEST-API-001` | `0` lint/schema errors |
| **4** | **Database & Migration Tests** | `psql $TEST_DB_URL -f blueprint/schema.sql` | Forward & down migration execution, index existence verification, and concurrent `UPDATE` non-negativity check. | `TEST-DB-001` | Exits `0`; all 8 indexes exist |
| **5** | **Smart Contract Tests (SVM)** | `anchor test` | `deposit_and_commit`, `settle_zk_spend` (`<= 140k CU`), replayed `NullifierRecord` PDA rejection, 90/10 Kamino CPI split. | `TEST-CHAIN-001` to `TEST-CHAIN-003` | `computeUnitsConsumed <= 140000` |
| **6** | **End-to-End (E2E) Tests** | `npx playwright test` | Full browser flow: `/studio` deposit $\rightarrow$ `.json` backup $\rightarrow$ `/playground` `x402` chat $\rightarrow$ Double-Blind Inspector (`0` wallet bytes). | `TEST-E2E-001`, `TEST-E2E-002` | `100%` pass on Chromium |
| **7** | **Performance & Load Tests** | `k6 run tests/load/x402_verify.js` | 50 RPS sustained load for 60s against `X402GatewayMiddleware`. | `TEST-PERF-001` (`NFR-001`) | `p95 <= 15ms`, error rate `< 0.1%` |
| **8** | **Security & Unlinkability Tests** | `vitest run tests/security` | Verifies `0` wallet/IP bytes in merchant payloads and confirms `$2.50` prompt-injection call is blocked by `$0.10` policy cap. | `TEST-SEC-001`, `TEST-SEC-002` | Hard blocker on any leakage |
| **9** | **Accessibility Tests** | `node scripts/verify_contrast.mjs` + `axe-core` | WCAG 2.2 AA contrast (`>= 4.5:1` text, `>= 3.0:1` UI) + full keyboard navigation on `prototype/index.html`. | `TEST-A11Y-001` (`NFR-006`) | `0` critical/serious violations |
| **10** | **AI Evaluation Harness** | `vitest run tests/ai/x402_agent_eval.test.ts` | 20-case synthetic agent benchmark testing `HTTP 402` negotiation, spend-cap refusal, and fallback routing. | `TEST-AI-001` | `>= 95%` benchmark score |
| **11** | **Disaster Recovery Drill** | `npm run db:rebuild-from-chain` | Truncates `merkle_leaves` and rebuilds 100% of leaves and roots from Solana Anchor transaction logs. | `TEST-DR-001` (`NFR-007`) | Completes in `<= 30s` with `0` root mismatches |

---

## 16. Traceability Matrix Reference
Every requirement (`R-001` through `R-018`) is mapped across Database Table, OpenAPI Endpoint, UI Screen, Service/Worker, NFR ID, Test ID, and Roadmap Phase in `blueprint/traceability.csv` with **0 orphans** in either direction (verified in `blueprint/reviews/verification.md`).

---

## 17. Decisions, Assumptions, and Open Questions
- **Decisions Locked:** `ADR-001` through `ADR-007` in `blueprint/decisions.md`.
- **Assumptions Locked:** `ASSUMPTION-01` (2–3 devs, 40h weekend sprint + 3 Encode checkpoint weeks), `ASSUMPTION-02` (`$15–$25` Mainnet USDC micro-liquidity for live Aurora Intents execution), `ASSUMPTION-03` (Zero PII collected).
- **Open Questions:** None.

---

## 18. Change Log & Implementation Handoff Block

| Version | Date | Author | Summary of Changes |
| :--- | :--- | :--- | :--- |
| `1.0.0` | `2026-11-07` | Universal Architect | Initial unified blueprint for `Refract` (`blueprint.md`, `schema.sql`, `openapi.yaml`, `design-tokens.json`, `prototype/index.html`). |
| `2.0.0` | `2026-11-07` | Universal Architect | Expanded into complete standalone specifications (`blueprint.md`, `prd.md`, `design-spec.md`, `ui-spec.md`, `srd.md`) with 0 compressed tables. |

### Implementation-Plan Handoff Block
```yaml
product_name: "Refract" # CONFIRMED
requirements_by_priority:
  P0: ["R-001", "R-002", "R-003", "R-004", "R-005", "R-006", "R-007", "R-008", "R-009", "R-010", "R-012", "R-016"] # CONFIRMED
  P1: ["R-011", "R-013", "R-014", "R-015", "R-017"] # CONFIRMED
  P3_excluded: ["R-018"] # CONFIRMED
stack_with_pinned_versions:
  next: "15.2.4" # VERIFIED 2026-11-07
  react: "19.0.0" # VERIFIED 2026-11-07
  typescript: "5.7.3" # VERIFIED 2026-11-07
  one_click_sdk: "@defuse-protocol/one-click-sdk-typescript@0.1.26" # VERIFIED 2026-11-07
  aurora_swap_widget: "@aurora-is-near/intents-swap-widget@7.24.0" # VERIFIED 2026-11-07
  solana_web3: "@solana/web3.js@1.99.0" # VERIFIED 2026-11-07 (CVE-free v1 release)
  anchor_lang_rust: "1.2.2" # VERIFIED 2026-11-07 (RUSTSEC-2026-0146 patched)
  groth16_solana_rust: "0.2.0" # VERIFIED 2026-11-07
  light_poseidon_rust: "0.4.1" # VERIFIED 2026-11-07
  snarkjs_client: "0.7.6" # VERIFIED 2026-11-07
  database: "PostgreSQL 16.4 (Neon) + Upstash Redis 7.2" # CONFIRMED
riskiest_assumptions_to_prove_first:
  - "SPK-01: Run blueprint/spikes/verify_stack.ts and anchor test to confirm snarkjs 0.7.6 big-endian G1-negated proof verifies in groth16-solana 0.2.0 in <= 140,000 CU" # OPEN_HOUR_1
  - "SPK-02: Verify live Aurora 1Click API quote generation with confidentialMode=true and referralFees=30bps" # CONFIRMED
blocking_test_gates:
  - "psql $DATABASE_URL -f blueprint/schema.sql"
  - "npx @redocly/cli lint blueprint/openapi.yaml"
  - "anchor test (assert computeUnitsConsumed <= 140000)"
  - "vitest run tests/security/unlinkability.test.ts (assert walletBytesReceived === 0)"
  - "node scripts/verify_contrast.mjs blueprint/design-tokens.json"
```

