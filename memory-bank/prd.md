# Refract — Product Requirements Document (`prd.md`)

**Version:** 2.0.0
**Date:** November 7, 2026
**Status:** LOCKED FOR IMPLEMENTATION
**Target Tracks & Competitions:**
- **Hackathon 1 (Solana Weekend Hackathon, Nov 6–8, 2026):** Top 3 Overall ($1,000 USD Microgrant), AI Track ($100), DeFi Track ($100).
- **Hackathon 2 (Encode x Solana 4-Week Hackathon, Oct–Nov 2026):** Aurora Intents ($1,500 1st Place + Winner Support Bundle), Best Use of x402 on Solana (Accelerator), Best Consumer App on Solana (Accelerator).

---

## 1. Summary

- **What It Is:** **Refract** (`refract.sol` / `refract402`) is a cross-chain, yield-bearing **zkAPI** clearinghouse and **x402 (HTTP 402 Payment Required)** facilitator on Solana. It bends liquidity from 35+ blockchains via **Aurora Intents** (`NEAR Intents`) into a Solana DeFi yield pool (Kamino/Marginfi) and issues local **Poseidon Merkle Notes** so users and AI agents can pay `x402` APIs via **Groth16 BN254 zero-knowledge proofs** with zero link between their wallet address and their API queries.
- **For Whom:** Multi-chain AI users/developers, autonomous AI agent operators, and `x402` API merchants.
- **Single Core User Outcome:** Fund a private API pass from any wallet on 35+ chains in one signature, start making paid `x402` AI/API calls within `<= 1,500ms` (via `<400ms` optimistic float credit), earn Solana DeFi yield that subsidizes API spend, and leak `0 bytes` of wallet identity to the API provider.
- **The MVP Cut-Line (40-Hour Weekend Budget):**
  - *Must Ship (P0 — 12 Requirements):* `R-001` to `R-010`, `R-012`, `R-016` (35+-chain Aurora Intents quote + Confidential Mode, `<400ms` optimistic credit, browser Poseidon note + Groth16 BN254 prover, Solana `groth16-solana` verifier + 90/10 DeFi split, HTTP 402 v2 gateway + `<15ms` runtime key metering + Schnorr receipts, and Refract Studio AI Chat UI).
  - *Should Ship (P1 — 5 Requirements):* `R-011`, `R-013`, `R-014`, `R-015`, `R-017` (Reverse-intent cross-chain auto-refunds, Bounded Agent Spend Policy Firewall, 30 bps Aurora integrator fee split, Double-Blind Privacy Inspector drawer, WCAG 2.2 AA compliance).
  - *Won't Ship (P3 — Out of Scope):* `R-018` (Native iOS/Android mobile binaries, custom speculative governance token).
- **Top Three Assumptions:**
  1. `ASSUMPTION-01`: Live cross-chain demos use **$15–$25 of real Mainnet USDC micro-liquidity** because NEAR Intents / Aurora `1Click API` operates exclusively on Mainnet (`VERIFIED`: `docs.near-intents.org`).
  2. `ASSUMPTION-02`: A single on-chain Groth16 verification minting a 24-hour spend-capped Runtime Key (`rk_live_*`) satisfies both cryptographic unlinkability and `<15ms` streaming AI agent latency (`ADR-002`).
  3. `ASSUMPTION-03`: Users accept responsibility for backing up their local bearer note `.json` file (enforced via automatic 1-click download during deposit).

---

## 2. Goals and Non-Goals

### 2.1 Business & Hackathon Objectives
1. **Win Aurora Intents 1st Place ($1,500 + Support Bundle):** Deliver a live, non-mocked integration combining `Intents Connect`, `Intents Deposits` (`1Click API`), `Confidential Intents` (`confidentialMode: true`), custom integrator fees (`30 bps`), and automated reverse-intent cross-chain refunds.
2. **Win H1 Top 3 Microgrant ($1,000) + AI ($100) + DeFi ($100) & Encode x402 + Consumer Tracks:** Unify Ethereum Foundation's Oct 2026 `zkAPI` standard with Solana's `x402` standard while turning idle prepaid API float into an active Solana DeFi yield engine.

### 2.2 Product Goals (Measurable)
- Eliminate the 20–45 second cross-chain settlement wait on initial `x402` calls by fronting `<400ms` optimistic credit from the Solana 10% Liquid Reserve (`R-010`).
- Achieve `0.0%` wallet-to-prompt correlation between origin/Solana wallets and `x402` merchant servers (`R-004`, `R-015`).
- Maintain `<= 15ms` (p95) gateway authorization overhead on metered `x402` requests (`R-008`, `R-016`).

