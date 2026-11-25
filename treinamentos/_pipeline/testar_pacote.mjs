#!/usr/bin/env node
// Teste do pacote de um papel: abre o index.html direto do disco (file://) e por servidor
// estático e percorre, em cada módulo, vídeo, legendas, pausas "Sua vez", simulação e quiz,
// acertando e errando de propósito; no fim, o quiz final do papel.
//   node testar_pacote.mjs <pasta-do-papel>
// Direto do disco testa todos os módulos; pelos servidores, o primeiro e o quiz final.
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { chromium, dormir } from "./lib.mjs";

const pasta = path.resolve(process.argv[2] ?? ".");
const dados = JSON.parse(fs.readFileSync(path.join(pasta, "assets", "dados.js"), "utf8").replace(/^window\.TREINO = /, "").replace(/;\s*$/, ""));
const falhas = [];
let oks = 0;
const conferir = (ok, msg) => { console.log(`${ok ? "ok  " : "FALHA"} ${msg}`); if (ok) oks++; else falhas.push(msg); };

// Clique num ponto da tela parada (coordenadas de 1920×1080); o locator rola a página até ele.
async function clicarEm(page, sel, x, y) {
  const img = page.locator(sel);
  await img.evaluate((el) => el.complete && el.naturalWidth ? null : new Promise((r) => { el.onload = r; }));
  const b = await img.boundingBox();
  await img.click({ position: { x: Math.min(b.width - 2, Math.max(2, (x / 1920) * b.width)), y: Math.min(b.height - 2, Math.max(2, (y / 1080) * b.height)) } });
}

async function responder(page, q, certo) {
  if (q.tipo === "cenario") await page.locator(".alternativas button").nth(certo ? q.correta : (q.correta + 1) % q.alternativas.length).click();
  else if (q.tipo === "clique") {
    const cx = q.caixa;
    const [x, y] = certo ? [cx.x + cx.w / 2, cx.y + cx.h / 2] : [cx.x > 960 ? 60 : 1860, cx.y > 540 ? 40 : 1040];
    await clicarEm(page, "#quiz .sim-tela img", x, y);
  } else {
    if (certo) for (let alvo = 0; alvo < q.itens.length; alvo++) {
      for (;;) { // sobe o item certo até a posição dele
        const pos = await page.locator(".ordem li span").evaluateAll((els, texto) => els.findIndex((e) => e.textContent === texto), q.itens[alvo]);
        if (pos <= alvo) break;
        await page.locator(".ordem li").nth(pos).locator("button").first().click();
      }
    }
    await page.getByRole("button", { name: "Conferir a ordem" }).click();
  }
  await page.locator(".retorno").waitFor();
}

/** Quiz: erra a primeira de propósito e acerta as outras; a errada volta; nota = (n-1)/n. */
async function testarQuiz(page, m, rotulo, { errarTudo = false } = {}) {
  const qs = m.quiz.perguntas;
  await page.getByRole("button", { name: "Começar" }).click();
  for (let i = 0; i < qs.length; i++) {
    await responder(page, qs[i], i !== 0);
    const txt = await page.locator(".retorno strong").textContent();
    if (i === 0) conferir(txt === "Ainda não.", `${rotulo} quiz: resposta errada mostra o porquê`);
    if (i === 1) conferir(txt === "Certo.", `${rotulo} quiz: resposta certa confirma`);
    if (i === 0 && !m.final) conferir((await page.locator(".retorno .secundario").count()) === (qs[0].rever != null ? 1 : 0), `${rotulo} quiz: retorno traz o link “Rever no vídeo”`);
    await page.locator(".retorno .primario").click();
  }
  conferir((await page.locator(".q .conta").textContent()).startsWith("Revisão"), `${rotulo} quiz: a pergunta errada volta no fim`);
  await responder(page, qs[0], true);
  await page.locator(".retorno .primario").click();
  const nota = await page.locator(".nota").textContent();
  const esperado = Math.round(((qs.length - 1) / qs.length) * 100) + "%";
  conferir(nota === esperado, `${rotulo} quiz: nota da primeira tentativa (${nota}, esperado ${esperado})`);
  conferir((await page.locator(".rever li").count()) === 1, `${rotulo} quiz: a tela final lista o que rever`);
  conferir((await page.locator(".q h2").textContent()).startsWith(qs.length - 1 >= qs.length * m.quiz.corte ? "Aprovado" : "Ainda não"), `${rotulo} quiz: aprovação pela nota de corte`);
  if (errarTudo) { // segunda rodada: erra tudo → reprovado
    await page.getByRole("button", { name: "Refazer o quiz" }).click();
    await page.getByRole("button", { name: "Começar" }).click();
    for (let i = 0; i < qs.length; i++) { await responder(page, qs[i], false); await page.locator(".retorno .primario").click(); }
    for (let i = 0; i < qs.length; i++) { await responder(page, qs[i], true); await page.locator(".retorno .primario").click(); }
    conferir((await page.locator(".nota").textContent()) === "0%" && (await page.locator(".q h2").textContent()).startsWith("Ainda não"), `${rotulo} quiz: errando tudo, nota 0% e reprovado`);
  }
}

