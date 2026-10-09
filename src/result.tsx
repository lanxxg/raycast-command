import { Detail, type LaunchProps } from "@raycast/api";
import { LanguageCommand } from "./components/language-command";
import { commands } from "./lib/commands";
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
    return (
      <Detail markdown="Select text in another app, then run **To Chinese**, **To English**, or **Fix Spelling and Grammar**." />
    );
  }

  // Remount for every invocation, including repeated selections. This clears old
  // output and aborts the previous stream even if Raycast reuses the result view.
  return (
    <LanguageCommand
      key={launchContext.requestId}
      command={launchContext.command}
      input={launchContext.input}
    />
  );
}