### 2.3 Explicit Non-Goals (`R-018`)
- Building a general-purpose token bridge UI without `x402`/`zkAPI` utility (already done by `OmniFlow`).
- Supporting pull-based recurring crypto subscriptions across non-EVM chains (Aurora Intents is push-deposit based).
- Training or fine-tuning a custom foundation LLM (Refract is the payment, privacy, and DeFi float layer around existing frontier models and APIs).
- Issuing a custom SPL utility/governance token.

---

## 3. Personas and Jobs-To-Be-Done (With Evidence Status)

| Persona | Evidence Status & Source | Current Pain / Workaround Today | Core Job-To-Be-Done (JTBD) | Mapped Requirements |
| :--- | :--- | :--- | :--- | :--- |
| **1. "Alex" — Multi-Chain AI Developer & Privacy-Conscious Consumer** | **VERIFIED** (`ethereum/zkapi` launch post by Vitalik Buterin & Davide Crapis, Oct 1, 2026: developers refuse to link main wallets to every AI prompt). | Must manually bridge Base/Arbitrum/BTC funds to Solana, acquire SOL for gas, and sign standard `x402` headers that expose their wallet address and net worth to every API provider. | *"When I want to use paid AI models or APIs on Solana using funds I hold on Base, Arbitrum, or Bitcoin, help me fund a pass in one click and pay per prompt without exposing my wallet identity."* | `R-001`, `R-002`, `R-003`, `R-004`, `R-012`, `R-015`, `R-017` |
| **2. "Devin-Bot" — Autonomous AI Agent & Operator** | **VERIFIED** (`aurora.dev` AI Agent docs & `solana.com/x402`: >35M x402 txs driven by automated agents needing programmatic cross-chain funding). | Existing cross-chain `x402` adapters (`sluice-pay`, `mpp.dev`) stall HTTP connections for 20–45s waiting for cross-chain settlement and lack per-call spend caps against prompt injection. | *"When my headless agent hits an HTTP 402 paywall, help it authorize payment in <15ms with instant cross-chain refills and strict per-call spend limits so a prompt injection cannot drain its treasury."* | `R-005`, `R-006`, `R-008`, `R-010`, `R-011`, `R-013`, `R-016` |
| **3. "Sarah" — x402 API / AI Service Merchant** | **VERIFIED** (`x402.org` & Encode x402 track prompt: API providers want drop-in HTTP 402 monetization without dead capital). | Must maintain separate billing for `x402` and `zkAPI`, cannot accept non-Solana buyers natively, and earns 0% APY on settled USDC sitting in hot wallets. | *"When I monetize my API with HTTP 402, let buyers from 35+ chains pay me privately while automatically sweeping 90% of my settled USDC revenue into Solana DeFi yield."* | `R-007`, `R-009`, `R-011`, `R-014` |

---

## 4. Success Metrics & Guardrails (Zero Unlabeled Numbers)

| Metric Name | Definition | Measurement Method | Baseline | Target | Status & Source / Calculation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **M-01: Cross-Chain Time-to-First-x402-Call** | Elapsed time from origin-chain tx broadcast to first authorized `HTTP 200` `x402` response using Optimistic Float Credit (`R-010`). | E2E Playwright performance mark (`t_http200 - t_origin_tx_broadcast`). | `25,000 ms` (`sluice-pay` / `mpp.dev` synchronous `GET /status` polling) | **`<= 1,500 ms`** (`<= 400 ms` optimistic credit issuance) | **DERIVED** (`150ms` origin RPC check + `180ms` Redis/PG lock + `70ms` network overhead) |
| **M-02: Metered x402 Gateway Latency (p95)** | Server-side verification latency for `PAYMENT-SIGNATURE` in `zkapi-runtime-key` mode (`R-008`, `R-016`). | `Server-Timing: x402-verify-dur` header under 50 RPS `k6` load test. | `400 ms` (per-request on-chain Solana tx confirmation) | **`<= 15 ms` (p95)** | **DERIVED** (Upstash Redis atomic Lua evaluation `~3–6ms` + Schnorr Ed25519/secp256k1 sign `~0.4ms`) |
| **M-03: Browser Groth16 Proof Generation Time (p95)** | Client WebWorker duration to compute witness and BN254 Groth16 proof for depth-20 Poseidon Merkle tree (`R-005`). | `performance.now()` delta around `snarkjs.groth16.fullProve()`. | `1,800 ms` (Dec 2025 `snarkjs` browser WASM benchmark for ~12k constraints) | **`<= 2,200 ms` (p95)** | **SOURCED** (`computingonline.net` / `ethereum/zkapi` browser benchmarks) |
| **M-04: On-Chain Groth16 Verification Cost (CU)** | Solana VM Compute Units consumed by `settle_zk_spend` instruction (`R-006`). | `computeUnitsConsumed` in Solana transaction metadata during `anchor test`. | `200,000 CU` default Solana per-instruction ceiling | **`<= 140,000 CU`** | **SOURCED** (`crates.io/crates/groth16-solana` v0.2.0 `alt_bn128` syscall benchmark: `78k–108k CU` + PDA init) |
| **M-05: DeFi Float Yield Subsidy Ratio** | Percentage of active vault TVL deployed into yield-bearing Solana DeFi reserves (`R-009`). | On-chain ratio `kamino_staked_micro_usdc / total_pool_micro_usdc`. | `0.0%` (Standard Ethereum `ZkApiVault` holds idle assets) | **`90.0%` ($\pm 5\%$ rebalance band)** | **PROPOSED TARGET** (Balances capital efficiency with a 10% instant optimistic liquidity buffer) |
| **G-01 (Guardrail): Wallet Identity Leakage Rate** | Percentage of `x402` merchant requests containing any byte of the buyer's origin or Solana wallet address (`R-004`, `R-015`). | Automated regex + payload inspection in `TEST-SEC-001`. | `100.0%` in standard public `x402` | **`0.0%` (Hard Blocker)** | **PROPOSED TARGET** (Core `zkAPI` cryptographic guarantee) |
| **G-02 (Guardrail): AI Inference Unit Margin** | Net protocol/merchant margin per paid AI chat request (`$0.015` charge minus actual LLM token cost). | `(charged_micro_usdc - llm_cost_micro_usdc) / charged_micro_usdc`. | N/A | **`>= +85.0%`** (Max `1,024` output tokens on `gpt-4o-mini` costs `$0.0007` vs `$0.015` charge) | **DERIVED** (Retrieved OpenAI pricing: `$0.15/1M` in, `$0.60/1M` out) |

