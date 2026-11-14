import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: { DATA_MODE: "memory", NODE_ENV: "test" },
    // Sem internet nos testes unitários (câmbio, IA e prévia de link falham na hora).
    setupFiles: ["tests/unit/no-network.ts"],
    // Os cenários do pedido de compra percorrem o mapa inteiro em memória e
    // levam ~3 s aqui; no CI (mais lento) passavam dos 5 s padrão.
    testTimeout: 15_000,
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
