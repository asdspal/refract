# Refract — Universal Product & Engineering Blueprint (`blueprint.md`)

**Version:** 2.0.0
**Date:** November 7, 2026
**Product Classification:** Hybrid Web3 Cross-Chain Privacy Clearinghouse + DeFi Yield Float Protocol + AI Agent Payment Facilitator (`x402` + `zkAPI`)
**Target Competitions:**
1. **Hackathon 1 (Solana Weekend Hackathon, Nov 6–8, 2026):** Top 3 Overall ($1,000 USD Microgrant), AI Track ($100), DeFi Track ($100).
2. **Hackathon 2 (Encode x Solana 4-Week Hackathon, Oct–Nov 2026):** Aurora Intents ($1,500 1st Place + Winner Support Bundle), Best Use of x402 on Solana (Accelerator), Best Consumer App on Solana (Accelerator).

---

## 1. Executive Summary

### 1.1 Product Vision & Core Outcome
**Refract** (`refract.sol` / `refract402`) is a cross-chain, yield-bearing **zkAPI** clearinghouse and **x402 (HTTP 402 Payment Required)** facilitator built on Solana and powered by **Aurora Intents** (`NEAR Intents`). It allows any human user or autonomous AI agent holding assets on **35+ blockchains** (Base, Arbitrum, Ethereum, Bitcoin, NEAR, TON, Zcash, Solana) to fund a private, yield-generating Solana API pass in one signature and pay any `x402`-protected API or AI model with **zero cryptographic link** between their wallet address and their API queries.

### 1.2 Users & Personas
1. **Multi-Chain AI Consumer / Indie Developer ("Alex"):** Wants to pay per prompt for top AI models (Claude 3.5 Sonnet, GPT-4o) and developer APIs using assets already held on Base, Arbitrum, or Bitcoin without bridging, acquiring SOL gas, or leaking their primary wallet net worth to API servers (`R-001`, `R-002`, `R-004`, `R-012`).
2. **Autonomous AI Agent Operator ("Devin-Bot"):** Runs headless agents that consume `x402` pay-per-request endpoints; needs sub-second HTTP authorization (`<15ms`), instant cross-chain top-ups (`<400ms` via optimistic credit), and hard spend-cap guardrails (`$0.10/call`) to block prompt-injection wallet drains (`R-008`, `R-010`, `R-013`, `R-016`).
3. **x402 API / AI Merchant ("Sarah"):** Monetizes an HTTP API via `x402`; wants to accept payments from 35+ chains effortlessly and have settled USDC revenue automatically earn ~8–12% APY in Solana DeFi (Kamino/Marginfi) rather than sitting idle (`R-007`, `R-009`, `R-011`).

### 1.3 MVP Boundary
- **In-Scope (Required P0/P1 for Weekend H1 & Encode H2):**
  - 35+-chain persistent deposit generation and `confidentialMode: true` routing via Aurora Intents (`@defuse-protocol/one-click-sdk-typescript` v0.1.26 & `@aurora-is-near/intents-connect` v7.24.0) (`R-001`, `R-002`, `R-003`, `R-014`).
  - Sub-400ms Optimistic Cross-Chain Credit fronted by the Solana DeFi Yield Float Pool upon origin-chain transaction broadcast (`R-010`).
  - Client-side **Poseidon Merkle Note** generation and **Groth16 BN254** zero-knowledge spend proofs (`snarkjs` v0.7.6) verified on Solana via `groth16-solana` v0.2.0 (`alt_bn128` precompile in `<140,000 CU`) (`R-004`, `R-005`, `R-006`).
  - Dual-scheme `x402` v2 HTTP gateway (`zkapi-groth16-bn254` and `zkapi-runtime-key` + `solana-spl`) with `<15ms` metered requests and **Schnorr-signed usage receipts** (`X-ZKAPI-RECEIPT`) (`R-007`, `R-008`, `R-016`).
  - 90/10 Solana DeFi Float Router (90% supplied to Kamino kUSDC reserve via CPI, 10% held in liquid reserve PDA) where accrued DeFi yield grants users an **AI Credit Subsidy Bonus (+8.4%)** (`R-009`).
  - Automated reverse-intent cross-chain refunds via Aurora `1Click API` when notes are closed or upstream APIs fail (`R-011`).
  - Consumer "Refract Studio" UI with AI Chat Playground, Bounded Agent Spend Policy Firewall, and Double-Blind Privacy Inspector (`R-012`, `R-013`, `R-015`, `R-017`).
- **Out-of-Scope (Explicit Exclusions `R-018`):**
  - Native iOS/Android mobile app binaries (web responsive down to `375px` is included).
  - Launching a speculative governance token (all settlements use canonical USDC).
  - Custom Circom trusted setup ceremony from scratch (uses deterministic Phase-1 Hermez Powers-of-Tau + reproducible circuit-specific Phase-2 `.zkey`).

### 1.4 Chosen Architecture & Key Trade-Offs
- **Chosen Pattern:** **Modular Monolith** (Next.js 15.2.4 App Router + TypeScript API Gateway + Solana Anchor 1.2.2 Workspace + PostgreSQL 16 + Upstash Redis).
- **Core Trade-Offs Accepted:**
  1. *Hybrid Runtime Key vs. Per-Request On-Chain ZK Proof (`ADR-002`):* Proving Groth16 on-chain once to mint a spend-capped, in-memory `rk_live_*` Runtime Key reduces per-request `x402` latency from `1,650ms` to `<15ms` and cuts Solana transaction costs by 95%, at the trade-off of trusting the gateway's Schnorr-signed receipts for intra-session micro-deductions (mitigated by on-chain challenge/escape capability).
  2. *Depth-20 Zero-Copy Merkle Tree (`GAP-002`):* Caps maximum notes per vault instance at $2^{20} = 1,048,576$ notes in exchange for reducing Solana Mainnet account rent to `0.0138 SOL` (~$1.25).

### 1.5 Top Three Assumptions
1. `ASSUMPTION-01 (Mainnet Micro-Liquidity):` Because NEAR Intents / Aurora `1Click API` has no testnet (`VERIFIED`: `docs.near-intents.org`), live cross-chain flows are demonstrated on **Solana Mainnet-Beta** using a $15–$25 real USDC float pool, while unit/stress tests run on Solana Devnet/Surfpool.
2. `ASSUMPTION-02 (Team & Time Budget):` 2–3 developers executing a 40-hour weekend sprint for Hackathon 1 (Nov 6–8, 2026) and continuing across 3 weekly checkpoints for Encode Hackathon 2.
3. `ASSUMPTION-03 (No PII Scope):` System operates strictly on pseudonymous cryptographic commitments (`Poseidon` hashes and `Groth16` nullifiers) with zero collection of names, emails, or IP-to-wallet logs.

---

## 2. Product Requirements Register & Specifications

### 2.1 Functional Requirements, User Stories, and Acceptance Criteria (Given/When/Then)