---

## 5. Features and Requirements Specification

### Feature F-01: Any-Chain Confidential Prism Deposit (`R-001`, `R-002`, `R-003`, `R-004`, `R-014`)
- **Priority:** `R-001` (P0), `R-002` (P0), `R-003` (P0), `R-004` (P0), `R-014` (P1)
- **User Story:** As a user holding assets on any of 35+ chains, I want to generate a local private `zkAPI` note and fund it via an Aurora Confidential Intent that automatically stakes into the Solana Refract Vault.
- **Acceptance Criteria (Given/When/Then):**
  - *AC-01 (`R-004`):* **Given** the user opens `/studio` and enters a deposit amount `>= 1.00 USDC`, **When** they click "Refract Liquidity & Mint Note", **Then** the browser generates 31-byte random `nullifier` and `trapdoor` values via `crypto.getRandomValues()`, computes `commitment = Poseidon(nullifier, trapdoor, amount_micro_usdc)`, saves the encrypted note in `IndexedDB`, triggers a download of `refract-note-<short_hash>.json`, and transmits **only** `poseidonCommitmentHex` to the backend.
  - *AC-02 (`R-001`, `R-002`, `R-014`):* **Given** a valid `poseidonCommitmentHex` and selected origin chain/asset, **When** `POST /api/v1/intents/quote` is called, **Then** the gateway invokes `OneClickService.getQuote()` with `dry: false`, `confidentialMode: true`, and `referralFees: [{ recipient: AURORA_INTEGRATOR_FEE_RECIPIENT, fee: 30 }]`, returning `depositAddress` and `auroraQuoteId` in `<= 1,500ms`.
  - *AC-03 (`R-003`):* **Given** Aurora Intents settles the cross-chain swap to the Refract Solana receiver account, **When** `SolanaAnchorDepositWorker` detects `status === 'SUCCESS'`, **Then** it invokes `deposit_and_commit(commitment, settled_amount)` on the Solana Anchor program, inserting the leaf into the depth-20 Merkle tree and updating `merkle_leaves` in PostgreSQL.
- **Business Rules:**
  - `BR-01:` Minimum deposit is `1,000,000 micro-USDC` (`$1.00`); maximum single hackathon demo deposit is `500,000,000 micro-USDC` (`$500.00`).
  - `BR-02:` Custom integrator fee defaults to `30 bps` (`0.30%`), split 40%–60% with Aurora per Studio API Key configuration.
- **Error Handling Table:**
  | Condition | User-Visible Message | HTTP Status & Code | System Action |
  | :--- | :--- | :--- | :--- |
  | Origin amount `< $1.00` equivalent | `"Minimum deposit is $1.00 USDC equivalent to cover cross-chain solver settlement."` | `400 ERR_MIN_DEPOSIT_NOT_MET` | Reject before calling Aurora `1Click API`. |
  | Aurora `1Click API` timeout or `5xx` | `"Aurora cross-chain solver quote timed out. Retrying automatically (Attempt 2/3)..."` | `502 ERR_AURORA_QUOTE_UNAVAILABLE` | Retry twice with 500ms backoff; preserve local note in `DRAFT` state. |
  | User closes tab before `.json` download | Persistent top banner on next visit: `"Unbacked-up zkAPI Note detected ($10.00). Download backup now."` | Client-side state guard | Block new deposits until existing unbacked-up note is exported. |
