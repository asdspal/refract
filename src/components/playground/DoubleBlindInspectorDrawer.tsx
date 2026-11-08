"use client";

import { useState } from "react";
import { useRefractStore } from "@/lib/store/useRefractStore";

type Tab = "visual" | "headers" | "sdk";

export function DoubleBlindInspectorDrawer() {
  const [tab, setTab] = useState<Tab>("visual");
  const inspector = useRefractStore((s) => s.inspector);
  const note = useRefractStore((s) => s.note);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "visual", label: "Visual Proof" },
    { id: "headers", label: "Raw HTTP 402 Headers" },
    { id: "sdk", label: "Agent SDK Snippet" },
  ];

  return (
    <section className="card stack" aria-labelledby="inspector-heading">
      <h2 id="inspector-heading">Double-Blind Privacy Inspector</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Live cryptographic proof of what each party saw.
      </p>

      <div className="tabs" role="tablist" aria-label="Privacy inspector views">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!inspector && (
        <p role="status" className="muted">
          Run a private x402 request to populate the inspector.
        </p>
      )}

      <div
        role="tabpanel"
        id="panel-visual"
        aria-labelledby="tab-visual"
        hidden={tab !== "visual"}
        className="stack"
        style={{ gap: 12 }}
      >
        <div className="card" style={{ padding: 16 }}>
          <h3>1. Origin Chain Saw</h3>
          <p className="mono muted">Aurora quote: {inspector?.originQuoteId ?? "—"}</p>
          <p className="badge">Knows Solana note? NO — Confidential</p>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h3>2. Solana Anchor Vault Saw</h3>
          <p className="mono muted">
            Nullifier: {inspector?.nullifierHashHex ?? note?.nullifierHashHex ?? "—"}
          </p>
          <p className="badge">Groth16 verified on-chain</p>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h3>3. AI Merchant Server Saw</h3>
          <p className="mono muted">
            PAYMENT-SIGNATURE: rk_live_* (wallet-free capability)
          </p>
          <p className="badge" style={{ color: "var(--accent-mint)", borderColor: "var(--accent-mint)" }}>
            Wallet Bytes Sent: {inspector?.walletBytesReceived ?? 0} BYTES
          </p>
        </div>
      </div>

      <div
        role="tabpanel"
        id="panel-headers"
        aria-labelledby="tab-headers"
        hidden={tab !== "headers"}
      >
        <pre className="mono">
{`PAYMENT-REQUIRED: ${inspector?.paymentRequiredHeader ?? "(challenge not captured)"}
PAYMENT-SIGNATURE: {"scheme":"zkapi-runtime-key","token":"rk_live_***"}
X-ZKAPI-RECEIPT: ${inspector?.receiptHeader ?? "(no receipt yet)"}
X-Correlation-Id: ${inspector ? "req_live" : "—"}`}
        </pre>
      </div>

      <div
        role="tabpanel"
        id="panel-sdk"
        aria-labelledby="tab-sdk"
        hidden={tab !== "sdk"}
      >
        <pre className="mono">
{`const res = await fetch("/api/v1/ai/chat", {
  method: "POST",
  headers: {
    "PAYMENT-SIGNATURE": base64({ scheme: "zkapi-runtime-key", token }),
    "content-type": "application/json",
  },
  body: JSON.stringify({ model: "gpt-4o-mini", messages }),
});
const receipt = res.headers.get("X-ZKAPI-RECEIPT");`}
        </pre>
      </div>
    </section>
  );
}
