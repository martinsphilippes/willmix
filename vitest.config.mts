import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: { DATA_MODE: "memory", NODE_ENV: "test" },
    // Sem internet nos testes unitários (câmbio, IA e prévia de link falham na hora).
    setupFiles: ["tests/unit/no-network.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/unit/server-only-stub.ts", import.meta.url),
      ),
    },
  },
});
