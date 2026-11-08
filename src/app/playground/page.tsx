import { X402AiPlaygroundCard } from "@/components/playground/X402AiPlaygroundCard";
import { DoubleBlindInspectorDrawer } from "@/components/playground/DoubleBlindInspectorDrawer";

export default function PlaygroundPage() {
  return (
    <div className="stack" style={{ gap: 24 }}>
      <h1>x402 AI Playground</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Pay per prompt with an unlinkable runtime key. The merchant never sees
        your wallet.
      </p>
      <div className="grid-2">
        <X402AiPlaygroundCard />
        <DoubleBlindInspectorDrawer />
      </div>
    </div>
  );
}
