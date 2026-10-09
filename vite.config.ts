import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: { options: { typeAware: true, typeCheck: true } },
  fmt: { ignorePatterns: ["raycast-env.d.ts", "pnpm-lock.yaml", "pnpm-workspace.yaml"] },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
