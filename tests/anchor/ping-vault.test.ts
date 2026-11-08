import { afterAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const root = resolve(__dirname, "../..");
const binDir =
  process.env.SOLANA_BIN_DIR ??
  join(process.env.HOME ?? "", ".local/share/solana/install/active_release/bin");
const validatorBin = join(binDir, "solana-test-validator");
const solanaBin = join(binDir, "solana");
const soPath = resolve(root, "target/deploy/refract_vault.so");
const programKeypairPath = resolve(root, "target/deploy/refract_vault-keypair.json");

const EXPECTED_PROGRAM_ID = "HyeAVxJxt37ndAE2LJBKJ36j8vKLv6PezvwxA2NsmhvH";
const RPC_PORT = 18899;
const RPC_URL = `http://127.0.0.1:${RPC_PORT}`;

const prerequisites =
  existsSync(validatorBin) && existsSync(solanaBin) && existsSync(soPath) && existsSync(programKeypairPath);

const describeChain = prerequisites ? describe : describe.skip;

function discriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

async function waitForValidator(connection: Connection): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      await connection.getVersion();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("local validator did not start in time");
}

async function waitForProgram(
  connection: Connection,
  programId: import("@solana/web3.js").PublicKey,
): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const info = await connection.getAccountInfo(programId, "confirmed");
    if (info?.executable) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("program account not executable after deploy");
}

describeChain("ping_vault on-chain invocation (local validator)", () => {
  const ledgerDir = mkdtempSync(join(tmpdir(), "refract-ping-"));
  let validator: ReturnType<typeof spawn> | null = null;
  let payerFile = "";
  let payer: Keypair;
  const connection = new Connection(RPC_URL, "confirmed");

  it(
    "deploys the program and executes ping_vault under 5,000 CU",
    async () => {
      const programKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(readFileSync(programKeypairPath, "utf8"))),
      );
      expect(programKeypair.publicKey.toBase58()).toBe(EXPECTED_PROGRAM_ID);

      validator = spawn(
        validatorBin,
        [
          "--reset",
          "--quiet",
          "--ledger",
          join(ledgerDir, "ledger"),
          "--rpc-port",
          String(RPC_PORT),
        ],
        { stdio: "ignore", detached: true },
      );
      validator.unref();

      await waitForValidator(connection);

      payer = Keypair.generate();
      payerFile = join(ledgerDir, "payer.json");
      writeFileSync(payerFile, JSON.stringify(Array.from(payer.secretKey)));

      const airdrop = await connection.requestAirdrop(payer.publicKey, 10_000_000_000);
      await connection.confirmTransaction(airdrop, "confirmed");

      const deploy = spawnSync(
        solanaBin,
        [
          "program",
          "deploy",
          soPath,
          "--program-id",
          programKeypairPath,
          "--url",
          RPC_URL,
          "--keypair",
          payerFile,
        ],
        { encoding: "utf8", timeout: 120_000 },
      );
      expect(deploy.status, deploy.stderr || deploy.stdout).toBe(0);
      await waitForProgram(connection, programKeypair.publicKey);
      // The local validator marks the program executable before its BPF cache is
      // warm; the first invoke can race with that. Give it a slot and retry.
      await new Promise((r) => setTimeout(r, 2_000));

      const ix = new TransactionInstruction({
        programId: programKeypair.publicKey,
        keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
        data: discriminator("ping_vault"),
      });

      let signature = "";
      let lastError: unknown;
      for (let attempt = 0; attempt < 8 && !signature; attempt++) {
        try {
          signature = await sendAndConfirmTransaction(
            connection,
            new Transaction().add(ix),
            [payer],
            { commitment: "confirmed" },
          );
        } catch (err) {
          lastError = err;
          const msg = err instanceof Error ? err.message : String(err);
          if (
            !msg.includes("not deployed") &&
            !msg.includes("Unsupported program id")
          ) {
            throw err;
          }
          await new Promise((r) => setTimeout(r, 1_500));
        }
      }
      if (!signature) throw lastError;

      const info = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      expect(info?.meta?.err).toBeNull();
      const cu = info?.meta?.computeUnitsConsumed ?? Number.POSITIVE_INFINITY;
      console.log(`ping_vault computeUnitsConsumed=${cu}, sig=${signature}`);
      expect(cu).toBeLessThan(5_000);
    },
    240_000,
  );

  afterAll(async () => {
    if (validator?.pid) {
      try {
        process.kill(-validator.pid, "SIGKILL");
      } catch {
        // already gone
      }
    }
    rmSync(ledgerDir, { recursive: true, force: true });
  });
});
