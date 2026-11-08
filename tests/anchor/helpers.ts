import { AnchorProvider, Program, Wallet, type Idl } from "@anchor-lang/core";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  Connection,
  Keypair,
  PublicKey,
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
const idlPath = resolve(root, "target/idl/refract_vault.json");

export const PROGRAM_ID = new PublicKey(
  "HyeAVxJxt37ndAE2LJBKJ36j8vKLv6PezvwxA2NsmhvH",
);

export interface LocalChain {
  rpcUrl: string;
  connection: Connection;
  payer: Keypair;
  payerFile: string;
  programId: PublicKey;
  program: Program;
  idl: Idl;
  stop(): void;
}

export function chainPrerequisitesAvailable(): boolean {
  return (
    existsSync(validatorBin) &&
    existsSync(solanaBin) &&
    existsSync(soPath) &&
    existsSync(programKeypairPath) &&
    existsSync(idlPath)
  );
}

async function waitFor(
  fn: () => Promise<boolean>,
  label: string,
  attempts = 60,
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      if (await fn()) return;
    } catch {
      // keep waiting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not become ready in time`);
}

export async function startChain(port: number): Promise<LocalChain> {
  const ledgerDir = mkdtempSync(join(tmpdir(), `refract-chain-${port}-`));
  const rpcUrl = `http://127.0.0.1:${port}`;
  const validator = spawn(
    validatorBin,
    [
      "--reset",
      "--quiet",
      "--ledger",
      join(ledgerDir, "ledger"),
      "--rpc-port",
      String(port),
    ],
    { stdio: "ignore", detached: true },
  );
  validator.unref();

  const connection = new Connection(rpcUrl, "confirmed");
  await waitFor(async () => {
    await connection.getVersion();
    return true;
  }, "validator");

  const payer = Keypair.generate();
  const payerFile = join(ledgerDir, "payer.json");
  writeFileSync(payerFile, JSON.stringify(Array.from(payer.secretKey)));
  const airdrop = await connection.requestAirdrop(payer.publicKey, 100_000_000_000);
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
      rpcUrl,
      "--keypair",
      payerFile,
    ],
    { encoding: "utf8", timeout: 120_000 },
  );
  if (deploy.status !== 0) {
    throw new Error(`program deploy failed: ${deploy.stderr || deploy.stdout}`);
  }

  await waitFor(async () => {
    const info = await connection.getAccountInfo(PROGRAM_ID, "confirmed");
    return Boolean(info?.executable);
  }, "program account");
  // The local validator reports executable before the BPF cache is warm.
  await new Promise((r) => setTimeout(r, 2_000));

  const idl = JSON.parse(readFileSync(idlPath, "utf8")) as Idl;
  const provider = new AnchorProvider(connection, new Wallet(payer), {
    commitment: "confirmed",
  });
  const program = new Program(idl, provider);

  return {
    rpcUrl,
    connection,
    payer,
    payerFile,
    programId: PROGRAM_ID,
    program,
    idl,
    stop() {
      try {
        process.kill(-validator.pid!, "SIGKILL");
      } catch {
        // already gone
      }
      rmSync(ledgerDir, { recursive: true, force: true });
    },
  };
}

/** Send an instruction, retrying while the local program cache warms up. */
export async function sendWithWarmup(
  chain: LocalChain,
  ix: TransactionInstruction,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await sendAndConfirmTransaction(
        chain.connection,
        new Transaction().add(ix),
        [chain.payer],
        { commitment: "confirmed" },
      );
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("not deployed") && !msg.includes("Unsupported program id")) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 1_500));
    }
  }
  throw lastError;
}
