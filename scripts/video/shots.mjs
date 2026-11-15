/*
 * Captura as telas reais do portal usadas nos vídeos, no idioma pedido, com o
 * portal em modo demonstração (base do E2E limpa por scrub.mjs):
 *   node shots.mjs <idioma> [nome1,nome2…] [--out pasta] [--review pasta]
 * Grava film/shots/<idioma ou pasta>/<nome>.png (2560 × 1600: janela de
 * 1280 × 800 em dobro, para os zooms continuarem nítidos). Com --review grava
 * miniaturas. PORTAL e DATA_DIR escolhem o servidor e a base (padrão: porta
 * 3200 e .data-video).
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
  audit: ["admin", "/app/audit"],
  team: ["admin", "/app/team"],
  dashboards: ["admin", "/app/dashboards"],
  messages: ["admin", CHAT, { chat: 16 }],
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
const browser = await launch([`--lang=${LOCALE}`]);
const sessions = new Map();
async function session(account, mobile, wide) {
  const key = `${account}:${mobile ? "m" : wide ? "w" : "d"}`;
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
            : { width: 1280, height: 800 },
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
    const page = await session(account, o.mobile, o.wide);
    const res = await page.goto(
      BASE + (typeof route === "function" ? route() : route),
      {
        waitUntil: "networkidle",
        timeout: 45000,
      },
    );
    await page.addStyleTag({ content: CLEAN });
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
      }, o.chat);
    }
    await page.waitForTimeout(250);
    const named = await page.evaluate(
      () => (document.body.innerText.match(/sankhya/gi) ?? []).length,
    );
    await page.evaluate(REDACT);
    await page.screenshot({
      path: join(outDir, `${name}.${review ? "jpg" : "png"}`),
      ...(review ? { type: "jpeg", quality: 72 } : {}),
    });
    console.log(
      lang,
      name,
      res?.status(),
      new URL(page.url()).pathname,
      named ? `(ERP: ${named} trocas)` : "",
    );
  } catch (e) {
    console.log("FALHOU", lang, name, e.message.split("\n")[0]);
  }
}
await browser.close();
