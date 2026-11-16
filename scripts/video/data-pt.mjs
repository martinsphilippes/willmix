/*
 * Versão "limpa em português" da base de demonstração dos vídeos. A base do
 * E2E (limpa por scrub.mjs) ainda traz alguns textos em inglês, digitados pelo
 * teste ("Glass cup 350ml", "Bamboo tray", o material "glass") e o valor "ok"
 * nos passos que o teste só confirmou. Para as telas do vídeo em português
 * saírem inteiras em português, este script copia a base e troca esses textos
 * (tudo fictício: nada aqui vem da produção).
 *   node data-pt.mjs [origem] [destino]     (padrão: .data-video → .data-video-br;
 *                                            origem = destino troca no lugar)
 * Depois: DATA_MODE=memory DATA_DIR=.data-video-br npx next start -p 3203
 */
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const repo = join(ROOT, "../..");
const from = join(repo, process.argv[2] ?? ".data-video");
const to = join(repo, process.argv[3] ?? ".data-video-br");
// Origem igual ao destino: só troca os textos, no lugar (as regras podem
// rodar de novo sem estragar o que já foi trocado).
if (from !== to) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

/* Do mais comprido para o mais curto (a ordem da lista é a de aplicação).
   Texto simples troca todas as ocorrências; expressão regular também. */
const RULES = [
  // Itens de book e pedidos de fornecedor digitados pelo teste, em inglês
  ["Glass bottle with lid", "Garrafa de vidro com tampa"],
  ["Glass bottle 500ml", "Garrafa de vidro 500 ml"],
  ["Glass cup with handle", "Copo de vidro com alça"],
  ["Glass cup 350ml", "Copo de vidro 350 ml"],
  ["Glass cup draft", "Copo de vidro (rascunho)"],
  ["Glass jar other", "Pote de vidro (outro)"],
  ["Glass jar own", "Pote de vidro (próprio)"],
  ["Glass jar trade", "Pote de vidro (trading)"],
  ["Bamboo tray XL", "Bandeja de bambu GG"],
  ["Glass bottle", "Garrafa de vidro"],
  ["Glass cup", "Copo de vidro"],
  ["Glass jar", "Pote de vidro"],
  ["Bamboo tray", "Bandeja de bambu"],
  // Material digitado em inglês, dentro das fichas ("Material: glass")
  ["Material: glass", "Material: Vidro"],
  // Unidade em inglês nos textos gravados ("3000 pcs" → "3000 pç")
  [/(\d) pcs\b/g, "$1 pç"],
  // Marcos e etapas gravados com o nome interno nos textos da trilha
  ["INSPECTION concluída", "Inspeção concluída"],
  ["INSPECTION iniciada", "Inspeção iniciada"],
  ["marco inspection", "marco Inspeção"],
  ["marco production", "marco Produção"],
  ["Bill of Lading (BL)", "Conhecimento de embarque (BL)"],
  // Tipo do arquivo no começo do texto da trilha ("attachment: foto.jpg v1")
  [/^attachment: /, "anexo: "],
  [/^photo: /, "foto: "],
  [/^other: /, "outro: "],
  // Função da pessoa criada, gravada com o nome interno ("gabi@wellmix.com (operator)")
  [/(@[\w.-]+) \(operator\)/g, "$1 (operador)"],
  [/(@[\w.-]+) \(supplier\)/g, "$1 (fornecedor)"],
  // Pessoa criada pelo teste de cotação, sem nome de gente
  ["Planejamento cotação", "Pedro Planejamento"],
];

/* Passos do pedido que o E2E preencheu com "ok": valor de exemplo plausível. */
const STEP_VALUES = {
  material_found: "Vidro",
  color_found: "Transparente",
  vessel: "MSC Aurora / 245W",
  process_number: "IMP-2026-0142",
  plate: "RXK4D27",
  status_update: "Entregue",
};

const file = join(to, "db.json");
const db = JSON.parse(readFileSync(file, "utf8"));

// (a) Passos "ok" → valor de exemplo (a chave do passo está em code ou key).
const stepOf = new Map();
let steps = 0;
for (const r of db.requirements ?? []) {
  const step = r.code ?? r.key;
  stepOf.set(r.id, step);
  if (r.value === "ok" && STEP_VALUES[step]) {
    r.value = STEP_VALUES[step];
    steps++;
  }
}
// O mesmo fato no resumo do pedido (k = chave do passo, v = valor).
for (const o of db.order_summaries ?? [])
  for (const r of o.facts?.reqs ?? [])
    if (r.v === "ok" && STEP_VALUES[r.k]) {
      r.v = STEP_VALUES[r.k];
      steps++;
    }
// E na trilha de auditoria (depois do envio do passo).
for (const a of db.audit_log ?? [])
  if (a.action === "requirement.submit" && a.after?.value === "ok") {
    const v = STEP_VALUES[stepOf.get(a.entityId)];
    if (v) {
      a.after.value = v;
      steps++;
    }
  }

// (c) A base do E2E fica com a IA em "Mock", que grava em cada mensagem do chat
// uma tradução de exemplo ("[en · exemplo mock] …"). Em "Manual" cada lado lê
// o que o outro escreveu (o vídeo não fala de tradução automática).
let ai = 0;
for (const s of db.settings ?? [])
  if (s.key === "aiMode" && s.value === "MOCK") {
    s.value = "MANUAL";
    ai++;
  }

// (b) Textos em inglês que as regras do scrub deixaram na base.
const count = new Map();
const tr = (s) => {
  // O material digitado como "glass" (campo inteiro) vira "Vidro".
  if (s === "glass") {
    count.set("glass", (count.get("glass") ?? 0) + 1);
    return "Vidro";
  }
  for (const [a, b] of RULES) {
    const key = String(a);
    if (
      typeof a === "string" ? s.includes(a) : a.test(((a.lastIndex = 0), s))
    ) {
      count.set(key, (count.get(key) ?? 0) + 1);
      s = typeof a === "string" ? s.split(a).join(b) : s.replace(a, b);
    }
  }
  return s;
};
// Só valores (as chaves do JSON são nomes de campo e ficam como estão).
const walk = (v, key = "") => {
  if (typeof v === "string") {
    // Unidade em inglês ("pcs") nos pedidos: o resto da base usa "un".
    if (key === "unit" && v === "pcs") {
      count.set("unit pcs", (count.get("unit pcs") ?? 0) + 1);
      return "un";
    }
    return tr(v);
  }
  if (Array.isArray(v)) return v.map((x) => walk(x, key));
  if (v && typeof v === "object") {
    for (const k of Object.keys(v))
      // E-mail é login: fica como está.
      if (!/email/i.test(k)) v[k] = walk(v[k], k);
    return v;
  }
  return v;
};
walk(db);
writeFileSync(file, JSON.stringify(db));
console.log(
  `${to}: ${steps} passos "ok" com valor de exemplo; IA em Manual: ${ai}; ` +
    `${[...count.values()].reduce((a, b) => a + b, 0)} trocas em ${count.size} textos`,
);
const unused = RULES.filter(([a]) => !count.has(String(a))).map(([a]) =>
  String(a),
);
if (unused.length) console.log(`  sem ocorrência: ${unused.join("; ")}`);
