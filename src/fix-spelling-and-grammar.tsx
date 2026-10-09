import { launchLanguageCommand } from "./lib/launch-language-command";

export default async function Command() {
  await launchLanguageCommand("fix-spelling-and-grammar");
}
