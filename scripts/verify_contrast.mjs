#!/usr/bin/env node
import { readFileSync } from "node:fs";

const TOKEN_PATHS = {
  "bg.canvas": ["color", "bg", "canvas"],
  "bg.surface": ["color", "bg", "surface"],
  "bg.elevated": ["color", "bg", "elevated"],
  "text.primary": ["color", "text", "primary"],
  "text.secondary": ["color", "text", "secondary"],
  "text.muted": ["color", "text", "muted"],
  "text.onAccent": ["color", "text", "onAccent"],
  "accent.cyan": ["color", "accent", "cyan"],
  "accent.ultraviolet": ["color", "accent", "ultraviolet"],
  "accent.mint": ["color", "accent", "mint"],
  "semantic.warning": ["color", "semantic", "warning"],
  "semantic.error": ["color", "semantic", "error"],
  "border.subtle": ["color", "border", "subtle"],
  "border.interactive": ["color", "border", "interactive"],
};

export const PAIRS = [
  { fg: "text.primary", bg: "bg.canvas", min: 4.5 },
  { fg: "text.primary", bg: "bg.surface", min: 4.5 },
  { fg: "text.secondary", bg: "bg.canvas", min: 4.5 },
  { fg: "text.secondary", bg: "bg.surface", min: 4.5 },
  { fg: "text.muted", bg: "bg.canvas", min: 4.5 },
  { fg: "text.muted", bg: "bg.surface", min: 4.5 },
  { fg: "text.onAccent", bg: "accent.cyan", min: 4.5 },
  { fg: "accent.cyan", bg: "bg.surface", min: 4.5 },
  { fg: "accent.ultraviolet", bg: "bg.surface", min: 4.5 },
  { fg: "accent.mint", bg: "bg.surface", min: 4.5 },
  { fg: "semantic.warning", bg: "bg.surface", min: 4.5 },
  { fg: "semantic.error", bg: "bg.surface", min: 4.5 },
  { fg: "border.interactive", bg: "bg.canvas", min: 3.0 },
];

export function loadTokens(path = "blueprint/design-tokens.json") {
  const json = JSON.parse(readFileSync(path, "utf8"));
  const colors = {};
  for (const [name, pathParts] of Object.entries(TOKEN_PATHS)) {
    let node = json;
    for (const part of pathParts) node = node?.[part];
    if (!node?.$value) throw new Error(`Missing token ${name} (${pathParts.join(".")})`);
    colors[name] = node.$value;
  }
  return colors;
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function verifyContrast(colors) {
  return PAIRS.map((pair) => {
    const ratio = contrastRatio(colors[pair.fg], colors[pair.bg]);
    return {
      pair: `${pair.fg} on ${pair.bg}`,
      ratio: Number(ratio.toFixed(2)),
      min: pair.min,
      pass: ratio >= pair.min,
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2] || "blueprint/design-tokens.json";
  const results = verifyContrast(loadTokens(path));
  let failed = 0;
  for (const r of results) {
    console.log(
      `${r.pass ? "PASS" : "FAIL"}  ${r.ratio.toFixed(2).padStart(6)}:1  (min ${r.min})  ${r.pair}`,
    );
    if (!r.pass) failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} pairs pass WCAG 2.2 AA`);
  process.exit(failed ? 1 : 0);
}
