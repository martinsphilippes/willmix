/*
 * Motor do filme: monta as cenas da linha do tempo (build/<vídeo>.<idioma>.json,
 * gerada por scripts/video/build.mjs) e expõe window.seek(t), que deixa o
 * quadro exatamente no instante t (segundos depois da vinheta de abertura).
 * Quem chama é o renderizador (render.mjs), um quadro por vez.
 */
import { SCENES } from "./scenes.js";

const q = new URLSearchParams(location.search);
const video = q.get("video") ?? "short";
const lang = q.get("lang") ?? "pt";
document.documentElement.dataset.lang = lang;

const json = (url) => fetch(url).then((r) => r.json());
const [tl, icons, world] = await Promise.all([
  json(`build/${video}.${lang}.json`),
  json("assets/icons.json"),
  json("assets/world.json"),
]);

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
/** Chinês não separa as palavras com espaço: o navegador separa
 *  (Intl.Segmenter). Devolve os pedaços de uma linha: palavras (`w`, com `red`
 *  entre asteriscos) e os espaços que o texto traz entre o chinês e o que vem
 *  em letras latinas ("Wellmix 门户"). A pontuação fica com a palavra anterior,
 *  para nunca abrir uma linha. */
const HAN = /[㐀-鿿]/;
const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
function hanWords(line) {
  const out = [];
  line.split("*").forEach((run, i) => {
    for (const s of segmenter.segment(run)) {
      const last = out.at(-1);
      if (/^\s+$/.test(s.segment)) {
        if (last && !last.space) out.push({ space: true });
      } else if (!s.isWordLike && last && !last.space) last.w += s.segment;
      else out.push({ w: s.segment, red: i % 2 === 1 });
    }
  });
  return out;
}
/** Textos fixos das cenas (rótulos que não vêm do roteiro): o roteiro pode trocá-los (`ui`). */
const UI = {
  // Nome do portal na barra da janela do navegador.
  portal: "Portal Wellmix",
  brazil: "Brazil",
  sees: "Sees",
  neverSees: "Never sees",
  chaos: {
    mail: "E-mail",
    sheet: "Spreadsheet",
    chat: "Chat group",
    phone: "Phone call",
    pdf: "PDF",
    attach: "Attachment",
    // Selo de um dos ícones de planilha ("versão final").
    final: "final",
  },
  ...(tl.ui ?? {}),
};
UI.chaos = { ...UI.chaos, ...(tl.ui?.chaos ?? {}) };
const ctx = {
  lang,
  ui: UI,
  world,
  esc,
  /** Tela real do portal (shots.mjs): a pasta vem do roteiro (`shots`, por
   *  exemplo "intl" = telas em inglês) ou, sem ela, é a do idioma da legenda. */
  shot: (name) => `shots/${tl.shots ?? lang}/${name}.png`,
  icon: (name, cls = "") => {
    if (!icons[name])
      throw new Error(`ícone fora de assets/icons.json: ${name}`);
    return `<svg class="ic ${cls}" viewBox="0 0 24 24">${icons[name]}</svg>`;
  },
  /** Texto palavra a palavra: cada palavra sobe de dentro da própria linha.
   *  Entre asteriscos (*assim*, uma ou mais palavras) sai em vermelho. */
  words: (text, at = 0, step = 0.07, d = 0.8) => {
    let n = 0;
    let red = false;
    const span = (w, isRed) =>
      `<span class="w"><i class="${isRed ? "red" : ""}" style="--at:${(at + n++ * step).toFixed(3)}s;--d:${d}s">${esc(w)}</i></span>`;
    return text
      .split("\n")
      .map((line) =>
        HAN.test(line)
          ? hanWords(line)
              .map((p) => (p.space ? " " : span(p.w, p.red)))
              .join("")
          : line
              .split(/\s+/)
              .filter(Boolean)
              .map((raw) => {
                let w = raw;
                const opens = w.startsWith("*");
                if (opens) w = w.slice(1);
                const closes = /\*[.,!?]?$/.test(w);
                if (closes) w = w.replace(/\*([.,!?]?)$/, "$1");
                if (opens) red = true;
                const html = span(w, red);
                if (closes) red = false;
                return html;
              })
              .join(" "),
      )
      .join("<br>");
  },
};

const host = document.getElementById("scenes");
const scenes = tl.scenes.map((s) => {
  const el = document.createElement("section");
  el.id = s.id;
  el.className = `scene s-${s.type} ${s.cls ?? ""}`;
  el.style.setProperty("--dur", `${s.dur}s`);
  el.style.display = "none";
  const build = SCENES[s.type];
  if (!build) throw new Error(`cena desconhecida: ${s.type}`);
  el.innerHTML = build(s, ctx);
  host.append(el);
  return { ...s, el, on: false };
});

