import { launchLanguageCommand } from "./lib/launch-language-command";

export default async function Command() {
  await launchLanguageCommand("make-shorter");
}
