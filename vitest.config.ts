import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      // "server-only" guards Next.js server code; it's fine to import in tests.
      "server-only": resolve(__dirname, "tests/server-only-stub.ts"),
    },
  },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node", fileParallelism: false },
});