async function testarModulo(page, m, modo, completo) {
  const R = `M${m.id}`;
  if (dados.modulos.length > 1) await page.locator(`#modulos button[data-id="${m.id}"]`).click();
  // Vídeo, capítulos e legendas
  if (modo.includes("sem faixa")) {
    await page.waitForFunction(() => document.getElementById("video").dataset.memoria === "1", null, { timeout: 30000 }).catch(() => {});
    conferir(await page.evaluate(() => document.getElementById("video").src.startsWith("blob:")), `${R} servidor sem Range: o vídeo foi baixado inteiro para poder saltar de trecho`);
  }
  await page.waitForFunction((d) => { const v = document.getElementById("video"); return v.readyState >= 1 && Math.abs(v.duration - d) < 1; }, m.duracao, { timeout: 20000 }).catch(() => {});
  const v = await page.evaluate(() => { const x = document.getElementById("video"); const t = [...x.textTracks].find((k) => k.mode !== "disabled"); return { dur: x.duration, cues: t?.cues?.length ?? 0, modo: t?.mode }; });
  conferir(Math.abs(v.dur - m.duracao) < 1, `${R} vídeo carregou (${v.dur?.toFixed(1)} s)`);
  conferir(v.cues === m.legendas.length && v.modo === "showing", `${R} legendas carregadas (${v.cues} falas, visíveis)`);
  conferir((await page.locator("#capitulos button").count()) === m.capitulos.length, `${R} ${m.capitulos.length} capítulos na lista`);
  await page.locator("#capitulos button").nth(1).click();
  await dormir(600);
  const t1 = await page.evaluate(() => document.getElementById("video").currentTime);
  conferir(Math.abs(t1 - m.capitulos[1].inicio) < 2, `${R} clicar no capítulo leva ao trecho (${t1.toFixed(1)} s)`);
  const cue = await page.evaluate(async (t) => { const x = document.getElementById("video"); x.pause(); x.currentTime = t; await new Promise((r) => setTimeout(r, 500)); const k = [...x.textTracks].find((z) => z.mode === "showing"); return k.activeCues?.[0]?.text ?? ""; }, m.legendas[2][0] + 0.2);
  conferir(cue.length > 0, `${R} legenda aparece no tempo certo (“${cue.replace(/\n/g, " ").slice(0, 40)}…”)`);

  // Pausa "Sua vez": o vídeo para sozinho, mostra o checklist e só segue com "Continuar"
  const p = m.pausas[0];
  await page.evaluate((t) => { const x = document.getElementById("video"); x.muted = true; x.currentTime = t - 1.5; return x.play(); }, p.t);
  await page.locator("#suavez:not([hidden])").waitFor({ timeout: 8000 }).catch(() => {});
  const pausa = await page.evaluate(() => ({ visivel: !document.getElementById("suavez").hidden, parado: document.getElementById("video").paused, itens: document.querySelectorAll("#suavez-itens li").length, titulo: document.getElementById("suavez-titulo").textContent }));
  conferir(pausa.visivel && pausa.parado, `${R} “Sua vez” pausa o vídeo sozinho (${pausa.titulo})`);
  conferir(pausa.itens === p.itens.length, `${R} checklist com ${pausa.itens} itens`);
  await dormir(700);
  conferir(await page.evaluate(() => document.getElementById("video").paused), `${R} o vídeo continua parado enquanto não clicam em Continuar`);
  await page.click("#suavez-continuar");
  await dormir(500);
  conferir(await page.evaluate(() => !document.getElementById("video").paused && document.getElementById("suavez").hidden), `${R} “Continuar” retoma o vídeo`);

  // Simulações: erra de propósito, vê a dica, acerta e chega ao fim (todas no modo completo)
  const sims = completo ? m.simulacoes : [m.simulacoes.find((x) => x.passos.some((q) => q.tipo === "digitar")) ?? m.simulacoes[0]];
  for (const s of sims) {
    await page.evaluate((id) => window.__treinoTeste.abrirSim(id), s.id);
    for (let i = 0; i < s.passos.length; i++) {
      const q = s.passos[i], cx = q.caixa;
      if (i === 0) {
        await clicarEm(page, "#sim-img", cx.x > 960 ? 60 : 1860, cx.y > 540 ? 40 : 1000);
        conferir((await page.locator("#sim-dica").textContent()).startsWith("Ainda não"), `${R} simulação “${s.titulo}”: clique errado dá dica e mantém o passo`);
        conferir((await page.locator("#sim-passo").textContent()).startsWith("Passo 1 "), `${R} simulação: continua no passo 1 depois do erro`);
      }
      await clicarEm(page, "#sim-img", cx.x + cx.w / 2, cx.y + cx.h / 2);
      if (q.tipo === "digitar") {
        await page.locator("#sim-digitar:not([hidden])").waitFor();
        await page.fill("#sim-campo", "texto errado"); await page.click("#sim-digitar button");
        conferir((await page.locator("#sim-dica").textContent()).includes("Confira o texto"), `${R} simulação: texto errado não avança`);
        await page.fill("#sim-campo", q.valor); await page.click("#sim-digitar button");
      }
      await dormir(800);
    }
    conferir((await page.locator("#sim-passo").textContent()) === "Concluído", `${R} simulação “${s.titulo}” chega ao fim (${s.passos.length} passos)`);
  }

  await page.evaluate(() => window.__treinoTeste.aba("quiz"));
  await testarQuiz(page, m, R, { errarTudo: m === dados.modulos[0] });
  // “Rever no vídeo” leva ao trecho
  const q0 = m.quiz.perguntas[0];
  if (q0.rever != null) {
    await page.locator(".rever button").first().click();
    await dormir(500);
    const tv = await page.evaluate(() => document.getElementById("video").currentTime);
    conferir(Math.abs(tv - q0.rever) < 2 && !(await page.locator("#painel-video").isHidden()), `${R} “Rever no vídeo” abre o trecho (${tv.toFixed(1)} s)`);
  }
}

