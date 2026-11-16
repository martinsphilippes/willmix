/*
 * Monta a linha do tempo de um vídeo a partir do roteiro (script.mjs) e da
 * duração real de cada fala (out/audio/<vídeo>/*.wav, geradas por tts.py):
 *   node build.mjs <vídeo> [--tts]
 * --tts só grava a lista de falas para o tts.py (out/<vídeo>.tts.json).
 * Sem áudio ainda, estima a duração pelo número de palavras (para ensaiar).
 * Saídas: film/build/<vídeo>.<idioma>.json (palco), out/<vídeo>.audio.json
 * (onde cada fala entra na mixagem) e as legendas .srt (em out/ e, publicadas,
 * em docs/videos/institucional/legendas). Depois de rodar, refaça a voz e a
 * trilha (tts/audio.py voice e tts/track.py): mix.mjs recusa faixas mais
 * antigas que o plano.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";
import { VIDEOS } from "./script.mjs";

export const FPS = 60;
/** Vinheta de abertura do portal: 410 quadros a 60 fps. */
export const INTRO = 410 / 60;
const OVERLAP = 0.55; // as cenas se cruzam (film.css: scene-out)
const PRE = 0.6;
const GAP = 0.3;
const POST = 0.75;
const LIMIT = { pt: 42, zh: 16, en: 42 };
const LANGS = ["pt", "zh"];
const SPEED = { pt: 17, zh: 9 };

const [video = "short"] = process.argv.slice(2);
const def = VIDEOS[video];
if (!def) throw new Error(`vídeo desconhecido: ${video}`);
const out = join(ROOT, "out");
mkdirSync(join(out, "audio", video), { recursive: true });
mkdirSync(join(ROOT, "film/build"), { recursive: true });

const clip = (scene, i) => join(out, "audio", video, `${scene.id}.${i}.wav`);

if (process.argv.includes("--tts")) {
  const list = def.scenes.flatMap((s) =>
    (s.say ?? []).map((c, i) => ({ file: clip(s, i), text: c.say ?? c.en })),
  );
  writeFileSync(join(out, `${video}.tts.json`), JSON.stringify(list, null, 1));
  console.log(
    `${list.length} falas, ${list.reduce((n, c) => n + c.text.split(/\s+/).length, 0)} palavras`,
  );
  process.exit(0);
}

/** Duração de um WAV PCM (lê o cabeçalho). */
function wavSeconds(file) {
  const b = readFileSync(file);
  let p = 12;
  let rate = 0;
  while (p < b.length - 8) {
    const id = b.toString("ascii", p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === "fmt ") rate = b.readUInt32LE(p + 16);
    if (id === "data") return size / rate;
    p += 8 + size + (size % 2);
  }
  throw new Error(`WAV sem dados: ${file}`);
}

let estimated = 0;
let t = 0;
const scenes = [];
const cues = [];
for (const s of def.scenes) {
  const pre = s.pre ?? PRE;
  const post = s.post ?? POST;
  let local = pre;
  const cue = [];
  const cueDur = [];
  (s.say ?? []).forEach((c, i) => {
    let d;
    if (existsSync(clip(s, i))) d = wavSeconds(clip(s, i));
    else {
      d = c.en.split(/\s+/).length / 2.7 + 0.25;
      estimated++;
    }
    cue.push(local);
    cueDur.push(d);
    cues.push({
      scene: s.id,
      i,
      t0: t + local,
      t1: t + local + d,
      ...c,
      file: clip(s, i),
    });
    local += d + (c.gap ?? GAP);
  });
  const dur = local - (s.say?.length ? GAP : 0) + post + OVERLAP;
  scenes.push({
    id: s.id,
    type: s.type,
    cls: s.cls,
    noBrand: s.noBrand,
    chapter: s.chapter,
    start: +t.toFixed(4),
    dur: +dur.toFixed(4),
    cue,
    cueDur,
    props: s.props,
  });
  t += dur - OVERLAP;
}
const duration = Math.ceil((t + OVERLAP) * FPS) / FPS;

/* Instante em que a marca entra na cena final (film/scenes.js, end). */
const endScene = scenes.at(-1);
const logoAt =
  endScene.start +
  (endScene.props.lines?.length
    ? (endScene.cue[1] ?? endScene.dur * 0.45)
    : 0.55) -
  0.1;

/* Capítulos: do início da cena que o abre até o próximo (ou até a cena final). */
const marks = scenes.filter((s) => s.chapter);
const lastStart = scenes.at(-1).start;
const chapters = marks.map((s, i) => ({
  label: s.chapter,
  n: `${String(i + 1).padStart(2, "0")} / ${String(marks.length).padStart(2, "0")}`,
  t0: s.start + 0.3,
  t1: (marks[i + 1]?.start ?? lastStart) + 0.2,
}));

