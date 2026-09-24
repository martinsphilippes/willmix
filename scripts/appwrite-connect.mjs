#!/usr/bin/env node
/**
 * Conecta o Appwrite CLI ao projeto usando as variáveis de ambiente da
 * aplicação e sincroniza projectId/endpoint em appwrite.config.json.
 *
 * Uso: npm run appwrite:connect
 *
 * Lê NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID e
 * APPWRITE_API_KEY (mesmas chaves de .env.example). Recusa valores vazios ou
 * de exemplo para evitar um push contra um projeto inexistente.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(root, "appwrite.config.json");

const endpoint = read("NEXT_PUBLIC_APPWRITE_ENDPOINT");
const projectId = read("NEXT_PUBLIC_APPWRITE_PROJECT_ID");
const apiKey = read("APPWRITE_API_KEY");

if (!/^https:\/\/[a-z0-9.-]+\/v1$/.test(endpoint)) {
  fail(
    `NEXT_PUBLIC_APPWRITE_ENDPOINT inválido: "${endpoint}". Esperado https://<regiao>.cloud.appwrite.io/v1`,
  );
}

const cli = spawnSync(
  "npx",
  [
    "appwrite",
    "client",
    "--endpoint",
    endpoint,
    "--project-id",
    projectId,
    "--key",
    apiKey,
  ],
  { cwd: root, stdio: "inherit" },
);
if (cli.status !== 0) fail("appwrite client falhou.");

const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.projectId !== projectId || config.endpoint !== endpoint) {
  config.projectId = projectId;
  config.endpoint = endpoint;
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(
    `appwrite.config.json atualizado: projectId=${projectId}, endpoint=${endpoint}`,
  );
}

const check = spawnSync("npx", ["appwrite", "teams", "list", "--json"], {
  cwd: root,
  encoding: "utf8",
});
if (check.status !== 0) {
  fail(
    `Conectou, mas a chave não consegue ler teams. Confira escopos e projeto.\n${check.stderr ?? ""}`,
  );
}
console.log("Appwrite conectado. Próximo passo: npm run appwrite:push");

function read(name) {
  const value = (process.env[name] ?? "").trim();
  if (!value || /^cole /i.test(value) || /^<.*>$/.test(value)) {
    fail(
      `${name} não definida (valor atual: "${value || "vazio"}"). Veja docs/AMBIENTE.md.`,
    );
  }
  return value;
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
