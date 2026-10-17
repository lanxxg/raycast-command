# Raycast Command

Raycast extension (macOS only) that provides a series of Raycast commands for daily use.

| Command                      | Result                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------- |
| To Chinese                   | Translate into natural Chinese while preserving technical terms and code.    |
| To English                   | Translate into fluent English with a Chinese back-translation.               |
| Fix Spelling and Grammar     | Correct English spelling, grammar, and phrasing with minimal changes.        |
| Improve Writing              | Rewrite for clarity and concision while keeping meaning, tone, and language. |
| Explain This in Simple Terms | Explain the selection in simple terms.                                       |
| Make Longer                  | Expand the selection while keeping its tone, language, and facts.            |
| Make Shorter                 | Shorten the selection while keeping its tone, language, and core meaning.    |
| Change Tone to Professional  | Rewrite in a professional, formal tone without changing meaning or length.   |
| Change Tone to Friendly      | Rewrite in a friendly, optimistic tone without changing meaning or length.   |
| Change Tone to Confident     | Rewrite in a confident tone without hedging, keeping meaning and length.     |
| Change Tone to Casual        | Rewrite in a casual, friendly tone without changing meaning or length.       |

## Motivation

Raycast v2's AI Commands require a Raycast Pro subscription, even with BYOK (Bring Your Own Key). This extension calls the model provider directly with your own key, so no subscription is needed.

## Get started

Requirements: macOS, [Raycast](https://www.raycast.com), Node.js 22.22.2+ (Node 24 recommended), pnpm 12.10.1, and a [DeepSeek API key](https://platform.deepseek.com/api_keys).

```sh
pnpm install
pnpm dev
```

`pnpm dev` builds the extension, imports it into Raycast, and watches for changes. Launch any command and enter your DeepSeek API key when prompted. The model ID defaults to `deepseek-flash`; change it in Extension Preferences.

## Usage

Select text in another app, then launch a command. Assign hotkeys in Raycast Settings → Extensions for quick access. Commands only use the selected text; if nothing is selected, a toast tells you so. Grant Raycast Accessibility access in macOS System Settings if selection or paste doesn't work.

**Result** is the shared view. Every language command opens its output there. Keep Result enabled, and launch a language command instead of opening Result directly. Each hotkey press reads the current selection, even when a previous result is still open.

Results stream into a Markdown view. After a grammar fix finishes, added or changed words are highlighted in green. The highlights are drawn as images because Raycast's Detail view can't color inline text; **Hide Highlights** switches back to selectable text. Copy and paste always use the plain corrected text.

### Actions

- **Enter:** copy the result (without headings, outer code fences, or the back-translation).
- **⌘ Enter:** paste the result into the app you were using.
- **⌘ ⇧ C:** copy the full response, or the partial response if it didn't finish.
- **⌘ R:** retry.
- **Stop Generating:** cancel the current request.

### Limits

Input is limited to 30,000 characters. Requests time out after two minutes. Starting another command or closing the result view cancels the previous request. Incomplete results can only be copied with **⌘ ⇧ C**.

## Privacy

- **API key:** stored in Raycast's encrypted password preference.
- **Network:** selected text is sent only to `https://api.deepseek.com`. DeepSeek's data policies apply, and usage is billed to your DeepSeek account. The extension never calls Raycast AI.
- **Clipboard:** to keep formatting such as lists and links, the extension presses ⌘C in the frontmost app and reads the copied HTML or text. It then restores your previous clipboard contents, marked as transient so clipboard managers skip the restore. If that fails, it falls back to Raycast's plain-text selection API.
- **Storage and logs:** no history is stored. Source text and provider error bodies are never logged.

Translations and corrections come from a language model and aren't guaranteed to be accurate. Review the output, especially code, before pasting it.

## Credits

Some of the prompt templates are adapted from [raycast/ray-so](https://github.com/raycast/ray-so) (MIT).
