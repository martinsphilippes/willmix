/*
 * Gera o roteiro da narração de um vídeo (português do Brasil ou mandarim) em um
 * formato para levar a um serviço de voz (ElevenLabs) e trazer o áudio de volta:
 *   node narration-export.mjs [vídeo]        (padrão: full_br; full_zh = mandarim)
 * Grava em docs/videos/institucional/narracao-ptbr/ (full_br) ou narracao-zh/
 * (full_zh):
 *   parte-1.txt, parte-2.txt, parte-3.txt  texto para colar, uma fala por parágrafo,
 *                                          já com as leituras de nomes e siglas
 *   roteiro-falas.csv                      as 72 falas: id, parte, cena, texto da
 *                                          voz, texto original e dica de leitura
 *                                          (em mandarim: a mesma fala em português)
 * e em out/<vídeo>.voice-parts.json o mapa parte → falas, que
 * tts/import_voice.py usa para cortar o áudio de volta em uma fala por arquivo.
 * As partes cortam nas cenas, com perto de 1.500 caracteres cada (o campo de
 * texto do ElevenLabs aceita 5.000; fica folga).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";
import { VIDEOS_BR } from "./script.br.mjs";
import { VIDEOS_ZH } from "./script.zh.mjs";

const video = process.argv[2] ?? "full_br";
const def = { ...VIDEOS_BR, ...VIDEOS_ZH }[video];
if (!def) throw new Error(`vídeo desconhecido: ${video}`);
/** Idioma da narração: a chave do texto de cada fala no roteiro. */
const VOICE = def.voice ?? "pt";
const PACK = { pt: "narracao-ptbr", zh: "narracao-zh" }[VOICE];
const OUT = join(ROOT, "../../docs/videos/institucional", PACK);
/** A mesma fala em português (para quem gera a voz saber o que o chinês diz). */
const TWIN = Object.fromEntries(
  VIDEOS_BR.full_br.scenes.flatMap((s) =>
    (s.say ?? []).map((c, i) => [`${s.id}.${i}`, c.pt]),
  ),
);
mkdirSync(OUT, { recursive: true });

const SCENE = {
  route: "O desafio",
  chaos: "Cada um no seu canal",
  hub: "Um portal, um fluxo",
  journey: "A jornada (seis blocos)",
  customer: "Cliente",
  supplier: "Fornecedor",
  agency: "Agência de arte",
  ocp: "Certificadora",
  inspect: "Inspeção pelo celular",
  marketing: "Agência de marketing",
  freight: "Agente de carga e companhia marítima",
  customs: "Comex e despachante",
  carrier: "Transportador",
  team1: "Dentro da Wellmix (1)",
  team2: "Dentro da Wellmix (2)",
  chat: "A conversa no lugar dos e-mails",
  comms: "Pendências e avisos",
  langs: "Três idiomas",
  access: "Acesso por papel",
  evidence: "Qualidade documentada",
  control: "Para a gestão",
  devices: "Qualquer tela",
  end: "Encerramento",
};
/** Dica de leitura, quando a fala tem nome ou sigla escrito de outro jeito. */
const HINTS = [
  [/Uélmiks/, "Uélmiks = Wellmix"],
  [/bê-éle/, "bê-éle = BL (documento de embarque)"],
  [/érre-pê/, "érre-pê = ERP"],
  [/ésse-éle-á/, "ésse-éle-á = SLA"],
  [/imeius?/, "imeiu = e-mail"],
  [/contêineres?/, "contêiner = container"],
  [/Pékin list/, "Pékin list = Packing list"],
  [/ínvóis/, "ínvóis = invoice"],
  [/Plânners?/, "Plânner = Planner"],
  [/cômex/, "cômex = comex"],
];

// Uma fala por linha, na ordem do vídeo (a mesma de out/<vídeo>.tts.json).
const lines = [];
for (const s of def.scenes)
  (s.say ?? []).forEach((c, i) =>
    lines.push({
      id: `${s.id}.${i}`,
      scene: s.id,
      original: c[VOICE],
      voice: c.say ?? def.speak(c[VOICE]),
    }),
  );

// Partes: corta nas cenas, o mais perto possível de total / 3.
const total = lines.reduce((n, l) => n + l.voice.length, 0);
const N = 3;
const bounds = [];
let acc = 0;
let part = 1;
for (let i = 0; i < lines.length; i++) {
  lines[i].part = part;
  acc += lines[i].voice.length;
  const next = lines[i + 1];
  if (
    part < N &&
    next &&
    next.scene !== lines[i].scene &&
    acc >= (total * part) / N
  ) {
    bounds.push(i + 1);
    part++;
  }
}

const parts = [];
for (let p = 1; p <= N; p++) {
  const mine = lines.filter((l) => l.part === p);
  const text = mine.map((l) => l.voice).join("\n\n") + "\n";
  writeFileSync(join(OUT, `parte-${p}.txt`), text);
  parts.push({
    part: p,
    file: `parte-${p}`,
    first: mine[0].id,
    last: mine.at(-1).id,
    chars: text.length,
    ids: mine.map((l) => l.id),
  });
}

const q = (v) => `"${String(v).replaceAll('"', '""')}"`;
const csv = [
  [
    "ordem",
    "id",
    "parte",
    "cena",
    "texto_para_a_voz",
    "texto_original",
    VOICE === "pt" ? "dica" : "em_portugues",
  ],
  ...lines.map((l, i) => [
    i + 1,
    l.id,
    l.part,
    SCENE[l.scene] ?? l.scene,
    l.voice,
    l.original,
    VOICE === "pt"
      ? HINTS.filter(([re]) => re.test(l.voice))
          .map(([, h]) => h)
          .join("; ")
      : (TWIN[l.id] ?? ""),
  ]),
]
  .map((r) => r.map(q).join(","))
  .join("\n");
writeFileSync(join(OUT, "roteiro-falas.csv"), `﻿${csv}\n`);

writeFileSync(
  join(ROOT, "out", `${video}.voice-parts.json`),
  JSON.stringify({ video, parts }, null, 1),
);
console.log(
  `${lines.length} falas em ${N} partes: ${parts.map((p) => `${p.file} (${p.ids.length} falas, ${p.chars} caracteres, ${p.first} → ${p.last})`).join("; ")}`,
);
