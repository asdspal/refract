export type AiModel = "gpt-4o-mini" | "claude-3-5-sonnet" | "fireworks";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type InferenceProvider =
  | "openai"
  | "anthropic"
  | "fireworks"
  | "local"
  | "local-fallback";

export interface InferenceResult {
  reply: string;
  model: string;
  provider: InferenceProvider;
}

export interface InferenceParams {
  model?: AiModel;
  messages: ChatMessage[];
}

export const OPENAI_MODEL = "gpt-4o-mini-2024-07-18";
export const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";
export const FIREWORKS_BASE_URL_DEFAULT =
  "https://api.fireworks.ai/inference/v1";
export const FIREWORKS_MODEL_DEFAULT =
  "accounts/fireworks/models/deepseek-v4p1-flash-1017";
export const MAX_OUTPUT_TOKENS = 1024;
const TTFT_TIMEOUT_MS = 1_500;

type LiveProvider = "openai" | "anthropic" | "fireworks";

function fireworksBaseUrl(): string {
  return process.env.FIREWORKS_BASE_URL || FIREWORKS_BASE_URL_DEFAULT;
}

function fireworksModel(): string {
  return process.env.FIREWORKS_MODEL || FIREWORKS_MODEL_DEFAULT;
}

/** "sk-test-local" intentionally disables live OpenAI for deterministic tests. */
function keyFor(provider: LiveProvider): string | undefined {
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    return key && key !== "sk-test-local" ? key : undefined;
  }
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY || undefined;
  return process.env.FIREWORKS_API_KEY || undefined;
}

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

/** Shared adapter for OpenAI and any OpenAI-compatible provider (e.g. Fireworks). */
async function callOpenAICompatible(
  provider: "openai" | "fireworks",
  messages: ChatMessage[],
): Promise<InferenceResult> {
  const apiKey = keyFor(provider);
  if (!apiKey) throw new Error(`${provider} API key is not configured`);
  const baseUrl =
    provider === "openai" ? "https://api.openai.com/v1" : fireworksBaseUrl();
  const model = provider === "openai" ? OPENAI_MODEL : fireworksModel();

  const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  });
  if (!res.ok) throw new Error(`${provider} HTTP ${res.status}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error(`${provider} returned an empty completion`);
  return { reply, model, provider };
}

async function callAnthropic(messages: ChatMessage[]): Promise<InferenceResult> {
  const apiKey = keyFor("anthropic");
  if (!apiKey) throw new Error("Anthropic API key is not configured");
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

function callProvider(
  provider: LiveProvider,
  messages: ChatMessage[],
): Promise<InferenceResult> {
  if (provider === "anthropic") return callAnthropic(messages);
  return callOpenAICompatible(provider, messages);
}

function localResult(
  requested: AiModel,
  messages: ChatMessage[],
): InferenceResult {
  if (
    process.env.AI_SIMULATE_PRIMARY_FAILURE === "true" &&
    requested === "gpt-4o-mini"
  ) {
    return {
      reply: localReply(messages, ANTHROPIC_MODEL),
      model: ANTHROPIC_MODEL,
      provider: "local-fallback",
    };
  }
  const model =
    requested === "gpt-4o-mini"
      ? OPENAI_MODEL
      : requested === "claude-3-5-sonnet"
        ? ANTHROPIC_MODEL
        : fireworksModel();
  return { reply: localReply(messages, model), model, provider: "local" };
}

/**
 * Route an AI call with provider failover. Supported providers: OpenAI,
 * Anthropic, and any OpenAI-compatible endpoint (Fireworks by default).
 * With no live keys (or OPENAI_API_KEY="sk-test-local") a deterministic
 * responder exercises the full x402 + firewall path without network calls.
 */
export async function runInference(
  params: InferenceParams,
): Promise<InferenceResult> {
  const requested = params.model ?? "gpt-4o-mini";
  const liveKeys = (["openai", "anthropic", "fireworks"] as LiveProvider[]).some(
    (provider) => keyFor(provider),
  );
  if (!liveKeys) return localResult(requested, params.messages);

  const chains: Record<AiModel, LiveProvider[]> = {
    "gpt-4o-mini": ["openai", "anthropic", "fireworks"],
    "claude-3-5-sonnet": ["anthropic", "fireworks", "openai"],
    fireworks: ["fireworks", "openai", "anthropic"],
  };

  const errors: string[] = [];
  for (const provider of chains[requested]) {
    if (!keyFor(provider)) continue;
    try {
      return await callProvider(provider, params.messages);
    } catch (err) {
      errors.push(`${provider}: ${err instanceof Error ? err.message : err}`);
    }
  }
  throw new Error(`All configured inference providers failed (${errors.join("; ")})`);
}
