// Ensaio exploratório do Módulo 5 (não salva nada): o que a tela mostra quando o peso
// informado não bate com o esperado.
import path from "node:path";
import fs from "node:fs";
import { BASE, abrirEnsaio, entrar, restaurarPonto, pararServidor } from "../_pipeline/lib.mjs";
const OUT = process.argv[2] ?? "/tmp/explorar-m5"; fs.mkdirSync(OUT, { recursive: true });
const item = (page, rotulo) => page.locator(`main li:has(span.font-medium:text-is("${rotulo}"))`);
await restaurarPonto(process.argv[3] ?? "forn-m5-base");
const e = await abrirEnsaio(); const { page } = e;
try {
  await entrar(page, "supplier.a@china.com");
  await page.locator("main table tbody tr", { hasText: "Produção e inspeção" }).locator("a", { hasText: "Abrir" }).first().click();
  await page.waitForLoadState("networkidle");
  const peso = item(page, "Peso medido (kg)");
  await peso.locator('input[name="value"]').fill("6.2");
  await peso.locator("button[type=submit]").click(); await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
  console.log("URL:", page.url());
  console.log("ITEM PESO:", (await item(page, "Peso medido (kg)").innerText()).replace(/\s+/g, " "));
  const t = (await page.locator("main").innerText()).replace(/\n+/g, " | ");
  console.log("AVISOS:", [...t.matchAll(/[^|]*(ivergên|loquead|revisão|Nova medição|tolerân)[^|]*/g)].map((m) => m[0].trim()).slice(0, 8));
  await item(page, "Peso medido (kg)").scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(OUT, "peso-divergente.png") });
  const nova = page.locator("main a, main button", { hasText: "Nova medição" });
  console.log("NOVA MEDIÇÃO:", await nova.evaluateAll((els) => els.map((x) => `${x.tagName} ${x.getAttribute("href") ?? ""} ${[...x.attributes].filter((a) => a.name.startsWith("data-")).map((a) => a.name).join(",")}`)));
  await nova.first().click(); await page.waitForLoadState("networkidle"); await page.waitForTimeout(600);
  console.log("DEPOIS DE NOVA MEDIÇÃO:", page.url(), "|", (await item(page, "Peso medido (kg)").innerText().catch(() => "?")).replace(/\s+/g, " "));
  console.log("CAMPOS DO ITEM:", await item(page, "Peso medido (kg)").locator("input:not([type=hidden]), button, a").evaluateAll((els) => els.map((x) => `${x.tagName}:${x.getAttribute("name") ?? ""}:${x.innerText.trim()}`)));
  await item(page, "Peso medido (kg)").scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(OUT, "nova-medicao.png") });
  await page.goto(`${BASE}/app`); console.log("PENDÊNCIAS:", await page.locator("main table tbody tr").evaluateAll((els) => els.map((x) => x.innerText.replace(/\s+/g, " ").trim().slice(0, 160))));
} finally { await e.fechar(); pararServidor(); }
