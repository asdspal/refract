import { randomBytes } from "node:crypto";
import bs58 from "bs58";
import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { query } from "../../db/index";
import {
  hashRuntimeKey,
  invalidateRuntimeKeyCacheByHash,
} from "../x402/runtimeKeyMeter";
import idl from "./refract_vault_idl.json";

export type ZkMintErrorCode =
  | "ERR_INVALID_PROOF_PAYLOAD"
  | "ERR_NULLIFIER_ALREADY_SPENT"
  | "ERR_STALE_MERKLE_ROOT"
  | "ERR_INVALID_GROTH16_PROOF"
  | "ERR_SOLANA_VERIFICATION_FAILED"
  | "ERR_RELAYER_NOT_CONFIGURED";

export class ZkMintError extends Error {
  readonly code: ZkMintErrorCode;
  readonly status: number;

  constructor(code: ZkMintErrorCode, message: string, status: number) {
    super(message);
    this.name = "ZkMintError";
    this.code = code;
    this.status = status;
  }
}

export interface VerifierDeps {
  connection: Connection;
  program: Program;
  relayer: Keypair;
  usdcMint: PublicKey;
}

export interface MintRuntimeKeyParams {
  proofHex: string;
  merkleRootHex: string;
  nullifierHashHex: string;
  spendCapMicroUsdc: number;
  sessionPubkeyHashHex: string;
  maxPerRequestMicroUsdc?: number;
}

export interface MintRuntimeKeyResult {
  runtimeKey: string;
  solanaVerifyTxSig: string;
  computeUnitsUsed: number;
  effectiveBalanceMicroUsdc: number;
  yieldSubsidyMicroUsdc: number;
  expiresAt: string;
}

const FIELD_HEX = /^0x[a-fA-F0-9]{64}$/;
const DEFAULT_MAX_PER_REQUEST = 100_000;

function hexToBytes32(hex: string): number[] {
  if (!FIELD_HEX.test(hex)) {
    throw new ZkMintError(
      "ERR_INVALID_PROOF_PAYLOAD",
      `Invalid 32-byte field element: ${hex.slice(0, 12)}...`,
      400,
    );
  }
  return Array.from(Buffer.from(hex.slice(2), "hex"));
}

function bigintToBytes32(value: bigint): number[] {
  const hex = value.toString(16).padStart(64, "0");
  return Array.from(Buffer.from(hex, "hex"));
}

function sliceProof(proofHex: string): {
  proofA: number[];
  proofB: number[];
  proofC: number[];
} {
  if (!/^0x[a-fA-F0-9]{512}$/.test(proofHex)) {
    throw new ZkMintError(
      "ERR_INVALID_PROOF_PAYLOAD",
      "proofHex must be 256 bytes (0x + 512 hex chars).",
      400,
    );
  }
  const raw = Buffer.from(proofHex.slice(2), "hex");
  return {
    proofA: Array.from(raw.subarray(0, 64)),
    proofB: Array.from(raw.subarray(64, 192)),
    proofC: Array.from(raw.subarray(192, 256)),
  };
}

function mapAnchorError(err: unknown): ZkMintError {
  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes("NullifierAlreadySpent") ||
    message.includes("already in use") ||
    message.includes("AccountAlreadyInitialized")
  ) {
    return new ZkMintError(
      "ERR_NULLIFIER_ALREADY_SPENT",
      "This zkAPI note has already been spent or converted into an active session.",
      409,
    );
  }
  if (message.includes("UnknownMerkleRoot")) {
    return new ZkMintError(
      "ERR_STALE_MERKLE_ROOT",
      "Merkle tree state updated. Refresh the path and re-prove automatically.",
      409,
    );
  }
  if (message.includes("InvalidGroth16Proof") || message.includes("SpendCapZero")) {
    return new ZkMintError(
      "ERR_INVALID_GROTH16_PROOF",
      "Groth16 proof verification failed on Solana.",
      400,
    );
  }
  return new ZkMintError(
    "ERR_SOLANA_VERIFICATION_FAILED",
    `Solana verification failed: ${message}`,
    502,
  );
}

let depsOverride: VerifierDeps | null = null;

/** Test-only hook to inject a local validator chain. */
export function setVerifierDeps(deps: VerifierDeps | null): void {
  depsOverride = deps;
}

export function createVerifierDepsFromEnv(): VerifierDeps {
  const rpcUrl =
    process.env.SOLANA_RPC_URL ??
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    "https://api.devnet.solana.com";
  const secret = process.env.SOLANA_RELAYER_PRIVATE_KEY_BASE58;
  if (!secret) {
    throw new ZkMintError(
      "ERR_RELAYER_NOT_CONFIGURED",
      "SOLANA_RELAYER_PRIVATE_KEY_BASE58 is not configured.",
      503,
    );
  }
  const relayer = Keypair.fromSecretKey(bs58.decode(secret));
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(relayer), {
    commitment: "confirmed",
  });
  const program = new Program(idl as ConstructorParameters<typeof Program>[0], provider);
  const usdcMint = new PublicKey(
    process.env.NEXT_PUBLIC_SOLANA_USDC_MINT ??
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  );
  return { connection, program, relayer, usdcMint };
}

