import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // server-only throws outside the Next.js server; tests run server code directly
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  // Unit tests never touch the dev server's local database folder.
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node", env: { PGLITE_DIR: "memory://", SEED_DEMO: "0" } },
});
