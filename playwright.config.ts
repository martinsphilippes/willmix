import { defineConfig } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3100";

/*
 * Servidor do E2E: a versão compilada do portal (`next build` + `next
 * start`), em modo memória com dados isolados. Com o `next dev`, a suíte
 * inteira passava de 12 GB de memória (o compilador do modo de
 * desenvolvimento guarda cada tela compilada, fora do limite do JavaScript)
 * e a máquina derrubava o servidor no meio do caminho principal (medição de
 * 14/11/2026: os 5 primeiros testes com pico de 11 GB no `next dev` e de
 * 572 MB compilado, em menos da metade do tempo). Compilado, o teste também
 * roda o mesmo código que vai para a Vercel. E2E_DEV=1 volta ao `next dev`
 * (para depurar com recarga automática).
 */
const DATA = "DATA_MODE=memory DATA_DIR=.data-e2e";
const SERVER = process.env.E2E_DEV
  ? `${DATA} npx next dev -p ${port}`
  : `${DATA} npx next build && ${DATA} npx next start -p ${port}`;

/** E2E do caminho principal contra o servidor em modo memória com dados isolados. */
export default defineConfig({
  testDir: "tests/e2e",
  // O cenário principal (solicitação → entrega) levava ~2,5 min contra o
  // servidor de desenvolvimento, que compila cada tela na primeira visita:
  // 90 s estourava sem nenhuma conferência falhar. Compilado é mais rápido;
  // o limite ficou (vale também com E2E_DEV=1). E2E_TIMEOUT ainda vale.
  timeout: Number(process.env.E2E_TIMEOUT ?? 300_000),
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
    command: SERVER,
    url: `http://localhost:${port}/api/health`,
    // E2E_REUSE=1: usa um servidor já em execução (ex.: em modo Appwrite) em vez de subir o próprio.
    reuseExistingServer: !!process.env.E2E_REUSE,
    // A compilação (`next build`, ~1 min) vem antes do servidor subir.
    timeout: 300_000,
  },
});
