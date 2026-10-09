# AGENTS.md

This file provides guidance to every AI assistant when working with code in this repository.

## Raycast Command

Raycast extension (macOS only) that provides a series of Raycast commands for daily use.

## Commands

```sh
pnpm dev                          # ray develop: build, import into Raycast, watch
pnpm build                        # ray build: Raycast production bundle
pnpm check                        # Vite+ (vp): Oxfmt + Oxlint (type-aware) + type check
pnpm format                       # Vite+ formatter
pnpm test                         # Vitest via Vite+ (tests/**/*.test.ts, node env)
```

Tests use a fake API key and mocked network responses, so they make no paid requests.

Vite+ is installed locally as `vite-plus` and configured in `vite.config.ts`. Raycast needs its own bundler and dev host, so `pnpm dev` and `pnpm build` run `ray develop` and `ray build`.

## Cursor Cloud specific instructions

Cloud Agents run on Linux. Verify changes with `pnpm test` and `pnpm check`. `pnpm dev` and `pnpm build` call the Raycast CLI (`ray`), which ships with the Raycast macOS app and is not installed here. The environment provides Node.js 22.22.2 because `@raycast/api` and `vite-plus` reject the default image's older Node. Tests use a fake API key and mocked responses, so they do not call DeepSeek.

## Adding a command

1. Write a prompt containing `{selection}` in `src/lib/prompts.ts`.
2. Add it to `CommandId` and `commands` in `src/lib/commands.ts`.
3. Add `src/<name>.tsx` calling `launchLanguageCommand("<name>")`.
4. Add a `no-view` entry to `commands` in `package.json`. A test asserts that every manifest command has a matching `src/<name>.tsx`.
