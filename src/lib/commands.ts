import {
  changeToneToCasual,
  changeToneToConfident,
  changeToneToFriendly,
  changeToneToProfessional,
  explainThisInSimpleTerms,
  fixSpellingAndGrammar,
  improveWriting,
  makeLonger,
  makeShorter,
  placeholders,
  systemPrompt,
  toChinese,
  toEnglish,
} from "./prompts";

type Presentation = "plain" | "translation-result" | "grammar-diff";

type CommandDefinition = {
  title: string;
  prompt: string;
  presentation: Presentation;
};

export const commands = {
  "to-chinese": {
    title: "To Chinese",
    prompt: toChinese,
    presentation: "plain",
  },
  "to-english": {
    title: "To English",
    prompt: toEnglish,
    presentation: "translation-result",
  },
  "fix-spelling-and-grammar": {
    title: "Fix Spelling and Grammar",
    prompt: fixSpellingAndGrammar,
    presentation: "grammar-diff",
  },
  "improve-writing": {
    title: "Improve Writing",
    prompt: improveWriting,
    presentation: "plain",
  },
  "explain-this-in-simple-terms": {
    title: "Explain This in Simple Terms",
    prompt: explainThisInSimpleTerms,
    presentation: "plain",
  },
  "make-longer": {
    title: "Make Longer",
    prompt: makeLonger,
    presentation: "plain",
  },
  "make-shorter": {
    title: "Make Shorter",
    prompt: makeShorter,
    presentation: "plain",
  },
  "change-tone-to-professional": {
    title: "Change Tone to Professional",
    prompt: changeToneToProfessional,
    presentation: "plain",
  },
  "change-tone-to-friendly": {
    title: "Change Tone to Friendly",
    prompt: changeToneToFriendly,
    presentation: "plain",
  },
  "change-tone-to-confident": {
    title: "Change Tone to Confident",
    prompt: changeToneToConfident,
    presentation: "plain",
  },
  "change-tone-to-casual": {
    title: "Change Tone to Casual",
    prompt: changeToneToCasual,
    presentation: "plain",
  },
} as const satisfies Record<string, CommandDefinition>;

export type CommandId = keyof typeof commands;

export function commandIds(): CommandId[] {
  return Object.keys(commands) as CommandId[];
}

export function inputError(text: string): string | undefined {
  if (!text.trim()) return "Select text in another app, then launch this command.";
  if (text.length > 30_000) return "Please use 30,000 characters or fewer.";
  return undefined;
}

export function resultText(command: CommandId, output: string): string {
  const text = output.trim();
  if (commands[command].presentation !== "translation-result") return text;
  const start = text.search(/^#+\s*Translation Result\s*$/im);
  if (start < 0) return text;
  let section = text.slice(start).replace(/^.*\n?/, "");
  const end = section.search(/^#+\s*Back-Translation\s*$/im);
  if (end >= 0) section = section.slice(0, end);
  section = section.trim();
  const fenced = /^```[^\n]*\n([\s\S]*)\n```$/.exec(section);
  return (fenced ? fenced[1]! : section).trim() || text;
}

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

export type RunStatus = "loading" | "no-input" | "streaming" | "done" | "stopped" | "error";

export function presentCommand(
  command: CommandId,
  args: {
    status: RunStatus;
    output: string;
    highlightChanges: () => string;
  },
): { shown: string; copied: string } {
  const shown =
    commands[command].presentation === "grammar-diff" && args.status === "done"
      ? args.highlightChanges()
      : args.output;
  return { shown, copied: resultText(command, args.output) };
}

export function directOpenGuidance(): string {
  const bullets = commandIds().map((id) => `- **${commands[id].title}**`);
  return `Select text in another app, then run a language command.\n\n${bullets.join("\n")}`;
}
