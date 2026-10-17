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
  description: string;
  prompt: string;
  presentation: Presentation;
};

const registry = {
  "to-chinese": {
    title: "To Chinese",
    description: "Translate into natural Chinese while preserving technical terms and code.",
    prompt: toChinese,
    presentation: "plain",
  },
  "to-english": {
    title: "To English",
    description: "Translate into fluent English with a Chinese back-translation.",
    prompt: toEnglish,
    presentation: "translation-result",
  },
  "fix-spelling-and-grammar": {
    title: "Fix Spelling and Grammar",
    description: "Correct English spelling, grammar, and phrasing with minimal changes.",
    prompt: fixSpellingAndGrammar,
    presentation: "grammar-diff",
  },
  "improve-writing": {
    title: "Improve Writing",
    description: "Rewrite for clarity and concision while keeping meaning, tone, and language.",
    prompt: improveWriting,
    presentation: "plain",
  },
  "explain-this-in-simple-terms": {
    title: "Explain This in Simple Terms",
    description: "Explain the selection in simple terms.",
    prompt: explainThisInSimpleTerms,
    presentation: "plain",
  },
  "make-longer": {
    title: "Make Longer",
    description: "Expand the selection while keeping its tone, language, and facts.",
    prompt: makeLonger,
    presentation: "plain",
  },
  "make-shorter": {
    title: "Make Shorter",
    description: "Shorten the selection while keeping its tone, language, and core meaning.",
    prompt: makeShorter,
    presentation: "plain",
  },
  "change-tone-to-professional": {
    title: "Change Tone to Professional",
    description: "Rewrite in a professional, formal tone without changing meaning or length.",
    prompt: changeToneToProfessional,
    presentation: "plain",
  },
  "change-tone-to-friendly": {
    title: "Change Tone to Friendly",
    description: "Rewrite in a friendly, optimistic tone without changing meaning or length.",
    prompt: changeToneToFriendly,
    presentation: "plain",
  },
  "change-tone-to-confident": {
    title: "Change Tone to Confident",
    description: "Rewrite in a confident tone without hedging, keeping meaning and length.",
    prompt: changeToneToConfident,
    presentation: "plain",
  },
  "change-tone-to-casual": {
    title: "Change Tone to Casual",
    description: "Rewrite in a casual, friendly tone without changing meaning or length.",
    prompt: changeToneToCasual,
    presentation: "plain",
  },
} satisfies Record<string, CommandDefinition>;

export type CommandId = keyof typeof registry;

export function commandIds(): CommandId[] {
  return Object.keys(registry) as CommandId[];
}

function assertRegistryInvariants(): void {
  for (const id of commandIds()) {
    const command = registry[id];
    const tokens = command.prompt.match(/\{[^}]+\}/g) ?? [];
    if (tokens.length !== 1 || tokens[0] !== "{selection}") {
      throw new Error(`${id} prompt must contain exactly one {selection} and no other brace token`);
    }
    for (const match of command.prompt.matchAll(/\\\((\w+)\)/g)) {
      const name = match[1];
      if (!name || !Object.hasOwn(placeholders, name)) {
        throw new Error(`${id} prompt has unknown placeholder: ${name}`);
      }
    }
    if (
      command.presentation === "translation-result" &&
      (!command.prompt.includes("Translation Result") ||
        !command.prompt.includes("Back-Translation"))
    ) {
      throw new Error(`${id} prompt must contain Translation Result and Back-Translation`);
    }
  }
}

assertRegistryInvariants();

export const commands = Object.fromEntries(
  commandIds().map((id) => {
    const { title, description, prompt } = registry[id];
    return [id, { title, description, prompt }];
  }),
) as {
  [K in CommandId]: Pick<(typeof registry)[K], "title" | "description" | "prompt">;
};

export function inputError(text: string): string | undefined {
  if (!text.trim()) return "Select text in another app, then launch this command.";
  if (text.length > 30_000) return "Please use 30,000 characters or fewer.";
  return undefined;
}

export function resultText(command: CommandId, output: string): string {
  const text = output.trim();
  if (registry[command].presentation !== "translation-result") return text;
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

type RunStatus = "loading" | "no-input" | "streaming" | "done" | "stopped" | "error";

export function presentCommand(
  command: CommandId,
  args: {
    status: RunStatus;
    input: string;
    output: string;
    largeText: boolean;
    highlightChanges: (input: string, output: string, largeText: boolean) => string;
  },
): { shown: string; copied: string } {
  const shown =
    registry[command].presentation === "grammar-diff" && args.status === "done"
      ? args.highlightChanges(args.input, args.output, args.largeText)
      : args.output;
  return { shown, copied: resultText(command, args.output) };
}

export function directOpenGuidance(): string {
  const bullets = commandIds().map((id) => `- **${registry[id].title}**`);
  return `Select text in another app, then run a language command.\n\n${bullets.join("\n")}`;
}
