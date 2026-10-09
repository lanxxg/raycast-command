import type { Color } from "@raycast/api";
import { diffWordsWithSpace } from "diff";

/*
 * Known limits (each degrades to plain output or approximate layout, never wrong text):
 * - Diffing gives up past 512 edits or 50 ms; grammarDiffMarkdown then returns the
 *   response unchanged, so large rewrites show no highlights.
 * - Layout uses estimated glyph widths (`advance`), not real font metrics. Runs are
 *   squeezed or stretched to that width, so unusual fonts or scripts may look uneven.
 * - Text is wrapped at 750px and split into images of at most 20 lines each.
 */

export type DiffColors = { added: Color; unchanged: Color };

export type DiffToken = { text: string; added: boolean };
/** Match words and punctuation independently; deleted text is omitted from the result. */
export function correctedDiff(original: string, corrected: string): DiffToken[] | undefined {
  // Fall back to native text if a large rewrite would block Raycast.
  return diffWordsWithSpace(original, corrected, {
    oneChangePerToken: true,
    maxEditLength: 512,
    timeout: 50,
  })
    ?.filter((change) => !change.removed)
    .map((change) => ({ text: change.value, added: change.added }));
}

function escapeXml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!,
  );
}

// Approximate system-font advances, then constrain each SVG run to that width so
// highlights and wrapping stay aligned regardless of the installed fallback font.
function advance(char: string, size: number): number {
  if (/\p{Mark}/u.test(char)) return 0;
  if (char.codePointAt(0)! > 0x02ff) return size;
  if (/[ ilI.,'!:;|]/.test(char)) return size * 0.27;
  if (/[mwMW@]/.test(char)) return size * 0.85;
  if (/[A-Z]/.test(char)) return size * 0.64;
  return size * 0.52;
}

export function diffImages(tokens: DiffToken[], colors: DiffColors, large = false): string {
  const size = large ? 17 : 15;
  const lineHeight = size + 10;
  const width = 750;
  const images: string[] = [];
  let elements: string[] = [];
  let x = 2;
  let line = 0;
  // Raycast resolves its Color tokens inside SVG fills. Keep every run in one
  // image: separate Markdown images are rendered as separate blocks in Detail.
  // URI encoding keeps color tokens visible to Raycast; base64 hides them.
  function flush() {
    const height = (line + 1) * lineHeight + 4;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g font-family="-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif" font-size="${size}" xml:space="preserve">${elements.join("")}</g></svg>`;
    images.push(
      `![Corrected text with changes highlighted in green](data:image/svg+xml,${encodeURIComponent(svg).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16)}`)}?raycast-width=${width}&raycast-height=${height})`,
    );
    elements = [];
    line = 0;
  }
  function newline() {
    x = 2;
    if (line === 19) flush();
    else line++;
  }
  function draw(text: string, added: boolean) {
    const length = Array.from(text).reduce((sum, char) => sum + advance(char, size), 0);
    if (added && text.trim())
      elements.push(
        `<rect x="${x}" y="${line * lineHeight + 2}" width="${length}" height="${size + 4}" rx="2" fill="${colors.added}" fill-opacity="0.18"/>`,
      );
    if (length)
      elements.push(
        `<text x="${x}" y="${line * lineHeight + size + 2}" fill="${added ? colors.added : colors.unchanged}" textLength="${length}" lengthAdjust="spacingAndGlyphs">${escapeXml(text)}</text>`,
      );
    x += length;
  }
  for (const token of tokens) {
    for (const part of token.text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split(/(\n)/)) {
      if (part === "\n") {
        newline();
        continue;
      }
      const length = Array.from(part).reduce((sum, char) => sum + advance(char, size), 0);
      if (x > 2 && x + length > width - 2) newline();
      if (length <= width - 4) {
        draw(part, token.added);
        continue;
      }
      // Long URLs or unbroken words must also fit the viewport.
      let run = "";
      let runWidth = 0;
      for (const char of part) {
        const charWidth = advance(char, size);
        if (runWidth + charWidth > width - 4) {
          draw(run, token.added);
          newline();
          run = "";
          runWidth = 0;
        }
        run += char;
        runWidth += charWidth;
      }
      draw(run, token.added);
    }
  }
  if (elements.length || !images.length) flush();
  return images.join("\n\n");
}

/** Presentation only: the original response remains the source for copy/paste. */
export function grammarDiffMarkdown(
  input: string,
  output: string,
  colors: DiffColors,
  large = false,
): string {
  const corrected = output.trim();
  if (!corrected) return output;
  const tokens = correctedDiff(input.trim(), corrected);
  if (!tokens?.some((token) => token.added && token.text.trim())) return output;
  return diffImages(tokens, colors, large);
}