- **Dependencies:** `@defuse-protocol/one-click-sdk-typescript@0.1.26`, `@aurora-is-near/intents-connect@7.24.0`, `circomlibjs@0.1.7`.
- **Out of Scope:** Direct fiat credit-card onramps (MoonPay/Stripe).
- **Analytics Events Emitted (Zero-PII):** `prism.note_generated_local`, `prism.aurora_quote_created` (`{ origin_chain, confidential_mode, fee_bps }`), `prism.solana_leaf_committed` (`{ leaf_index, latency_ms }`).

---

### Feature F-02: 90/10 Solana DeFi Float Router & `<400ms` Optimistic Credit (`R-009`, `R-010`)
- **Priority:** `R-009` (P0), `R-010` (P0)
- **User Story:** As a cross-chain user, I want to start making paid `x402` calls within `400ms` of broadcasting my origin-chain deposit while 90% of the vault's pooled TVL earns Solana DeFi yield that subsidizes my API usage.
- **Acceptance Criteria (Given/When/Then):**
  - *AC-01 (`R-010`):* **Given** a user has broadcast a deposit transaction to `depositAddress` on the origin chain, **When** the client calls `POST /api/v1/intents/optimistic-credit` with `{ auroraQuoteId, originTxHash, groth16Proof }`, **Then** the gateway verifies `originTxHash` is live on the origin network/Aurora status and issues an active `rk_live_opt_*` Runtime Key loaded with `min(expected_amount, 5_000_000)` micro-USDC in `<= 400ms` (p95).
  - *AC-02 (`R-009`):* **Given** settled USDC lands in `ZkYieldVault`, **When** `KaminoYieldRebalanceCrank` executes, **Then** 90% of total pool principal is supplied via CPI to the Solana DeFi yield reserve (`SOLANA_KAMINO_USDC_RESERVE_PUBKEY`), 10% remains in `liquid_vault` PDA, and every active `zk_runtime_sessions` record receives `yield_subsidy_micro_usdc = principal * (subsidy_bonus_bps / 10000)`.
- **Business Rules:**
  - `BR-03:` Optimistic credit is strictly capped at `$5.00` (`5,000,000 micro-USDC`) per unsettled quote and carries a `10 bps` fast-fill fee upon final Aurora settlement.
  - `BR-04:` If total optimistic utilization exceeds `80%` of the 10% Liquid Reserve PDA, new optimistic advances pause gracefully and fall back to standard Aurora settlement (`~20s`) while `KaminoYieldRebalanceCrank` unwraps liquidity.
- **Error Handling Table:**
  | Condition | User-Visible Message | HTTP Status & Code | System Action |
  | :--- | :--- | :--- | :--- |
  | `originTxHash` not found or reverted on origin chain | `"Waiting for origin chain broadcast confirmation before issuing instant credit..."` | `409 ERR_ORIGIN_TX_UNCONFIRMED` | Poll origin RPC 3 times at 1s intervals; if reverted, set `status = FAILED`. |
  | Aurora `GET /status` returns `REFUNDED` after optimistic credit issued | `"Origin swap was refunded by solver. Optimistic credit session has been revoked."` | `403 ERR_OPTIMISTIC_SESSION_REVOKED` | Immediately set `zk_runtime_sessions.status = 'REVOKED'` in Redis & Postgres. |
- **Dependencies:** Solana Anchor `RefractVault` program, Kamino kUSDC reserve CPI, Upstash Redis.
- **Analytics Events Emitted:** `float.optimistic_credit_issued` (`{ credit_micro_usdc, latency_ms }`), `float.defi_rebalanced` (`{ staked_micro_usdc, liquid_micro_usdc, apy_bps }`).

---

