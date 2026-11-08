import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { QuoteRequest, QuoteResponse } from "@defuse-protocol/one-click-sdk-typescript";
import { closePool, query } from "../../src/db/index";
import {
  AuroraQuoteError,
  buildQuoteRequest,
  createConfidentialDepositQuote,
} from "../../src/lib/aurora/oneClickService";
import { POST as quotePOST } from "../../src/app/api/v1/intents/quote/route";

const root = resolve(__dirname, "../..");
const BASE_USDC =
  "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
const commitments: string[] = [];

function newCommitment(): string {
  const hex = randomBytes(32).toString("hex");
  const value = "0x" + hex;
  commitments.push(value);
  return value;
}

function params(overrides: Record<string, unknown> = {}) {
  return {
    originChain: "base",
    originAsset: BASE_USDC,
    amountRaw: "10000000",
    refundAddress: "0x71C95911E9a5D330f4D621842EC243EE1343292e",
    poseidonCommitmentHex: newCommitment(),
    confidentialMode: true,
    ...overrides,
  };
}

function fakeQuote(amountOut = "9731640"): QuoteResponse {
  return {
    correlationId: randomUUID(),
    timestamp: new Date().toISOString(),
    signature: "test-signature",
    quoteRequest: {} as QuoteRequest,
    quote: {
      depositAddress: "0xE74E1eFB38DD20f09967E1Ec9DAd99c7c24492A8",
      amountIn: "10000000",
      amountInFormatted: "10.0",
      amountInUsd: "10.0",
      minAmountIn: "10000000",
      amountOut,
      amountOutFormatted: "9.73",
      amountOutUsd: "9.73",
      minAmountOut: "9634323",
      timeEstimate: 30,
    },
  };
}

beforeAll(async () => {
  const upSql = readFileSync(
    resolve(root, "src/db/migrations/0001_init_refract_schema.up.sql"),
    "utf8",
  );
  await query(upSql);
});

afterAll(async () => {
  if (commitments.length > 0) {
    await query("DELETE FROM intent_deposits WHERE poseidon_commitment_hex = ANY($1)", [
      commitments,
    ]);
  }
  await closePool();
});

describe("Aurora quote request construction", () => {
  it("passes Confidential Intents + 30 bps integrator fee", () => {
    const prev = process.env.AURORA_STUDIO_JWT_TOKEN;
    process.env.AURORA_STUDIO_JWT_TOKEN = "test.jwt.token";
    try {
      const req = buildQuoteRequest(params());
      expect(req.confidentiality).toBe("basic");
      expect(req.appFees?.[0].fee).toBe(30);
      expect(req.appFees?.[0].recipient).toBe("refract-treasury.near");
      expect(req.destinationAsset).toContain("sol-5ce3bf3a");
      expect(req.depositType).toBe("ORIGIN_CHAIN");
      expect(req.swapType).toBe("EXACT_INPUT");
      expect(req.amount).toBe("10000000");
    } finally {
      process.env.AURORA_STUDIO_JWT_TOKEN = prev ?? "";
    }
  });

  it("requires a Studio JWT for confidential quotes", async () => {
    const prev = process.env.AURORA_STUDIO_JWT_TOKEN;
    process.env.AURORA_STUDIO_JWT_TOKEN = "";
    try {
      await expect(createConfidentialDepositQuote(params())).rejects.toMatchObject({
        code: "ERR_CONFIDENTIAL_AUTH_REQUIRED",
      });
    } finally {
      process.env.AURORA_STUDIO_JWT_TOKEN = prev ?? "";
    }
  });

  it("rejects deposits below $1.00", () => {
    const prev = process.env.AURORA_STUDIO_JWT_TOKEN;
    process.env.AURORA_STUDIO_JWT_TOKEN = "test.jwt.token";
    try {
      expect(() => buildQuoteRequest(params({ amountRaw: "100000" }))).toThrow(
        AuroraQuoteError,
      );
      try {
        buildQuoteRequest(params({ amountRaw: "100000" }));
      } catch (err) {
        expect((err as AuroraQuoteError).code).toBe("ERR_MIN_DEPOSIT_NOT_MET");
      }
    } finally {
      process.env.AURORA_STUDIO_JWT_TOKEN = prev ?? "";
    }
  });
});

