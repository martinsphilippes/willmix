/*
 * Mostra em que ponto da narração cada elemento com tempo marcado entra na
 * cena, para acertar os atrasos (`d`) quando a narração muda de idioma ou de
 * voz: a entrada de um item é a fala `c` mais `d` segundos, e o que a voz diz
 * nesse instante depende da duração real de cada fala.
 *   node cues.mjs <vídeo> [idioma] [cena]     (depois de node build.mjs <vídeo>)
 * Para cada item: a cena, o texto do item, a fala e o atraso, e o texto da fala
 * com a marca ▲ no ponto (aproximado: tempo proporcional ao texto) em que ele
 * aparece. "antes" = entra antes de a fala começar; "depois" = depois de ela
 * terminar (dentro da pausa ou da fala seguinte).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";
import { VIDEOS } from "./script.mjs";
import { VIDEOS_BR } from "./script.br.mjs";
import { VIDEOS_ZH } from "./script.zh.mjs";

const [video = "full_zh", langArg, only] = process.argv.slice(2);
const def = { ...VIDEOS, ...VIDEOS_BR, ...VIDEOS_ZH }[video];
if (!def) throw new Error(`vídeo desconhecido: ${video}`);
const VOICE = def.voice ?? "en";
const lang = langArg ?? def.lang ?? "pt";
const tl = JSON.parse(
  readFileSync(join(ROOT, "film/build", `${video}.${lang}.json`), "utf8"),
);

const plain = (v) =>
  Array.isArray(v)
    ? `(${v.length} itens)`
    : String(v ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 28);
/** Itens com `c` ou `d` dentro de props, com o caminho até eles. */
function timed(node, path = "", out = []) {
  if (Array.isArray(node))
    node.forEach((v, i) => timed(v, `${path}[${i}]`, out));
  else if (node && typeof node === "object") {
    if ("c" in node || "d" in node)
      out.push({
        path,
        c: node.c,
        d: node.d ?? 0,
        text: plain(
          node.t ?? node.label ?? node.name ?? node.role ?? node.shot ?? "",
        ),
      });
    for (const [k, v] of Object.entries(node))
      if (v && typeof v === "object") timed(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

for (const s of tl.scenes) {
  if (only && s.id !== only) continue;
  const says = def.scenes.find((x) => x.id === s.id)?.say ?? [];
  const items = timed(s.props);
  // Campos soltos do tipo "noteC" / "footerC" / "handoffsC": fala em que o bloco entra.
  for (const [k, v] of Object.entries(s.props ?? {}))
    if (/C$/.test(k) && typeof v === "number")
      items.push({
        path: k.slice(0, -1),
        c: v,
        d: 0,
        text: plain(s.props[k.slice(0, -1)]),
      });
  if (!items.length) continue;
  console.log(
    `\n${s.id}  (${s.dur.toFixed(1)} s; falas em ${s.cue.map((c) => c.toFixed(1)).join(", ")})`,
  );
  for (const it of items) {
    const c = it.c ?? 0;
    const i = Math.min(c, s.cue.length - 1);
    const at = (s.cue[i] ?? 0) + it.d;
    // A fala que está tocando no instante da entrada (pode ser a seguinte).
    let j = i;
    while (j + 1 < s.cue.length && at >= s.cue[j + 1]) j++;
    const text = says[j]?.[VOICE] ?? "";
    const rel = (at - s.cue[j]) / (s.cueDur[j] || 1);
    const k = Math.round([...text].length * Math.min(Math.max(rel, 0), 1));
    const where =
      rel < 0
        ? `antes (${(at - s.cue[j]).toFixed(1)} s) ${text}`
        : rel > 1
          ? `${text} ▲ depois (+${(at - s.cue[j] - s.cueDur[j]).toFixed(1)} s)`
          : `${[...text].slice(0, k).join("")}▲${[...text].slice(k).join("")}`;
    console.log(
      `  ${at.toFixed(1).padStart(5)} s  ${it.path.padEnd(20)} c${c}${it.d ? (it.d > 0 ? "+" : "") + it.d : ""}`.padEnd(
        40,
      ) + ` ${it.text.padEnd(14)} │ fala ${j}: ${where}`,
    );
  }
}
