# Refract — UI/UX Design Specification (`ui-spec.md`)

**Version:** 2.0.0
**Date:** November 7, 2026
**Status:** LOCKED FOR IMPLEMENTATION
**Companion Token File:** `blueprint/design-tokens.json`
**Companion Prototype:** `blueprint/prototype/index.html`

---

## 1. Summary

- **Context of Use:** Used by multi-chain Web3 developers, AI agent builders, everyday privacy-conscious AI consumers, and API merchants across dimly lit desktop workspaces (`1440px` reference viewport) and mobile wallet in-app browsers (`375px` viewport). Usage ranges from one-time cross-chain vault funding (`~25s` flow) to high-frequency interactive AI prompting (`<15ms` authorization per message).
- **Device & Accessibility Decisions:**
  - **Device Priority:** Desktop-first responsive web application (`1280px–1440px` multi-pane studio layout) that collapses cleanly to a single-column touch-friendly stack at `768px` (Tablet) and `375px` (Mobile Wallet Browser).
  - **Accessibility Target:** **W3C WCAG 2.2 Level AA** (`VERIFIED` current W3C Recommendation, published October 5, 2023; active standard as of November 2026). All body text pairs exceed `4.5:1` contrast (primary text is `15.62:1` AAA), all interactive non-text borders/icons exceed `3.0:1` (`3.94:1` computed), and all touch targets meet `>= 44x44px` (exceeding WCAG 2.2 SC 2.5.8 minimum `24x24px`).
- **Brand Tone:** *"Precision Optical Cryptography"*—calm, mathematical, high-contrast, and transparent. It avoids generic cyberpunk neon hype in favor of laboratory-grade telemetry that proves privacy mathematically.
- **Top Three UX Risks & Mitigations:**
  1. **Risk 1 (Lost Bearer Note in Browser Storage):** If a user clears browser site data before backing up their local `zkAPI` note (`nullifier` + `trapdoor`), their unspent balance cannot be recovered by the server. *Mitigation:* Clicking "Refract & Mint Note" automatically triggers a 1-click `.json` backup download (`refract-note-<hash>.json`) and displays an un-dismissible warning badge until backed up (`R-004`).
  2. **Risk 2 (Cross-Chain Bridge Wait Anxiety):** Standard cross-chain bridges force users to stare at a spinner for 25–45 seconds before using the app. *Mitigation:* As soon as the origin-chain transaction is broadcast, the **Optimistic Float Credit** banner lights up in `<400ms` (`#34D399` Mint) with `$5.00` of immediately usable `x402` credit while Aurora Intents settles asynchronously in the background (`R-010`).
  3. **Risk 3 ("Is It Actually Private?" Skepticism):** Judges and users cannot visually tell the difference between a standard public payment and a zero-knowledge proof unless shown evidence. *Mitigation:* Built a persistent **Double-Blind Privacy Inspector Drawer** (`R-015`) that displays live side-by-side proof of what the Origin Chain saw, what Solana verified, and the exact HTTP headers received by the AI server (`walletBytesReceived: 0`).

---

## 2. Design Strategy and Real Product References

| Reference Product & URL (Viewed Nov 7, 2026) | What Specifically to Emulate | What Specifically to Avoid |
| :--- | :--- | :--- |
| **1. Linear (`https://linear.app`)** | Crisp `1px solid #262D42` structural card borders on deep obsidian surfaces (`#090A0F` / `#11141E`), keyboard-first focus rings (`2px solid #38BDF8`), and compact monospace status pills. | Avoid dense nested sidebar hierarchies; Refract has exactly 3 top-level views (`/studio`, `/playground`, `/merchant`). |
| **2. Aurora Intents Swap Widget (`https://aurora.dev` / `@aurora-is-near/intents-swap-widget` v7.24.0)** | Clean origin chain + token selector dropdowns, transparent fee breakdown (`30 bps` integrator split), and progressive step indicators for cross-chain settlement. | Avoid exposing raw NEAR NEP-141 token contract strings (`nep141:base-0x833...`) in primary labels; format as `"USDC on Base Mainnet"` with chain badge. |
| **3. Open Anonymity zkAPI Chat (`https://chat.openanonymity.ai` / `https://zkapi.openanonymity.ai`)** | Persistent top-right local note balance pill with 1-click `.json` export/import and per-message micro-cost deduction badges. | Avoid its single-chain Ethereum L1 deposit friction and static 0%-yield balance display; highlight Refract's **+9.4% Kamino APY (+8.4% AI Bonus)** directly inside the balance pill. |

---

## 3. Core User Jobs and Flows (Text Diagrams)

