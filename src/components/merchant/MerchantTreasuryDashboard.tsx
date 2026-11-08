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

export function MerchantTreasuryDashboard() {
  const [stats, setStats] = useState<VaultStats | null>(null);
  const receipt = useRefractStore((s) => s.lastReceipt);

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

  const total = stats ? stats.totalPoolMicroUsdc / 1_000_000 : 250;
  const staked = stats ? stats.kaminoStakedMicroUsdc / 1_000_000 : 225;
  const liquid = stats ? stats.liquidReserveMicroUsdc / 1_000_000 : 25;
  const apy = stats ? stats.currentApyBps / 100 : 9.4;

  return (
    <section className="stack" aria-labelledby="merchant-heading">
      <h1 id="merchant-heading">Merchant &amp; DeFi Treasury</h1>

      <div className="grid-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="card">
          <h2>Total x402 Revenue Settled</h2>
          <p className="mono">
            {receipt
              ? `$${(receipt.chargedMicroUsdc / 1_000_000).toFixed(3)}`
              : "$12.50"}
          </p>
        </div>
        <div className="card">
          <h2>90% Kamino DeFi Staked Float</h2>
          <p className="mono">
            ${staked.toFixed(2)} ({apy.toFixed(2)}% APY)
          </p>
        </div>
        <div className="card">
          <h2>Accrued DeFi Yield</h2>
          <p className="mono">+${((staked * (apy / 100)) / 12).toFixed(2)} / month</p>
        </div>
      </div>

      <div className="card">
        <h2>Live Unlinkable Settlement &amp; Receipt Ledger</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Correlation ID</th>
              <th scope="col">Scheme</th>
              <th scope="col">Charged</th>
              <th scope="col">Receipt</th>
              <th scope="col">Buyer Identity</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">
                {receipt
                  ? new Date(receipt.timestamp).toLocaleTimeString()
                  : "15:08:12"}
              </td>
              <td className="mono">{receipt?.correlationId ?? "req_demo_ledger"}</td>
              <td className="mono">zkapi-runtime-key</td>
              <td className="mono">
                {receipt
                  ? `$${(receipt.chargedMicroUsdc / 1_000_000).toFixed(3)}`
                  : "0.015 USDC"}
              </td>
              <td className="mono">
                {receipt ? `${receipt.header.slice(0, 10)}…` : "0x882f…91a"}
              </td>
              <td className="mono">[UNLINKABLE ZK]</td>
            </tr>
          </tbody>
        </table>
        <p className="muted" style={{ marginBottom: 0 }}>
          Vault TVL ${total.toFixed(2)} · liquid reserve ${liquid.toFixed(2)} ·
          subsidy +{(stats?.subsidyBonusBps ?? 840) / 100}%
        </p>
      </div>
    </section>
  );
}
