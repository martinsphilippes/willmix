// Reproduz o problema 002: depois de o fornecedor enviar o book do convite, o aviso do
// convite continua no sino como "Sua vez". Parte do ponto `forn-m1-s2` (book já enviado).
import path from "node:path";
import { BASE, TREINO, abrirEnsaio, entrar, restaurarPonto, pararServidor } from "../_pipeline/lib.mjs";

await restaurarPonto("forn-m1-s2");
const e = await abrirEnsaio();
const { page } = e;
try {
  await entrar(page, "supplier.a@china.com");
  await page.waitForLoadState("networkidle").catch(() => {});
  console.log("PENDÊNCIAS:", await page.locator("main table tbody tr").evaluateAll((els) => els.map((x) => x.innerText.replace(/\s+/g, " ").trim())));
  await page.goto(`${BASE}/app/supplier-requests/invites`);
  await page.waitForLoadState("networkidle").catch(() => {});
  console.log("CONVITES:", (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 600));
  await page.goto(`${BASE}/app`);
  await page.waitForLoadState("networkidle").catch(() => {});
  const sino = page.locator("header button[aria-label], header a[aria-label]").filter({ hasText: /^\d*$/ });
  console.log("BOTÕES DO TOPO:", await page.locator("header button, header a").evaluateAll((els) => els.map((x) => `${x.tagName}:${x.getAttribute("aria-label") ?? ""}:${x.innerText.trim()}`)));
  const b = page.locator('header [aria-label*="viso" i], header [aria-label*="otific" i]').first();
  await b.click();
  await page.waitForTimeout(800);
  console.log("AVISOS:", await page.locator('[role=dialog], [data-notifications], header + * ').first().innerText().catch(() => "?"));
  await page.screenshot({ path: path.join(TREINO, "_problemas", "002-aviso-do-convite-continua-sua-vez.png") });
} finally {
  await e.browser?.close?.(); await e.ctx?.close?.().catch(() => {});
  pararServidor();
}
