import { z } from "zod";
import { jsonResponse } from "@/lib/http";
import { ZkMintError, mintRuntimeKey } from "@/lib/zkapi/solanaVerifier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FIELD = /^0x[a-fA-F0-9]{64}$/;

const Schema = z.object({
  proofHex: z.string().regex(/^0x[a-fA-F0-9]{512}$/),
  merkleRootHex: z.string().regex(FIELD),
  nullifierHashHex: z.string().regex(FIELD),
  spendCapMicroUsdc: z.number().int().positive(),
  sessionPubkeyHashHex: z.string().regex(FIELD),
  maxPerRequestMicroUsdc: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { code: "ERR_INVALID_JSON", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      {
        code: "ERR_INVALID_PROOF_PAYLOAD",
        message: parsed.error.issues[0]?.message ?? "Invalid request payload.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await mintRuntimeKey(parsed.data);
    return jsonResponse(result, { status: 200 });
  } catch (err) {
    if (err instanceof ZkMintError) {
      return jsonResponse(
        { code: err.code, message: err.message },
        { status: err.status },
      );
    }
    return jsonResponse(
      {
        code: "ERR_SOLANA_VERIFICATION_FAILED",
        message: "On-chain verification failed. Retry shortly.",
      },
      { status: 502 },
    );
  }
}
