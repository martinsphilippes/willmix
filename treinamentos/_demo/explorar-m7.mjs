// Ensaio exploratório do Módulo 7 (não salva nada): check list em dois lançamentos, packing
// list, invoice que não bate e invoice certa.
import fs from "node:fs";
import path from "node:path";
import { BASE, abrirEnsaio, entrar, restaurarPonto, pararServidor } from "../_pipeline/lib.mjs";
import { ARQUIVOS, HISTORIA } from "./caminho-fornecedor.mjs";
const OUT = process.argv[2] ?? "/tmp/explorar-m7"; fs.mkdirSync(OUT, { recursive: true });
let n = 0;
const foto = async (page, nome) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, "0")}-${nome}.png`), fullPage: true }); };
const doc = async (page, tipo) => (await page.locator(`[data-shipping-doc=${tipo}]`).innerText()).replace(/\n+/g, " | ");
const campos = (page, tipo) => page.locator(`[data-shipping-doc=${tipo}] input:not([type=hidden]), [data-shipping-doc=${tipo}] button, [data-shipping-doc=${tipo}] a`).evaluateAll((els) => els.map((x) => `${x.tagName.toLowerCase()}[${x.getAttribute("name") ?? ""}|${x.type ?? ""}|${x.getAttribute("aria-label") ?? ""}|v=${x.value ?? ""}|${x.required ? "req" : ""}] ${x.innerText.trim().slice(0, 30)}`));
await restaurarPonto("forn-m7-base");
const e = await abrirEnsaio(); const { page } = e;
const d = HISTORIA.documentos;
try {
  await entrar(page, "supplier.a@china.com");
  await page.locator("main table tbody tr", { hasText: "Check list de carga" }).locator("a", { hasText: "Abrir" }).first().click(); await page.waitForURL(/shipping-docs/);
  const url = page.url().split("#")[0].split("?")[0];
  console.log("ATRIBUTOS:", await page.locator("[data-shipping-doc]").evaluateAll((els) => els.map((x) => `${x.getAttribute("data-shipping-doc")}:${x.querySelector("[data-shipping-status]")?.getAttribute("data-shipping-status")}:${x.id}`)));
  const form = page.locator("form[data-shipping-load-form]");
  await form.locator('input[name^="add_"]').fill("250"); await form.locator("button[type=submit]").click(); await page.waitForTimeout(900); await foto(page, "caixas-a-mais");
  console.log("CAIXAS A MAIS:", page.url().replace(BASE, ""), "|", (await doc(page, "load")).slice(0, 500));
  await page.goto(url); await form.locator('input[name^="add_"]').fill("120"); await form.locator("button[type=submit]").click(); await page.waitForURL(/done=load/); await foto(page, "caixas-120");
  console.log("APÓS 120:", (await doc(page, "load")).slice(0, 500)); console.log("PACKING APÓS 120:", (await doc(page, "packing_list")).slice(0, 200));
  await page.goto(url); await form.locator('input[name^="add_"]').fill("80"); await form.locator("button[type=submit]").click(); await page.waitForURL(/done=load/); await foto(page, "caixas-200");
  console.log("APÓS 200:", (await doc(page, "load")).slice(0, 600));
  console.log("PACKING:", (await doc(page, "packing_list")).slice(0, 800)); console.log("CAMPOS PACKING:", await campos(page, "packing_list"));
  const pk = page.locator("form[data-shipping-form=packing_list]");
  for (const [c, v] of [["pieces", d.pecas], ["netKg", d.pesoLiquidoKg], ["grossKg", d.pesoBrutoKg]]) await pk.locator(`[data-doc-line] input[name^="${c}_"]:not([type=hidden])`).fill(String(v));
  await pk.locator("input[type=file]").setInputFiles(path.join(ARQUIVOS, d.packingList));
  await pk.locator("button[type=submit]").click(); await page.waitForURL(/done=packing_list/); await foto(page, "packing-enviado");
  console.log("PACKING DEPOIS:", (await doc(page, "packing_list")).slice(0, 500));
  console.log("INVOICE:", (await doc(page, "invoice")).slice(0, 800)); console.log("CAMPOS INVOICE:", await campos(page, "invoice"));
  const inv = page.locator("form[data-shipping-form=invoice]");
  const preencher = async (pecas) => { for (const [c, v] of [["cartons", d.caixas], ["pieces", pecas], ["netKg", d.pesoLiquidoKg], ["grossKg", d.pesoBrutoKg], ["unitPrice", d.precoPorPeca]]) { const i = inv.locator(`[data-doc-line] input[name^="${c}_"]:not([type=hidden])`); if (await i.count()) await i.fill(String(v)); }
    await inv.locator("input[name=number]").fill(d.invoiceNumero); await inv.locator("input[type=file]").setInputFiles(path.join(ARQUIVOS, d.invoice)); };
  await preencher(2300); await inv.locator("button[type=submit]").click(); await page.waitForLoadState("networkidle"); await page.waitForTimeout(900); await foto(page, "invoice-nao-bateu");
  console.log("INVOICE ERRADA:", page.url().replace(BASE, ""), "|", (await doc(page, "invoice")).slice(0, 900)); console.log("CAMPOS INVOICE DEPOIS DO ERRO:", await campos(page, "invoice"));
  await page.goto(url); await preencher(d.pecas); await inv.locator("button[type=submit]").click(); await page.waitForURL(/done=invoice/); await foto(page, "invoice-conferida");
  console.log("INVOICE CERTA:", (await doc(page, "invoice")).slice(0, 500)); console.log("BL:", (await doc(page, "bl")).slice(0, 300));
  await page.goto(`${BASE}/app`); console.log("PENDÊNCIAS:", await page.locator("main table tbody tr").evaluateAll((els) => els.map((x) => x.innerText.replace(/\s+/g, " ").trim().slice(0, 120))));
} finally { await e.fechar(); pararServidor(); }
