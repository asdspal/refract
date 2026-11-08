import { describe, expect, it } from "vitest";
import {
  BN254_FIELD_MODULUS_Q,
  BN254_SCALAR_MODULUS_R,
  computePoseidonCommitment,
  feToBigEndian32,
  negateAndSerializeG1,
  negateG1Y,
  serializeG2,
  serializeGroth16ProofForSolana,
} from "../../src/lib/zkapi/bn254Serializer";
import { runHourOneSpike } from "../../blueprint/spikes/verify_stack";

describe("BN254 serialization", () => {
  it("encodes field elements as 32-byte big-endian", () => {
    expect(Array.from(feToBigEndian32(1n))).toEqual([...new Array(31).fill(0), 1]);
    expect(feToBigEndian32(0x1234n).slice(-2)).toEqual(new Uint8Array([0x12, 0x34]));
  });

  it("negates a G1 y-coordinate modulo q", () => {
    const y = 2n;
    expect(negateG1Y(y)).toBe(BN254_FIELD_MODULUS_Q - y);
    expect((negateG1Y(y) + y) % BN254_FIELD_MODULUS_Q).toBe(0n);
  });

  it("serializes a G1 point as 64 bytes with negated y", () => {
    const out = negateAndSerializeG1(1n, 2n);
    expect(out).toHaveLength(64);
    expect(BigInt("0x" + Buffer.from(out.slice(0, 32)).toString("hex"))).toBe(1n);
    expect(BigInt("0x" + Buffer.from(out.slice(32)).toString("hex"))).toBe(
      BN254_FIELD_MODULUS_Q - 2n,
    );
  });

  it("serializes G2 in EIP-197 [x_c1, x_c0, y_c1, y_c0] order", () => {
    const out = serializeG2([1n, 2n], [3n, 4n]);
    expect(out).toHaveLength(128);
    const words = [0, 32, 64, 96].map((o) =>
      BigInt("0x" + Buffer.from(out.slice(o, o + 32)).toString("hex")),
    );
    expect(words).toEqual([2n, 1n, 4n, 3n]);
  });

  it("serializes a full Groth16 proof to 64/128/64 bytes", () => {
    const proof = serializeGroth16ProofForSolana({
      pi_a: ["1", "2", "1"],
      pi_b: [
        ["1", "2"],
        ["3", "4"],
      ],
      pi_c: ["5", "6", "1"],
    });
    expect(proof.proofA).toHaveLength(64);
    expect(proof.proofB).toHaveLength(128);
    expect(proof.proofC).toHaveLength(64);
  });
});

describe("Poseidon commitment", () => {
  it("is deterministic and inside the scalar field", async () => {
    const a = await computePoseidonCommitment(1n, 2n, 10_000_000n);
    const b = await computePoseidonCommitment(1n, 2n, 10_000_000n);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(BigInt(a) < BN254_SCALAR_MODULUS_R).toBe(true);
  });

  it("changes when the amount changes", async () => {
    const a = await computePoseidonCommitment(1n, 2n, 10_000_000n);
    const b = await computePoseidonCommitment(1n, 2n, 20_000_000n);
    expect(a).not.toBe(b);
  });
});

describe("hour-1 live spike", () => {
  it(
    "reaches Aurora 1Click and validates the crypto stack",
    async () => {
      const result = await runHourOneSpike();
      expect(result.aurora.reachable).toBe(true);
      expect(result.aurora.tokenCount).toBeGreaterThan(50);
      expect(result.aurora.chainCount).toBeGreaterThanOrEqual(10);
      expect(result.crypto.g1NegationValid).toBe(true);
      expect(result.crypto.proofLengths).toEqual({
        proofA: 64,
        proofB: 128,
        proofC: 64,
      });
      expect(result.status).toBe("READY_FOR_BUILD");
    },
    30000,
  );
});
