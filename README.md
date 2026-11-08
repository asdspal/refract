# Refract — Any-Chain, Yield-Bearing zkAPI for Solana x402

Refract turns idle prepaid API float into a private, yield-generating Solana
payment pass. Deposit from **35+ chains** via **Aurora Intents**, get
`<400ms` optimistic credit, and pay **x402** APIs with **Groth16 BN254** proofs
so the merchant never sees your wallet.

- **Program (Devnet):** `HyeAVxJxt37ndAE2LJBKJ36j8vKLv6PezvwxA2NsmhvH`
- **Devnet settlement proof:** [worker deposit](https://explorer.solana.com/tx/3U87nqHBMDyrx3VnsazXMj9cb8tch6fLwSJRBQXMgXp5tZy7rBRmJVXVMqi3wJZTFCsNmNB8qejKssrYWJxKk9TJ?cluster=devnet), [vault seed + 90/10 rebalance](https://explorer.solana.com/tx/2PApenYxo7BB56B4Az3pJwMLQud4LU8ujHPQZ1zt5W5e9cP1cyCntZQu3HqNjiUxaTqaMNN6dKAPKuXTfM1YqB6J?cluster=devnet), [runtime-key mint](https://explorer.solana.com/tx/3Emx2MwLc2y49UFrdw4TxMjbMmcghbkETWgTb6x1Hp8X6YWH54ZiHC9bK21v9oqBRRCSDyWuP13jGDzgo6JbGsU?cluster=devnet)
- **Production URL / demo video:** pending operator deployment (see `docs/DEMO_SCRIPT.md`).

## How it works

```
Origin chain (Base / Arbitrum / BTC / NEAR / 35+)
  └─ Aurora Intents 1Click quote (confidentiality: basic, 30 bps appFees)
       └─ Solana RefractVault PDA (depth-20 Poseidon Merkle tree)
            ├─ 90% → Kamino kUSDC yield float
            └─ 10% → liquid optimistic reserve (<400ms credit)
Client ─ Groth16 BN254 proof ─▶ settle_zk_spend on Solana (106–113k CU)
       └─ rk_live_zk_* runtime key (+8.4% DeFi subsidy)
            └─ x402 gateway (<15ms target) ─▶ AI / API merchant
                 └─ X-ZKAPI-RECEIPT (Ed25519), 0 wallet bytes leaked
```

## Aurora Intents usage

| Feature | Code |
|---|---|
| 35+-chain typed quotes (`OneClickService.getQuote`) | `src/lib/aurora/oneClickService.ts` |
| Confidential routing (`confidentiality: "basic"`) + 30 bps `appFees` | `buildQuoteRequest()` |
| Background settlement worker + 90/10 rebalance | `src/lib/workers/solanaDepositWorker.ts` |
| Automated reverse-intent cross-chain refunds | `src/lib/aurora/reverseRefundService.ts` |

> Live **confidential** quotes require a 1Click Partner JWT in
> `AURORA_STUDIO_JWT_TOKEN`. Public quotes work without it (with the +25 bps
> unauthenticated fee).

## Solana + zkAPI + x402 + DeFi

- **Circuit:** `circuits/refract_note_spend.circom` — depth-20 Poseidon Merkle inclusion,
  nullifier hash, 64-bit spend cap, bound session key. 4 public inputs.
- **On-chain:** `programs/refract_vault` — zero-copy `ZkYieldVault`, incremental Poseidon
  tree via the Solana native syscall, `groth16-solana` verifier, `NullifierRecord` PDAs,
  90/10 DeFi router. Measured: deposit ~30–35k CU, `settle_zk_spend` **106–113k CU**
  (target ≤140k).
- **x402 gateway:** `src/lib/x402/gatewayMiddleware.ts` — HTTP 402 `PAYMENT-REQUIRED`,
  runtime-key verification, agent spend firewall, compensating rollback, Ed25519 receipts.
- **Agent firewall:** a request priced above `max_per_request_micro_usdc` is rejected with
  `HTTP 403 ERR_SPEND_CAP_EXCEEDED` and **0 USDC** deducted.
- **AI inference providers:** OpenAI (`gpt-4o-mini`) primary, Anthropic (`claude-3-5-sonnet`)
  fallback, and any OpenAI-compatible endpoint via `FIREWORKS_API_KEY`,
  `FIREWORKS_BASE_URL`, and `FIREWORKS_MODEL` (Fireworks by default). With no keys a
  deterministic local responder exercises the full x402 path.
- **Unlinkability:** `intent_deposits` and `zk_runtime_sessions` share no foreign key;
  IP/payment headers are stripped before the merchant handler; `TEST-SEC-001` asserts
  `walletBytesReceived === 0`.

## Local setup

```bash
# 1. Toolchain: Node 20+, Rust, Solana CLI, Anchor 1.2.2, Circom 2.2.x, Docker
npm install
docker run -d --name refract-pg -e POSTGRES_USER=refract -e POSTGRES_PASSWORD=refract \
  -e POSTGRES_DB=refract -p 5433:5432 postgres:16

# 2. Environment
cp .env.example .env        # fill DATABASE_URL, UPSTASH_*, Solana keys, LLM keys

# 3. Database, circuits, program
npm run db:migrate:up
node scripts/compile_circuit.mjs   # compiles WASM/zkey + verifying key
anchor build

# 4. Run
npm run dev                        # http://localhost:3000/studio
```

Run the checks:

```bash
npm test                                   # unit + integration + anchor (71 tests)
npx playwright test                        # E2E + WCAG 2.2 AA (16 tests)
npx tsx scripts/verify_blueprint_gates.ts  # 8 Phase-8 gates
anchor test                                # local SVM deployment/invocation
```

## Repository map

```
circuits/                     depth-20 Poseidon note-spend circuit
programs/refract_vault/       Solana Anchor program (vault, verifier, DeFi router)
src/app/                      /studio, /playground, /merchant, /api/v1/*
src/lib/zkapi/                note vault, Merkle tree, prover, Solana verifier
src/lib/x402/                 meter, gateway middleware, Ed25519 receipts
src/lib/aurora/               1Click quotes and reverse-intent refunds
src/lib/defi/                 optimistic credit engine
src/lib/workers/              Aurora deposit settlement worker
scripts/                      circuit compile, DR rebuild, devnet verification, gates
tests/                        unit, integration, anchor, security, ai, load, e2e
```

## Known deviations / external gates

- `npm audit` reports transitive advisories inside the Aurora swap-widget / TON SDK tree
  (no upstream fix available); direct pinned dependencies are clean.
- Live confidential Aurora quotes require a valid 1Click Partner JWT.
- Local `x402` verification p95 is ~44ms (local → Upstash); the 15ms NFR must be measured
  on Vercel colocated with Upstash/Neon.
- Mainnet-Beta deployment and the funded `$15–$25` USDC micro-liquidity demo require
  operator SOL/USDC; Devnet is fully verified.