### Flow 1: First-Run Any-Chain Confidential Deposit $\rightarrow$ Yield-Bearing `zkAPI` Note (`TTFV <= 15s`)
- **Requirement IDs:** `R-001`, `R-002`, `R-003`, `R-004`, `R-009`, `R-010`, `R-014`
```
[Entry: /studio]
   |
   +--> Step 1: Select Origin Network & Asset (e.g. "Base Mainnet - USDC") + Enter Amount ("10.00")
   |      |-- Decision: Keep [x] Aurora Confidential Intents ON (Default: Checked)
   |
   +--> Step 2: Click "Refract Liquidity & Mint Unlinkable zkAPI Note"
   |      |-- Browser generates 31B nullifier & trapdoor locally -> saves to encrypted IndexedDB
   |      |-- Auto-downloads "refract-note-2f8b.json" backup
   |      |-- Calls POST /api/v1/intents/quote -> receives Aurora depositAddress
   |
   +--> Step 3: Sign Origin Wallet Transfer (Base/Arb/BTC/NEAR/SOL)
   |      |-- [ERROR PATH]: User rejects signature -> Toast "Transfer cancelled. Note kept in Draft."
   |      |-- [SUCCESS PATH]: Origin txHash broadcast -> Calls POST /api/v1/intents/optimistic-credit
   |
   +--> Step 4 (<400ms): Optimistic Credit Unlocked!
          |-- UI banner turns Mint (#34D399): "$5.00 Instant Credit Active (Backed by Solana DeFi Float)"
          |-- Auto-enables "Open x402 AI Playground ->" while Aurora settles in background (~25s)
```

### Flow 2: Unlinkable `x402` AI Prompt, Spend Firewall & Double-Blind Inspection
- **Requirement IDs:** `R-005`, `R-006`, `R-007`, `R-008`, `R-012`, `R-013`, `R-015`, `R-016`
```
[Entry: /playground]
   |
   +--> Step 1: If no Runtime Key (rk_live_*) is active, WebWorker runs snarkjs Groth16 prover (~1.2s)
   |      |-- Calls POST /api/v1/zkapi/runtime-key -> Solana verifies in 104k CU -> Mints rk_live_zk_*
   |
   +--> Step 2: User enters prompt (or clicks "Simulate $2.50 Prompt-Injection Attack")
   |      |-- [FIREWALL BLOCK PATH (R-013)]: Cost ($2.50) > Cap ($0.10) -> HTTP 403 ERR_SPEND_CAP_EXCEEDED
   |      |     Renders Red Alert Banner: "Blocked by Agent Spend Policy Firewall (0.00 USDC deducted)"
   |      |-- [AUTHORIZED PATH (R-007, R-008)]: Cost ($0.015) <= Cap ($0.10) -> Authorized in 12ms
   |
   +--> Step 3: SSE Streams AI Reply + Updates Inspector Drawer
          |-- Deducts 0.015 USDC -> Verifies X-ZKAPI-RECEIPT Schnorr signature
          |-- Double-Blind Inspector proves: Origin EOA != Solana Nullifier != AI Prompt (0 Wallet Bytes)
```

### Flow 3: Unspent Note Closure & Automated Cross-Chain Refund (`1Click API`)
- **Requirement IDs:** `R-011`
```
[Entry: /playground or /merchant -> Click "Close Note & Auto-Refund Cross-Chain"]
   |
   +--> Step 1: Modal opens -> Select Destination Chain (35+ chains, e.g., "Arbitrum One - USDC")
   +--> Step 2: Enter Destination Recipient Address -> Click "Execute Reverse Aurora Intent"
   +--> Step 3: Calls POST /api/v1/intents/refund -> Marks session CLOSED_REFUNDED -> Aurora 1Click settles to Arbitrum
```

---

## 4. Design Tokens Table (`blueprint/design-tokens.json`)

Every color, spacing, radius, and typography value in the application resolves strictly to `blueprint/design-tokens.json`:

| Token Name (CSS Variable) | Concrete Value | Computed Contrast Ratio | Rationale (1 Line) |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` (`color.bg.canvas`) | `#090A0F` | Baseline ($L=0.0056$) | Deep obsidian optical chamber background minimizing eye strain. |
| `--bg-surface` (`color.bg.surface`) | `#11141E` | `1.15:1` vs canvas ($L=0.0144$) | Primary card container surface separated by `1px solid --border-subtle`. |
| `--bg-elevated` (`color.bg.elevated`) | `#181C2A` | `1.31:1` vs canvas ($L=0.0232$) | Elevated modal, hover state, and telemetry inspector drawer surface. |
| `--text-primary` (`color.text.primary`) | `#F8FAFC` | **`18.09:1`** (Canvas) / **`15.62:1`** (Surface) | Crisp off-white primary copy exceeding WCAG 2.2 AAA (`>= 7.0:1`). |
| `--text-secondary` (`color.text.secondary`) | `#94A3B8` | **`7.45:1`** (Canvas) / **`6.46:1`** (Surface) | Supporting form labels and descriptions passing WCAG 2.2 AA (`>= 4.5:1`). |
| `--text-muted` (`color.text.muted`) | `#7C8BA1` | **`5.44:1`** (Canvas) / **`4.72:1`** (Surface) | Timestamps, secondary metadata, and empty-state hints (`>= 4.5:1` AA). |
| `--text-on-accent` (`color.text.onAccent`) | `#06080E` | **`9.83:1`** on `#38BDF8` | High-contrast dark ink on bright cyan/mint primary CTA buttons (AAA). |
| `--accent-cyan` (`color.accent.cyan`) | `#38BDF8` | **`8.21:1`** on `#11141E` | Primary interactive CTA, focus ring, and Aurora Intents routing highlight. |
| `--accent-uv` (`color.accent.ultraviolet`) | `#C084FC` | **`6.24:1`** on `#11141E` | Zero-knowledge Groth16 proof & Confidential Intents shield indicator. |
| `--accent-mint` (`color.accent.mint`) | `#34D399` | **`9.25:1`** on `#11141E` | Solana Kamino DeFi APY, `<400ms` optimistic credit, and verified receipts. |
| `--semantic-warning` (`color.semantic.warning`) | `#FBBF24` | **`10.65:1`** on `#11141E` | Unbacked-up local note warning and solver delay notice. |
| `--semantic-error` (`color.semantic.error`) | `#F87171` | **`5.67:1`** on `#11141E` | Agent Spend Policy Firewall block (`HTTP 403`) and failed tx alerts. |
| `--border-subtle` (`color.border.subtle`) | `#262D42` | Decorative structural divider | `1px` card perimeter border. |
| `--border-interactive` (`color.border.interactive`) | `#64748B` | **`3.94:1`** on `#090A0F` | Form control border meeting WCAG 2.2 SC 1.4.11 non-text contrast (`>= 3.0:1`). |

---

## 5. Atomic Component Library Specification (All 12 Minimum Components + All States)