| Req ID | Priority | Status | User Story | Acceptance Criteria (Given / When / Then) | Exclusions / Business Rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R-001** | **P0** | CONFIRMED | As a multi-chain user/agent, I want a persistent deposit address accepting 35+ chains so I can fund my Solana x402 pass without manual bridging. | **Given** a user selects an origin chain/asset (e.g., Base USDC, Arbitrum USDT, BTC, NEAR), **When** `POST /api/v1/intents/quote` is called with `dry=false`, **Then** the system returns a valid origin `depositAddress` and `auroraQuoteId` within `1,500ms`. | Minimum deposit `1.00 USDC` equivalent; quote valid for 10 minutes. |
| **R-002** | **P0** | CONFIRMED | As a privacy-conscious user/agent, I want Aurora Confidential Intents enabled on my deposit so my origin wallet is not linked to the Solana destination. | **Given** Confidential Mode is toggled ON (`default: true`), **When** the quote request is dispatched to Aurora Intents, **Then** `confidentialMode: true` is passed and 0 bytes of the origin EOA address are written into the Solana Merkle leaf transaction. | If origin asset does not support direct confidential solver routing, gateway logs a warning and routes via shielded solver hop. |
| **R-003** | **P0** | CONFIRMED | As a user, I want my cross-chain deposit to automatically enter the Solana Refract Vault upon settlement without needing a second wallet signature or SOL gas. | **Given** Aurora Intents settles USDC on Solana, **When** the settlement webhook/relayer executes `deposit_and_commit`, **Then** 100% of settled USDC enters `ZkYieldVault` PDA and the user's `poseidon_commitment_hex` is inserted at `next_leaf_index`. | Relayer pays the `0.000005 SOL` transaction fee on Solana. |
| **R-004** | **P0** | CONFIRMED | As a user, I want my secret note (`nullifier`, `trapdoor`) generated locally in my browser and backed up automatically so the server never knows which deposit is mine. | **Given** a user clicks "Refract & Mint Note", **When** the browser generates `commitment = Poseidon(nullifier, trapdoor, amount)`, **Then** `nullifier` and `trapdoor` never leave client storage (`0 bytes` in network requests) and an encrypted `.json` backup file downloads automatically. | Lost un-backed-up notes cannot be recovered by the server (trustless bearer asset). |
| **R-005** | **P0** | CONFIRMED | As a client/agent, I want to generate a Groth16 BN254 zero-knowledge proof in a browser WebWorker proving I own an unspent note in the Merkle tree. | **Given** a valid local note and public Merkle leaves from `GET /api/v1/zkapi/tree`, **When** `proveNoteSpend()` runs in the WebWorker, **Then** `snarkjs` v0.7.6 produces a valid 256-byte big-endian Groth16 proof in `<= 2,200ms` (p95). | Proof binds `spend_cap_micro_usdc` and `session_pubkey_hash` as public inputs to prevent front-running. |
| **R-006** | **P0** | CONFIRMED | As the protocol, I must verify Groth16 BN254 proofs on-chain on Solana in `<200,000 CU` and record the nullifier PDA to prevent double-spending. | **Given** a 256-byte Groth16 proof and 4 public inputs, **When** `settle_zk_spend` is called on the Solana Anchor program, **Then** `groth16-solana` v0.2.0 verifies the pairing check in `<= 140,000 CU` and initializes `NullifierRecord` PDA (`seeds = [b"nullifier", nullifier_hash]`). | Replaying an existing `nullifier_hash` fails immediately with `AccountAlreadyInitialized`. |
| **R-007** | **P0** | CONFIRMED | As an API merchant, I want an `x402` v2 compliant middleware that challenges unpaid calls with `HTTP 402` and accepts both standard Solana SPL and `zkAPI` proofs. | **Given** a request to `/api/v1/ai/chat` without `PAYMENT-SIGNATURE`, **When** processed by `X402GatewayMiddleware`, **Then** it responds in `<= 50ms` with `HTTP 402` and a base64 `PAYMENT-REQUIRED` header listing `zkapi-groth16-bn254`, `zkapi-runtime-key`, and `solana-spl`. | Follows Coinbase/Solana x402 v2 header specification. |
| **R-008** | **P0** | INFERRED | As an AI agent making rapid calls, I want a short-lived Runtime Key (`rk_live_*`) minted from one Groth16 proof with Schnorr-signed metered usage receipts. | **Given** an active `rk_live_*` Runtime Key with `10.00 USDC` balance, **When** the agent sends a prompt costing `0.015 USDC`, **Then** authorization completes in `<= 15ms` (p95) and the response includes an `X-ZKAPI-RECEIPT` header with a valid Schnorr signature over `(nullifier_hash, charged, remaining)`. | Runtime keys expire after 24 hours or upon manual session closure. |
| **R-009** | **P0** | CONFIRMED | As a user and merchant, I want 90% of pooled vault USDC routed into a Solana DeFi yield pool (Kamino/Marginfi) so idle float earns APY that subsidizes AI API costs. | **Given** `100.00 USDC` resides in `ZkYieldVault`, **When** the deposit hook or rebalance crank executes, **Then** `90.00 USDC` is supplied to the Solana DeFi yield reserve, `10.00 USDC` stays in the liquid reserve PDA, and active runtime sessions receive the current `subsidy_bonus_bps` (`+8.4%` default). | Liquid reserve never drops below 10% of total pool TVL. |
| **R-010** | **P0** | CONFIRMED | As a cross-chain user, I want instant `<400ms` optimistic x402 credit as soon as my origin transaction is broadcast so I never wait 30s for cross-chain finality. | **Given** a valid `auroraQuoteId` and broadcast `originTxHash`, **When** `POST /api/v1/intents/optimistic-credit` is called, **Then** the Solana DeFi Liquid Reserve fronts up to `5.00 USDC` of active Runtime Key credit within `400ms` (p95) and recoups principal + `10 bps` fee upon Aurora settlement. | Capped at `$5.00` per unsettled origin transaction; revoked if origin tx reverts. |
| **R-011** | **P1** | CONFIRMED | As a user, I want my unspent note balance or failed API charges automatically refunded to any of 35+ chains via Aurora `1Click API`. | **Given** an active Runtime Key with unspent balance or a `5xx` upstream API error, **When** `POST /api/v1/intents/refund` is called with a destination chain/address, **Then** the gateway initiates a reverse Aurora Intent payout and updates status to `CLOSED_REFUNDED`. | Deducts standard 1 bps Aurora solver fee on cross-chain exit. |
| **R-012** | **P0** | CONFIRMED | As an everyday consumer, I want an interactive AI Chat & API Playground ("Refract Studio") where I can query GPT-4o / Claude 3.5 using my private note. | **Given** an active `zkAPI` note in browser storage, **When** the user submits a prompt in `/playground`, **Then** the AI response streams live and displays exact micro-USDC deducted, remaining balance, and DeFi yield subsidy applied. | Supports model switching between `gpt-4o-mini` and `claude-3-5-sonnet`. |
| **R-013** | **P1** | CONFIRMED | As an agent operator, I want configurable per-request and daily spend caps on my Runtime Key so a prompt-injected agent cannot drain my vault. | **Given** a Runtime Key with `max_per_request_micro_usdc = 100000` (`$0.10`), **When** an agent attempts to call an endpoint costing `2,500,000` (`$2.50`), **Then** the gateway blocks the request with `HTTP 403 ERR_SPEND_CAP_EXCEEDED` and deducts `0 USDC`. | Configurable in UI between `$0.01` and `$50.00` per call. |
| **R-014** | **P1** | CONFIRMED | As the protocol integrator, I want custom `referralFees` (`30 bps`) attached to Aurora Intents quotes to capture the 40%–60% Aurora integrator revenue share. | **Given** any quote request to `OneClickService.getQuote()`, **When** the payload is constructed, **Then** `referralFees` includes `{ recipient: AURORA_INTEGRATOR_FEE_RECIPIENT, fee: 30 }`. | Displayed transparently in the UI fee breakdown. |
| **R-015** | **P1** | INFERRED | As a hackathon judge or privacy auditor, I want a live "Double-Blind Privacy Inspector" showing what the Origin Chain, Solana, and the AI Server each see. | **Given** a completed `x402` AI call, **When** the Inspector Drawer is opened, **Then** it displays the real Aurora `quoteId`, the Solana `nullifierHash`, and raw HTTP headers proving `walletBytesReceived: 0`. | Live telemetry, zero hardcoded mock strings. |
| **R-016** | **P0** | INFERRED | System NFR: Runtime-key `x402` verification must complete in `<= 15ms` (p95) and on-chain Groth16 settlement in `<= 400ms` (plus 1 Solana slot). | **Given** a 50 RPS k6 load test on `/api/v1/ai/chat`, **When** measured over 60 seconds, **Then** gateway authorization overhead (`Server-Timing: x402-verify-dur`) is `<= 15ms` at p95. | Verified by `TEST-PERF-001`. |
| **R-017** | **P1** | INFERRED | System NFR: UI must meet WCAG 2.2 Level AA contrast (`>= 4.5:1` text, `>= 3.0:1` UI borders) and full keyboard operability. | **Given** the rendered `/studio` and `/playground` screens, **When** audited by the luminance script and `axe-core`, **Then** 0 contrast or keyboard-trap violations occur. | Verified by `TEST-A11Y-001`. |
| **R-018** | **P3** | CONFIRMED | Explicit Exclusion: No native mobile app binaries and no custom speculative token. | **Given** the production repository, **When** audited at submission, **Then** all settlements use canonical USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`). | Verified by `TEST-SCOPE-001`. |

### 2.2 Roles & Permissions Summary
- **`ANONYMOUS_DEPOSITOR`:** Can request Aurora Intents quotes (`POST /intents/quote`), read public Merkle leaves (`GET /zkapi/tree`), and submit Groth16 proofs to mint Runtime Keys (`POST /zkapi/runtime-key`).
- **`ZK_RUNTIME_AGENT`:** Authenticated via `PAYMENT-SIGNATURE` (`rk_live_*` or direct Groth16 proof); can call protected `x402` endpoints within configured spend caps (`POST /ai/chat`) and trigger cross-chain refunds of its own unspent session (`POST /intents/refund`).
- **`X402_MERCHANT`:** Authenticated via `Sign-In With Solana (SIWS)` Ed25519 signature; can register API endpoints, view aggregated revenue + DeFi yield, and trigger payouts.
- **`VAULT_RELAYER_SERVICE`:** Internal backend worker holding `SOLANA_RELAYER_PRIVATE_KEY_BASE58` (funded only with gas SOL); authorized to submit `deposit_and_commit`, `settle_zk_spend`, and `rebalance_defi_float` transactions on Solana, with zero permission to withdraw vault USDC to arbitrary addresses.

---

## 3. Design Specification Summary (`design-tokens.json`)

### 3.1 Color Tokens & Computed WCAG 2.2 Contrast Ratios
All colors are defined in `blueprint/design-tokens.json` and verified via relative luminance calculation in `reviews/verification.md`:
- **Surfaces:** `bg.canvas` (`#090A0F`, $L=0.0056$), `bg.surface` (`#11141E`, $L=0.0144$), `bg.elevated` (`#181C2A`, $L=0.0232$).
- **Typography Colors:** `text.primary` (`#F8FAFC` — **15.62:1** on surface, AAA), `text.secondary` (`#94A3B8` — **6.46:1** on surface, AA), `text.muted` (`#7C8BA1` — **4.72:1** on surface, AA), `text.onAccent` (`#06080E` — **9.83:1** on `#38BDF8`, AAA).
- **Accents & Semantic:** `accent.cyan` (`#38BDF8` — **8.21:1**), `accent.ultraviolet` (`#C084FC` — **6.24:1**), `accent.mint` (`#34D399` — **9.25:1**), `semantic.warning` (`#FBBF24` — **10.65:1**), `semantic.error` (`#F87171` — **5.67:1**), `border.interactive` (`#64748B` — **3.94:1** on canvas, passes WCAG 2.2 AA 3:1 non-text contrast).

