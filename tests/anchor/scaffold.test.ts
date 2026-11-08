import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");

describe("Anchor scaffold", () => {
  it("declares the ping_vault instruction and VaultPinged event", () => {
    const lib = readFileSync(
      resolve(root, "programs/refract_vault/src/lib.rs"),
      "utf8",
    );
    expect(lib).toContain("pub fn ping_vault");
    expect(lib).toContain("VaultPinged");
    expect(lib).toContain("declare_id!");
  });

  it("configures both localnet and devnet program ids", () => {
    const anchorToml = readFileSync(resolve(root, "Anchor.toml"), "utf8");
    expect(anchorToml).toContain("[programs.localnet]");
    expect(anchorToml).toContain("[programs.devnet]");
  });

  it("pins the audited Rust crypto crates", () => {
    const cargo = readFileSync(
      resolve(root, "programs/refract_vault/Cargo.toml"),
      "utf8",
    );
    expect(cargo).toContain('anchor-lang = "1.2.2"');
    expect(cargo).toContain('groth16-solana = "0.2.0"');
    expect(cargo).toContain('light-poseidon = "0.4.1"');
  });
});