/* Legendas: "||" divide a fala em legendas (tempo proporcional ao texto). */
const problems = [];
function subsFor(lang) {
  const list = [];
  cues.forEach((c, k) => {
    const parts = c[lang].split("||").map((p) => p.trim());
    const total = parts.reduce((n, p) => n + p.replace(/\|/g, "").length, 0);
    const end = Math.min(c.t1 + 0.18, (cues[k + 1]?.t0 ?? Infinity) - 0.04);
    let at = c.t0;
    parts.forEach((p, i) => {
      const lines = p.split("|").map((l) => l.trim());
      const share = ((c.t1 - c.t0) * p.replace(/\|/g, "").length) / total;
      const t1 = i === parts.length - 1 ? end : at + share;
      if (lines.length > 2)
        problems.push(`${lang} ${c.scene}.${c.i}: mais de 2 linhas`);
      for (const l of lines)
        if ([...l].length > LIMIT[lang])
          problems.push(
            `${lang} ${c.scene}.${c.i}: "${l}" tem ${[...l].length} (máx. ${LIMIT[lang]})`,
          );
      list.push({ t0: +at.toFixed(3), t1: +t1.toFixed(3), lines });
      at = t1;
    });
  });
  return list;
}
const stamp = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = (subs) =>
  subs
    .map(
      (s, i) =>
        `${i + 1}\n${stamp(s.t0 + INTRO)} --> ${stamp(s.t1 + INTRO)}\n${s.lines.join("\n")}\n`,
    )
    .join("\n");

/** Legenda em texto: em out/ e, publicada, em docs/videos/institucional/legendas. */
const PUBLISHED = join(ROOT, "../../docs/videos/institucional/legendas");
function writeSrt(lang, subs) {
  writeFileSync(join(out, `${video}.${lang}.srt`), srt(subs));
  if (existsSync(PUBLISHED))
    writeFileSync(join(PUBLISHED, `wellmix-${video}-${lang}.srt`), srt(subs));
}

/* Todo texto de tela, para o palco carregar as fontes antes do 1º quadro. */
const glyphs = [
  ...new Set(JSON.stringify(def.scenes.map((s) => s.props))),
].join("");

for (const lang of LANGS) {
  const subs = subsFor(lang);
  writeFileSync(
    join(ROOT, "film/build", `${video}.${lang}.json`),
    JSON.stringify({
      video,
      lang,
      // Pasta das telas do portal (film/shots/<pasta>); sem ela, a do idioma.
      shots: def.shots,
      fps: FPS,
      intro: INTRO,
      overlap: OVERLAP,
      duration,
      scenes,
      subs,
      chapters,
      glyphs,
    }),
  );
  writeSrt(lang, subs);
  // Velocidade de leitura do guia (pt 17, zh 9 caracteres por segundo): só avisa.
  const fast = subs
    .map((c) => c.lines.join("").length / (c.t1 - c.t0))
    .filter((cps) => cps > SPEED[lang]);
  if (fast.length)
    console.log(
      `  ${lang}: ${fast.length} de ${subs.length} legendas acima de ${SPEED[lang]} caracteres por segundo (máx. ${Math.max(...fast).toFixed(1)})`,
    );
}
const enSubs = cues.map((c, k) => ({
  t0: c.t0,
  t1: Math.min(c.t1 + 0.18, (cues[k + 1]?.t0 ?? Infinity) - 0.04),
  lines: [c.en],
}));
writeSrt("en", enSubs);
writeFileSync(
  join(out, `${video}.audio.json`),
  JSON.stringify(
    {
      intro: INTRO,
      duration: INTRO + duration,
      logo: +(INTRO + logoAt).toFixed(3),
      scenes: scenes.map((s) => ({
        id: s.id,
        type: s.type,
        at: INTRO + s.start,
        dur: s.dur,
      })),
      cues: cues.map((c) => ({
        file: c.file,
        at: +(INTRO + c.t0).toFixed(4),
        dur: +(c.t1 - c.t0).toFixed(4),
      })),
    },
    null,
    1,
  ),
);
const mmss = (s) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
console.log(
  `${video}: ${scenes.length} cenas, ${cues.length} falas, filme ${mmss(duration)} + vinheta = ${mmss(duration + INTRO)}${estimated ? ` (${estimated} falas ESTIMADAS, sem áudio)` : ""}`,
);
if (problems.length) {
  console.error("Legendas fora do padrão:\n  " + problems.join("\n  "));
  process.exitCode = 1;
}
