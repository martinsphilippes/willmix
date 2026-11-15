/*
 * Captura as telas reais do portal usadas nos vídeos, no idioma pedido, com o
 * portal em modo demonstração (base do E2E limpa por scrub.mjs):
 *   node shots.mjs <idioma> [nome1,nome2…] [--review pasta]
 * Grava film/shots/<idioma>/<nome>.png (2560 × 1600: janela de 1280 × 800 em
 * dobro, para os zooms continuarem nítidos). Com --review grava miniaturas.
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

/** nome → [conta, rota, opções]. `sel`: rola até esse bloco; `mobile`: celular. */
const O2 = () => `/app/orders/${order(2)}`;
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
  messages: ["admin", "/app/messages"],
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
const outDir = review ?? join(ROOT, "film/shots", lang);
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
    await page.waitForTimeout(250);
    await page.screenshot({
      path: join(outDir, `${name}.${review ? "jpg" : "png"}`),
      ...(review ? { type: "jpeg", quality: 72 } : {}),
    });
    console.log(lang, name, res?.status(), new URL(page.url()).pathname);
  } catch (e) {
    console.log("FALHOU", lang, name, e.message.split("\n")[0]);
  }
}
await browser.close();
