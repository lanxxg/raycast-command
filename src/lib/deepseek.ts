import { createDeepSeek } from "@ai-sdk/deepseek";
import { APICallError, streamText } from "ai";
import { buildPrompts, inputError, type CommandId } from "./commands";

export interface Settings {
  apiKey: string;
  model: string;
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
}

class LanguageError extends Error {}

export function errorMessage(error: unknown): string {
  if (error instanceof LanguageError) return error.message;
  if (APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 401:
      case 403:
        return "Check your DeepSeek API key in Extension Preferences.";
      case 402:
        return "Your DeepSeek balance is insufficient. Top up your DeepSeek account and retry.";
      case 429:
        return "DeepSeek is rate limiting requests. Wait a moment and retry.";
      case 400:
      case 404:
      case 422:
        return "DeepSeek rejected this request. Check the model ID in Extension Preferences or shorten your input.";
      default:
        return "DeepSeek is unavailable. Check your connection and try again.";
    }
  }
  if (error instanceof Error && error.name === "TimeoutError")
    return "The request timed out after two minutes. Try again or use shorter text.";
  // Do not expose provider response bodies, request text, or credentials in errors/logs.
  return "The request could not finish. Check your connection and DeepSeek settings, then retry.";
}

export async function generate(
  command: CommandId,
  text: string,
  settings: Settings,
  signal: AbortSignal,
  onText: (text: string) => void,
  fetchImplementation?: typeof fetch,
): Promise<Usage> {
  const validation = inputError(text);
  if (validation) throw new LanguageError(validation);
  if (!settings.apiKey.trim())
    throw new LanguageError("Enter your DeepSeek API key in Extension Preferences.");
  const provider = createDeepSeek({
    apiKey: settings.apiKey.trim(),
    ...(fetchImplementation ? { fetch: fetchImplementation } : {}),
  });
  const result = streamText({
    model: provider(settings.model.trim()),
    ...buildPrompts(command, text),
    providerOptions: { deepseek: { thinking: { type: "disabled" } } },
    abortSignal: signal,
    maxRetries: 1,
    // Handle errors below instead of the SDK default logger (which includes request data).
    onError: () => {},
  });
  let output = "";
  // fullStream exposes failures explicitly, including errors arriving after partial text.
  for await (const part of result.fullStream) {
    if (signal.aborted) throw signal.reason;
    if (part.type === "error") throw part.error;
    if (part.type === "text-delta") {
      output += part.text;
      onText(output);
    }
  }
  if (signal.aborted) throw signal.reason;
  const finishReason = await result.finishReason;
  if (finishReason === "length")
    throw new LanguageError("Output limit reached. Try again with shorter input.");
  if (finishReason !== "stop")
    throw new LanguageError(
      "DeepSeek did not complete the response. Try again or revise the input.",
    );
  if (!output.trim()) throw new LanguageError("Empty response from DeepSeek. Please retry.");
  const { inputTokens, outputTokens } = await result.usage;
  return { inputTokens, outputTokens };
}
