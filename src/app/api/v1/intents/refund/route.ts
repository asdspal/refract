import { z } from "zod";
import { jsonResponse } from "@/lib/http";
import {
  RefundError,
  extractRuntimeKeyToken,
  refundRuntimeSession,
} from "@/lib/aurora/reverseRefundService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Schema = z.object({
  destinationChain: z.string().min(1).max(32),
  destinationAsset: z.string().min(1).max(200),
  recipientAddress: z.string().min(1).max(200),
  sessionId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  let token: string;
  try {
    token = extractRuntimeKeyToken(request.headers.get("PAYMENT-SIGNATURE"));
  } catch (err) {
    if (err instanceof RefundError) {
      return jsonResponse(
        { code: err.code, message: err.message },
        { status: err.status },
      );
    }
    throw err;
  }

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
    const result = await refundRuntimeSession(token, parsed.data);
    return jsonResponse(result, { status: 200 });
  } catch (err) {
    if (err instanceof RefundError) {
      return jsonResponse(
        { code: err.code, message: err.message },
        { status: err.status },
      );
    }
    return jsonResponse(
      {
        code: "ERR_AURORA_REFUND_UNAVAILABLE",
        message: "Cross-chain refund failed. Retry shortly.",
      },
      { status: 502 },
    );
  }
}
