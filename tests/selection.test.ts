import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getSelectedText } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import { COPY_SELECTION, htmlToMarkdown, readSelection } from "../src/lib/selection";

vi.mock("@raycast/api", () => ({ getSelectedText: vi.fn() }));
vi.mock("@raycast/utils", () => ({ runAppleScript: vi.fn() }));

const APP = "com.google.Chrome";

// The script's pasteboard snapshot, changeCount wait, and restore run in macOS; here the
// script's JSON result stands in for it.
function copying(result: { copied: boolean; html?: string | null; text?: string | null }) {
  vi.mocked(runAppleScript).mockResolvedValue(JSON.stringify(result));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSelectedText).mockResolvedValue("plain fallback");
});

describe("HTML to Markdown", () => {
  it("keeps lists, emphasis, links, headings, and code", () => {
    expect(
      htmlToMarkdown(
        `<meta charset="utf-8"><style>p{}</style><p>Intro:</p><ul><li>First <strong>bold</strong></li><li>See <a href="https://example.com">docs</a></li></ul><h2>Title</h2><pre><code>const a = 1;</code></pre>`,
      ),
    ).toBe(
      "Intro:\n\n- First **bold**\n- See [docs](https://example.com)\n\n## Title\n\n```\nconst a = 1;\n```",
    );
  });

  it("numbers ordered lists from their start and indents nested lists to the marker", () => {
    expect(
      htmlToMarkdown(`<ol start="3"><li>Three<ul><li>Nested</li></ul></li><li>Four</li></ol>`),
    ).toBe("3. Three\n   - Nested\n4. Four");
  });

  it("does not backslash-escape Markdown characters in prose", () => {
    expect(htmlToMarkdown("<p>Rename file_name to 2 * 3 [draft] #1</p>")).toBe(
      "Rename file_name to 2 * 3 [draft] #1",
    );
  });
});

describe("reading the selection", () => {
  it("converts copied HTML to Markdown", async () => {
    copying({ copied: true, text: "Intro:\nFirst", html: "<p>Intro:</p><ul><li>First</li></ul>" });
    expect(await readSelection(APP)).toBe("Intro:\n\n- First");
    expect(runAppleScript).toHaveBeenCalledWith(COPY_SELECTION, {
      language: "JavaScript",
      timeout: 3000,
    });
    expect(getSelectedText).not.toHaveBeenCalled();
  });

  it("uses the copied text when the HTML has no structure, as editors provide", async () => {
    copying({
      copied: true,
      text: "const a_b = 1;\n",
      html: '<div style="color: red"><span>const a_b = 1;</span></div>',
    });
    expect(await readSelection(APP)).toBe("const a_b = 1;\n");
  });

  it("uses the copied text when no HTML was copied", async () => {
    copying({ copied: true, text: "  Plain\n\nlines  ", html: null });
    expect(await readSelection(APP)).toBe("  Plain\n\nlines  ");
  });

  it("falls back to plain selected text when ⌘C copies nothing", async () => {
    copying({ copied: false });
    expect(await readSelection(APP)).toBe("plain fallback");
  });

  it("falls back when ⌘C is blocked or the script output is unusable", async () => {
    vi.mocked(runAppleScript).mockRejectedValueOnce(new Error("not allowed to send keystrokes"));
    expect(await readSelection(APP)).toBe("plain fallback");
    vi.mocked(runAppleScript).mockResolvedValueOnce("not json");
    expect(await readSelection(APP)).toBe("plain fallback");
  });

  it.each([
    ["Raycast is frontmost", "com.raycast.macos"],
    ["the frontmost app is unknown", undefined],
  ])("never presses ⌘C when %s", async (_case, bundleId) => {
    expect(await readSelection(bundleId)).toBe("plain fallback");
    expect(runAppleScript).not.toHaveBeenCalled();
  });
});

describe("copy script", () => {
  it("detects a fresh copy by changeCount and restores the snapshot only after a change", () => {
    expect(COPY_SELECTION).toContain("pb.changeCount");
    expect(COPY_SELECTION).not.toMatch(/\$\{|`/);
    const restore = COPY_SELECTION.indexOf("pb.writeObjects");
    expect(COPY_SELECTION.lastIndexOf("!== before", restore)).toBeGreaterThan(
      COPY_SELECTION.indexOf("keystroke"),
    );
  });

  it.runIf(process.platform === "darwin")("compiles as JavaScript for Automation", () => {
    const dir = mkdtempSync(join(tmpdir(), "copy-selection-"));
    writeFileSync(join(dir, "script.js"), COPY_SELECTION);
    expect(() =>
      execFileSync("osacompile", [
        "-l",
        "JavaScript",
        "-o",
        join(dir, "script.scpt"),
        join(dir, "script.js"),
      ]),
    ).not.toThrow();
  });
});
