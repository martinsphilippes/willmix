#!/usr/bin/env node
// Grava as cenas de um papel na plataforma real (portal de treino em modo memória).
//
//   node gravar.mjs <pasta-do-papel|cenas.json> [--cena ID ...] [--so-ensaio] [--sem-ensaio]
//
// Para cada cena: (1) ENSAIO sem cabeça a partir do ponto de salvamento da cena:
// valida os passos e tira as telas paradas + caixas dos alvos; salva o ponto
// seguinte. (2) GRAVAÇÃO em tempo real numa tela virtual (Xvfb), capturada pelo
// ffmpeg (x11grab) a 30 qps, sem perdas, no ritmo da narração já sintetizada.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  abrirEnsaio, abrirGravacao, agora, dormir, gravarJson, lerJson, restaurarPonto,
  salvarPonto, subirDisplay, subirServidor, temPonto, zerarDados,
} from "./lib.mjs";
import { abrirCena, ensaiar, gravarPassos } from "./cena.mjs";

const args = process.argv.slice(2);
let arq = args.find((a, i) => !a.startsWith("--") && !["--cena", "--modulo"].includes(args[i - 1]));
if (!arq) { console.error("uso: node gravar.mjs <pasta-do-papel|cenas.json> [--cena ID]"); process.exit(2); }
if (fs.statSync(arq).isDirectory()) arq = path.join(arq, "cenas.json");
let soCenas = args.flatMap((a, i) => (a === "--cena" ? [args[i + 1]] : []));
const soModulos = args.flatMap((a, i) => (a === "--modulo" ? [args[i + 1]] : []));
const SO_ENSAIO = args.includes("--so-ensaio");
const SEM_ENSAIO = args.includes("--sem-ensaio");
const TENTATIVAS = 3; // 1 + refaz até 2× antes de reportar

const papel = lerJson(arq);
if (soModulos.length && !soCenas.length)
  soCenas = papel.cenas.filter((c) => soModulos.includes(String(c.modulo ?? 1))).map((c) => c.id);
const pasta = path.dirname(path.resolve(arq));
const build = path.join(pasta, "_build");
const tempos = lerJson(path.join(build, "audio", "tempos.json"), {});

// Captura acima de 1080p: o zoom da edição continua nítido e o 1080p final sai de uma
// imagem maior (reduzida com Lanczos). 1920×1080 CSS × 1,3333 = 2560×1440 px.
const ESCALA = Number(process.env.TREINO_ESCALA ?? papel.captura?.escala ?? 4 / 3);
const L = Math.round(1920 * ESCALA), A = Math.round(1080 * ESCALA);
const QPS = 30;
const MARCA_COR = "#ff00ff";

async function estadoInicial(cena) {
  if (!cena.estado) return;
  if (cena.estado === "vazio") return zerarDados();
  if (!temPonto(cena.estado)) throw new Error(`cena ${cena.id}: falta o ponto de salvamento "${cena.estado}" (rode a preparação em _demo/)`);
  await restaurarPonto(cena.estado);
}

async function ensaio(cena) {
  await estadoInicial(cena);
  const e = await abrirEnsaio({ idioma: papel.conta?.idioma ?? "pt" });
  try {
    await abrirCena(e.page, cena, papel);
    const quadros = await ensaiar(e.page, cena, path.join(build, "quadros", cena.id));
    gravarJson(path.join(build, "quadros", cena.id, "quadros.json"), quadros);
    if (cena.salvar) salvarPonto(cena.salvar);
  } finally { await e.fechar(); }
}

function iniciarCaptura(display, saida) {
  const ff = spawn("ffmpeg", ["-hide_banner", "-loglevel", "info", "-y",
    "-f", "x11grab", "-draw_mouse", "0", "-framerate", String(QPS), "-video_size", `${L}x${A}`,
    "-i", display, "-c:v", "libx264", "-preset", "ultrafast", "-qp", "0", "-pix_fmt", "yuv444p",
    "-r", String(QPS), saida], { stdio: ["pipe", "ignore", "pipe"] });
  let erro = "";
  ff.stderr.on("data", (d) => { erro = (erro + d).slice(-4000); });
  const fim = new Promise((ok) => ff.on("close", ok));
  return { parar: async () => { ff.stdin.write("q"); await fim; return erro; } };
}