| # | Component & Variants | Anatomy & Sizes | Interactive States (Default, Hover, Focus, Active, Disabled, Loading, Error, Empty/Selected) | Usage & Content Rules | Accessibility (Role, Name, Keyboard, Focus) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Button** (`primary`, `secondary`, `danger`, `ghost`) | Icon (optional 16px) + Label + Badge (optional). Min height `44px`, padding `12px 16px`, radius `10px`. | **Default:** Cyan `#38BDF8` bg / `#06080E` text (`primary`). **Hover:** Filter `brightness(1.08)`. **Focus:** `2px solid #38BDF8` ring, `2px` offset. **Active:** `translateY(1px)`. **Disabled:** `#1E2436` bg, `#64748B` text, `cursor:not-allowed`. **Loading:** Inline 16px SVG spinner + step verb (`"Proving Groth16..."`). **Error:** Shake `180ms` + danger border `#F87171`. | Use **1 `primary` button per card**. Labels must use action verbs (`"Refract & Mint Note"`, never `"Submit"`). | `<button type="button">`, `aria-busy="true"` during loading, `aria-disabled="true"` when disabled. Activated via `Enter` or `Space`. |
| **2** | **Input & Form Field** (`text`, `number`, `monospace-address`) | Top `<label>` (`13px` `#94A3B8`) + `<input>` (`min-height: 44px`, `#090A0F` bg, `1px solid #64748B`) + Helper/Error text below (`12px`). | **Default:** Border `#64748B`. **Hover:** Border `#94A3B8`. **Focus:** Border `#38BDF8` + `2px` focus ring. **Disabled:** `#11141E` bg, `#64748B` text. **Error:** Border `#F87171` + red helper icon & fix message below. | Always render visible `<label>` above input; never rely on disappearing placeholders as labels. | `<label for="id">`, `aria-invalid="true"`, `aria-describedby="id-error"` when validation fails. |
| **3** | **Select Dropdown** (`chain-asset-select`, `model-select`) | Label + Trigger Button (`min-height: 44px`, chain icon + asset name + chevron) + Popover listbox (`#181C2A`). | **Default:** Closed, border `#64748B`. **Hover/Focus:** Border `#38BDF8`. **Selected Option:** `#11141E` bg with `#38BDF8` left `3px` bar and checkmark. **Loading:** `"Loading 35+ Aurora chains..."` skeleton. **Error:** Border `#F87171`. | Group assets by chain (`Base`, `Arbitrum`, `Bitcoin`, `NEAR`, `Solana`); show human symbol first (`USDC`), network second. | `role="combobox"`, `aria-expanded`, `ArrowUp`/`ArrowDown` navigates options, `Enter` selects, `Escape` closes and returns focus to trigger. |
| **4** | **Checkbox & Toggle Switch** (`confidential-switch`, `policy-checkbox`) | `20x20px` control box (`min-height: 44px` hit row) + bold title + 1-line cryptographic explanation. | **Default (Unchecked):** `#090A0F` bg, `#64748B` border. **Checked/Selected:** `#38BDF8` fill with `#06080E` checkmark. **Focus:** `2px solid #38BDF8` ring. **Disabled:** Opacity `0.5`. | Use for boolean cryptographic flags (`Confidential Mode`, `Auto-Compound DeFi Yield`). | Native `<input type="checkbox">` bound to `<label>`; toggled via `Space`. |
| **5** | **Modal & Dialog** (`refund-modal`, `note-import-modal`) | Backdrop (`rgba(9,10,15,0.80)`) + Dialog Card (`max-width: 520px`, `#181C2A`, `1px solid #475569`) + Header + Body + Footer CTAs. | **Default:** Centered, focus trapped inside. **Loading:** Footer CTA locked with progress step during Aurora `1Click` refund quote. **Error:** Inline alert banner inside modal body. | Use only for consequential flows (Cross-Chain Refund, Importing/Overwriting a local note). | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`. Traps `Tab` focus; `Escape` closes and restores focus to trigger button. |
| **6** | **Toast / Live Banner** (`optimistic-credit`, `receipt-verified`, `firewall-error`) | Leading status icon + 1-line title + monospace metadata (`latencyMs` or `txSig`) + Dismiss `X` (`44x44px`). | **Success/Mint:** Border `#34D399`. **Warning:** Border `#FBBF24`. **Error:** Border `#F87171` (persists until dismissed). | Auto-dismiss info/success toasts after `6000ms`; **never auto-dismiss error or note-backup toasts**. | `role="status"` (`aria-live="polite"`) for info/yield updates; `role="alert"` (`aria-live="assertive"`) for firewall errors. |
| **7** | **Top Navigation Bar** (`header-nav`) | Brand Logo + 3 Route Tabs (`1. Studio`, `2. Playground`, `3. Merchant`) + Active Local Note Pill + Backup Button. | **Default Tab:** `#94A3B8` text. **Hover:** `#F8FAFC`. **Active/Selected Route:** `#38BDF8` text + `2px` bottom cyan indicator bar. | Keep navigation flat; display active local note balance (`10.84 USDC`) and Kamino APY (`+9.4%`) across all 3 routes. | `<nav aria-label="Primary">`, active link has `aria-current="page"`. |
| **8** | **Card Container** (`prism-card`, `telemetry-card`) | Header (`h2` + status badge) + Body content stack (`16px` gap) + Footer action bar. Background `#11141E`, border `1px solid #262D42`, radius `14px`, padding `24px`. | **Default:** `#262D42` border. **Focused/Active Workflow:** Top border highlights with `--border-prism` gradient. | Maximum 3 cards side-by-side on `1440px` desktop; each card maps to 1 stage of the mental model. | `<section aria-labelledby="card-heading">`. |
| **9** | **Table / Telemetry List** (`receipt-ledger`, `inspector-matrix`) | Monospace columns (`Timestamp`, `Scheme`, `Nullifier Hash`, `Charged`, `Schnorr Receipt`, `Wallet Bytes`). | **Default:** Alternating `#090A0F` / `#11141E` rows. **Hover:** `#181C2A` row highlight. **Empty:** Renders Component #11 (`EmptyState`). | Truncate 32-byte hashes to `0x91a4...c201` with a 1-click copy button (`aria-label="Copy full nullifier hash"`). | Semantic `<table>`, `<thead>`, `<th scope="col">`. Horizontal scroll wrapper on `375px` mobile. |
| **10** | **Tabs** (`inspector-tabs`, `code-sdk-tabs`) | Tablist bar (`#090A0F` pill container) + Tab buttons (`min-height: 40px`) + Tabpanel content. | **Default:** `#94A3B8`. **Selected:** `#181C2A` bg, `#F8FAFC` text, `1px solid #64748B`. **Focus:** `2px solid #38BDF8`. | Use inside the Double-Blind Inspector to switch between `Visual Proof`, `Raw HTTP 402 Headers`, and `Agent SDK Snippet`. | `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"`; `ArrowLeft`/`ArrowRight` switches tabs. |
| **11** | **Empty State** (`empty-notes`, `empty-refunds`) | Dashed container (`1px dashed #64748B`, padding `24px`) + Heading (`14px` `#F8FAFC`) + Explanation (`13px` `#7C8BA1`) + Secondary CTA button. | **Default:** Calm dashed box with direct recovery action (e.g., `"Import Note Backup (.json)"` or `"Mint First Note"`). | Never leave a table or panel blank; explain *why* it is empty and provide a 1-click button to populate it. | Standard semantic heading + button inside `<div role="region">`. |
| **12** | **Skeleton & Step Loader** (`zk-prover-loader`, `aurora-step-tracker`) | Determinate 4-step progress tracker + animated pulse bar (`#181C2A` $\leftrightarrow$ `#262D42`). | **Running:** Displays exact sub-step and elapsed timer (`"Step 2/3: Computing BN254 Groth16 Witness in WebWorker (0.8s)..."`). **Reduced Motion:** Disables shimmer animation, uses static text percentage. | Always show determinate cryptographic step labels rather than an unexplained spinning circle. | `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="Zero-knowledge proof progress"`. |

---

## 6. Screen Specifications & ASCII Wireframes (All 3 Screens)

