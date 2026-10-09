import type { Color } from "@raycast/api";
import { describe, expect, it } from "vite-plus/test";
import { correctedDiff, diffImages, grammarDiffMarkdown } from "../src/lib/grammar-diff";

// The native Raycast runtime is unavailable in Node; use its documented enum values.
const colors = {
  added: "raycast-green" as Color.Green,
  unchanged: "raycast-primary-text" as Color.PrimaryText,
};

describe("grammar diff", () => {
  it("highlights only the changed punctuation and inserted word in the reference example", () => {
    const tokens = correctedDiff(
      "Not just the health-related parts, include entire app.",
      "Not just the health-related parts; include the entire app.",
    )!;
    expect(
      tokens.filter((token) => token.added && token.text.trim()).map((token) => token.text),
    ).toEqual([";", "the"]);
    expect(tokens.map((token) => token.text).join("")).toBe(
      "Not just the health-related parts; include the entire app.",
    );
  });

  it("handles replacements, repeated words, deletions, Unicode, and paragraphs", () => {
    for (const [before, after, changes] of [
      ["She work here.", "She works here.", ["works"]],
      ["the the app", "the app", []],
      ["你好\n\nThis are café.", "你好\n\nThis is café.", ["is"]],
      ["", "Hello!", ["Hello", "!"]],
    ] as const) {
      const tokens = correctedDiff(before, after)!;
      expect(tokens.map((token) => token.text).join("")).toBe(after);
      expect(
        tokens.filter((token) => token.added && token.text.trim()).map((token) => token.text),
      ).toEqual(changes);
    }
  });

  it("renders highlights and keeps clipboard text clean", () => {
    const output = "She works here.";
    const display = grammarDiffMarkdown("She work here.", output, colors);
    expect(display).toContain("data:image/svg+xml,");
    expect(display).not.toContain("She works here.");
    expect(grammarDiffMarkdown("She works here.", output, colors)).toBe(output);
  });

  it("escapes user content and uses green text and a translucent background", () => {
    const image = diffImages([{ text: '<script>&"hello"', added: true }], colors);
    const svg = decodeURIComponent(image.split("svg+xml,")[1].split("?")[0]);
    expect(svg).toContain("&lt;");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain('fill="raycast-green"');
    expect(svg).toContain('fill-opacity="0.18"');
  });

  it("wraps long words and preserves explicit line breaks", () => {
    const images = diffImages(
      [{ text: "a".repeat(2000) + "\nline".repeat(45), added: true }],
      colors,
      true,
    );
    expect(images.split("\n\n").length).toBeGreaterThan(3);
    for (const image of images.split("\n\n")) {
      expect(Number(image.match(/raycast-height=(\d+)/)![1])).toBeLessThanOrEqual(544);
    }
  });

  it("keeps alternating changed and unchanged words on one line in one image", () => {
    const images = diffImages(correctedDiff("i want sleep", "I want to sleep.")!, colors);
    expect(images.match(/data:image/g)).toHaveLength(1);
    expect(images).not.toContain("raycast-tint-color");
    const svg = decodeURIComponent(images.split("svg+xml,")[1].split("?")[0]);
    expect(svg).toContain('fill="raycast-green"');
    expect(svg).toContain('fill="raycast-primary-text"');
    const runs = [...svg.matchAll(/<text x="([^"]+)" y="([^"]+)"[^>]*>(.*?)<\/text>/g)];
    expect(runs.map((run) => run[3]).join("")).toBe("I want to sleep.");
    expect(new Set(runs.map((run) => run[2])).size).toBe(1);
    expect(runs.every((run, i) => i === 0 || Number(run[1]) > Number(runs[i - 1][1]))).toBe(true);
  });

  it("keeps every estimated run inside the 750px viewport", () => {
    const text = "Mixed widths: mmmm iiii WWWW 中文字符 café, https://example.com/".repeat(30);
    for (const large of [false, true]) {
      const images = diffImages([{ text, added: true }], colors, large);
      for (const image of images.split("\n\n")) {
        const svg = decodeURIComponent(image.split("svg+xml,")[1].split("?")[0]);
        const runs = [...svg.matchAll(/<text x="([^"]+)"[^>]*textLength="([^"]+)"/g)];
        expect(runs.length).toBeGreaterThan(0);
        for (const [, x, length] of runs)
          expect(Number(x) + Number(length)).toBeLessThanOrEqual(748);
      }
    }
  });

  it("bounds comparison work on large rewrites", () => {
    expect(correctedDiff("a ".repeat(2000), "b ".repeat(2000))).toBeUndefined();
    const output = "b ".repeat(2000);
    expect(grammarDiffMarkdown("a ".repeat(2000), output, colors)).toBe(output);
  });
});