### 3.2 Typography, Spacing, Grid & Component States
- **Fonts:** `'Inter'` (UI headings/body) and `'JetBrains Mono'` (hashes, nullifiers, basis points, HTTP headers).
- **Grid & Breakpoints:** 12-column CSS Grid (`max-width: 1380px`, `24px` gap on desktop `>=1280px`, 8-column `16px` gap on tablet `768px`, 1-column `16px` stack on mobile `375px`).
- **Component States (Mandatory Across All Controls):**
  - *Default:* Surface `#11141E` or input `#090A0F` with `1px solid #64748B`.
  - *Hover:* Border brightens to `#38BDF8`, primary button shifts luminosity $+6\%$.
  - *Focus (`:focus-visible`):* `2px solid #38BDF8` ring with `2px` offset (`10.14:1` contrast).
  - *Active:* `transform: translateY(1px)`.
  - *Disabled:* Background `#1E2436`, text `#64748B`, `cursor: not-allowed`, `aria-disabled="true"`.
  - *Loading:* Inline SVG spinner + `aria-busy="true"` + live step label (e.g., `"Computing Groth16 Witness (1.1s)..."`).
  - *Error:* `1px solid #F87171` border, `rgba(248, 113, 113, 0.12)` background banner, `role="alert"` with explicit problem + fix copy.

---

## 4. Validated Technology Stack

| Layer | Technology | Exact Version | Source URL | Retrieved | Purpose | Limits & Constraints | Cost Model | Lock-in | Alternatives Considered |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **App Framework & API Gateway** | Next.js + React + TypeScript | `15.2.4` / `19.0.0` / `5.7.3` | `https://www.npmjs.com/package/next` | 2026-11-07 | App Router UI (`/studio`, `/playground`, `/merchant`) + x402 API gateway (`R-007`, `R-012`). | Node runtime required for `snarkjs` server fallback; SSE streaming for AI chat. | $0 (Hobby) / $20/mo (Pro). | Low (standard Fetch Request/Response handlers). | Separate Express + Vite SPA (rejected: adds CORS and dual-deploy overhead). |
| **Aurora Intents 1Click SDK** | `@defuse-protocol/one-click-sdk-typescript` | `0.1.26` | `https://www.npmjs.com/package/@defuse-protocol/one-click-sdk-typescript` | 2026-11-07 | Programmatic 35+-chain quotes, deposit addresses, status polling, and reverse-intent refunds (`R-001`, `R-011`, `R-014`). | Mainnet-only (`https://1click.chaindefuser.com`); requires JWT to waive 0.25% unauthenticated fee. | 1 bps solver fee + 30 bps custom integrator fee (40%–60% split). | Low (REST OpenAPI client). | Raw `fetch` without types (rejected: SDK provides typed `QuoteRequest` models). |
| **Aurora Swap Widget & Connect** | `@aurora-is-near/intents-swap-widget` & `@aurora-is-near/intents-connect` | `7.24.0` | `https://www.npmjs.com/package/@aurora-is-near/intents-swap-widget` | 2026-11-07 | Multi-chain wallet connection, `confidentialMode: true` routing, and atomic Solana destination call (`R-002`, `R-003`). | Peer dependency on `@solana/web3.js` v1 (`1.99.0`). | Free SDK. | Medium (required by Aurora track rules). | deBridge DLN Widget (rejected: disqualified from $1,500 Aurora bounty). |
| **Solana Smart Contract Framework** | `anchor-lang` / `@anchor-lang/core` | `1.2.2` (Rust) / `1.0.0` (TS) | `https://docs.rs/crate/anchor-lang/1.2.2` | 2026-11-07 | Solana on-chain `RefractVault` program (`R-003`, `R-006`, `R-009`). | Includes fix for `RUSTSEC-2026-0146`; zero-copy account serialization for Merkle tree. | ~1.8 SOL refundable program deploy deposit. | High (Solana SVM specific). | Native pinocchio Rust (rejected: Anchor provides safer IDL & PDA checks in 40h). |
| **Solana Web3 Client** | `@solana/web3.js` | `1.99.0` | `https://www.npmjs.com/package/@solana/web3.js` | 2026-11-07 | Transaction building, Ed25519 SIWS verification, and Helius RPC calls. | Strictly pinned to `1.99.0` (avoids `1.95.6` CVE-2024-54134 and `3.1.0` widget peer conflict). | Free MIT. | Low. | `@solana/web3.js@3.1.0` (rejected: breaks Aurora widget v1 peer types). |
| **On-Chain ZK Verifier & Poseidon** | `groth16-solana` & `light-poseidon` | `0.2.0` & `0.4.1` | `https://crates.io/crates/groth16-solana` | 2026-11-07 | On-chain BN254 Groth16 pairing verification (`~104k CU`) and Poseidon hashing via Solana syscalls (`R-006`). | Requires big-endian public inputs and negated `proof_a` G1 point. | <$0.0005 per Solana tx. | Low. | Custom arkworks WASM verifier (rejected: exceeds Solana 1.4M CU ceiling). |
| **Browser ZK Prover** | `snarkjs` & `circomlibjs` | `0.7.6` & `0.1.7` | `https://www.npmjs.com/package/snarkjs` | 2026-11-07 | Client-side WebWorker Groth16 witness & proof generator (`R-004`, `R-005`). | ~1.8MB `.zkey` artifact cached in browser IndexedDB. | Free GPL-3.0. | Low. | Noir `bb.js` UltraHonk (rejected: UltraHonk verifier on Solana exceeds 200k CU budget). |
| **Database & Atomic Cache** | PostgreSQL 16 (Neon) + Upstash Redis | `16.4` / `7.2` | `https://neon.tech` / `https://upstash.com` | 2026-11-07 | Public Merkle leaf mirror, runtime-key balances, and Schnorr receipt ledger (`R-008`, `R-010`). | Free tier covers 1x MVP scale; pooled PgBouncer connections for serverless. | $0 (1x) / $24/mo (10x). | Low (standard SQL). | Supabase / PlanetScale (Neon chosen for instant branching & zero cold start). |

