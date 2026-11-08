import { PrismDepositCard } from "@/components/studio/PrismDepositCard";
import { DefiFloatTelemetryCard } from "@/components/studio/DefiFloatTelemetryCard";

export default function StudioPage() {
  return (
    <div className="stack" style={{ gap: 24 }}>
      <h1>Studio — Any-Chain Prism Deposit</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Fund a private, yield-bearing API pass from 35+ chains via Aurora
        Confidential Intents, then pay x402 APIs without leaking your wallet.
      </p>
      <div className="grid-2">
        <PrismDepositCard />
        <DefiFloatTelemetryCard />
      </div>
    </div>
  );
}
