import {
  Action,
  ActionPanel,
  Color,
  Detail,
  environment,
  getPreferenceValues,
  Icon,
  Keyboard,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { commands, inputError, resultText, type CommandId } from "../lib/commands";
import { errorMessage, generate, type Settings } from "../lib/deepseek";
import { grammarDiffMarkdown } from "../lib/grammar-diff";

type Status = "loading" | "no-input" | "streaming" | "done" | "stopped" | "error";

export function LanguageCommand({ command, input }: { command: CommandId; input: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string>();
  const [showHighlights, setShowHighlights] = useState(true);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const definition = commands[command];
  const displayOutput = useMemo(
    () =>
      command === "fix-spelling-and-grammar" && status === "done"
        ? grammarDiffMarkdown(
            input,
            output,
            { added: Color.Green, unchanged: Color.PrimaryText },
            environment.textSize === "large",
          )
        : output,
    [command, status, input, output],
  );

  async function run(text: string) {
    active.current?.abort();
    setOutput("");
    setShowHighlights(true);
    setError(undefined);
    const validation = inputError(text);
    if (validation) {
      setStatus("no-input");
      void showToast({
        style: Toast.Style.Failure,
        title: text.trim() ? "Text Too Long" : "No Text Selected",
        message: validation,
      });
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    const timeout = AbortSignal.timeout(120_000);
    const signal = AbortSignal.any([controller.signal, timeout]);
    const settings = getPreferenceValues<Settings>();
    setStatus("streaming");
    const isCurrent = () =>
      mounted.current && active.current === controller && !controller.signal.aborted;
    try {
      await generate(command, text, settings, signal, (value) => {
        if (isCurrent()) setOutput(value);
      });
      if (!isCurrent()) return;
      setStatus("done");
    } catch (cause) {
      if (!isCurrent()) return;
      const reason = timeout.aborted ? timeout.reason : cause;
      // Request failures are reported in the result view rather than as a toast.
      setError(errorMessage(reason));
      setStatus("error");
    }
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.abort();
    };
  }, []);

  useEffect(() => {
    // The launcher already validated the selection; run() re-checks it for direct launches.
    void run(input);
    // The command is fixed for this Raycast invocation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const primary = resultText(command, output);
  const notice =
    status === "error" && error
      ? `> **Could not complete:** ${error}\n\n`
      : status === "stopped"
        ? "> **Stopped** — the result below may be incomplete.\n\n"
        : "";
  const body = showHighlights ? displayOutput : output;
  // Detail renders a blank page until the first tokens arrive. Say what is running
  // instead, so a slow first token is not mistaken for a stalled command.
  const placeholder =
    status === "loading" || status === "streaming" ? `_${definition.title}…_` : "";
  const finished = status === "done" || status === "stopped" || status === "error";
  return (
    <Detail
      navigationTitle={definition.title}
      isLoading={status === "loading" || status === "streaming"}
      markdown={notice + (body || placeholder)}
      actions={
        <ActionPanel>
          {status === "done" && primary && (
            <Action.CopyToClipboard title="Copy Result" content={primary} />
          )}
          {status === "done" && primary && (
            <Action.Paste
              title="Paste Result"
              content={primary}
              shortcut={{ modifiers: ["cmd"], key: "return" }}
            />
          )}
          {status === "done" && displayOutput !== output && (
            <Action
              title={showHighlights ? "Hide Highlights" : "Show Highlights"}
              icon={Icon.Eye}
              onAction={() => setShowHighlights((value) => !value)}
            />
          )}
          {status === "streaming" && (
            <Action
              title="Stop Generating"
              icon={Icon.Stop}
              onAction={() => {
                active.current?.abort();
                setStatus("stopped");
              }}
            />
          )}
          {finished && (
            <Action
              title="Retry"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={() => void run(input)}
            />
          )}
          {output && status !== "streaming" && (
            <Action.CopyToClipboard
              title={status === "done" ? "Copy Full Response" : "Copy Partial Response"}
              content={output}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
          )}
          <Action
            title="Open Extension Preferences"
            icon={Icon.Gear}
            onAction={openExtensionPreferences}
          />
        </ActionPanel>
      }
    />
  );
}