describe("Aurora quote persistence", () => {
  it("persists a confidential quote idempotently by commitment", async () => {
    const prev = process.env.AURORA_STUDIO_JWT_TOKEN;
    process.env.AURORA_STUDIO_JWT_TOKEN = "test.jwt.token";
    try {
      const p = params();
      const captured: { req?: QuoteRequest } = {};
      const quoteFn = async (req: QuoteRequest) => {
        captured.req = req;
        return fakeQuote();
      };

      const first = await createConfidentialDepositQuote(p, { quoteFn });
      expect(first.depositAddress).toBe(
        "0xE74E1eFB38DD20f09967E1Ec9DAd99c7c24492A8",
      );
      expect(first.expectedSolanaMicroUsdc).toBe(9_731_640);
      expect(first.confidentialMode).toBe(true);
      expect(first.integratorFeeBps).toBe(30);
      expect(captured.req?.confidentiality).toBe("basic");

      const second = await createConfidentialDepositQuote(p, { quoteFn });
      expect(second.auroraQuoteId).toBe(first.auroraQuoteId);

      const rows = await query<{ count: string; status: string }>(
        `SELECT count(*)::text AS count, min(status) AS status
           FROM intent_deposits WHERE poseidon_commitment_hex = $1`,
        [p.poseidonCommitmentHex],
      );
      expect(Number(rows.rows[0].count)).toBe(1);
      expect(rows.rows[0].status).toBe("QUOTE_CREATED");
    } finally {
      process.env.AURORA_STUDIO_JWT_TOKEN = prev ?? "";
    }
  });
});

describe("live Aurora 1Click contract", () => {
  it(
    "creates a real public quote with a deposit address",
    async () => {
      const started = performance.now();
      const quote = await createConfidentialDepositQuote(
        params({ confidentialMode: false }),
      );
      const latency = performance.now() - started;

      expect(quote.depositAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(quote.expectedSolanaMicroUsdc).toBeGreaterThan(0);
      expect(quote.integratorFeeBps).toBe(30);
      expect(quote.confidentialMode).toBe(false);
      console.log(`live Aurora quote latency ${latency.toFixed(0)}ms`);
      expect(latency).toBeLessThan(5_000);
    },
    30_000,
  );
});

describe("POST /api/v1/intents/quote", () => {
  it("returns 400 ERR_MIN_DEPOSIT_NOT_MET before calling Aurora", async () => {
    const res = await quotePOST(
      new Request("http://localhost/api/v1/intents/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params({ amountRaw: "500000" })),
      }),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("X-Correlation-Id")).toMatch(/^req_/);
    const body = await res.json();
    expect(body.code).toBe("ERR_MIN_DEPOSIT_NOT_MET");
  });

  it("returns 503 when confidential mode has no Studio JWT", async () => {
    const prev = process.env.AURORA_STUDIO_JWT_TOKEN;
    process.env.AURORA_STUDIO_JWT_TOKEN = "";
    try {
      const res = await quotePOST(
        new Request("http://localhost/api/v1/intents/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(params()),
        }),
      );
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.code).toBe("ERR_CONFIDENTIAL_AUTH_REQUIRED");
    } finally {
      process.env.AURORA_STUDIO_JWT_TOKEN = prev ?? "";
    }
  });

  it(
    "returns a live public quote with correlation header",
    async () => {
      const res = await quotePOST(
        new Request("http://localhost/api/v1/intents/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(params({ confidentialMode: false })),
        }),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Correlation-Id")).toMatch(/^req_/);
      const body = await res.json();
      expect(body.depositAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(body.expectedSolanaMicroUsdc).toBeGreaterThan(0);
    },
    30_000,
  );
});
