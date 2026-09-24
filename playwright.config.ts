import { defineConfig } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3100";

/** E2E do caminho principal contra o servidor em modo memória com dados isolados. */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: Number(process.env.E2E_TIMEOUT ?? 90_000),
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    // Chromium pré-instalado fora do padrão (ex.: sessão cloud): PW_CHROMIUM=/caminho/chrome
    launchOptions: process.env.PW_CHROMIUM
      ? { executablePath: process.env.PW_CHROMIUM }
      : {},
  },
  webServer: {
    command: `DATA_MODE=memory DATA_DIR=.data-e2e npx next dev -p ${port}`,
    url: `http://localhost:${port}/api/health`,
    // E2E_REUSE=1: usa um servidor já em execução (ex.: em modo Appwrite) em vez de subir o próprio.
    reuseExistingServer: !!process.env.E2E_REUSE,
    timeout: 120_000,
  },
});
