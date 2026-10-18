/// <reference types="vite-plus/client" />
import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  getFrontmostApplication,
  getSelectedText,
  launchCommand,
  LaunchType,
  showToast,
} from "@raycast/api";
import manifest from "../package.json";
import toChinese from "../src/to-chinese";
import toEnglish from "../src/to-english";
import fixGrammar from "../src/fix-spelling-and-grammar";
import Result from "../src/result";
import { commandIds, directOpenGuidance } from "../src/lib/commands";
import type { LanguageLaunchContext } from "../src/lib/launch-language-command";
import { readSelection } from "../src/lib/selection";

const launchers = import.meta.glob<() => Promise<void>>("../src/*.tsx", {
  eager: true,
  import: "default",
});

vi.mock("@raycast/api", () => ({
  getFrontmostApplication: vi.fn(),
  getSelectedText: vi.fn(),
  launchCommand: vi.fn(),
  LaunchType: { UserInitiated: "userInitiated" },
  showToast: vi.fn(),
  Toast: { Style: { Failure: "failure" } },
  Detail: vi.fn(),
}));

vi.mock("../src/lib/selection", () => ({ readSelection: vi.fn() }));

vi.mock("../src/components/language-command", () => ({ LanguageCommand: vi.fn() }));

function resultForLaunch(index: number) {
  const launchContext = vi.mocked(launchCommand).mock.calls[index][0]
    .context as LanguageLaunchContext;
  return Result({ launchType: LaunchType.UserInitiated, arguments: undefined, launchContext });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(launchCommand).mockResolvedValue(undefined);
  vi.mocked(readSelection).mockImplementation(() => getSelectedText());
});

describe("selection on command hotkey launches", () => {
  it.each(commandIds())("captures fresh text on successive %s invocations", async (command) => {
    const run = launchers[`../src/${command}.tsx`];
    if (!run) throw new Error(`missing launcher for ${command}`);
    vi.mocked(getSelectedText)
      .mockResolvedValueOnce("Previous selection")
      .mockResolvedValueOnce("  新的 selection\n```ts\nconst x = 1;\n```\n");

    await run();
    const first = resultForLaunch(0);
    await run();
    const second = resultForLaunch(1);

    expect(getSelectedText).toHaveBeenCalledTimes(2);
    expect(first.props).toMatchObject({ command, input: "Previous selection" });
    expect(second.props).toMatchObject({
      command,
      input: "  新的 selection\n```ts\nconst x = 1;\n```\n",
    });
    expect(second.key).toBeTruthy();
    expect(second.key).not.toBe(first.key);
    expect(launchCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "result", type: LaunchType.UserInitiated }),
    );
  });

  it("starts a new result even when the selected text has not changed", async () => {
    vi.mocked(getSelectedText).mockResolvedValue("Same selection");
    await toChinese();
    await toChinese();
    const second = resultForLaunch(1);
    const secondAgain = resultForLaunch(1);
    expect(second.props).toEqual(resultForLaunch(0).props);
    expect(second.key).not.toBe(resultForLaunch(0).key);
    expect(secondAgain.key).toBe(second.key);
  });

  it.each(["empty", "unavailable"])(
    "shows a toast instead of opening the result view when selection is %s",
    async (kind) => {
      vi.mocked(getSelectedText).mockResolvedValueOnce("Old input");
      await toEnglish();
      if (kind === "empty") vi.mocked(getSelectedText).mockResolvedValueOnce(" \n\t");
      else vi.mocked(getSelectedText).mockRejectedValueOnce(new Error("Selection unavailable"));
      await toEnglish();
      expect(launchCommand).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ style: "failure", title: "No Text Selected" }),
      );
    },
  );

  it("shows a toast instead of opening the result view when selection is too long", async () => {
    vi.mocked(getSelectedText).mockResolvedValueOnce("a".repeat(30_001));
    await fixGrammar();
    expect(launchCommand).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ style: "failure", title: "Text Too Long" }),
    );
  });

  it("reads the selection for the app that was frontmost at launch", async () => {
    vi.mocked(getFrontmostApplication).mockResolvedValue({
      name: "Chrome",
      path: "/Chrome.app",
      bundleId: "com.google.Chrome",
    });
    vi.mocked(getSelectedText).mockResolvedValueOnce("Hello");
    await toChinese();
    expect(readSelection).toHaveBeenCalledWith("com.google.Chrome");
    expect(resultForLaunch(0).props.input).toBe("Hello");
  });

  it("waits for selection before opening the result view", async () => {
    let select!: (text: string) => void;
    vi.mocked(getSelectedText).mockReturnValue(
      new Promise<string>((resolve) => {
        select = resolve;
      }),
    );
    const pending = toChinese();
    expect(launchCommand).not.toHaveBeenCalled();
    select("Fresh input");
    await pending;
    expect(resultForLaunch(0).props.input).toBe("Fresh input");
  });

  it("shows guidance when the result command is opened directly", () => {
    const result = Result({ launchType: LaunchType.UserInitiated, arguments: undefined });
    expect(result.props.markdown).toContain("Select text in another app");
    expect(result.props.markdown).toBe(directOpenGuidance());
    expect(getSelectedText).not.toHaveBeenCalled();
    expect(launchCommand).not.toHaveBeenCalled();
  });

  it("registers hotkeys as no-view launchers with matching entry points", () => {
    for (const command of manifest.commands) {
      expect(command.mode).toBe(command.name === "result" ? "view" : "no-view");
      expect(existsSync(new URL(`../src/${command.name}.tsx`, import.meta.url))).toBe(true);
    }
  });
});
