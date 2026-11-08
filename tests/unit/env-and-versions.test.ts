import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");

describe("pinned dependency versions", () => {
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  it("pins Solana web3.js to 1.99.0 (CVE-free v1)", () => {
    expect(deps["@solana/web3.js"]).toBe("1.99.0");
  });

  it("pins all critical dependencies exactly (no ranges)", () => {
    for (const [name, version] of Object.entries(deps)) {
      expect(version, `${name} must be pinned exactly`).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("pins the validated framework versions", () => {
    expect(deps.next).toBe("15.2.4");
    expect(deps.react).toBe("19.0.0");
    expect(deps.snarkjs).toBe("0.7.6");
    expect(deps["circomlibjs"]).toBe("0.1.7");
  });
});

describe("environment register", () => {
  const envExample = readFileSync(resolve(root, ".env.example"), "utf8");
  const keys = envExample
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => l.split("=")[0].trim());

  it("documents exactly the 22 required variables", () => {
    expect(keys).toHaveLength(22);
  });

  it("includes all security-critical variables", () => {
    expect(keys).toEqual(
      expect.arrayContaining([
        "SOLANA_RELAYER_PRIVATE_KEY_BASE58",
        "UPSTASH_REDIS_REST_TOKEN",
        "ZKAPI_SCHNORR_SIGNING_PRIVATE_KEY_HEX",
        "DATABASE_URL",
      ]),
    );
  });

  it("uses canonical Solana USDC mint", () => {
    expect(envExample).toContain(
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    );
  });
});
