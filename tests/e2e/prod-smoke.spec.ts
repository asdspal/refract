import { test, expect } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000";

test.describe("production smoke", () => {
  test("health endpoint reports postgres ok", async ({ request }) => {
    const res = await request.get(`${baseURL}/api/v1/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.postgres).toBe("ok");
    expect(typeof body.solanaNetwork).toBe("string");
  });

  test("vault stats endpoint returns 90/10 telemetry", async ({ request }) => {
    const res = await request.get(`${baseURL}/api/v1/defi/vault-stats`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.totalPoolMicroUsdc).toBeGreaterThanOrEqual(0);
    expect(body.currentApyBps).toBeGreaterThan(0);
  });

  test("all three routes render", async ({ page }) => {
    for (const [path, heading] of [
      ["/studio", /Studio/],
      ["/playground", /x402 AI Playground/],
      ["/merchant", /Merchant/],
    ] as const) {
      const response = await page.goto(`${baseURL}${path}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("unpaid AI call returns HTTP 402 with PAYMENT-REQUIRED", async ({ request }) => {
    const res = await request.post(`${baseURL}/api/v1/ai/chat`, {
      data: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "hello" }],
      },
    });
    expect(res.status()).toBe(402);
    const header = res.headers()["payment-required"];
    expect(header).toBeTruthy();
    const challenge = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    expect(challenge.version).toBe("2.0");
    expect(challenge.schemes).toContain("zkapi-runtime-key");
  });
});
