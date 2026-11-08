"use client";

import { useEffect, useRef, useState } from "react";
import {
  readOriginQuoteId,
  readRuntimeKey,
  useRefractStore,
} from "@/lib/store/useRefractStore";
import { CrossChainRefundModal } from "./CrossChainRefundModal";

function paymentSignature(token: string): string {
  return btoa(JSON.stringify({ scheme: "zkapi-runtime-key", token }));
}

export function X402AiPlaygroundCard() {
  const [model, setModel] = useState("fireworks");
  const [cap, setCap] = useState("0.10");
  const [prompt, setPrompt] = useState("Audit Kamino vault authority & utilization.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firewallDemo, setFirewallDemo] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [charged, setCharged] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const refundTriggerRef = useRef<HTMLButtonElement>(null);

  const store = useRefractStore();

  useEffect(() => {
    store.hydrateFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runChat(simulateAttack: boolean) {
    setError(null);
    setFirewallDemo(null);
    setBusy(true);
    try {
      const token = store.runtimeKey ?? readRuntimeKey();
      if (!token) {
        setError("No active Runtime Key. Complete the Studio deposit first.");
        return;
      }
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "PAYMENT-SIGNATURE": paymentSignature(token),
      };
      if (simulateAttack) {
        headers["x-simulate-endpoint-cost-micro-usdc"] = "2500000";
      }
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (simulateAttack && body.code === "ERR_SPEND_CAP_EXCEEDED") {
          setFirewallDemo(
            `Firewall demo passed — a simulated $2.50 request was blocked by the $${cap}/req cap. 0.00 USDC deducted (HTTP 403 ERR_SPEND_CAP_EXCEEDED).`,
          );
        } else {
          setError(
            `${body.code ?? "ERR_X402"}: ${body.message ?? "Payment blocked."}`,
          );
        }
        return;
      }

      const body = await res.json();
      const receiptHeader = res.headers.get("X-ZKAPI-RECEIPT");
      setReply(body.reply);
      setCharged(body.chargedMicroUsdc);
      setRemaining(body.remainingMicroUsdc);
      setReceipt(receiptHeader);
      store.setLastReply(body.reply, body.model);
      if (receiptHeader) {
        store.setReceipt({
          header: receiptHeader,
          correlationId: body.correlationId,
          chargedMicroUsdc: body.chargedMicroUsdc,
          remainingMicroUsdc: body.remainingMicroUsdc,
          timestamp: Date.now(),
        });
      }
      store.setInspector({
        originQuoteId: readOriginQuoteId(),
        nullifierHashHex: store.note?.nullifierHashHex ?? null,
        receiptHeader,
        paymentRequiredHeader: res.headers.get("PAYMENT-REQUIRED"),
        walletBytesReceived: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" aria-labelledby="playground-heading">
      <h2 id="playground-heading">Unlinkable x402 AI Stream</h2>

      <div className="grid-2" style={{ gap: 12 }}>
        <label className="field">
          <span>AI Model</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="gpt-4o-mini">GPT-4o-mini</option>
            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
            <option value="fireworks">Fireworks (DeepSeek V4.1 Flash)</option>
          </select>
        </label>
        <label className="field">
          <span>Max Per-Request Cap (USD)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span>Prompt</span>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>

      <div className="stack" style={{ gap: 12 }}>
        <button
          type="button"
          className="btn"
          onClick={() => runChat(false)}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? "Settling x402 payment..." : "Send Private x402 Request"}
        </button>
        <button
          type="button"
          className="btn"
          style={{ background: "var(--semantic-error)", color: "var(--text-on-accent)" }}
          onClick={() => runChat(true)}
          disabled={busy}
        >
          Demo Firewall: Simulate $2.50 Attack (expected block)
        </button>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          The red button is a demo control: it should return HTTP 403 with 0.00
          USDC deducted. Use the blue button for a real paid call.
        </p>
      </div>

      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}

      {firewallDemo && (
        <p role="status" className="success">
          {firewallDemo}
        </p>
      )}

      {reply && (
        <div className="stack" style={{ gap: 8 }}>
          <p style={{ margin: 0 }}>{reply}</p>
          <p className="mono muted" style={{ margin: 0 }}>
            HTTP 402 paid: ${((charged ?? 0) / 1_000_000).toFixed(3)} · remaining $
            {((remaining ?? 0) / 1_000_000).toFixed(3)}
          </p>
          {receipt && (
            <p className="badge mono">Schnorr receipt: {receipt.slice(0, 18)}…</p>
          )}
        </div>
      )}

      <button
        ref={refundTriggerRef}
        type="button"
        className="btn"
        style={{ background: "transparent", color: "var(--accent-cyan)", border: "1px solid var(--border-interactive)" }}
        onClick={() => setRefundOpen(true)}
        disabled={!store.runtimeKey}
      >
        Close Note &amp; Auto-Refund Cross-Chain
      </button>

      <CrossChainRefundModal
        open={refundOpen}
        onClose={() => {
          setRefundOpen(false);
          refundTriggerRef.current?.focus();
        }}
      />
    </section>
  );
}
