"use client";

import { useEffect, useState } from "react";
import { useRefractStore } from "@/lib/store/useRefractStore";

interface VaultStats {
  totalPoolMicroUsdc: number;
  kaminoStakedMicroUsdc: number;
  liquidReserveMicroUsdc: number;
  currentApyBps: number;
  subsidyBonusBps: number;
}

export function DefiFloatTelemetryCard() {
  const [stats, setStats] = useState<VaultStats | null>(null);
  const note = useRefractStore((s) => s.note);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/defi/vault-stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setStats(data as VaultStats);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const stakedPct = stats
    ? Math.round((stats.kaminoStakedMicroUsdc / stats.totalPoolMicroUsdc) * 100)
    : 90;

  return (
    <section className="card stack" aria-labelledby="defi-heading">
      <h2 id="defi-heading">Solana ZK-Yield Vault &amp; Instant Credit</h2>

      <div className="success">
        <strong>&lt;400ms Optimistic Credit</strong>
        <p className="muted" style={{ marginBottom: 0 }}>
          The 10% liquid reserve fronts up to $5.00 while Aurora settles.
        </p>
      </div>

      <div>
        <span className="muted">Local Poseidon Note Commitment</span>
        <p className="mono" style={{ wordBreak: "break-all" }}>
          {note?.commitmentHex ?? "No active zkAPI note in browser storage"}
        </p>
        <p className="muted" style={{ marginTop: 0 }}>
          Secret nullifier: stored in this browser only
        </p>
      </div>

      <div>
        <h3 style={{ marginBottom: 8 }}>90/10 Solana DeFi Float Allocation</h3>
        <div
          className="progress"
          role="img"
          aria-label={`${stakedPct}% staked in Kamino, ${100 - stakedPct}% liquid reserve`}
        >
          <div style={{ width: `${stakedPct}%` }} />
        </div>
        <ul style={{ paddingLeft: 20 }}>
          <li>
            90% Kamino kUSDC Reserve:{" "}
            {stats
              ? `$${(stats.kaminoStakedMicroUsdc / 1_000_000).toFixed(2)} (${(stats.currentApyBps / 100).toFixed(2)}% APY)`
              : "$225.00 (9.40% APY)"}
          </li>
          <li>
            10% Liquid Optimistic PDA:{" "}
            {stats
              ? `$${(stats.liquidReserveMicroUsdc / 1_000_000).toFixed(2)}`
              : "$25.00"}
          </li>
          <li>
            Active AI Credit Bonus:{" "}
            {stats ? `+${(stats.subsidyBonusBps / 100).toFixed(1)}% free calls` : "+8.4%"}
          </li>
        </ul>
      </div>
    </section>
  );
}
