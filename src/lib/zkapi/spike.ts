import {
  BN254_FIELD_MODULUS_Q,
  computePoseidonCommitment,
  negateAndSerializeG1,
  negateG1Y,
  serializeG2,
  serializeGroth16ProofForSolana,
} from "./bn254Serializer";

interface AuroraToken {
  assetId: string;
  blockchain: string;
  symbol: string;
}

export interface SpikeResult {
  status: "READY_FOR_BUILD" | "DEGRADED";
  aurora: {
    reachable: boolean;
    baseUrl: string;
    tokenCount: number;
    chainCount: number;
    latencyMs: number;
    error?: string;
  };
  crypto: {
    poseidonCommitment: string;
    g1Bytes: number;
    g2Bytes: number;
    g1NegationValid: boolean;
    proofLengths: { proofA: number; proofB: number; proofC: number };
  };
  checkedAt: string;
}

const DEFAULT_BASE = "https://1click.chaindefuser.com";

export async function runHourOneSpike(): Promise<SpikeResult> {
  const baseUrl = process.env.AURORA_ONE_CLICK_BASE_URL ?? DEFAULT_BASE;
  const started = performance.now();

  let tokens: AuroraToken[] = [];
  let reachable = false;
  let error: string | undefined;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${baseUrl}/v0/tokens`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timer);
    if (res.ok) {
      tokens = (await res.json()) as AuroraToken[];
      reachable = true;
    } else {
      error = `HTTP ${res.status}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const latencyMs = Math.round(performance.now() - started);

  const commitment = await computePoseidonCommitment(1n, 2n, 10_000_000n);
  const y = 12345n;
  const negY = negateG1Y(y);
  const g1 = negateAndSerializeG1(1n, y);
  const g2 = serializeG2([1n, 2n], [3n, 4n]);
  const proof = serializeGroth16ProofForSolana({
    pi_a: ["1", y.toString(), "1"],
    pi_b: [
      ["1", "2"],
      ["3", "4"],
    ],
    pi_c: ["5", y.toString(), "1"],
  });

  const chains = new Set(tokens.map((t) => t.blockchain));
  const g1NegationValid = (negY + (y % BN254_FIELD_MODULUS_Q)) % BN254_FIELD_MODULUS_Q === 0n;

  return {
    status: reachable ? "READY_FOR_BUILD" : "DEGRADED",
    aurora: {
      reachable,
      baseUrl,
      tokenCount: tokens.length,
      chainCount: chains.size,
      latencyMs,
      ...(error ? { error } : {}),
    },
    crypto: {
      poseidonCommitment: commitment,
      g1Bytes: g1.length,
      g2Bytes: g2.length,
      g1NegationValid,
      proofLengths: {
        proofA: proof.proofA.length,
        proofB: proof.proofB.length,
        proofC: proof.proofC.length,
      },
    },
    checkedAt: new Date().toISOString(),
  };
}

if (require.main === module) {
  runHourOneSpike()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === "READY_FOR_BUILD" ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
