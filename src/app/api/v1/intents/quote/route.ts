import { z } from "zod";
import { jsonResponse } from "@/lib/http";
import {
  AuroraQuoteError,
  createConfidentialDepositQuote,
} from "@/lib/aurora/oneClickService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const QuoteRequestSchema = z.object({
  originChain: z.string().min(1).max(32),
  originAsset: z.string().min(1).max(200),
  amountRaw: z.string().regex(/^\d+$/),
  refundAddress: z.string().min(1).max(200),
  poseidonCommitmentHex: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  confidentialMode: z.boolean().optional().default(true),
  recipient: z.string().min(1).max(200).optional(),
  destinationAsset: z.string().min(1).max(200).optional(),
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

  const parsed = QuoteRequestSchema.safeParse(body);
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
    const quote = await createConfidentialDepositQuote(parsed.data);
    return jsonResponse(quote, { status: 200 });
  } catch (err) {
    if (err instanceof AuroraQuoteError) {
      return jsonResponse(
        { code: err.code, message: err.message },
        { status: err.status },
      );
    }
    return jsonResponse(
      {
        code: "ERR_AURORA_QUOTE_UNAVAILABLE",
        message: "Aurora cross-chain solver quote failed. Retry in a moment.",
      },
      { status: 502 },
    );
  }
}
