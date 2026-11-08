import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("WCAG 2.2 AA shell", () => {
  test("has zero axe-core violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("interactive controls meet 44px touch targets", async ({ page }) => {
    await page.goto("/");
    const controls = page.locator(
      "header a, header button, header input, header select, main a, main button, main input, main select",
    );
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      if (!box) continue;
      expect(box.height, `control ${i} height`).toBeGreaterThanOrEqual(44);
    }
  });

  test("has no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
});
