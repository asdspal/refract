# Refract — 90-Second Demo Script

Target: one continuous take, 1440px desktop, dark room. Numbers are live if
the backend is running.

| Time | Narration / action |
|---|---|
| 0:00–0:08 | "Refract lets you fund a private API pass from any of 35+ chains and earn Solana DeFi yield on the float." Open `/studio`. |
| 0:08–0:20 | Select **Base Mainnet — USDC**, enter `10.00`, leave **Aurora Confidential Intents** checked. Point at the 30 bps fee badge. |
| 0:20–0:32 | Click **Refract Liquidity & Mint Unlinkable zkAPI Note**. Call out the automatic `refract-note-<hash>.json` bearer backup download. |
| 0:32–0:42 | Quote returns a Base deposit address. The **<400ms Optimistic Credit** banner lights up: `$5.00` fronted by the 10% liquid reserve while Aurora settles. |
| 0:42–0:52 | Scroll the 90/10 card: "90% of the vault is in Kamino, 10% stays liquid for instant credit. Users get an +8.4% credit subsidy." |
| 0:52–1:05 | Open `/playground`. Send a prompt. Show `HTTP 402 paid: $0.015`, the Ed25519 receipt, and the **Double-Blind Inspector**: origin quote, Solana nullifier, **Wallet Bytes Sent: 0 BYTES**. |
| 1:05–1:15 | Click **Simulate $2.50 Prompt-Injection Attack**. Red alert: `ERR_SPEND_CAP_EXCEEDED`, `0.00 USDC deducted`. |
| 1:15–1:25 | Open **Close Note & Auto-Refund Cross-Chain**, choose Arbitrum USDC, execute. Status: `PROCESSING_REFUND` via a reverse Aurora Intent. |
| 1:25–1:30 | Open `/merchant`: 90% Kamino staked float, accrued yield, and a receipt ledger where every buyer is `[UNLINKABLE ZK]`. |

## Pre-recording checklist

```bash
docker start refract-pg
npm run db:migrate:up
npm run dev
# Verify the three routes and the 402 challenge:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/health
```

- If Aurora confidential quotes are unavailable, uncheck **Confidential Mode**
  for a public quote (the rest of the flow is identical).
- Keep the browser download bar visible for the `.json` backup beat.
- The 90/10 bar and APY read from `GET /api/v1/defi/vault-stats`.