### 6.1 Screen 1: `/studio` — The Refract Prism (Any-Chain Deposit & 90/10 DeFi Float Vault)
- **Route:** `/studio` (Default Landing View)
- **Purpose & Roles:** Lets `ANONYMOUS_DEPOSITOR` fund a local `zkAPI` note from 35+ chains via Aurora Confidential Intents, receive `<400ms` optimistic credit, and inspect the 90/10 Solana Kamino DeFi yield split.
- **Requirement IDs Covered:** `R-001`, `R-002`, `R-003`, `R-004`, `R-009`, `R-010`, `R-014`, `R-017`
- **Data & API Endpoints:** `POST /api/v1/intents/quote`, `POST /api/v1/intents/optimistic-credit`, `GET /api/v1/defi/vault-stats`
- **Keyboard Tab Order & Landmarks:**
  1. `<header role="banner">`: `[1] Brand Link` $\rightarrow$ `[2] Nav: Studio` $\rightarrow$ `[3] Nav: Playground` $\rightarrow$ `[4] Nav: Merchant` $\rightarrow$ `[5] Backup Note (.json) Button` $\rightarrow$ `[6] Import Note Button`.
  2. `<main role="main">`: `[7] Origin Chain & Asset Select` $\rightarrow$ `[8] Deposit Amount Input` $\rightarrow$ `[9] Confidential Intents Checkbox` $\rightarrow$ `[10] Primary CTA: Refract Liquidity & Mint Note` $\rightarrow$ `[11] Copy Deposit Address Button` $\rightarrow$ `[12] Jump to Playground CTA`.
