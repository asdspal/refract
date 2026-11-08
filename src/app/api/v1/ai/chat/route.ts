import { z } from "zod";
import { withX402Gate, type X402Context } from "@/lib/x402/gatewayMiddleware";
import { runInference } from "@/lib/ai/inferenceRouter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Schema = z.object({
  model: z.enum(["gpt-4o-mini", "claude-3-5-sonnet", "fireworks"]).optional().default("gpt-4o-mini"),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1).max(8_000),
      }),
    )
    .min(1)
    .max(20),
});

async function handler(
  request: Request,
  ctx: X402Context,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ code: "ERR_INVALID_JSON", message: "Invalid JSON." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        code: "ERR_INVALID_REQUEST",
        message: parsed.error.issues[0]?.message ?? "Invalid request payload.",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const result = await runInference(parsed.data);
  return new Response(
    JSON.stringify({
      reply: result.reply,
      model: result.model,
      provider: result.provider,
      chargedMicroUsdc: ctx.chargedMicroUsdc,
      remainingMicroUsdc: ctx.remainingMicroUsdc,
      walletBytesReceived: 0,
      correlationId: ctx.correlationId,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

export const POST = withX402Gate(handler, "/api/v1/ai/chat");
