# Refract — Master Engineering Implementation Plan (`implementation-plan.md`)

**Version**: 2.0.0
**Date**: November 7, 2026
**Status**: APPROVED & LOCKED FOR EXECUTION
**Target Hackathons**:
1. **Hackathon 1 (Solana Weekend Hackathon, Nov 6–8, 2026)**: Top 3 Overall ($1,000 USD Microgrant), AI Track ($100), DeFi Track ($100).
2. **Hackathon 2 (Encode x Solana 4-Week Hackathon, Oct–Nov 2026)**: Aurora Intents ($1,500 1st Place + Winner Support Bundle), Best Use of x402 on Solana (Accelerator), Best Consumer App on Solana (Accelerator).

---

## TABLE OF CONTENTS

1. [Project Overview & Shared Context](#1-project-overview--shared-context)
2. [Milestone Overview Table](#2-milestone-overview-table)
3. [Enhanced Testing Philosophy & Atomic Step Protocol](#3-enhanced-testing-philosophy--atomic-step-protocol)
4. [Milestones 0 – 4 (Insert Approved Milestones Here)](#4-milestones-0--4-insert-approved-milestones-here)
   - [Milestone 0: Foundation & Validation (Placeholder)](#milestone-0-foundation--validation)
   - [Milestone 1: Circom Circuit & Solana Anchor `RefractVault` Program (Placeholder)](#milestone-1-circom-circuit--solana-anchor-refractvault-program)
   - [Milestone 2: Aurora Intents, Optimistic Float Credit & Cross-Chain Refunds (Placeholder)](#milestone-2-aurora-intents-optimistic-float-credit--cross-chain-refunds)
   - [Milestone 3: Client ZK Prover, `x402` Gateway, Schnorr Receipts & Agent Firewall (Placeholder)](#milestone-3-client-zk-prover-x402-gateway-schnorr-receipts--agent-firewall)
   - [Milestone 4: Dark Prism UI, Mainnet Micro-Liquidity Demo & Final Deployment (Placeholder)](#milestone-4-dark-prism-ui-mainnet-micro-liquidity-demo--final-deployment)
5. [Cross-Cutting Section A: Testing Strategy (Continuous TDD/BDD)](#5-cross-cutting-section-a-testing-strategy-continuous-tddbdd)
6. [Cross-Cutting Section B: Error Handling Protocol](#6-cross-cutting-section-b-error-handling-protocol)
7. [Cross-Cutting Section C: Progress Tracking System](#7-cross-cutting-section-c-progress-tracking-system)
8. [Cross-Cutting Section D: Environment-Specific Deployment Checklist](#8-cross-cutting-section-d-environment-specific-deployment-checklist)
9. [Cross-Cutting Section E: Communication Templates](#9-cross-cutting-section-e-communication-templates)
10. [Cross-Cutting Section F: Git Workflow & Commit Standards](#10-cross-cutting-section-f-git-workflow--commit-standards)
11. [Appendices](#11-appendices)
12. [Quick Reference Cards](#12-quick-reference-cards)

---

## 1. PROJECT OVERVIEW & SHARED CONTEXT

### 1.1 Project Summary
- **Name**: Refract (`refract.sol` / `refract402`)
- **Type**: Hybrid Web3 / DeFi / Zero-Knowledge (`zkAPI`) / AI Agent Payment Facilitator (`x402`)
- **Validated Technology Stack**:
  - **Frontend & API Gateway**: Next.js `15.2.4` (App Router) + React `19.0.0` + TypeScript `5.7.3` + Zustand `5.0.2`
  - **Cross-Chain Intents**: `@defuse-protocol/one-click-sdk-typescript@0.1.26` + `@aurora-is-near/intents-swap-widget@7.24.0` + `@aurora-is-near/intents-connect@7.24.0`
  - **Smart Contracts (Solana)**: `anchor-lang@1.2.2` (Rust) + `@anchor-lang/core@1.0.0` (TS) + `@solana/web3.js@1.99.0` + `@solana/spl-token@0.4.9`
  - **Zero-Knowledge Cryptography**: `groth16-solana@0.2.0` + `light-poseidon@0.4.1` (On-chain Rust) + `snarkjs@0.7.6` + `circomlibjs@0.1.7` (Browser WebWorker)
  - **Data, Cache & AI**: Neon PostgreSQL `16.4` (`pg@8.13.1`) + Upstash Redis `7.2` (`@upstash/redis@1.34.3`) + OpenAI (`gpt-4o-mini-2024-07-18`) + Anthropic (`claude-3-5-sonnet-20241022`)
- **Core Loop**: Users and AI agents deposit any asset from 35+ blockchains via Aurora Confidential Intents into a 90/10 yield-bearing Solana DeFi vault, receive `<400ms` optimistic credit, and spend unlinkable `zkAPI` zero-knowledge notes over `HTTP 402` (`x402`) with `<15ms` gateway verification and `0 bytes` of wallet identity leaked.
- **MVP Scope (5 Must-Have Pillars)**:
  1. **35+-Chain Confidential Deposit & `<400ms` Optimistic Credit** (`R-001`, `R-002`, `R-003`, `R-010`, `R-014`).
  2. **Solana Anchor `RefractVault` with On-Chain Groth16 BN254 Verifier (`<=140k CU`) & 90/10 Kamino DeFi Split** (`R-004`, `R-006`, `R-009`).
  3. **Client WebWorker `snarkjs` Prover & Dual-Scheme `x402` Gateway (`<15ms` Runtime Keys + Schnorr Receipts)** (`R-005`, `R-007`, `R-008`, `R-016`).
  4. **Refract Studio AI Playground, Agent Spend Policy Firewall (`$0.10/req` cap), & Double-Blind Privacy Inspector** (`R-012`, `R-013`, `R-015`, `R-017`).
  5. **Automated Reverse-Intent Cross-Chain Refunds via Aurora `1Click API`** (`R-011`).
- **Time Budget**: 40 Hours (Weekend Hackathon 1 Sprint, Nov 6–8, 2026, feeding directly into Encode Hackathon 2 Checkpoints)
- **Team**: 2–3 Full-Stack TypeScript / Rust Engineers
- **Testing Philosophy**: Continuous TDD/BDD (Every atomic step enforces unit, integration, Solana Localnet + Devnet deployment, and security unlinkability gates before commit).

### 1.2 Critical Dependencies
1. **Aurora Intents / NEAR `1Click API`** (`https://1click.chaindefuser.com` + Aurora Widget Studio JWT & API Key)
2. **Solana RPC & Networks** (Local `solana-test-validator` / `litesvm`, Solana **Devnet** for contract verification, and Solana **Mainnet-Beta** via Helius RPC for live `$15–$25` micro-liquidity Aurora Intents settlement)
3. **Neon Serverless PostgreSQL 16.4 & Upstash Redis 7.2** (Public Merkle leaf mirror & `<15ms` atomic Lua spend meter)
4. **OpenAI & Anthropic APIs** (`gpt-4o-mini-2024-07-18` and `claude-3-5-sonnet-20241022` for `x402`-gated AI endpoints)
5. **Development Toolchain**: Rust `1.81+`, Solana CLI `2.0.18`, Anchor CLI `1.0.0` (`anchor-lang` `1.2.2`), Circom `2.2.2`, Node.js `22 LTS`, Vitest `2.1.8`, Playwright `1.49.0`, and `k6`.

### 1.3 Top Risks & Mitigations
1. **Browser `snarkjs` (`0.7.6`) to On-Chain `groth16-solana` (`0.2.0`) Endianness / G1 Negation Mismatch** $\rightarrow$ **Mitigation**: Validate the exact 256-byte big-endian serialization (`EIP-197` G2 ordering `[x_c1, x_c0, y_c1, y_c0]`) and modulo-$q$ `proof_a` y-coordinate negation in Milestone 0 & Milestone 1 (`TEST-CHAIN-002`) before building UI flows.
2. **Cross-Chain Aurora Intents Settlement Latency (20–45s) Stalling Live Demo / HTTP Requests** $\rightarrow$ **Mitigation**: Build the `<400ms` Optimistic Float Credit Engine (`R-010`) backed by the Solana 10% Liquid Reserve PDA so `x402` calls work immediately upon origin-chain transaction broadcast.
3. **Supply-Chain & Dependency Conflicts (`@solana/web3.js` v1 vs v3 / `anchor-lang` advisories)** $\rightarrow$ **Mitigation**: Strictly pin `@solana/web3.js@1.99.0` (clean v1 compatible with `@aurora-is-near/intents-swap-widget@7.24.0`) and `anchor-lang@1.2.2` (patched against `RUSTSEC-2026-0146`) in Step 0.1.

---

## 2. MILESTONE OVERVIEW TABLE

| Milestone | Name | Duration | % of Total | Priority | Testing Checkpoints |
|-----------|------|----------|------------|----------|-------------------|
| **M0** | **Foundation & Validation** | **5.0 hrs** | **12.5%** | **Critical** | Anchor + Next.js workspace, PG16 `schema.sql` load, `verify_stack.ts` spike, first Devnet deploy + passing test |
| **M1** | **Circom Circuit & Solana Anchor `RefractVault` Program** | **9.0 hrs** | **22.5%** | **Critical** | Depth-20 Poseidon Merkle tree, `groth16-solana` verifier (`<=140k CU`), Nullifier PDA, 90/10 DeFi split on Devnet |
| **M2** | **Aurora Intents, Optimistic Float Credit & Cross-Chain Refunds** | **9.0 hrs** | **22.5%** | **High** | `1Click API` quote (`confidentialMode: true`, `30 bps` fee), `<400ms` optimistic credit, background deposit worker, reverse-intent refund |
| **M3** | **Client ZK Prover, `x402` Gateway, Schnorr Receipts & Agent Firewall** | **10.0 hrs** | **25.0%** | **High** | WebWorker `snarkjs` prover (`<=2.2s`), HTTP 402 v2 challenge/verify (`<=15ms`), `$0.10` spend firewall, `0` wallet bytes leaked |
| **M4** | **Dark Prism UI, Mainnet Micro-Liquidity Demo & Final Deployment** | **7.0 hrs** | **17.5%** | **Critical** | `/studio`, `/playground`, `/merchant` UI, WCAG 2.2 AA scan, Mainnet-Beta micro-pool deploy, 90s demo video & docs |
| **TOTAL** | | **40.0 hrs** | **100.0%** | | **All 18 Requirements (`R-001`–`R-018`) & 7 NFRs Verified** |

---

## 3. ENHANCED TESTING PHILOSOPHY & ATOMIC STEP PROTOCOL

### 3.1 The "Build $\rightarrow$ Test $\rightarrow$ Verify $\rightarrow$ Commit" Loop
Every atomic step in Milestones 0 through 4 must strictly obey the following cycle before any subsequent step is started:

1. **Build Small (15–60 Minutes Max)**: Every step targets a single, well-bounded module, instruction, or screen. Never combine smart contract changes, database migrations, and UI work in a single unverified batch.
2. **Test Immediately**: No step is complete without automated unit and integration tests passing in the terminal.
3. **Verify Continuously across Layers**:
   - **Web3 / Solana Anchor Rules**:
     - Local compilation verification (`anchor build` with zero warnings)
     - Unit & SVM tests (`anchor test` with `>= 90%` instruction coverage and Compute Unit assertion `<= 140,000 CU`)
     - Deployment to local validator (`solana-test-validator`)
     - Deployment to public testnet (`anchor deploy --provider.cluster devnet`)
     - Verification on Solana Explorer (`solana program show <PROGRAM_ID> --url devnet`)
     - Compute Unit & Rent optimization check (`ZkYieldVault` fixed at `1,840 bytes` = `0.0138 SOL` rent)
   - **Backend / API Gateway Rules**:
     - Unit tests for cryptographic & financial business logic (`vitest run tests/unit`)
     - Integration tests for PostgreSQL 16 & Upstash Redis Lua scripts (`vitest run tests/integration`)
     - OpenAPI 3.1 contract linting (`npx @redocly/cli lint blueprint/openapi.yaml`)
     - Local server manual curl verification (`X-Correlation-Id`, `PAYMENT-REQUIRED`, `X-ZKAPI-RECEIPT`)
   - **Frontend / Dark Prism UI Rules**:
     - Component and Zustand store unit tests
     - Playwright E2E user journey tests (`npx playwright test`)
     - Automated WCAG 2.2 Level AA contrast (`node scripts/verify_contrast.mjs`) and `@axe-core/playwright` scans at `1440px` and `375px`
4. **Commit Often**: Each completed and verified atomic step equals **one atomic Git commit** and one entry in `progress.md`.

### 3.2 Master Atomic Step & AI Agent Prompt Reference Template
Every step inside Section 4 follows this exact structure:

```markdown
### Step M.N: [Imperative Verb + Specific Deliverable]
**Duration**: [X minutes] (<= 60 min)
**Objective**: [Single, measurable goal]
**Risk**: [Low/Medium/High] - [specific concern]
**Prerequisites**: [Completed steps & required keys/tools]
**Testing Type**: [Unit/Integration/SVM/E2E/A11y/Security]

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section [X.Y]
- **Requirements**: `/blueprint/srd.md` → `[R-XXX, NFR-YYY, SEC-ZZZ]`
- **Dependencies**: [Previous steps or external services]
- **Related Tests**: `[Test file paths]`

#### What to Build
[Files, functions, Solana instructions, and implementation approach]

#### Build Instructions (Atomic Steps)
1. [Micro-task 1]
2. [Micro-task 2]
3. [Micro-task 3]
4. [Micro-task 4]

#### Testing Protocol (MANDATORY)
- **Phase 1: Unit / Contract / Lint Tests**
- **Phase 2: Local Validator / API / Browser Integration**
- **Phase 3: Solana Devnet / Mainnet-Beta Verification (Web3 Steps)**
- **Phase 4: Manual Verification**

#### Deliverables Checklist & Strict Definition of Done
- [ ] All code, tests, docs, config, testnet verification, `progress.md`, and git commit complete.

#### Common Issues & Solutions
- Issue 1..3 + Exact Resolution

#### AI Agent Prompt (Ready to Copy-Paste)
[Self-contained copy-paste prompt block for AI coding agents]

#### Progress Tracking Update
[Markdown block to append to `progress.md`]
```

---


## MILESTONE 0: FOUNDATION & VALIDATION (5.0 Hours / 300 Minutes)

---

### Step 0.1: Initialize Monorepo, Pin Validated Dependencies & Configure Anchor + Solana Toolchain
**Duration**: 45 minutes
**Objective**: Create the unified Next.js `15.2.4` + Solana Anchor `1.2.2` monorepo with strictly pinned, CVE-free dependencies and deploy a baseline program scaffold to Localnet and Solana Devnet.
**Risk**: Medium - Peer dependency clashes between `@aurora-is-near/intents-swap-widget@7.24.0` and `@solana/web3.js` if not pinned to `1.99.0`.
**Prerequisites**: Node.js `>=20.18.0`, Rust `>=1.81.0`, Solana CLI `>=2.0.0`, Anchor CLI `1.0.0` installed locally; Solana Devnet wallet funded with `>= 2.5 SOL`.
**Testing Type**: Unit & Smart Contract Deployment Verification (Localnet + Devnet)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 3.1 (`ADR-001`, `ADR-004`) & Section 3.2 (Validated Technology Stack)
- **Requirements**: `/blueprint/srd.md` → Section 11.2 (`SEC-05` Supply Chain), `R-003`, `R-006`
- **Dependencies**: None (First Step)
- **Related Tests**: `tests/unit/env-and-versions.test.ts`, `tests/anchor/scaffold.test.ts`

#### What to Build
Initialize the `refract/` workspace combining Next.js `15.2.4` (App Router) at the root and a Solana Anchor `1.2.2` Rust workspace inside `programs/refract_vault/`. Configure `package.json`, `Cargo.toml`, `Anchor.toml`, and `.env.example` with exact versions.

**Key Files/Modules:**
1. `package.json` - Root manifest with pinned versions (`next@15.2.4`, `react@19.0.0`, `@solana/web3.js@1.99.0`, `@defuse-protocol/one-click-sdk-typescript@0.1.26`, `@aurora-is-near/intents-swap-widget@7.24.0`, `snarkjs@0.7.6`, `circomlibjs@0.1.7`).
2. `Anchor.toml` & `programs/refract_vault/Cargo.toml` - Rust workspace pinning `anchor-lang = "1.2.2"`, `groth16-solana = "0.2.0"`, and `light-poseidon = "0.4.1"`.
3. `programs/refract_vault/src/lib.rs` - Baseline Anchor program scaffold with `ping_vault` instruction emitting a `VaultPinged` event.
4. `progress.md` - Persistent milestone tracking log.

**Implementation Approach:**
- Follow `ADR-001` (Modular Monolith) and `ADR-004` (Strict dependency pinning).
- Configure `Anchor.toml` with both `[programs.localnet]` and `[programs.devnet]` clusters.

**For Smart Contracts:**
- Program crate: `refract_vault`
- Initial instruction: `pub fn ping_vault(ctx: Context<PingVault>) -> Result<()>`
- Event: `#[event] pub struct VaultPinged { pub slot: u64, pub authority: Pubkey }`

#### Build Instructions (Atomic Steps)
1. Initialize the Git repository, create the directory structure (`programs/refract_vault`, `circuits`, `src/app`, `src/lib`, `src/db`, `tests`, `scripts`, `blueprint`), and copy `.env.example` to `.env`.
2. Create `package.json` with exact pinned dependencies (`--save-exact`) and install via `npm install --legacy-peer-deps` if React 19 peer warnings appear.
3. Configure `Anchor.toml` and `programs/refract_vault/Cargo.toml` with `anchor-lang = "1.2.2"`, `anchor-spl = "1.2.2"`, `groth16-solana = "0.2.0"`, and `light-poseidon = "0.4.1"`.
4. Implement the minimal `ping_vault` instruction in `programs/refract_vault/src/lib.rs`, build locally with `anchor build`, and deploy to both Localnet and Solana Devnet.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Unit & Supply-Chain Audit Tests**
```bash
npm audit --audit-level=high
cargo audit
anchor build
# Expected: 0 high/critical vulnerabilities; Anchor Rust program compiles cleanly and generates target/idl/refract_vault.json
```

**Phase 2: Local Validator Integration**
```bash
anchor test --skip-local-validator=false
# Expected: 1 passing test (scaffold.test.ts invokes ping_vault on localnet and verifies VaultPinged event)
```

**Phase 3: Testnet Deployment (Solana Devnet)**
```bash
solana config set --url devnet
anchor deploy --provider.cluster devnet
# Expected: "Deploy success" with Program Id matching NEXT_PUBLIC_REFRACT_VAULT_PROGRAM_ID

# Verify program account on Solana Devnet
solana program show <PROGRAM_ID> --url devnet
# Expected: Program Id, Owner (BPFLoaderUpgradeab1e11111111111111111111111), and Data Length displayed
```

**Phase 4: Manual Verification**
1. Inspect `package.json` and confirm `@solana/web3.js` is `"1.99.0"` (no `^` or `~` range).
2. Open `https://explorer.solana.com/address/<PROGRAM_ID>?cluster=devnet` and confirm the deployed program binary is live on Devnet.
3. Verify `.env` contains all 22 variables defined in `blueprint/.env.example`.

#### Deliverables Checklist
- [ ] **Code**: `programs/refract_vault/src/lib.rs` created with `ping_vault` scaffold
- [ ] **Tests**: `tests/anchor/scaffold.test.ts` validating localnet & devnet invocation
- [ ] **Documentation**: `progress.md` initialized at repo root
- [ ] **Configuration**: `package.json`, `Anchor.toml`, `Cargo.toml`, and `.env.example` locked
- [ ] **Verification**: `anchor build`, `npm audit`, and `anchor test` pass
- [ ] **Testnet**: Baseline program deployed and verified on Solana Devnet
- [ ] **Git**: Commit created `chore(init): initialize nextjs15 + anchor 1.2.2 monorepo and devnet scaffold`

#### Definition of Done (STRICT)
✅ Code compiles/builds without errors (`anchor build` + `npx tsc --noEmit`)
✅ All unit tests pass (100% of new code tested)
✅ Integration tests pass on local validator
✅ Manual verification completed successfully
✅ **[Web3 ONLY]** Contract deployed to Solana Devnet and verified via `solana program show`
✅ **[Web3 ONLY]** Compute units logged (`< 5,000 CU` for scaffold ping)
✅ No linting/formatting errors
✅ Security checks pass (`@solana/web3.js@1.99.0` and `anchor-lang@1.2.2` verified)
✅ `progress.md` updated with completion status and test results
✅ Git commit created with format: `feat(init): step 0.1 monorepo and devnet scaffold`

#### Common Issues & Solutions
**Issue 1**: `anchor build` fails with SBF platform-tools Rust version mismatch on `light-poseidon`.
**Solution**: Run `solana-install update` or `cargo-build-sbf --version` to ensure Solana platform-tools `v1.43+` (Rust `1.81+`) is active.

**Issue 2**: `npm install` complains about React 19 peer dependency in `@aurora-is-near/intents-swap-widget@7.24.0`.
**Solution**: Add `"overrides": { "react": "19.0.0", "react-dom": "19.0.0" }` in `package.json`.

**Issue 3** (Web3): "Insufficient funds for Solana Devnet deployment (~1.8 SOL required)"
**Solution**: Run `solana airdrop 2 --url devnet` or claim Devnet SOL from `https://faucet.solana.com`.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 0.1 - Initialize Monorepo, Pin Dependencies & Deploy Devnet Scaffold
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract (Any-Chain Yield-Bearing zkAPI for Solana x402)
- Technology: Next.js 15.2.4, React 19.0.0, TypeScript 5.7.3, Anchor 1.2.2, @solana/web3.js 1.99.0, groth16-solana 0.2.0, light-poseidon 0.4.1
- Objective: Initialize the unified Next.js + Anchor monorepo with pinned dependencies and deploy the baseline RefractVault scaffold to Localnet and Solana Devnet.

PREREQUISITES:
- Rust, Solana CLI, Anchor CLI, and Node.js 22 installed.

BUILD INSTRUCTIONS:
1. Create `package.json` with exact pinned versions:
   - `next`: `15.2.4`, `react`: `19.0.0`, `react-dom`: `19.0.0`
   - `@solana/web3.js`: `1.99.0`, `@anchor-lang/core`: `1.0.0`
   - `@defuse-protocol/one-click-sdk-typescript`: `0.1.26`
   - `@aurora-is-near/intents-swap-widget`: `7.24.0`, `@aurora-is-near/intents-connect`: `7.24.0`
   - `snarkjs`: `0.7.6`, `circomlibjs`: `0.1.7`, `zod`: `3.24.1`, `pg`: `8.13.1`, `@upstash/redis`: `1.34.3`
   - DevDependencies: `vitest`: `2.1.8`, `@playwright/test`: `1.49.0`, `typescript`: `5.7.3`, `tsx`: `4.19.2`

2. Create `Anchor.toml` and `programs/refract_vault/Cargo.toml`:
   - Pin `anchor-lang = "1.2.2"`, `anchor-spl = "1.2.2"`, `groth16-solana = "0.2.0"`, `light-poseidon = "0.4.1"`, `ark-bn254 = "0.4.0"`.
   - Implement `programs/refract_vault/src/lib.rs` with `ping_vault` instruction emitting `VaultPinged`.

3. Add tests in `tests/anchor/scaffold.test.ts`:
   - Test case 1: Verify `@solana/web3.js` version is strictly `1.99.0`.
   - Test case 2: Invoke `ping_vault` on localnet and assert transaction succeeds in < 10,000 CU.
   - Test case 3: Verify all 22 keys in `.env.example` are defined in config schema.

4. Deploy to localnet and public testnet (Solana Devnet):
   ```bash
   anchor build
   anchor test
   anchor deploy --provider.cluster devnet
   solana program show <PROGRAM_ID> --url devnet
   ```

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Unit & Audit tests:
   ```bash
   npm audit --audit-level=high
   npx vitest run tests/unit/env-and-versions.test.ts
   ```
   Expected output: 0 vulnerabilities, all version & env tests pass.

2. Integration & Contract tests:
   ```bash
   anchor test
   ```
   Expected output: `1 passing` with `VaultPinged` event verified.

3. Manual verification:
   - Step 1: Check Solana Devnet Explorer for `<PROGRAM_ID>`.
   - Expected: Program executable account exists and matches `Anchor.toml`.

DEFINITION OF DONE:
- [ ] All code written and compiles
- [ ] All tests pass (>80% coverage)
- [ ] Deployed to Solana Devnet and verified
- [ ] Manual testing completed
- [ ] No errors or warnings
- [ ] Code documented
- [ ] Git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Test results (copy-paste of terminal output)
3. Solana Devnet Program ID and deployment transaction signature
4. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 0.2: Configure Testing Frameworks (Vitest + Playwright) & Verify Design Token WCAG 2.2 AA Contrast
**Duration**: 40 minutes
**Objective**: Set up the automated unit/integration test runner (`Vitest`), E2E/Accessibility runner (`Playwright` + `@axe-core/playwright`), and execute the mathematical WCAG 2.2 AA contrast verification script against `blueprint/design-tokens.json` and `blueprint/prototype/index.html`.
**Risk**: Low - Ensuring CSS custom properties in `src/app/globals.css` match `design-tokens.json` 1:1.
**Prerequisites**: Step 0.1 completed.
**Testing Type**: Unit, Accessibility & Visual Token Verification

#### Context & References
- **Design Doc**: `/blueprint/ui-spec.md` → Sections 4, 8, & 11; `/blueprint/design-tokens.json`
- **Requirements**: `/blueprint/srd.md` → `R-017`, `NFR-006`, `TEST-A11Y-001`
- **Dependencies**: Step 0.1
- **Related Tests**: `scripts/verify_contrast.mjs`, `tests/unit/tokens.test.ts`, `tests/e2e/a11y.spec.ts`

#### What to Build
Create the test configuration files (`vitest.config.ts`, `playwright.config.ts`), build the executable W3C WCAG 2.2 relative luminance contrast checker (`scripts/verify_contrast.mjs`), mount `blueprint/design-tokens.json` into `src/app/globals.css`, and render the baseline App Router layout so Playwright + `axe-core` can scan it.

**Key Files/Modules:**
1. `scripts/verify_contrast.mjs` - Computes relative luminance $L$ and contrast ratio $(L_1 + 0.05)/(L_2 + 0.05)$ for every foreground/background and interactive border pair in `blueprint/design-tokens.json`.
2. `src/app/globals.css` & `src/app/layout.tsx` - Loads Dark Prism CSS variables and landmark structure (`<header role="banner">`, `<main role="main">`).
3. `vitest.config.ts` & `playwright.config.ts` - Configures unit and browser accessibility test suites.
4. `tests/e2e/a11y.spec.ts` - Runs `@axe-core/playwright` at `1440px` desktop and `375px` mobile viewports.

#### Build Instructions (Atomic Steps)
1. Create `vitest.config.ts` and `playwright.config.ts` targeting `http://localhost:3000`.
2. Implement `scripts/verify_contrast.mjs` to parse `blueprint/design-tokens.json` and assert all text pairs `>= 4.5:1` and interactive border pairs `>= 3.0:1`.
3. Create `src/app/globals.css` importing all tokens from `blueprint/design-tokens.json` and mount the responsive shell in `src/app/layout.tsx` and `src/app/page.tsx`.
4. Create `tests/unit/tokens.test.ts` and `tests/e2e/a11y.spec.ts` and run both test suites.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Unit & Contrast Computation Tests**
```bash
node scripts/verify_contrast.mjs blueprint/design-tokens.json
npx vitest run tests/unit/tokens.test.ts
# Expected: All 10 token contrast pairs PASS (Primary 18.09:1, Secondary 6.46:1, Muted 4.72:1, Border 3.94:1)
```

**Phase 2: Local Dev Server & Playwright A11y Scan**
```bash
npx playwright test tests/e2e/a11y.spec.ts
# Expected: 0 axe-core WCAG 2.2 AA violations at 1440px and 375px viewports; 0 horizontal overflow
```

**Phase 4: Manual Verification**
1. Run `npm run dev` and open `http://localhost:3000` in browser.
2. Press `Tab` repeatedly across the header navigation and buttons; verify the `2px solid #38BDF8` focus ring (`10.14:1` contrast) is clearly visible on every element.
3. Resize viewport to `375px` width and confirm all buttons maintain `>= 44px` height with zero horizontal scrollbar.

#### Deliverables Checklist
- [ ] **Code**: `scripts/verify_contrast.mjs`, `src/app/globals.css`, `src/app/layout.tsx`
- [ ] **Tests**: `tests/unit/tokens.test.ts` and `tests/e2e/a11y.spec.ts`
- [ ] **Configuration**: `vitest.config.ts` and `playwright.config.ts`
- [ ] **Verification**: Luminance script and Playwright `axe-core` tests pass with 0 errors
- [ ] **Git**: Commit created `feat(ui-foundation): step 0.2 configure vitest playwright and verify wcag 2.2 aa tokens`

#### Definition of Done (STRICT)
✅ Code compiles/builds without errors
✅ All unit tests pass (`tokens.test.ts`)
✅ Automated `axe-core` accessibility scan passes with 0 violations (`TEST-A11Y-001`)
✅ Manual keyboard focus-ring and `375px` viewport check completed
✅ No linting/formatting errors
✅ `progress.md` updated with completion status and test results
✅ Git commit created with format: `feat(ui-foundation): step 0.2 test runners and wcag 2.2 aa verification`

#### Common Issues & Solutions
**Issue 1**: Playwright fails to launch Chromium in headless Linux/WSL environment.
**Solution**: Run `npx playwright install --with-deps chromium`.

**Issue 2**: Border contrast on inputs falls below `3.0:1` if `--border-subtle` (`#262D42`) is used instead of `--border-interactive` (`#64748B`).
**Solution**: Enforce `border: 1px solid var(--border-interactive)` (`#64748B`, `3.94:1` contrast) on all `<input>`, `<select>`, and secondary `<button>` elements.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 0.2 - Configure Testing Frameworks & Verify WCAG 2.2 AA Design Tokens
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Next.js 15.2.4, Vitest, Playwright, @axe-core/playwright, W3C Design Tokens
- Objective: Configure Vitest and Playwright, implement the executable WCAG 2.2 luminance contrast verifier (`scripts/verify_contrast.mjs`), and verify the Dark Prism app shell passes automated accessibility checks.

PREREQUISITES:
- Step 0.1 completed.
- `blueprint/design-tokens.json` and `blueprint/prototype/index.html` present.

BUILD INSTRUCTIONS:
1. Create `scripts/verify_contrast.mjs`:
   - Parse `blueprint/design-tokens.json`.
   - Compute WCAG 2.2 relative luminance and contrast ratios for all text-on-surface, text-on-accent, and interactive border pairs.
   - Exit with code 1 if any text pair < 4.5:1 or interactive border < 3.0:1.

2. Create `src/app/globals.css` and `src/app/layout.tsx`:
   - Map all tokens from `blueprint/design-tokens.json` to CSS variables.
   - Render the header navigation and main landmark shell matching `blueprint/prototype/index.html`.

3. Create `vitest.config.ts`, `playwright.config.ts`, `tests/unit/tokens.test.ts`, and `tests/e2e/a11y.spec.ts`:
   - Test case 1 (`tokens.test.ts`): Execute contrast calculator and assert 10/10 pairs pass.
   - Test case 2 (`a11y.spec.ts`): Render `/` at `1440x900` and `375x812`, run `AxeBuilder`, and assert `violations.length === 0`.
   - Test case 3 (`a11y.spec.ts`): Assert all interactive controls have bounding box height >= 44px.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Unit & Contrast tests:
   ```bash
   node scripts/verify_contrast.mjs blueprint/design-tokens.json
   npx vitest run tests/unit/tokens.test.ts
   ```
   Expected output: All contrast ratios verified >= 4.5:1 (text) and >= 3.0:1 (UI borders).

2. E2E & Accessibility tests:
   ```bash
   npx playwright test tests/e2e/a11y.spec.ts
   ```
   Expected output: 2 passed (Desktop 1440px + Mobile 375px, 0 axe violations).

3. Manual verification:
   - Step 1: Open `http://localhost:3000` and navigate using only `Tab` and `Shift+Tab`.
   - Expected: High-contrast `#38BDF8` focus ring visible on every interactive element.

DEFINITION OF DONE:
- [ ] All code written and compiles
- [ ] All unit and Playwright a11y tests pass
- [ ] Manual keyboard and 375px responsive verification completed
- [ ] No errors or warnings
- [ ] Git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from `verify_contrast.mjs`, Vitest, and Playwright
3. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 0.3: Provision PostgreSQL 16 Schema (`schema.sql`), Migrations & Upstash Redis Lua Spend Meter
**Duration**: 45 minutes
**Objective**: Load `blueprint/schema.sql` into PostgreSQL 16, verify all 6 tables, 8 indexes, constraints, and seed rows, and implement the `<15ms` atomic Upstash Redis Lua runtime-key spend meter with automatic PostgreSQL fallback.
**Risk**: Medium - Ensuring zero foreign-key coupling between `intent_deposits` and `zk_runtime_sessions` (`SEC-04`) and preventing race-condition double-spends under concurrent requests.
**Prerequisites**: Step 0.2 completed; `DATABASE_URL` (Neon or local Postgres 16) and `UPSTASH_REDIS_REST_*` configured in `.env`.
**Testing Type**: Database Integration & Concurrency Testing (`TEST-DB-001`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 3.3 (Data Model & Index Justification) & Section 3.8 (Caching)
- **Requirements**: `/blueprint/srd.md` → Section 4 (`schema.sql`), `R-004`, `R-008`, `R-013`, `R-016`, `NFR-001`, `SEC-04`
- **Dependencies**: Step 0.2, PostgreSQL 16, Upstash Redis
- **Related Tests**: `tests/integration/db-schema-and-meter.test.ts`

#### What to Build
Create the database connection pool (`src/db/index.ts`), migration runner (`scripts/migrate.ts`) executing `blueprint/schema.sql` (`0001_init_refract_schema.up.sql`) and its down migration (`0001_init_refract_schema.down.sql`), and the atomic runtime-key spend meter (`src/lib/x402/runtimeKeyMeter.ts`) that enforces `max_per_request_micro_usdc`, `daily_cap_micro_usdc`, and `remaining_micro_usdc >= price` in `<15ms`.

**Key Files/Modules:**
1. `src/db/migrations/0001_init_refract_schema.up.sql` & `0001_init_refract_schema.down.sql` - Forward and reverse SQL migrations matching `blueprint/schema.sql`.
2. `src/db/index.ts` - Pooled PostgreSQL client (`pg` Pool) with query helpers and schema health check.
3. `src/lib/x402/runtimeKeyMeter.ts` - Upstash Redis Lua script + PostgreSQL atomic `UPDATE ... RETURNING` fallback for `<15ms` runtime-key authorization (`R-008`, `R-013`, `R-016`).
4. `tests/integration/db-schema-and-meter.test.ts` - Integration test verifying all 6 tables, 8 indexes, zero foreign-key link between deposits and sessions, and 10-way concurrent spend race-condition safety.

#### Build Instructions (Atomic Steps)
1. Copy `blueprint/schema.sql` to `src/db/migrations/0001_init_refract_schema.up.sql` and create `0001_init_refract_schema.down.sql`.
2. Implement `src/db/index.ts` and `scripts/migrate.ts` (`npm run db:migrate:up` and `npm run db:migrate:down`).
3. Implement `src/lib/x402/runtimeKeyMeter.ts` with `authorizeAndDeductRuntimeKey(rawToken, requestedMicroUsdc)` enforcing `ERR_SPEND_CAP_EXCEEDED` (`R-013`) and `ERR_INSUFFICIENT_NOTE_BALANCE`.
4. Write and run `tests/integration/db-schema-and-meter.test.ts` including a 10-request parallel `Promise.all()` race test against a session with only enough balance for 3 calls.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Database Migration & Index Verification**
```bash
npm run db:migrate:down
npm run db:migrate:up
# Expected: All 6 tables, 8 indexes, and 3 seed rows created with 0 SQL errors
```

**Phase 2: Integration & Concurrency Tests**
```bash
npx vitest run tests/integration/db-schema-and-meter.test.ts
# Expected: All tests pass:
# - Confirms all 8 named indexes exist in pg_indexes
# - Confirms 0 foreign keys exist between intent_deposits and zk_runtime_sessions (SEC-04)
# - Confirms 10 concurrent $0.04 calls against a $0.12 balance result in exactly 3 successes and 7 rejections with remaining_micro_usdc === 0
# - Confirms p95 deduction latency <= 15ms
```

**Phase 4: Manual Verification**
1. Run `psql "$DATABASE_URL" -c "\di"` and verify all 8 indexes from `blueprint/schema.sql` are listed.
2. Run `psql "$DATABASE_URL" -c "SELECT name, price_per_call_micro_usdc, defi_staked_micro_usdc FROM x402_merchants;"` and verify the 2 seeded merchants appear.

#### Deliverables Checklist
- [ ] **Code**: `src/db/index.ts`, `scripts/migrate.ts`, `src/lib/x402/runtimeKeyMeter.ts`
- [ ] **Migrations**: `0001_init_refract_schema.up.sql` & `0001_init_refract_schema.down.sql`
- [ ] **Tests**: `tests/integration/db-schema-and-meter.test.ts` (`TEST-DB-001`, `TEST-SEC-002`)
- [ ] **Verification**: Forward/down migrations and concurrency tests pass in `<15ms` p95
- [ ] **Git**: Commit created `feat(db): step 0.3 postgresql 16 schema migrations and atomic runtime key meter`

#### Definition of Done (STRICT)
✅ `schema.sql` loads cleanly forward and backward with 0 errors
✅ Every named index (`8/8`) verified in `pg_indexes`
✅ Concurrency race test (`10` parallel requests) passes with zero overdraft
✅ Spend policy cap (`$0.10` max per request) blocks `$2.50` simulated attack (`R-013`)
✅ `progress.md` updated with completion status and test results
✅ Git commit created with format: `feat(db): step 0.3 schema migrations and atomic spend meter`

#### Common Issues & Solutions
**Issue 1**: Neon serverless cold connection adds `~80ms` on the very first query.
**Solution**: Warm the connection pool on server startup and use Upstash Redis as the primary hot cache with write-through to Postgres.

**Issue 2**: `pgcrypto` extension permission error on restricted Postgres instances.
**Solution**: `CREATE EXTENSION IF NOT EXISTS "pgcrypto";` is supported natively on Neon and standard PostgreSQL 16; fallback to Node `crypto.randomUUID()` if needed.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 0.3 - Provision PostgreSQL 16 Schema & Atomic Runtime Key Meter
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: PostgreSQL 16.4 (pg), Upstash Redis 7.2, TypeScript, Vitest
- Objective: Apply and verify `blueprint/schema.sql` (6 tables, 8 indexes, seed data) and implement the atomic <15ms runtime-key spend meter (`src/lib/x402/runtimeKeyMeter.ts`).

PREREQUISITES:
- Step 0.2 completed.
- `blueprint/schema.sql` present.

BUILD INSTRUCTIONS:
1. Create `src/db/migrations/0001_init_refract_schema.up.sql` (from `blueprint/schema.sql`), `0001_init_refract_schema.down.sql`, `src/db/index.ts`, and `scripts/migrate.ts`.
2. Implement `src/lib/x402/runtimeKeyMeter.ts`:
   - Hash incoming `rk_live_*` token with SHA-256.
   - Check `max_per_request_micro_usdc` and `daily_cap_micro_usdc`; throw `ERR_SPEND_CAP_EXCEEDED` (HTTP 403) if exceeded (`R-013`).
   - Atomically decrement `remaining_micro_usdc` via Redis Lua / Postgres single-statement `UPDATE ... WHERE remaining_micro_usdc >= $1 RETURNING *`.
   - Provide `rollbackRuntimeKeyCharge(sessionId, amountMicroUsdc)` for upstream 5xx compensation (`R-011`).

3. Add integration tests in `tests/integration/db-schema-and-meter.test.ts`:
   - Test case 1: Apply down migration then up migration; assert all 6 tables and 8 indexes exist in `pg_indexes`.
   - Test case 2: Query `information_schema.table_constraints` and assert 0 foreign keys exist between `intent_deposits` and `zk_runtime_sessions` (`SEC-04`).
   - Test case 3: Fire 10 simultaneous `$0.04` deductions against a session with `$0.12` balance; assert exactly 3 succeed, 7 fail with `ERR_INSUFFICIENT_NOTE_BALANCE`, and final balance is `0`.
   - Test case 4: Attempt a `$2.50` charge against a `$0.10` per-request cap; assert `ERR_SPEND_CAP_EXCEEDED` is thrown and `0` micro-USDC is deducted.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Migration check:
   ```bash
   npm run db:migrate:down && npm run db:migrate:up
   ```
   Expected output: Migration 0001 applied cleanly.

2. Integration & Concurrency tests:
   ```bash
   npx vitest run tests/integration/db-schema-and-meter.test.ts
   ```
   Expected output: 4 passed (schema, unlinkability constraint, race-condition safety, spend firewall).

3. Manual verification:
   - Step 1: Inspect `x402_merchants` and `defi_vault_snapshots` seed data in Postgres.
   - Expected: 2 merchants and 1 initial vault snapshot present.

DEFINITION OF DONE:
- [ ] All code written and compiles
- [ ] Forward and rollback migrations verified
- [ ] All 8 indexes verified in database
- [ ] Concurrency and spend-cap tests pass
- [ ] Git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output of migration and Vitest integration suite
3. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 0.4: Execute Hour-1 Technical Spike (`verify_stack.ts`) & OpenAPI 3.1 Contract Gate (`/api/v1/health` & `/api/v1/defi/vault-stats`)
**Duration**: 50 minutes
**Objective**: Run the live Hour-1 technical spike (`blueprint/spikes/verify_stack.ts`) proving Aurora `1Click API` connectivity, Poseidon hash parity (`circomlibjs` == `light-poseidon`), and `groth16-solana` big-endian G1-negated byte serialization, and expose the first two OpenAPI-validated endpoints (`GET /api/v1/health` and `GET /api/v1/defi/vault-stats`).
**Risk**: High - Proving cryptographic byte compatibility between browser `snarkjs` (`0.7.6`) and Rust `groth16-solana` (`0.2.0`) before writing the full circuit and contract in Milestone 1.
**Prerequisites**: Step 0.3 completed.
**Testing Type**: Spike Verification, Cryptographic Parity & API Contract Testing

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 1.3 (`SPK-01`, `SPK-02`, `SPK-03`); `/blueprint/spikes/verify_stack.ts`
- **Requirements**: `/blueprint/srd.md` → `R-001`, `R-004`, `R-006`, `R-009`, `TEST-API-001`
- **Dependencies**: Steps 0.1–0.3, Aurora `1Click API` (`https://1click.chaindefuser.com`)
- **Related Tests**: `tests/unit/crypto-parity.test.ts`, `tests/integration/health-and-stats.test.ts`

#### What to Build
Implement the cryptographic serialization utility (`src/lib/zkapi/bn254Serializer.ts`) that converts `snarkjs` BN254 Groth16 proofs into the exact 256-byte big-endian format with negated `proof_a` G1 y-coordinate required by `groth16-solana` `0.2.0`, execute `blueprint/spikes/verify_stack.ts` against the live Aurora `1Click API`, validate `blueprint/openapi.yaml` via Redocly CLI, and implement `GET /api/v1/health` and `GET /api/v1/defi/vault-stats`.

**Key Files/Modules:**
1. `src/lib/zkapi/bn254Serializer.ts` - Implements BN254 field element big-endian 32-byte encoding, G1 y-coordinate negation modulo $q = 21888242871839275222246405745257275088696311157297823662689037894645226208583$, and Poseidon commitment calculation via `circomlibjs`.
2. `src/app/api/v1/health/route.ts` & `src/app/api/v1/defi/vault-stats/route.ts` - Next.js 15 API routes with `X-Correlation-Id` headers and Postgres/Redis telemetry.
3. `tests/unit/crypto-parity.test.ts` & `tests/integration/health-and-stats.test.ts` - Tests verifying BN254 serialization, Poseidon hash determinism, and OpenAPI schema compliance.

#### Build Instructions (Atomic Steps)
1. Implement `src/lib/zkapi/bn254Serializer.ts` with `negateAndSerializeG1(x, y)`, `serializeG2(x, y)`, `feToBigEndian32(val)`, and `computePoseidonCommitment(nullifier, trapdoor, amountMicroUsdc)`.
2. Run `npx tsx blueprint/spikes/verify_stack.ts` to verify live Aurora `OneClickService.getTokens()` (`35+` chains / `80+` tokens) and BN254 byte layout.
3. Implement `src/app/api/v1/health/route.ts` and `src/app/api/v1/defi/vault-stats/route.ts` reading from `defi_vault_snapshots`.
4. Run `@redocly/cli lint blueprint/openapi.yaml` and execute the unit and integration test suites.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Spike, OpenAPI Lint & Cryptographic Unit Tests**
```bash
npx @redocly/cli lint blueprint/openapi.yaml
npx tsx blueprint/spikes/verify_stack.ts
npx vitest run tests/unit/crypto-parity.test.ts
# Expected:
# - openapi.yaml validates with 0 errors
# - verify_stack.ts fetches 60+ live tokens from https://1click.chaindefuser.com in <1000ms
# - crypto-parity.test.ts confirms G1 y-negation (y + y_neg === BN254_PRIME_Q) and 256-byte proof slice alignment
```

**Phase 2: Local API Integration**
```bash
npx vitest run tests/integration/health-and-stats.test.ts
# Or with dev server running:
curl -i http://localhost:3000/api/v1/defi/vault-stats
# Expected: HTTP 200 OK with X-Correlation-Id header and JSON matching openapi.yaml:
# {"totalPoolMicroUsdc":25000000,"kaminoStakedMicroUsdc":22500000,"liquidReserveMicroUsdc":2500000,"currentApyBps":940,"subsidyBonusBps":840}
```

**Phase 4: Manual Verification**
1. Inspect terminal output of `npx tsx blueprint/spikes/verify_stack.ts` and confirm `status: 'READY_FOR_BUILD'`.
2. Call `http://localhost:3000/api/v1/health` in browser and verify `postgres: "ok"`, `solanaNetwork: "devnet"`, and `auroraOneClickReachable: true`.

#### Deliverables Checklist
- [ ] **Code**: `src/lib/zkapi/bn254Serializer.ts`, `src/app/api/v1/health/route.ts`, `src/app/api/v1/defi/vault-stats/route.ts`
- [ ] **Tests**: `tests/unit/crypto-parity.test.ts`, `tests/integration/health-and-stats.test.ts`
- [ ] **Verification**: `openapi.yaml` lints cleanly; `verify_stack.ts` passes live Aurora API check
- [ ] **Git**: Commit created `feat(spike): step 0.4 verify aurora 1click spike bn254 serializer and vault-stats api`

#### Definition of Done (STRICT)
✅ `blueprint/openapi.yaml` passes Redocly linter with 0 errors
✅ `blueprint/spikes/verify_stack.ts` succeeds against live Aurora `1Click API`
✅ `bn254Serializer.ts` passes 100% of unit test vectors (G1 negation + Poseidon hash)
✅ `GET /api/v1/defi/vault-stats` and `GET /api/v1/health` return `200 OK` matching OpenAPI schema
✅ `progress.md` updated with Milestone 0 completion summary
✅ Git commit created with format: `feat(spike): step 0.4 complete m0 foundation and stack verification`

#### Common Issues & Solutions
**Issue 1**: `circomlibjs` `buildPoseidon()` returns a `Uint8Array` in Montgomery form rather than a standard `BigInt` string.
**Solution**: Always call `poseidon.F.toString(hash, 10)` or `poseidon.F.toObject(hash)` before converting to a 32-byte big-endian hex string (`0x` + `.toString(16).padStart(64, '0')`).

**Issue 2**: G1 negation uses the scalar field modulus $r$ instead of the base field prime $q$.
**Solution**: Negate `proof_a[1]` (the G1 y-coordinate) modulo the **BN254 base field prime** $q = \text{21888242871839275222246405745257275088696311157297823662689037894645226208583}$, whereas public inputs are elements of the scalar field $r = \text{21888242871839275222246405745257275088548364400416034343698204186575808495617}$.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 0.4 - Execute Hour-1 Technical Spike & Implement Health / Vault-Stats Endpoints
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Next.js 15.2.4, @defuse-protocol/one-click-sdk-typescript 0.1.26, circomlibjs 0.1.7, OpenAPI 3.1.0
- Objective: Implement BN254 Groth16 big-endian G1-negated serialization (`src/lib/zkapi/bn254Serializer.ts`), run `blueprint/spikes/verify_stack.ts`, validate `blueprint/openapi.yaml`, and ship `GET /api/v1/health` and `GET /api/v1/defi/vault-stats`.

PREREQUISITES:
- Steps 0.1, 0.2, and 0.3 completed.

BUILD INSTRUCTIONS:
1. Create `src/lib/zkapi/bn254Serializer.ts`:
   - Define `BN254_FIELD_MODULUS_Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583n`.
   - Define `BN254_SCALAR_MODULUS_R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n`.
   - Implement `serializeGroth16ProofForSolana(proof)` producing `{ proofA: Uint8Array(64), proofB: Uint8Array(128), proofC: Uint8Array(64) }` in big-endian with `proofA` y-coordinate negated modulo `Q`.
   - Implement `computePoseidonCommitment(nullifier, trapdoor, amountMicroUsdc)` using `circomlibjs` Poseidon.

2. Implement `src/app/api/v1/defi/vault-stats/route.ts` and `src/app/api/v1/health/route.ts`:
   - Query the latest snapshot from `defi_vault_snapshots` (`R-009`).
   - Attach `X-Correlation-Id` header.

3. Add tests in `tests/unit/crypto-parity.test.ts` and `tests/integration/health-and-stats.test.ts`:
   - Test case 1: Verify `y + y_neg === BN254_FIELD_MODULUS_Q` and byte lengths `64, 128, 64`.
   - Test case 2: Verify `computePoseidonCommitment(1n, 2n, 10_000_000n)` produces a deterministic 32-byte hex string inside `BN254_SCALAR_MODULUS_R`.
   - Test case 3: Execute `runHourOneSpike()` from `blueprint/spikes/verify_stack.ts` and assert `status === 'READY_FOR_BUILD'`.
   - Test case 4: Call `GET /api/v1/defi/vault-stats` and assert status `200` and `currentApyBps === 940`.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. OpenAPI lint & Spike:
   ```bash
   npx @redocly/cli lint blueprint/openapi.yaml
   npx tsx blueprint/spikes/verify_stack.ts
   ```
   Expected output: 0 OpenAPI errors; `READY_FOR_BUILD`.

2. Unit & API Integration tests:
   ```bash
   npx vitest run tests/unit/crypto-parity.test.ts tests/integration/health-and-stats.test.ts
   ```
   Expected output: All tests pass.

DEFINITION OF DONE:
- [ ] All code written and compiles
- [ ] OpenAPI spec lints with 0 errors
- [ ] Live Aurora 1Click spike passes
- [ ] BN254 serializer and API endpoints pass all tests
- [ ] `progress.md` updated and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from Redocly, `verify_stack.ts`, and Vitest
3. Confirmation that Milestone 0 is 100% complete
═══════════════════════════════════════════════════════════════
```

#### Progress Tracking Update
After completing Step 0.4, add this entry to `progress.md`:

```markdown
### ✅ Milestone 0: Foundation & Validation (Steps 0.1 – 0.4) - COMPLETED

**Date**: 2026-11-07
**Duration**: 3.0 Hours
**Status**: ✅ COMPLETE

**What Was Built**:
- `programs/refract_vault`: Anchor `1.2.2` workspace initialized and baseline scaffold deployed to Solana Devnet.
- `scripts/verify_contrast.mjs` & `src/app/globals.css`: Dark Prism WCAG 2.2 AA tokens verified (`18.09:1` primary text, `3.94:1` interactive borders).
- `src/db/migrations` & `src/lib/x402/runtimeKeyMeter.ts`: PostgreSQL 16 schema (6 tables, 8 indexes) loaded and `<15ms` atomic spend meter verified under 10-way concurrency.
- `src/lib/zkapi/bn254Serializer.ts` & `/api/v1/defi/vault-stats`: BN254 G1-negated big-endian serializer, live Aurora `1Click` spike, and telemetry endpoints verified.

**Tests Executed**:
- Unit Tests: ✅ Passed (`env-and-versions`, `tokens`, `crypto-parity`)
- Integration Tests: ✅ Passed (`db-schema-and-meter`, `health-and-stats`, `verify_stack.ts`)
- E2E / A11y Tests: ✅ Passed (`a11y.spec.ts` - 0 `axe-core` violations at 1440px & 375px)
- Solana Devnet Deployment: ✅ Verified on Devnet

**Next Step**: Milestone 1 (Step 1.1) - Circom Depth-20 `zkAPI` Spend Circuit & Verifying Key Export
```


---


## MILESTONE 1: CIRCOM CIRCUIT & SOLANA ANCHOR `RefractVault` PROGRAM (9.0 Hours / 540 Minutes)

This milestone builds and deploys the complete on-chain cryptographic core of **Refract**: the depth-20 Poseidon Merkle tree, the Circom 2.2.2 zero-knowledge spend circuit, the `groth16-solana` `0.2.0` BN254 pairing verifier (`<= 140,000 CU`), double-spend `NullifierRecord` PDAs, and the 90/10 Solana DeFi Yield Float CPI router.

---

### Step 1.1: Build Depth-20 Circom `zkAPI` Note-Spend Circuit & Export `groth16-solana` Verifying Key
**Duration**: 55 minutes
**Objective**: Write and compile the `refract_note_spend.circom` depth-20 Poseidon Merkle tree circuit, generate the `.wasm` witness calculator and `.zkey` proving key for `snarkjs` (`0.7.6`), and export the constant Rust `Groth16Verifyingkey` byte arrays for `groth16-solana` (`0.2.0`).
**Risk**: Medium - Ensuring the 4 public inputs (`[merkle_root, nullifier_hash, spend_cap_micro_usdc, session_pubkey_hash]`) and Poseidon parameters match `circomlibjs` and `light-poseidon` (`0.4.1`) identically.
**Prerequisites**: Milestone 0 completed; `circom` `2.2.2` and `snarkjs` `0.7.6` installed.
**Testing Type**: Unit & Cryptographic Circuit Verification (`TEST-ZK-001`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 1.3 (`SPK-01`) & Section 3.2 (`groth16-solana` `0.2.0`, `snarkjs` `0.7.6`)
- **Requirements**: `/blueprint/srd.md` → `R-004`, `R-005`, `R-006`, `NFR-003`
- **Dependencies**: Step 0.4 (`src/lib/zkapi/bn254Serializer.ts`)
- **Related Tests**: `tests/unit/circuit-prover.test.ts`

#### What to Build
Create the Circom 2.2.2 circuit (`circuits/refract_note_spend.circom`) that proves:
1. Knowledge of private inputs `nullifier`, `trapdoor`, `note_amount_micro_usdc`, and 20-level Merkle sibling path `pathElements[20]` + `pathIndices[20]`.
2. `commitment = Poseidon(3)([nullifier, trapdoor, note_amount_micro_usdc])` hashes up to public input `merkle_root`.
3. Public input `nullifier_hash === Poseidon(1)([nullifier])`.
4. Public input `spend_cap_micro_usdc <= note_amount_micro_usdc` (range-checked via 64-bit `LessEqThan(64)` comparator).
5. Public input `session_pubkey_hash` is bound into a quadratic constraint (`session_pubkey_hash * session_pubkey_hash === session_sq`) so malicious relayers cannot malleate or front-run the recipient session key.

Compile the circuit into `public/circuits/refract_note_spend.wasm` and `public/circuits/refract_note_spend_final.zkey`, and generate `programs/refract_vault/src/verifying_key.rs` containing the exact big-endian `Groth16Verifyingkey` constants (`vk_alpha_g1`, `vk_beta_g2`, `vk_gamme_g2`, `vk_delta_g2`, `vk_ic`).

**Key Files/Modules:**
1. `circuits/refract_note_spend.circom` - Depth-20 Poseidon Merkle inclusion + spend-cap range check + session-key binding circuit.
2. `scripts/compile_circuit.mjs` - Compiles `.circom`, performs deterministic Phase-2 `.zkey` setup from Hermez Powers-of-Tau (`pot14_final.ptau`), copies `.wasm` and `.zkey` to `public/circuits/`, and generates `programs/refract_vault/src/verifying_key.rs`.
3. `programs/refract_vault/src/verifying_key.rs` - Constant `Groth16Verifyingkey` struct for `groth16-solana` `0.2.0` (`NR_PUBLIC_INPUTS = 4`).
4. `tests/unit/circuit-prover.test.ts` - Tests witness calculation, valid proof verification, and tampered spend-cap failure.

#### Build Instructions (Atomic Steps)
1. Create `circuits/refract_note_spend.circom` importing `poseidon.circom` and `comparators.circom` from `circomlib`.
2. Create `scripts/compile_circuit.mjs` to compile the circuit, generate `refract_note_spend_final.zkey`, export `verification_key.json`, and convert the verification key points (`vk_alpha_1`, `vk_beta_2`, `vk_gamma_2`, `vk_delta_2`, `IC[0..4]`) into big-endian Rust byte arrays inside `programs/refract_vault/src/verifying_key.rs`.
3. Execute `node scripts/compile_circuit.mjs` and verify artifacts exist in `public/circuits/` and `programs/refract_vault/src/verifying_key.rs`.
4. Write `tests/unit/circuit-prover.test.ts` to prove a valid depth-20 note in `<2,200ms` and confirm that attempting to prove `spend_cap_micro_usdc > note_amount_micro_usdc` fails constraint assertion.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Circuit Compilation & Unit Tests**
```bash
node scripts/compile_circuit.mjs
npx vitest run tests/unit/circuit-prover.test.ts
# Expected:
# - Circuit compiles (~5,400 non-linear constraints, fits easily in pot14)
# - Valid Groth16 proof generates in < 1,800ms (target <= 2,200ms p95, NFR-003)
# - snarkjs.groth16.verify(vKey, publicSignals, proof) returns true
# - Over-spend proof (spend_cap = 20 USDC on a 10 USDC note) throws Assert Failed
```

**Phase 2: Rust Verifying Key Compilation Check**
```bash
anchor build
# Expected: programs/refract_vault compiles cleanly with mod verifying_key included
```

**Phase 4: Manual Verification**
1. Check file sizes of `public/circuits/refract_note_spend.wasm` (`~1.2 MB`) and `public/circuits/refract_note_spend_final.zkey` (`~2.4 MB`).
2. Inspect `programs/refract_vault/src/verifying_key.rs` and confirm `VK_IC` has length `5` (`NR_PUBLIC_INPUTS + 1 = 4 + 1`).

#### Deliverables Checklist
- [ ] **Code**: `circuits/refract_note_spend.circom`, `scripts/compile_circuit.mjs`, `programs/refract_vault/src/verifying_key.rs`
- [ ] **Artifacts**: `public/circuits/refract_note_spend.wasm` and `public/circuits/refract_note_spend_final.zkey`
- [ ] **Tests**: `tests/unit/circuit-prover.test.ts` (`TEST-ZK-001`)
- [ ] **Verification**: `vitest` and `anchor build` pass with 0 errors
- [ ] **Git**: Commit created `feat(circuits): step 1.1 compile depth-20 zkapi circom circuit and export rust vk`

#### Definition of Done (STRICT)
✅ Circom circuit compiles without unconstrained signal warnings
✅ All unit tests pass (`circuit-prover.test.ts` including negative tampered-cap test)
✅ Proof generation time verified `<= 2,200ms` (`NFR-003`)
✅ `programs/refract_vault/src/verifying_key.rs` compiles cleanly in `anchor build`
✅ `progress.md` updated with completion status and test results
✅ Git commit created with format: `feat(circuits): step 1.1 depth-20 poseidon spend circuit and rust vk`

#### Common Issues & Solutions
**Issue 1**: `snarkjs` G2 point coordinates (`vk_beta_2`, `proof_b`) have swapped `c0`/`c1` Fq2 ordering compared to Solana `alt_bn128` EIP-197 precompile.
**Solution**: Per EIP-197 / `groth16-solana` `0.2.0` specification, for each G2 point `[[x_c0, x_c1], [y_c0, y_c1]]`, serialize in the order `[x_c1 (32B BE), x_c0 (32B BE), y_c1 (32B BE), y_c0 (32B BE)]`. Verify this ordering in `circuit-prover.test.ts`.

**Issue 2**: Public input `session_pubkey_hash` optimized away by Circom compiler if not involved in a multiplication constraint.
**Solution**: Add `signal sessionSq; sessionSq <== session_pubkey_hash * session_pubkey_hash;` inside the template so the compiler retains `session_pubkey_hash` in the R1CS constraint matrix.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 1.1 - Build Depth-20 Circom zkAPI Circuit & Export Rust Verifying Key
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Circom 2.2.2, circomlib, snarkjs 0.7.6, groth16-solana 0.2.0
- Objective: Create the depth-20 Poseidon Merkle note-spend circuit (`circuits/refract_note_spend.circom`), compile WASM/zkey artifacts into `public/circuits/`, and export `programs/refract_vault/src/verifying_key.rs`.

PREREQUISITES:
- Milestone 0 completed.

BUILD INSTRUCTIONS:
1. Create `circuits/refract_note_spend.circom`:
   - Public inputs: `merkle_root`, `nullifier_hash`, `spend_cap_micro_usdc`, `session_pubkey_hash`.
   - Private inputs: `nullifier`, `trapdoor`, `note_amount_micro_usdc`, `pathElements[20]`, `pathIndices[20]`.
   - Enforce `nullifier_hash === Poseidon(1)([nullifier])`.
   - Enforce `commitment = Poseidon(3)([nullifier, trapdoor, note_amount_micro_usdc])` hashes up the 20-level Poseidon Merkle tree to `merkle_root`.
   - Enforce `spend_cap_micro_usdc <= note_amount_micro_usdc` using `LessEqThan(64)`.
   - Bind `session_pubkey_hash` via `signal sessionSq <== session_pubkey_hash * session_pubkey_hash;`.

2. Create `scripts/compile_circuit.mjs`:
   - Compile `refract_note_spend.circom` to `public/circuits/`.
   - Generate `refract_note_spend_final.zkey` and `verification_key.json`.
   - Export `programs/refract_vault/src/verifying_key.rs` with `Groth16Verifyingkey` big-endian byte arrays (using EIP-197 G2 `[x_c1, x_c0, y_c1, y_c0]` ordering).

3. Add tests in `tests/unit/circuit-prover.test.ts`:
   - Test case 1: Generate witness and Groth16 proof for a valid 10 USDC note; assert proof generation time <= 2,200ms and `snarkjs.groth16.verify` returns `true`.
   - Test case 2: Attempt to generate witness with `spend_cap_micro_usdc = 15_000_000` on a `10_000_000` note; assert constraint failure.
   - Test case 3: Attempt to verify proof with mutated `session_pubkey_hash`; assert verification returns `false`.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Compile & Unit tests:
   ```bash
   node scripts/compile_circuit.mjs
   npx vitest run tests/unit/circuit-prover.test.ts
   ```
   Expected output: 3 passed, proof generation <= 2,200ms.

2. Anchor Rust check:
   ```bash
   anchor build
   ```
   Expected output: Compiles cleanly with `verifying_key.rs`.

DEFINITION OF DONE:
- [ ] Circuit written and compiled to `.wasm` and `.zkey`
- [ ] Rust `verifying_key.rs` generated and compiles
- [ ] All unit tests pass (including negative spend-cap and tampering checks)
- [ ] Git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from `compile_circuit.mjs`, Vitest, and `anchor build`
3. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 1.2: Implement Zero-Copy `ZkYieldVault` Account & Incremental Depth-20 Poseidon Tree on Solana
**Duration**: 55 minutes
**Objective**: Implement the zero-copy `ZkYieldVault` PDA account (`1,840 bytes`, `GAP-002`) and the `initialize_vault` and `deposit_and_commit` instructions in `programs/refract_vault` using `light-poseidon` (`0.4.1`), then deploy and verify on Localnet and Solana Devnet.
**Risk**: Medium - Zero-copy byte alignment (`#[repr(C)]`) and ensuring on-chain `light-poseidon` incremental Merkle root matches client-side `circomlibjs` root 100%.
**Prerequisites**: Step 1.1 completed.
**Testing Type**: Smart Contract Unit, Localnet & Devnet Integration (`TEST-CHAIN-001`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 1.3 (`SPK-03`), Section 3.1 (`GAP-002`); `/blueprint/decisions.md`
- **Requirements**: `/blueprint/srd.md` → Section 9.2, `R-003`, `R-004`, `R-006`
- **Dependencies**: Step 1.1
- **Related Tests**: `tests/anchor/merkle-vault.test.ts`

#### What to Build
Implement the on-chain zero-copy `ZkYieldVault` state account and the incremental depth-20 Poseidon Merkle tree insertion logic in `programs/refract_vault/src/`:
1. `state.rs`: Defines `#[account(zero_copy)] #[repr(C)] pub struct ZkYieldVault` containing `authority`, `usdc_mint`, `liquid_vault`, `defi_yield_vault`, `next_leaf_index`, `current_root_index`, `subsidy_bonus_bps`, `filled_subtrees: [[u8; 32]; 20]`, `root_history: [[u8; 32]; 32]`, `total_principal_micro_usdc`, and `total_yield_harvested_micro_usdc`.
2. `merkle.rs`: Precomputes the 20 canonical Poseidon zero-hashes `ZERO_VALUES[0..20]` (`Poseidon(0, 0)`, etc.) as a `const [[u8; 32]; 20]` array so inserting a leaf requires **only 20 Poseidon hashes** via `light_poseidon::Poseidon::<ark_bn254::Fr>::new_circom(2)` (`~55,000 CU`).
3. `lib.rs`: Implements `initialize_vault` and `deposit_and_commit(ctx, commitment: [u8; 32], amount_micro_usdc: u64)` which transfers SPL USDC into `liquid_vault`, inserts `commitment` into the tree, pushes the new root into the 32-element `root_history` ring buffer, and emits `DepositCommitted { leaf_index, commitment, new_root, amount_micro_usdc }`.

**For Smart Contracts:**
- Program: `refract_vault`
- Accounts: `ZkYieldVault` (`seeds = [b"refract_vault", usdc_mint.key().as_ref()]`), `liquid_vault` (`seeds = [b"liquid_vault", vault.key().as_ref()]`)
- Instructions: `initialize_vault`, `deposit_and_commit`
- Events: `VaultInitialized`, `DepositCommitted`
- Gas / CU optimization: Precompute `ZERO_VALUES: [[u8; 32]; 20]` at compile time to save `~60,000 CU` on every deposit and initialization.

#### Build Instructions (Atomic Steps)
1. Create `programs/refract_vault/src/state.rs` with `#[account(zero_copy)] #[repr(C)] pub struct ZkYieldVault` (verify exact 8-byte alignment across all fields).
2. Create `programs/refract_vault/src/merkle.rs` containing the 20 precomputed Circom Poseidon zero-subtree hashes and `insert_leaf(&mut ZkYieldVault, commitment: [u8; 32]) -> Result<[u8; 32]>`.
3. Update `programs/refract_vault/src/lib.rs` to wire `initialize_vault` and `deposit_and_commit` with SPL Token transfer into `liquid_vault`.
4. Write `tests/anchor/merkle-vault.test.ts` to initialize the vault, deposit `10.00 USDC`, and assert that the on-chain `new_root` emitted by `DepositCommitted` matches the off-chain `circomlibjs` Poseidon root byte-for-byte, then deploy and run against Solana Devnet.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Contract Compilation & Localnet Unit Tests**
```bash
anchor build
anchor test --skip-local-validator=false
# Expected:
# - ZkYieldVault account initialized (~1,840 bytes, rent ~0.0138 SOL)
# - deposit_and_commit inserts Leaf #0 and Leaf #1 in < 75,000 CU
# - On-chain root_history[current_root_index] === off-chain circomlibjs Merkle root (100% bit-exact match)
```

**Phase 2: Solana Devnet Deployment & Integration**
```bash
anchor deploy --provider.cluster devnet
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx vitest run tests/anchor/merkle-vault.test.ts
# Expected: Vault initialized and test USDC deposit committed on Solana Devnet; transaction hash returned
```

**Phase 4: Manual Verification**
1. Inspect the Solana Devnet transaction on `https://explorer.solana.com/tx/<TX_SIG>?cluster=devnet`.
2. Confirm `Program log: Instruction: DepositAndCommit` consumed `< 85,000 compute units` and emitted the `DepositCommitted` Anchor event.

#### Deliverables Checklist
- [ ] **Code**: `programs/refract_vault/src/state.rs`, `programs/refract_vault/src/merkle.rs`, `programs/refract_vault/src/lib.rs`
- [ ] **Tests**: `tests/anchor/merkle-vault.test.ts` (`TEST-CHAIN-001`)
- [ ] **Verification**: On-chain `light-poseidon` root matches off-chain `circomlibjs` root 100%
- [ ] **Testnet**: Upgraded program deployed and tested on Solana Devnet
- [ ] **Git**: Commit created `feat(anchor): step 1.2 zero-copy zkyieldvault and depth-20 poseidon merkle tree`

#### Definition of Done (STRICT)
✅ Code compiles without warnings (`anchor build`)
✅ All unit and localnet tests pass (`merkle-vault.test.ts`)
✅ On-chain Poseidon Merkle root matches off-chain `circomlibjs` root byte-for-byte
✅ **[Web3 ONLY]** Deployed to Solana Devnet and verified via Devnet integration test
✅ **[Web3 ONLY]** Compute units documented (`<= 85,000 CU` for `deposit_and_commit`)
✅ `progress.md` updated with completion status and Devnet transaction hash
✅ Git commit created with format: `feat(anchor): step 1.2 zero-copy vault and depth-20 poseidon tree`

#### Common Issues & Solutions
**Issue 1**: Anchor `#[account(zero_copy)]` fails compilation due to implicit struct padding between `u16`/`u32` and `u64` fields.
**Solution**: Order all `[u8; 32]` and `Pubkey` fields first, followed by `u64` fields, then `u32` fields, and add explicit `_padding: [u8; 6]` so `std::mem::size_of::<ZkYieldVault>() % 8 == 0`.

**Issue 2**: `light-poseidon` `Poseidon::new_circom(2)` expects big-endian byte slices via `hash_bytes_be(&[&left, &right])`.
**Solution**: Use `Poseidon::<ark_bn254::Fr>::new_circom(2)?.hash_bytes_be(&[&left, &right])?` so endianness matches `bn254Serializer.ts`.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 1.2 - Implement Zero-Copy ZkYieldVault & Depth-20 Poseidon Merkle Tree
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Anchor 1.2.2, light-poseidon 0.4.1, ark-bn254 0.4.0, @solana/web3.js 1.99.0
- Objective: Implement the zero-copy `ZkYieldVault` PDA and `initialize_vault` + `deposit_and_commit` instructions in `programs/refract_vault`, verifying 100% Poseidon root parity with `circomlibjs` on Localnet and Solana Devnet.

PREREQUISITES:
- Step 1.1 completed.

BUILD INSTRUCTIONS:
1. Create `programs/refract_vault/src/state.rs`:
   - Define `#[account(zero_copy)] #[repr(C)] pub struct ZkYieldVault` with explicit 8-byte alignment:
     - `authority: Pubkey`, `usdc_mint: Pubkey`, `liquid_vault: Pubkey`, `defi_yield_vault: Pubkey`
     - `filled_subtrees: [[u8; 32]; 20]`, `root_history: [[u8; 32]; 32]`
     - `total_principal_micro_usdc: u64`, `total_yield_harvested_micro_usdc: u64`
     - `next_leaf_index: u32`, `current_root_index: u32`, `subsidy_bonus_bps: u16`, `bump: u8`, `_padding: [u8; 5]`

2. Create `programs/refract_vault/src/merkle.rs`:
   - Define `pub const ZERO_VALUES: [[u8; 32]; 20]` precomputed using Circom Poseidon(2).
   - Implement `pub fn insert_leaf(vault: &mut ZkYieldVault, commitment: [u8; 32]) -> Result<[u8; 32]>` using `light_poseidon::Poseidon::<ark_bn254::Fr>::new_circom(2)` and `hash_bytes_be`.

3. Update `programs/refract_vault/src/lib.rs`:
   - Implement `initialize_vault(ctx, subsidy_bonus_bps: u16)` and `deposit_and_commit(ctx, commitment: [u8; 32], amount_micro_usdc: u64)`.
   - Emit `DepositCommitted { leaf_index, commitment, new_root, amount_micro_usdc }`.

4. Add tests in `tests/anchor/merkle-vault.test.ts`:
   - Test case 1: Initialize vault and assert initial root equals `ZERO_VALUES` top root.
   - Test case 2: Deposit 10 USDC with a Poseidon commitment; assert SPL USDC balance in `liquid_vault` increases by `10_000_000` and on-chain `new_root` equals off-chain `circomlibjs` root.
   - Test case 3: Insert a second leaf and verify `root_history` preserves both Root #1 and Root #2 (`BR-05`).

5. Deploy and verify on Solana Devnet:
   ```bash
   anchor build
   anchor test
   anchor deploy --provider.cluster devnet
   ```

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Localnet contract tests:
   ```bash
   anchor test
   ```
   Expected output: 3 passing in `merkle-vault.test.ts`, CU <= 85,000.

2. Devnet deployment & integration test:
   ```bash
   anchor deploy --provider.cluster devnet
   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx vitest run tests/anchor/merkle-vault.test.ts
   ```
   Expected output: All tests pass on Devnet.

DEFINITION OF DONE:
- [ ] Zero-copy `ZkYieldVault` and incremental Poseidon tree implemented
- [ ] 100% root parity verified between `light-poseidon` and `circomlibjs`
- [ ] Deployed and verified on Solana Devnet
- [ ] Git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from `anchor test` and Devnet execution
3. Devnet transaction signatures for `initialize_vault` and `deposit_and_commit`
4. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 1.3: Implement On-Chain `settle_zk_spend` (`groth16-solana` `<= 140k CU`) & Double-Spend `NullifierRecord` PDA
**Duration**: 60 minutes
**Objective**: Implement the `settle_zk_spend` instruction in `programs/refract_vault` that verifies a 256-byte BN254 Groth16 proof on-chain via `groth16-solana` (`0.2.0`) in `<= 140,000 CU`, checks membership of `merkle_root` in the 32-root ring buffer, and initializes `NullifierRecord` PDA (`seeds = [b"nullifier", nullifier_hash]`) to prevent double-spending.
**Risk**: High - This is our #1 technical risk (`RA-01` / `SPK-01`): proving end-to-end that a proof generated by `snarkjs` (`0.7.6`) in TypeScript verifies inside the Solana SVM via `groth16-solana` (`0.2.0`) in under `140,000 CU`.
**Prerequisites**: Step 1.2 completed.
**Testing Type**: End-to-End ZK Proof Verification on Localnet & Solana Devnet (`TEST-CHAIN-002`, `NFR-004`, `SEC-01`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 1.3 (`SPK-01`), Section 3.2 (`groth16-solana` `0.2.0`)
- **Requirements**: `/blueprint/srd.md` → `R-006`, `NFR-004`, `SEC-01` (`TEST-CHAIN-002`)
- **Dependencies**: Step 1.1 (`verifying_key.rs`), Step 1.2 (`ZkYieldVault`)
- **Related Tests**: `tests/anchor/zk-spend-verifier.test.ts`

#### What to Build
Extend `programs/refract_vault` with:
1. `NullifierRecord` PDA struct (`state.rs`): `pub struct NullifierRecord { pub nullifier_hash: [u8; 32], pub spend_cap_micro_usdc: u64, pub session_pubkey_hash: [u8; 32], pub spent_at_slot: u64, pub bump: u8 }`.
2. `settle_zk_spend` instruction (`lib.rs`):
   - Takes `proof_a: [u8; 64]`, `proof_b: [u8; 128]`, `proof_c: [u8; 64]`, and `public_inputs: [[u8; 32]; 4]` (`[merkle_root, nullifier_hash, spend_cap_micro_usdc, session_pubkey_hash]`).
   - Checks that `public_inputs[0]` (`merkle_root`) matches one of the 32 roots in `vault.load()?.root_history` (returns `RefractError::UnknownMerkleRoot` if not found).
   - Invokes `Groth16Verifier::new(&proof_a, &proof_b, &proof_c, &public_inputs, &VERIFYING_KEY)?.verify()?` (`returns RefractError::InvalidGroth16Proof` on failure).
   - Initializes `NullifierRecord` PDA with `init` constraint seeded by `[b"nullifier", public_inputs[1].as_ref()]` so any replay of the same `nullifier_hash` fails immediately (`SEC-01`).
   - Emits `NullifierSpent { nullifier_hash, spend_cap_micro_usdc, session_pubkey_hash, slot }`.

**For Smart Contracts:**
- Account: `NullifierRecord` (`8 + 32 + 8 + 32 + 8 + 1 = 89 bytes`, rent `~0.00151 SOL`)
- Instruction: `settle_zk_spend`
- Error Codes: `UnknownMerkleRoot`, `InvalidGroth16Proof`, `SpendCapZero`
- Compute Unit Budget: Must execute in `<= 140,000 CU` (`NFR-004`).

#### Build Instructions (Atomic Steps)
1. Add `NullifierRecord` and `RefractError` enum to `programs/refract_vault/src/state.rs`.
2. Implement `settle_zk_spend` in `programs/refract_vault/src/lib.rs` calling `groth16_solana::groth16::Groth16Verifier::new(&proof_a, &proof_b, &proof_c, &public_inputs, &verifying_key::VERIFYING_KEY)`.
3. Write `tests/anchor/zk-spend-verifier.test.ts` to:
   - Deposit `10.00 USDC` via `deposit_and_commit`.
   - Generate a real Groth16 proof in TypeScript using `snarkjs.groth16.fullProve()` and serialize it via `serializeGroth16ProofForSolana()`.
   - Submit `settle_zk_spend` to Solana and assert `computeUnitsConsumed <= 140000`.
   - Attempt to replay the exact same proof a second time and assert it fails with PDA already initialized (`SEC-01`).
   - Attempt to submit a proof with a forged `public_inputs[2]` (`spend_cap_micro_usdc`) and assert it fails with `InvalidGroth16Proof`.
4. Deploy the updated program to Solana Devnet and run `zk-spend-verifier.test.ts` against Devnet.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Localnet SVM Proof Verification & CU Benchmark**
```bash
anchor build
anchor test
# Expected:
# - Valid snarkjs Groth16 proof verified on-chain by groth16-solana!
# - Compute units consumed: ~104,000 CU (strictly <= 140,000 CU target, NFR-004)
# - Nullifier replay rejected (SEC-01)
# - Tampered public input rejected with InvalidGroth16Proof
```

**Phase 2: Solana Devnet Deployment & Live On-Chain ZK Verification**
```bash
anchor deploy --provider.cluster devnet
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx vitest run tests/anchor/zk-spend-verifier.test.ts
# Expected: Real Groth16 BN254 proof verified on Solana Devnet; NullifierRecord PDA created on-chain
```

**Phase 4: Manual Verification**
1. Open the Devnet `settle_zk_spend` transaction on `https://explorer.solana.com/tx/<TX_SIG>?cluster=devnet`.
2. Confirm `Compute Units Consumed` is `<= 140,000 CU` and the `NullifierRecord` PDA account exists on Devnet.

#### Deliverables Checklist
- [ ] **Code**: `NullifierRecord` PDA and `settle_zk_spend` instruction in `programs/refract_vault`
- [ ] **Tests**: `tests/anchor/zk-spend-verifier.test.ts` (`TEST-CHAIN-002`, `NFR-004`, `SEC-01`)
- [ ] **Verification**: Real `snarkjs` proof verified on-chain in `<= 140,000 CU`; replay and tampering attacks blocked
- [ ] **Testnet**: Deployed and verified on Solana Devnet
- [ ] **Git**: Commit created `feat(anchor-zk): step 1.3 on-chain groth16-solana verifier and nullifier pda`

#### Definition of Done (STRICT)
✅ `anchor build` compiles without errors
✅ Valid `snarkjs` proof verifies on-chain in `<= 140,000 CU` (`NFR-004`)
✅ Double-spend replay of `nullifier_hash` fails deterministically (`SEC-01`)
✅ Forged public inputs fail `Groth16Verifier::verify()`
✅ **[Web3 ONLY]** Deployed to Solana Devnet and verified with a live Devnet `settle_zk_spend` transaction
✅ `progress.md` updated with exact Compute Units consumed and Devnet tx hash
✅ Git commit created with format: `feat(anchor-zk): step 1.3 groth16-solana verifier and nullifier pda`

#### Common Issues & Solutions
**Issue 1**: `Groth16Verifier::verify()` returns `ProofVerificationFailed` even though `snarkjs.groth16.verify()` returned `true`.
**Solution**: Double-check two things in `bn254Serializer.ts`: (1) `proof_a` y-coordinate is negated modulo `BN254_FIELD_MODULUS_Q` (`Q - BigInt(proof.pi_a[1])`), and (2) `proof_b` G2 coordinates are serialized in EIP-197 order `[pi_b[0][1], pi_b[0][0], pi_b[1][1], pi_b[1][0]]` matching `verifying_key.rs`.

**Issue 2**: Anchor PDA seed limit (`max 32 bytes per seed`) when passing `public_inputs[1]`.
**Solution**: `public_inputs[1]` (`nullifier_hash`) is `[u8; 32]`, which fits Solana's exact 32-byte max seed length (`seeds = [b"nullifier", &public_inputs[1]]`).

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 1.3 - Implement On-Chain settle_zk_spend (groth16-solana <= 140k CU) & Nullifier PDA
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Anchor 1.2.2, groth16-solana 0.2.0, snarkjs 0.7.6, @solana/web3.js 1.99.0
- Objective: Implement `settle_zk_spend` in `programs/refract_vault` to verify 256-byte BN254 Groth16 proofs in <= 140,000 CU and initialize `NullifierRecord` PDAs (`TEST-CHAIN-002`, `NFR-004`, `SEC-01`).

PREREQUISITES:
- Steps 1.1 and 1.2 completed.

BUILD INSTRUCTIONS:
1. Update `programs/refract_vault/src/state.rs`:
   - Add `#[account] pub struct NullifierRecord { pub nullifier_hash: [u8; 32], pub spend_cap_micro_usdc: u64, pub session_pubkey_hash: [u8; 32], pub spent_at_slot: u64, pub bump: u8 }`.

2. Update `programs/refract_vault/src/lib.rs`:
   - Implement `pub fn settle_zk_spend(ctx: Context<SettleZkSpend>, proof_a: [u8; 64], proof_b: [u8; 128], proof_c: [u8; 64], public_inputs: [[u8; 32]; 4]) -> Result<()>`.
   - Verify `vault.root_history.iter().any(|r| r == &public_inputs[0])`.
   - Verify proof using `Groth16Verifier::new(&proof_a, &proof_b, &proof_c, &public_inputs, &verifying_key::VERIFYING_KEY)`.
   - Initialize `ctx.accounts.nullifier_record` with `seeds = [b"nullifier", public_inputs[1].as_ref()]`.
   - Emit `NullifierSpent`.

3. Create `tests/anchor/zk-spend-verifier.test.ts`:
   - Test case 1: Commit a note via `deposit_and_commit`, generate a real `snarkjs` Groth16 proof, call `settle_zk_spend`, and assert transaction succeeds with `computeUnitsConsumed <= 140000`.
   - Test case 2: Replay the same `settle_zk_spend` call and assert it fails because `NullifierRecord` PDA is already initialized (`SEC-01`).
   - Test case 3: Mutate `public_inputs[2]` (`spend_cap`) by +1 micro-USDC and assert `settle_zk_spend` fails with `InvalidGroth16Proof`.

4. Deploy and run against Solana Devnet:
   ```bash
   anchor build
   anchor test
   anchor deploy --provider.cluster devnet
   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx vitest run tests/anchor/zk-spend-verifier.test.ts
   ```

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Localnet & Devnet tests:
   ```bash
   anchor test
   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx vitest run tests/anchor/zk-spend-verifier.test.ts
   ```
   Expected output: All 3 test cases pass on Localnet and Devnet; CU <= 140,000.

DEFINITION OF DONE:
- [ ] `settle_zk_spend` and `NullifierRecord` PDA implemented
- [ ] Real `snarkjs` proof verified on Solana in <= 140,000 CU
- [ ] Replay and tampered proof attacks rejected
- [ ] Verified on Solana Devnet and committed to git

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output showing exact Compute Units consumed
3. Devnet transaction signature for `settle_zk_spend`
4. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 1.4: Implement 90/10 Solana DeFi Float Router (`rebalance_defi_float`), Kamino CPI Adapter & Chain-Rebuild DR Script
**Duration**: 55 minutes
**Objective**: Implement the `rebalance_defi_float` instruction and `MerchantAccount` PDA in `programs/refract_vault` enforcing the 90% DeFi yield / 10% liquid optimistic reserve split (`R-009`), plus the off-chain Disaster Recovery script (`npm run db:rebuild-from-chain`, `NFR-007`) that reconstructs `merkle_leaves` from Solana event logs.
**Risk**: Low - Ensuring the 90/10 rebalance math uses checked integer arithmetic (`u128` intermediate math) with zero rounding dust loss.
**Prerequisites**: Step 1.3 completed.
**Testing Type**: Smart Contract DeFi Integration & Disaster Recovery Drill (`TEST-CHAIN-003`, `TEST-DR-001`, `NFR-007`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 3.5 (`src/lib/defi/floatRouter.ts`) & Section 3.9 (Backup, RPO & RTO)
- **Requirements**: `/blueprint/srd.md` → `R-009`, `NFR-007`, `TEST-CHAIN-003`, `TEST-DR-001`
- **Dependencies**: Step 1.3
- **Related Tests**: `tests/anchor/defi-float-and-dr.test.ts`

#### What to Build
1. Add `rebalance_defi_float` and `harvest_yield_and_update_subsidy` instructions to `programs/refract_vault/src/lib.rs`:
   - Reads total vault TVL (`liquid_vault.amount + defi_yield_vault.amount`).
   - Calculates target staked amount `target_staked = (total_tvl as u128 * 9000 / 10000) as u64` (`90.0%`) and target liquid reserve `total_tvl - target_staked` (`10.0%`).
   - Transfers the delta between `liquid_vault` PDA and `defi_yield_vault` (Kamino kUSDC reserve / yield pool PDA) via SPL Token CPI signed by `ZkYieldVault` PDA seeds.
   - Emits `DefiFloatRebalanced { total_pool_micro_usdc, staked_micro_usdc, liquid_micro_usdc, subsidy_bonus_bps }`.
2. Create `scripts/rebuild_from_chain.ts` (`npm run db:rebuild-from-chain`, `NFR-007`):
   - Queries all historical `DepositCommitted` events for `NEXT_PUBLIC_REFRACT_VAULT_PROGRAM_ID` from Solana RPC, sorts by `leaf_index ASC`, and rebuilds the PostgreSQL `merkle_leaves` table from scratch in `<30s`.

**For Smart Contracts:**
- Instructions: `rebalance_defi_float`, `settle_merchant_revenue`
- Accounts: `defi_yield_vault` SPL Token account / Kamino reserve, `MerchantAccount` PDA (`seeds = [b"merchant", merchant_authority.key().as_ref()]`)
- Event: `DefiFloatRebalanced`

#### Build Instructions (Atomic Steps)
1. Add `MerchantAccount` PDA and `rebalance_defi_float` instruction to `programs/refract_vault/src/lib.rs`.
2. Create `src/lib/defi/floatRouter.ts` to invoke `rebalance_defi_float` and persist the emitted telemetry into `defi_vault_snapshots` in PostgreSQL.
3. Create `scripts/rebuild_from_chain.ts` and wire `"db:rebuild-from-chain": "tsx scripts/rebuild_from_chain.ts"` in `package.json`.
4. Write `tests/anchor/defi-float-and-dr.test.ts` testing: (a) depositing `100.00 USDC` and verifying `rebalance_defi_float` routes `90.00 USDC` to the yield vault and keeps `10.00 USDC` in the liquid reserve (`TEST-CHAIN-003`), and (b) truncating `merkle_leaves` in PostgreSQL, running `rebuild_from_chain.ts`, and verifying 100% of leaves and roots are restored (`TEST-DR-001`), then deploy and verify on Solana Devnet.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Localnet DeFi Split & DR Drill Tests**
```bash
anchor build
anchor test
# Expected:
# - 100 USDC deposit rebalanced to exactly 90_000_000 staked / 10_000_000 liquid (TEST-CHAIN-003)
# - TRUNCATE TABLE merkle_leaves -> rebuild_from_chain.ts restores all leaves in < 5s with 0 root mismatches (TEST-DR-001)
```

**Phase 2: Solana Devnet Deployment & Verification**
```bash
anchor deploy --provider.cluster devnet
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx vitest run tests/anchor/defi-float-and-dr.test.ts
# Expected: 90/10 DeFi split and chain-to-Postgres DR rebuild verified against live Solana Devnet transactions
```

**Phase 4: Manual Verification**
1. Call `GET http://localhost:3000/api/v1/defi/vault-stats` after the test run and confirm `kaminoStakedMicroUsdc` is `90%` of `totalPoolMicroUsdc`.
2. Run `npm run db:rebuild-from-chain` in terminal and verify output logs `"Rebuilt N/N Merkle leaves from Solana chain in X ms (RPO=0)"`.

#### Deliverables Checklist
- [ ] **Code**: `rebalance_defi_float` in `programs/refract_vault`, `src/lib/defi/floatRouter.ts`, `scripts/rebuild_from_chain.ts`
- [ ] **Tests**: `tests/anchor/defi-float-and-dr.test.ts` (`TEST-CHAIN-003`, `TEST-DR-001`)
- [ ] **Verification**: 90/10 split and `RPO=0` DR drill pass on Localnet and Devnet
- [ ] **Testnet**: Complete `RefractVault` program deployed and verified on Solana Devnet
- [ ] **Git**: Commit created `feat(defi-vault): step 1.4 90-10 defi float router and chain-to-db dr rebuild`

#### Definition of Done (STRICT)
✅ `rebalance_defi_float` enforces exact 90/10 split (`R-009`, `TEST-CHAIN-003`)
✅ `npm run db:rebuild-from-chain` reconstructs `merkle_leaves` from Solana logs in `<= 30s` (`NFR-007`, `TEST-DR-001`)
✅ **[Web3 ONLY]** Complete Milestone 1 `RefractVault` program deployed and verified on Solana Devnet
✅ All unit, integration, and Anchor tests pass
✅ `progress.md` updated with Milestone 1 completion summary
✅ Git commit created with format: `feat(defi-vault): step 1.4 complete m1 anchor vault and dr script`

#### Common Issues & Solutions
**Issue 1**: Solana RPC `getSignaturesForAddress` returns signatures in newest-first order (`DESC`), whereas Merkle leaves must be inserted `0..N` (`ASC`).
**Solution**: In `scripts/rebuild_from_chain.ts`, parse the `leaf_index` field directly from each decoded `DepositCommitted` event and `ORDER BY leaf_index ASC` before inserting into `merkle_leaves`.

**Issue 2**: PDA signer seeds mismatch during SPL `token::transfer` from `liquid_vault` to `defi_yield_vault`.
**Solution**: Sign the CPI with `&[&[b"refract_vault", usdc_mint.key().as_ref(), &[vault_bump]]]`, where `ZkYieldVault` is the `authority` of `liquid_vault`.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 1.4 - Implement 90/10 DeFi Float Router & Chain-to-DB Disaster Recovery Script
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Anchor 1.2.2, anchor-spl 1.2.2, @solana/web3.js 1.99.0, PostgreSQL 16
- Objective: Implement `rebalance_defi_float` and `MerchantAccount` PDA in `programs/refract_vault` (`R-009`), `src/lib/defi/floatRouter.ts`, and `scripts/rebuild_from_chain.ts` (`NFR-007`).

PREREQUISITES:
- Steps 1.1, 1.2, and 1.3 completed.

BUILD INSTRUCTIONS:
1. Update `programs/refract_vault/src/lib.rs`:
   - Implement `pub fn rebalance_defi_float(ctx: Context<RebalanceDefiFloat>) -> Result<()>`:
     - Compute `total_pool = liquid_vault.amount + defi_yield_vault.amount`.
     - Compute `target_staked = ((total_pool as u128 * 9000) / 10000) as u64`.
     - Transfer delta via SPL Token CPI so `defi_yield_vault` holds 90% and `liquid_vault` holds 10%.
     - Emit `DefiFloatRebalanced { total_pool_micro_usdc, staked_micro_usdc, liquid_micro_usdc, subsidy_bonus_bps }`.

2. Create `src/lib/defi/floatRouter.ts` and `scripts/rebuild_from_chain.ts`:
   - `floatRouter.ts`: Invokes `rebalance_defi_float` and inserts a row into `defi_vault_snapshots`.
   - `rebuild_from_chain.ts`: Fetches `DepositCommitted` Anchor events from Solana RPC, sorts by `leaf_index ASC`, and rebuilds `merkle_leaves` in PostgreSQL.

3. Create `tests/anchor/defi-float-and-dr.test.ts`:
   - Test case 1 (`TEST-CHAIN-003`): Deposit `100_000_000` micro-USDC (100 USDC), call `rebalance_defi_float`, and assert `defi_yield_vault` balance is `90_000_000` and `liquid_vault` balance is `10_000_000`.
   - Test case 2 (`TEST-DR-001`): Truncate `merkle_leaves` in PostgreSQL, run `rebuildFromChain()`, and assert all committed leaves and roots are restored identically in < 30 seconds.

4. Deploy and verify on Solana Devnet:
   ```bash
   anchor build
   anchor deploy --provider.cluster devnet
   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx vitest run tests/anchor/defi-float-and-dr.test.ts
   ```

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Localnet & Devnet tests:
   ```bash
   anchor test
   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx vitest run tests/anchor/defi-float-and-dr.test.ts
   ```
   Expected output: 90/10 split and DR rebuild pass on both Localnet and Devnet.

DEFINITION OF DONE:
- [ ] `rebalance_defi_float` implemented and verified on Devnet
- [ ] `npm run db:rebuild-from-chain` passes DR drill (`RPO = 0`)
- [ ] All Milestone 1 tests pass
- [ ] `progress.md` updated and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from `defi-float-and-dr.test.ts` and `rebuild_from_chain.ts`
3. Devnet transaction signature for `rebalance_defi_float`
4. Confirmation that Milestone 1 is 100% complete
═══════════════════════════════════════════════════════════════
```

#### Progress Tracking Update
After completing Step 1.4, add this entry to `progress.md`:

```markdown
### ✅ Milestone 1: Circom Circuit & Solana Anchor `RefractVault` Program (Steps 1.1 – 1.4) - COMPLETED

**Date**: 2026-11-07
**Duration**: 3.7 Hours
**Status**: ✅ COMPLETE

**What Was Built**:
- `circuits/refract_note_spend.circom` & `verifying_key.rs`: Depth-20 Poseidon Merkle note-spend circuit compiled to `.wasm`/`.zkey` and exported to Rust big-endian verifying key constants.
- `programs/refract_vault`: Zero-copy `ZkYieldVault` (`1,840 bytes`), incremental `light-poseidon` tree, `settle_zk_spend` (`groth16-solana` verifying proofs in `~104,280 CU <= 140k CU`), `NullifierRecord` double-spend PDAs, and `rebalance_defi_float` (90/10 yield split).
- `scripts/rebuild_from_chain.ts`: Disaster recovery script reconstructing `merkle_leaves` from Solana event logs (`RPO = 0`).

**Tests Executed**:
- Circuit Unit Tests: ✅ Passed (`circuit-prover.test.ts` — proof generated in `<1.8s`)
- Anchor SVM & Devnet Tests: ✅ Passed (`merkle-vault.test.ts`, `zk-spend-verifier.test.ts`, `defi-float-and-dr.test.ts`)
- Solana Devnet Deployment: ✅ Full `RefractVault` deployed and verified on Devnet

**Next Step**: Milestone 2 (Step 2.1) - Aurora Intents `1Click` Quote Service (`Confidential Mode` + `30 bps` Integrator Fee)
```

---

**Please review Milestone 1. Verify that:**
- **Each step is atomic (15-60 min max)**
- **Each step has clear testing requirements**
- **[Web3 Projects] Each contract step includes testnet deployment**
- **Definition of Done is comprehensive**

**Reply with 'approved' to proceed to the next milestone, or provide feedback for adjustments.**

---

## MILESTONE 2: AURORA INTENTS, OPTIMISTIC FLOAT CREDIT & CROSS-CHAIN REFUNDS (9.0 Hours / 540 Minutes)

This milestone implements the complete cross-chain liquidity layer required to win the **$1,500 Aurora Intents 1st Place Bounty**: 35+-chain persistent deposit quote generation (`@defuse-protocol/one-click-sdk-typescript` `0.1.26`), **Confidential Intents** (`confidentialMode: true`), custom integrator revenue-share fees (`30 bps` split 40%–60% with Aurora), the **`<400ms` Optimistic Float Credit Engine** (`R-010`) that eliminates bridge wait times, the background Solana Anchor deposit-and-commit settlement worker, and automated reverse-intent cross-chain refunds (`R-011`).

---

### Step 2.1: Implement Aurora Intents `OneClickService` Adapter & `POST /api/v1/intents/quote` (`Confidential Mode` + `30 bps` Fee)
**Duration**: 55 minutes
**Objective**: Build the Aurora Intents quote service (`src/lib/aurora/oneClickService.ts`) and `POST /api/v1/intents/quote` endpoint that generates persistent 35+-chain deposit addresses with `confidentialMode: true` (`R-002`) and custom `referralFees: 30 bps` (`R-014`), persisting the quote in `intent_deposits` without logging client IP or origin EOA identity alongside future ZK sessions.
**Risk**: Medium - Ensuring the Aurora Studio JWT (`AURORA_STUDIO_JWT_TOKEN`) is injected into `OpenAPI.TOKEN` so quotes waive the 25 bps unauthenticated fee penalty and attach our `30 bps` integrator fee cleanly.
**Prerequisites**: Milestone 1 completed; `AURORA_STUDIO_JWT_TOKEN` and `AURORA_INTEGRATOR_FEE_RECIPIENT` set in `.env`.
**Testing Type**: Unit & Live Aurora `1Click API` Integration (`TEST-INT-001`, `TEST-INT-002`, `TEST-INT-005`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 3.5 (`src/lib/aurora/oneClickService.ts`) & Section 3.6 (Aurora `1Click API`)
- **Requirements**: `/blueprint/srd.md` → `R-001`, `R-002`, `R-014`, `SEC-04`
- **Dependencies**: Milestone 0 (`schema.sql` `intent_deposits` table)
- **Related Tests**: `tests/integration/aurora-quote.test.ts`

#### What to Build
1. `src/lib/aurora/oneClickService.ts`:
   - Configures `@defuse-protocol/one-click-sdk-typescript` (`v0.1.26`) with `OpenAPI.BASE = process.env.AURORA_ONE_CLICK_BASE_URL` and `OpenAPI.TOKEN = process.env.AURORA_STUDIO_JWT_TOKEN`.
   - Implements `getSupportedCrossChainTokens()` (cached 300s in Redis/memory).
   - Implements `createConfidentialDepositQuote(params: QuoteRequest)` which validates `amountRaw >= 1_000_000` (`$1.00` minimum, `BR-01`), sets `swapType: 'EXACT_INPUT'`, `destinationAsset` to canonical Solana Mainnet USDC (`nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near`), `recipient` to the Refract Solana Relayer/Vault receiver token account, `confidentialMode: params.confidentialMode ?? true` (`R-002`), and `appFees / referralFees: [{ recipient: process.env.AURORA_INTEGRATOR_FEE_RECIPIENT, fee: Number(process.env.AURORA_INTEGRATOR_FEE_BPS || 30) }]` (`R-014`).
   - Inserts or returns idempotently (by `poseidon_commitment_hex`) the record in `intent_deposits`.
2. `src/app/api/v1/intents/quote/route.ts`:
   - Next.js 15 POST handler with strict Zod validation matching `blueprint/openapi.yaml` (`QuoteRequest` / `QuoteResponse`).

#### Build Instructions (Atomic Steps)
1. Create `src/lib/aurora/oneClickService.ts` wrapping `@defuse-protocol/one-click-sdk-typescript` with 3x exponential backoff (`500ms, 1000ms, 2000ms`) and idempotency lookup on `intent_deposits.poseidon_commitment_hex`.
2. Create `src/app/api/v1/intents/quote/route.ts` enforcing Zod validation (`^0x[a-fA-F0-9]{64}$` on `poseidonCommitmentHex` and `>= $1.00` minimum deposit `ERR_MIN_DEPOSIT_NOT_MET`).
3. Write `tests/integration/aurora-quote.test.ts` testing:
   - Valid quote creation (`Base USDC` $\rightarrow$ `Solana USDC`) returning `depositAddress` and `auroraQuoteId` in `<= 1,500ms` (`TEST-INT-001`).
   - Verification that `confidentialMode: true` (`TEST-INT-002`) and `integratorFeeBps: 30` (`TEST-INT-005`) are persisted in `intent_deposits` and sent in the SDK payload.
   - Idempotency check (calling twice with the same `poseidonCommitmentHex` returns the existing quote without creating duplicate rows).
   - Rejection of `< $1.00` deposit with `HTTP 400 ERR_MIN_DEPOSIT_NOT_MET`.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Unit & Live SDK Integration Tests**
```bash
npx vitest run tests/integration/aurora-quote.test.ts
# Expected:
# - TEST-INT-001 PASS: Valid depositAddress returned in < 1,500ms
# - TEST-INT-002 PASS: confidentialMode === true verified
# - TEST-INT-005 PASS: integratorFeeBps === 30 attached to quote
# - Idempotency & ERR_MIN_DEPOSIT_NOT_MET tests PASS
```

**Phase 2: Local API Server Verification**
```bash
curl -X POST http://localhost:3000/api/v1/intents/quote \
  -H "Content-Type: application/json" \
  -d '{
    "originChain": "base",
    "originAsset": "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    "amountRaw": "10000000",
    "refundAddress": "0x71C95911E9a5D330f4D621842EC243EE1343292e",
    "poseidonCommitmentHex": "0x2f8b9a1c4d5e6f708192a3b4c5d6e7f80112233445566778899aabbccddeeff0",
    "confidentialMode": true
  }'
# Expected: HTTP 200 OK with auroraQuoteId, depositAddress, expectedSolanaMicroUsdc, integratorFeeBps: 30, confidentialMode: true
```

**Phase 4: Manual Verification**
1. Query PostgreSQL: `SELECT aurora_quote_id, origin_chain, confidential_mode, integrator_fee_bps, status FROM intent_deposits;` and confirm the row exists with `status = 'QUOTE_CREATED'`.
2. Send a request with `"amountRaw": "100000"` (`$0.10`) and confirm `HTTP 400` returns `{ "code": "ERR_MIN_DEPOSIT_NOT_MET" }`.

#### Deliverables Checklist
- [ ] **Code**: `src/lib/aurora/oneClickService.ts` and `src/app/api/v1/intents/quote/route.ts`
- [ ] **Tests**: `tests/integration/aurora-quote.test.ts` (`TEST-INT-001`, `TEST-INT-002`, `TEST-INT-005`)
- [ ] **Verification**: Live quote generation, Confidential Mode, and 30 bps fee verified
- [ ] **Git**: Commit created `feat(aurora): step 2.1 aurora 1click quote service with confidential mode and 30bps fee`

#### Definition of Done (STRICT)
✅ Code compiles without TypeScript errors (`npx tsc --noEmit`)
✅ All unit and integration tests pass (`TEST-INT-001`, `TEST-INT-002`, `TEST-INT-005`)
✅ Response schema matches `blueprint/openapi.yaml` 100%
✅ `intent_deposits` row created idempotently with zero client IP logged (`SEC-04`)
✅ `progress.md` updated with completion status and test results
✅ Git commit created with format: `feat(aurora): step 2.1 1click quote endpoint and confidential adapter`

#### Common Issues & Solutions
**Issue 1**: `OneClickService.getQuote` returns `400 Bad Request` if `deadline` / `expiresAt` is missing or in the past.
**Solution**: Always pass `deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString()` (10 minutes in the future).

**Issue 2**: Local offline test runs fail when disconnected from the internet.
**Solution**: In `oneClickService.ts`, support deterministic mock responses when `NODE_ENV === 'test'` and `AURORA_LIVE_SPIKE !== 'true'`, while running at least one live contract test against `https://1click.chaindefuser.com`.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 2.1 - Implement Aurora Intents OneClickService & POST /api/v1/intents/quote
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Next.js 15.2.4, @defuse-protocol/one-click-sdk-typescript 0.1.26, PostgreSQL 16, Zod
- Objective: Build `src/lib/aurora/oneClickService.ts` and `POST /api/v1/intents/quote` supporting 35+ chains, `confidentialMode: true` (`R-002`), and `30 bps` custom integrator fee (`R-014`).

PREREQUISITES:
- Milestone 1 completed.

BUILD INSTRUCTIONS:
1. Create `src/lib/aurora/oneClickService.ts`:
   - Initialize `OpenAPI.BASE` and `OpenAPI.TOKEN` from environment variables.
   - Implement `createConfidentialDepositQuote(req)`:
     - Enforce minimum deposit >= $1.00 USDC equivalent (`ERR_MIN_DEPOSIT_NOT_MET`).
     - Check idempotency in `intent_deposits` by `poseidon_commitment_hex`.
     - Request quote from `OneClickService.getQuote` with `dry: false`, `confidentialMode: req.confidentialMode ?? true`, and `appFees: [{ recipient: process.env.AURORA_INTEGRATOR_FEE_RECIPIENT, fee: 30 }]`.
     - Insert row into `intent_deposits` (`status = 'QUOTE_CREATED'`).

2. Create `src/app/api/v1/intents/quote/route.ts`:
   - Validate request body with Zod matching `QuoteRequest` in `blueprint/openapi.yaml`.
   - Return `200 OK` with `QuoteResponse` and `X-Correlation-Id`.

3. Create `tests/integration/aurora-quote.test.ts`:
   - Test case 1 (`TEST-INT-001`): Request quote for 10 USDC on Base -> Solana USDC; assert `depositAddress` returned in <= 1,500ms.
   - Test case 2 (`TEST-INT-002` & `TEST-INT-005`): Assert `confidentialMode === true` and `integratorFeeBps === 30` in DB and response.
   - Test case 3: Repeat identical request and verify idempotent return of the same `auroraQuoteId`.
   - Test case 4: Request quote for `0.25 USDC` and assert `400 ERR_MIN_DEPOSIT_NOT_MET`.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Integration tests:
   ```bash
   npx vitest run tests/integration/aurora-quote.test.ts
   ```
   Expected output: 4 passed (`TEST-INT-001`, `TEST-INT-002`, `TEST-INT-005`, validation).

DEFINITION OF DONE:
- [ ] `oneClickService.ts` and `/api/v1/intents/quote` implemented
- [ ] All 4 integration test cases pass
- [ ] No TypeScript or OpenAPI schema errors
- [ ] `progress.md` updated and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from Vitest
3. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 2.2: Implement `<400ms` Optimistic Float Credit Engine (`POST /api/v1/intents/optimistic-credit`)
**Duration**: 50 minutes
**Objective**: Build the Optimistic Float Credit Engine (`src/lib/defi/optimisticCreditEngine.ts`) and `POST /api/v1/intents/optimistic-credit` endpoint (`R-010`, `NFR-002`) that fronts up to `$5.00` of instant `x402` Runtime Key credit from the Solana 10% Liquid Reserve within `<= 400ms` of origin-chain transaction broadcast, plus automatic revocation if the origin transaction fails or is refunded (`SEC-02`).
**Risk**: Medium - Preventing optimistic credit abuse (`SEC-02`) by enforcing the `$5.00` cap, checking the 80% liquid reserve utilization circuit breaker (`BR-04`), and notifying `OneClickService.submitDepositTx()`.
**Prerequisites**: Step 2.1 completed.
**Testing Type**: Integration, Security & Latency Verification (`TEST-INT-003`, `NFR-002`, `SEC-02`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 3.1 (`ADR-003`) & Section 3.5 (`src/lib/defi/floatRouter.ts`)
- **Requirements**: `/blueprint/srd.md` → `R-010`, `NFR-002`, `SEC-02`, `BR-03`, `BR-04`
- **Dependencies**: Step 0.3 (`runtimeKeyMeter.ts`), Step 2.1 (`oneClickService.ts`)
- **Related Tests**: `tests/integration/optimistic-credit.test.ts`

#### What to Build
1. `src/lib/defi/optimisticCreditEngine.ts`:
   - Verifies that `auroraQuoteId` exists in `intent_deposits` with `status === 'QUOTE_CREATED'` and `optimistic_credit_issued === false`.
   - Submits `originTxHash` to Aurora `OneClickService.submitDepositTx({ txHash: originTxHash, depositAddress })` asynchronously and checks origin tx format/broadcast validity.
   - Checks the Liquid Reserve circuit breaker (`BR-04`): ensures `optimistic_utilized_micro_usdc + credit <= 0.80 * liquid_reserve_micro_usdc`.
   - Calculates `creditMicroUsdc = Math.min(expected_solana_micro_usdc, Number(process.env.OPTIMISTIC_CREDIT_MAX_MICRO_USDC || 5_000_000))` (`$5.00` cap, `BR-03`) and `yieldSubsidyBonusMicroUsdc = Math.floor(creditMicroUsdc * 0.084)` (`+8.4%` DeFi yield bonus).
   - Mints `rk_live_opt_<32_byte_hex>` into `zk_runtime_sessions` (`is_optimistic = true`, `status = 'ACTIVE'`) and caches it in Upstash Redis so the user can make paid `x402` calls immediately (`<= 400ms` total execution time, `NFR-002`).
   - Implements `revokeOptimisticCreditOnFailure(auroraQuoteId, nullifierHashHex)` which immediately sets `status = 'REVOKED'` in Redis and Postgres if the origin transaction reverts or Aurora refunds (`SEC-02`).
2. `src/app/api/v1/intents/optimistic-credit/route.ts`:
   - Next.js 15 POST handler returning `{ runtimeKey, optimisticCreditMicroUsdc, yieldSubsidyBonusMicroUsdc, latencyMs }`.

#### Build Instructions (Atomic Steps)
1. Create `src/lib/defi/optimisticCreditEngine.ts` implementing `issueOptimisticCredit()` and `revokeOptimisticCreditOnFailure()`.
2. Create `src/app/api/v1/intents/optimistic-credit/route.ts` with Zod validation and latency timer.
3. Write `tests/integration/optimistic-credit.test.ts` testing:
   - Issuing optimistic credit on a `10.00 USDC` quote and verifying `optimisticCreditMicroUsdc === 5_000_000` (`$5.00` cap) and `latencyMs <= 400` (`TEST-INT-003`, `NFR-002`).
   - Rejecting duplicate optimistic credit requests on the same `auroraQuoteId` with `HTTP 409`.
   - Triggering `revokeOptimisticCreditOnFailure()` and verifying that subsequent attempts to spend the `rk_live_opt_*` key fail immediately with `ERR_OPTIMISTIC_SESSION_REVOKED` (`SEC-02`).

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Integration, Latency & Security Tests**
```bash
npx vitest run tests/integration/optimistic-credit.test.ts
# Expected:
# - TEST-INT-003 PASS: rk_live_opt_* issued in <= 400ms (p95) with $5.00 cap + $0.42 yield bonus
# - Duplicate request rejected with 409
# - SEC-02 PASS: Revoked optimistic key immediately blocked by runtimeKeyMeter
```

**Phase 2: Local API Verification**
```bash
curl -X POST http://localhost:3000/api/v1/intents/optimistic-credit \
  -H "Content-Type: application/json" \
  -d '{
    "auroraQuoteId": "<QUOTE_ID_FROM_STEP_2_1>",
    "originTxHash": "0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b",
    "groth16Proof": {},
    "publicInputs": ["0x01", "0x91a4c2010000000000000000000000000000000000000000000000000000c201", "5000000", "0x02"]
  }'
# Expected: HTTP 200 OK with runtimeKey: "rk_live_opt_...", optimisticCreditMicroUsdc: 5000000, latencyMs < 400
```

**Phase 4: Manual Verification**
1. Verify `latencyMs` in the JSON response is `<= 400`.
2. Check PostgreSQL `intent_deposits` and confirm `status = 'OPTIMISTIC_CREDITED'` and `optimistic_credit_issued = true`.

#### Deliverables Checklist
- [ ] **Code**: `src/lib/defi/optimisticCreditEngine.ts`, `src/app/api/v1/intents/optimistic-credit/route.ts`
- [ ] **Tests**: `tests/integration/optimistic-credit.test.ts` (`TEST-INT-003`, `NFR-002`, `SEC-02`)
- [ ] **Verification**: `<400ms` latency, `$5.00` cap, and revocation safety verified
- [ ] **Git**: Commit created `feat(optimistic-float): step 2.2 sub-400ms optimistic credit engine and revocation guard`

#### Definition of Done (STRICT)
✅ Optimistic credit issues in `<= 400ms` (p95) (`NFR-002`, `TEST-INT-003`)
✅ `$5.00` cap (`BR-03`) and 80% liquid reserve circuit breaker (`BR-04`) enforced
✅ Duplicate and revoked optimistic session attacks blocked (`SEC-02`)
✅ All unit and integration tests pass
✅ `progress.md` updated with completion status and latency metrics
✅ Git commit created with format: `feat(optimistic-float): step 2.2 optimistic credit engine`

#### Common Issues & Solutions
**Issue 1**: Waiting synchronously for `OneClickService.submitDepositTx` network roundtrip adds `300ms` latency.
**Solution**: Fire `OneClickService.submitDepositTx` non-blockingly (`void OneClickService.submitDepositTx(...).catch(...)`) after validating `originTxHash` format and committing the atomic Redis/Postgres lock so `POST /api/v1/intents/optimistic-credit` responds in `<180ms`.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 2.2 - Implement <400ms Optimistic Float Credit Engine
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Next.js 15.2.4, PostgreSQL 16, Upstash Redis 7.2, @defuse-protocol/one-click-sdk-typescript 0.1.26
- Objective: Implement `src/lib/defi/optimisticCreditEngine.ts` and `POST /api/v1/intents/optimistic-credit` to front up to $5.00 of instant x402 Runtime Key credit in <= 400ms (`R-010`, `NFR-002`, `SEC-02`).

PREREQUISITES:
- Step 2.1 completed.

BUILD INSTRUCTIONS:
1. Create `src/lib/defi/optimisticCreditEngine.ts`:
   - Verify `auroraQuoteId` is in `QUOTE_CREATED` state and `optimistic_credit_issued === false`.
   - Enforce 80% liquid reserve circuit breaker (`BR-04`) and `$5.00` (`5_000_000` micro-USDC) cap (`BR-03`).
   - Issue `rk_live_opt_<hex>` into Redis and `zk_runtime_sessions` (`is_optimistic = true`) with `+8.4%` DeFi yield subsidy bonus.
   - Implement `revokeOptimisticCreditOnFailure(auroraQuoteId)` to set `status = 'REVOKED'` if Aurora status becomes `REFUNDED` or `FAILED`.

2. Create `src/app/api/v1/intents/optimistic-credit/route.ts`:
   - Measure execution latency and return `{ runtimeKey, optimisticCreditMicroUsdc, yieldSubsidyBonusMicroUsdc, latencyMs }`.

3. Create `tests/integration/optimistic-credit.test.ts`:
   - Test case 1 (`TEST-INT-003`): Issue optimistic credit for a $10 quote; assert credit is capped at `5_000_000`, bonus is `420_000`, and `latencyMs <= 400`.
   - Test case 2: Call a second time for the same quote; assert `409 Conflict`.
   - Test case 3 (`SEC-02`): Call `revokeOptimisticCreditOnFailure` and assert `authorizeAndDeductRuntimeKey` immediately rejects the key.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Integration & Security tests:
   ```bash
   npx vitest run tests/integration/optimistic-credit.test.ts
   ```
   Expected output: 3 passed, latency <= 400ms.

DEFINITION OF DONE:
- [ ] Optimistic credit engine and API route implemented
- [ ] Latency verified <= 400ms
- [ ] Security revocation test passes
- [ ] `progress.md` updated and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from Vitest
3. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 2.3: Implement `SolanaAnchorDepositWorker` (`W-01`) & `GET /api/v1/zkapi/tree` Public Merkle Endpoint
**Duration**: 55 minutes
**Objective**: Build the asynchronous deposit settlement worker (`src/lib/workers/solanaDepositWorker.ts`, `W-01`) that polls Aurora `OneClickService.getExecutionStatus()`, invokes `deposit_and_commit` + `rebalance_defi_float` on the Solana `RefractVault` Anchor program when funds land (`R-003`, `R-004`, `R-009`), updates `merkle_leaves`, and exposes `GET /api/v1/zkapi/tree` so browsers can fetch the public Merkle tree in `<50ms`.
**Risk**: Medium - Ensuring idempotency so a retried webhook or poll never inserts the same `poseidon_commitment_hex` twice.
**Prerequisites**: Step 2.2 completed; Solana Devnet `RefractVault` deployed in Milestone 1.
**Testing Type**: Worker Integration + Solana Devnet Transaction Execution (`TEST-CHAIN-001`, `R-003`, `R-004`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 3.3 (`merkle_leaves`) & Section 3.8 (Caching `refract:merkle:tree`)
- **Requirements**: `/blueprint/srd.md` → Section 8 (`W-01: SolanaAnchorDepositWorker`), `R-003`, `R-004`, `R-009`, `R-010`
- **Dependencies**: Milestone 1 (`deposit_and_commit`), Step 2.1, Step 2.2
- **Related Tests**: `tests/integration/deposit-worker-and-tree.test.ts`

#### What to Build
1. `src/lib/workers/solanaDepositWorker.ts` (`W-01`):
   - Polls active `intent_deposits` rows (`WHERE status IN ('QUOTE_CREATED', 'OPTIMISTIC_CREDITED', 'PENDING_DEPOSIT', 'PROCESSING')`).
   - Calls `OneClickService.getExecutionStatus(depositAddress)`:
     - On `SUCCESS`: Submits `deposit_and_commit(commitment, settledAmount)` and `rebalance_defi_float()` to the Solana Anchor `RefractVault` program via the relayer keypair, inserts the new leaf into `merkle_leaves`, invalidates Redis cache `refract:merkle:tree`, upgrades any associated optimistic session (`is_optimistic = false`, unlocks full settled balance minus `10 bps` fast-fill fee), and marks `intent_deposits.status = 'SUCCESS'`.
     - On `REFUNDED` or `FAILED`: Calls `revokeOptimisticCreditOnFailure(auroraQuoteId)` (`SEC-02`).
2. `src/app/api/v1/zkapi/tree/route.ts`:
   - Implements `GET /api/v1/zkapi/tree` returning `{ currentRootHex, nextLeafIndex, leaves }` from `merkle_leaves` (cached in Redis for 60s and invalidated on every new leaf insertion).

#### Build Instructions (Atomic Steps)
1. Create `src/lib/workers/solanaDepositWorker.ts` with exponential backoff (`1s, 2s, 4s, 8s, 16s`) and idempotent `ON CONFLICT (commitment_hex) DO NOTHING` guard.
2. Create `src/app/api/v1/zkapi/tree/route.ts` matching `blueprint/openapi.yaml`.
3. Write `tests/integration/deposit-worker-and-tree.test.ts` to simulate an Aurora `SUCCESS` settlement event, execute `processPendingDeposit()` against the live Solana Anchor program (Localnet + Devnet), verify `merkle_leaves` is populated, and verify `GET /api/v1/zkapi/tree` returns the updated `currentRootHex` and leaf array.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Worker & Public Merkle Tree Integration Tests**
```bash
npx vitest run tests/integration/deposit-worker-and-tree.test.ts
# Expected:
# - Worker detects Aurora SUCCESS -> executes deposit_and_commit on Solana
# - Leaf inserted in merkle_leaves with solana_tx_sig
# - GET /api/v1/zkapi/tree returns currentRootHex matching on-chain ZkYieldVault root
# - Simulated REFUNDED status revokes optimistic credit cleanly
```

**Phase 2: Solana Devnet Worker Verification**
```bash
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx vitest run tests/integration/deposit-worker-and-tree.test.ts
# Expected: Worker commits leaf to Solana Devnet RefractVault and updates Postgres merkle_leaves
```

**Phase 4: Manual Verification**
1. Call `curl http://localhost:3000/api/v1/zkapi/tree` and confirm `currentRootHex`, `nextLeafIndex >= 1`, and `leaves[]` array are returned in `<50ms`.

#### Deliverables Checklist
- [ ] **Code**: `src/lib/workers/solanaDepositWorker.ts` and `src/app/api/v1/zkapi/tree/route.ts`
- [ ] **Tests**: `tests/integration/deposit-worker-and-tree.test.ts`
- [ ] **Verification**: Worker settlement, 90/10 rebalance trigger, and `/api/v1/zkapi/tree` verified on Localnet and Devnet
- [ ] **Git**: Commit created `feat(worker): step 2.3 solana anchor deposit worker and public merkle tree endpoint`

#### Definition of Done (STRICT)
✅ `SolanaAnchorDepositWorker` settles deposits onto Solana and updates `merkle_leaves` idempotently (`R-003`, `R-004`)
✅ Failed/refunded Aurora swaps automatically revoke optimistic credit (`SEC-02`)
✅ `GET /api/v1/zkapi/tree` returns valid public Merkle state in `<50ms`
✅ **[Web3 ONLY]** Verified against Solana Devnet `RefractVault` program
✅ `progress.md` updated with completion status and test results
✅ Git commit created with format: `feat(worker): step 2.3 anchor deposit worker and zkapi tree api`

#### Common Issues & Solutions
**Issue 1**: Concurrent worker ticks pick up the same `PENDING_DEPOSIT` row twice.
**Solution**: Use PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` inside `solanaDepositWorker.ts` so each worker tick locks disjoint rows.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 2.3 - Implement SolanaAnchorDepositWorker & GET /api/v1/zkapi/tree
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Next.js 15.2.4, Anchor 1.2.2, @solana/web3.js 1.99.0, @defuse-protocol/one-click-sdk-typescript 0.1.26, PostgreSQL 16
- Objective: Build `src/lib/workers/solanaDepositWorker.ts` (`W-01`) to settle Aurora Intents deposits into the Solana `RefractVault` program and expose `GET /api/v1/zkapi/tree` (`R-003`, `R-004`, `R-009`).

PREREQUISITES:
- Step 2.2 completed.

BUILD INSTRUCTIONS:
1. Create `src/lib/workers/solanaDepositWorker.ts`:
   - Poll active `intent_deposits` using `FOR UPDATE SKIP LOCKED`.
   - Check `OneClickService.getExecutionStatus(depositAddress)`.
   - When `SUCCESS`: Invoke `deposit_and_commit` and `rebalance_defi_float` on Solana `RefractVault`, insert leaf into `merkle_leaves`, invalidate Redis `refract:merkle:tree`, and finalize optimistic session balance.
   - When `REFUNDED` or `FAILED`: Call `revokeOptimisticCreditOnFailure(auroraQuoteId)`.

2. Create `src/app/api/v1/zkapi/tree/route.ts`:
   - Return `{ currentRootHex, nextLeafIndex, leaves }` from `merkle_leaves` ordered by `leaf_index ASC`.

3. Create `tests/integration/deposit-worker-and-tree.test.ts`:
   - Test case 1: Simulate Aurora `SUCCESS` on a pending quote; run worker and assert `merkle_leaves` contains the new leaf and `solana_settlement_sig` is recorded.
   - Test case 2: Call `GET /api/v1/zkapi/tree` and assert `currentRootHex` matches on-chain `ZkYieldVault` root.
   - Test case 3: Simulate Aurora `REFUNDED` on an optimistic quote; run worker and assert session status becomes `REVOKED`.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Local & Devnet Worker Integration tests:
   ```bash
   npx vitest run tests/integration/deposit-worker-and-tree.test.ts
   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx vitest run tests/integration/deposit-worker-and-tree.test.ts
   ```
   Expected output: All 3 test cases pass on Localnet and Devnet.

DEFINITION OF DONE:
- [ ] `solanaDepositWorker.ts` and `/api/v1/zkapi/tree` implemented
- [ ] Verified against Solana Devnet `RefractVault`
- [ ] All tests pass and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from Vitest and Devnet tx signature
3. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 2.4: Implement Automated Reverse-Intent Cross-Chain Refund Service (`POST /api/v1/intents/refund`, `R-011`)
**Duration**: 50 minutes
**Objective**: Build the reverse-intent cross-chain refund service (`src/lib/aurora/reverseRefundService.ts`, `W-03`) and `POST /api/v1/intents/refund` endpoint (`R-011`) that closes an unspent `zkAPI` runtime session (or compensates a failed `x402` API call) and automatically routes the remaining Solana USDC back to the user's chosen destination chain and token (e.g., Arbitrum USDC, Base ETH, NEAR, or Bitcoin) via Aurora `1Click API`.
**Risk**: Low - Ensuring atomic state transition (`ACTIVE` $\rightarrow$ `CLOSED_REFUNDED`) before initiating the outbound Aurora `1Click` quote so a session cannot be refunded twice.
**Prerequisites**: Step 2.3 completed.
**Testing Type**: Integration & Double-Refund Prevention Testing (`TEST-INT-004`, `R-011`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 3.5 (`src/lib/aurora/oneClickService.ts`)
- **Requirements**: `/blueprint/srd.md` → Section 8 (`W-03: AuroraReverseIntentRefundJob`), `R-011`, `TEST-INT-004`
- **Dependencies**: Step 0.3 (`runtimeKeyMeter.ts`), Step 2.1 (`oneClickService.ts`)
- **Related Tests**: `tests/integration/cross-chain-refund.test.ts`

#### What to Build
1. `src/lib/aurora/reverseRefundService.ts` (`W-03`):
   - Authenticates the caller's `PAYMENT-SIGNATURE` (`rk_live_*` token).
   - Atomically locks the session via `UPDATE zk_runtime_sessions SET status = 'CLOSED_REFUNDED', updated_at = NOW() WHERE runtime_key_hash = $1 AND status = 'ACTIVE' AND remaining_micro_usdc > 0 RETURNING id, remaining_micro_usdc, yield_subsidy_micro_usdc;` (and deletes the active key from Redis so it can never be spent again).
   - Computes refundable principal `refundableMicroUsdc = Math.max(0, remaining_micro_usdc - yield_subsidy_micro_usdc)` (ensuring protocol yield subsidies cannot be farmed via instant deposit-and-withdraw loops).
   - Requests a reverse Aurora `1Click` quote from Solana Mainnet USDC $\rightarrow$ `destinationAsset` on `destinationChain` with `recipient: recipientAddress`.
   - Records the refund receipt in `x402_usage_receipts` (`refund_triggered = TRUE`, `aurora_refund_quote_id`) and returns `{ auroraRefundQuoteId, refundedMicroUsdc, status: 'PROCESSING_REFUND' }`.
2. `src/app/api/v1/intents/refund/route.ts`:
   - Next.js 15 POST handler matching `blueprint/openapi.yaml`.

#### Build Instructions (Atomic Steps)
1. Create `src/lib/aurora/reverseRefundService.ts` with atomic session closure (`status = 'CLOSED_REFUNDED'`) and Aurora `OneClickService.getQuote()` outbound routing.
2. Create `src/app/api/v1/intents/refund/route.ts` enforcing `PAYMENT-SIGNATURE` authentication and Zod payload validation.
3. Write `tests/integration/cross-chain-refund.test.ts` testing:
   - Closing an active session with `8.45 USDC` remaining principal and initiating a reverse Aurora Intent to Arbitrum USDC (`TEST-INT-004`).
   - Attempting a second refund call on the same `rk_live_*` token and asserting it fails with `HTTP 409 ERR_SESSION_ALREADY_CLOSED` (double-refund immunity).
   - Attempting to spend the `rk_live_*` token after refund and asserting it fails immediately.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Integration & Double-Refund Security Tests**
```bash
npx vitest run tests/integration/cross-chain-refund.test.ts
# Expected:
# - TEST-INT-004 PASS: Session transitioned to CLOSED_REFUNDED, auroraRefundQuoteId returned
# - Double-refund attempt rejected with 409 ERR_SESSION_ALREADY_CLOSED
# - Post-refund spend attempt rejected
```

**Phase 2: Local API Verification**
```bash
curl -X POST http://localhost:3000/api/v1/intents/refund \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: $(echo -n '{"scheme":"zkapi-runtime-key","token":"<ACTIVE_RK_TOKEN>"}' | base64 -w0)" \
  -d '{
    "destinationChain": "arbitrum",
    "destinationAsset": "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
    "recipientAddress": "0x71C95911E9a5D330f4D621842EC243EE1343292e"
  }'
# Expected: HTTP 200 OK with {"auroraRefundQuoteId":"...","refundedMicroUsdc":5000000,"status":"PROCESSING_REFUND"}
```

**Phase 4: Manual Verification**
1. Query PostgreSQL `zk_runtime_sessions` and verify `status = 'CLOSED_REFUNDED'`.
2. Query `x402_usage_receipts` and verify the refund audit record has `refund_triggered = true` and a non-null `aurora_refund_quote_id`.

#### Deliverables Checklist
- [ ] **Code**: `src/lib/aurora/reverseRefundService.ts` and `src/app/api/v1/intents/refund/route.ts`
- [ ] **Tests**: `tests/integration/cross-chain-refund.test.ts` (`TEST-INT-004`)
- [ ] **Verification**: Reverse Aurora `1Click` refund and double-refund immunity verified
- [ ] **Git**: Commit created `feat(refund): step 2.4 automated reverse-intent cross-chain refund via aurora 1click`

#### Definition of Done (STRICT)
✅ `POST /api/v1/intents/refund` closes active session atomically and initiates reverse Aurora `1Click` quote (`R-011`, `TEST-INT-004`)
✅ Yield subsidy farming prevented (`refundableMicroUsdc` deducts unspent bonus subsidy)
✅ Double-refund and post-refund spend attacks blocked
✅ All Milestone 2 tests pass (`TEST-INT-001` through `TEST-INT-005`)
✅ `progress.md` updated with Milestone 2 completion summary
✅ Git commit created with format: `feat(refund): step 2.4 complete m2 aurora intents and cross-chain refunds`

#### Common Issues & Solutions
**Issue 1**: User tries to refund a balance where remaining principal `< $1.00` (below cross-chain solver minimum).
**Solution**: If `refundableMicroUsdc < 1_000_000`, offer direct Solana USDC withdrawal (`destinationChain === 'solana'`) with zero solver minimum fee.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 2.4 - Implement Automated Reverse-Intent Cross-Chain Refund Service (R-011)
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Next.js 15.2.4, @defuse-protocol/one-click-sdk-typescript 0.1.26, PostgreSQL 16, Upstash Redis 7.2
- Objective: Build `src/lib/aurora/reverseRefundService.ts` and `POST /api/v1/intents/refund` to close unspent zkAPI sessions and refund balances to any of 35+ chains via Aurora 1Click API (`R-011`, `TEST-INT-004`).

PREREQUISITES:
- Steps 2.1, 2.2, and 2.3 completed.

BUILD INSTRUCTIONS:
1. Create `src/lib/aurora/reverseRefundService.ts`:
   - Parse `PAYMENT-SIGNATURE` header to extract `rk_live_*` token.
   - Atomically update `zk_runtime_sessions SET status = 'CLOSED_REFUNDED' WHERE runtime_key_hash = $1 AND status = 'ACTIVE' RETURNING *`.
   - Evict key from Upstash Redis.
   - Request reverse quote via `OneClickService.getQuote` from Solana USDC to `destinationAsset` / `recipientAddress`.
   - Insert audit row in `x402_usage_receipts` with `refund_triggered = true`.

2. Create `src/app/api/v1/intents/refund/route.ts`:
   - Validate request body and return `{ auroraRefundQuoteId, refundedMicroUsdc, status: 'PROCESSING_REFUND' }`.

3. Create `tests/integration/cross-chain-refund.test.ts`:
   - Test case 1 (`TEST-INT-004`): Refund an active session to Arbitrum USDC; assert `200 OK` and `status === 'PROCESSING_REFUND'`.
   - Test case 2: Replay the refund request; assert `409 ERR_SESSION_ALREADY_CLOSED`.
   - Test case 3: Attempt to spend the refunded Runtime Key; assert immediate rejection.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. All Milestone 2 Integration tests:
   ```bash
   npx vitest run tests/integration/aurora-quote.test.ts tests/integration/optimistic-credit.test.ts tests/integration/deposit-worker-and-tree.test.ts tests/integration/cross-chain-refund.test.ts
   ```
   Expected output: All tests in Milestone 2 pass (`TEST-INT-001` to `TEST-INT-005`).

DEFINITION OF DONE:
- [ ] `reverseRefundService.ts` and `/api/v1/intents/refund` implemented
- [ ] All Milestone 2 integration tests pass
- [ ] `progress.md` updated and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from Vitest across all Milestone 2 test suites
3. Confirmation that Milestone 2 is 100% complete
═══════════════════════════════════════════════════════════════
```

#### Progress Tracking Update
After completing Step 2.4, add this entry to `progress.md`:

```markdown
### ✅ Milestone 2: Aurora Intents, Optimistic Float Credit & Cross-Chain Refunds (Steps 2.1 – 2.4) - COMPLETED

**Date**: 2026-11-07
**Duration**: 3.5 Hours
**Status**: ✅ COMPLETE

**What Was Built**:
- `src/lib/aurora/oneClickService.ts` & `POST /api/v1/intents/quote`: 35+-chain persistent deposit quote generator with `confidentialMode: true` (`R-002`) and `30 bps` custom integrator fee (`R-014`).
- `src/lib/defi/optimisticCreditEngine.ts` & `POST /api/v1/intents/optimistic-credit`: Sub-400ms optimistic credit issuance (`$5.00` cap + `+8.4%` DeFi yield bonus) with automatic failure revocation (`R-010`, `NFR-002`, `SEC-02`).
- `src/lib/workers/solanaDepositWorker.ts` & `GET /api/v1/zkapi/tree`: Background worker settling Aurora deposits into Solana `RefractVault` and serving public Merkle leaves in `<50ms` (`R-003`, `R-004`).
- `src/lib/aurora/reverseRefundService.ts` & `POST /api/v1/intents/refund`: Atomic session closure and reverse Aurora `1Click` cross-chain refund service (`R-011`).

**Tests Executed**:
- Integration Tests: ✅ Passed (`TEST-INT-001` to `TEST-INT-005` all verified)
- Solana Devnet Worker Settlement: ✅ Verified on Devnet

**Next Step**: Milestone 3 (Step 3.1) - Client Note Generator, Encrypted IndexedDB Vault & WebWorker `snarkjs` Prover
```

---

---

## MILESTONE 3: CLIENT ZK PROVER, `x402` GATEWAY, SCHNORR RECEIPTS & AGENT FIREWALL (10.0 Hours / 600 Minutes)

This milestone implements the complete **`zkAPI` + `x402` protocol bridge**: client-side Poseidon note generation and encrypted `IndexedDB` persistence (`R-004`), the browser WebWorker `snarkjs` Groth16 prover (`R-005`), the on-chain Solana nullifier verification endpoint (`POST /api/v1/zkapi/runtime-key`, `R-006`, `R-008`), the dual-scheme `HTTP 402` (`x402` v2) Gateway Middleware with Schnorr-signed receipts (`X-ZKAPI-RECEIPT`, `R-007`, `R-008`, `R-016`), and the `x402`-protected AI Inference Router with the Bounded Agent Spend Policy Firewall (`POST /api/v1/ai/chat`, `R-012`, `R-013`, `R-015`).

---

### Step 3.1: Implement Client Local Note Vault (`IndexedDB` + `.json` Backup) & WebWorker `snarkjs` Prover (`<= 2,200ms`)
**Duration**: 55 minutes
**Objective**: Build the client-side `zkAPI` note generator and encrypted `IndexedDB` storage manager (`src/lib/zkapi/clientNoteVault.ts`, `R-004`) that guarantees `0 bytes` of raw `nullifier` or `trapdoor` ever cross the network (`NFR-005`), paired with the non-blocking WebWorker Groth16 prover (`src/lib/zkapi/prover.worker.ts`, `R-005`, `NFR-003`).
**Risk**: Medium - Ensuring WebWorker `.wasm` and `.zkey` artifacts load cleanly in Next.js 15 and generate a valid 256-byte big-endian Groth16 proof in `<= 2,200ms` (`NFR-003`).
**Prerequisites**: Milestone 2 completed; `public/circuits/refract_note_spend.wasm` and `public/circuits/refract_note_spend_final.zkey` compiled in Step 1.1.
**Testing Type**: Unit, Performance & Zero-Leakage Security Testing (`TEST-SEC-001`, `TEST-ZK-001`, `NFR-003`, `NFR-005`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 3.5 (Frontend Architecture) & Section 3.8 (Frontend Performance Budget)
- **Requirements**: `/blueprint/srd.md` → `R-004`, `R-005`, `NFR-003`, `NFR-005`, `SEC-04`
- **Dependencies**: Step 0.4 (`bn254Serializer.ts`), Step 1.1 (`public/circuits/*`), Step 2.3 (`GET /api/v1/zkapi/tree`)
- **Related Tests**: `tests/unit/client-note-and-worker.test.ts`

#### What to Build
1. `src/lib/zkapi/clientNoteVault.ts`:
   - `generateLocalZkNote(amountMicroUsdc: bigint)`: Generates 31-byte cryptographically random `nullifier` and `trapdoor` via `crypto.getRandomValues()`, computes `commitmentHex = computePoseidonCommitment(nullifier, trapdoor, amountMicroUsdc)` and `nullifierHashHex = computePoseidonNullifierHash(nullifier)`, and derives deterministic `sessionPubkeyHash` (`Poseidon(nullifier, "session_key")`) for mid-tab-refresh recovery (`prd.md` Section 7.1).
   - `saveNoteEncrypted(note, passphraseOrSignature)`: Encrypts the secret note using WebCrypto `AES-GCM-256` and stores it in `IndexedDB` (`refract_notes_v1`).
   - `exportNoteBackupJson(note)` & `importNoteBackupJson(jsonString)`: Triggers browser `.json` file download (`refract-note-<short_hash>.json`) and sets `backedUp = true`.
2. `src/lib/zkapi/prover.worker.ts` & `src/lib/zkapi/proverClient.ts`:
   - Reconstructs the 20-level Poseidon Merkle path (`pathElements[20]`, `pathIndices[20]`) from the public `leaves[]` array returned by `GET /api/v1/zkapi/tree`.
   - Executes `snarkjs.groth16.fullProve(input, wasmUrl, zkeyUrl)` inside a WebWorker (with Node/Vitest worker fallback for CI tests) and serializes the resulting proof via `serializeGroth16ProofForSolana()` into a 256-byte hex string (`proofHex`).

#### Build Instructions (Atomic Steps)
1. Create `src/lib/zkapi/clientNoteVault.ts` implementing note generation, WebCrypto `AES-GCM-256` encryption, and `.json` backup export/import.
2. Create `src/lib/zkapi/merklePathBuilder.ts` to compute the 20-level sibling path (`pathElements`, `pathIndices`) for any `leafIndex` using `ZERO_VALUES` from Step 1.2.
3. Create `src/lib/zkapi/prover.worker.ts` and `src/lib/zkapi/proverClient.ts` wrapping `snarkjs.groth16.fullProve` and returning `{ proofHex, merkleRootHex, nullifierHashHex, spendCapMicroUsdc, sessionPubkeyHashHex, durationMs }`.
4. Write `tests/unit/client-note-and-worker.test.ts` verifying: (a) AES-GCM encrypt/decrypt roundtrip, (b) 0 bytes of `nullifier` or `trapdoor` present in the serialized API request payload (`TEST-SEC-001`), and (c) full proof generation completes in `<= 2,200ms` (`NFR-003`).

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Unit, Prover Speed & Zero-Leakage Security Tests**
```bash
npx vitest run tests/unit/client-note-and-worker.test.ts
# Expected:
# - TEST-SEC-001 PASS: Serialized network payload contains 0 bytes of raw nullifier or trapdoor
# - AES-GCM-256 encryption & .json backup import/export roundtrip PASS
# - TEST-ZK-001 / NFR-003 PASS: Full witness + Groth16 proof generated in <= 2,200ms
```

**Phase 4: Manual Verification**
1. Inspect the JSON output of `exportNoteBackupJson(note)` and verify it contains `version: "refract-zkapi-note-v1"`, `commitmentHex`, `nullifierHashHex`, and encrypted/bearer payload fields.
2. Confirm `durationMs` logged by `proverClient.ts` is `< 2,200ms`.

#### Deliverables Checklist
- [ ] **Code**: `src/lib/zkapi/clientNoteVault.ts`, `src/lib/zkapi/merklePathBuilder.ts`, `src/lib/zkapi/prover.worker.ts`, `src/lib/zkapi/proverClient.ts`
- [ ] **Tests**: `tests/unit/client-note-and-worker.test.ts` (`TEST-SEC-001`, `TEST-ZK-001`, `NFR-003`)
- [ ] **Verification**: Zero secret leakage and `<= 2,200ms` proof generation verified
- [ ] **Git**: Commit created `feat(zkapi-client): step 3.1 local note vault aes-gcm backup and webworker snarkjs prover`

#### Definition of Done (STRICT)
✅ Code compiles without TypeScript errors
✅ `TEST-SEC-001` confirms raw `nullifier` and `trapdoor` never appear in outbound API payloads (`NFR-005`)
✅ `TEST-ZK-001` confirms proof generation completes in `<= 2,200ms` (`NFR-003`)
✅ Encrypted backup export and import roundtrip passes 100%
✅ `progress.md` updated with completion status and prover duration
✅ Git commit created with format: `feat(zkapi-client): step 3.1 local note vault and webworker prover`

#### Common Issues & Solutions
**Issue 1**: `crypto.subtle` is undefined in non-HTTPS or older Node test environments.
**Solution**: Use `globalThis.crypto.subtle` (natively available in Node 20/22 LTS and all modern browsers).

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 3.1 - Implement Client Local Note Vault & WebWorker snarkjs Prover
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: TypeScript 5.7.3, snarkjs 0.7.6, circomlibjs 0.1.7, WebCrypto AES-GCM-256
- Objective: Build `src/lib/zkapi/clientNoteVault.ts`, `src/lib/zkapi/merklePathBuilder.ts`, and `src/lib/zkapi/proverClient.ts` to generate local zkAPI notes, encrypt backups, and compute Groth16 BN254 proofs in <= 2,200ms with 0 secret bytes leaked (`R-004`, `R-005`, `NFR-003`, `NFR-005`).

PREREQUISITES:
- Milestone 2 completed.
- `public/circuits/refract_note_spend.wasm` and `public/circuits/refract_note_spend_final.zkey` present.

BUILD INSTRUCTIONS:
1. Create `src/lib/zkapi/clientNoteVault.ts`:
   - Generate 31-byte random `nullifier` and `trapdoor`.
   - Compute `commitmentHex`, `nullifierHashHex`, and `sessionPubkeyHashHex`.
   - Implement WebCrypto AES-GCM-256 encryption/decryption and `.json` backup export/import.

2. Create `src/lib/zkapi/merklePathBuilder.ts` and `src/lib/zkapi/proverClient.ts`:
   - Build depth-20 Merkle sibling path (`pathElements[20]`, `pathIndices[20]`) from public `leaves[]`.
   - Run `snarkjs.groth16.fullProve()` and format the 256-byte big-endian G1-negated `proofHex` via `serializeGroth16ProofForSolana()`.

3. Create `tests/unit/client-note-and-worker.test.ts`:
   - Test case 1 (`TEST-SEC-001`): Assert serialized proof request payload contains 0 occurrences of raw `nullifier` or `trapdoor`.
   - Test case 2 (`TEST-ZK-001` / `NFR-003`): Generate full Groth16 proof and assert `durationMs <= 2200` and `proofHex.length === 514` (`0x` + 512 hex chars).
   - Test case 3: Verify AES-GCM encrypt/decrypt and `.json` backup restore roundtrip.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Unit & Security tests:
   ```bash
   npx vitest run tests/unit/client-note-and-worker.test.ts
   ```
   Expected output: 3 passed, proof duration <= 2,200ms, 0 secret bytes in network payload.

DEFINITION OF DONE:
- [ ] Local note vault, path builder, and prover client implemented
- [ ] All 3 unit & security test cases pass
- [ ] `progress.md` updated and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from Vitest
3. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 3.2: Implement On-Chain ZK Verification Service & `POST /api/v1/zkapi/runtime-key` (`R-006`, `R-008`)
**Duration**: 55 minutes
**Objective**: Build the backend Solana ZK verification service (`src/lib/zkapi/solanaVerifier.ts`) and `POST /api/v1/zkapi/runtime-key` endpoint (`R-006`, `R-008`, `R-013`) that submits `settle_zk_spend` to the Solana Anchor `RefractVault` program, verifies the Groth16 BN254 proof on-chain in `<= 140,000 CU`, initializes the `NullifierRecord` PDA, and mints an unlinkable `rk_live_zk_*` Runtime Key loaded with the note's principal plus the active **DeFi Yield Subsidy Bonus (`+8.4%`)**.
**Risk**: Medium - Handling concurrent root rotations via `ZkYieldVault.root_history` (`BR-05`) and rejecting replayed `nullifierHashHex` values (`SEC-01`) with `HTTP 409 ERR_NULLIFIER_ALREADY_SPENT`.
**Prerequisites**: Step 3.1 completed.
**Testing Type**: Integration + Solana Localnet & Devnet Verification (`TEST-CHAIN-002`, `R-006`, `R-008`, `SEC-01`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 3.1 (`ADR-002`) & Section 3.5 (`src/lib/zkapi/solanaVerifier.ts`)
- **Requirements**: `/blueprint/srd.md` → `R-006`, `R-008`, `R-009`, `R-013`, `NFR-004`, `SEC-01`
- **Dependencies**: Step 1.3 (`settle_zk_spend`), Step 3.1 (`proverClient.ts`)
- **Related Tests**: `tests/integration/runtime-key-mint.test.ts`

#### What to Build
1. `src/lib/zkapi/solanaVerifier.ts`:
   - Parses `proofHex` (256 bytes: `proof_a[64]`, `proof_b[128]`, `proof_c[64]`) and the 4 public inputs (`[merkleRootHex, nullifierHashHex, spendCapMicroUsdc, sessionPubkeyHashHex]`).
   - Checks PostgreSQL `zk_runtime_sessions` for existing `nullifier_hash_hex` (fast-fail `409 ERR_NULLIFIER_ALREADY_SPENT` before spending Solana gas, `SEC-01`).
   - Submits `settle_zk_spend` to the Solana Anchor `RefractVault` program using `SOLANA_RELAYER_PRIVATE_KEY_BASE58` (`confirmed` commitment) and extracts `computeUnitsUsed` from transaction metadata.
   - Reads the current `subsidy_bonus_bps` (`840` = `+8.4%`) from `defi_vault_snapshots`, computes `yieldSubsidyMicroUsdc = Math.floor(spendCapMicroUsdc * (subsidy_bonus_bps / 10000))`, and `effectiveBalanceMicroUsdc = spendCapMicroUsdc + yieldSubsidyMicroUsdc` (`GAP-003`, `R-009`).
   - Generates `runtimeKey = "rk_live_zk_" + randomBytes(24).toString("hex")`, inserts its `SHA-256` hash into `zk_runtime_sessions` (with `max_per_request_micro_usdc` from request, default `100_000`), and caches the active session in Upstash Redis.
2. `src/app/api/v1/zkapi/runtime-key/route.ts`:
   - Next.js 15 POST handler matching `blueprint/openapi.yaml` (`/zkapi/runtime-key`).

#### Build Instructions (Atomic Steps)
1. Create `src/lib/zkapi/solanaVerifier.ts` connecting to the Anchor `RefractVault` IDL and submitting `settle_zk_spend`.
2. Create `src/app/api/v1/zkapi/runtime-key/route.ts` with Zod schema validation and error mapping (`ERR_NULLIFIER_ALREADY_SPENT`, `ERR_STALE_MERKLE_ROOT`, `ERR_INVALID_GROTH16_PROOF`).
3. Write `tests/integration/runtime-key-mint.test.ts` to test the full flow from `deposit_and_commit` $\rightarrow$ `GET /api/v1/zkapi/tree` $\rightarrow$ `proverClient.proveNoteSpend()` $\rightarrow$ `POST /api/v1/zkapi/runtime-key` on both Localnet and Solana Devnet.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Localnet & Integration Tests**
```bash
npx vitest run tests/integration/runtime-key-mint.test.ts
# Expected:
# - Valid Groth16 proof verified on Solana via /api/v1/zkapi/runtime-key
# - computeUnitsUsed <= 140,000 CU (NFR-004)
# - effectiveBalanceMicroUsdc === 10_840_000 (10.00 USDC principal + 0.84 USDC DeFi yield subsidy)
# - Replayed nullifierHashHex returns HTTP 409 ERR_NULLIFIER_ALREADY_SPENT (SEC-01)
```

**Phase 2: Solana Devnet Verification**
```bash
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx vitest run tests/integration/runtime-key-mint.test.ts
# Expected: POST /api/v1/zkapi/runtime-key verifies Groth16 proof on Solana Devnet and returns solanaVerifyTxSig
```

**Phase 4: Manual Verification**
1. Inspect the returned `solanaVerifyTxSig` on Solana Devnet Explorer and confirm `NullifierRecord` PDA creation.
2. Query PostgreSQL `zk_runtime_sessions` and verify `principal_micro_usdc = 10000000`, `yield_subsidy_micro_usdc = 840000`, `remaining_micro_usdc = 10840000`, and that `0` columns reference `intent_deposits` (`SEC-04`).

#### Deliverables Checklist
- [ ] **Code**: `src/lib/zkapi/solanaVerifier.ts` and `src/app/api/v1/zkapi/runtime-key/route.ts`
- [ ] **Tests**: `tests/integration/runtime-key-mint.test.ts` (`TEST-CHAIN-002`, `R-006`, `R-008`, `SEC-01`)
- [ ] **Verification**: Full client-prover-to-Solana-Anchor-to-Runtime-Key pipeline verified on Localnet and Devnet
- [ ] **Git**: Commit created `feat(zkapi-mint): step 3.2 on-chain groth16 verification and runtime-key mint api`

#### Definition of Done (STRICT)
✅ `POST /api/v1/zkapi/runtime-key` verifies real Groth16 proofs on Solana in `<= 140,000 CU` (`R-006`, `NFR-004`)
✅ DeFi yield subsidy bonus (`+8.4%`) automatically credited to `effectiveBalanceMicroUsdc` (`R-009`, `GAP-003`)
✅ Replayed nullifiers rejected with `HTTP 409 ERR_NULLIFIER_ALREADY_SPENT` (`SEC-01`)
✅ **[Web3 ONLY]** Verified against live Solana Devnet `RefractVault` program
✅ `progress.md` updated with completion status and Devnet verification tx signature
✅ Git commit created with format: `feat(zkapi-mint): step 3.2 runtime-key mint endpoint and solana verifier`

#### Common Issues & Solutions
**Issue 1**: Solana RPC simulation fails with `BlockhashNotFound` if cached blockhash is stale.
**Solution**: Fetch a fresh blockhash via `connection.getLatestBlockhash('confirmed')` immediately prior to signing `settle_zk_spend`.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 3.2 - Implement On-Chain ZK Verification Service & POST /api/v1/zkapi/runtime-key
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Next.js 15.2.4, Anchor 1.2.2, @solana/web3.js 1.99.0, groth16-solana 0.2.0, PostgreSQL 16, Upstash Redis 7.2
- Objective: Build `src/lib/zkapi/solanaVerifier.ts` and `POST /api/v1/zkapi/runtime-key` to verify client Groth16 BN254 proofs on Solana in <= 140,000 CU and mint spend-capped `rk_live_zk_*` Runtime Keys with +8.4% DeFi yield subsidy (`R-006`, `R-008`, `R-009`, `SEC-01`).

PREREQUISITES:
- Step 3.1 completed.

BUILD INSTRUCTIONS:
1. Create `src/lib/zkapi/solanaVerifier.ts`:
   - Check `zk_runtime_sessions` for existing `nullifier_hash_hex`; throw `ERR_NULLIFIER_ALREADY_SPENT` (409) if found (`SEC-01`).
   - Slice 256-byte `proofHex` into `proof_a` (64B), `proof_b` (128B), `proof_c` (64B) and submit `settle_zk_spend` to Solana `RefractVault`.
   - Assert transaction succeeds and record `computeUnitsUsed`.
   - Compute `yieldSubsidyMicroUsdc` from `defi_vault_snapshots.subsidy_bonus_bps` (`840` bps = `+8.4%`).
   - Mint `rk_live_zk_<hex>`, store `SHA-256` hash in `zk_runtime_sessions` and Redis, and return `{ runtimeKey, solanaVerifyTxSig, computeUnitsUsed, effectiveBalanceMicroUsdc }`.

2. Create `src/app/api/v1/zkapi/runtime-key/route.ts`:
   - Validate request body matching `blueprint/openapi.yaml` and return `200 OK`.

3. Create `tests/integration/runtime-key-mint.test.ts`:
   - Test case 1: Generate a real proof via `proverClient`, call `POST /api/v1/zkapi/runtime-key`, and assert `200 OK`, `computeUnitsUsed <= 140000`, and `effectiveBalanceMicroUsdc === 10_840_000`.
   - Test case 2 (`SEC-01`): Replay the same request and assert `409 ERR_NULLIFIER_ALREADY_SPENT`.
   - Test case 3: Pass an corrupted proof byte and assert `400 ERR_INVALID_GROTH16_PROOF`.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Localnet & Devnet Integration tests:
   ```bash
   npx vitest run tests/integration/runtime-key-mint.test.ts
   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx vitest run tests/integration/runtime-key-mint.test.ts
   ```
   Expected output: All 3 test cases pass on Localnet and Devnet; CU <= 140,000.

DEFINITION OF DONE:
- [ ] `solanaVerifier.ts` and `/api/v1/zkapi/runtime-key` implemented
- [ ] Verified on Solana Devnet with real Groth16 proof
- [ ] `progress.md` updated and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from Vitest and Devnet tx signature
3. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 3.3: Implement Dual-Scheme `x402` v2 Gateway Middleware (`<= 15ms`) & Schnorr Usage Receipt Signer (`R-007`, `R-008`, `R-016`)
**Duration**: 55 minutes
**Objective**: Build the `x402` v2 HTTP Gateway Middleware (`src/lib/x402/gatewayMiddleware.ts`) and Schnorr/Ed25519 Usage Receipt Signer (`src/lib/x402/schnorrReceiptSigner.ts`) that challenges unpaid HTTP requests with `HTTP 402 Payment Required` (`PAYMENT-REQUIRED` header, `<= 50ms`) and verifies `PAYMENT-SIGNATURE` headers (`zkapi-runtime-key`, `zkapi-groth16-bn254`, and `solana-spl`) in `<= 15ms` (p95, `NFR-001`), emitting cryptographic `X-ZKAPI-RECEIPT` headers (`R-007`, `R-008`, `R-016`).
**Risk**: Low - Ensuring `Server-Timing: x402-verify-dur;dur=<ms>` is accurately recorded and that `0 bytes` of buyer wallet identity are ever forwarded to merchant handlers (`NFR-005`).
**Prerequisites**: Step 3.2 completed.
**Testing Type**: Unit, API Contract & `k6` / Concurrent Latency Benchmark (`TEST-API-001`, `TEST-API-002`, `TEST-PERF-001`, `NFR-001`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 3.4 (API Design) & Section 3.5 (`src/lib/x402/gatewayMiddleware.ts`)
- **Requirements**: `/blueprint/srd.md` → `R-007`, `R-008`, `R-013`, `R-016`, `NFR-001`, `NFR-005`, `SEC-04`
- **Dependencies**: Step 0.3 (`runtimeKeyMeter.ts`), Step 3.2 (`solanaVerifier.ts`)
- **Related Tests**: `tests/integration/x402-gateway-and-receipts.test.ts`, `tests/load/x402_verify.test.ts`

#### What to Build
1. `src/lib/x402/schnorrReceiptSigner.ts`:
   - Signs deterministic usage receipts over ` message = Poseidon/SHA256(sessionId || requestCorrelationId || chargedMicroUsdc || remainingMicroUsdc || timestamp)` using `ZKAPI_SCHNORR_SIGNING_PRIVATE_KEY_HEX`.
   - Provides `verifySchnorrUsageReceipt(receiptHeader, publicKeyHex)` so clients and the Double-Blind Inspector UI can verify every receipt mathematically (`R-008`).
2. `src/lib/x402/gatewayMiddleware.ts`:
   - Looks up endpoint pricing in `x402_merchants` (e.g., `/api/v1/ai/chat` = `15,000 micro-USDC` = `$0.015`).
   - **If `PAYMENT-SIGNATURE` header is absent:** Returns `HTTP 402 Payment Required` in `<= 50ms` with base64-encoded `PAYMENT-REQUIRED` JSON header:
     ```json
     {
       "version": "2.0",
       "network": "solana-mainnet-beta",
       "priceMicroUsdc": 15000,
       "payTo": "RefractAiMerchant111111111111111111111111111",
       "schemes": ["zkapi-runtime-key", "zkapi-groth16-bn254", "solana-spl"],
       "zkapiVaultProgramId": "<NEXT_PUBLIC_REFRACT_VAULT_PROGRAM_ID>",
       "auroraIntentsQuoteEndpoint": "/api/v1/intents/quote"
     }
     ```
   - **If `PAYMENT-SIGNATURE` is present:**
     - Decodes base64 JSON payload `{ scheme, token, proof, ... }`.
     - Executes `authorizeAndDeductRuntimeKey(token, priceMicroUsdc)` (`<= 15ms` p95, `NFR-001`).
     - Strips all client IP headers (`x-forwarded-for`, `x-real-ip`) and attaches `walletBytesReceived: 0` proof telemetry (`SEC-04`, `NFR-005`).
     - Signs the receipt, inserts into `x402_usage_receipts`, credits the merchant's `defi_staked_micro_usdc` (90%) and `liquid_balance_micro_usdc` (10%), and sets response headers `X-ZKAPI-RECEIPT`, `X-Correlation-Id`, and `Server-Timing: x402-verify-dur;dur=<ms>`.

#### Build Instructions (Atomic Steps)
1. Create `src/lib/x402/schnorrReceiptSigner.ts` implementing receipt signing and verification.
2. Create `src/lib/x402/gatewayMiddleware.ts` implementing the `withX402Gate(handler, endpointPattern)` wrapper.
3. Write `tests/integration/x402-gateway-and-receipts.test.ts` and `tests/load/x402_verify.test.ts` testing:
   - Unpaid request returning `HTTP 402` with valid base64 `PAYMENT-REQUIRED` header in `<= 50ms` (`TEST-API-001`).
   - Paid request with `rk_live_*` succeeding in `<= 15ms` (p95 across 100 rapid requests, `TEST-PERF-001`, `NFR-001`) and returning a valid `X-ZKAPI-RECEIPT` signature (`TEST-API-002`).
   - Merchant balance automatically splitting 90% into `defi_staked_micro_usdc` and 10% into `liquid_balance_micro_usdc` (`R-009`).

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Gateway Contract, Receipt Signature & Latency Benchmark Tests**
```bash
npx vitest run tests/integration/x402-gateway-and-receipts.test.ts tests/load/x402_verify.test.ts
# Expected:
# - TEST-API-001 PASS: Missing PAYMENT-SIGNATURE returns HTTP 402 + base64 PAYMENT-REQUIRED in < 10ms
# - TEST-API-002 PASS: Valid PAYMENT-SIGNATURE returns HTTP 200 + verified X-ZKAPI-RECEIPT Schnorr signature
# - TEST-PERF-001 (NFR-001) PASS: 100 sequential/concurrent verifications complete with p95 <= 15ms
```

**Phase 4: Manual Verification**
1. Decode the base64 `PAYMENT-REQUIRED` header from a `402` response and verify it lists `"zkapi-runtime-key"`, `"zkapi-groth16-bn254"`, and `"solana-spl"`.
2. Inspect `Server-Timing` header on a `200` response and confirm `x402-verify-dur` is `<= 15ms`.

#### Deliverables Checklist
- [ ] **Code**: `src/lib/x402/schnorrReceiptSigner.ts` and `src/lib/x402/gatewayMiddleware.ts`
- [ ] **Tests**: `tests/integration/x402-gateway-and-receipts.test.ts`, `tests/load/x402_verify.test.ts` (`TEST-API-001`, `TEST-API-002`, `TEST-PERF-001`)
- [ ] **Verification**: `HTTP 402` challenge, Schnorr receipt verification, and `p95 <= 15ms` latency verified
- [ ] **Git**: Commit created `feat(x402-gateway): step 3.3 dual-scheme x402 v2 middleware and schnorr usage receipts`

#### Definition of Done (STRICT)
✅ Unpaid calls return `HTTP 402` with `PAYMENT-REQUIRED` header in `<= 50ms` (`R-007`, `TEST-API-001`)
✅ `zkapi-runtime-key` verification completes in `<= 15ms` at p95 (`R-008`, `R-016`, `NFR-001`, `TEST-PERF-001`)
✅ Every paid response includes a cryptographically verifiable `X-ZKAPI-RECEIPT` header (`TEST-API-002`)
✅ Merchant revenue auto-splits 90/10 into DeFi staked float (`R-009`)
✅ `progress.md` updated with p95 verification latency
✅ Git commit created with format: `feat(x402-gateway): step 3.3 x402 v2 middleware and schnorr receipts`

#### Common Issues & Solutions
**Issue 1**: Base64 padding differences (`=` vs base64url) in `PAYMENT-SIGNATURE` headers sent by different HTTP clients.
**Solution**: Normalize incoming base64 strings via `Buffer.from(header.trim(), 'base64').toString('utf8')` which handles both standard base64 and base64url in Node.js.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 3.3 - Implement Dual-Scheme x402 v2 Gateway Middleware & Schnorr Receipts
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Next.js 15.2.4, TypeScript 5.7.3, Upstash Redis 7.2, PostgreSQL 16
- Objective: Build `src/lib/x402/schnorrReceiptSigner.ts` and `src/lib/x402/gatewayMiddleware.ts` to challenge unpaid requests with HTTP 402 (`PAYMENT-REQUIRED`) and verify `PAYMENT-SIGNATURE` headers in <= 15ms p95 with signed `X-ZKAPI-RECEIPT` headers (`R-007`, `R-008`, `R-016`, `NFR-001`).

PREREQUISITES:
- Step 3.2 completed.

BUILD INSTRUCTIONS:
1. Create `src/lib/x402/schnorrReceiptSigner.ts`:
   - Implement `signUsageReceipt({ sessionId, correlationId, chargedMicroUsdc, remainingMicroUsdc })` and `verifyUsageReceipt(signatureHex, payload)`.

2. Create `src/lib/x402/gatewayMiddleware.ts`:
   - Implement `withX402Gate(handler, endpointPattern)`:
     - Return `HTTP 402` + base64 `PAYMENT-REQUIRED` header if `PAYMENT-SIGNATURE` is missing (`R-007`).
     - Verify `zkapi-runtime-key` via `authorizeAndDeductRuntimeKey()` in <= 15ms (`R-008`, `R-016`).
     - Strip all IP/wallet headers before invoking `handler` (`SEC-04`, `NFR-005`).
     - If `handler` throws or returns status >= 500, call `rollbackRuntimeKeyCharge()` (`R-011`).
     - Attach `X-ZKAPI-RECEIPT`, `X-Correlation-Id`, and `Server-Timing: x402-verify-dur;dur=<ms>`.

3. Create `tests/integration/x402-gateway-and-receipts.test.ts` and `tests/load/x402_verify.test.ts`:
   - Test case 1 (`TEST-API-001`): Unauthenticated call returns `402` and valid base64 `PAYMENT-REQUIRED`.
   - Test case 2 (`TEST-API-002`): Authenticated call returns `200`, decrements `15_000` micro-USDC, and `verifyUsageReceipt()` returns `true`.
   - Test case 3 (`TEST-PERF-001` / `NFR-001`): Run 100 benchmark iterations and assert p95 verification duration <= 15ms.
   - Test case 4: Simulate upstream `502` handler error and assert `15_000` micro-USDC is rolled back automatically.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Integration & Load Benchmark tests:
   ```bash
   npx vitest run tests/integration/x402-gateway-and-receipts.test.ts tests/load/x402_verify.test.ts
   ```
   Expected output: All tests pass, p95 verify duration <= 15ms.

DEFINITION OF DONE:
- [ ] `schnorrReceiptSigner.ts` and `gatewayMiddleware.ts` implemented
- [ ] All contract, rollback, and p95 <= 15ms performance tests pass
- [ ] `progress.md` updated and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from Vitest including p95 latency number
3. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 3.4: Implement Protected `POST /api/v1/ai/chat`, Agent Spend Policy Firewall & Zero-Leakage Unlinkability Suite
**Duration**: 55 minutes
**Objective**: Build the `x402`-protected AI inference router (`src/lib/ai/inferenceRouter.ts`) and `POST /api/v1/ai/chat` endpoint (`R-012`, `R-013`, `R-015`) with automatic OpenAI (`gpt-4o-mini`) $\rightarrow$ Anthropic (`claude-3-5-sonnet`) failover, Bounded Agent Spend Policy Firewall enforcement, and the 20-case AI Agent & Unlinkability verification suite (`TEST-SEC-001`, `TEST-SEC-002`, `TEST-AI-001`).
**Risk**: Low - Ensuring graceful deterministic fallback in CI/test mode if external OpenAI/Anthropic API keys are rate-limited, while never logging `messages[]` or wallet bytes (`SEC-04`).
**Prerequisites**: Step 3.3 completed.
**Testing Type**: Security Unlinkability, Adversarial Firewall & AI Agent Benchmark (`TEST-SEC-001`, `TEST-SEC-002`, `TEST-AI-001`)

#### Context & References
- **Design Doc**: `/blueprint/design-spec.md` → Section 3.6 (OpenAI & Anthropic APIs) & Section 3.7 (AI Prompt-Injection Defenses)
- **Requirements**: `/blueprint/srd.md` → Section 9.1 (AI Module), `R-012`, `R-013`, `R-015`, `NFR-005`, `SEC-03`, `SEC-04`
- **Dependencies**: Step 3.3 (`gatewayMiddleware.ts`)
- **Related Tests**: `tests/security/unlinkability.test.ts`, `tests/ai/x402_agent_eval.test.ts`

#### What to Build
1. `src/lib/ai/inferenceRouter.ts`:
   - Routes `gpt-4o-mini` (`gpt-4o-mini-2024-07-18`) and `claude-3-5-sonnet` (`claude-3-5-sonnet-20241022`) requests with a `1,500ms` TTFT timeout and `max_tokens: 1024` cost cap (`G-02`).
   - Automatically fails over from OpenAI to Anthropic on `HTTP 429` or `5xx`.
   - Strips all identifying headers and never logs `messages[]` (`SEC-04`).
2. `src/app/api/v1/ai/chat/route.ts`:
   - Wrapped with `withX402Gate(handler, '/api/v1/ai/chat')` (supports a header or body flag `x-simulate-endpoint-cost-micro-usdc` so the UI's **"Simulate `$2.50` Prompt-Injection Attack"** button triggers a real `HTTP 403 ERR_SPEND_CAP_EXCEEDED` firewall rejection on demand, `R-013`).
   - Returns `{ reply, chargedMicroUsdc, remainingMicroUsdc, schnorrSignatureHex, walletBytesReceived: 0 }` + `X-ZKAPI-RECEIPT` header matching `blueprint/openapi.yaml`.
3. `tests/security/unlinkability.test.ts` & `tests/ai/x402_agent_eval.test.ts`:
   - Verifies `0 bytes` of origin EOA (`0x71C9...`), Solana pubkey, or raw `nullifier` appear anywhere in the HTTP headers, body, or database logs of `/api/v1/ai/chat` (`TEST-SEC-001`, `NFR-005`).
   - Runs the 20-case autonomous `x402` agent evaluation benchmark (`TEST-AI-001`) verifying `>= 95%` accuracy across `HTTP 402` challenge parsing, Runtime Key payment retry, `$2.50` prompt-injection spend-cap refusal (`TEST-SEC-002`), and upstream `5xx` balance rollback.

#### Build Instructions (Atomic Steps)
1. Create `src/lib/ai/inferenceRouter.ts` with OpenAI primary call, Anthropic fallback, and `1,024` max token cap.
2. Create `src/app/api/v1/ai/chat/route.ts` wrapped in `withX402Gate`.
3. Create `tests/security/unlinkability.test.ts` (`TEST-SEC-001`, `TEST-SEC-002`) and `tests/ai/x402_agent_eval.test.ts` (`TEST-AI-001`).
4. Run the security and AI benchmark test suites and verify `100%` pass rate.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Security Unlinkability & AI Agent Evaluation Suite**
```bash
npx vitest run tests/security/unlinkability.test.ts tests/ai/x402_agent_eval.test.ts
# Expected:
# - TEST-SEC-001 (NFR-005) PASS: 0 bytes of origin wallet, Solana wallet, or IP leaked to merchant handler or DB
# - TEST-SEC-002 (R-013) PASS: $2.50 simulated prompt-injection blocked with HTTP 403 ERR_SPEND_CAP_EXCEEDED
# - TEST-AI-001 PASS: 20/20 (100% >= 95% threshold) agent evaluation scenarios pass
```

**Phase 2: Local API Server End-to-End Check**
```bash
# 1. Unpaid call -> 402 challenge
curl -i -X POST http://localhost:3000/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Audit Kamino vault risks."}]}'
# Expected: HTTP 402 Payment Required + PAYMENT-REQUIRED header

# 2. Paid call with Runtime Key -> 200 OK + Schnorr Receipt
curl -i -X POST http://localhost:3000/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: $(echo -n '{"scheme":"zkapi-runtime-key","token":"<ACTIVE_RK_TOKEN>"}' | base64 -w0)" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Audit Kamino vault risks."}]}'
# Expected: HTTP 200 OK with X-ZKAPI-RECEIPT header, chargedMicroUsdc: 15000, walletBytesReceived: 0
```

**Phase 4: Manual Verification**
1. Send a request to `/api/v1/ai/chat` with header `X-Simulate-Endpoint-Cost-Micro-Usdc: 2500000` (`$2.50`) using a default `$0.10`-capped Runtime Key and confirm `HTTP 403` returns `{ "code": "ERR_SPEND_CAP_EXCEEDED" }`.

#### Deliverables Checklist
- [ ] **Code**: `src/lib/ai/inferenceRouter.ts` and `src/app/api/v1/ai/chat/route.ts`
- [ ] **Tests**: `tests/security/unlinkability.test.ts` (`TEST-SEC-001`, `TEST-SEC-002`) and `tests/ai/x402_agent_eval.test.ts` (`TEST-AI-001`)
- [ ] **Verification**: `0` wallet bytes leaked and `20/20` AI agent benchmark scenarios pass
- [ ] **Git**: Commit created `feat(ai-x402): step 3.4 protected ai chat router spend firewall and unlinkability suite`

#### Definition of Done (STRICT)
✅ `POST /api/v1/ai/chat` enforces `HTTP 402` challenge and settles unlinkable `zkAPI` calls in `<= 15ms` (`R-007`, `R-012`)
✅ `TEST-SEC-001` verifies `walletBytesReceived === 0` (`NFR-005`)
✅ `TEST-SEC-002` verifies `$2.50` prompt-injection attack is blocked by `$0.10` cap (`R-013`)
✅ `TEST-AI-001` passes `>= 95%` (`20/20`) on the synthetic agent evaluation benchmark
✅ `progress.md` updated with Milestone 3 completion summary
✅ Git commit created with format: `feat(ai-x402): step 3.4 complete m3 x402 gateway and ai agent firewall`

#### Common Issues & Solutions
**Issue 1**: Running the 20-case `x402_agent_eval.test.ts` in CI without live OpenAI credits.
**Solution**: `inferenceRouter.ts` automatically uses a deterministic local cryptographic audit responder when `OPENAI_API_KEY` is set to `"sk-test-local"` while exercising 100% of the real `x402`, Redis/Postgres metering, Schnorr signing, and firewall code paths.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 3.4 - Implement Protected POST /api/v1/ai/chat, Spend Firewall & Unlinkability Suite
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Next.js 15.2.4, OpenAI gpt-4o-mini, Anthropic claude-3-5-sonnet, Vitest
- Objective: Build `src/lib/ai/inferenceRouter.ts` and `POST /api/v1/ai/chat` wrapped with `withX402Gate`, plus `tests/security/unlinkability.test.ts` (`TEST-SEC-001`, `TEST-SEC-002`) and the 20-case `tests/ai/x402_agent_eval.test.ts` (`TEST-AI-001`).

PREREQUISITES:
- Steps 3.1, 3.2, and 3.3 completed.

BUILD INSTRUCTIONS:
1. Create `src/lib/ai/inferenceRouter.ts`:
   - Route `gpt-4o-mini` (primary) and `claude-3-5-sonnet` (fallback on 429/5xx or >1500ms timeout) with `max_tokens: 1024`.
   - Ensure zero logging of `messages[]` or client headers (`SEC-04`).

2. Create `src/app/api/v1/ai/chat/route.ts`:
   - Wrap with `withX402Gate`.
   - Support optional `x-simulate-endpoint-cost-micro-usdc` header so UI/tests can trigger a real `$2.50` prompt-injection spend-cap rejection (`HTTP 403 ERR_SPEND_CAP_EXCEEDED`, `R-013`).
   - Return `{ reply, chargedMicroUsdc, remainingMicroUsdc, schnorrSignatureHex, walletBytesReceived: 0 }`.

3. Create `tests/security/unlinkability.test.ts` and `tests/ai/x402_agent_eval.test.ts`:
   - `TEST-SEC-001`: Execute full deposit -> Groth16 mint -> `/api/v1/ai/chat` flow and assert 0 bytes of origin wallet (`0x71C9...`), Solana pubkey, or raw nullifier exist in the merchant request or `x402_usage_receipts`.
   - `TEST-SEC-002`: Send simulated `$2.50` prompt-injection call against a `$0.10` cap; assert `403 ERR_SPEND_CAP_EXCEEDED` and `0` balance deducted.
   - `TEST-AI-001`: Run 20-case agent benchmark (402 parse, proof retry, spend-cap block, model fallback, 5xx rollback) and assert >= 95% pass rate.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Security & AI Evaluation tests:
   ```bash
   npx vitest run tests/security/unlinkability.test.ts tests/ai/x402_agent_eval.test.ts
   ```
   Expected output: All tests pass (0 bytes leaked, 20/20 agent benchmark pass).

DEFINITION OF DONE:
- [ ] `inferenceRouter.ts` and `/api/v1/ai/chat` implemented
- [ ] `TEST-SEC-001`, `TEST-SEC-002`, and `TEST-AI-001` pass 100%
- [ ] `progress.md` updated and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from Vitest
3. Confirmation that Milestone 3 is 100% complete
═══════════════════════════════════════════════════════════════
```

#### Progress Tracking Update
After completing Step 3.4, add this entry to `progress.md`:

```markdown
### ✅ Milestone 3: Client ZK Prover, `x402` Gateway, Schnorr Receipts & Agent Firewall (Steps 3.1 – 3.4) - COMPLETED

**Date**: 2026-11-07
**Duration**: 3.7 Hours
**Status**: ✅ COMPLETE

**What Was Built**:
- `src/lib/zkapi/clientNoteVault.ts` & `proverClient.ts`: Local Poseidon note generator, WebCrypto AES-GCM-256 backup vault, and WebWorker `snarkjs` Groth16 prover (`<= 2,200ms`, `0` secret bytes leaked).
- `src/lib/zkapi/solanaVerifier.ts` & `POST /api/v1/zkapi/runtime-key`: On-chain Solana Groth16 verification (`<= 140k CU`) minting `rk_live_zk_*` Runtime Keys with `+8.4%` DeFi yield subsidy.
- `src/lib/x402/gatewayMiddleware.ts` & `schnorrReceiptSigner.ts`: HTTP 402 v2 gateway verifying Runtime Keys in `<= 15ms` p95 and signing `X-ZKAPI-RECEIPT` headers.
- `src/lib/ai/inferenceRouter.ts` & `POST /api/v1/ai/chat`: Protected AI endpoint with OpenAI/Anthropic failover and Bounded Agent Spend Policy Firewall (`$0.10/req` cap).

**Tests Executed**:
- Security Unlinkability Tests: ✅ Passed (`TEST-SEC-001` `0` wallet bytes leaked, `TEST-SEC-002` firewall block)
- Performance Benchmark: ✅ Passed (`TEST-PERF-001` `p95 <= 15ms`)
- AI Agent Evaluation Suite: ✅ Passed (`TEST-AI-001` `20/20` scenarios passed)

**Next Step**: Milestone 4 (Step 4.1) - Build Dark Prism UI Screens (`/studio`, `/playground`, `/merchant`) & Double-Blind Privacy Inspector
```

---
---

## MILESTONE 4: DARK PRISM UI, MAINNET MICRO-LIQUIDITY DEMO & FINAL DEPLOYMENT (7.0 Hours / 420 Minutes)

This final milestone builds the production **Refract Studio** frontend across all 3 routes (`/studio`, `/playground`, `/merchant`) adhering strictly to `blueprint/ui-spec.md` and `blueprint/design-tokens.json`, verifies WCAG 2.2 Level AA accessibility and E2E Playwright flows (`TEST-E2E-001`, `TEST-E2E-002`, `TEST-A11Y-001`), deploys the `RefractVault` program and `$15–$25` USDC micro-liquidity pool to **Solana Mainnet-Beta** (`ADR-006`) for live Aurora Intents execution, and packages the repository, README, and 90-second demo script for dual submission to **Hackathon 1** and **Encode Hackathon 2**.

---

### Step 4.1: Build `/studio` Screen (`PrismDepositCard` + `DefiFloatTelemetryCard`) & Zustand Encrypted Note Store
**Duration**: 55 minutes
**Objective**: Implement the `/studio` screen (`src/app/studio/page.tsx`) with `PrismDepositCard`, `DefiFloatTelemetryCard`, and the Zustand client state store (`src/lib/store/useRefractStore.ts`) connecting 35+-chain Aurora Intents quotes (`R-001`, `R-002`, `R-014`), local Poseidon note generation + automatic `.json` backup download (`R-004`), `<400ms` optimistic credit activation (`R-010`), and live 90/10 Solana DeFi yield telemetry (`R-009`).
**Risk**: Low - Ensuring popup/download blockers do not prevent the user from saving their `.json` note backup before broadcasting their deposit transaction (`ui-spec.md` Section 1 Risk 1).
**Prerequisites**: Milestone 3 completed.
**Testing Type**: Component Unit, Playwright E2E & Accessibility Testing (`TEST-E2E-001`, `TEST-A11Y-001`)

#### Context & References
- **Design Doc**: `/blueprint/ui-spec.md` → Section 5 (Atomic Components #1–#12) & Section 6.1 (Screen 1 `/studio` Wireframe)
- **Requirements**: `/blueprint/srd.md` → `R-001`, `R-002`, `R-003`, `R-004`, `R-009`, `R-010`, `R-014`, `R-017`
- **Dependencies**: Step 2.1 (`/api/v1/intents/quote`), Step 2.2 (`/api/v1/intents/optimistic-credit`), Step 3.1 (`clientNoteVault.ts`)
- **Related Tests**: `tests/e2e/studio-deposit.spec.ts`

#### What to Build
1. `src/lib/store/useRefractStore.ts`:
   - Manages active local `zkAPI` note state, active `rk_live_*` Runtime Key, transaction lifecycle state (`1. PREPARED_LOCAL` through `7. REPLACED_OR_REFUNDED` from `ui-spec.md` Section 7.2), and per-request spend policy cap (`default: $0.10`).
2. `src/components/studio/PrismDepositCard.tsx`:
   - Origin chain/asset selector populated from `OneClickService.getTokens()` (`Base USDC`, `Arbitrum USDT`, `Bitcoin BTC`, `NEAR`, `Zcash ZEC`, `Solana USDC`).
   - Deposit amount input (`>= $1.00`), **Aurora Confidential Intents** checkbox (`default: checked`, `R-002`), and transparent `30 bps` integrator fee badge (`R-014`).
   - Primary CTA `"Refract Liquidity & Mint Unlinkable zkAPI Note"` that generates the local Poseidon note, triggers automatic `.json` download (`refract-note-<short_hash>.json`), calls `POST /api/v1/intents/quote`, and upon origin tx broadcast calls `POST /api/v1/intents/optimistic-credit` (`<400ms`).
3. `src/components/studio/DefiFloatTelemetryCard.tsx`:
   - Displays the live Mint (`#34D399`) `<400ms` Optimistic Credit banner, the local Poseidon commitment hash with 1-click copy, and the 90/10 Kamino DeFi float progress bar (`GET /api/v1/defi/vault-stats`, `R-009`).
4. `src/app/studio/page.tsx`:
   - Responsive 12-column desktop / 1-column mobile layout matching `blueprint/prototype/index.html`.

#### Build Instructions (Atomic Steps)
1. Create `src/lib/store/useRefractStore.ts` syncing encrypted note metadata with `clientNoteVault.ts`.
2. Create `src/components/studio/PrismDepositCard.tsx` and `src/components/studio/DefiFloatTelemetryCard.tsx` using exact CSS token variables from `src/app/globals.css`.
3. Mount both components in `src/app/studio/page.tsx` and set `/` (`src/app/page.tsx`) to redirect or render `/studio` as the default landing view.
4. Write and run `tests/e2e/studio-deposit.spec.ts` verifying the deposit quote flow, `.json` backup download event, `<400ms` optimistic credit banner activation, and 0 `axe-core` WCAG 2.2 AA violations.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Playwright E2E & Accessibility Tests**
```bash
npx playwright test tests/e2e/studio-deposit.spec.ts
# Expected:
# - User selects Base USDC ($10.00) with Confidential Mode ON
# - Clicking "Refract Liquidity & Mint Unlinkable zkAPI Note" triggers .json backup download
# - Aurora depositAddress and <400ms Optimistic Credit banner ($5.00 active) render on screen
# - 90/10 DeFi Float split bar displays 90% Kamino / 10% Liquid Reserve and +9.4% APY
# - AxeBuilder WCAG 2.2 AA scan passes with 0 violations at 1440px and 375px
```

**Phase 4: Manual Verification**
1. Open `http://localhost:3000/studio` in browser.
2. Click `"Refract Liquidity & Mint Unlinkable zkAPI Note"` and confirm `refract-note-<hash>.json` downloads automatically and the top-right header pill updates to `"Active zkAPI Note: 5.42 USDC (Optimistic) -> 10.84 USDC (+9.4% APY)"`.

#### Deliverables Checklist
- [ ] **Code**: `src/lib/store/useRefractStore.ts`, `src/components/studio/PrismDepositCard.tsx`, `src/components/studio/DefiFloatTelemetryCard.tsx`, `src/app/studio/page.tsx`
- [ ] **Tests**: `tests/e2e/studio-deposit.spec.ts`
- [ ] **Verification**: Playwright E2E deposit flow and `axe-core` WCAG 2.2 AA scan pass
- [ ] **Git**: Commit created `feat(ui-studio): step 4.1 build /studio prism deposit card and defi float telemetry`

#### Definition of Done (STRICT)
✅ `/studio` renders all components using `blueprint/design-tokens.json` variables
✅ Automatic `.json` note backup download verified in Playwright (`R-004`)
✅ `<400ms` Optimistic Credit banner and 90/10 DeFi Float telemetry verified (`R-009`, `R-010`)
✅ 0 `axe-core` accessibility violations at `1440px` and `375px` (`R-017`)
✅ `progress.md` updated and git commit created with format: `feat(ui-studio): step 4.1 prism deposit and defi float screen`

#### Common Issues & Solutions
**Issue 1**: React hydration mismatch when reading `IndexedDB` / `localStorage` note balance in header pill on initial SSR render.
**Solution**: Render a deterministic skeleton badge on first pass and hydrate the stored note inside a `useEffect` hook once mounted on the client.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 4.1 - Build /studio Screen (PrismDepositCard + DefiFloatTelemetryCard)
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Next.js 15.2.4, React 19.0.0, Zustand, Playwright, @axe-core/playwright
- Objective: Build `/studio` (`PrismDepositCard`, `DefiFloatTelemetryCard`, `useRefractStore`) connecting 35+-chain Aurora Intents quotes, automatic `.json` note backup, `<400ms` optimistic credit, and 90/10 Solana DeFi telemetry (`R-001`–`R-004`, `R-009`, `R-010`, `R-014`, `R-017`).

PREREQUISITES:
- Milestone 3 completed.

BUILD INSTRUCTIONS:
1. Create `src/lib/store/useRefractStore.ts` to track the local `zkAPI` note, active `rk_live_*` Runtime Key, Web3 transaction state (`1..7`), and per-request spend policy cap (`$0.10` default).
2. Create `src/components/studio/PrismDepositCard.tsx` and `src/components/studio/DefiFloatTelemetryCard.tsx` following `blueprint/ui-spec.md` Section 6.1 and `blueprint/prototype/index.html`.
3. Create `src/app/studio/page.tsx` and write `tests/e2e/studio-deposit.spec.ts`:
   - Test case 1: Complete deposit flow on `/studio`, verify `.json` download event fires, and assert `$5.00` Optimistic Credit banner appears in <= 400ms.
   - Test case 2: Run `AxeBuilder` at `1440x900` and `375x812` and assert 0 WCAG 2.2 AA violations.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Playwright E2E & A11y tests:
   ```bash
   npx playwright test tests/e2e/studio-deposit.spec.ts
   ```
   Expected output: 2 passed, 0 accessibility violations.

DEFINITION OF DONE:
- [ ] `/studio` screen and components implemented
- [ ] Playwright E2E and WCAG 2.2 AA checks pass
- [ ] `progress.md` updated and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from Playwright
3. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 4.2: Build `/playground` & `/merchant` Screens (`X402AiPlaygroundCard`, `DoubleBlindInspectorDrawer`, `CrossChainRefundModal`, `MerchantTreasuryDashboard`)
**Duration**: 60 minutes
**Objective**: Implement Screen 2 (`/playground`) and Screen 3 (`/merchant`) including the streaming `x402` AI chat box (`R-012`), the 1-click **"Simulate `$2.50` Prompt-Injection Attack"** button demonstrating the Bounded Agent Spend Policy Firewall (`R-013`), the **Double-Blind Privacy Inspector Drawer** (`R-015`), the **Cross-Chain Refund Modal** (`R-011`), and the Merchant DeFi Treasury table (`R-007`, `R-009`).
**Risk**: Low - Ensuring all 3 tabs of the Double-Blind Privacy Inspector (`Visual Proof`, `Raw HTTP 402 Headers`, `Agent SDK Snippet`) display real, live cryptographic values from the most recent `x402` call (`R-015`).
**Prerequisites**: Step 4.1 completed.
**Testing Type**: Playwright E2E User Journey & Accessibility Testing (`TEST-E2E-001`, `TEST-E2E-002`, `TEST-A11Y-001`)

#### Context & References
- **Design Doc**: `/blueprint/ui-spec.md` → Section 6.2 (Screen 2 `/playground`), Section 6.3 (Screen 3 `/merchant`), & Section 7 (AI/Web3 Interaction Patterns)
- **Requirements**: `/blueprint/srd.md` → `R-005`–`R-009`, `R-011`–`R-015`, `R-017`
- **Dependencies**: Step 3.2 (`/api/v1/zkapi/runtime-key`), Step 3.4 (`/api/v1/ai/chat`), Step 2.4 (`/api/v1/intents/refund`), Step 4.1 (`useRefractStore`)
- **Related Tests**: `tests/e2e/playground-and-merchant.spec.ts`

#### What to Build
1. `src/components/playground/X402AiPlaygroundCard.tsx`:
   - Model selector (`Claude 3.5 Sonnet` / `GPT-4o-mini`), configurable Per-Request Spend Cap input (`$0.10` default, `R-013`), and `"Simulate $2.50 Prompt-Injection Attack"` button that triggers a real `HTTP 403 ERR_SPEND_CAP_EXCEEDED` alert banner (`role="alert"`).
   - If the user has an un-minted note, automatically invokes the WebWorker `snarkjs` Groth16 prover (`proverClient.ts`) with a determinate 3-step progress bar (`"Computing BN254 Groth16 Witness..."`) and calls `POST /api/v1/zkapi/runtime-key`.
   - Sends prompts to `POST /api/v1/ai/chat` with `PAYMENT-SIGNATURE`, displays the AI reply, verification latency (`11ms`), micro-USDC charged (`0.015 USDC`), and verified Schnorr receipt (`X-ZKAPI-RECEIPT`).
2. `src/components/playground/DoubleBlindInspectorDrawer.tsx`:
   - Side-by-side 3-stage cryptographic proof panel (`1. Origin Chain Saw`, `2. Solana Anchor Vault Saw`, `3. AI Merchant Server Saw -> Wallet Bytes Sent: 0 BYTES`) plus tabs for `Raw HTTP 402 Headers` (`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `X-ZKAPI-RECEIPT`) and `Agent SDK Snippet` (`R-015`).
3. `src/components/playground/CrossChainRefundModal.tsx`:
   - Modal (`role="dialog"`, `aria-modal="true"`, Escape-to-close) allowing the user to select any of 35+ destination chains/assets and execute `POST /api/v1/intents/refund` (`R-011`).
4. `src/app/playground/page.tsx` & `src/app/merchant/page.tsx`:
   - Mounts `/playground` and `/merchant` (showing merchant revenue, 90% Kamino staked float, accrued yield, and live unlinkable Schnorr receipt ledger).

#### Build Instructions (Atomic Steps)
1. Create `src/components/playground/X402AiPlaygroundCard.tsx`, `src/components/playground/DoubleBlindInspectorDrawer.tsx`, and `src/components/playground/CrossChainRefundModal.tsx`.
2. Create `src/app/playground/page.tsx` and `src/app/merchant/page.tsx`.
3. Write `tests/e2e/playground-and-merchant.spec.ts` testing:
   - Full `x402` AI chat call on `/playground` (`TEST-E2E-001`) and verifying the Double-Blind Inspector displays the live `nullifierHash`, Schnorr signature, and `0 BYTES` wallet leakage (`TEST-E2E-002`).
   - Clicking `"Simulate $2.50 Prompt-Injection Attack"` and asserting the `ERR_SPEND_CAP_EXCEEDED` `role="alert"` banner renders with `0.00 USDC` deducted (`R-013`).
   - Opening the Cross-Chain Refund Modal, submitting a refund to Arbitrum USDC, and verifying `PROCESSING_REFUND` status (`R-011`).
   - Visiting `/merchant`, verifying the Schnorr receipt ledger row appears with `[UNLINKABLE ZK]`, and running `AxeBuilder` across both `/playground` and `/merchant` (`TEST-A11Y-001`).

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Playwright E2E Journey & Accessibility Tests**
```bash
npx playwright test tests/e2e/playground-and-merchant.spec.ts
# Expected:
# - TEST-E2E-001 PASS: Private x402 AI chat completes in <15ms gateway verify time and displays Schnorr receipt
# - TEST-E2E-002 PASS: Double-Blind Inspector shows real quoteId, nullifierHash, and "0 BYTES" wallet header proof
# - R-013 Firewall PASS: Simulated $2.50 attack renders role="alert" ERR_SPEND_CAP_EXCEEDED
# - R-011 Refund Modal PASS: Cross-chain refund to Arbitrum transitions session to CLOSED_REFUNDED
# - TEST-A11Y-001 PASS: 0 axe-core WCAG 2.2 AA violations on /playground and /merchant (1440px & 375px)
```

**Phase 4: Manual Verification**
1. Open `http://localhost:3000/playground`, send a prompt, and switch between the `Visual Proof`, `Raw 402 Headers`, and `SDK` tabs in the Double-Blind Inspector.
2. Click `"Simulate $2.50 Atk"` and confirm the red firewall alert banner appears immediately without reducing the top-right note balance pill.
3. Open `http://localhost:3000/merchant` and verify the newly settled `0.015 USDC` receipt appears in the table with `Buyer Identity: [UNLINKABLE ZK]`.

#### Deliverables Checklist
- [ ] **Code**: `X402AiPlaygroundCard.tsx`, `DoubleBlindInspectorDrawer.tsx`, `CrossChainRefundModal.tsx`, `src/app/playground/page.tsx`, `src/app/merchant/page.tsx`
- [ ] **Tests**: `tests/e2e/playground-and-merchant.spec.ts` (`TEST-E2E-001`, `TEST-E2E-002`, `TEST-A11Y-001`)
- [ ] **Verification**: All E2E flows and WCAG 2.2 AA scans pass across all 3 screens
- [ ] **Git**: Commit created `feat(ui-playground): step 4.2 build /playground /merchant double-blind inspector and refund modal`

#### Definition of Done (STRICT)
✅ All 3 routes (`/studio`, `/playground`, `/merchant`) are live, interactive, and connected to real APIs
✅ `TEST-E2E-001` and `TEST-E2E-002` pass in Playwright
✅ `TEST-A11Y-001` passes with 0 `axe-core` violations across all 3 routes at `1440px` and `375px`
✅ Keyboard navigation (`Tab`, `Enter`, `Escape` on Refund Modal) verified
✅ `progress.md` updated and git commit created with format: `feat(ui-playground): step 4.2 playground inspector and merchant screens`

#### Common Issues & Solutions
**Issue 1**: Focus is not restored to the trigger button when `CrossChainRefundModal` closes on `Escape`.
**Solution**: Store `triggerRef = useRef<HTMLButtonElement>(null)` and call `triggerRef.current?.focus()` inside the modal's `onClose` handler (`ui-spec.md` Section 5 Component #5).

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 4.2 - Build /playground & /merchant Screens + Double-Blind Inspector
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: Next.js 15.2.4, React 19.0.0, Zustand, Playwright, @axe-core/playwright
- Objective: Build `/playground` (`X402AiPlaygroundCard`, `DoubleBlindInspectorDrawer`, `CrossChainRefundModal`) and `/merchant` (`MerchantTreasuryDashboard`), and verify with Playwright E2E and axe-core WCAG 2.2 AA tests (`TEST-E2E-001`, `TEST-E2E-002`, `TEST-A11Y-001`).

PREREQUISITES:
- Step 4.1 completed.

BUILD INSTRUCTIONS:
1. Create `src/components/playground/X402AiPlaygroundCard.tsx`, `src/components/playground/DoubleBlindInspectorDrawer.tsx`, and `src/components/playground/CrossChainRefundModal.tsx` matching `blueprint/ui-spec.md` Section 6.2.
2. Create `src/app/playground/page.tsx` and `src/app/merchant/page.tsx` matching `blueprint/ui-spec.md` Section 6.3.
3. Create `tests/e2e/playground-and-merchant.spec.ts`:
   - Test case 1 (`TEST-E2E-001` & `TEST-E2E-002`): Execute an unlinkable x402 AI chat call on `/playground`; assert response streams, Schnorr receipt badge renders, and Double-Blind Inspector shows `0 BYTES` wallet leakage.
   - Test case 2 (`R-013`): Click `"Simulate $2.50 Prompt-Injection Attack"` and assert `role="alert"` displays `ERR_SPEND_CAP_EXCEEDED` with 0 balance deducted.
   - Test case 3 (`R-011`): Open `CrossChainRefundModal`, submit refund to Arbitrum, and verify `PROCESSING_REFUND` state.
   - Test case 4 (`TEST-A11Y-001`): Run `AxeBuilder` on `/playground` and `/merchant` at `1440x900` and `375x812`; assert 0 violations.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Full Playwright E2E & A11y suite:
   ```bash
   npx playwright test tests/e2e/studio-deposit.spec.ts tests/e2e/playground-and-merchant.spec.ts
   ```
   Expected output: All E2E and accessibility tests pass across `/studio`, `/playground`, and `/merchant`.

DEFINITION OF DONE:
- [ ] `/playground` and `/merchant` screens implemented
- [ ] `TEST-E2E-001`, `TEST-E2E-002`, and `TEST-A11Y-001` pass
- [ ] `progress.md` updated and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from Playwright
3. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 4.3: Deploy `RefractVault` & `$20` Micro-Liquidity Pool to Solana Mainnet-Beta & Run Full Verification Gate (`Phase 8`)
**Duration**: 55 minutes
**Objective**: Deploy the verified `RefractVault` Anchor program to **Solana Mainnet-Beta** (or configure the live Mainnet-Beta micro-liquidity vault per `ADR-006` / `GAP-001`), seed the `$20.00 USDC` 90/10 DeFi Float Pool, execute a real cross-chain Aurora Intents deposit (`Base/Arbitrum USDC` $\rightarrow$ `Solana USDC` with `confidentialMode: true` and `30 bps` fee), and run the executable Phase 8 Verification Script (`scripts/verify_blueprint_gates.ts`) confirming all 9 quality gates pass with **0 blockers**.
**Risk**: Medium - Mainnet SOL priority fees and ensuring `NEXT_PUBLIC_SOLANA_USDC_MINT` points to canonical Solana Mainnet USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`).
**Prerequisites**: Step 4.2 completed; Mainnet deployer/relayer funded with SOL and `$20 USDC`.
**Testing Type**: Production Mainnet E2E Verification & Full Blueprint Gate Audit (`Phase 8` Checks 1–9)

#### Context & References
- **Design Doc**: `/blueprint/decisions.md` → `ADR-006`, `GAP-001`, `GAP-002`; `/blueprint/reviews/verification.md`
- **Requirements**: `/blueprint/srd.md` → Section 6 (Verification Checks 1–9), `R-001`–`R-018`
- **Dependencies**: Steps 0.1–4.2
- **Related Tests**: `scripts/verify_blueprint_gates.ts`

#### What to Build
1. `scripts/deploy_and_seed_vault.ts`:
   - Calls `initialize_vault(subsidy_bonus_bps = 840)` on the target cluster (`devnet` and `mainnet-beta`), seeds the initial `$20.00 USDC` micro-liquidity pool (`$18.00` staked in yield reserve / `$2.00` in liquid optimistic reserve PDA), and outputs the on-chain PDA addresses and Solscan verification links.
2. `scripts/verify_blueprint_gates.ts`:
   - Automated executable runner for all **Phase 8 Verification Gates**:
     - **Check 1 (SCHEMA):** Confirms all 6 tables and 8 named indexes exist in PostgreSQL.
     - **Check 2 (OPENAPI):** Runs `@redocly/cli lint blueprint/openapi.yaml`.
     - **Check 3 (TRACEABILITY):** Cross-checks `blueprint/requirements.csv` (`R-001`–`R-018`) against `blueprint/traceability.csv` and confirms `0` orphans in either direction.
     - **Check 4 (CONFIGURATION):** Cross-checks all 22 env vars in `blueprint/.env.example` against code references (`0` missing).
     - **Check 5 (DESIGN CONTRAST):** Runs `scripts/verify_contrast.mjs` (`10/10` WCAG 2.2 AA/AAA pairs pass).
     - **Check 6 (VERSIONS):** Confirms `@solana/web3.js@1.99.0`, `anchor-lang@1.2.2`, `groth16-solana@0.2.0`, `@defuse-protocol/one-click-sdk-typescript@0.1.26`, and `snarkjs@0.7.6`.
     - **Check 7 (CAPACITY MODEL):** Runs `python3 blueprint/models/load_and_cost.py` and reproduces the exact headroom numbers.
     - **Check 8 (SECURITY & UNLINKABILITY):** Runs `TEST-SEC-001`, `TEST-SEC-002`, and `TEST-SCOPE-001` (`R-018` no custom governance token).

#### Build Instructions (Atomic Steps)
1. Create `scripts/deploy_and_seed_vault.ts` to initialize `ZkYieldVault` PDA and seed the 90/10 USDC float pool on Devnet and Mainnet-Beta.
2. Create `scripts/verify_blueprint_gates.ts` to run all 8 automated checks in sequence and write the final pass report to `blueprint/reviews/verification.md`.
3. Execute `npx tsx scripts/verify_blueprint_gates.ts` and the full Vitest + Anchor + Playwright test suites.

#### Testing Protocol (MANDATORY)
**BEFORE proceeding to next step, ALL of these MUST pass:**

**Phase 1: Full Blueprint Verification Script (Checks 1–8)**
```bash
npx tsx scripts/verify_blueprint_gates.ts
# Expected:
# [PASS] Check 1: PostgreSQL 16 Schema & 8/8 Indexes Verified
# [PASS] Check 2: OpenAPI 3.1.0 Specification Linted (0 errors)
# [PASS] Check 3: Bidirectional Traceability Verified (R-001..R-018, 0 orphans)
# [PASS] Check 4: Environment Configuration Verified (22/22 variables matched)
# [PASS] Check 5: WCAG 2.2 AA Contrast Verified (10/10 token pairs pass)
# [PASS] Check 6: Pinned Dependency Versions & Audit Verified (0 vulnerabilities)
# [PASS] Check 7: Capacity & Cost Model Reproducibility Verified
# [PASS] Check 8: STRIDE Security & Zero-Wallet-Leakage Suite Verified
# OVERALL STATUS: READY FOR PRODUCTION & SUBMISSION
```

**Phase 2: Complete Test Suite Execution**
```bash
npm test
anchor test
npx playwright test
# Expected: 100% of Unit, Integration, Anchor SVM, Security, AI Benchmark, and Playwright E2E tests PASS
```

**Phase 3: Devnet / Mainnet-Beta Vault Verification**
```bash
npx tsx scripts/deploy_and_seed_vault.ts
# Expected: Vault PDA initialized, 90/10 split active, Solscan transaction URLs printed
```

**Phase 4: Manual Verification**
1. Open the printed Solscan transaction URLs for `initialize_vault`, `deposit_and_commit`, and `settle_zk_spend`.
2. Confirm `blueprint/reviews/verification.md` status is updated from `CONDITIONAL READY` to **`READY`**.

#### Deliverables Checklist
- [ ] **Code**: `scripts/deploy_and_seed_vault.ts` and `scripts/verify_blueprint_gates.ts`
- [ ] **Tests**: All 11 test layers (`Unit`, `Integration`, `Contract`, `DB`, `SVM`, `E2E`, `Load`, `Security`, `A11y`, `AI`, `DR`) passing
- [ ] **Verification**: `blueprint/reviews/verification.md` updated with live execution results and `READY` status
- [ ] **Git**: Commit created `feat(verify): step 4.3 execute full phase-8 verification gates and seed vault`

#### Definition of Done (STRICT)
✅ `scripts/verify_blueprint_gates.ts` exits `0` with all 8 checks passing
✅ All unit, integration, Anchor SVM (`<= 140k CU`), and Playwright E2E tests pass
✅ **[Web3 ONLY]** Vault initialized and verified on Solana Explorer / Solscan
✅ `blueprint/reviews/verification.md` and `progress.md` updated to `READY`
✅ Git commit created with format: `feat(verify): step 4.3 phase 8 verification gates and vault deployment`

#### Common Issues & Solutions
**Issue 1**: Mainnet RPC rate-limits burst calls during `verify_blueprint_gates.ts`.
**Solution**: Use the dedicated `SOLANA_RPC_URL` (Helius Mainnet/Devnet key) for backend verification scripts while keeping public reads cached in Upstash Redis.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 4.3 - Seed Live Vault & Execute Full Phase 8 Verification Gates
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract
- Technology: TypeScript, Anchor 1.2.2, PostgreSQL 16, Redocly CLI, Vitest, Playwright
- Objective: Implement `scripts/deploy_and_seed_vault.ts` and `scripts/verify_blueprint_gates.ts`, execute all Phase 8 verification checks (Schema, OpenAPI, Traceability, Config, Contrast, Versions, Capacity, Security), and transition `blueprint/reviews/verification.md` to `READY`.

PREREQUISITES:
- Step 4.2 completed.

BUILD INSTRUCTIONS:
1. Create `scripts/deploy_and_seed_vault.ts` to initialize `ZkYieldVault`, seed initial USDC float, and run `rebalance_defi_float`.
2. Create `scripts/verify_blueprint_gates.ts` to programmatically execute Checks 1 through 8 from `/blueprint/srd.md` Section 6 and assert 0 failures.
3. Update `blueprint/reviews/verification.md` with the live execution output and mark status `READY`.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Master Verification Script:
   ```bash
   npx tsx scripts/verify_blueprint_gates.ts
   ```
   Expected output: `OVERALL STATUS: READY FOR PRODUCTION & SUBMISSION (0 blockers)`.

2. Full Test Suite:
   ```bash
   npx vitest run && npx playwright test
   ```
   Expected output: 100% pass across all test suites.

DEFINITION OF DONE:
- [ ] `deploy_and_seed_vault.ts` and `verify_blueprint_gates.ts` implemented
- [ ] All 8 automated verification gates pass with 0 blockers
- [ ] `blueprint/reviews/verification.md` marked `READY`
- [ ] `progress.md` updated and git commit created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Complete terminal output from `verify_blueprint_gates.ts`
3. Confirmation that all Definition of Done items are complete
═══════════════════════════════════════════════════════════════
```

---

### Step 4.4: Production Deployment (Vercel), Judge Documentation & Dual-Hackathon Submission Package
**Duration**: 45 minutes
**Objective**: Deploy the Next.js 15 application to production (`refract402.vercel.app`), write the judge-optimized root `README.md` with architecture diagrams, Solscan + Aurora `1Click` proof links, and setup instructions, and verify the live 90-second demo script for **Hackathon 1 (Solana Weekend Hackathon)** and **Hackathon 2 (Encode x Solana 4-Week Hackathon)**.
**Risk**: Low - Ensuring all 22 environment variables from `.env.example` are configured in Vercel Production settings prior to triggering the production build.
**Prerequisites**: Step 4.3 completed (`READY` status verified).
**Testing Type**: Production Smoke Test & Submission Checklist Verification (`TEST-SCOPE-001`)

#### Context & References
- **Design Doc**: `/blueprint/blueprint.md` → Section 15 (Infrastructure & Deployment) & Section 16 (Repository Structure)
- **Requirements**: Encode Submission Requirements (*Working demo, code repo with README and setup instructions, 2–4 min demo video, clear explanation of how Solana & Aurora Intents power the project*)
- **Dependencies**: Steps 0.1–4.3
- **Related Tests**: `tests/e2e/prod-smoke.spec.ts`

#### What to Build
1. **Root `README.md` (Judge-First Structure):**
   - **10-Second Pitch & Live Links:** Production URL, Demo Video URL, Deployed Solana `RefractVault` Program ID, and live Solscan + Aurora Intents transaction links.
   - **How Refract Uses Aurora Intents (`$1,500` Track):** Exact code links to `OneClickService.getQuote()` (`35+` chains), `confidentialMode: true` (Bonus criterion), `@aurora-is-near/intents-connect` atomic vault deposit (Bonus criterion), `30 bps` custom integrator fee split, and automated reverse-intent cross-chain refunds (`R-001`, `R-002`, `R-003`, `R-011`, `R-014`).
   - **How Refract Uses Solana, `x402`, `zkAPI`, & DeFi (`$1,000` H1 Microgrant + Encode Consumer & x402 Tracks):** Explains the depth-20 Poseidon Merkle tree, `groth16-solana` `alt_bn128` verification (`104,280 CU <= 140k CU`), `<400ms` Optimistic Float Credit from the 90/10 Kamino DeFi pool, `<15ms` `x402` Runtime Key verification with Schnorr receipts, and the Bounded Agent Spend Policy Firewall.
   - **5-Minute Local Setup Instructions:** Copy-paste commands (`npm install`, `npm run db:migrate:up`, `anchor test`, `npm run dev`).
2. **Production Smoke Test (`tests/e2e/prod-smoke.spec.ts`):**
   - Verifies `/api/v1/health`, `/api/v1/defi/vault-stats`, `/studio`, `/playground`, and `/merchant` on the deployed production build.
3. **90-Second Demo Recording Script (`docs/DEMO_SCRIPT.md`):**
   - Exact time-coded narration and click sequence covering all judging criteria in 90 seconds (compatible with both H1 and Encode's 2–4 minute video requirement).

#### Build Instructions (Atomic Steps)
1. Create the comprehensive root `README.md` and `docs/DEMO_SCRIPT.md`.
2. Run `npm run build` locally to confirm Next.js 15 production build succeeds with zero static/SSR errors and bundle sizes within budget (`<= 180 KB` initial JS).
3. Deploy to Vercel Production (`vercel --prod`) with all environment variables configured.
4. Run `tests/e2e/prod-smoke.spec.ts` against the live production URL and record the final entry in `progress.md`.

#### Testing Protocol (MANDATORY)
**BEFORE completing the project, ALL of these MUST pass:**

**Phase 1: Production Build & Bundle Budget Check**
```bash
npm run build
# Expected: Next.js 15.2.4 production build succeeds with 0 errors; First Load JS <= 180 kB
```

**Phase 2: Production Smoke Tests**
```bash
PLAYWRIGHT_TEST_BASE_URL=https://refract402.vercel.app npx playwright test tests/e2e/prod-smoke.spec.ts
# Expected:
# - GET /api/v1/health returns 200 OK (postgres: ok, redis: ok, auroraOneClickReachable: true)
# - /studio, /playground, and /merchant render in < 1.2s with 0 console errors
# - Unpaid POST /api/v1/ai/chat returns HTTP 402 Payment Required with base64 PAYMENT-REQUIRED header
```

**Phase 4: Manual Verification (90-Second Demo Walkthrough)**
1. Open `https://refract402.vercel.app/studio` and execute a `$10.00 USDC` deposit from Base/Arbitrum with **Aurora Confidential Intents ON**.
2. Observe the `.json` note backup download and the `<400ms` **Optimistic Float Credit** banner lighting up immediately.
3. Switch to `/playground`, send an AI prompt (`0.015 USDC` settled in `11ms`), open the **Double-Blind Privacy Inspector** (`0 Wallet Bytes Sent`), click **"Simulate `$2.50` Attack"** to show the **Agent Spend Policy Firewall** blocking the call (`HTTP 403`), and trigger a **Cross-Chain Refund** via Aurora `1Click API`.

#### Deliverables Checklist
- [ ] **Code & Build**: Clean `npm run build` and live Vercel production deployment
- [ ] **Documentation**: Judge-ready root `README.md`, `docs/DEMO_SCRIPT.md`, and complete `/blueprint` suite
- [ ] **Tests**: `tests/e2e/prod-smoke.spec.ts` passing against production
- [ ] **Verification**: All 18 requirements (`R-001`–`R-018`) and 7 NFRs (`NFR-001`–`NFR-007`) verified
- [ ] **Git**: Final release commit & tag `v2.0.0-hackathon-release`

#### Definition of Done (STRICT)
✅ Production build (`npm run build`) compiles with 0 errors or warnings
✅ Production deployment live and passing `prod-smoke.spec.ts`
✅ Root `README.md` clearly documents Solana, `x402`, `zkAPI`, Kamino DeFi, and all 3 Aurora Intents products + Confidential Mode
✅ All 4 Milestones (`M0`–`M4`) marked `✅ COMPLETE` in `progress.md`
✅ Git commit created with format: `chore(release): step 4.4 production deployment readme and hackathon submission package`

#### Common Issues & Solutions
**Issue 1**: Next.js production build attempts to bundle Node `fs` inside `snarkjs` for client components.
**Solution**: Add `webpack: (config, { isServer }) => { if (!isServer) config.resolve.fallback = { ...config.resolve.fallback, fs: false, readline: false }; return config; }` in `next.config.mjs`.

#### AI Agent Prompt (Ready to Copy-Paste)
```
═══════════════════════════════════════════════════════════════
IMPLEMENTATION TASK: Step 4.4 - Production Deployment, Judge README & Final Smoke Verification
═══════════════════════════════════════════════════════════════

CONTEXT:
- Project: Refract (Any-Chain Yield-Bearing zkAPI for Solana x402)
- Technology: Next.js 15.2.4, Vercel, Playwright
- Objective: Configure `next.config.mjs` for browser WASM proving, write the judge-focused root `README.md` and `docs/DEMO_SCRIPT.md`, verify `npm run build`, and run `tests/e2e/prod-smoke.spec.ts`.

PREREQUISITES:
- Step 4.3 completed (`verify_blueprint_gates.ts` passing with 0 blockers).

BUILD INSTRUCTIONS:
1. Update `next.config.mjs` with client webpack fallbacks (`fs: false`, `readline: false`) for `snarkjs` WebWorker compatibility.
2. Create root `README.md` covering:
   - Architecture overview & live links
   - Aurora Intents integration (`1Click API`, `Intents Connect`, `Confidential Intents`, `30 bps` fee split, reverse-intent refunds)
   - Solana `x402` + `zkAPI` (`groth16-solana` `<= 140k CU`, `<15ms` Runtime Keys, Schnorr receipts, Agent Spend Firewall)
   - 90/10 Solana DeFi Float Pool & `<400ms` Optimistic Credit
   - Reproducible setup & test commands
3. Create `docs/DEMO_SCRIPT.md` and `tests/e2e/prod-smoke.spec.ts`.
4. Run `npm run build` and `npx playwright test tests/e2e/prod-smoke.spec.ts`.

TESTING PROTOCOL:
Run these commands in sequence. ALL must pass:
1. Production build:
   ```bash
   npm run build
   ```
   Expected output: Compiled successfully, 0 errors.

2. Production smoke test:
   ```bash
   npx playwright test tests/e2e/prod-smoke.spec.ts
   ```
   Expected output: All routes and HTTP 402 headers verified.

DEFINITION OF DONE:
- [ ] `npm run build` succeeds cleanly
- [ ] `README.md` and `docs/DEMO_SCRIPT.md` completed
- [ ] `prod-smoke.spec.ts` passes
- [ ] `progress.md` finalized and git tag `v2.0.0-hackathon-release` created

OUTPUT FORMAT:
Provide:
1. All created/modified files with full content
2. Terminal output from `npm run build` and `prod-smoke.spec.ts`
3. Final `progress.md` summary confirming 100% project completion
═══════════════════════════════════════════════════════════════
```

#### Progress Tracking Update
After completing Step 4.4, add this final entry to `progress.md`:

```markdown
### ✅ Milestone 4: Dark Prism UI, Mainnet Micro-Liquidity Demo & Final Deployment (Steps 4.1 – 4.4) - COMPLETED

**Date**: 2026-11-07
**Duration**: 3.6 Hours
**Status**: ✅ COMPLETE (ALL MILESTONES M0–M4 FINISHED)

**What Was Built**:
- `/studio` (`PrismDepositCard`, `DefiFloatTelemetryCard`), `/playground` (`X402AiPlaygroundCard`, `DoubleBlindInspectorDrawer`, `CrossChainRefundModal`), and `/merchant` (`MerchantTreasuryDashboard`).
- `scripts/deploy_and_seed_vault.ts` & `scripts/verify_blueprint_gates.ts`: Seeded live vault and verified all 8 Phase-8 quality gates with `0` blockers.
- Root `README.md`, `docs/DEMO_SCRIPT.md`, and production Vercel deployment (`refract402.vercel.app`).

**Final Verification Summary**:
- All 18 Requirements (`R-001`–`R-018`) & 7 NFRs (`NFR-001`–`NFR-007`): ✅ 100% VERIFIED
- Solana On-Chain Groth16 Verification: ✅ `~104,280 CU` (`<= 140,000 CU` target)
- `x402` Runtime Key Gateway Latency: ✅ `~11ms` p95 (`<= 15ms` target)
- Cross-Chain Optimistic Float Credit: ✅ `< 400ms` (`$5.00` instant advance)
- Wallet Identity Leakage to Merchant: ✅ `0 BYTES` (`TEST-SEC-001`)
- WCAG 2.2 Level AA Accessibility: ✅ `0` violations across all 3 screens at `1440px` & `375px`
```

---

---

## 5. CROSS-CUTTING SECTION A: TESTING STRATEGY (CONTINUOUS TDD/BDD)

### A.1 Test-Driven Development (TDD) & Continuous Verification Workflow
Every feature in **Refract** is built test-first against the acceptance criteria in `blueprint/requirements.csv`:
1. **Red Phase**: Write the failing unit, integration, or Anchor SVM test asserting the exact post-condition (e.g., `expect(computeUnitsConsumed).toBeLessThanOrEqual(140_000)` or `expect(res.headers.get('x-zkapi-receipt')).toBeTruthy()`).
2. **Green Phase**: Write the minimal Rust instruction, Circom constraint, or TypeScript service required to pass the test.
3. **Refactor & Security Check**: Run `TEST-SEC-001` (zero wallet/IP leakage) and `npm run typecheck` before committing.

### A.2 Continuous Integration (CI) Pipeline & Blocking Quality Gates
Configured in `.github/workflows/ci.yml`. Any pull request or push to `main` is blocked from merging or deploying if any of the 5 stages fail:

| CI Stage | Command Executed | Pass Criteria / Blocking Threshold |
| :--- | :--- | :--- |
| **Stage 1: Static & Contract Lint** | `npm run typecheck && npx @redocly/cli lint blueprint/openapi.yaml && npm run verify:contrast` | `0` TypeScript errors, `0` OpenAPI errors, `10/10` WCAG 2.2 AA contrast pairs pass. |
| **Stage 2: Supply-Chain Security** | `npm audit --audit-level=high && cargo audit` | `0` high/critical vulnerabilities; `@solana/web3.js@1.99.0` & `anchor-lang@1.2.2` verified. |
| **Stage 3: Database & Unit Suite** | `npm run db:migrate:up && npm run test:unit && npm run test:integration` | All 6 tables & 8 indexes created; `>= 90%` unit coverage; `100%` integration pass. |
| **Stage 4: Solana SVM & ZK Prover** | `anchor test` | `deposit_and_commit`, `settle_zk_spend` (`<= 140,000 CU`), `rebalance_defi_float` (90/10), and nullifier replay rejection pass. |
| **Stage 5: Security, Perf & E2E** | `npm run test:security && npx playwright test` | `walletBytesReceived === 0` (`NFR-005`), `$2.50` attack blocked (`HTTP 403`), `0` `axe-core` violations. |

### A.3 Solana Testnet (Devnet) & Mainnet-Beta Verification Protocols
1. **Local Validator (`solana-test-validator`)**: Used during inner-loop TDD (`anchor test --skip-local-validator=false`).
2. **Solana Devnet Gate**: Every smart contract step in Milestone 0 and Milestone 1 must deploy to Solana Devnet (`anchor deploy --provider.cluster devnet`) and execute the integration suite against `https://api.devnet.solana.com`.
3. **Solana Mainnet-Beta Micro-Liquidity Gate (`ADR-006`)**: Because NEAR Intents / Aurora `1Click API` operates strictly on Mainnet (`VERIFIED`: `docs.near-intents.org`), Step 4.3 seeds a live `$15–$25 USDC` pool on Solana Mainnet-Beta so the live demo executes genuine cross-chain solver settlements.

### A.4 Code Coverage Thresholds & Testing Tools Matrix
| Layer | Tool / Framework | Minimum Coverage Threshold | Target Files |
| :--- | :--- | :--- | :--- |
| **ZK Serialization & Schnorr Math** | `Vitest 2.1.8` | **95% line / 90% branch** | `src/lib/zkapi/bn254Serializer.ts`, `src/lib/x402/schnorrReceiptSigner.ts` |
| **Solana Anchor Smart Contract** | `anchor test` / Mocha / Vitest | **100% instruction / 90% error branch** | `programs/refract_vault/src/{lib,state,merkle}.rs` |
| **API Gateway & Aurora Adapters** | `Vitest 2.1.8` | **85% line coverage** | `src/lib/aurora/*`, `src/lib/x402/*`, `src/lib/defi/*` |
| **Frontend UI & Accessibility** | `Playwright 1.49.0` + `@axe-core/playwright 4.10.1` | **100% of P0/P1 user flows (`/studio`, `/playground`, `/merchant`)** | `src/app/**`, `src/components/**` |
| **Gateway Load & Latency** | `k6` / `tests/load/x402_verify.test.ts` | **`p95 <= 15ms` at 50 RPS** | `POST /api/v1/ai/chat` (`X402GatewayMiddleware`) |

---

## 6. CROSS-CUTTING SECTION B: ERROR HANDLING PROTOCOL

### B.1 Common Errors by Technology Stack & Deterministic Fixes
| Stack Layer | Error Symptom / Code | Root Cause | Immediate Fix |
| :--- | :--- | :--- | :--- |
| **Solana / `groth16-solana`** | `Custom program error: 0x1` (`InvalidGroth16Proof`) | (1) `proof_a` G1 y-coordinate not negated modulo $q$, or (2) `proof_b` G2 Fq2 coordinates not in EIP-197 `[c1, c0]` order. | Pass proof through `serializeGroth16ProofForSolana()` in `src/lib/zkapi/bn254Serializer.ts` and verify with `tests/unit/crypto-parity.test.ts`. |
| **Solana / Anchor Zero-Copy** | `AccountDidNotDeserialize` or `AccessViolation` in SBF | Struct fields in `ZkYieldVault` are not 8-byte aligned under `#[repr(C)]`. | Keep `[u8; 32]` and `Pubkey` fields at top of struct, followed by `u64`, `u32`, `u16`, `u8`, and explicit `_padding: [u8; 5]`. |
| **Aurora Intents `1Click API`** | `HTTP 400 Bad Request` on `OneClickService.getQuote()` | `deadline` timestamp expired or `amount` below solver minimum (`< $1.00`). | Enforce `deadline = Date.now() + 600_000` (10m) and `amountRaw >= 1_000_000` (`ERR_MIN_DEPOSIT_NOT_MET`) before calling SDK. |
| **Next.js 15 / `snarkjs` WASM** | `Module not found: Can't resolve 'fs'` during `next build` | `snarkjs` bundles Node `fs` checks that fail in client webpack builds. | Add `resolve.fallback = { fs: false, readline: false }` for `!isServer` in `next.config.mjs`. |
| **PostgreSQL / Concurrency** | Overdraft on `remaining_micro_usdc` during parallel agent calls | Read-modify-write in application code instead of atomic SQL/Lua update. | Always use single-statement `UPDATE zk_runtime_sessions SET remaining_micro_usdc = remaining_micro_usdc - $1 WHERE ... AND remaining_micro_usdc >= $1 RETURNING *`. |

### B.2 Debugging Strategies
1. **Correlation ID Tracing**: Every API request and response carries `X-Correlation-Id: req_<ulid>`. Search structured logs by `correlationId` to trace a request across Next.js, Redis, Postgres, and Solana RPC without exposing user PII.
2. **Solana Transaction Simulation Inspection**: When an Anchor transaction fails, capture `err.logs` from `SendTransactionError` and run `solana confirm -v <TX_SIG> --url devnet` to inspect exact per-instruction Compute Units and Anchor error codes.
3. **ZK Witness Debugging**: If `snarkjs.groth16.fullProve` fails in the browser WebWorker, run `npx vitest run tests/unit/circuit-prover.test.ts` to inspect which Circom line (`nullifier_hash`, `merkle_root`, or `LessEqThan(64)` spend cap) failed assertion.

### B.3 Rollback Procedures
1. **Database Migration Rollback**:
   ```bash
   npm run db:migrate:down
   # Re-syncs merkle_leaves from immutable Solana blockchain state if needed:
   npm run db:rebuild-from-chain
   ```
2. **Application / Gateway Rollback**:
   ```bash
   git revert HEAD --no-edit
   vercel rollback --yes
   ```
3. **Optimistic Credit & Failed Upstream API Rollback**:
   - Automatic in-code compensation: `rollbackRuntimeKeyCharge(sessionId, chargedMicroUsdc)` restores the user's Runtime Key balance within `<10ms` if OpenAI/Anthropic both return `5xx`.

### B.4 Emergency Response for Testnet / Mainnet Issues
- **Scenario 1: Solana Relayer Gas Depletion (`< 0.02 SOL`)**:
  - *Immediate Action*: Fund `SOLANA_RELAYER_PRIVATE_KEY_BASE58` address with `0.2 SOL` (Mainnet) or `solana airdrop 2` (Devnet). Existing `rk_live_*` Runtime Keys continue working uninterrupted via Redis/Postgres during relayer top-up.
- **Scenario 2: Aurora Solver Delay (`> 60 seconds` during live demo)**:
  - *Immediate Action*: Zero action needed for the demo flow—**Optimistic Float Credit (`R-010`)** already unlocked `$5.00` of active `x402` spending power in `<400ms` upon origin tx broadcast. Proceed directly to `/playground` while `SolanaAnchorDepositWorker` settles in the background.
- **Scenario 3: Kamino Reserve Utilization Spike (`> 98%`)**:
  - *Immediate Action*: Circuit breaker in `floatRouter.ts` automatically keeps 100% of new deposits in the Anchor `liquid_vault` PDA so withdrawals and settlements never block.

---

## 7. CROSS-CUTTING SECTION C: PROGRESS TRACKING SYSTEM

### C.1 Step Completion Format (`progress.md`)
Every completed step must append this exact block to `progress.md` before committing:
```markdown
### ✅ Step M.N: [Step Name] - COMPLETED
- **Timestamp**: YYYY-MM-DD HH:MM UTC
- **Time Spent**: [X] mins (Budget: [Y] mins)
- **Files Created/Modified**: `[file1]`, `[file2]`
- **Test Results**:
  - Unit: ✅ [X/X passed]
  - Integration / DB: ✅ [X/X passed]
  - Solana SVM / Devnet: ✅ [CU: X / Tx: <sig>]
  - Playwright / A11y: ✅ [0 violations]
- **Commit Hash**: `<git_short_sha>`
- **Next Step**: Step M.N+1
```

### C.2 Hackathon Sprint Standup Template (Every 6 Hours)
```markdown
## ⏱️ 6-Hour Sprint Checkpoint — [Day / Time]
1. **Completed Since Last Checkpoint**: Steps [M.X – M.Y] (All tests green)
2. **Current Active Step**: Step [M.Z] ([Owner])
3. **Live Metrics Check**:
   - On-Chain Groth16 Verify CU: `[X] CU` (Target: `<= 140,000 CU`)
   - x402 Gateway Verify p95: `[X] ms` (Target: `<= 15 ms`)
   - Optimistic Credit Latency: `[X] ms` (Target: `<= 400 ms`)
4. **Blockers & Escalations**: [None / Describe blocker + time boxed to 20 mins]
```

### C.3 Blocker Escalation Process (The 20-Minute Rule)
In a 40-hour hackathon sprint, no engineer may stay stuck on a single bug for more than **20 minutes** without escalating:
- **Minute 0–15**: Check Section B.1 (Common Errors Table) and run isolated Vitest/Anchor test with verbose logs (`--nocapture`).
- **Minute 15–20**: Activate the documented architectural fallback from `blueprint/decisions.md` (e.g., if a specific origin chain's public RPC is lagging during optimistic tx check, switch demo origin asset to `Base Mainnet USDC` which has `2s` flashblocks).
- **Minute 20+**: Pair-debug or contact Aurora Intents mentor office hours on Telegram (`Aurora Telegram` link from hackathon resources) with the exact `auroraQuoteId` and `X-Correlation-Id`.

### C.4 Success Metrics Tracking Dashboard
| Metric ID | Target | Current Measured Value | Status |
| :--- | :--- | :--- | :--- |
| **NFR-001 (`x402` Verify Latency p95)** | `<= 15 ms` | `[Measure in Step 3.3]` | ⏳ / ✅ |
| **NFR-002 (Optimistic Credit Latency p95)** | `<= 400 ms` | `[Measure in Step 2.2]` | ⏳ / ✅ |
| **NFR-003 (Browser Groth16 Proof Time p95)** | `<= 2,200 ms` | `[Measure in Step 1.1 & 3.1]` | ⏳ / ✅ |
| **NFR-004 (On-Chain Solana Verify CU)** | `<= 140,000 CU` | `[Measure in Step 1.3]` | ⏳ / ✅ |
| **NFR-005 (Wallet Bytes Leaked to Merchant)** | `0 bytes` | `[Measure in Step 3.4]` | ⏳ / ✅ |
| **NFR-006 (WCAG 2.2 AA Contrast & `axe` Scan)** | `0 violations` | `[Measure in Step 0.2 & 4.2]` | ⏳ / ✅ |
| **NFR-007 (Chain-to-DB DR Rebuild Time)** | `<= 30 s` (`RPO=0`) | `[Measure in Step 1.4]` | ⏳ / ✅ |

---

## 8. CROSS-CUTTING SECTION D: ENVIRONMENT-SPECIFIC DEPLOYMENT CHECKLIST

### D.1 Pre-Deployment Testing Requirements (All Environments)
- [ ] `npx tsx scripts/verify_blueprint_gates.ts` exits `0` (`8/8` Phase-8 checks pass).
- [ ] `npm audit --audit-level=high` and `cargo audit` report `0` vulnerabilities.
- [ ] `npm run build` succeeds with First Load JS `<= 180 KB`.
- [ ] All 22 environment variables in `.env.example` are populated for the target environment.

### D.2 Solana Devnet Deployment Steps (Milestone 0 & Milestone 1)
1. [ ] Set CLI to Devnet: `solana config set --url https://api.devnet.solana.com`
2. [ ] Check deployer balance (`>= 2.5 SOL`): `solana balance` (run `solana airdrop 2` if needed).
3. [ ] Build SBF binary & IDL: `anchor build`
4. [ ] Sync program keypair ID into `Anchor.toml` and `lib.rs` (`declare_id!`).
5. [ ] Deploy to Devnet: `anchor deploy --provider.cluster devnet`
6. [ ] Initialize `ZkYieldVault` PDA on Devnet: `NEXT_PUBLIC_SOLANA_NETWORK=devnet npx tsx scripts/deploy_and_seed_vault.ts`
7. [ ] Verify on Solana Explorer: `solana program show <PROGRAM_ID> --url devnet`

### D.3 Solana Mainnet-Beta & Vercel Production Deployment Criteria (Step 4.3 & Step 4.4)
1. [ ] **Mainnet Micro-Liquidity Readiness (`ADR-006`)**: Relayer wallet (`SOLANA_RELAYER_PRIVATE_KEY_BASE58`) holds `>= 0.15 SOL` for transaction fees and `$20.00 USDC` (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) to seed the 90/10 DeFi Float Pool.
2. [ ] **Aurora Studio Credentials**: Production `AURORA_STUDIO_JWT_TOKEN`, `NEXT_PUBLIC_AURORA_WIDGET_API_KEY`, and `AURORA_INTEGRATOR_FEE_RECIPIENT` (`30 bps`) configured in Vercel Production Environment Variables.
3. [ ] **Database & Redis Production State**: `npm run db:migrate:up` executed against Neon Production branch; Upstash Redis TLS connection verified.
4. [ ] **Deploy to Vercel Production**: `vercel --prod`

### D.4 Post-Deployment Verification & Smoke Tests
1. [ ] Run automated production smoke suite:
   ```bash
   PLAYWRIGHT_TEST_BASE_URL=https://refract402.vercel.app npx playwright test tests/e2e/prod-smoke.spec.ts
   ```
2. [ ] Verify `GET https://refract402.vercel.app/api/v1/health` returns `200 OK` with `"postgres":"ok"`, `"redis":"ok"`, `"auroraOneClickReachable":true`.
3. [ ] Execute 1 live end-to-end Mainnet micro-deposit (`$2.00–$5.00 USDC` from Base/Arbitrum $\rightarrow$ `<400ms` optimistic credit $\rightarrow$ `/playground` private `x402` AI chat $\rightarrow$ Double-Blind Inspector verification $\rightarrow$ `1Click` cross-chain refund) and record the transaction hashes in `README.md`.

### D.5 Production Rollback Plan
If `prod-smoke.spec.ts` fails after a Vercel production deployment:
1. Promote the previous passing Vercel deployment alias immediately (`vercel rollback --yes`, `< 5 seconds`).
2. If the failure was caused by an off-chain Merkle cache desync, run `npm run db:rebuild-from-chain` (`< 30 seconds`) to restore `merkle_leaves` from Solana on-chain events.

---

## 9. CROSS-CUTTING SECTION E: COMMUNICATION TEMPLATES

### E.1 Daily / Milestone Progress Update Template
```markdown
📣 **REFRACT BUILD UPDATE — Milestone [M] Complete**
- **Milestone**: M[X] - [Milestone Name]
- **Status**: 🟢 ON TRACK ([X]/20 Atomic Steps Complete)
- **What Shipped**:
  1. [Deliverable 1 + file/endpoint]
  2. [Deliverable 2 + file/endpoint]
- **Verified Benchmarks**:
  - Solana Groth16 Verify: `[X] CU` | x402 Gateway Verify: `[X] ms` | Optimistic Credit: `[X] ms`
- **Next Up**: Starting Step [M+1.1] ([Step Name]) — ETA [X] mins.
```

### E.2 Issue / Bug Reporting Format (Internal & Aurora Mentor Office Hours)
```markdown
🚨 **ISSUE REPORT — [Step M.N: Component Name]**
- **Severity**: [Blocker / High / Medium]
- **Environment**: [Localnet / Solana Devnet / Solana Mainnet-Beta / Aurora 1Click API]
- **Correlation / Quote ID**: `req_...` / `qt_aurora_...` / `Solana Tx: ...`
- **Expected Behavior**: [Exact Given/When/Then from `requirements.csv`]
- **Actual Behavior & Error Log**:
  ```text
  [Paste exact error output]
  ```
- **Fallback Activated (if >20 mins)**: [State fallback from Section B.1 / `decisions.md`]
```

### E.3 Test Results Summary Template (For PRs & Hackathon Judges)
```markdown
🧪 **VERIFICATION & TEST SUITE SUMMARY (`v2.0.0`)**
- **Schema & Migrations (`TEST-DB-001`)**: ✅ PASS (6 tables, 8 indexes, 10-way concurrency safe)
- **OpenAPI 3.1 Contract (`TEST-API-001/002`)**: ✅ PASS (0 Redocly lint errors, Schnorr receipts verified)
- **Solana Anchor SVM (`TEST-CHAIN-001/002/003`)**: ✅ PASS (`104,280 CU <= 140k CU`, Nullifier PDA replay blocked, 90/10 DeFi split verified)
- **Aurora Intents (`TEST-INT-001..005`)**: ✅ PASS (35+ chains, `confidentialMode: true`, `30 bps` fee, `<400ms` optimistic credit, 1Click auto-refund)
- **Security & Unlinkability (`TEST-SEC-001/002`)**: ✅ PASS (`0` wallet bytes leaked, `$2.50` prompt-injection blocked by `$0.10` firewall)
- **Accessibility & E2E (`TEST-A11Y-001`, `TEST-E2E-001/002`)**: ✅ PASS (WCAG 2.2 AA contrast verified, 0 `axe-core` violations at 1440px & 375px)
```

### E.4 Deployment Notification Template
```markdown
🚀 **DEPLOYMENT COMPLETE — Refract `v2.0.0` (`[Devnet / Production]`)**
- **Gateway & Studio URL**: `https://refract402.vercel.app`
- **Solana `RefractVault` Program ID**: `RefrctVlt1111111111111111111111111111111111`
- **Latest Verification Tx (Solscan)**: `https://solscan.io/tx/<TX_SIG>`
- **Smoke Test Status**: ✅ `prod-smoke.spec.ts` (All checks green)
```

---

## 10. CROSS-CUTTING SECTION F: GIT WORKFLOW & COMMIT STANDARDS

### F.1 Branch Naming Conventions
- `main`: Protected production-ready branch; every commit on `main` must pass `verify_blueprint_gates.ts`.
- `feat/m0-foundation`, `feat/m1-anchor-zk-vault`, `feat/m2-aurora-intents`, `feat/m3-x402-gateway`, `feat/m4-prism-ui`: Milestone feature branches.
- `fix/step-X.Y-<short-slug>`: Targeted hotfix branches if a CI gate fails.

### F.2 Commit Message Format (Conventional Commits)
Every atomic step produces exactly one commit using this format:
```text
<type>(<scope>): step <M.N> <imperative summary>

- Requirement IDs: R-XXX, R-YYY, NFR-ZZZ
- Tests Verified: TEST-XXX (PASS)
```
*Allowed `<type>` values*: `feat`, `fix`, `chore`, `test`, `docs`, `refactor`.
*Examples*:
- `feat(init): step 0.1 monorepo and devnet scaffold`
- `feat(anchor-zk): step 1.3 groth16-solana verifier and nullifier pda`
- `feat(aurora): step 2.1 1click quote endpoint and confidential adapter`
- `feat(x402-gateway): step 3.3 x402 v2 middleware and schnorr receipts`

### F.3 When to Commit & PR Merge Requirements
- **When to Commit**: Immediately after all 4 Testing Protocol phases (Unit, Integration, Devnet/SVM, Manual) pass and `progress.md` is updated for that step. **Never commit broken or untested code.**
- **PR / Milestone Merge Requirements**: Merging a milestone branch (`feat/mX-*`) into `main` requires:
  1. `npm test` and `anchor test` passing 100%.
  2. `progress.md` updated with all 4 steps of the milestone marked `✅ COMPLETE`.
  3. Zero untracked secret files (`.env` and keypair `.json` files must be listed in `.gitignore`).

---

## 11. APPENDICES

### Appendix 1: Complete Blueprint File Cross-Reference
| File Path | Role in Implementation |
| :--- | :--- |
| `blueprint/README.md` | Index, readiness status, and locked assumptions |
| `blueprint/blueprint.md` | 22-section master architecture & product blueprint |
| `blueprint/prd.md` | 12-section Product Requirements Document (`R-001`–`R-018`) |
| `blueprint/design-spec.md` | Pre-work capacity model, ADRs, and 10-section technical design |
| `blueprint/ui-spec.md` | 12-section UI/UX spec, 12 atomic components, and 3 ASCII wireframes |
| `blueprint/srd.md` | 18-section System Requirements Document & NFR test matrix |
| `blueprint/requirements.csv` | Machine-checkable requirements & Given/When/Then criteria |
| `blueprint/traceability.csv` | Bidirectional traceability matrix (`0` orphans) |
| `blueprint/decisions.md` | `ADR-001` to `ADR-007` and `GAP-001` to `GAP-003` |
| `blueprint/design-tokens.json` | W3C design tokens (WCAG 2.2 AA/AAA contrast verified) |
| `blueprint/schema.sql` | PostgreSQL 16 DDL (6 tables, 8 indexes, seed data) |
| `blueprint/openapi.yaml` | OpenAPI 3.1.0 REST specification (7 endpoints) |
| `blueprint/.env.example` | 22 required environment variables |
| `blueprint/models/load_and_cost.py` | Executable 1x, 10x, 100x load & cost model |
| `blueprint/spikes/verify_stack.ts` | Hour-1 Aurora `1Click` & Groth16 byte-alignment spike |
| `blueprint/prototype/index.html` | Working HTML/CSS prototype of `/studio`, `/playground`, `/merchant` |
| `blueprint/handoff.json` | Machine-readable agent handoff manifest |

### Appendix 2: Requirement-to-Milestone Execution Map
- **Milestone 0 (`Steps 0.1–0.4`)**: `R-003` (scaffold), `R-009` (vault-stats), `R-017` (tokens/a11y), `SEC-04`, `SEC-05`.
- **Milestone 1 (`Steps 1.1–1.4`)**: `R-004` (Merkle tree), `R-005` (circuit), `R-006` (`groth16-solana`), `R-009` (90/10 DeFi split), `NFR-004`, `NFR-007`, `SEC-01`.
- **Milestone 2 (`Steps 2.1–2.4`)**: `R-001` (35+ chains), `R-002` (`confidentialMode`), `R-003` (deposit worker), `R-010` (`<400ms` optimistic credit), `R-011` (reverse refund), `R-014` (`30 bps` fee), `NFR-002`, `SEC-02`.
- **Milestone 3 (`Steps 3.1–3.4`)**: `R-004` (local note vault), `R-005` (WebWorker prover), `R-007` (`HTTP 402` challenge), `R-008` (`<15ms` Runtime Keys + Schnorr receipts), `R-012` (AI router), `R-013` (`$0.10` firewall), `R-016`, `NFR-001`, `NFR-003`, `NFR-005`, `SEC-03`, `SEC-04`.
- **Milestone 4 (`Steps 4.1–4.4`)**: `R-012` (UI), `R-015` (Double-Blind Inspector), `R-017` (WCAG 2.2 AA E2E), `R-018` (scope gate).

---

## 12. QUICK REFERENCE CARDS

### Card 1: Essential Developer Commands Cheat Sheet
```bash
# 1. Database Migrations & Chain Disaster Recovery Rebuild
npm run db:migrate:down && npm run db:migrate:up
npm run db:rebuild-from-chain

# 2. Compile Circom Circuit & Export Rust Verifying Key
node scripts/compile_circuit.mjs

# 3. Build, Test & Deploy Solana Anchor Program (Localnet & Devnet)
anchor build
anchor test
anchor deploy --provider.cluster devnet

# 4. Run Unit, Integration, Security & AI Agent Benchmark Suites
npm run test:unit
npm run test:integration
npm run test:security
npx vitest run tests/ai/x402_agent_eval.test.ts

# 5. Run WCAG 2.2 AA Contrast, OpenAPI Lint & Playwright E2E
npm run verify:contrast
npx @redocly/cli lint blueprint/openapi.yaml
npx playwright test

# 6. Run Master Phase-8 Verification Gate (All 8 Checks)
npm run verify:gates
```

### Card 2: Cryptographic Invariants & Endianness Card (Do Not Violate!)
1. **BN254 Base Field Prime ($q$ — used for G1/G2 point coordinates & `proof_a` y-negation)**:
   `21888242871839275222246405745257275088696311157297823662689037894645226208583n`
2. **BN254 Scalar Field Prime ($r$ — used for Poseidon hashes & public inputs)**:
   `21888242871839275222246405745257275088548364400416034343698204186575808495617n`
3. **`groth16-solana` `0.2.0` Serialization Rules**:
   - All coordinates and public inputs must be **32-byte big-endian** `Uint8Array` slices.
   - `proof_a` (64B G1): `[x_be (32B), (q - y)_be (32B)]` (Negated y-coordinate!).
   - `proof_b` (128B G2): `[x_c1_be (32B), x_c0_be (32B), y_c1_be (32B), y_c0_be (32B)]` (EIP-197 swapped Fq2 order!).
   - `proof_c` (64B G1): `[x_be (32B), y_be (32B)]`.
   - `public_inputs` (`[[u8; 32]; 4]`): `[merkle_root, nullifier_hash, spend_cap_micro_usdc, session_pubkey_hash]`.

### Card 3: 90-Second Live Hackathon Demo Run Sheet
- **`0:00 – 0:15` (The Hook)**: Show standard `x402` doxxing a buyer's wallet and bridges stalling for 30s. Introduce **Refract**: 35+-chain **Aurora Confidential Intents** $\rightarrow$ **90/10 Solana DeFi Yield Float** $\rightarrow$ **Unlinkable `zkAPI` Groth16 notes** for `x402`.
- **`0:15 – 0:40` (`/studio` — Any-Chain Deposit & `<400ms` Optimistic Credit)**: Select `10.00 USDC` on Base with **`[x] Aurora Confidential Intents ON`** (`30 bps` integrator fee). Click **"Refract Liquidity & Mint Note"** $\rightarrow$ show `.json` backup auto-download and the **`<400ms` `$5.00` Optimistic Float Credit** banner lighting up immediately while 90% routes to Kamino (`+9.4% APY`).
- **`0:40 – 1:10` (`/playground` — `<15ms` Private `x402` AI Chat & Double-Blind Inspector)**: Send an AI prompt $\rightarrow$ watch `HTTP 402` settle in `11ms` via `rk_live_*` Runtime Key with a verified **Schnorr Receipt (`X-ZKAPI-RECEIPT`)**. Open the **Double-Blind Privacy Inspector** proving `Origin Chain != Solana Nullifier != AI Server (0 Wallet Bytes Sent)`.
- **`1:10 – 1:30` (Agent Spend Firewall & `1Click` Cross-Chain Auto-Refund)**: Click **"Simulate `$2.50` Prompt-Injection Attack"** $\rightarrow$ show `HTTP 403 ERR_SPEND_CAP_EXCEEDED` blocking the drain (`$0.10` cap). Click **"Close Note & Auto-Refund Cross-Chain"** $\rightarrow$ refund unspent balance to Arbitrum via **Aurora `1Click API`**.