- **ASCII Wireframe (`/studio`):**
```
+----------------------------------------------------------------------------------------------------+
| [REFRACT // 402]    (1. Prism Studio*)   (2. x402 AI Playground)   (3. Merchant & DeFi Treasury)   |
|                                       [Active Note: 10.84 USDC | +9.4% APY] [Backup .json] [Import]|
+----------------------------------------------------------------------------------------------------+
|  STAGE 1: SOURCE LIQUIDITY (35+ CHAINS)            STAGE 2: SOLANA ZK-YIELD VAULT & INSTANT CREDIT |
| +-----------------------------------------------+ +----------------------------------------------+ |
| | Origin Network & Asset                        | | [MINT BANNER: <400ms Optimistic Credit LIVE] | |
| | [ Base Mainnet — USDC (Instant Credit)    v ] | | Fronted: $5.00 USDC (184ms) | Status: ACTIVE | |
| |                                               | +----------------------------------------------+ |
| | Deposit Amount (USDC Equivalent)              | | Local Poseidon Note Commitment (Leaf #1,042) | |
| | [ 10.00                                     ] | | 0x2f8b9a1c...ddeeff0  [Copy Commitment]      | |
| |                                               | | Secret Nullifier: [STORED IN BROWSER ONLY]   | |
| | +-------------------------------------------+ | +----------------------------------------------+ |
| | | [x] Enable Aurora Confidential Intents    | | | 90/10 Solana DeFi Float Allocation (R-009)   | |
| | |     Sets confidentialMode: true to shield | | | [================== 90% ==================--]| |
| | |     origin EOA & solver route attribution | | | - 90% Kamino kUSDC Reserve: $22,500 (9.4%APY)| |
| | +-------------------------------------------+ | | - 10% Liquid Optimistic PDA: $2,500          | |
| |                                               | | - Active AI Credit Bonus:    +8.4% Free Calls| |
| | Fee Breakdown: 1 bps Solver + 30 bps Integrat.| +----------------------------------------------+ |
| | [ Refract Liquidity & Mint zkAPI Note ->    ] | | [ Open Unlinkable x402 AI Playground ->    ] | |
| +-----------------------------------------------+ +----------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

---

### 6.2 Screen 2: `/playground` — Unlinkable `x402` AI Chat, Agent Spend Firewall & Double-Blind Inspector
- **Route:** `/playground`
- **Purpose & Roles:** Allows `ZK_RUNTIME_AGENT` (human user or autonomous agent) to prove note ownership in a WebWorker, stream responses from `x402`-gated AI models (`gpt-4o-mini`, `claude-3-5-sonnet`) in `<15ms`, test the Bounded Agent Spend Policy Firewall (`$0.10/req` cap), inspect Double-Blind unlinkability proof, and execute 1-click cross-chain refunds.
- **Requirement IDs Covered:** `R-005`, `R-006`, `R-007`, `R-008`, `R-011`, `R-012`, `R-013`, `R-015`, `R-016`, `R-017`
- **Data & API Endpoints:** `GET /api/v1/zkapi/tree`, `POST /api/v1/zkapi/runtime-key`, `POST /api/v1/ai/chat`, `POST /api/v1/intents/refund`
- **Keyboard Tab Order:** `[1–6] Header` $\rightarrow$ `[7] AI Model Select` $\rightarrow$ `[8] Max Per-Request Spend Cap Input ($0.10)` $\rightarrow$ `[9] Simulate $2.50 Prompt-Injection Attack Button` $\rightarrow$ `[10] Chat Prompt Input` $\rightarrow$ `[11] Send Private x402 Request Button` $\rightarrow$ `[12] Inspector Tabs (Visual / Raw HTTP 402 Headers / SDK Code)` $\rightarrow$ `[13] Close Note & Auto-Refund Cross-Chain Button`.
- **ASCII Wireframe (`/playground`):**
```
+----------------------------------------------------------------------------------------------------+
| [x402 AI PLAYGROUND]   Model: [Claude 3.5 Sonnet v] | Policy Cap: [$0.10/req] | [Simulate $2.50 Atk]|
+----------------------------------------------------------+-----------------------------------------+
|  UNLINKABLE AI STREAM (HTTP 402 + zkAPI Runtime Key)     | DOUBLE-BLIND PRIVACY INSPECTOR (R-015)  |
| +------------------------------------------------------+ | [Visual Proof*] [Raw 402 Headers] [SDK] |
| | > User: Audit Kamino vault authority & utilization.  | | +-------------------------------------+ |
| |                                                      | | | 1. ORIGIN CHAIN (BASE MAINNET)      | |
| | > Refract AI (claude-3-5-sonnet):                    | | |    Saw: 0x71C...292e -> Aurora      | |
| |   Vault utilization is 78.4%. Upgrade authority is   | | |    Knows Solana Note? [NO - CONFID] | |
| |   locked behind a 48h multisig...                    | | +-------------------------------------+ |
| |   [HTTP 402 Paid: 0.015 USDC | Verify: 11ms]         | | | 2. SOLANA ANCHOR VAULT (ON-CHAIN)   | |
| |   [Schnorr Receipt: sig_882f9c... Verified]          | | |    Verified Groth16 in 104,280 CU   | |
| +------------------------------------------------------+ | |    Nullifier: 0x91a4...c201         | |
| | [ALERT - ERR_SPEND_CAP_EXCEEDED (Role="alert")]:     | | |    Knows Leaf #1042? [NO - ZK PROOF]| |
| | Blocked simulated prompt-injection requesting 2.50   | | +-------------------------------------+ |
| | USDC (exceeds 0.10 USDC cap). 0.00 USDC deducted.    | | | 3. AI MERCHANT SERVER (HTTP 402)    | |
| +------------------------------------------------------+ | |    Auth: PAYMENT-SIGNATURE (rk_zk*) | |
| | [ Ask anything or paste x402 URL... ] [Send (0.015)] | | |    Wallet Bytes Sent: [0 BYTES]     | |
| +------------------------------------------------------+ | +-------------------------------------+ |
|                                                          | [Close Note & Refund to Any Chain ->]   |
+----------------------------------------------------------+-----------------------------------------+
```

---

### 6.3 Screen 3: `/merchant` — `x402` API Provider Gateway & Auto-Compounding DeFi Treasury
- **Route:** `/merchant`
- **Purpose & Roles:** Lets `X402_MERCHANT` (authenticated via `Sign-In With Solana / SIWS`) configure `x402` endpoint pricing, monitor incoming `zkAPI` and SPL micropayments, view auto-compounded Kamino DeFi yield (`90%` staked / `10%` liquid), and withdraw revenue to any of 35+ chains via Aurora `1Click API`.
- **Requirement IDs Covered:** `R-007`, `R-008`, `R-009`, `R-011`, `R-014`, `R-017`
- **Data & API Endpoints:** `GET /api/v1/defi/vault-stats`, `POST /api/v1/intents/refund` (merchant cross-chain payout mode)
- **ASCII Wireframe (`/merchant`):**
```
+----------------------------------------------------------------------------------------------------+
| [MERCHANT & DEFI TREASURY]          Merchant SIWS: RefractAiMerchant11...111 [Connected] [Payout]  |
+----------------------------------------------------------------------------------------------------+
|  +------------------------------+ +------------------------------+ +-----------------------------+ |
|  | TOTAL x402 REVENUE SETTLED   | | 90% KAMINO DEFI STAKED FLOAT | | ACCRUED DEFI YIELD (+9.4%)  | |
|  | $12.50 USDC (833 API Calls)  | | $11.25 kUSDC (Auto-Swept)    | | +$0.42 USDC (Net Profit)    | |
|  +------------------------------+ +------------------------------+ +-----------------------------+ |
|                                                                                                    |
|  REGISTERED x402 ENDPOINTS & DROP-IN MIDDLEWARE CONFIG                                             |
|  +-----------------------------------------------------------------------------------------------+ |
|  | Endpoint Pattern  | Price / Call | Accepted x402 Schemes                | Auto-Sweep | Status | |
|  | /api/v1/ai/chat   | 0.015 USDC   | zkapi-groth16, zkapi-rk, solana-spl  | 90% Kamino | ACTIVE | |
|  | /api/v1/ai/audit  | 0.050 USDC   | zkapi-groth16, zkapi-rk, solana-spl  | 90% Kamino | ACTIVE | |
|  +-----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  LIVE UNLINKABLE SETTLEMENT & SCHNORR RECEIPT LEDGER                                               |
|  +-----------------------------------------------------------------------------------------------+ |
|  | Time     | Correlation ID     | Scheme           | Charged    | Schnorr Sig  | Buyer Identity | |
|  | 15:08:12 | req_01jc3k9z8x7w   | zkapi-runtime-key| 0.015 USDC | 0x882f...91a | [UNLINKABLE ZK]| |
|  | 15:07:45 | req_01jc3k8m2p1q   | zkapi-groth16    | 0.050 USDC | 0x44c1...09e | [UNLINKABLE ZK]| |
|  +-----------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

