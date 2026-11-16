/*
 * Versão em inglês da base de demonstração dos vídeos. O portal traduz os
 * rótulos pela escolha de idioma, mas o que está gravado na base (nome de
 * produto, observação digitada, texto de aviso) fica no idioma em que foi
 * escrito. Para as telas do vídeo completo saírem inteiras em inglês, este
 * script copia a base e troca esses textos gravados pelos equivalentes em
 * inglês (tudo fictício: a base vem do E2E, limpa por scrub.mjs).
 *   node data-en.mjs [origem] [destino]     (padrão: .data-video → .data-video-en;
 *                                            origem = destino troca no lugar)
 * Depois: DATA_MODE=memory DATA_DIR=.data-video-en npx next start -p 3201
 */
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const repo = join(ROOT, "../..");
const from = join(repo, process.argv[2] ?? ".data-video");
const to = join(repo, process.argv[3] ?? ".data-video-en");
// Origem igual ao destino: só troca os textos, no lugar (as regras podem
// rodar de novo sem estragar o que já foi trocado).
if (from !== to) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

/* Do mais comprido para o mais curto (a ordem da lista é a de aplicação). */
const RULES = [
  // Produtos
  ["Jogo de panelas antiaderentes 5 pçs", "Non-stick cookware set, 5 pcs"],
  ["Boneca articulada 30 cm", "Articulated doll 30 cm"],
  ["Boneca de pano 40 cm", "Rag doll 40 cm"],
  ["Garrafa de vidro 500 ml", "Glass bottle 500 ml"],
  ["Garrafa térmica 1 L", "Thermal bottle 1 L"],
  ["Garrafa squeeze 700 ml", "Squeeze bottle 700 ml"],
  ["Jarra de vidro 1,5 L", "Glass pitcher 1.5 L"],
  ["Jarra medidora 1 L", "Measuring jug 1 L"],
  ["Piscina inflável 2.000 L", "Inflatable pool 2,000 L"],
  ["Copo long drink 300 ml", "Long drink glass 300 ml"],
  ["Copo de vidro 350 ml", "Glass cup 350 ml"],
  ["Copo de vidro 300 ml", "Glass cup 300 ml"],
  ["Copo de vidro", "Glass cup"],
  ["Pote de vidro 800 ml", "Glass jar 800 ml"],
  ["pote de vidro 800 ml", "glass jar 800 ml"],
  ["Pote hermético 1 L", "Airtight jar 1 L"],
  ["Pote hermético 2 L", "Airtight jar 2 L"],
  ["Vaso de cerâmica listrado", "Striped ceramic vase"],
  ["Vaso de cerâmica", "Ceramic vase"],
  ["Jogo de facas inox 6 pçs", "Stainless knife set, 6 pcs"],
  ["Tábua de bambu 35 cm", "Bamboo board 35 cm"],
  ["Escorredor de louça inox", "Stainless dish rack"],
  ["Porta-temperos giratório", "Rotating spice rack"],
  ["Lancheira térmica 2 andares", "Thermal lunch box, 2 tiers"],
  ["Jogo de taças 6 pçs", "Wine glass set, 6 pcs"],
  ["Açucareiro de vidro", "Glass sugar bowl"],
  ["Forma de silicone 24 cm", "Silicone mould 24 cm"],
  ["Kit de utensílios 5 pçs", "Utensil kit, 5 pcs"],
  ["Saleiro de bambu", "Bamboo salt cellar"],
  ["Organizador de geladeira", "Fridge organizer"],
  ["Petisqueira de vidro", "Glass snack tray"],
  ["Espremedor de alho", "Garlic press"],
  ["Bowl de vidro 2 L", "Glass bowl 2 L"],
  // Linhas de produto
  [" — Bonecas", " — Dolls"],
  [" — Lazer", " — Leisure"],
  [" — Cozinha", " — Kitchen"],
  // Textos digitados nos passos do pedido
  ["Amostra devolvida à trading", "Sample returned to the trading company"],
  ["Carga completa", "Full load"],
  ["Em trânsito", "In transit"],
  ["PVC atóxico", "Non-toxic PVC"],
  ["Certificado (Inmetro)", "Certificate (Inmetro)"],
  ["Faz inspeção em Yiwu.", "Inspects in Yiwu."],
  ["10% no pedido; 90% no embarque", "10% on order; 90% on shipment"],
  // Conversa de teste do E2E (a do vídeo é a de seed-chat.mjs)
  ["Bom dia! Sobre o ", "Hello! About the "],
  // Trilha de auditoria (frases gravadas)
  [
    "(cargo, chefe, divisão, funções e telas)",
    "(position, manager, division, functions and screens)",
  ],
  ["Equipe: ", "Team: "],
  ["Configurações atualizadas", "Settings updated"],
  ["Acesso excluído: ", "Access removed: "],
  // Empresas e pessoas com nome de função em português
  ["Agência Criativa", "Creative Agency"],
  ["Loja do João Ltda", "João's Store Ltd"],
  ["Cargo Agentes de Carga", "Cargo Freight Agents"],
  ["Inspecta Qualidade", "Inspecta Quality"],
  ["Transportes Litoral", "Litoral Transport"],
  ["Transportes Serra", "Serra Transport"],
  ["Marítima SA", "Maritima Lines"],
  ["Planejamento cotação", "Pedro Planner"],
  ["Paulo Planejamento", "Paulo Planner"],
  ["Camila Cadastro", "Camila Registration"],
  ["Daniela Designer", "Daniela Designer"],
  ["Otávio Operador", "Otávio Operator"],
  ["Diana Diretoria", "Diana Director"],
  ["Vera Vendas", "Vera Sales"],
  ["Diego Despachante", "Diego Broker"],
  ["Lucas Logística", "Lucas Logistics"],
  ["Júlia Jurídico", "Júlia Legal"],
  ["João Cliente", "João Customer"],
];

