import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Store isolado por arquivo de teste (modo memória em diretório temporário). */
export function withTempStore() {
  process.env.DATA_MODE = "memory";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "wellmix-test-"));
  (globalThis as { __wellmixStore?: unknown }).__wellmixStore = undefined;
}
