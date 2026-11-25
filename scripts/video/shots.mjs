/*
 * Captura as telas reais do portal usadas nos vídeos, no idioma pedido, com o
 * portal em modo demonstração (base do E2E limpa por scrub.mjs):
 *   node shots.mjs <idioma> [nome1,nome2…] [--out pasta] [--review pasta] [--latin]
 * Grava film/shots/<idioma ou pasta>/<nome>.png (2560 × 1600: janela de
 * 1280 × 800 em dobro, para os zooms continuarem nítidos). Com --review grava
 * miniaturas. PORTAL e DATA_DIR escolhem o servidor e a base (padrão: porta
 * 3200 e .data-video). Em português, com a base de data-pt.mjs e o chat de
 * seed-chat.mjs (LANGUAGE=pt):
 *   PORTAL=http://localhost:3203 DATA_DIR=<repo>/.data-video-br \
 *   PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome \
 *   node shots.mjs pt <nomes> --out br
 * (PW_CHROMIUM = Chromium completo: o campo de data nativo sai "dd/mm/aaaa";
 * o Chromium "headless shell" escreve "dd/mm/yyyy".) Cada captura avisa
 * ("ATENÇÃO") se o texto visível tem cara de sobra de teste ou chave crua.
 * Em chinês, com a base de data-zh.mjs (datas levadas para hoje por
 * data-shift.mjs) e o chat de seed-chat.mjs (LANGUAGE=zh):
 *   PORTAL=http://localhost:3204 DATA_DIR=<repo>/.data-video-zh \
 *   node shots.mjs zh <nomes> --out cn --latin
 * --latin lista, por captura, o que a tela ainda mostra em letras latinas
 * (texto gravado na base em português ou inglês, rótulo sem tradução).
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { ROOT, launch } from "./lib.mjs";

const BASE = process.env.PORTAL ?? "http://localhost:3200";
const DATA = process.env.DATA_DIR ?? join(ROOT, "../../.data-video");
const db = JSON.parse(readFileSync(join(DATA, "db.json"), "utf8"));
const order = (n) => db.orders.find((o) => o.number === n).id;

/* Esconde o que denuncia "demonstração" (docs/videos/GUIA.md, 7.3). */
const CLEAN = `
  header label:has(> select) { display: none !important; }
  div.bg-amber-100.text-amber-900 { display: none !important; }
  form + div.border-dashed { display: none !important; }
  nextjs-portal { display: none !important; }
  * { caret-color: transparent !important; }
`;

/* O vídeo não cita o fornecedor do ERP (pedido do dono, 15/11/2026): onde a
   tela mostra o nome, a captura mostra "ERP". Só o texto visível muda. */
const REDACT = () => {
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode())
    if (/sankhya/i.test(n.nodeValue))
      n.nodeValue = n.nodeValue
        .replace(/\b(d?o|no|ao|pelo) Sankhya\b/g, "$1 ERP")
        .replace(/Sankhya/gi, "ERP");
  for (const el of document.querySelectorAll("[placeholder], [title]"))
    for (const a of ["placeholder", "title"])
      if (/sankhya/i.test(el.getAttribute(a) ?? ""))
        el.setAttribute(a, el.getAttribute(a).replace(/Sankhya/gi, "ERP"));
};

/* O que não pode aparecer nas telas: sobra do E2E ou do scrub, tradução de
   exemplo, ERP pelo nome, "undefined" e chaves de dicionário cruas (a.b.c). */
