// Prepara o estado do Módulo 1 do Fornecedor e percorre as telas dele (em português)
// para escrever o roteiro com os textos reais.
import fs from "node:fs";
import path from "node:path";
import { BASE, abrirEnsaio, entrar, restaurarPonto, salvarPonto } from "../_pipeline/lib.mjs";
import { PLANILHAS } from "./preparo.mjs";

const OUT = process.argv[2] ?? "/tmp/explorar-fornecedor";
fs.mkdirSync(OUT, { recursive: true });
const foto = async (page, nome, full = false) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.screenshot({ path: path.join(OUT, `${nome}.png`), fullPage: full }); };
const textos = async (page, sel) => page.locator(sel).evaluateAll((els) => els.map((e) => (e.innerText || e.value || "").replace(/\s+/g, " ").trim()).filter(Boolean));

await restaurarPonto("aval-s4");
const e = await abrirEnsaio();
const { page } = e;
try {
  // Wellmix convida o fornecedor A a mandar o book de um copo com alça.
  await entrar(page, "operador@wellmix.com");
  await page.goto(`${BASE}/app/booking/selection?q=handle`);
  await page.locator("[data-selection-item]", { hasText: "GZ-C300" }).locator("[data-selection-invite]").click();
  await page.waitForURL(/\/app\/booking\/invite\//);
  await foto(page, "w1-convite-wellmix", true);
  const form = page.locator("[data-booking-invite-form]");
  await form.locator('[data-booking-invite-partner="fornecedor-a"] input').check();
  await form.locator("textarea[name=message]").fill("Copo de 300 ml com alça, em caixa colorida.");
  await page.click("[data-booking-invite-submit]");
  await page.waitForURL(/invited=1/);
  salvarPonto("forn-m1-base");

  await entrar(page, "supplier.a@china.com");
  await foto(page, "f1-pendencias");
  await foto(page, "f1-pendencias-inteiro", true);
  console.log("URL inicial:", page.url());
  console.log("PENDÊNCIAS títulos:", await textos(page, "main h1, main h2, main h3"));
  console.log("PENDÊNCIAS linhas:", await textos(page, "main table tbody tr"));
  console.log("ETAPAS:", await textos(page, "main [data-supplier-step], main ol li, main nav a"));
  for (const b of await page.locator("aside button[aria-expanded=false]").all()) await b.click().catch(() => {});
  await foto(page, "f2-menu-aberto");
  console.log("MENU:", await textos(page, "aside a, aside button"));
  await page.goto(`${BASE}/app/supplier-requests/invites`);
  await foto(page, "f3-convites");
  console.log("CONVITES:", await textos(page, "main h1, main p, main th, main td, main a, main button"));
  await page.locator('[data-booking-invite-row="open"]').first().locator("[data-booking-invite-open]").click();
  await page.waitForURL(/invites\/[^/?]+/);
  await foto(page, "f4-convite");
  await foto(page, "f4-convite-inteiro", true);
  console.log("CONVITE:", await textos(page, "main h1, main h2, main h3, main dt, main label, main button"));
  await page.locator("[data-booking-invite-answer-form] input[type=file]").setInputFiles(path.join(PLANILHAS, "book-convite-copo-com-alca.xlsx"));
  await foto(page, "f5-convite-arquivo");
  await page.click("[data-booking-invite-answer-submit]");
  await page.waitForURL(/answered=1/);
  await foto(page, "f6-convite-enviado");
  console.log("ENVIADO:", await textos(page, "main [data-booking-invite-answered], main .bg-emerald-50"));
  await page.goto(`${BASE}/app`);
  await foto(page, "f7-pendencias-depois");
  console.log("PENDÊNCIAS depois:", await textos(page, "main table tbody tr"));
  await page.goto(`${BASE}/app/notifications`);
  await foto(page, "f8-notificacoes");
  console.log("NOTIFICAÇÕES:", (await textos(page, "main h1, main li, main article, main button")).slice(0, 12));
  await page.goto(`${BASE}/app/messages`);
  await foto(page, "f9-mensagens");
  console.log("MENSAGENS:", (await textos(page, "main h1, main h2, main p, main button, main label")).slice(0, 12));
  await page.goto(`${BASE}/app/supplier-requests`);
  await foto(page, "f10-solicitacoes");
  console.log("SOLICITAÇÕES:", (await textos(page, "main h1, main p, main th")).slice(0, 14));
  // Menu do usuário (idioma, trocar senha, sair)
  await page.goto(`${BASE}/app`);
  console.log("RODAPÉ DO MENU:", await textos(page, "aside > :last-child a, aside > :last-child button, aside [data-user-role]"));
  console.log("CABEÇALHO:", await page.locator("header a, header button").evaluateAll((els) => els.map((x) => `${x.tagName}:${x.getAttribute("aria-label") || x.title || x.innerText}:${x.getAttribute("href") || ""}`)));
} finally { await e.fechar(); }
