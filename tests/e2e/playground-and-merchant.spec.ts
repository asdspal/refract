import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const STATS = {
  totalPoolMicroUsdc: 25_000_000,
  kaminoStakedMicroUsdc: 22_500_000,
  liquidReserveMicroUsdc: 2_500_000,
  optimisticUtilizedMicroUsdc: 0,
  currentApyBps: 940,
  subsidyBonusBps: 840,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("refract_runtime_key", "rk_live_demo_e2e");
    localStorage.setItem(
      "refract_note_meta",
      JSON.stringify({
        commitmentHex: "0x" + "ab".repeat(32),
        nullifierHashHex: "0x91a4c201" + "0".repeat(56),
        sessionPubkeyHashHex: "0x" + "cd".repeat(32),
        amountMicroUsdc: "10000000",
        backedUp: true,
      }),
    );
    localStorage.setItem("refract_origin_quote_id", "quote_demo_123");
  });

  await page.route("**/api/v1/defi/vault-stats", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STATS) }),
  );
  await page.route("**/api/v1/ai/chat", async (route) => {
    const headers = route.request().headers();
    if (headers["x-simulate-endpoint-cost-micro-usdc"]) {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          code: "ERR_SPEND_CAP_EXCEEDED",
          message:
            "Blocked by Agent Spend Policy Firewall: endpoint costs $2.50 (cap $0.10/req). 0.00 USDC deducted.",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "X-ZKAPI-RECEIPT": Buffer.from(
          JSON.stringify({ version: "refract-receipt-v1", signature: "e2e" }),
        ).toString("base64"),
        "X-Correlation-Id": "req_e2e",
      },
      body: JSON.stringify({
        reply:
          "Vault utilization is 78.4%. Upgrade authority is locked behind a 48h multisig.",
        model: "gpt-4o-mini-2024-07-18",
        chargedMicroUsdc: 15_000,
        remainingMicroUsdc: 5_420_000,
        walletBytesReceived: 0,
        correlationId: "req_e2e",
      }),
    });
  });
  await page.route("**/api/v1/intents/refund", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        auroraRefundQuoteId: "refund_demo_123",
        refundedMicroUsdc: 8_030_000,
        status: "PROCESSING_REFUND",
      }),
    }),
  );
});

test("private x402 chat, firewall block, inspector and refund", async ({ page }) => {
  await page.goto("/playground");
  await expect(page.getByRole("heading", { name: /x402 AI Playground/ })).toBeVisible();

  await page.getByLabel("Prompt").fill("Audit Kamino vault authority & utilization.");
  await page.getByRole("button", { name: "Send Private x402 Request" }).click();

  await expect(page.getByText(/Vault utilization is 78.4%/)).toBeVisible();
  await expect(page.getByText(/HTTP 402 paid/)).toBeVisible();
  await expect(page.getByText(/Schnorr receipt:/)).toBeVisible();
  await expect(page.getByText(/Wallet Bytes Sent: 0 BYTES/)).toBeVisible();

  await page.getByRole("tab", { name: "Raw HTTP 402 Headers" }).scrollIntoViewIfNeeded();
  await page.getByRole("tab", { name: "Raw HTTP 402 Headers" }).click({ force: true });
  await expect(page.getByText(/X-ZKAPI-RECEIPT:/)).toBeVisible();

  await page.getByRole("button", { name: "Simulate $2.50 Prompt-Injection Attack" }).click();
  const firewallAlert = page
    .getByRole("alert")
    .filter({ hasText: "ERR_SPEND_CAP_EXCEEDED" });
  await expect(firewallAlert).toBeVisible();
  await expect(firewallAlert).toContainText("0.00 USDC deducted");

  await page.getByRole("button", { name: /Close Note/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Execute Reverse Aurora Intent" }).click({ force: true });
  await expect(page.getByText(/Refund status: PROCESSING_REFUND/)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("playground passes WCAG 2.2 AA axe scan", async ({ page }) => {
  await page.goto("/playground");
  await expect(page.getByRole("heading", { name: /x402 AI Playground/ })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("merchant dashboard shows an unlinkable receipt ledger", async ({ page }) => {
  await page.goto("/merchant");
  await expect(page.getByRole("heading", { name: /Merchant/ })).toBeVisible();
  await expect(page.getByText("[UNLINKABLE ZK]")).toBeVisible();
  await expect(page.getByText(/90% Kamino DeFi Staked Float/)).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