async function subsidyBonusBps(): Promise<number> {
  const res = await query<{ subsidy_bonus_bps: number }>(
    `SELECT subsidy_bonus_bps FROM defi_vault_snapshots ORDER BY recorded_at DESC LIMIT 1`,
  );
  return res.rows[0]?.subsidy_bonus_bps ?? 840;
}

/** Verify a client Groth16 proof on Solana and mint an unlinkable runtime key. */
export async function mintRuntimeKey(
  params: MintRuntimeKeyParams,
  deps?: VerifierDeps,
): Promise<MintRuntimeKeyResult> {
  const { connection, program, relayer, usdcMint } =
    deps ?? depsOverride ?? createVerifierDepsFromEnv();

  const { proofA, proofB, proofC } = sliceProof(params.proofHex);
  const merkleRootBytes = hexToBytes32(params.merkleRootHex);
  const nullifierBytes = hexToBytes32(params.nullifierHashHex);
  const sessionHashBytes = hexToBytes32(params.sessionPubkeyHashHex);
  const spendCapBytes = bigintToBytes32(BigInt(params.spendCapMicroUsdc));

  const existing = await query<{ id: string }>(
    "SELECT id FROM zk_runtime_sessions WHERE nullifier_hash_hex = $1",
    [params.nullifierHashHex],
  );
  if (existing.rows[0]) {
    throw new ZkMintError(
      "ERR_NULLIFIER_ALREADY_SPENT",
      "This zkAPI note has already been spent or converted into an active session.",
      409,
    );
  }

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("refract_vault"), usdcMint.toBuffer()],
    program.programId,
  );
  const [nullifierPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nullifier"), Buffer.from(nullifierBytes)],
    program.programId,
  );

  let solanaVerifyTxSig: string;
  let computeUnitsUsed = 0;
  try {
    solanaVerifyTxSig = await program.methods
      .settleZkSpend(proofA, proofB, proofC, [
        merkleRootBytes,
        nullifierBytes,
        spendCapBytes,
        sessionHashBytes,
      ], nullifierBytes)
      .accounts({
        vault: vaultPda,
        usdcMint,
        nullifierRecord: nullifierPda,
        relayer: relayer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const tx = await connection.getTransaction(solanaVerifyTxSig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    computeUnitsUsed = tx?.meta?.computeUnitsConsumed ?? 0;
  } catch (err) {
    throw mapAnchorError(err);
  }

  const bonusBps = await subsidyBonusBps();
  const subsidy = Math.floor(
    (params.spendCapMicroUsdc * bonusBps) / 10_000,
  );
  const effectiveBalance = params.spendCapMicroUsdc + subsidy;
  const runtimeKey = `rk_live_zk_${randomBytes(24).toString("hex")}`;
  const runtimeKeyHash = hashRuntimeKey(runtimeKey);

  let expiresAt: string;
  try {
    const inserted = await query<{ expires_at: string }>(
      `INSERT INTO zk_runtime_sessions
         (nullifier_hash_hex, merkle_root_used_hex, solana_verify_tx_sig,
          runtime_key_hash, principal_micro_usdc, yield_subsidy_micro_usdc,
          remaining_micro_usdc, max_per_request_micro_usdc, is_optimistic,
          status, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,'ACTIVE', now() + interval '24 hours')
       RETURNING expires_at`,
      [
        params.nullifierHashHex,
        params.merkleRootHex,
        solanaVerifyTxSig,
        runtimeKeyHash,
        params.spendCapMicroUsdc,
        subsidy,
        effectiveBalance,
        params.maxPerRequestMicroUsdc ?? DEFAULT_MAX_PER_REQUEST,
      ],
    );
    expiresAt = new Date(inserted.rows[0].expires_at).toISOString();
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new ZkMintError(
        "ERR_NULLIFIER_ALREADY_SPENT",
        "This zkAPI note has already been spent or converted into an active session.",
        409,
      );
    }
    throw err;
  }

  // The session is lazily seeded into Redis by the meter on first spend.
  await invalidateRuntimeKeyCacheByHash(runtimeKeyHash);

  return {
    runtimeKey,
    solanaVerifyTxSig,
    computeUnitsUsed,
    effectiveBalanceMicroUsdc: effectiveBalance,
    yieldSubsidyMicroUsdc: subsidy,
    expiresAt,
  };
}
