import { defineConfig } from "vitest/config";

export default defineConfig({
  // @dd/shared is consumed as the tsc-compiled `dist` (legacy-decorator output that
  // esbuild can't produce). The root `test` script builds it first; node resolution
  // finds it via the workspace symlink in node_modules.
  test: {
    include: ["tests/**/*.test.ts", "packages/**/src/**/*.test.ts"],
    environment: "node",
  },
});
