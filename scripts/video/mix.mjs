/*
 * Fecha um vídeo: junta a vinheta de abertura do portal, o filme renderizado
 * (out/tmp/<vídeo>.<idioma>.film.mp4) e o áudio (voz + trilha).
 *   node mix.mjs <vídeo> <idioma> [--audio] [--audio-only]
 * --audio refaz a mixagem; --audio-only para depois dela (sem juntar a imagem).
 * Áudio: voz com compressão leve; a trilha abaixa sozinha sob a voz (ducking)
 * e o conjunto sai em −16 LUFS (docs/videos/GUIA.md, seção 3). O áudio é o
 * mesmo nos dois idiomas; só a imagem (tela do portal e legenda) muda.
 * Saída: out/wellmix-<vídeo>-<idioma>.mp4 (1920 × 1080, 60 fps, H.264 + AAC).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const [video = "short", lang = "pt"] = process.argv.slice(2);
const out = join(ROOT, "out");
const a = (name) => join(out, "audio", `${video}.${name}.wav`);
const ff = (args) =>
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });

/* 1. Mixagem (uma vez por vídeo; refaz com --audio se a voz ou a trilha mudarem). */
const mix = a("mix");
// A voz e a trilha são montadas a partir de out/<vídeo>.audio.json (build.mjs).
// Faixa mais antiga que esse plano = falas fora do lugar no vídeo: para aqui.
const plan = join(out, `${video}.audio.json`);
for (const track of ["voice", "music"]) {
  if (
    !existsSync(a(track)) ||
    statSync(a(track)).mtimeMs < statSync(plan).mtimeMs
  )
    throw new Error(
      `${a(track)} é mais antiga que ${plan}: rode tts/audio.py voice e tts/track.py de novo antes de mixar.`,
    );
}
const stale =
  existsSync(mix) &&
  [a("voice"), a("music")].some(
    (f) => statSync(f).mtimeMs > statSync(mix).mtimeMs,
  );
const VOICE =
  // Voz: sem ronco grave, compressão leve, presença.
  "highpass=f=75,acompressor=threshold=-21dB:ratio=2.6:attack=6:release=140:makeup=3dB," +
  "equalizer=f=3200:t=q:w=1.2:g=1.5,aformat=channel_layouts=stereo";
// Trilha: abre espaço na faixa da fala e abaixa quando a voz entra (cerca de
// 12 dB abaixo da fala; nos intervalos e no encerramento ela volta a subir).
const MUSIC = "volume=-6dB,equalizer=f=2200:t=q:w=1.0:g=-3";
const DUCK =
  "sidechaincompress=threshold=0.008:ratio=4:attack=40:release=650:makeup=1";
if (!existsSync(mix) || stale || process.argv.includes("--audio")) {
  const pre = a("premix");
  ff([
    "-i",
    a("voice"),
    "-i",
    a("music"),
    "-filter_complex",
    `[0:a]${VOICE},asplit=2[v][key];[1:a]${MUSIC}[m];[m][key]${DUCK}[duck];[v][duck]amix=inputs=2:normalize=0[out]`,
    "-map",
    "[out]",
    "-c:a",
    "pcm_s24le",
    pre,
  ]);
  // Volume final: mede o conjunto e leva a −16 LUFS com um ganho fixo (sem
  // "respiração" de normalizador automático); limitador em −1,5 dB.
  const lufs = (file) => {
    const log = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-nostats",
        "-i",
        file,
        "-af",
        "ebur128",
        "-f",
        "null",
        "-",
      ],
      { encoding: "utf8" },
    ).stderr;
    return Number(
      /I:\s+(-?[\d.]+) LUFS/.exec(log.slice(log.lastIndexOf("Summary")))[1],
    );
  };
  const gain = -16 - lufs(pre);
  ff([
    "-i",
    pre,
    "-af",
    `volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:level=false:attack=3:release=60,aresample=48000`,
    "-c:a",
    "pcm_s16le",
    mix,
  ]);
  rmSync(pre);
  console.log(
    `${mix}: ganho ${gain.toFixed(1)} dB → ${lufs(mix).toFixed(1)} LUFS`,
  );
}
if (process.argv.includes("--audio-only")) process.exit(0);

/* 2. Vinheta + filme + áudio. A vinheta é a do portal, sem alteração. */
const intro = join(ROOT, "../../public/intro/wellmix-intro.mp4");
const film = join(out, "tmp", `${video}.${lang}.film.mp4`);
// Começo refeito (render.mjs --to N --name head): entra no lugar dos primeiros quadros do filme.
const head = join(out, "tmp", `${video}.${lang}.head.mp4`);
// Só vale se for mais novo que o filme: um filme renderizado depois dele já
// traz o começo certo.
const patched =
  existsSync(head) && statSync(head).mtimeMs > statSync(film).mtimeMs;
const headFrames = patched
  ? Number(
      spawnSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-count_packets",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=nb_read_packets",
          "-of",
          "csv=p=0",
          head,
        ],
        { encoding: "utf8" },
      ).stdout,
    )
  : 0;
const final = join(out, `wellmix-${video}-${lang}.mp4`);
// --chroma-fix: só para filmes renderizados antes da correção de arredondamento
// de render.mjs (15/11/2026): devolve o nível de croma que faltava nos neutros.
const chroma = process.argv.includes("--chroma-fix")
  ? "lutyuv=u=val+1:v=val+1,"
  : "";
const crf = process.argv.includes("--crf")
  ? process.argv[process.argv.indexOf("--crf") + 1]
  : "18";
ff([
  "-i",
  intro,
  "-i",
  film,
  "-i",
  mix,
  ...(patched ? ["-i", head] : []),
  "-filter_complex",
  "[0:v]fps=60,scale=1920:1080:in_color_matrix=bt709:out_color_matrix=bt709,format=yuv420p,setsar=1[i];" +
    (patched
      ? `[3:v]fps=60,format=yuv420p,setsar=1[h];[1:v]fps=60,trim=start_frame=${headFrames},setpts=PTS-STARTPTS,${chroma}format=yuv420p,setsar=1[f];[i][h][f]concat=n=3:v=1:a=0[v]`
      : `[1:v]fps=60,${chroma}format=yuv420p,setsar=1[f];[i][f]concat=n=2:v=1:a=0[v]`),
  "-map",
  "[v]",
  "-map",
  "2:a",
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  crf,
  "-profile:v",
  "high",
  "-level",
  "4.2",
  "-pix_fmt",
  "yuv420p",
  "-g",
  "120",
  "-bf",
  "2",
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
  "-colorspace",
  "bt709",
  "-c:a",
  "aac",
  "-b:a",
  "256k",
  "-ar",
  "48000",
  "-metadata",
  `title=Wellmix Portal (${video}, ${lang})`,
  "-movflags",
  "+faststart",
  "-shortest",
  final,
]);
console.log(final);