---

## 5. System Architecture

### 5.1 Logical & Deployment View (Text Diagram)
```
[Browser / AI Agent CLI]
   |-- (HTTPS / TLS 1.3) --> [Vercel Edge & Node Serverless (Next.js 15.2.4)]
                                |-- /api/v1/intents/*  ---> [Aurora 1Click API (1click.chaindefuser.com)]
                                |-- /api/v1/zkapi/*    ---> [Helius Solana RPC (Mainnet-Beta / Devnet)]
                                |                              |--> [RefractVault Program (Anchor 1.2.2)]
                                |                              |--> [Kamino kUSDC Lending Vault (CPI)]
                                |-- /api/v1/ai/chat    ---> [Upstash Redis (Lua Atomic Spend Meter)]
                                                        |--> [Neon PostgreSQL 16 (Receipts & Leaves)]
                                                        |--> [OpenAI gpt-4o-mini / Anthropic Claude 3.5]
```

### 5.2 Request Lifecycle & Data Flow
1. **Cross-Chain Funding Flow (`R-001`–`R-004`, `R-009`, `R-010`):** Client generates local note `(nullifier, trapdoor)` $\rightarrow$ requests quote from `/api/v1/intents/quote` (`confidentialMode: true`) $\rightarrow$ broadcasts origin-chain deposit $\rightarrow$ calls `/api/v1/intents/optimistic-credit` to receive `<400ms` `$5.00` credit from the Solana 10% Liquid Reserve $\rightarrow$ Aurora Intents settles USDC on Solana $\rightarrow$ `SolanaAnchorDepositWorker` calls `deposit_and_commit` on Anchor program $\rightarrow$ inserts Poseidon leaf into Merkle tree, repays optimistic advance, and supplies 90% of USDC to Kamino via CPI.
2. **Unlinkable `x402` Spend Flow (`R-005`–`R-008`, `R-012`, `R-013`):** Client calls `/api/v1/ai/chat` $\rightarrow$ receives `HTTP 402` + `PAYMENT-REQUIRED` header $\rightarrow$ WebWorker proves Groth16 BN254 ownership of an unspent Merkle leaf $\rightarrow$ calls `/api/v1/zkapi/runtime-key` $\rightarrow$ Anchor program verifies proof via `groth16-solana` (`<140k CU`) and creates `NullifierRecord` PDA $\rightarrow$ Gateway issues `rk_live_*` Runtime Key with `+8.4%` DeFi yield subsidy bonus $\rightarrow$ Client retries `/api/v1/ai/chat` with `PAYMENT-SIGNATURE: base64(rk_live_*)` $\rightarrow$ Redis Lua script verifies spend cap (`<= $0.10`) and decrements balance in `<15ms` $\rightarrow$ AI response streams with `X-ZKAPI-RECEIPT` Schnorr signature.

### 5.3 Failure, Retry, Scaling, Backup/Restore & Environment Separation
- **Retry Strategy:** Idempotent exponential backoff (`base = 500ms`, `factor = 2.0`, `maxRetries = 4`, jitter $\pm 20\%$) on Solana RPC blockhash confirmation and Aurora status polling.
- **Scaling Triggers:** Upstash Redis handles up to 10,000 RPS for runtime-key checks; when on-chain Groth16 mints exceed 40 RPS, enable Helius staked connections (`sendTransaction` via dedicated staked TPU).
- **Backup, RPO & RTO:** PostgreSQL automated point-in-time recovery (PITR) on Neon (`RPO = 0` for on-chain state, `RTO <= 5 minutes` via `npm run db:rebuild-from-chain` which replays `DepositCommitted` and `NullifierSpent` Anchor events from Solana history).
- **Environments:** `development` (Local Surfpool / Devnet + Neon dev branch), `preview` (Vercel PR preview), `production` (Solana Mainnet-Beta + Aurora `1Click` Mainnet + Neon prod branch).

---

## 6. Authentication and Authorization

### 6.1 Mechanisms & Session Lifetimes
1. **Zero-Knowledge Capability Auth (`zkAPI` Buyers & AI Agents):**
   - *Mechanism:* Possession of a valid Groth16 BN254 proof or an active `rk_live_<32_byte_random_hex>` Runtime Key stored as `SHA-256(runtime_key)` in `zk_runtime_sessions.runtime_key_hash`.
   - *Lifetime & Revocation:* Default TTL `24 hours` (`expires_at`). Instant revocation upon `POST /api/v1/intents/refund` (`status = 'CLOSED_REFUNDED'`) or if an optimistic deposit fails on the origin chain (`status = 'REVOKED'`).
2. **Merchant Auth (`Sign-In With Solana / SIWS`):**
   - *Mechanism:* Ed25519 signature over canonical SIWS message (`domain`, `address`, `nonce`, `issuedAt`, `expirationTime`) verified via `tweetnacl.sign.detached.verify`.
   - *Lifetime:* Stateless `HttpOnly; Secure; SameSite=Strict` JWT valid for `4 hours`.
3. **Internal Worker / Webhook Auth:**
   - *Mechanism:* HMAC-SHA256 verification against `REFRACT_INTERNAL_WEBHOOK_SECRET` with a 300-second replay timestamp window.