### Feature F-03: Client Groth16 BN254 Prover & On-Chain Nullifier Settlement (`R-005`, `R-006`, `R-008`)
- **Priority:** `R-005` (P0), `R-006` (P0), `R-008` (P0)
- **User Story:** As a buyer or AI agent, I want to prove ownership of an unspent note in zero knowledge to mint a fast, spend-capped Runtime Key backed by an on-chain Solana nullifier check.
- **Acceptance Criteria (Given/When/Then):**
  - *AC-01 (`R-005`):* **Given** the client fetches public leaves from `GET /api/v1/zkapi/tree`, **When** the browser WebWorker executes `snarkjs.groth16.fullProve()` against `refract_note_spend.wasm` and `refract_note_spend_final.zkey`, **Then** it outputs a 256-byte big-endian proof (with negated `proof_a` y-coordinate) and 4 public inputs (`[merkle_root, nullifier_hash, spend_cap, session_pubkey_hash]`) in `<= 2,200ms` (p95).
  - *AC-02 (`R-006`):* **Given** `POST /api/v1/zkapi/runtime-key` receives the proof, **When** the relayer submits `settle_zk_spend` to Solana, **Then** `groth16-solana` v0.2.0 verifies the proof against `ZkYieldVault.root_history` in `<= 140,000 CU`, initializes `NullifierRecord` PDA, and returns `rk_live_zk_*` with `effectiveBalanceMicroUsdc = principal + yieldSubsidy`.
- **Business Rules:**
  - `BR-05:` The on-chain `root_history` ring buffer stores the last `32` valid Merkle roots so concurrent deposits by other users never invalidate a proof currently being generated in a browser WebWorker.
- **Error Handling Table:**
  | Condition | User-Visible Message | HTTP Status & Code | System Action |
  | :--- | :--- | :--- | :--- |
  | Replayed `nullifier_hash` (Double-spend attempt) | `"This zkAPI note has already been spent or converted into an active session."` | `409 ERR_NULLIFIER_ALREADY_SPENT` | Reject at DB constraint and Solana `NullifierRecord` PDA init check. |
  | Stale Merkle root (`>32` deposits behind) | `"Merkle tree state updated. Refreshing path and re-proving automatically..."` | `409 ERR_STALE_MERKLE_ROOT` | Client auto-fetches `GET /api/v1/zkapi/tree` and regenerates proof once. |
- **Dependencies:** `snarkjs@0.7.6`, `groth16-solana@0.2.0`, `light-poseidon@0.4.1`.
- **Analytics Events Emitted:** `zkapi.proof_generated_client` (`{ duration_ms }`), `zkapi.solana_verified` (`{ compute_units, root_index }`).

---

### Feature F-04: Dual-Scheme `x402` Gateway, AI Playground & Agent Firewall (`R-007`, `R-011`, `R-012`, `R-013`, `R-015`, `R-016`)
- **Priority:** `R-007` (P0), `R-012` (P0), `R-016` (P0), `R-011` (P1), `R-013` (P1), `R-015` (P1)
- **User Story:** As a human or AI agent, I want to call `x402`-gated AI models and APIs in `<15ms` using my unlinkable Runtime Key, enforce strict per-request spend caps against prompt injection, inspect cryptographic proof of zero wallet leakage, and auto-refund unused balances to any chain.
- **Acceptance Criteria (Given/When/Then):**
  - *AC-01 (`R-007`, `R-016`):* **Given** an HTTP request to `/api/v1/ai/chat`, **When** `PAYMENT-SIGNATURE` is missing, **Then** return `HTTP 402` with `PAYMENT-REQUIRED` header in `<= 50ms`; **When** `PAYMENT-SIGNATURE` contains a valid `rk_live_*` key, **Then** authorize and atomically decrement balance in `<= 15ms` (p95) and attach a Schnorr-signed `X-ZKAPI-RECEIPT` header.
  - *AC-02 (`R-013`):* **Given** a Runtime Key with `max_per_request_micro_usdc = 100000` (`$0.10`), **When** an endpoint or simulated prompt-injection requests `2,500,000` (`$2.50`), **Then** reject with `HTTP 403 ERR_SPEND_CAP_EXCEEDED` before calling the upstream API.
  - *AC-03 (`R-011`):* **Given** an unspent balance on an active Runtime Key (or an upstream `5xx` API failure), **When** `POST /api/v1/intents/refund` is called with `{ destinationChain, destinationAsset, recipientAddress }`, **Then** initiate a reverse Aurora `1Click` swap from Solana USDC to the user's destination address and mark the session `CLOSED_REFUNDED`.
  - *AC-04 (`R-015`):* **Given** any completed `x402` call in `/playground`, **When** the user views the Double-Blind Privacy Inspector, **Then** it displays the live origin quote ID, Solana nullifier hash, and raw merchant HTTP headers confirming `walletBytesReceived: 0`.
