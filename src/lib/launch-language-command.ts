import { randomUUID } from "node:crypto";
import {
  type Application,
  getFrontmostApplication,
  launchCommand,
  LaunchType,
  showToast,
  Toast,
} from "@raycast/api";
import { inputError, type CommandId } from "./commands";
import { readSelection } from "./selection";

export type LanguageLaunchContext = {
  command: CommandId;
  input: string;
  requestId: string;
};

// A no-view entry point runs on every hotkey press, even when Raycast has retained
// the previous result view. Capture selection before opening that view again.
export async function launchLanguageCommand(command: CommandId) {
  const frontmost = await frontmostApp();
  let input = "";
  try {
    const selection = await readSelection(frontmost?.bundleId);
    if (selection.trim()) input = selection;
  } catch {
    // Send an empty snapshot so a missing selection cannot reuse the last input.
  }

  // Invalid input has nothing to show in a result view: report it as a toast.
  const validation = inputError(input);
  if (validation) {
    await showToast({
      style: Toast.Style.Failure,
      title: input ? "Text Too Long" : "No Text Selected",
      message: validation,
    });
    return;
  }

  const context: LanguageLaunchContext = { command, input, requestId: randomUUID() };
  await launchCommand({ name: "result", type: LaunchType.UserInitiated, context });
}

async function frontmostApp(): Promise<Application | undefined> {
  try {
    return await getFrontmostApplication();
  } catch {
    return undefined;
  }
}
