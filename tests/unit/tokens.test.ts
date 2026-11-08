import { describe, expect, it } from "vitest";
import {
  loadTokens,
  verifyContrast,
  contrastRatio,
  relativeLuminance,
} from "../../scripts/verify_contrast.mjs";

describe("design token contrast", () => {
  const tokens = loadTokens() as Record<string, string>;
  const results = verifyContrast(tokens);

  it("evaluates all 13 foreground/background pairs", () => {
    expect(results).toHaveLength(13);
  });

  it("passes WCAG 2.2 AA for every pair", () => {
    const failures = results.filter((r: { pass: boolean }) => !r.pass);
    expect(failures).toEqual([]);
  });

  it("computes known ratios correctly", () => {
    expect(contrastRatio("#F8FAFC", "#090A0F")).toBeCloseTo(18.9, 1);
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("keeps primary text at AAA on surface", () => {
    expect(contrastRatio(tokens["text.primary"], tokens["bg.surface"])).toBeGreaterThanOrEqual(7);
  });

  it("keeps interactive borders at non-text AA (>= 3:1)", () => {
    expect(
      contrastRatio(tokens["border.interactive"], tokens["bg.canvas"]),
    ).toBeGreaterThanOrEqual(3);
  });
});
