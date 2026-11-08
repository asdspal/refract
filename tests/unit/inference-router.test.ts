import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANTHROPIC_MODEL,
  FIREWORKS_MODEL_DEFAULT,
  runInference,
} from "../../src/lib/ai/inferenceRouter";

const original = {
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  fwKey: process.env.FIREWORKS_API_KEY,
  fwBase: process.env.FIREWORKS_BASE_URL,
  fwModel: process.env.FIREWORKS_MODEL,
  simulate: process.env.AI_SIMULATE_PRIMARY_FAILURE,
};

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function setEnv(values: {
  openai?: string;
  anthropic?: string;
  fwKey?: string;
  fwBase?: string;
  fwModel?: string;
}) {
  process.env.OPENAI_API_KEY = values.openai ?? "";
  process.env.ANTHROPIC_API_KEY = values.anthropic ?? "";
  process.env.FIREWORKS_API_KEY = values.fwKey ?? "";
  process.env.FIREWORKS_BASE_URL = values.fwBase ?? "https://fireworks.test/v1";
  process.env.FIREWORKS_MODEL = values.fwModel ?? "accounts/fireworks/models/test-model";
}

afterEach(() => {
  restore("OPENAI_API_KEY", original.openai);
  restore("ANTHROPIC_API_KEY", original.anthropic);
  restore("FIREWORKS_API_KEY", original.fwKey);
  restore("FIREWORKS_BASE_URL", original.fwBase);
  restore("FIREWORKS_MODEL", original.fwModel);
  restore("AI_SIMULATE_PRIMARY_FAILURE", original.simulate);
  vi.unstubAllGlobals();
});

const messages = [{ role: "user" as const, content: "hello" }];

describe("inference router providers", () => {
  it("calls an OpenAI-compatible Fireworks endpoint", async () => {
    setEnv({ fwKey: "fw_test" });
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("https://fireworks.test/v1/chat/completions");
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "fireworks reply" } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runInference({ model: "fireworks", messages });
    expect(result).toEqual({
      reply: "fireworks reply",
      model: "accounts/fireworks/models/test-model",
      provider: "fireworks",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails over from OpenAI to Fireworks", async () => {
    setEnv({ openai: "bad-openai", fwKey: "fw_test" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        if (String(url).includes("api.openai.com")) throw new Error("openai down");
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "fallback reply" } }] }),
          { status: 200 },
        );
      }),
    );

    const result = await runInference({ model: "gpt-4o-mini", messages });
    expect(result.provider).toBe("fireworks");
    expect(result.reply).toBe("fallback reply");
  });

  it("uses the deterministic local responder when no live keys exist", async () => {
    setEnv({});
    const result = await runInference({ model: "fireworks", messages });
    expect(result.provider).toBe("local");
    expect(result.model).toBe("accounts/fireworks/models/test-model");
    expect(result.reply).toContain("No wallet address");
  });

  it("keeps the simulated primary-failure fallback for the agent eval", async () => {
    setEnv({ openai: "sk-test-local" });
    process.env.AI_SIMULATE_PRIMARY_FAILURE = "true";
    const result = await runInference({ model: "gpt-4o-mini", messages });
    expect(result.provider).toBe("local-fallback");
    expect(result.model).toBe(ANTHROPIC_MODEL);
  });

  it("documents a Fireworks default model", () => {
    expect(FIREWORKS_MODEL_DEFAULT).toContain("accounts/fireworks/models/");
  });
});
