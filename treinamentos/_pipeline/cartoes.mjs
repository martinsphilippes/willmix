#!/usr/bin/env node
// Desenha os elementos de marca da edição como PNG (fundo transparente quando é
// sobreposição): indicador "Passo N de M", cartão de capítulo, abertura, "Sua vez"
// e encerramento. Mesma identidade em todos os papéis (_config/marca.json).
//   node cartoes.mjs pedidos.json     [{ tipo, saida, ...campos }]
import fs from "node:fs";
import path from "node:path";
import { AQUI, TREINO, chromium, lerJson } from "./lib.mjs";

const marca = lerJson(path.join(TREINO, "_config", "marca.json"));
const C = marca.cores;
const b64 = (arq) => fs.readFileSync(path.join(TREINO, "_config", arq)).toString("base64");
const FONTES = marca.fonte.arquivos.map((a) =>
  `@font-face{font-family:"Geist";font-weight:100 900;src:url(data:font/woff2;base64,${b64(a)}) format("woff2");}`).join("");
const LOGO_BRANCO = `data:image/svg+xml;base64,${b64(marca.logo.branco)}`;
const LOGO_COR = `data:image/svg+xml;base64,${b64(marca.logo.cor)}`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const BASE_CSS = `${FONTES} *{box-sizing:border-box;margin:0} html,body{width:1920px;height:1080px;background:transparent;
  font-family:"Geist",system-ui,sans-serif;-webkit-font-smoothing:antialiased}`;

const MODELOS = {
  // Sobreposição: pílula no rodapé, ao centro.
  passo: (p) => `<div style="position:absolute;left:0;right:0;bottom:44px;display:flex;justify-content:center">
    <div style="display:flex;align-items:center;gap:14px;padding:10px 24px 10px 10px;border-radius:999px;background:${C.grafite};
      color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35);font-size:24px;font-weight:600">
      <span style="display:flex;align-items:center;justify-content:center;min-width:44px;height:44px;padding:0 12px;border-radius:999px;
        background:${C.vermelho};font-weight:700;font-size:22px">${esc(p.numero)}</span>
      <span>Passo ${esc(p.numero)} de ${esc(p.total)}</span>
      ${p.texto ? `<span style="opacity:.55">·</span><span style="font-weight:500;max-width:1100px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.texto)}</span>` : ""}
    </div></div>`,
  // Sobreposição: nome do capítulo no canto superior esquerdo (discreto).
  selo: (p) => `<div style="position:absolute;left:36px;top:30px;display:flex;align-items:center;gap:12px;padding:8px 16px;border-radius:10px;
    background:rgba(23,24,28,.88);color:#fff;font-size:18px;font-weight:600"><img src="${LOGO_BRANCO}" style="height:16px">
    <span style="opacity:.5">|</span><span>${esc(p.texto)}</span></div>`,
  capitulo: (p) => `<div style="position:absolute;inset:0;background:linear-gradient(180deg,${C.vermelho_escuro},${C.vermelho});color:#fff;
    display:flex;flex-direction:column;justify-content:center;padding:0 160px">
    <img src="${LOGO_BRANCO}" style="height:44px;align-self:flex-start;margin-bottom:56px;opacity:.95">
    <div style="font-size:30px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;opacity:.8">${esc(p.sobretitulo)}</div>
    <div style="font-size:84px;font-weight:700;line-height:1.08;margin-top:18px;max-width:1500px;letter-spacing:-.01em">${esc(p.titulo)}</div>
    ${p.subtitulo ? `<div style="font-size:34px;font-weight:400;margin-top:28px;opacity:.9;max-width:1400px;line-height:1.3">${esc(p.subtitulo)}</div>` : ""}
    </div>`,
  abertura: (p) => `<div style="position:absolute;inset:0;background:${C.cinza_claro};color:${C.grafite};display:flex;flex-direction:column;
    align-items:center;justify-content:center;text-align:center">
    <img src="${LOGO_COR}" style="height:150px;margin-bottom:60px">
    <div style="font-size:30px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${C.vermelho}">${esc(p.sobretitulo ?? "Treinamento do Portal Wellmix")}</div>
    <div style="font-size:88px;font-weight:700;margin-top:18px;letter-spacing:-.01em">${esc(p.titulo)}</div>
    ${p.subtitulo ? `<div style="font-size:36px;margin-top:22px;opacity:.75">${esc(p.subtitulo)}</div>` : ""}</div>`,
  suavez: (p) => `<div style="position:absolute;inset:0;background:${C.grafite};color:#fff;display:flex;align-items:center;padding:0 150px;gap:90px">
    <div style="flex:none"><div style="font-size:30px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#ff8f89">Sua vez</div>
      <div style="font-size:96px;font-weight:700;line-height:1.02;margin-top:14px">Pause<br>e faça</div>
      <img src="${LOGO_BRANCO}" style="height:34px;margin-top:70px;opacity:.8"></div>
    <div style="flex:1;border-left:3px solid ${C.vermelho};padding-left:70px">
      <div style="font-size:40px;font-weight:600;margin-bottom:26px">${esc(p.titulo)}</div>
      ${(p.itens ?? []).map((t, i) => `<div style="display:flex;gap:20px;align-items:flex-start;font-size:31px;line-height:1.3;margin:17px 0">
        <span style="flex:none;width:44px;height:44px;border-radius:999px;background:${C.vermelho};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:24px">${i + 1}</span>
        <span>${esc(t)}</span></div>`).join("")}</div></div>`,
  encerramento: (p) => `<div style="position:absolute;inset:0;background:linear-gradient(180deg,${C.vermelho_escuro},${C.vermelho});color:#fff;
    display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
    <img src="${LOGO_BRANCO}" style="height:110px;margin-bottom:54px">
    <div style="font-size:70px;font-weight:700">${esc(p.titulo ?? "Agora é com você")}</div>
    ${p.subtitulo ? `<div style="font-size:34px;margin-top:24px;opacity:.9;max-width:1300px;line-height:1.35">${esc(p.subtitulo)}</div>` : ""}</div>`,
};

const pedidos = lerJson(process.argv[2]);
if (!pedidos) { console.error("uso: node cartoes.mjs pedidos.json"); process.exit(2); }
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
for (const p of pedidos) {
  if (!MODELOS[p.tipo]) throw new Error(`cartão desconhecido: ${p.tipo}`);
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${BASE_CSS}</style><body>${MODELOS[p.tipo](p)}</body>`);
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(p.saida), { recursive: true });
  await page.screenshot({ path: p.saida, omitBackground: true });
}
await browser.close();
