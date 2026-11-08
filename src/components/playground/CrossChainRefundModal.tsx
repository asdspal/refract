"use client";

import { useEffect, useRef, useState } from "react";
import {
  readRuntimeKey,
  useRefractStore,
} from "@/lib/store/useRefractStore";

const DESTINATIONS = [
  {
    label: "Arbitrum — USDC",
    chain: "arbitrum",
    assetId:
      "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
  },
  {
    label: "Base — USDC",
    chain: "base",
    assetId:
      "nep141:base-0x833589fcd6edb4c7c32d4f71b54bda02913.omft.near",
  },
  {
    label: "Solana — USDC",
    chain: "solana",
    assetId:
      "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",
  },
];

export function CrossChainRefundModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [destination, setDestination] = useState(0);
  const [recipient, setRecipient] = useState(
    "0x71C95911E9a5D330f4D621842EC243EE1343292e",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const store = useRefractStore();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const token = store.runtimeKey ?? readRuntimeKey();
      if (!token) {
        setError("No active Runtime Key. Complete the Studio deposit first.");
        return;
      }
      const dest = DESTINATIONS[destination];
      const res = await fetch("/api/v1/intents/refund", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "PAYMENT-SIGNATURE": btoa(
            JSON.stringify({ scheme: "zkapi-runtime-key", token }),
          ),
        },
        body: JSON.stringify({
          destinationChain: dest.chain,
          destinationAsset: dest.assetId,
          recipientAddress: recipient,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(`${body.code ?? "ERR_REFUND"}: ${body.message ?? "Refund failed."}`);
        return;
      }
      setStatus(body.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal stack"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <h2 id="refund-title">Close Note &amp; Auto-Refund Cross-Chain</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Unspent principal is refunded via a reverse Aurora Intent.
        </p>

        <label className="field">
          <span>Destination Chain &amp; Asset</span>
          <select
            value={destination}
            onChange={(e) => setDestination(Number(e.target.value))}
          >
            {DESTINATIONS.map((dest, index) => (
              <option key={dest.assetId} value={index}>
                {dest.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Destination Recipient Address</span>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </label>

        <div className="stack" style={{ gap: 12 }}>
          <button
            type="button"
            className="btn"
            onClick={submit}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? "Requesting reverse Aurora Intent..." : "Execute Reverse Aurora Intent"}
          </button>
          <button
            type="button"
            className="btn"
            style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-interactive)" }}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>

        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}
        {status && (
          <p role="status" className="success">
            Refund status: {status}
          </p>
        )}
      </div>
    </div>
  );
}
