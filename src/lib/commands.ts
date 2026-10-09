import { fixSpellingAndGrammar, placeholders, systemPrompt, toChinese, toEnglish } from "./prompts";

export type CommandId = "to-chinese" | "to-english" | "fix-spelling-and-grammar";

export const commands: Record<CommandId, { title: string; prompt: string }> = {
  "to-chinese": {
    title: "To Chinese",
    prompt: toChinese,
  },
  "to-english": {
    title: "To English",
    prompt: toEnglish,
  },
  "fix-spelling-and-grammar": {
    title: "Fix Spelling and Grammar",
    prompt: fixSpellingAndGrammar,
  },
};

/** Shared by the hotkey launcher and the result view so both reject the same input. */
export function inputError(text: string): string | undefined {
  if (!text.trim()) return "Select text in another app, then launch this command.";
  if (text.length > 30_000) return "Please use 30,000 characters or fewer.";
  return undefined;
}

/**
 * The text that Copy Result and Paste Result use. For To English this is only the
 * translation, without its heading, outer code fence, or the back-translation. Falls
 * back to the whole response when the model does not follow the output format.
 */
export function resultText(command: CommandId, output: string): string {
  const text = output.trim();
  if (command !== "to-english") return text;
  const start = text.search(/^#+\s*Translation Result\s*$/im);
  if (start < 0) return text;
  let section = text.slice(start).replace(/^.*\n?/, "");
  const end = section.search(/^#+\s*Back-Translation\s*$/im);
  if (end >= 0) section = section.slice(0, end);
  section = section.trim();
  const fenced = /^```[^\n]*\n([\s\S]*)\n```$/.exec(section);
  return (fenced ? fenced[1]! : section).trim() || text;
}

/** Expand `\(name)` markers and insert the selection; only the template is parsed, never the selection. */
export function buildPrompts(command: CommandId, selection: string) {
  const parts = commands[command].prompt.split(/(\{[^}]+\}|\\\(\w+\))/);
  return {
    system: systemPrompt,
    prompt: parts
      .map((part) => {
        if (part === "{selection}") return selection;
        const name = /^\\\((\w+)\)$/.exec(part)?.[1];
        if (name === undefined) return part;
        if (!Object.hasOwn(placeholders, name))
          throw new Error(`Unknown prompt placeholder: ${name}`);
        return placeholders[name];
      })
      .join(""),
  };
}