### 6.2 RBAC / ABAC Matrix & Tenant Isolation
| Role | `/intents/quote` | `/zkapi/runtime-key` | `/ai/chat` (x402) | `/intents/refund` | `/merchant/*` | On-Chain `RefractVault` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Anonymous Client** | ALLOW (Rate-limited 20/min) | ALLOW (Requires valid Groth16 proof) | DENY (Returns `HTTP 402`) | DENY | DENY | Read-only PDA state |
| **Runtime Key Holder (`rk_live_*`)** | ALLOW | ALLOW | ALLOW (ABAC: `cost <= max_per_request` & `cost <= remaining`) | ALLOW (Own session only) | DENY | Nullifier already committed |
| **SIWS Merchant** | ALLOW | ALLOW | ALLOW | DENY | ALLOW (ABAC: `merchant.solana_pubkey == jwt.sub`) | Withdraw own `MerchantAccount` PDA |
| **Vault Relayer Worker** | N/A | Internal | N/A | Internal | N/A | Submit `deposit_and_commit` & `rebalance_defi` |

---

## 7. Data Model (`schema.sql` & On-Chain / Off-Chain Separation)

### 7.1 Blockchain Data Separation Matrix
- **Strictly On-Chain (Solana `RefractVault` Program):** `ZkYieldVault` PDA (20-level Poseidon `filled_subtrees`, 32-root `root_history` ring buffer, total principal & yield counters), `NullifierRecord` PDAs (`nullifier_hash`, `spent_at_slot`), and SPL Token vaults (`liquid_vault` PDA, Kamino kUSDC cToken vault).
- **Strictly Client-Owned (Browser IndexedDB / `.json` Backup — NEVER sent to server or chain):** Raw `nullifier` (31B field element), raw `trapdoor` (31B field element), leaf index mapping to user's identity.
- **Off-Chain Indexed / Cached (`PostgreSQL 16` + `Upstash Redis`):** Public `merkle_leaves` mirror (for fast `<50ms` client path construction), `intent_deposits` status tracking, `zk_runtime_sessions` metered balances, `x402_usage_receipts` (Schnorr signatures), and `defi_vault_snapshots`.

### 7.2 PostgreSQL 16 Entities, Constraints, Indexes & Concurrency (`schema.sql`)
All 6 tables (`intent_deposits`, `merkle_leaves`, `zk_runtime_sessions`, `x402_merchants`, `x402_usage_receipts`, `defi_vault_snapshots`) and 8 named indexes are defined in `blueprint/schema.sql`.
- **Transaction Boundaries & Concurrency Control:** Runtime key deductions execute inside a single atomic transaction `UPDATE zk_runtime_sessions SET remaining_micro_usdc = remaining_micro_usdc - $1, spent_today_micro_usdc = spent_today_micro_usdc + $1 WHERE runtime_key_hash = $2 AND status = 'ACTIVE' AND remaining_micro_usdc >= $1 AND $1 <= max_per_request_micro_usdc RETURNING remaining_micro_usdc;`. This prevents race-condition double-spending under concurrent parallel AI agent tool calls without requiring `SERIALIZABLE` table locks.

---

## 8. Screens Specification

### 8.1 Screen 1: `/studio` — Any-Chain Prism Deposit & DeFi Float Vault
- **Purpose & Roles:** Allows any multi-chain user (`ANONYMOUS_DEPOSITOR`) to select an origin asset across 35+ chains, toggle Aurora Confidential Mode, generate a local `zkAPI` note with 1-click backup, and receive instant `<400ms` optimistic credit while viewing live 90/10 Solana DeFi yield telemetry (`R-001`–`R-004`, `R-009`, `R-010`, `R-014`, `R-017`).
- **Components & Data Sources:** `OriginChainSelector` (`OneClickService.getTokens()`), `ConfidentialModeSwitch`, `NoteBackupCard`, `DefiYieldSplitBar` (`GET /api/v1/defi/vault-stats`), `OptimisticCreditBadge` (`POST /api/v1/intents/optimistic-credit`).
- **States:** *Loading* (skeleton shimmer on token list + step progress bar during Aurora quote), *Empty* ("No active zkAPI notes in browser storage — deposit from any chain or import backup `.json`"), *Error* (inline `role="alert"` if origin wallet rejects signature or quote expires), *Success* (green Mint badge showing active `rk_live_*` credit + downloaded backup confirmation).

### 8.2 Screen 2: `/playground` — Unlinkable `x402` AI Chat, Agent Firewall & Double-Blind Inspector
- **Purpose & Roles:** Consumer AI chat & agent playground (`ZK_RUNTIME_AGENT`) demonstrating live `HTTP 402` negotiation, WebWorker Groth16 proving, streaming LLM output, bounded spend-cap enforcement, and 1-click reverse-intent cross-chain refunds (`R-005`–`R-008`, `R-011`–`R-013`, `R-015`, `R-017`).
- **Components & Data Sources:** `AiStreamChatBox` (`POST /api/v1/ai/chat`), `SpendPolicySlider` (`max_per_request_micro_usdc`), `SimulatePromptInjectionAttackButton`, `DoubleBlindInspectorDrawer`, `CrossChainRefundModal` (`POST /api/v1/intents/refund`).
- **States:** *Loading* (WebWorker Groth16 proof progress timer `0.0s -> 1.2s` + SSE token stream), *Empty* (starter prompt cards), *Error* (`HTTP 403 ERR_SPEND_CAP_EXCEEDED` banner when simulated prompt-injection requests `$2.50` against a `$0.10` cap), *Success* (verified Schnorr receipt pill + `0 Wallet Bytes Sent` proof in Inspector).

### 8.3 Screen 3: `/merchant` — `x402` API Provider & Auto-Compounding DeFi Treasury
- **Purpose & Roles:** Dashboard for API providers (`X402_MERCHANT`) to register `x402` endpoints, monitor incoming `zkAPI` nullifier settlements, inspect auto-compounded Kamino DeFi yield, and withdraw revenue to any of 35+ chains via Aurora `1Click API` (`R-007`, `R-009`, `R-011`, `R-014`).

---

## 9. API Specification Summary (`openapi.yaml`)

All endpoints use `/api/v1` prefix, `application/json`, `X-Correlation-Id` tracing headers, and standardized `{ code, message, correlationId }` error envelopes. Full schemas are validated in `blueprint/openapi.yaml`:

| Method & Path | Auth | Rate Limit | Idempotency | Purpose & Requirement IDs | Side Effects & Events Emitted |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST /api/v1/intents/quote` | Public | 20 req/min/IP | `poseidonCommitmentHex` | Creates Aurora `1Click` quote (`dry: false`, `confidentialMode: true`, `referralFees: 30 bps`) (`R-001`, `R-002`, `R-014`). | Inserts row in `intent_deposits`; emits `intent.quote_created`. |
| `POST /api/v1/intents/optimistic-credit` | Public (Groth16 signed) | 10 req/min/IP | `auroraQuoteId` | Verifies broadcast `originTxHash` and fronts up to `$5.00` optimistic credit from Solana DeFi Liquid Reserve in `<400ms` (`R-010`). | Creates `is_optimistic=true` row in `zk_runtime_sessions`; emits `intent.optimistic_credited`. |
| `GET /api/v1/zkapi/tree` | Public | 60 req/min/IP | Read-only (Cached 2s) | Returns active Solana `currentRootHex`, `nextLeafIndex`, and ordered `commitment_hex` array (`R-004`, `R-005`). | None. |
| `POST /api/v1/zkapi/runtime-key` | Groth16 Proof | 15 req/min/IP | `nullifierHashHex` | Submits `settle_zk_spend` to Solana (`groth16-solana`), verifies proof on-chain, and mints `rk_live_*` Runtime Key with DeFi yield subsidy (`R-005`, `R-006`, `R-008`, `R-013`). | Writes `NullifierRecord` PDA on Solana + row in `zk_runtime_sessions`; emits `zkapi.session_minted`. |
| `POST /api/v1/ai/chat` | `PAYMENT-SIGNATURE` (`x402` v2) | 120 req/min/key | `X-Idempotency-Key` | Challenges unpaid requests with `HTTP 402`; verifies `rk_live_*` or Groth16 proof in `<15ms`, enforces spend cap, streams LLM reply, and signs `X-ZKAPI-RECEIPT` (`R-007`, `R-008`, `R-012`, `R-013`, `R-015`, `R-016`). | Atomically decrements `remaining_micro_usdc` and inserts `x402_usage_receipts`. |
| `POST /api/v1/intents/refund` | `PAYMENT-SIGNATURE` | 10 req/min/key | `session_id` | Closes unspent `zkAPI` runtime session or failed API call and triggers Aurora `1Click` cross-chain payout to user's chosen chain (`R-011`). | Marks session `CLOSED_REFUNDED` and dispatches Aurora swap payout. |
| `GET /api/v1/defi/vault-stats` | Public | 60 req/min/IP | Read-only (Cached 5s) | Returns live 90/10 Solana DeFi Float Pool TVL, Kamino APY bps, and active AI credit subsidy bonus bps (`R-009`, `R-017`). | None. |

---

## 10. AI Architecture

- **Models & Exact Versions:** Primary model `gpt-4o-mini-2024-07-18` (OpenAI API); Secondary/Analysis model `claude-3-5-sonnet-20241022` (Anthropic API).
- **Routing & Fallback:** `AiInferenceRouterService` routes requests with a `1,500ms` time-to-first-token timeout. If the primary provider returns `HTTP 429` or `5xx`, the router transparently retries against the secondary provider before committing the `x402` balance deduction.
- **Cost Controls & Token Budgets:** Maximum output tokens capped at `1,024 tokens` per call (`~$0.0006` actual LLM cost vs. `$0.015` x402 micro-charge), guaranteeing positive unit economics on every paid call and zero unauthenticated LLM execution (protected behind the mandatory `HTTP 402` gate).
- **Prompt-Injection & Billing Defense (`R-013`):** Even if an adversarial prompt instructs an autonomous agent to call a high-priced endpoint, `AgentSpendPolicyGuard` enforces `max_per_request_micro_usdc` at the cryptographic gateway layer prior to LLM or upstream tool execution.
- **Evaluation Harness:** 20-case deterministic benchmark (`tests/ai/x402_agent_eval.test.ts`) verifying: (1) 100% `HTTP 402` header parse accuracy, (2) 100% enforcement of spend-cap rejections on adversarial prompts, and (3) 0 bytes of wallet/IP PII in outbound OpenAI/Anthropic payloads.

---

## 11. Web3 Architecture

- **Chain & Network:** Solana Mainnet-Beta (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` canonical USDC) for live Aurora Intents cross-chain execution (`ASSUMPTION-01`, `VERIFIED` that NEAR Intents has no testnet), plus Solana Devnet / local Surfpool for automated Anchor CI test suites.
- **Custody Model:** **100% Non-Custodial Bearer Notes & Smart Contract Escrow.** User deposits are held inside the Solana `ZkYieldVault` Anchor PDA and Kamino kUSDC reserve. Only a valid BN254 Groth16 proof matching an unspent leaf in `root_history` can authorize spending from the vault.
- **Confirmation, Finality & Reorg Handling:** Solana transactions use `confirmed` commitment (`~400ms` optimistic confirmation) for runtime-key minting and `finalized` commitment (`~12.8s`) before sweeping large principal blocks into Kamino. Cross-chain Aurora Intents status polling checks `OneClickService.getExecutionStatus(depositAddress)` until `status === 'SUCCESS'`.

---

## 12. Workers and Background Jobs

| Worker / Job Name | Trigger | Input Payload | Output / Side Effects | Retry & Backoff Policy | Timeout & Idempotency | Dead-Letter & Failure Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`SolanaAnchorDepositWorker`** (`R-003`, `R-004`, `R-010`) | Polls active `PENDING_DEPOSIT` rows every `3s` OR triggered via `/api/v1/intents/webhook`. | `{ auroraQuoteId, depositAddress, poseidonCommitmentHex }` | When Aurora `GET /status == SUCCESS`, invokes `deposit_and_commit` on Solana Anchor program, inserts leaf into `merkle_leaves`, and settles optimistic advance. | 5 retries; exponential backoff `1s, 2s, 4s, 8s, 16s`. | Timeout `25s`; idempotent on `UNIQUE(commitment_hex)` and Anchor leaf check. | If Aurora status is `REFUNDED` or `FAILED`, revokes optimistic credit in Redis and logs alert. |
| **`KaminoYieldRebalanceCrank`** (`R-009`) | Scheduled cron every `5 minutes` AND post-deposit hook when liquid reserve `> 15%` TVL. | `{ vaultPubkey, currentLiquidMicroUsdc, targetRatioBps: 9000 }` | Executes CPI from `ZkYieldVault` to Kamino kUSDC reserve to restore 90% staked / 10% liquid split; writes `defi_vault_snapshots`. | 3 retries; backoff `2s, 5s, 10s`. | Timeout `20s`; idempotent based on on-chain vault token balances. | Leaves excess USDC safely in `liquid_vault` PDA until next 5-minute crank cycle. |
| **`AuroraReverseIntentRefundJob`** (`R-011`) | Triggered by `POST /api/v1/intents/refund` or automatic `5xx` upstream API failure compensation. | `{ sessionId, refundMicroUsdc, destinationChain, destinationAsset, recipientAddress }` | Requests `OneClickService.getQuote()` from Solana USDC $\rightarrow$ user's destination chain/asset and transfers USDC to Aurora deposit address. | 4 retries; backoff `1s, 3s, 9s, 27s`. | Timeout `30s`; idempotent on `session_id` status lock (`CLOSED_REFUNDED`). | If cross-chain route is temporarily unavailable, unlocks direct Solana USDC withdrawal fallback for user. |

---

## 13. Security and Privacy Architecture

- **STRIDE Controls:** All 5 trust-boundary threats (`SEC-01` Double-Spend Nullifier Replay, `SEC-02` Optimistic Credit Fraud, `SEC-03` Prompt-Injection Spend Runaway, `SEC-04` IP/Wallet Log De-anonymization, `SEC-05` NPM/Cargo Supply Chain) are mitigated and mapped to automated tests in `blueprint/reviews/adversarial.md`.
- **Zero-Correlation Privacy Guarantee (`R-004`, `R-015`):**
  1. `intent_deposits` (which records the Aurora quote and `poseidon_commitment_hex`) has **no foreign key or join path** to `zk_runtime_sessions` (which records only `nullifier_hash_hex` and `merkle_root_used_hex`).
  2. Because the Groth16 proof proves membership in the depth-20 Merkle tree in zero knowledge, even a full database dump of PostgreSQL cannot link a `nullifier_hash_hex` back to its `poseidon_commitment_hex` or `aurora_quote_id`.
- **Input Validation & Web Defenses:** Strict Zod schema validation on all API payloads (`^0x[a-fA-F0-9]{64}$` on field elements, positive integer bounds on micro-USDC), Content-Security-Policy (CSP) restricting script execution to self and WebWorker WASM blobs, and SSRF allowlisting on outbound x402 proxy calls.

---

## 14. Reliability and Operations