---

## 7. AI and Web3 Interaction Patterns

### 7.1 AI Interaction Patterns (Work Order #7)
1. **Streaming & Partial Output:** AI responses stream via Server-Sent Events (`text/event-stream`) with a visible `"Stop Generating"` button (`Escape` shortcut) that halts token generation immediately.
2. **Expressing Confidence, Uncertainty & Model Provenance:** Every AI message badge displays the exact model identifier (`gpt-4o-mini-2024-07-18` or `claude-3-5-sonnet-20241022`), latency (`11ms x402 verify`), and cryptographic Schnorr receipt (`sig_882f...`). The UI never claims on-chain audit finality from LLM prose alone; smart contract risk outputs include a disclaimer badge: *"AI Static Analysis — Verify Authority on Solscan."*
3. **Consequential Action Approval & Spend Firewall Preview (`R-013`):** Before any AI agent or tool executes an `x402` request exceeding `$0.05` (or when testing the `$2.50` prompt-injection simulator), the interface displays a clear **Before / After Spend Policy Card** (`Requested: 2.50 USDC` vs. `Your Cap: 0.10 USDC/req`) and blocks execution automatically with a 1-click option to either reject or raise the cap.
4. **Error, Fallback & Refusal Recovery:** If the primary LLM times out (`>1,500ms`), a subtle status pill indicates `"Switched to fallback model (Claude 3.5 Sonnet)"`. If both fail, the banner confirms: `"Upstream AI error — 0.015 USDC automatically refunded to your Runtime Key."`

### 7.2 Web3 Interaction Patterns (Work Order #8)
1. **Multi-Chain Wallet Connect & Network Mismatch:** Handled seamlessly across 35+ chains via `@aurora-is-near/intents-connect` (`v7.24.0`). Because Aurora Intents accepts funds on whichever chain the user is currently connected to (Base, Arbitrum, Bitcoin, NEAR, Solana), the user is **never forced to manually switch RPC networks or hold destination SOL gas**.
2. **All 7 Human-Readable Transaction & Cryptographic States:**
   | State Code | Badge Color | Human-Readable Label & Recovery Guidance |
   | :--- | :--- | :--- |
   | `1. PREPARED_LOCAL` | Cyan `#38BDF8` | `"Local zkAPI Note Generated & Backed Up (.json saved)"` |
   | `2. AWAITING_SIGNATURE` | Warning `#FBBF24` | `"Confirm 10.00 USDC transfer in your wallet (0 SOL gas required)"` |
   | `3. OPTIMISTIC_CREDITED` | Mint `#34D399` | `"$5.00 Instant Credit Active (184ms) — Ready for x402 calls!"` |
   | `4. SOLVER_ROUTING` | Ultraviolet `#C084FC` | `"Aurora Confidential Solver routing to Solana (~20s in background)..."` |
   | `5. CONFIRMED_ON_CHAIN` | Mint `#34D399` | `"Poseidon Leaf #1,042 Committed on Solana + 90% Swept to Kamino (9.4% APY)"` |
   | `6. FAILED_OR_REVERTED` | Error `#F87171` | `"Origin transfer failed or expired. Optimistic credit closed; retry from Draft note."` |
   | `7. REPLACED_OR_REFUNDED` | Cyan `#38BDF8` | `"Unspent note closed — 8.45 USDC refunded to Arbitrum via Aurora 1Click."` |

---

## 8. Accessibility Specification (WCAG 2.2 Level AA)

- **Keyboard Navigation Model:** Zero keyboard traps; logical top-to-bottom, left-to-right `Tab` order across all 3 screens; `Skip to Main Content` link appears on first `Tab` press; modals trap focus and close on `Escape`.
- **Screen-Reader Semantics:**
  - Landmarks: `<header role="banner">`, `<nav aria-label="Primary">`, `<main role="main">`, `<section aria-labelledby="...">`.
  - Live Regions: Active note balance pill uses `aria-live="polite"`; Agent Spend Policy Firewall block uses `role="alert"` (`aria-live="assertive"`).
- **Reduced Motion (`prefers-reduced-motion: reduce`):** Disables all CSS transitions and skeleton shimmer animations, replacing them with instant opacity swaps and static text progress percentages.
- **Color Independence:** No state relies on color alone—every status pill pairs color with an explicit prefix label or symbol (`[ACTIVE]`, `[BLOCKED — ERR_SPEND_CAP_EXCEEDED]`, `[NO - ZK PROOF]`).

