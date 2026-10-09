import { getSelectedText } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import TurndownService from "turndown";

// Runs entirely on the macOS pasteboard rather than Raycast's Clipboard API, whose
// reads can lag behind (returning the previous copy). The pasteboard's changeCount only
// moves when an app actually writes, so stale content can never pass as this copy.
// 1. Snapshot every item and type (text, HTML, files, images) for an exact restore.
// 2. Wait (up to 1 s) for the launch hotkey's ⇧⌃⌥⌘ keys to be released, otherwise the
//    app would receive e.g. ⌥⇧⌘C instead of ⌘C. Caps Lock is deliberately not in the mask.
// 3. Press ⌘C and wait (up to 0.6 s) for the copy to land, then read HTML and text.
// 4. Restore the snapshot, marked transient so clipboard managers don't record it again.
// The ObjC bridge returns numbers such as counts and flags as strings, hence Number().
export const COPY_SELECTION = `
ObjC.import("AppKit");
function run() {
  const pb = $.NSPasteboard.generalPasteboard;
  const saved = [];
  const items = pb.pasteboardItems;
  for (let i = 0; i < Number(items.count); i++) {
    const item = items.objectAtIndex(i);
    const types = item.types;
    const copy = $.NSPasteboardItem.alloc.init;
    for (let j = 0; j < Number(types.count); j++) {
      const type = types.objectAtIndex(j);
      const data = item.dataForType(type);
      if (!data.isNil()) copy.setDataForType(data, type);
    }
    saved.push(copy);
  }
  const before = Number(pb.changeCount);
  const released = Date.now() + 1000;
  while ((Number($.NSEvent.modifierFlags) & 0x1e0000) !== 0 && Date.now() < released) delay(0.02);
  Application("System Events").keystroke("c", { using: "command down" });
  let result = { copied: false };
  for (let waited = 0; waited < 600; waited += 20) {
    if (Number(pb.changeCount) !== before) {
      const html = pb.stringForType("public.html");
      const text = pb.stringForType("public.utf8-plain-text");
      if (!html.isNil() || !text.isNil()) {
        result = { copied: true, html: html.isNil() ? null : html.js, text: text.isNil() ? null : text.js };
        break;
      }
    }
    delay(0.02);
  }
  if (Number(pb.changeCount) !== before) {
    pb.clearContents;
    if (saved.length) {
      saved[0].setDataForType($.NSData.data, "org.nspasteboard.TransientType");
      pb.writeObjects($(saved));
    }
  }
  return JSON.stringify(result);
}
`;

type Copied = { copied: boolean; html?: string | null; text?: string | null };

// Plain-text copies drop structure; only prefer HTML when it carries some. Editors such
// as VS Code put styled <div>/<span> runs on the clipboard, which add nothing over text.
const STRUCTURE = /<(p|li|h[1-6]|blockquote|pre|table|a|strong|b|em|i|code)[\s>]/i;

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});
turndown.remove(["style", "script", "meta", "title", "head"]);
// Selected prose like file_name or 2 * 3 must reach the model and the result as written,
// not as file\_name or 2 \* 3.
turndown.escape = (text) => text;
// Turndown's built-in rule pads markers ("-   item"); the model tends to copy that.
// Same logic with one space, so nested content is indented to the marker width.
turndown.addRule("listItem", {
  filter: "li",
  replacement(content, node) {
    const parent = node.parentNode as HTMLElement;
    let prefix = "- ";
    if (parent.nodeName === "OL") {
      const start = parent.getAttribute("start");
      const index = Array.prototype.indexOf.call(parent.children, node);
      prefix = `${start ? Number(start) + index : index + 1}. `;
    }
    const isParagraph = content.endsWith("\n");
    const body = content.replace(/^\n+/, "").replace(/\n+$/, "") + (isParagraph ? "\n" : "");
    return (
      prefix +
      body.replace(/\n/gm, "\n" + " ".repeat(prefix.length)) +
      (node.nextSibling ? "\n" : "")
    );
  },
});

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html).trim();
}

/** Copy the selection with ⌘C to read it as HTML; the user's clipboard is restored after. */
async function copySelection(): Promise<Copied> {
  const output = await runAppleScript(COPY_SELECTION, { language: "JavaScript", timeout: 3000 });
  return JSON.parse(output) as Copied;
}

/**
 * Read the selection, keeping lists, headings, links, and emphasis as Markdown when
 * the app provides HTML (browsers, mail, rich editors). Falls back to plain text when
 * ⌘C is blocked, copies nothing, or the frontmost app is unknown or Raycast itself
 * (⌘C there would copy Raycast's own search text).
 */
export async function readSelection(frontmostBundleId?: string): Promise<string> {
  if (frontmostBundleId && frontmostBundleId !== "com.raycast.macos") {
    try {
      const copied = await copySelection();
      if (copied.html && STRUCTURE.test(copied.html)) {
        const markdown = htmlToMarkdown(copied.html);
        if (markdown) return markdown;
      }
      if (copied.text?.trim()) return copied.text;
    } catch {
      // Automation or Accessibility permission missing, or timed out: use plain text.
    }
  }
  return getSelectedText();
}
