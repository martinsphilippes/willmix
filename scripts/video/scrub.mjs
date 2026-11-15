/*
 * Limpa a base de demonstração usada nas capturas dos vídeos. A base nasce do
 * E2E (que percorre o portal inteiro e deixa pedidos em várias etapas), e o
 * E2E batiza tudo com um sufixo de teste ("Garrafa PSMWI8LGSJ"). Este script
 * troca esses nomes por nomes de produto, pessoa e empresa apresentáveis, no
 * arquivo inteiro (nomes repetidos em avisos e resumos mudam juntos).
 *   node scrub.mjs <DATA_DIR>      (altera <DATA_DIR>/db.json no lugar)
 * São dados fictícios de demonstração: nada aqui vem da produção.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.argv[2] ?? ".data-video", "db.json");
let s = readFileSync(file, "utf8");

// Sufixo do E2E: Date.now() em base 36 (8 caracteres). Os dois primeiros
// mudam a cada 25 dias ("mw" só valeu de 03 a 28/11/2026), então saem da
// própria base (do produto "Copo de vidro E2E<sufixo>" do caminho principal).
const P =
  /E2E([A-Z0-9]{2})[A-Z0-9]{6}/.exec(s)?.[1] ??
  Date.now().toString(36).slice(0, 2).toUpperCase();
const U = `${P}[A-Z0-9]{6}`; // sufixo em maiúsculas
const L = `${P.toLowerCase()}[a-z0-9]{6}`;
const KITCHEN = [
  "Jogo de facas inox 6 pçs",
  "Tábua de bambu 35 cm",
  "Escorredor de louça inox",
  "Porta-temperos giratório",
  "Garrafa squeeze 700 ml",
  "Lancheira térmica 2 andares",
  "Jogo de taças 6 pçs",
  "Açucareiro de vidro",
  "Forma de silicone 24 cm",
  "Kit de utensílios 5 pçs",
  "Saleiro de bambu",
  "Organizador de geladeira",
  "Petisqueira de vidro",
  "Jarra medidora 1 L",
  "Espremedor de alho",
  "Bowl de vidro 2 L",
];
const rules = [
  [
    `Zqx widget PL${U} (\\d+)`,
    (_, n) => KITCHEN[(Number(n) - 1) % KITCHEN.length],
  ],
  [`Copo de vidro E2E${U}`, "Copo de vidro 350 ml"],
  [`Copo de vidro HP${U}`, "Copo long drink 300 ml"],
  [`Garrafa PS${U}`, "Garrafa de vidro 500 ml"],
  [`Garrafa SRC${U}`, "Garrafa térmica 1 L"],
  [`Pote ENC${U} V`, "Pote hermético 1 L"],
  [`Pote ENC${U} O`, "Pote hermético 2 L"],
  [`([Pp])ote de vidro CHAT${U}`, "$1ote de vidro 800 ml"],
  [`([Pp])ote CHAT${U}`, "$1ote de vidro 800 ml"],
  [`Boneca PRG${U}`, "Boneca de pano 40 cm"],
  [`Vaso COR${U}`, "Vaso de cerâmica"],
  [`Glass cup (?:E2E|HP|OFR|SEL)${U}`, "Glass cup"],
  [`Bottle PS${U}`, "Glass bottle"],
  [`Glass jar (?:ISO|TRD)${U}`, "Glass jar"],
  [`Bamboo tray INV${U}`, "Bamboo tray"],
  [`CTE2E${L}`, "MSKU4829137"],
  // Pessoas e empresas criadas pelos testes.
  [`Planejamento E2E${U}`, "Paulo Planejamento"],
  [`Cadastro SRC${U}`, "Camila Cadastro"],
  [`Alfa ${L}`, "Aline Souza"],
  [`Beta ${L}`, "Bruno Lima"],
  [`Provisória ${L}`, "Paula Ribeiro"],
  [`Desi ${L}`, "Daniela Designer"],
  [`Duo ${L}`, "Davi Duarte"],
  [`Cust ${L}`, "Clara Costa"],
  [`Gabi ${L}`, "Gabriela Nunes"],
  [`Transportes X ${L}`, "Transportes Litoral"],
  [`Transportes Y ${L}`, "Transportes Serra"],
  [`Trading Painel ${L}`, "Yiwu Trading"],
  [`Factory Painel ${L}`, "Ningbo Glass Factory"],
  [`Fábrica ${L}`, "Foshan Ceramics Factory"],
  [`Trading ${L}`, "Hangzhou Trading"],
  [`Inspecta ${L}`, "Inspecta Qualidade"],
  // Códigos de item que sobraram (SKU, nome de planilha).
  [`E2E${U}`, "GC350"],
  [`HP${U}`, "LD300"],
  [`PS${U}`, "GB500"],
  [`OFR${U}`, "GC351"],
  [`PRG${U}`, "DL040"],
  [`COR${U}`, "CV210"],
  [`INV${U}`, "BT100"],
  [`SEL${U}`, "GC352"],
  [`ISO${U}`, "GJ150"],
  [`TRD${U}`, "GJ151"],
  [`PL${U}`, "KW"],
  [`ENC${U}`, "PH100"],
  [`CHAT${U}`, "PV800"],
  [`SRC${U}`, "GT100"],
  // Números de documento que o E2E preenche.
  ["AWB-BR-E2E", "AWB 957-4412 0986"],
  ["SF-CN-E2E", "SF 1428 8077 65"],
  ["BL-E2E", "BL 2611-774512"],
  ["BK-E2E", "BK 2611-0458"],
  ["DI-E2E", "DI 26/1845237-0"],
  ["CE-E2E", "CE 1526 0512 3456"],
  ["NF-E2E", "NF 48.215"],
  ["INV-E2E", "INV-2026-0458"],
  ["SELO-E2E-1", "OCP 0045/2026"],
  [" Exemplo E2E", " Exemplo"],
  // Prefixo de teste novo, que as regras acima ainda não conhecem.
  [`([A-Z]{2,5})${U}`, "$1-100"],
  // Sufixo solto em minúsculas (e-mails, chaves, nomes de tipo).
  [`[ ._-]?(?:e2e|src)?${L}`, ""],
  // Tradução de exemplo do modo sem IA: tira o rótulo técnico.
  ["\\[(?:en|zh|pt) · exemplo mock\\] ", ""],
];
let total = 0;
for (const [pattern, to] of rules) {
  const re = new RegExp(pattern, "g");
  s = s.replace(re, (...m) => {
    total++;
    return typeof to === "function"
      ? to(...m)
      : to.replace(/\$(\d)/g, (_, i) => m[Number(i)]);
  });
}
JSON.parse(s); // continua um JSON válido
writeFileSync(file, s);
const left = s.match(new RegExp(`\\w*(?:${U}|${L})\\w*`, "g")) ?? [];
console.log(
  `${file}: ${total} trocas; sobraram ${left.length} sufixos`,
  [...new Set(left)].slice(0, 12),
);
