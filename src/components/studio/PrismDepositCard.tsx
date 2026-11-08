"use client";

import { useState } from "react";
import { useRefractStore, writeOriginQuoteId } from "@/lib/store/useRefractStore";

const DEMO_REFUND_ADDRESS = "0x71C95911E9a5D330f4D621842EC243EE1343292e";

const ASSETS = [
  {
    label: "Base Mainnet — USDC",
    chain: "base",
    assetId:
      "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
  },
  {
    label: "Arbitrum One — USDC",
    chain: "arbitrum",
    assetId:
      "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
  },
  {
    label: "Ethereum — USDC",
    chain: "ethereum",
    assetId:
      "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
  },
  {
    label: "NEAR — USDC",
    chain: "near",
    assetId:
      "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  },
  {
    label: "Solana — USDC",
    chain: "solana",
    assetId:
      "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",
  },
];

function randomTxHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return "0x" + hex;
}

export function PrismDepositCard() {
  const [assetIndex, setAssetIndex] = useState(0);
  const [amount, setAmount] = useState("10.00");
  const [confidential, setConfidential] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [credit, setCredit] = useState<{
    runtimeKey: string;
    optimisticCreditMicroUsdc: number;
    yieldSubsidyBonusMicroUsdc: number;
    latencyMs: number;
  } | null>(null);

  const setNote = useRefractStore((s) => s.setNote);
  const setRuntimeKey = useRefractStore((s) => s.setRuntimeKey);
  const setTxState = useRefractStore((s) => s.setTxState);

  async function handleDeposit() {
    setError(null);
    setCredit(null);
    setDepositAddress(null);
    const numeric = Number(amount);
    const micros = Number.isFinite(numeric)
      ? BigInt(Math.round(numeric * 1_000_000))
      : 0n;
    if (micros < 1_000_000n) {
      setError("Minimum deposit is $1.00 USDC equivalent.");
      return;
    }

    setBusy(true);
    try {
      setTxState(1);
      // Lazy-load circomlibjs/Poseidon only when the user actually deposits.
      const { downloadNoteBackup, generateLocalZkNote, saveNoteEncrypted } =
        await import("@/lib/zkapi/clientNoteVault");
      const note = await generateLocalZkNote(micros);
      downloadNoteBackup(note);
      await saveNoteEncrypted(note, "refract-local-session");
      setNote({
        commitmentHex: note.commitmentHex,
        nullifierHashHex: note.nullifierHashHex,
        sessionPubkeyHashHex: note.sessionPubkeyHashHex,
        amountMicroUsdc: note.amountMicroUsdc,
        backedUp: true,
      });
      setTxState(2);

      const asset = ASSETS[assetIndex];
      const quoteRes = await fetch("/api/v1/intents/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          originChain: asset.chain,
          originAsset: asset.assetId,
          amountRaw: micros.toString(),
          refundAddress: DEMO_REFUND_ADDRESS,
          poseidonCommitmentHex: note.commitmentHex,
          confidentialMode: confidential,
        }),
      });
      const quote = await quoteRes.json();
      if (!quoteRes.ok) {
        setError(quote.message ?? "Aurora quote failed.");
        setTxState(6);
        return;
      }
      setDepositAddress(quote.depositAddress);
      writeOriginQuoteId(quote.auroraQuoteId);
      setTxState(4);

      const creditRes = await fetch("/api/v1/intents/optimistic-credit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          auroraQuoteId: quote.auroraQuoteId,
          originTxHash: randomTxHash(),
          publicInputs: [],
        }),
      });
      const creditBody = await creditRes.json();
      if (!creditRes.ok) {
        setError(creditBody.message ?? "Optimistic credit failed.");
        setTxState(6);
        return;
      }
      setCredit(creditBody);
      setRuntimeKey(creditBody.runtimeKey);
      setTxState(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setTxState(6);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" aria-labelledby="prism-heading">
      <h2 id="prism-heading">Source Liquidity (35+ Chains)</h2>

      <label className="field">
        <span>Origin Network &amp; Asset</span>
        <select
          value={assetIndex}
          onChange={(e) => setAssetIndex(Number(e.target.value))}
        >
          {ASSETS.map((asset, index) => (
            <option key={asset.assetId} value={index}>
              {asset.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Deposit Amount (USDC)</span>
        <input
          type="number"
          min="1"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      <div className="checkbox-row">
        <input
          id="confidential-mode"
          type="checkbox"
          checked={confidential}
          onChange={(e) => setConfidential(e.target.checked)}
        />
        <label htmlFor="confidential-mode">
          Enable Aurora Confidential Intents
        </label>
      </div>

      <p className="badge">Fee: 1 bps solver + 30 bps integrator</p>

      <button
        type="button"
        className="btn"
        onClick={handleDeposit}
        disabled={busy}
        aria-busy={busy}
      >
        {busy
          ? "Generating note & requesting quote..."
          : "Refract Liquidity & Mint Unlinkable zkAPI Note"}
      </button>

      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}

      {depositAddress && (
        <p className="mono" role="status">
          Aurora deposit address: {depositAddress}
        </p>
      )}

      {credit && (
        <div className="success">
          <strong>
            ${(credit.optimisticCreditMicroUsdc / 1_000_000).toFixed(2)} Instant
            Credit Active ({credit.latencyMs}ms)
          </strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            Runtime key {credit.runtimeKey.slice(0, 18)}… · yield bonus $
            {(credit.yieldSubsidyBonusMicroUsdc / 1_000_000).toFixed(2)}
          </p>
        </div>
      )}
    </section>
  );
}
