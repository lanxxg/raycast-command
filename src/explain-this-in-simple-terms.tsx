import { launchLanguageCommand } from "./lib/launch-language-command";

export default async function Command() {
  await launchLanguageCommand("explain-this-in-simple-terms");
}
