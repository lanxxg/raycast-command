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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  commands,
  inputError,
  presentCommand,
  type CommandId,
  type RunStatus,
} from "../lib/commands";
import { errorMessage, generate, type Settings } from "../lib/deepseek";
import { grammarDiffMarkdown } from "../lib/grammar-diff";

export function LanguageCommand({ command, input }: { command: CommandId; input: string }) {
  const [status, setStatus] = useState<RunStatus>("loading");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string>();
  const [showHighlights, setShowHighlights] = useState(true);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const definition = commands[command];
  const { shown, copied } = useMemo(
    () =>
      presentCommand(command, {
        status,
        output,
        highlightChanges: () =>
          grammarDiffMarkdown(
            input,
            output,
            { added: Color.Green, unchanged: Color.PrimaryText },
            environment.textSize === "large",
          ),
      }),
    [command, status, input, output],
  );

  const run = useCallback(
    async (text: string) => {
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
        setError(errorMessage(reason));
        setStatus("error");
      }
    },
    [command],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.abort();
    };
  }, []);

  useEffect(() => {
    void run(input);
  }, [input, run]);

  const notice =
    status === "error" && error
      ? `> **Could not complete:** ${error}\n\n`
      : status === "stopped"
        ? "> **Stopped** — the result below may be incomplete.\n\n"
        : "";
  const body = showHighlights ? shown : output;
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
          {status === "done" && copied && (
            <Action.CopyToClipboard title="Copy Result" content={copied} />
          )}
          {status === "done" && copied && (
            <Action.Paste
              title="Paste Result"
              content={copied}
              shortcut={{ modifiers: ["cmd"], key: "return" }}
            />
          )}
          {shown !== output && (
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
