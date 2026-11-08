import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const QUOTE = {
  auroraQuoteId: "quote_demo_123",
  depositAddress: "0xE74E1eFB38DD20f09967E1Ec9DAd99c7c24492A8",
  expectedSolanaMicroUsdc: 10_000_000,
  integratorFeeBps: 30,
  confidentialMode: true,
  correlationId: "quote_demo_123",
};

const CREDIT = {
  sessionId: "session_demo",
  runtimeKey: "rk_live_opt_demo_0123456789",
  optimisticCreditMicroUsdc: 5_000_000,
  yieldSubsidyBonusMicroUsdc: 420_000,
  latencyMs: 184,
};

const STATS = {
  totalPoolMicroUsdc: 25_000_000,
  kaminoStakedMicroUsdc: 22_500_000,
  liquidReserveMicroUsdc: 2_500_000,
  optimisticUtilizedMicroUsdc: 0,
  currentApyBps: 940,
  subsidyBonusBps: 840,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/intents/quote", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(QUOTE) }),
  );
  await page.route("**/api/v1/intents/optimistic-credit", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CREDIT) }),
  );
  await page.route("**/api/v1/defi/vault-stats", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STATS) }),
  );
});

test("deposit flow downloads the note backup and activates optimistic credit", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: /Studio/ })).toBeVisible();

  await page.getByLabel("Deposit Amount (USDC)").fill("10");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Refract Liquidity/ }).click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^refract-note-[0-9a-f]+\.json$/);

  await expect(page.getByText(/Instant Credit Active/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Aurora deposit address/)).toBeVisible();
  await expect(page.getByText(/90% Kamino/)).toBeVisible();
  await expect(page.getByText(/9\.40% APY/)).toBeVisible();
});

test("studio passes WCAG 2.2 AA axe scan", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: /Studio/ })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
