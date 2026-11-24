/*
 * Versão em chinês da base de demonstração dos vídeos. O portal traduz os
 * rótulos pela escolha de idioma, mas o que está gravado na base (nome de
 * produto, observação digitada, texto de aviso, nome de empresa) fica no idioma
 * em que foi escrito. Para as telas do vídeo em mandarim saírem em chinês, este
 * script copia a base e troca esses textos gravados (tudo fictício: a base vem
 * do E2E, limpa por scrub.mjs).
 *   node data-zh.mjs [origem] [destino]     (padrão: .data-video → .data-video-zh;
 *                                            origem = destino troca no lugar)
 * Depois: DATA_MODE=memory DATA_DIR=.data-video-zh npx next start -p 3204
 *
 * O que fica como está: empresas e pessoas do lado do Brasil (são nomes
 * próprios: "Loja do João Ltda", "Diego Despachante"), códigos e números. O
 * lado da China vira chinês: fábricas, tradings e as pessoas delas.
 */
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const repo = join(ROOT, "../..");
const from = join(repo, process.argv[2] ?? ".data-video");
const to = join(repo, process.argv[3] ?? ".data-video-zh");
// Origem igual ao destino: só troca os textos, no lugar (as regras podem
// rodar de novo sem estragar o que já foi trocado).
if (from !== to) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

/* Do mais comprido para o mais curto (a ordem da lista é a de aplicação).
   Texto simples troca todas as ocorrências; expressão regular também. */
const RULES = [
  // Produtos (em português na base)
  ["Jogo de panelas antiaderentes 5 pçs", "不粘锅 5 件套"],
  ["Boneca articulada 30 cm", "关节娃娃 30 cm"],
  ["Boneca de pano 40 cm", "布娃娃 40 cm"],
  ["Garrafa de vidro com tampa", "带盖玻璃瓶"],
  ["Garrafa de vidro 500 ml", "玻璃瓶 500 ml"],
  ["Garrafa térmica 1 L", "保温瓶 1 L"],
  ["Garrafa squeeze 700 ml", "运动水壶 700 ml"],
  ["Jarra de vidro 1,5 L", "玻璃水壶 1.5 L"],
  ["Jarra medidora 1 L", "量杯 1 L"],
  ["Piscina inflável 2.000 L", "充气泳池 2000 L"],
  ["Copo long drink 300 ml", "高球杯 300 ml"],
  ["Copo de vidro 350 ml", "玻璃杯 350 ml"],
  ["Copo de vidro 300 ml", "玻璃杯 300 ml"],
  ["Copo de vidro", "玻璃杯"],
  ["Pote de vidro 800 ml", "玻璃罐 800 ml"],
  ["pote de vidro 800 ml", "玻璃罐 800 ml"],
  ["Pote hermético 1 L", "密封罐 1 L"],
  ["Pote hermético 2 L", "密封罐 2 L"],
  ["Vaso de cerâmica listrado", "条纹陶瓷花瓶"],
  ["Vaso de cerâmica", "陶瓷花瓶"],
  ["Jogo de facas inox 6 pçs", "不锈钢刀具 6 件套"],
  ["Tábua de bambu 35 cm", "竹砧板 35 cm"],
  ["Escorredor de louça inox", "不锈钢沥水架"],
  ["Porta-temperos giratório", "旋转调料架"],
  ["Lancheira térmica 2 andares", "双层保温饭盒"],
  ["Jogo de taças 6 pçs", "高脚杯 6 件套"],
  ["Açucareiro de vidro", "玻璃糖罐"],
  ["Forma de silicone 24 cm", "硅胶烤模 24 cm"],
  ["Kit de utensílios 5 pçs", "厨具 5 件套"],
  ["Saleiro de bambu", "竹制盐罐"],
  ["Organizador de geladeira", "冰箱收纳盒"],
  ["Petisqueira de vidro", "玻璃小食盘"],
  ["Espremedor de alho", "压蒜器"],
  ["Bowl de vidro 2 L", "玻璃碗 2 L"],
  // Itens de book e pedidos de fornecedor digitados pelo teste, em inglês
  ["Glass bottle with lid", "带盖玻璃瓶"],
  ["Glass bottle 500ml", "玻璃瓶 500 ml"],
  ["Glass cup with handle", "带把玻璃杯"],
  ["Glass cup 350ml", "玻璃杯 350 ml"],
  ["Glass cup 350 ml", "玻璃杯 350 ml"],
  ["Glass cup draft", "玻璃杯（草稿）"],
  ["Glass jar other", "玻璃罐（其他）"],
  ["Glass jar own", "玻璃罐（自有）"],
  ["Glass jar trade", "玻璃罐（贸易）"],
  ["Bamboo tray XL", "竹托盘 XL"],
  ["Glass bottle", "玻璃瓶"],
  ["Glass cup", "玻璃杯"],
  ["Glass jar", "玻璃罐"],
  ["Bamboo tray", "竹托盘"],
  ["Material: glass", "材质：玻璃"],
  [/(\d) pcs\b/g, "$1 件"],
  // Linhas de produto
  [" — Bonecas", " — 娃娃"],
  [" — Lazer", " — 休闲"],
  [" — Cozinha", " — 厨房"],
  // Textos digitados nos passos do pedido
  ["Amostra devolvida à trading", "样品已退回贸易商"],
  ["Carga completa", "货物齐全"],
  ["Em trânsito", "运输途中"],
  ["PVC atóxico", "无毒 PVC"],
  ["Certificado (Inmetro)", "证书（Inmetro）"],
  ["Faz inspeção em Yiwu.", "在义乌验货。"],
  ["10% no pedido; 90% no embarque", "下单付 10%；出运付 90%"],
  // Conversa de teste do E2E (a do vídeo é a de seed-chat.mjs)
  ["Bom dia! Sobre o ", "早上好！关于"],
  // Trilha de auditoria (frases gravadas)
  [
    "(cargo, chefe, divisão, funções e telas)",
    "（职位、上级、事业部、职能和页面）",
  ],
  ["Equipe: ", "团队："],
  ["Configurações atualizadas", "设置已更新"],
  ["Acesso excluído: ", "已删除账号："],
  ["INSPECTION concluída", "验货已完成"],
  ["INSPECTION iniciada", "验货已开始"],
  ["marco inspection", "里程碑：验货"],
  ["marco production", "里程碑：生产"],
  ["Bill of Lading (BL)", "提单（BL）"],
  // Nome de arquivo de exemplo do teste (só o nome mostrado; o arquivo não muda)
  ["foto.png", "IMG_3021.png"],
  [/^attachment: /, "附件："],
  [/^photo: /, "照片："],
  [/^other: /, "其他："],
  [/(@[\w.-]+) \(operator\)/g, "$1（操作员）"],
  [/(@[\w.-]+) \(supplier\)/g, "$1（供应商）"],
  // Empresas e pessoas do lado da China
  ["Ningbo Glass Factory usuário", "宁波玻璃厂用户"],
  ["Yiwu Trading usuário", "义乌贸易公司用户"],
  ["Foshan Ceramics Factory", "佛山陶瓷厂"],
  ["Ningbo Glass Factory", "宁波玻璃厂"],
  ["Shenzhen Supplier A", "深圳供应商 A"],
  ["Guangzhou Supplier B", "广州供应商 B"],
  ["Ningbo Supplier C", "宁波供应商 C"],
  ["Yiwu Photo Studio", "义乌摄影工作室"],
  ["Hangzhou Trading", "杭州贸易公司"],
  ["Yiwu Trading", "义乌贸易公司"],
  ["Mei Marketing", "梅琳"],
  ["Li Factory", "李强"],
  ["Wu Trading", "吴敏"],
  ["Wang Fang", "王芳"],
  ["Chen Yu", "陈宇"],
  ["Li Wei", "李伟"],
  // Pessoa criada pelo teste de cotação, sem nome de gente
  ["Planejamento cotação", "Pedro Planejamento"],
];

