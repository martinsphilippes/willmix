#!/usr/bin/env node
/*
 * Gera docs/MAPA_PROCESSO.md a partir do data.json do repositório da
 * apresentação (attilasm/wellmix-presentation, aba Mapa). O arquivo gerado
 * não se edita à mão: muda o mapa lá, roda isto aqui.
 *
 *   node scripts/mapa-processo.mjs ../wellmix-presentation/data.json
 *   npx prettier --write docs/MAPA_PROCESSO.md
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2];
if (!src) {
  console.error("uso: node scripts/mapa-processo.mjs <caminho do data.json>");
  process.exit(1);
}
const data = JSON.parse(readFileSync(src, "utf8"));
const mapa = data.mapa ?? {};
const today = process.argv[3] ?? new Date().toISOString().slice(0, 10);

const cell = (s) =>
  String(s ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim();

const names = new Map();
for (const e of data.etapas) for (const p of e.passos) names.set(p.id, p.nome);
for (const x of mapa.extras ?? []) names.set(x.id, x.nome);

const raci = (r) =>
  Object.entries(r ?? {})
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
const decision = (d) =>
  d ? `${d.q} Sim: ${d.s}. Não: ${d.n}.`.replace(/\.\./g, ".") : "";

const out = [];
out.push(
  "# Mapa do processo (fonte: attilasm/wellmix-presentation, data.json)",
);
out.push("");
out.push(
  `Gerado em ${today} por \`scripts/mapa-processo.mjs\` a partir do data.json do repositório da apresentação (aba Mapa, layout ${mapa.layout ?? "?"}, revisão ${data._rev ?? "?"}). Não edite à mão: mude o mapa e gere de novo. RACI: R faz, A aprova, C é consultado, I é informado. "Situação no mapa" e "Nota" são da varredura do dono (done: atende; partial: parcial; todo: falta).`,
);
out.push("");
out.push("## Personas");
out.push("");
out.push("| Chave | Persona |");
out.push("| --- | --- |");
for (const p of data.personas) out.push(`| \`${p.key}\` | ${cell(p.nome)} |`);
out.push("");

for (const e of data.etapas) {
  out.push(`## ${e.nome}`);
  out.push("");
  if (e.objetivo) out.push(`**Objetivo:** ${cell(e.objetivo)}  `);
  if (e.criterio) out.push(`**Critério de saída:** ${cell(e.criterio)}`);
  out.push("");
  out.push(
    "| Passo | Nome | Quem (RACI) | Decisão | Saída | Situação no mapa | Nota |",
  );
  out.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const p of e.passos)
    out.push(
      `| ${cell(p.id)} | ${cell(p.nome)} | ${cell(raci(p.raci))} | ${cell(decision(p.decisao))} | ${cell(p.saida)} | ${cell(p.status)} | ${cell(p.nota)} |`,
    );
  out.push("");
  const desc = e.passos.filter((p) => p.desc);
  if (desc.length) {
    out.push("<details><summary>Descrição de cada passo</summary>");
    out.push("");
    for (const p of desc)
      out.push(`- **${cell(p.id)} ${cell(p.nome)}**: ${cell(p.desc)}`);
    out.push("");
    out.push("</details>");
    out.push("");
  }
}

out.push("## Inícios e fins");
out.push("");
for (const x of mapa.extras ?? [])
  out.push(
    `- ${x.id} (${x.tipo === "inicio" ? "início" : "fim"}): ${cell(x.nome)}`,
  );
out.push("");

out.push("## Ligações (de → para)");
out.push("");
for (const [from, to, branch, label] of mapa.arestas ?? []) {
  const tag = [branch, label].filter(Boolean).join(" ");
  out.push(
    `- ${from} ${names.get(from) ?? ""} → ${to} ${names.get(to) ?? ""}${tag ? ` (${tag})` : ""}`.replace(
      /\s+/g,
      " ",
    ),
  );
}
out.push("");

writeFileSync(
  new URL("../docs/MAPA_PROCESSO.md", import.meta.url),
  out.join("\n"),
);
console.log("docs/MAPA_PROCESSO.md gerado");
