import { afterAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { TransactionInstruction } from "@solana/web3.js";
import {
  PROGRAM_ID,
  chainPrerequisitesAvailable,
  sendWithWarmup,
  startChain,
  type LocalChain,
} from "./helpers";

const describeChain = chainPrerequisitesAvailable() ? describe : describe.skip;

function discriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

describeChain("ping_vault on-chain invocation (local validator)", () => {
  let chain: LocalChain | undefined;

  afterAll(() => chain?.stop());

  it(
    "deploys the program and executes ping_vault under 5,000 CU",
    async () => {
      chain = await startChain(18899);

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [{ pubkey: chain.payer.publicKey, isSigner: true, isWritable: true }],
        data: discriminator("ping_vault"),
      });
      const signature = await sendWithWarmup(chain, ix);

      const info = await chain.connection.getTransaction(signature, {
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
});
