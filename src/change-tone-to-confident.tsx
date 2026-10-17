import { launchLanguageCommand } from "./lib/launch-language-command";

export default async function Command() {
  await launchLanguageCommand("change-tone-to-confident");
}