- **Service Level Objectives (SLOs):**
  - *SLO-1 (x402 Runtime Key Gateway Availability):* **99.9%** uptime (`43.2m` monthly error budget).
  - *SLO-2 (x402 Authorization Latency):* **95%** of requests authorize in `<= 15ms` (`NFR-001`).
  - *SLO-3 (On-Chain Groth16 Verification Success):* **99.5%** of valid proofs settle within 2 Solana slots (`<= 800ms`).
- **Health Checks & Circuit Breakers:** `GET /api/v1/health` checks Neon Postgres connectivity, Upstash Redis latency, Helius Solana RPC slot height, and Aurora `1Click` API reachability. If Kamino CPI utilization exceeds 98%, circuit breaker pauses new 90% sweeps and retains 100% of new deposits in the liquid vault PDA.
- **Runbooks for Top 3 Failure Modes:**
  1. *Runbook A (Off-Chain Postgres Leaf Desync):* Execute `npm run db:rebuild-from-chain` to query all `DepositCommitted` Anchor events from Helius RPC and repopulate `merkle_leaves` in `<30s`.
  2. *Runbook B (Solana Relayer Gas Depletion):* Alert triggers when relayer balance `< 0.02 SOL`; auto-swaps `5 USDC` of protocol integrator fees to `SOL` via Jupiter/Aurora API.
  3. *Runbook C (Aurora Solver Delay > 120s):* Optimistic credit remains valid up to `$5.00` while background worker polls `GET /status` for up to 15 minutes before triggering origin refund notification.

---

## 15. Infrastructure and Deployment

- **Hosting & Justification:** **Vercel** (Next.js 15 frontend + API routes, zero-config preview deployments for hackathon judges), **Neon Serverless Postgres** (us-east-2, colocated with Vercel functions for `<4ms` DB roundtrip), **Upstash Redis** (us-east-1 global edge), and **Helius Solana RPC**.
- **CI/CD Pipeline (GitHub Actions `.github/workflows/ci.yml`):**
  1. `lint-and-typecheck`: `tsc --noEmit`, `eslint`, and `@redocly/cli lint blueprint/openapi.yaml`.
  2. `security-audit`: `npm audit --audit-level=high` (verifying `@solana/web3.js@1.99.0`) and `cargo audit` (verifying `anchor-lang@1.2.2`).
  3. `db-and-unit-tests`: Spins up Postgres 16 service container, loads `blueprint/schema.sql`, and runs Vitest suite.
  4. `anchor-contract-tests`: Compiles `programs/refract_vault` and verifies Groth16 BN254 proof under `140,000 CU`.
- **Vendor Exit Strategy:** Standard PostgreSQL DDL (`schema.sql`), standard OpenAPI 3.1 REST routes, and standard Solana Anchor Rust crates allow migrating off Vercel/Neon to any Docker/VPS host in `<2 hours`.

---

## 16. Repository Structure

```
refract/
├── blueprint/                        # Complete machine-checkable v2 Specification Suite
│   ├── README.md                     # Readiness status, index, and assumptions
│   ├── blueprint.md                  # This 22-section master specification
│   ├── prd.md                        # Standalone Product Requirements Document
│   ├── design-spec.md                # Standalone Design & Technical Specification
│   ├── ui-spec.md                    # Standalone UI/UX Design Specification
│   ├── srd.md                        # Standalone System Requirements Document
│   ├── requirements.csv              # Master requirements register (R-001 to R-018)
│   ├── decisions.md                  # ADR register (ADR-001 to ADR-007) & Gap resolutions
│   ├── design-tokens.json            # W3C design tokens with WCAG 2.2 AA contrast
│   ├── schema.sql                    # PostgreSQL 16 DDL, indexes, and seed data
│   ├── openapi.yaml                  # OpenAPI 3.1.0 specification
│   ├── .env.example                  # Complete environment variable register
│   ├── traceability.csv              # Full end-to-end traceability matrix
│   ├── handoff.json                  # Implementation agent handoff payload
│   ├── models/load_and_cost.py       # Executable capacity & cost model (1x, 10x, 100x)
│   ├── spikes/verify_stack.ts        # Hour-1 Aurora 1Click + Groth16 byte layout spike
│   ├── prototype/index.html          # Working HTML/CSS prototype of core screens
│   └── reviews/                      # adversarial.md & verification.md
├── circuits/                         # Circom 2.2.2 zkAPI note commitment & spend circuit
├── programs/refract_vault/           # Solana Anchor 1.2.2 Rust smart contract
├── src/
│   ├── app/                          # Next.js 15 App Router pages (/studio, /playground, /merchant) & API routes
│   ├── components/                   # Atomic UI components consuming design-tokens.json
│   ├── lib/aurora/                   # @defuse-protocol/one-click-sdk-typescript & Intents Connect
│   ├── lib/zkapi/                    # Browser WebWorker snarkjs prover & Poseidon Merkle tree
│   ├── lib/x402/                     # HTTP 402 v2 middleware, Redis Lua meter, Schnorr receipts
│   └── db/                           # PostgreSQL connection pool & query layer
└── tests/                            # Unit, Integration, Anchor, Security, Perf (k6), E2E (Playwright)
```

---

## 17. Testing Strategy & Quality Gates

| Test Layer | Tool / Runner | Scope & Target Coverage | Verifying Test IDs | CI Release Gate (Blocks Merge on Failure) |
| :--- | :--- | :--- | :--- | :--- |
| **Smart Contract (Solana SVM)** | `anchor test` / `litesvm` | `deposit_and_commit`, `settle_zk_spend` (`<= 140k CU`), nullifier replay rejection, 90/10 DeFi split (`100%` instruction coverage). | `TEST-CHAIN-001`, `TEST-CHAIN-002`, `TEST-CHAIN-003` | Must pass with `computeUnitsConsumed <= 140000`. |
| **Zero-Knowledge Prover & Circuits** | `vitest` + `snarkjs` v0.7.6 | Poseidon hash consistency (`circomlibjs` == `light-poseidon`), valid witness generation, tampered spend-cap proof rejection. | `TEST-ZK-001` | 100% pass; browser proof generation `<= 2,200ms`. |
| **Aurora Intents Integration** | `vitest` | `OneClickService.getQuote()`, `confidentialMode: true` payload, `30 bps` integrator fee, `<400ms` optimistic credit, reverse-intent refund. | `TEST-INT-001` to `TEST-INT-005` | Must pass live token list & quote schema validation. |
| **x402 API Contract & Metering** | `vitest` + `@redocly/cli` | `HTTP 402` challenge header format, `rk_live_*` atomic deduction, Schnorr signature verification. | `TEST-API-001`, `TEST-API-002` | `openapi.yaml` lint 0 errors; 100% contract tests pass. |
| **Security & Unlinkability** | `vitest` | Verifies `0` wallet bytes in AI merchant requests and blocks `$2.50` prompt-injection call when cap is `$0.10`. | `TEST-SEC-001`, `TEST-SEC-002` | Hard blocker on any PII/wallet header leakage. |
| **Performance & Load** | `k6` | 50 RPS sustained load against `/api/v1/ai/chat` runtime-key verifier. | `TEST-PERF-001` | `p95 <= 15ms` gateway verification overhead. |
| **Accessibility & E2E UX** | `playwright` + `axe-core` | Full deposit-to-chat flow, Double-Blind Inspector drawer, WCAG 2.2 AA contrast & keyboard navigation. | `TEST-E2E-001`, `TEST-E2E-002`, `TEST-A11Y-001` | 0 critical/serious `axe-core` violations. |

---

## 18. Configuration Register (`.env.example` Reference)

Every environment variable is present in `blueprint/.env.example`:

