export type AiModel = "gpt-4o-mini" | "claude-3-5-sonnet";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface InferenceResult {
  reply: string;
  model: string;
  provider: "openai" | "anthropic" | "local" | "local-fallback";
}

export interface InferenceParams {
  model?: AiModel;
  messages: ChatMessage[];
}

export const OPENAI_MODEL = "gpt-4o-mini-2024-07-18";
export const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";
export const MAX_OUTPUT_TOKENS = 1024;
const TTFT_TIMEOUT_MS = 1_500;

function localReply(messages: ChatMessage[], model: string): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const prompt = (lastUser?.content ?? "").replace(/\s+/g, " ").trim();
  const excerpt = prompt.slice(0, 120);
  return `Refract local audit responder (${model}): analyzed "${excerpt}". No wallet address, IP address, or note secret was transmitted to any provider.`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTFT_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(
  messages: ChatMessage[],
  apiKey: string,
): Promise<InferenceResult> {
  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error("OpenAI returned an empty completion");
  return { reply, model: OPENAI_MODEL, provider: "openai" };
}

async function callAnthropic(
  messages: ChatMessage[],
  apiKey: string,
): Promise<InferenceResult> {
  const system = messages.find((m) => m.role === "system")?.content;
  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      ...(system ? { system } : {}),
      messages: messages.filter((m) => m.role !== "system"),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  const reply = data.content?.[0]?.text;
  if (!reply) throw new Error("Anthropic returned an empty completion");
  return { reply, model: ANTHROPIC_MODEL, provider: "anthropic" };
}

/**
 * Route an AI call with OpenAI -> Anthropic failover. In test/local mode
 * (no key or "sk-test-local") a deterministic responder exercises the full
 * x402 + firewall path without network calls.
 */
export async function runInference(
  params: InferenceParams,
): Promise<InferenceResult> {
  const primary = params.model ?? "gpt-4o-mini";
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey || openaiKey === "sk-test-local") {
    if (
      process.env.AI_SIMULATE_PRIMARY_FAILURE === "true" &&
      primary === "gpt-4o-mini"
    ) {
      return {
        reply: localReply(params.messages, ANTHROPIC_MODEL),
        model: ANTHROPIC_MODEL,
        provider: "local-fallback",
      };
    }
    const modelName = primary === "gpt-4o-mini" ? OPENAI_MODEL : ANTHROPIC_MODEL;
    return {
      reply: localReply(params.messages, modelName),
      model: modelName,
      provider: "local",
    };
  }

  if (primary === "gpt-4o-mini") {
    try {
      return await callOpenAI(params.messages, openaiKey);
    } catch {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicKey) {
        return callAnthropic(params.messages, anthropicKey);
      }
      throw new Error("Both OpenAI and Anthropic inference failed");
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  return callAnthropic(params.messages, anthropicKey);
}