/* Marca e capítulo fixos no canto (só no vídeo completo). */
const chrome = document.getElementById("chrome");
chrome.innerHTML = `<img class="brand" src="/brand/wellmix-logo.svg" alt="" />${
  tl.chapters?.length
    ? `<div class="chapter"><b></b><span class="bar"><i></i></span><span class="n"></span></div>`
    : ""
}`;
const brand = chrome.querySelector(".brand");
const chapterEl = chrome.querySelector(".chapter");

const subBox = document.getElementById("sub-box");
let curSub = null;
function subtitles(t) {
  const c = tl.subs.find((s) => t >= s.t0 && t < s.t1) ?? null;
  if (c !== curSub) {
    curSub = c;
    subBox.innerHTML = c ? c.lines.map(esc).join("<br>") : "";
  }
  subBox.style.opacity = c
    ? Math.max(0, Math.min(1, (t - c.t0) / 0.1, (c.t1 - t) / 0.1))
    : 0;
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));
/** Tempo em que duas cenas seguidas ficam juntas na tela (vem da linha do tempo). */
const OVERLAP = tl.overlap ?? 0.55;
const bg = document.getElementById("bg");

window.seek = (t) => {
  for (const s of scenes) {
    const on = t >= s.start && t < s.start + s.dur;
    if (on !== s.on) {
      s.el.style.display = on ? "" : "none";
      s.on = on;
    }
    if (!on) continue;
    for (const a of s.el.getAnimations({ subtree: true })) {
      a.pause();
      a.currentTime = (t - s.start) * 1000;
    }
  }
  for (const a of bg.getAnimations({ subtree: true })) {
    a.pause();
    a.currentTime = t * 1000;
  }
  // Marca no canto: fica firme de uma cena para a outra e só some, em fusão,
  // nas cenas que já mostram a marca grande. A cena nova entra OVERLAP
  // segundos antes de a anterior sair (build.mjs); a marca acompanha essa
  // fusão (antes ela piscava: caía a zero no primeiro quadro de cada cena).
  const live = scenes.filter((s) => s.on);
  const cur = live.at(-1);
  const prev = live.length > 1 ? live.at(-2) : null;
  const wants = (s) => (s && !s.noBrand ? 1 : 0);
  const k = cur ? clamp01((t - cur.start) / OVERLAP) : 0;
  let visible = prev ? wants(prev) * (1 - k) + wants(cur) * k : wants(cur);
  // Na primeira cena a marca espera o papel da vinheta abrir.
  if (cur?.cls?.includes("first"))
    visible *= clamp01((t - cur.start - 1.1) / 0.5);
  brand.style.opacity = 0.92 * visible;
  if (chapterEl) {
    const ch = tl.chapters.findLast((c) => t >= c.t0) ?? null;
    const show = ch && t < ch.t1;
    chapterEl.style.opacity = show
      ? visible * clamp01(Math.min(t - ch.t0, ch.t1 - t) / 0.5)
      : 0;
    if (show) {
      chapterEl.querySelector("b").textContent = ch.label;
      chapterEl.querySelector(".n").textContent = ch.n;
      chapterEl.querySelector(".bar i").style.transform =
        `scaleX(${clamp01((t - ch.t0) / (ch.t1 - ch.t0))})`;
    }
  }
  subtitles(t);
};

/* Tudo carregado antes do primeiro quadro: fontes (inclusive as faixas do
   chinês que as legendas vão usar) e imagens já decodificadas. */
const allText =
  tl.subs.map((s) => s.lines.join("")).join("") + (tl.glyphs ?? "");
await Promise.all([
  // Legenda em chinês: 500 e 700. Com texto de cena em chinês (vídeo em
  // mandarim), também os pesos dos títulos e dos textos de apoio.
  ...(HAN.test(tl.glyphs ?? "") ? [400, 500, 600, 700, 800] : [500, 700]).map(
    (w) => document.fonts.load(`${w} 40px "Noto Sans SC"`, allText),
  ),
  ...[500, 600, 700, 800].map((w) =>
    document.fonts.load(`${w} 40px "Montserrat"`, "Aáçãõ"),
  ),
  ...[400, 500, 600].map((w) =>
    document.fonts.load(`${w} 40px "Inter"`, "Aáçãõ"),
  ),
]);
for (const s of scenes) s.el.style.display = "";
await Promise.all(
  [...document.images].map((img) =>
    img.decode().catch(() => {
      throw new Error(`imagem não carregou: ${img.src}`);
    }),
  ),
);
for (const s of scenes) s.el.style.display = "none";
window.seek(0);
window.FILM = { duration: tl.duration, fps: tl.fps, ready: true };