- **Error Handling Table:**
  | Condition | User-Visible Message | HTTP Status & Code | System Action |
  | :--- | :--- | :--- | :--- |
  | Endpoint price `>` `max_per_request_micro_usdc` | `"Blocked by Agent Spend Policy Firewall: Endpoint costs $2.50 (Cap: $0.10/req)."` | `403 ERR_SPEND_CAP_EXCEEDED` | Block upstream call; deduct `0 USDC`; log blocked attempt in UI. |
  | `remaining_micro_usdc < price` | `"Insufficient zkAPI Note balance ($0.005 remaining, $0.015 required). Top up from any chain."` | `402 ERR_INSUFFICIENT_NOTE_BALANCE` | Return fresh `HTTP 402 PAYMENT-REQUIRED` challenge header. |
  | Upstream LLM (`OpenAI` & `Anthropic`) both return `5xx` | `"Upstream AI provider failed. 0.015 USDC charge rolled back automatically."` | `502 ERR_UPSTREAM_API_FAILURE` | Atomically refund `charged_micro_usdc` to `remaining_micro_usdc` and flag receipt `refund_triggered = TRUE`. |
- **Analytics Events Emitted:** `x402.challenge_issued`, `x402.payment_settled` (`{ scheme, verify_latency_ms, charged_micro_usdc }`), `x402.firewall_blocked` (`{ requested_micro_usdc, cap_micro_usdc }`), `x402.cross_chain_refund_initiated`.

---

## 6. User Flows & Time-To-First-Value (TTFV)

### 6.1 Flow 1: First-Run Any-Chain Deposit to First Unlinkable AI Call (`TTFV <= 25 Seconds`)
| Step | User Action | System Response | Data Changed & Validation | Failure / Recovery Path |
| :--- | :--- | :--- | :--- | :--- |
| **1 (0s)** | Lands on `/studio`; selects `Base USDC` (`10.00 USDC`), keeps `[x] Confidential Mode` checked, clicks **"Refract & Mint Note"**. | Generates `(nullifier, trapdoor)` in browser, computes Poseidon commitment, downloads `refract-note.json` backup, calls `POST /api/v1/intents/quote`. | Local `IndexedDB` stores note; `intent_deposits` row created (`status = QUOTE_CREATED`). | If popup blocked, renders inline "Click to Save Note Backup" button before enabling wallet transfer. |
| **2 (8s)** | Confirms `10.00 USDC` transfer in EVM/BTC/NEAR wallet to Aurora `depositAddress`. | Detects `originTxHash` and immediately calls `POST /api/v1/intents/optimistic-credit` with client Groth16 proof. | `intent_deposits.status = OPTIMISTIC_CREDITED`; `zk_runtime_sessions` row created with `$5.00` instant credit (`<= 400ms`). | If user rejects wallet tx, note remains `DRAFT` in browser; zero on-chain state changed. |
| **3 (12s)** | Automatically redirected to `/playground` with active `$5.00` Optimistic Runtime Key; clicks **"Send Private x402 Request"**. | Gateway verifies `rk_live_opt_*` in `12ms`, streams Claude 3.5 / GPT-4o response, deducts `0.015 USDC`, and opens **Double-Blind Inspector** showing `0 Wallet Bytes Sent`. | `zk_runtime_sessions.remaining_micro_usdc` decremented; `x402_usage_receipts` row written with Schnorr signature. | If LLM times out (`>1.5s`), router switches to fallback model; if both fail, rolls back `0.015 USDC` credit. |
| **4 (28s BG)** | Continues chatting with zero interruption. | Background `SolanaAnchorDepositWorker` receives Aurora settlement on Solana, calls `deposit_and_commit`, sweeps 90% (`$9.00`) to Kamino yield, and unlocks full `$10.84` (`+$0.84` yield bonus) balance. | `merkle_leaves` row inserted; `NullifierRecord` PDA initialized on Solana; `is_optimistic` flipped to `FALSE`. | If Aurora solver refunds on origin chain, revokes optimistic key and alerts user. |

---

## 7. Adversarial Edge Cases, AI Behavioral Spec & Web3 Requirements

### 7.1 P0 Adversarial Pass (Abuse, Failure & Edge Cases)
- **Concurrent Parallel Agent Calls (Race Condition Edge Case):** An autonomous agent fires 10 simultaneous `POST /api/v1/ai/chat` calls when `remaining_micro_usdc` only has enough balance for 3 calls. *Control:* Atomic single-statement `UPDATE ... WHERE remaining_micro_usdc >= $1` in Postgres / Lua script in Redis guarantees exactly 3 succeed (`HTTP 200`) and 7 receive `HTTP 402 ERR_INSUFFICIENT_NOTE_BALANCE` (`R-008`).
- **Offline / Mid-Proof Tab Refresh (Edge Case):** User refreshes browser while `snarkjs` is generating a Groth16 proof or after Solana `settle_zk_spend` succeeded but before `rk_live_*` was saved locally. *Control:* Deterministic `session_pubkey` derived from `Poseidon(nullifier, "session_key")` allows the client to recover its active `rk_live_*` token by signing a challenge with the deterministic session key (`R-005`, `R-008`).

