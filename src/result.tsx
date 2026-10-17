import { Detail, type LaunchProps } from "@raycast/api";
import { LanguageCommand } from "./components/language-command";
import { commands, directOpenGuidance } from "./lib/commands";
import type { LanguageLaunchContext } from "./lib/launch-language-command";

export default function Command({
  launchContext,
}: LaunchProps<{ launchContext: LanguageLaunchContext }>) {
  if (
    !launchContext ||
    !Object.hasOwn(commands, launchContext.command) ||
    typeof launchContext.input !== "string" ||
    typeof launchContext.requestId !== "string"
  ) {
    return <Detail markdown={directOpenGuidance()} />;
  }

  return (
    <LanguageCommand
      key={launchContext.requestId}
      command={launchContext.command}
      input={launchContext.input}
    />
  );
}