const SUSPECT =
  /e2e|zqx|exemplo mock|\(mock\)|sankhya|undefined|\[object|\bNaN\b|\b[a-z]+(?:\.[a-z][a-zA-Z]+){2,}\b/i;

const A = {
  admin: "admin@wellmix.com",
  buyer: "operador@wellmix.com",
  sales: "vendas@wellmix.com",
  director: "diretoria@wellmix.com",
  customer: "joao@lojista.com",
  supplier: "supplier.a@china.com",
  agency: "agencia@design.com",
  broker: "despachante@comex.com",
  line: "armador@maritima.com",
  carrier: "transportadora@rodo.com",
  comex: "comex@assessoria.com",
  forwarder: "agente@cargo.com",
  ocp: "ocp@certifica.com",
  marketing: "agencia@marketing.cn",
  legal: "juridico@wellmix.com",
};

/** nome → [conta, rota, opções]. `sel`: rola até esse bloco; `mobile`: celular;
 *  `chat`: enquadra o cartão da conversa (folga em px abaixo do cabeçalho). */
const O2 = () => `/app/orders/${order(2)}`;
/** A conversa mais recente (a de seed-chat.mjs): mesmo endereço para os dois lados. */
const CHAT = () => {
  const m = db.messages.at(-1);
  return `/app/messages?c=${m.conversationId}&t=${m.topicId}`;
};
export const SHOTS = {
  // Mais larga: nesta largura os valores do financeiro cabem em uma linha.
  tower: ["admin", "/app", { wide: true }],
  order: ["admin", O2],
  "order-progress": ["admin", O2, { sel: "#order-progress" }],
  "order-payment": ["admin", O2, { sel: "#customer-payment" }],
  "order-inspection": ["admin", O2, { sel: '[id^="production-inspection"]' }],
  "order-container": ["admin", O2, { sel: "#container-origin" }],
  "shipping-docs": ["admin", () => `${O2()}/shipping-docs`],
  sla: ["admin", "/app/sla"],
  // A coluna "Ação" da auditoria mostra o código técnico (team.member.delete...):
  // o vídeo não a mostra (pedido do dono, 16/11/2026); o resto da tela é real.
  audit: ["admin", "/app/audit", { hideCol: "^(a[çc][ãa]o|action|操作)" }],
  team: ["admin", "/app/team"],
  dashboards: ["admin", "/app/dashboards"],
  // Janela mais alta: a caixa da conversa (60 % da altura) mostra as cinco mensagens.
  messages: ["admin", CHAT, { chat: 16, tall: true }],
  "m-messages": ["supplier", CHAT, { chat: 8, mobile: true }],
  // Quem deve a resposta em cada conversa (só a Wellmix abre).
  "messages-control": ["admin", "/app/messages/control"],
  notifications: ["buyer", "/app/notifications"],
  booking: ["buyer", "/app/booking"],
  "supplier-requests": ["buyer", "/app/supplier-requests"],
  "purchase-strategy": ["director", "/app/purchase-strategy"],
  "sales-orders": ["sales", "/app/sales-orders"],
  supplier: ["supplier", "/app"],
  "supplier-diecut": ["supplier", () => `/app/orders/${order(1)}/die-cut`],
  customer: ["customer", "/app/requests"],
  agency: ["agency", O2, { sel: "#certification" }],
  ocp: ["ocp", "/app"],
  marketing: ["marketing", O2, { sel: "#samples-flow, #samples" }],
  forwarder: ["forwarder", O2, { sel: "#import-flow" }],
  line: ["line", O2],
  comex: ["comex", O2, { sel: "#import-flow" }],
  broker: ["broker", "/app"],
  carrier: ["carrier", O2],
  login: [null, "/login?intro=off"],
  "m-carrier": ["carrier", O2, { mobile: true }],
  "m-supplier": ["supplier", "/app", { mobile: true }],
  "m-tower": ["admin", "/app", { mobile: true }],
};

const args = process.argv.slice(2);
const lang = args[0] ?? "en";
const names =
  args[1] && !args[1].startsWith("--")
    ? args[1].split(",")
    : Object.keys(SHOTS);
const review = args.includes("--review")
  ? args[args.indexOf("--review") + 1]
  : null;
// --out <pasta>: grava em film/shots/<pasta> (padrão: o idioma). O vídeo
// completo usa "intl": telas em inglês com a base em inglês (data-en.mjs).
const set = args.includes("--out") ? args[args.indexOf("--out") + 1] : lang;
const outDir = review ?? join(ROOT, "film/shots", set);
await mkdir(outDir, { recursive: true });

// O navegador sobe no idioma da tela: os campos de data nativos seguem o
// idioma do próprio Chromium (dd/mm/aaaa em pt, 年/月/日 em zh), não o da página.
const LOCALE = { pt: "pt-BR", zh: "zh-CN", en: "en-US" }[lang] ?? "en-US";
// No Linux o Chromium escolhe a ordem do campo de data (dd/mm × mm/dd) pela
// variável LANGUAGE, não pelo --lang: o navegador herda a do idioma da tela.
process.env.LANGUAGE = LOCALE.replace("-", "_");
const browser = await launch([`--lang=${LOCALE}`]);
const sessions = new Map();
async function session(account, mobile, wide, tall) {
  const key = `${account}:${mobile ? "m" : wide ? "w" : tall ? "t" : "d"}`;
  if (sessions.has(key)) return sessions.get(key);
  const locale = LOCALE;
  const ctx = await browser.newContext(
    mobile
      ? {
          locale,
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: review ? 1 : 3,
          isMobile: true,
          hasTouch: true,
        }
      : {
          locale,
          viewport: wide
            ? { width: 1520, height: 950 }
            : { width: 1280, height: tall ? 1000 : 800 },
          deviceScaleFactor: review ? 1 : 2,
        },
  );
  await ctx.addCookies([{ name: "wm_locale", value: lang, url: BASE }]);
  const page = await ctx.newPage();
  if (account) {
    await page.goto(`${BASE}/login?intro=off`);
    await page.getByLabel(/e-mail|email|邮箱/i).fill(A[account]);
    await page.getByLabel(/senha|password|密码/i).fill("wellmix123");
    await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
    await page.waitForURL(/\/app/);
  }
  sessions.set(key, page);
  return page;
}
for (const name of names) {
  const [account, route, o = {}] = SHOTS[name];
  try {
    const page = await session(account, o.mobile, o.wide, o.tall);
    const res = await page.goto(
      BASE + (typeof route === "function" ? route() : route),
      {
        waitUntil: "networkidle",
        timeout: 45000,
      },
    );
    await page.addStyleTag({ content: CLEAN });
    if (o.hideCol)
      await page.evaluate((src) => {
        const re = new RegExp(src, "i");
        for (const table of document.querySelectorAll("table")) {
          const heads = [...table.querySelectorAll("thead th")];
          const k = heads.findIndex((th) => re.test(th.innerText.trim()));
          if (k < 0) continue;
          for (const row of table.querySelectorAll("tr")) {
            const cell = row.children[k];
            if (cell) cell.style.display = "none";
          }
        }
      }, o.hideCol);
    if (o.sel)
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`bloco não encontrado: ${sel}`);
        window.scrollTo(
          0,
          el.getBoundingClientRect().top + window.scrollY - 84,
        );
      }, o.sel);
    if (o.chat != null) {
      // Conversa: espera as fotos, põe o cartão logo abaixo do cabeçalho e a
      // lista de mensagens no fim (as mais novas).
      await page.locator("[data-thread]").waitFor();
      await page.waitForFunction(() =>
        [...document.querySelectorAll("[data-thread] img")].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      );
      await page.evaluate((top) => {
        const thread = document.querySelector("[data-thread]");
        let card = thread.parentElement;
        while (card && !/rounded/.test(card.className))
          card = card.parentElement;
        const bar = document.querySelector("header");
        const below = bar ? bar.getBoundingClientRect().bottom : 0;
        window.scrollTo(
          0,
          card.getBoundingClientRect().top + window.scrollY - below - top,
        );
        thread.scrollTop = 0; // coluna invertida: 0 = mensagens mais novas
        // A caixa da conversa tem 60 % da altura e pode não mostrar tudo.
        // Em vez de deixar uma bolha cortada em cima ou embaixo, a caixa cresce
        // (até 140 px) para mostrar inteiras as mensagens mais novas que couberem.
        const cs = getComputedStyle(thread);
        const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const lis = [...thread.querySelectorAll("li[data-message]")];
        if (lis.length) {
          const rects = lis.map((li) => li.getBoundingClientRect());
          const end = rects.at(-1).bottom;
          let fit = 0;
          let need = 0;
          for (let k = 1; k <= lis.length; k++) {
            const h = end - rects[lis.length - k].top + pad;
            if (h > thread.clientHeight + 140) break;
            fit = k;
            need = h;
          }
          // Só mexe na caixa se alguma bolha ficaria cortada.
          if (fit < lis.length || need > thread.clientHeight)
            thread.style.maxHeight = `${Math.ceil(need) + 1}px`;
          thread.scrollTop = 0;
        }
      }, o.chat);
    }
    await page.waitForTimeout(250);
    const named = await page.evaluate(
      () => (document.body.innerText.match(/sankhya/gi) ?? []).length,
    );
    await page.evaluate(REDACT);
    // Sobra de teste, chave de texto crua ("tasks.group.x") ou valor vazio na tela.
    const suspect = await page.evaluate(
      (src) =>
        [
          ...new Set(
            document.body.innerText.match(new RegExp(src, "gi")) ?? [],
          ),
        ].slice(0, 8),
      SUSPECT.source,
    );
    // --latin: palavras em letras latinas no que a captura mostra (só a parte
    // visível da janela). Com a tela em chinês, é o que sobrou em português ou
    // inglês: texto gravado na base ou rótulo sem tradução.
    const latin = args.includes("--latin")
      ? await page.evaluate(() => {
          const seen = new Map();
          const walk = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
          );
          for (let n = walk.nextNode(); n; n = walk.nextNode()) {
            const el = n.parentElement;
            if (!el || !/[A-Za-zÀ-ÿ]{3}/.test(n.nodeValue)) continue;
            const r = el.getBoundingClientRect();
            if (r.bottom < 0 || r.top > innerHeight || !r.width || !r.height)
              continue;
            if (getComputedStyle(el).visibility === "hidden") continue;
            const text = n.nodeValue.trim().replace(/\s+/g, " ");
            if (text) seen.set(text.slice(0, 70), (seen.get(text) ?? 0) + 1);
          }
          return [...seen.keys()];
        })
      : [];
    await page.screenshot({
      path: join(outDir, `${name}.${review ? "jpg" : "png"}`),
      ...(review ? { type: "jpeg", quality: 72 } : {}),
    });
    if (latin.length) console.log(`  LATIM ${name}: ${latin.join(" | ")}`);
    console.log(
      lang,
      name,
      res?.status(),
      new URL(page.url()).pathname,
      named ? `(ERP: ${named} trocas)` : "",
      suspect.length ? `ATENÇÃO: ${JSON.stringify(suspect)}` : "",
    );
  } catch (e) {
    console.log("FALHOU", lang, name, e.message.split("\n")[0]);
  }
}
await browser.close();
