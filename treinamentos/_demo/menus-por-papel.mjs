// Reconhecimento (só leitura): entra com cada conta de demonstração e registra
// o menu lateral real, a rota inicial e uma captura da primeira tela.
// Uso: node treinamentos/_demo/menus-por-papel.mjs [saida] (portal em http://localhost:3200)
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = process.argv[2] ?? "treinamentos/_demo/_build/menus";
const CONTAS = [
  "admin@wellmix.com", "operador@wellmix.com", "joao@lojista.com",
  "supplier.a@china.com", "supplier.b@china.com", "agencia@design.com",
  "despachante@comex.com", "armador@maritima.com", "transportadora@rodo.com",
  "comex@assessoria.com", "agente@cargo.com", "ocp@certifica.com",
  "agencia@marketing.cn", "juridico@wellmix.com",
];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const resumo = {};
for (const email of CONTAS) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "pt-BR" });
  // Idioma da tela em português (cookie do seletor) e abertura animada desligada.
  await ctx.addCookies([{ name: "wm_locale", value: "pt", url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login?intro=off`);
  await page.getByLabel(/e-mail|email|邮箱/i).fill(email);
  await page.getByLabel(/senha|password|密码/i).fill("wellmix123");
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await page.waitForURL(/\/app/);
  await page.waitForLoadState("networkidle");
  // Abre todos os grupos do menu lateral para ler os itens.
  const info = await page.evaluate(() => {
    const nav = document.querySelector("aside nav") ?? document.querySelector("nav");
    for (const b of nav?.querySelectorAll("button[aria-expanded=false]") ?? []) b.click();
    return { url: location.pathname, lang: document.documentElement.lang };
  });
  await page.waitForTimeout(300);
  const itens = await page.evaluate(() => {
    const nav = document.querySelector("aside nav") ?? document.querySelector("nav");
    const out = [];
    for (const el of nav?.querySelectorAll("a, button") ?? []) {
      const t = (el.innerText || "").replace(/\s+/g, " ").trim();
      if (t) out.push({ tag: el.tagName, texto: t, href: el.getAttribute("href") });
    }
    const rodape = [...document.querySelectorAll("aside a")].map((a) => a.getAttribute("href"));
    const papel = document.querySelector("[data-user-role]")?.textContent ?? null;
    return { out, rodape, papel };
  });
  const slug = email.replace(/[@.]/g, "_");
  await page.screenshot({ path: `${OUT}/${slug}.png` });
  resumo[email] = { inicio: info.url, idioma: info.lang, papel: itens.papel, menu: itens.out };
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/menus.json`, JSON.stringify(resumo, null, 2));
for (const [email, r] of Object.entries(resumo)) {
  console.log(`\n== ${email} · ${r.papel} · início ${r.inicio} · ${r.idioma}`);
  console.log(r.menu.map((m) => `${m.tag === "BUTTON" ? "▸" : " "} ${m.texto}${m.href ? "  " + m.href : ""}`).join("\n"));
}