### 7.2 AI Behavioral Specification (PRD Work Order #6)
- **What the AI Must Do:** Stream accurate responses to user/agent prompts, display the active model version (`gpt-4o-mini-2024-07-18` or `claude-3-5-sonnet-20241022`), attach a verifiable Schnorr usage receipt to every response, and explicitly state when an answer is an estimate or outside its training cutoff.
- **What the AI Must Never Do:** Never execute an upstream paid tool call exceeding the user's `max_per_request_micro_usdc` policy cap (`R-013`), never log prompt contents or IP addresses to persistent storage (`R-004`), and never fabricate on-chain transaction signatures or vault APY numbers.
- **Quality, Latency & Cost Budgets:** Time-to-First-Token (TTFT) `<= 800ms` (p95); max output `1,024 tokens` (`<= $0.0007` cost per `gpt-4o-mini` call); evaluated against the 20-prompt synthetic `x402` benchmark (`>= 95%` pass threshold).

### 7.3 Web3 Requirements & User-Visible Transaction States (PRD Work Order #7)
- **Seven Mandatory User-Visible States in UI:**
  1. `NOTE_COMMITTED_LOCAL`: Local Poseidon note created & `.json` backup saved.
  2. `AWAITING_ORIGIN_SIGNATURE`: Waiting for user's EVM/BTC/NEAR/SOL wallet signature.
  3. `OPTIMISTIC_CREDIT_ACTIVE (<400ms)`: Origin tx broadcast; Solana DeFi Float Pool has fronted instant `$5.00` x402 credit.
  4. `AURORA_SOLVER_ROUTING`: Aurora `1Click` solver settling cross-chain swap (`confidentialMode: true`).
  5. `SOLANA_MERKLE_CONFIRMED`: `deposit_and_commit` confirmed on Solana + 90% swept into Kamino DeFi yield.
  6. `ZK_NULLIFIER_VERIFIED`: On-chain `groth16-solana` proof verified (`<= 140k CU`).
  7. `REFUNDED_CROSS_CHAIN`: Unspent balance returned to user's destination chain via Aurora `1Click API`.

---

## 8. Non-Functional Requirements Summary

All 7 quantified NFRs (`NFR-001` `<= 15ms` p95 x402 verify latency, `NFR-002` `<= 400ms` optimistic credit latency, `NFR-003` `<= 2,200ms` p95 browser Groth16 prove time, `NFR-004` `<= 140,000 CU` on-chain Solana verification, `NFR-005` `0 bytes` wallet leakage, `NFR-006` WCAG 2.2 AA contrast `>= 4.5:1`, `NFR-007` `RPO = 0` / `RTO <= 5m` chain rebuild) are mapped with exact critical thresholds and test commands in `blueprint.md` Section 8 and `srd.md` Section 10.
- **Browser & Device Support:** Chrome/Brave/Edge `>= 120`, Firefox `>= 122`, Safari `>= 17.4` (WebAssembly + WebWorker + IndexedDB + WebCrypto support required), responsive from `375px` mobile viewports to `1440px+` desktop monitors.

---

## 9. External Integrations

| Integration | Purpose | Data Exchanged | Frequency | Failure Behavior & Fallback |
| :--- | :--- | :--- | :--- | :--- |
| **Aurora Intents / NEAR `1Click API`** (`https://1click.chaindefuser.com`) | Cross-chain quotes, persistent deposit addresses, `confidentialMode: true` routing, and reverse-intent refunds (`R-001`, `R-002`, `R-011`, `R-014`). | `QuoteRequest` JSON (`originAsset`, `destinationAsset`, `amount`, `referralFees`); no user prompts or ZK nullifiers sent. | 1 quote + 3–6 status polls per deposit or refund. | Retry 3x with exponential backoff; if origin chain is congested, fallback to direct Solana USDC deposit in `RefractVault`. |
| **Helius Solana RPC** (`Mainnet-Beta` & `Devnet`) | Submit `deposit_and_commit`, `settle_zk_spend`, and `rebalance_defi_float` Anchor instructions (`R-003`, `R-006`, `R-009`). | Signed Solana `VersionedTransaction` binary payloads. | 1 tx per deposit + 1 tx per Runtime Key mint + 1 crank/5m. | Automatic RPC failover to secondary Solana Mainnet RPC endpoint if primary latency `> 1,000ms`. |
| **Kamino Finance (`kUSDC` Reserve on Solana)** | Generates ~8–12% DeFi lending APY on 90% of vault float (`R-009`). | SPL USDC token transfers via Anchor CPI. | Rebalanced on deposit hook or 5-minute crank. | Circuit breaker keeps 100% of USDC in `liquid_vault` PDA if Kamino reserve utilization `> 98%`. |
| **OpenAI & Anthropic APIs** | Powers Refract Studio x402 AI Chat & Security Auditor endpoints (`R-012`). | Ephemeral `messages[]` array (stripped of wallet/IP identifiers). | Per user/agent `x402` chat call. | Automatic failover from `gpt-4o-mini` to `claude-3-5-sonnet` on `HTTP 429/5xx`; atomic balance rollback if both fail. |

