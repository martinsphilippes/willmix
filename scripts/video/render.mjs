/*
 * Renderiza o filme quadro a quadro (sem perder quadro: o tempo é o do
 * motor, não o do relógio) e grava out/tmp/<vídeo>.<idioma>.film.mp4, ainda
 * sem a vinheta e sem som (quem junta é mix.mjs).
 *   node render.mjs <vídeo> <idioma> [--fps 60] [--workers 4] [--from s] [--to s] [--patch]
 * Cada trabalhador abre o próprio navegador, percorre um trecho e manda os
 * quadros (JPEG de alta qualidade) direto para o ffmpeg.
 */
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT, launch, openFilm, serve } from "./lib.mjs";

const args = process.argv.slice(2);
const [video = "short", lang = "pt"] = args;
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? Number(args[i + 1]) : def;
};
const fps = opt("fps", 60);
/**
 * --patch: em vez do filme inteiro, grava só o trecho de --from a --to em
 * out/tmp/<vídeo>.<idioma>.patch.<quadro inicial>.mp4. O mix.mjs põe esse
 * trecho no lugar dos mesmos quadros do filme (serve quando muda o desenho
 * de uma cena sem mudar a linha do tempo).
 */
const name = args.includes("--patch")
  ? `patch.${String(Math.round(opt("from", 0) * fps)).padStart(6, "0")}`
  : "film";
const workers = opt("workers", 4);

const { server, port } = await serve();
const tmp = join(ROOT, "out/tmp");
await mkdir(tmp, { recursive: true });

async function worker(index, first, last) {
  const browser = await launch();
  const { page } = await openFilm(browser, port, video, lang);
  const cdp = await page.context().newCDPSession(page);
  const part = join(tmp, `${video}.${lang}.${name}.part${index}.mp4`);
  const ff = spawn(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-f",
      "image2pipe",
      "-c:v",
      "mjpeg",
      "-framerate",
      String(fps),
      "-i",
      "-",
      "-vf",
      // JPEG (BT.601, faixa cheia) → vídeo (BT.709, faixa de TV) com arredondamento
      // exato: sem isso o cinza neutro saía com 1 nível a menos de croma
      // (branco levemente esverdeado e um degrau na emenda com a vinheta).
      "scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "10",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-colorspace",
      "bt709",
      part,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((res, rej) =>
    ff.on("close", (code) =>
      code === 0 ? res() : rej(new Error(`ffmpeg saiu com ${code}`)),
    ),
  );
  for (let f = first; f < last; f++) {
    await page.evaluate((t) => window.seek(t), f / fps);
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "jpeg",
      quality: 97,
      optimizeForSpeed: true,
    });
    if (!ff.stdin.write(Buffer.from(data, "base64")))
      await new Promise((r) => ff.stdin.once("drain", r));
    if (index === 0 && (f - first) % 300 === 0)
      console.log(`  quadro ${f - first}/${last - first} do trabalhador 0`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
  return part;
}

/* Duração do filme: pergunta ao próprio palco. */
const probe = await launch();
const { film } = await openFilm(probe, port, video, lang);
await probe.close();
const from = Math.round(opt("from", 0) * fps);
const to = Math.round(opt("to", film.duration) * fps);
const total = to - from;
const per = Math.ceil(total / workers);
console.log(
  `${video}.${lang}: ${total} quadros a ${fps} fps, ${workers} trabalhadores`,
);
const t0 = Date.now();
const parts = await Promise.all(
  Array.from({ length: workers }, (_, i) =>
    worker(i, from + i * per, Math.min(to, from + (i + 1) * per)),
  ),
);
const list = join(tmp, `${video}.${lang}.${name}.parts.txt`);
await writeFile(list, parts.map((p) => `file '${p}'`).join("\n"));
const out = join(tmp, `${video}.${lang}.${name}.mp4`);
await new Promise((res, rej) =>
  spawn(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-c",
      "copy",
      out,
    ],
    {
      stdio: "inherit",
    },
  ).on("close", (c) =>
    c === 0 ? res() : rej(new Error(`concat saiu com ${c}`)),
  ),
);
for (const p of parts) await rm(p);
await rm(list);
console.log(
  `${out} em ${((Date.now() - t0) / 1000).toFixed(0)} s (${(total / ((Date.now() - t0) / 1000)).toFixed(1)} quadros/s)`,
);
server.close();
