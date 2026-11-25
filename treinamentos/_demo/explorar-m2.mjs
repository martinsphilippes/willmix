// Percorre as telas da solicitação como o fornecedor (sem gravar nada) e guarda capturas
// e textos para escrever o roteiro do Módulo 2 com os nomes reais.
import fs from "node:fs";
import path from "node:path";
import { BASE, abrirEnsaio, entrar, restaurarPonto, pararServidor } from "../_pipeline/lib.mjs";

const OUT = process.argv[2] ?? "/tmp/explorar-m2";
const PONTO = process.argv[3] ?? "forn-m2-base";
fs.mkdirSync(OUT, { recursive: true });
const foto = async (page, nome, full = true) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.screenshot({ path: path.join(OUT, `${nome}.png`), fullPage: full }); };
const ganchos = (page, sel = "main") => page.locator(`${sel} button, ${sel} a, ${sel} input, ${sel} select, ${sel} textarea, ${sel} summary`).evaluateAll((els) => els.map((e) => {
  const d = [...e.attributes].filter((a) => a.name.startsWith("data-") || ["name", "aria-label", "title", "type", "href", "value"].includes(a.name)).map((a) => `${a.name}=${JSON.stringify(a.value.slice(0, 60))}`).join(" ");
  return `<${e.tagName.toLowerCase()} ${d}> ${(e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60)}`;
}));

await restaurarPonto(PONTO);
const e = await abrirEnsaio();
const { page } = e;
try {
  await entrar(page, "supplier.a@china.com");
  await foto(page, "01-pendencias");
  console.log("PENDÊNCIAS:\n" + (await page.locator("main table tbody tr").evaluateAll((els) => els.map((x) => " - " + x.innerText.replace(/\s+/g, " ").trim()))).join("\n"));
  await page.goto(`${BASE}/app/supplier-requests`);
  await foto(page, "02-lista");
  console.log("LISTA:\n" + (await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 1500));
  console.log("GANCHOS LISTA:\n" + (await ganchos(page)).join("\n"));
  const links = await page.locator("main table tbody tr a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
  console.log("LINKS:", links);
  const primeiro = links.find((h) => /supplier-requests\/[^/?]+$/.test(h ?? ""));
  // a solicitação nº 1 (a mais antiga): procura pelo texto do item
  const linha1 = page.locator("main table tbody tr", { hasText: "Glass jar" });
  const href1 = await linha1.locator("a").first().getAttribute("href");
  await page.goto(BASE + href1);
  await foto(page, "03-solicitacao-1");
  console.log("SOLICITAÇÃO 1 URL:", page.url());
  console.log("SOLICITAÇÃO 1 TEXTO:\n" + (await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 4000));
  console.log("GANCHOS SOLICITAÇÃO:\n" + (await ganchos(page)).join("\n"));
  fs.writeFileSync(path.join(OUT, "03-solicitacao-1.html"), await page.locator("main").innerHTML());
  await page.goto(BASE + href1 + "?view=item");
  await foto(page, "04-produto-1");
  console.log("PRODUTO 1 TEXTO:\n" + (await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 5000));
  console.log("GANCHOS PRODUTO:\n" + (await ganchos(page)).join("\n"));
  fs.writeFileSync(path.join(OUT, "04-produto-1.html"), await page.locator("main").innerHTML());
} finally { await e.fechar(); pararServidor(); }