---

## 10. Dependencies and Risks

| Risk ID | Description | Prob. | Impact | Mitigation Strategy | Early Warning Signal |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RISK-01** | `snarkjs` browser proof byte endianness or G1 negation mismatch with `groth16-solana` v0.2.0 on-chain verifier. | Medium | High | Run `spikes/verify_stack.ts` and `TEST-CHAIN-002` in Hour 1 using deterministic big-endian byte reversal + `proof_a` y-coordinate negation helper. | `Custom program error: 0x1` (`ProofVerificationFailed`) during `anchor test`. |
| **RISK-02** | Aurora `1Click API` cross-chain settlement takes `>30s` during live 90-second demo video recording. | High | High | Built **Optimistic Float Credit (`R-010`)** so the demo unlocks the `$5.00` Runtime Key and streams the paid `x402` AI response in **`<400ms`** while settlement finishes asynchronously in the background. | Origin chain block time `>2s` or solver status remaining `PENDING_DEPOSIT` `>10s`. |
| **RISK-03** | Unauthenticated `1Click API` calls incur a 25 bps fee penalty if Studio JWT is missing. | Low | Medium | Configured `AURORA_STUDIO_JWT_TOKEN` in `.env.example` and verified header injection in `OneClickService`. | Quote response showing `unauthenticatedFeeBps: 25`. |

---

## 11. Evidence-Gated Release Plan

| Release Milestone | Target Window | Included Requirements | Mandatory Evidence Gate to Exit Phase |
| :--- | :--- | :--- | :--- |
| **M1: Cryptographic & On-Chain Core** | Weekend Hours 1–8 | `R-004`, `R-006`, `R-009` | `anchor test` passes `settle_zk_spend` in `<= 140,000 CU` and rejects replayed `NullifierRecord` PDA (`TEST-CHAIN-002`). |
| **M2: Aurora Intents & Optimistic Float** | Weekend Hours 9–20 | `R-001`, `R-002`, `R-003`, `R-010`, `R-011`, `R-014` | Live quote from `https://1click.chaindefuser.com` succeeds with `confidentialMode: true` and `30 bps` fee; optimistic credit issues in `<= 400ms` (`TEST-INT-001`–`005`). |
| **M3: Hackathon 1 MVP Release (Nov 6–8 Submission)** | Weekend Hours 21–40 | `R-005`, `R-007`, `R-008`, `R-012`, `R-013`, `R-015`, `R-016`, `R-017`, `R-018` | End-to-end Mainnet micro-liquidity demo recorded (`$10` Base USDC $\rightarrow$ `<400ms` optimistic credit $\rightarrow$ `<15ms` `x402` AI chat $\rightarrow$ `0` wallet bytes leaked $\rightarrow$ 1Click cross-chain refund). |
| **M4: Encode H2 Checkpoints 1–3 (Weeks 2–4)** | Nov 9–30, 2026 | Multi-merchant SDK packaging (`@refract402/middleware`) + On-Chain Escape Hatch CLI | Published NPM package + external developer integrating Refract `x402` middleware in `<10 lines` of code. |

---

## 12. Open Questions & Glossary

### 12.1 Open Questions
No unresolved product-level questions remain. All business, compliance, and scope defaults are locked in `decisions.md`.

### 12.2 Glossary
- **`x402`:** Open HTTP 402 Payment Required protocol standard (`PAYMENT-REQUIRED` and `PAYMENT-SIGNATURE` headers) enabling machine-to-machine and per-request micropayments on Solana.
- **`zkAPI`:** Zero-knowledge API credit architecture (launched by Ethereum Foundation & Open Anonymity Project, Oct 2026) using Poseidon Merkle commitments and Groth16 spend proofs so API servers cannot correlate buyer wallets with API requests.
- **Aurora Intents (`NEAR Intents` / `1Click API`):** Cross-chain solver network supporting swaps, persistent deposits, and contract execution across 35+ EVM and non-EVM chains.
- **Confidential Intents:** Aurora Intents mode (`confidentialMode: true`, launched July 2026) that shields the origin wallet and swap route across the solver network.
- **Optimistic Float Credit:** Refract's fast-fill mechanism where the Solana 10% Liquid Reserve fronts up to `$5.00` of `x402` spending power in `<400ms` upon origin-chain transaction broadcast.
```