async function percorrer(url, modo, completo) {
  console.log(`\n== ${modo}: ${url}`);
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
  await page.goto(url);
  const reais = dados.modulos.filter((m) => !m.final);
  conferir((await page.locator("#modulos").isHidden()) === (dados.modulos.length < 2) && (await page.locator("#modulos button").count()) === dados.modulos.length, `${dados.modulos.length} módulo(s) no seletor`);
  for (const m of completo ? reais : reais.slice(0, 1)) await testarModulo(page, m, modo, completo);

  // Quiz final do papel
  const fim = dados.modulos.find((m) => m.final);
  if (fim) {
    await page.locator('#modulos button[data-id="final"]').click();
    conferir((await page.locator("#aba-video").isHidden()) && (await page.locator("#aba-pratica").isHidden()) && !(await page.locator("#painel-quiz").isHidden()), "quiz final: abre direto no quiz, sem as abas de vídeo e prática");
    await testarQuiz(page, fim, "final");
    const r = fim.quiz.perguntas[0].rever;
    if (r) {
      await page.locator(".rever button").first().click();
      await dormir(700);
      const onde = await page.evaluate(() => ({ t: document.getElementById("video").currentTime, titulo: document.getElementById("titulo").textContent }));
      conferir(Math.abs(onde.t - r.t) < 2 && onde.titulo.includes(`Módulo ${r.modulo}`), `quiz final: “Rever no vídeo” abre o módulo ${r.modulo} no trecho (${onde.t.toFixed(1)} s)`);
    }
  }
  // Guia rápido
  await page.goto(url.replace("index.html", "guia-rapido.html"));
  conferir((await page.locator("section").count()) > 0 && (await page.locator("ol li").count()) > 0, "guia rápido abre com os passos");
  conferir(erros.length === 0, `sem erros no console (${erros.length})${erros.length ? ": " + erros.slice(0, 2).join(" | ") : ""}`);
  await browser.close();
}

await percorrer("file://" + path.join(pasta, "index.html"), "direto do disco", true);
// Servidor estático de teste com pedido por faixa (Range), como nginx, Vercel ou S3: sem
// isso o navegador não salta de trecho no vídeo (o `python -m http.server` não atende).
const porta = 8765;
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".mp4": "video/mp4",
  ".vtt": "text/vtt", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json" };
const servir = (comFaixa) => http.createServer((req, res) => {
  const arq = path.join(pasta, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!arq.startsWith(pasta) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404).end(); return; }
  const tam = fs.statSync(arq).size, tipo = TIPOS[path.extname(arq)] ?? "application/octet-stream";
  const m = comFaixa ? /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "") : null;
  if (m) {
    const ini = m[1] ? Number(m[1]) : 0, fim = m[2] ? Number(m[2]) : tam - 1;
    res.writeHead(206, { "Content-Type": tipo, "Accept-Ranges": "bytes", "Content-Range": `bytes ${ini}-${fim}/${tam}`, "Content-Length": fim - ini + 1 });
    fs.createReadStream(arq, { start: ini, end: fim }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Type": tipo, ...(comFaixa ? { "Accept-Ranges": "bytes" } : {}), "Content-Length": tam });
    fs.createReadStream(arq).pipe(res);
  }
});
// Dois servidores: um como nginx, Vercel ou S3 (atende Range) e um simples, que não atende
// (como o `python -m http.server`), em que o player tem de baixar o vídeo inteiro.
for (const [comFaixa, nome] of [[true, "servidor estático"], [false, "servidor estático sem faixa (Range)"]]) {
  const srv = servir(comFaixa);
  await new Promise((ok) => srv.listen(porta, "127.0.0.1", ok));
  try { await percorrer(`http://127.0.0.1:${porta}/index.html`, nome, false); } finally { srv.closeAllConnections?.(); await new Promise((ok) => srv.close(ok)); }
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S) · ${oks} conferências certas` : `\nTudo passou nos três modos (${oks} conferências).`);
process.exit(falhas.length ? 1 : 0);