/** Acha, nos primeiros segundos do vídeo, o último quadro da marca de sincronia. */
function fimDaMarca(video) {
  const n = 5 * QPS;
  const bruto = execFileSync("ffmpeg", ["-v", "error", "-i", video, "-frames:v", String(n),
    "-vf", "crop=8:8:in_w/2:in_h/2,scale=1:1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
    { maxBuffer: 1 << 24 });
  let ultimo = -1, visto = false;
  for (let i = 0; i < bruto.length / 3; i++) {
    const [r, g, b] = [bruto[i * 3], bruto[i * 3 + 1], bruto[i * 3 + 2]];
    const magenta = r > 200 && g < 70 && b > 200;
    if (magenta) { ultimo = i; visto = true; } else if (visto) break;
  }
  if (ultimo < 0) throw new Error("marca de sincronia não encontrada na gravação");
  return (ultimo + 1) / QPS;
}

async function gravacao(cena, display) {
  await estadoInicial(cena);
  const g = await abrirGravacao({ display: display.nome, escala: ESCALA, idioma: papel.conta?.idioma ?? "pt" });
  const bruto = path.join(build, "video", `${cena.id}.bruto.mkv`);
  fs.mkdirSync(path.dirname(bruto), { recursive: true });
  let captura = null;
  try {
    await abrirCena(g.page, cena, papel);
    // Cursor num ponto neutro antes de começar (ou onde a cena anterior deixou).
    const p0 = cena.cursor_inicial ?? [960, 620];
    await g.page.evaluate(([x, y]) => window.__treino.cursor(x, y, 0), p0);
    await g.page.mouse.move(1916, 620);
    captura = iniciarCaptura(display.nome, bruto);
    await dormir(1200);
    // Marca de sincronia: a tela fica magenta por ~0,3 s; o fim dela é o zero da cena.
    await g.page.evaluate((c) => { window.__treino.marca(c, 300); }, MARCA_COR);
    await dormir(300);
    const t0 = agora();
    await dormir(450); // respiro: a marca some e a cena começa parada
    const linha = await gravarPassos(g.page, cena, tempos[cena.id] ?? {}, t0);
    await dormir(500);
    const duracao = (agora() - t0) / 1000;
    const log = await captura.parar(); captura = null;
    const zero = fimDaMarca(bruto);
    const perdas = /drop=(\d+)/.exec(log.split("\n").filter((l) => l.includes("frame=")).pop() ?? "");
    gravarJson(path.join(build, "video", `${cena.id}.json`), {
      cena: cena.id, bruto: path.basename(bruto), zero, duracao, escala: ESCALA,
      largura: L, altura: A, qps: QPS, quadros_perdidos: perdas ? Number(perdas[1]) : null, passos: linha });
    return { zero, duracao };
  } finally {
    if (captura) await captura.parar();
    await g.fechar();
  }
}

await subirServidor();
let display = null;
const falhas = [];
for (const cena of papel.cenas) {
  if (soCenas.length && !soCenas.includes(cena.id)) continue;
  if (cena.tipo && cena.tipo !== "tela") continue; // cartões são montados na edição
  let ok = false, ultimoErro = null;
  for (let t = 1; t <= TENTATIVAS && !ok; t++) {
    try {
      if (!SEM_ENSAIO) { await ensaio(cena); console.log(`ensaio ok · ${cena.id}`); }
      if (!SO_ENSAIO) {
        display ??= await subirDisplay(99, L, A);
        const r = await gravacao(cena, display);
        console.log(`gravada · ${cena.id} · ${r.duracao.toFixed(1)} s`);
      }
      ok = true;
    } catch (e) {
      ultimoErro = e;
      console.error(`tentativa ${t}/${TENTATIVAS} falhou · ${cena.id} · ${String(e.message).split("\n")[0]}`);
    }
  }
  if (!ok) falhas.push({ cena: cena.id, erro: String(ultimoErro?.message ?? ultimoErro) });
}
display?.parar();
if (falhas.length) {
  gravarJson(path.join(build, "falhas-gravacao.json"), falhas);
  console.error(`\n${falhas.length} cena(s) falharam depois de ${TENTATIVAS} tentativas:`, falhas);
  process.exit(1);
}