/* Passos do pedido que o E2E preencheu com "ok": valor de exemplo plausível. */
const STEP_VALUES = {
  material_found: "Glass",
  color_found: "Clear",
  vessel: "MSC Aurora / 245W",
  process_number: "IMP-2026-0142",
  plate: "RXK4D27",
  status_update: "Delivered",
};

const file = join(to, "db.json");
const db = JSON.parse(readFileSync(file, "utf8"));
for (const r of db.requirements ?? []) {
  const step = r.code ?? r.key;
  if (r.value === "ok" && STEP_VALUES[step]) r.value = STEP_VALUES[step];
}
for (const o of db.order_summaries ?? [])
  for (const r of o.facts?.reqs ?? [])
    if (r.v === "ok" && STEP_VALUES[r.k]) r.v = STEP_VALUES[r.k];
// A base do E2E fica com a IA em "Mock", que grava em cada mensagem do chat
// uma tradução de exemplo ("[en · exemplo mock] …"). Em "Manual" cada lado lê
// o que o outro escreveu (o vídeo não fala de tradução automática).
for (const s of db.settings ?? [])
  if (s.key === "aiMode" && s.value === "MOCK") s.value = "MANUAL";
const count = new Map();
const tr = (s) => {
  for (const [a, b] of RULES)
    if (s.includes(a)) {
      count.set(a, (count.get(a) ?? 0) + 1);
      s = s.split(a).join(b);
    }
  return s;
};
// Só valores (as chaves do JSON são nomes de campo e ficam como estão).
const walk = (v) => {
  if (typeof v === "string") return tr(v);
  if (Array.isArray(v)) return v.map(walk);
  if (v && typeof v === "object") {
    for (const k of Object.keys(v))
      // E-mail é login: fica como está.
      if (!/email/i.test(k)) v[k] = walk(v[k]);
    return v;
  }
  return v;
};
walk(db);
writeFileSync(file, JSON.stringify(db));
console.log(
  `${to}: ${[...count.values()].reduce((a, b) => a + b, 0)} trocas em ${count.size} textos`,
);
const unused = RULES.filter(([a]) => !count.has(a)).map(([a]) => a);
if (unused.length) console.log(`  sem ocorrência: ${unused.join("; ")}`);
