// Ensaio exploratório do Módulo 4 (não salva nada): Die Cut depois do envio, prazo inválido,
// contrato antes da assinatura da Wellmix, aceite das amostras sem o "li e concordo".
import fs from "node:fs";
import path from "node:path";
import { BASE, abrirEnsaio, entrar, restaurarPonto, pararServidor } from "../_pipeline/lib.mjs";
import { ARQUIVOS } from "./caminho-fornecedor.mjs";

const OUT = process.argv[2] ?? "/tmp/explorar-m4";
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
const foto = async (page, nome) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, "0")}-${nome}.png`), fullPage: true }); };
const texto = async (page, sel = "main") => (await page.locator(sel).first().innerText()).replace(/\n+/g, " | ");
const ganchos = (page, sel) => page.locator(`${sel} button, ${sel} a, ${sel} input:not([type=hidden]), ${sel} label`).evaluateAll((els) => els.map((e) => `<${e.tagName.toLowerCase()} ${[...e.attributes].filter((a) => a.name.startsWith("data-") || ["name", "aria-label", "title", "type", "min", "max", "required"].includes(a.name)).map((a) => `${a.name}=${JSON.stringify(a.value.slice(0, 50))}`).join(" ")}> ${(e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40)}`));

await restaurarPonto("forn-m4-diecut");
let e = await abrirEnsaio();
let { page } = e;
try {
  await entrar(page, "supplier.a@china.com");
  await page.locator("main table tbody tr", { hasText: "Die Cut" }).locator("a", { hasText: "Abrir" }).first().click();
  await page.waitForURL(/die-cut/);
  const pedido = page.url().match(/orders\/([^/]+)/)[1];
  console.log("ITENS:", await page.locator("[data-die-cut-item]").evaluateAll((els) => els.map((x) => `${x.getAttribute("data-die-cut-item")}:${x.getAttribute("data-done")}`)));
  // prazo inválido
  const termos = page.locator('[data-die-cut-item="terms"] [data-die-cut-terms]');
  console.log("CAMPOS DOS TERMOS:", await ganchos(page, '[data-die-cut-item="terms"]'));
  await termos.locator("input[name=leadTimeDays]").fill("0");
  await termos.locator("button[type=submit]").click(); await page.waitForTimeout(900); await foto(page, "prazo-zero");
  console.log("APÓS PRAZO 0:", page.url(), "|", (await texto(page)).slice(0, 500));
  await page.goto(`${BASE}/app/orders/${pedido}/die-cut`);
  await page.locator('[data-die-cut-item="dieline"] input[type=file]').last().setInputFiles(path.join(ARQUIVOS, "faca-caixa-pote-1500ml.pdf"));
  await page.waitForURL(/saved=dieline/); await foto(page, "faca-enviada");
  console.log("APÓS FACA:", (await texto(page)).slice(0, 700));
  console.log("GANCHOS DO ITEM FACA:", await ganchos(page, '[data-die-cut-item="dieline"]'));
  await page.locator('[data-die-cut-item="hd"] input[type=file]').last().setInputFiles(path.join(ARQUIVOS, "foto-alta-pote-1500ml.jpg"));
  await page.waitForURL(/saved=hd/); await foto(page, "foto-enviada");
  console.log("GANCHOS DO ITEM FOTO:", await ganchos(page, '[data-die-cut-item="hd"]'));
  await page.locator('[data-die-cut-item="terms"] [data-die-cut-terms] button[type=submit]').click(); await page.waitForURL(/saved=terms/); await foto(page, "termos-confirmados");
  console.log("COMPLETO:", (await texto(page)).slice(0, 900));
  console.log("GANCHOS DOS TERMOS DEPOIS:", await ganchos(page, '[data-die-cut-item="terms"]'));
  // contrato antes da assinatura da Wellmix: pelo menu Pedidos
  await page.goto(`${BASE}/app/orders`); await foto(page, "pedidos-lista");
  console.log("PEDIDOS:", (await texto(page)).slice(0, 700));
  console.log("LINKS PEDIDOS:", await page.locator("main table tbody tr a").evaluateAll((els) => els.map((a) => a.getAttribute("href") + " · " + a.innerText.trim())));
  await page.goto(`${BASE}/app/orders/${pedido}/purchase-order`); await foto(page, "contrato-antes-da-wellmix");
  console.log("CONTRATO ANTES:", (await texto(page)).slice(0, 900));
  console.log("PENDÊNCIAS DEPOIS DO DIE CUT:", await page.goto(`${BASE}/app`).then(() => page.locator("main table tbody tr").evaluateAll((els) => els.map((x) => x.innerText.replace(/\s+/g, " ").trim().slice(0, 120)))));
} finally { await e.fechar(); }

await restaurarPonto("forn-m4-contrato");
e = await abrirEnsaio(); page = e.page;
try {
  await entrar(page, "supplier.a@china.com");
  await page.locator("main table tbody tr", { hasText: "Aprovar a arte" }).locator("a", { hasText: "Abrir" }).first().click();
  await page.waitForLoadState("networkidle"); await foto(page, "pedido-pela-pendencia-arte"); console.log("ABRIR 'Aprovar a arte' leva a:", page.url());
  await page.locator('a[data-sample-order-link="sample_order_supplier"]').click(); await page.waitForURL(/samples/);
  const form = page.locator("form[data-sample-order-accept]");
  console.log("ACEITE:", await ganchos(page, "form[data-sample-order-accept]"));
  await form.locator("input[name=name]").fill("Li Wei");
  await form.locator("button[type=submit]").click(); await page.waitForTimeout(900); await foto(page, "aceite-sem-concordo");
  console.log("APÓS ACEITAR SEM MARCAR:", page.url(), "|", (await texto(page)).slice(0, 400));
  await page.goto(page.url().split("?")[0]);
  await form.locator("input[name=name]").fill("Li Wei"); await form.locator("input[name=agree]").check();
  await form.locator("button[type=submit]").click(); await page.waitForURL(/accepted=1/); await foto(page, "aceite-feito");
  console.log("ACEITO:", (await texto(page)).slice(0, 500));
  await page.goto(`${BASE}/app`); console.log("PENDÊNCIAS DEPOIS DO ACEITE:", await page.locator("main table tbody tr").evaluateAll((els) => els.map((x) => x.innerText.replace(/\s+/g, " ").trim().slice(0, 120))));
  await page.locator("main table tbody tr", { hasText: "Assinar o pedido" }).locator("a", { hasText: "Abrir" }).first().click(); await page.waitForURL(/purchase-order/);
  await foto(page, "contrato-para-assinar");
  console.log("PDF:", await page.locator("[data-order-pdf-step]").evaluate((a) => ({ href: a.getAttribute("href"), target: a.target, download: a.download })));
  console.log("GANCHOS ASSINAR:", await ganchos(page, "[data-order-sign-file]"));
  await page.locator("[data-order-sign-file] input[type=file]").setInputFiles(path.join(ARQUIVOS, "contrato-assinado-e-carimbado.pdf"));
  await page.waitForURL(/signed=1/); await foto(page, "contrato-assinado");
  console.log("ASSINADO:", (await texto(page)).slice(0, 700));
} finally { await e.fechar(); pararServidor(); }