/* Passos do pedido que o E2E preencheu com "ok": valor de exemplo plausível. */
const STEP_VALUES = {
  material_found: "玻璃",
  color_found: "透明",
  vessel: "MSC Aurora / 245W",
  process_number: "IMP-2026-0142",
  plate: "RXK4D27",
  status_update: "已送达",
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
for (const o of db.order_summaries ?? [])
  for (const r of o.facts?.reqs ?? [])
    if (r.v === "ok" && STEP_VALUES[r.k]) {
      r.v = STEP_VALUES[r.k];
      steps++;
    }
for (const a of db.audit_log ?? [])
  if (a.action === "requirement.submit" && a.after?.value === "ok") {
    const v = STEP_VALUES[stepOf.get(a.entityId)];
    if (v) {
      a.after.value = v;
      steps++;
    }
  }

// (b) A base do E2E fica com a IA em "Mock", que grava em cada mensagem do chat
// uma tradução de exemplo. Em "Manual" cada lado lê o que o outro escreveu.
let ai = 0;
for (const s of db.settings ?? [])
  if (s.key === "aiMode" && s.value === "MOCK") {
    s.value = "MANUAL";
    ai++;
  }

// (c) Textos gravados.
const count = new Map();
const tr = (s) => {
  if (s === "glass") {
    count.set("glass", (count.get("glass") ?? 0) + 1);
    return "玻璃";
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
    if (key === "unit" && v === "pcs") {
      count.set("unit pcs", (count.get("unit pcs") ?? 0) + 1);
      return "件";
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