| Variable Name | Required | Env | Secret | Format / Example | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `AURORA_ONE_CLICK_BASE_URL` | Yes | Server | No | `https://1click.chaindefuser.com` | Base URL for Aurora / NEAR Intents 1Click API (`R-001`). |
| `AURORA_STUDIO_JWT_TOKEN` | Yes | Server | **Yes** | JWT (`eyJ...`) | Authenticates 1Click API calls and waives 0.25% unauthenticated fee (`R-001`). |
| `NEXT_PUBLIC_AURORA_WIDGET_API_KEY` | Yes | Both | No | `wsk_live_...` | Public Studio key for `@aurora-is-near/intents-swap-widget` (`R-002`). |
| `AURORA_INTEGRATOR_FEE_RECIPIENT` | Yes | Server | No | NEAR account (`refract-treasury.near`) | Receives 40%–60% integrator fee share (`R-014`). |
| `AURORA_INTEGRATOR_FEE_BPS` | Yes | Server | No | Integer (`30` = 0.30%) | Custom basis points attached to `referralFees` (`R-014`). |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Yes | Both | No | `mainnet-beta` or `devnet` | Active Solana cluster (`R-003`, `R-006`). |
| `SOLANA_RPC_URL` | Yes | Server | **Yes** | HTTPS URL with Helius key | Backend relayer RPC connection (`R-003`, `R-006`). |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes | Client | No | HTTPS URL (rate-limited public key) | Client wallet & explorer RPC (`R-003`). |
| `NEXT_PUBLIC_REFRACT_VAULT_PROGRAM_ID` | Yes | Both | No | Base58 Pubkey | Deployed Solana Anchor `RefractVault` program ID (`R-006`). |
| `NEXT_PUBLIC_SOLANA_USDC_MINT` | Yes | Both | No | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | Canonical Solana USDC SPL Mint (`R-003`, `R-018`). |
| `SOLANA_RELAYER_PRIVATE_KEY_BASE58` | Yes | Server | **Yes** | Base58 64-byte keypair | Submits gasless Groth16 nullifier & deposit transactions (`R-003`, `R-006`). |
| `SOLANA_KAMINO_USDC_RESERVE_PUBKEY` | Yes | Server | No | Base58 Pubkey | Target Solana DeFi reserve for 90% yield float CPI (`R-009`). |
| `NEXT_PUBLIC_ZKAPI_WASM_URL` | Yes | Client | No | `/circuits/refract_note_spend.wasm` | Browser WebWorker witness calculator binary (`R-005`). |
| `NEXT_PUBLIC_ZKAPI_ZKEY_URL` | Yes | Client | No | `/circuits/refract_note_spend_final.zkey` | Browser WebWorker Groth16 proving key (`R-005`). |
| `ZKAPI_SCHNORR_SIGNING_PRIVATE_KEY_HEX` | Yes | Server | **Yes** | 32-byte hex (`0x...`) | Signs metered `X-ZKAPI-RECEIPT` headers (`R-008`). |
| `OPTIMISTIC_CREDIT_MAX_MICRO_USDC` | Yes | Server | No | Integer (`5000000` = $5.00) | Max instant optimistic credit per unsettled deposit (`R-010`). |
| `DATABASE_URL` | Yes | Server | **Yes** | `postgresql://...` | Neon PostgreSQL 16 connection string (`R-004`, `R-008`). |
| `UPSTASH_REDIS_REST_URL` | Yes | Server | **Yes** | `https://...upstash.io` | Upstash Redis endpoint for `<15ms` runtime-key metering (`R-008`, `R-016`). |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Server | **Yes** | Bearer token string | Upstash Redis authentication token (`R-008`). |
| `OPENAI_API_KEY` | Yes | Server | **Yes** | `sk-proj-...` | Primary LLM provider for `/api/v1/ai/chat` (`R-012`). |
| `ANTHROPIC_API_KEY` | Yes | Server | **Yes** | `sk-ant-...` | Secondary/fallback LLM provider (`R-012`). |
| `REFRACT_INTERNAL_WEBHOOK_SECRET` | Yes | Server | **Yes** | `whsec_...` | HMAC secret for internal worker webhooks (`R-003`). |

---

## 19. Phased Implementation Roadmap

| Phase & Time Window | Dependencies | Deliverables | Mapped Requirement IDs | Definition of Done (DoD) | Owner Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase 1: Spikes & Solana Anchor Vault (Hours 1–8)** | `.env.example` configured | `spikes/verify_stack.ts` executed; Circom depth-20 circuit compiled; `programs/refract_vault` deployed with `groth16-solana` v0.2.0 + `light-poseidon` v0.4.1 + 90/10 DeFi split. | `R-001`, `R-004`, `R-006`, `R-009` | `anchor test` passes Groth16 verification in `<= 140,000 CU` and rejects replayed nullifier PDA. | Rust / ZK Engineer |
| **Phase 2: Aurora Intents, Optimistic Credit & Refunds (Hours 9–20)** | Phase 1 Vault + `schema.sql` loaded | `/api/v1/intents/quote` (`confidentialMode: true`, `30 bps` fee), `/api/v1/intents/optimistic-credit` (`<400ms`), `SolanaAnchorDepositWorker`, and `/api/v1/intents/refund` (`1Click` exit). | `R-001`, `R-002`, `R-003`, `R-010`, `R-011`, `R-014` | Live quote from Base/Arbitrum USDC $\rightarrow$ Solana USDC returns valid deposit address and issues `<400ms` optimistic credit. | Full-Stack Web3 Engineer |
| **Phase 3: x402 Gateway, Browser Prover & Agent Firewall (Hours 21–30)** | Phase 1 `.wasm`/`.zkey` + Phase 2 DB | Browser WebWorker `snarkjs` prover, `/api/v1/zkapi/runtime-key`, `X402GatewayMiddleware`, Schnorr receipt signer, and `AgentSpendPolicyGuard`. | `R-005`, `R-007`, `R-008`, `R-012`, `R-013`, `R-016` | Unpaid call gets `HTTP 402`; Groth16 proof mints `rk_live_*`; subsequent calls authorize in `<= 15ms` with `0` wallet bytes leaked. | Full-Stack / AI Engineer |
| **Phase 4: Dark Prism UI, E2E Verification & Demo Video (Hours 31–40)** | Phases 1–3 APIs live | `/studio`, `/playground`, and `/merchant` screens built with `design-tokens.json`, Double-Blind Privacy Inspector, Mainnet micro-liquidity test, and 90s demo video. | `R-012`, `R-015`, `R-017`, `R-018` | `axe-core` 0 violations; live Mainnet deposit + private x402 AI chat + auto-refund recorded in 90s video. | Frontend / Product Lead |

---

## 20. Traceability Matrix Reference
The complete machine-checkable mapping of `R-001` through `R-018` to Database Tables, OpenAPI Endpoints, UI Screens, Workers/Services, NFR IDs, Test IDs, and Roadmap Phases is maintained in `blueprint/traceability.csv` (verified with `0` orphans in either direction).

---

## 21. Decision Register Reference
All 7 Architecture Decision Records (`ADR-001` Modular Monolith, `ADR-002` Hybrid Groth16 Runtime Keys, `ADR-003` Optimistic Float Credit, `ADR-004` Pinned `@solana/web3.js@1.99.0` & `anchor-lang@1.2.2`, `ADR-005` Neon PG16 + Upstash Redis, `ADR-006` Mainnet Micro-Liquidity Demo, `ADR-007` Dark Prism WCAG 2.2 AA Tokens) and all 3 Gap Resolutions (`GAP-001` to `GAP-003`) are locked in `blueprint/decisions.md`.

---

## 22. Remaining Open Questions
No unresolved product-level questions remain.

