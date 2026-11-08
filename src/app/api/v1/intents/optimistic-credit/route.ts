import { z } from "zod";
import { jsonResponse } from "@/lib/http";
import {
  OptimisticCreditError,
  issueOptimisticCredit,
} from "@/lib/defi/optimisticCreditEngine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Schema = z.object({
  auroraQuoteId: z.string().min(1).max(128),
  originTxHash: z.string().min(10).max(200),
  groth16Proof: z.unknown().optional(),
  publicInputs: z.array(z.string()).max(8).optional(),
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
        code: "ERR_INVALID_REQUEST",
        message: parsed.error.issues[0]?.message ?? "Invalid request payload.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await issueOptimisticCredit(parsed.data);
    return jsonResponse(result, { status: 200 });
  } catch (err) {
    if (err instanceof OptimisticCreditError) {
      return jsonResponse(
        { code: err.code, message: err.message },
        { status: err.status },
      );
    }
    return jsonResponse(
      {
        code: "ERR_OPTIMISTIC_CREDIT_FAILED",
        message: "Optimistic credit issuance failed. Retry shortly.",
      },
      { status: 502 },
    );
  }
}