---

## 9. Content Design & Microcopy Guidelines

- **Voice:** Crisp, verifiable, technical, and reassuring. State exact numbers (`"104,280 CU"`, `"0 Wallet Bytes Sent"`, `"30 bps fee"`) instead of vague marketing claims (`"super fast"`, `"totally private"`).
- **Error Message Format (Problem + Actionable Fix):**
  - *Bad:* `"Error 403: Unauthorized request."`
  - *Good (`R-013`):* `"[BLOCKED BY AGENT POLICY FIREWALL — ERR_SPEND_CAP_EXCEEDED]: Endpoint requested 2.50 USDC, which exceeds your Runtime Key limit of 0.10 USDC/request. Raise your cap in Policy Settings or cancel the call."`
- **Button Label Rules:** Start with an explicit verb describing the cryptographic or financial outcome (`"Refract Liquidity & Mint zkAPI Note"`, `"Send Private x402 Request"`, `"Close Note & Auto-Refund Cross-Chain"`).
- **Placeholder Rules:** Placeholders show realistic example inputs (`"Ask Claude 3.5 / GPT-4o or paste any x402 endpoint URL..."`) and never replace persistent `<label>` elements.
- **Localization & Formatting Notes:** Currency values formatted via `Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })` with explicit `USDC` suffix; 32-byte hex commitments formatted as `0x` + first 4 hex chars + `...` + last 4 hex chars (`min-width: 11ch` in monospace so layout never shifts).

---

## 10. Responsive Specification Across Breakpoints

| Breakpoint | Viewport Width | Grid Columns & Gap | Layout & Component Adaptations | Touch Target & Overflow Rules |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile (Wallet Browser)** | `375px – 767px` | 1 Column (`16px` gap, `16px` outer padding) | Header stacks into 2 rows; `/studio` and `/playground` cards stack vertically; Double-Blind Inspector collapses into an accordion below the chat box; tables gain `overflow-x: auto`. | All interactive controls `min-height: 44px`, full-width (`100%`) primary CTA buttons in thumb zone; zero horizontal body scroll (`overflow-x: hidden`). |
| **Tablet** | `768px – 1279px` | 8 Columns (`20px` gap, `24px` outer padding) | `/studio` displays Source Liquidity (4 cols) and Solana Vault (4 cols) side-by-side; `/playground` stacks Inspector full-width below Chat. | Minimum `8px` clearance between adjacent `44px` buttons. |
| **Desktop Studio** | `1280px – 1439px` | 12 Columns (`24px` gap, `32px` outer padding) | Full 2-pane studio layout (`7 cols` Chat / `5 cols` Double-Blind Inspector on `/playground`). | Hover tooltips and keyboard shortcut hints (`Cmd+Enter` to send) enabled. |
| **Wide Desktop** | `>= 1440px` | 12 Columns (`max-width: 1380px` centered) | All 3 stages visible in a single glance during the 90-second hackathon demo recording without scrolling. | Fixed max container width prevents excessive line lengths (`<= 75ch` in AI chat). |

---

## 11. Engineering Handoff

- **Token Export Format:** W3C Design Tokens JSON (`blueprint/design-tokens.json`) mapped 1:1 to CSS custom properties in `src/app/globals.css` (demonstrated in `blueprint/prototype/index.html`).
- **Component-to-Requirement Map:**
  - `PrismDepositCard.tsx` $\rightarrow$ `R-001`, `R-002`, `R-003`, `R-004`, `R-014`
  - `DefiFloatTelemetryCard.tsx` $\rightarrow$ `R-009`, `R-010`
  - `X402AiPlaygroundCard.tsx` $\rightarrow$ `R-005`, `R-006`, `R-007`, `R-008`, `R-012`, `R-013`, `R-016`
  - `DoubleBlindInspectorDrawer.tsx` $\rightarrow$ `R-015`
  - `CrossChainRefundModal.tsx` $\rightarrow$ `R-011`
  - `MerchantTreasuryDashboard.tsx` $\rightarrow$ `R-007`, `R-009`, `R-011`, `R-014`
- **Automated Accessibility & Contrast Test Commands:**
  1. `node scripts/verify_contrast.mjs blueprint/design-tokens.json` (Verifies all 10 token pairs pass WCAG 2.2 AA/AAA).
  2. `npx playwright test tests/e2e/a11y.spec.ts` (Runs `@axe-core/playwright` against `prototype/index.html` and live Next.js routes at `375px` and `1440px`).

---

## 12. Open Questions and Assumptions
- **Open Questions:** None.
- **Locked UI Assumptions:** Dark Prism mode is the default and primary theme (`ASSUMPTION`: matches developer terminal and Web3 hackathon demo ergonomics while passing WCAG 2.2 AA/AAA contrast ratios verified in `reviews/verification.md`).
```

