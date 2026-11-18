// Abre um ponto de salvamento como o fornecedor e guarda capturas e ganchos de uma ou mais
// telas, para escrever o roteiro com os nomes reais. Não salva nada.
//   node _demo/explorar-ponto.mjs <ponto> <pasta-de-saida> [caminho|"abrir:<texto da pendência>"|"clicar:<seletor>"] ...
import fs from "node:fs";
import path from "node:path";
import { BASE, abrirEnsaio, entrar, restaurarPonto, pararServidor } from "../_pipeline/lib.mjs";

const [ponto, OUT, ...passos] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
const ganchos = (page, sel = "main") => page.locator(`${sel} button, ${sel} a, ${sel} input:not([type=hidden]), ${sel} select, ${sel} textarea, ${sel} summary`).evaluateAll((els) => els.filter((e) => e.offsetParent !== null || e.type === "file").map((e) => {
  const d = [...e.attributes].filter((a) => a.name.startsWith("data-") || ["name", "aria-label", "title", "type", "href", "value", "accept"].includes(a.name)).map((a) => `${a.name}=${JSON.stringify(a.value.slice(0, 70))}`).join(" ");
  return `<${e.tagName.toLowerCase()} ${d}> ${(e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 50)}`;
}));
const registrar = async (page, nome) => {
  await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(300);
  const base = path.join(OUT, `${String(++n).padStart(2, "0")}-${nome.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}`);
  await page.screenshot({ path: base + ".png" }); await page.screenshot({ path: base + "-inteira.png", fullPage: true });
  console.log(`\n=== ${nome} · ${page.url().replace(BASE, "")}`);
  console.log("TEXTO: " + (await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 3500));
  console.log("GANCHOS:\n" + (await ganchos(page)).join("\n"));
};

await restaurarPonto(ponto);
const e = await abrirEnsaio();
const { page } = e;
try {
  await entrar(page, "supplier.a@china.com");
  await registrar(page, "pendencias");
  for (const p of passos) {
    if (p.startsWith("abrir:")) await page.locator("main table tbody tr", { hasText: p.slice(6) }).locator("a", { hasText: "Abrir" }).first().click();
    else if (p.startsWith("clicar:")) await page.locator(p.slice(7)).first().click();
    else if (p.startsWith("rolar:")) { await page.getByText(p.slice(6)).first().scrollIntoViewIfNeeded(); }
    else if (p.startsWith("dom:")) {
      // Mostra a cadeia de elementos em volta de um texto (para escolher o seletor do alvo); não registra a tela.
      const cadeia = await page.getByText(p.slice(4)).first().evaluate((el) => {
        const linhas = [];
        for (let e = el; e && e.tagName !== "MAIN"; e = e.parentElement) {
          const r = e.getBoundingClientRect();
          const d = [...e.attributes].filter((a) => a.name.startsWith("data-") || a.name === "id").map((a) => `${a.name}=${JSON.stringify(a.value.slice(0, 40))}`).join(" ");
          linhas.push(`<${e.tagName.toLowerCase()} ${d}> ${Math.round(r.width)}x${Math.round(r.height)} filhos=${e.children.length} class="${(e.getAttribute("class") || "").slice(0, 70)}" :: ${(e.innerText || "").replace(/\s+/g, " ").slice(0, 60)}`);
        }
        return linhas;
      });
      console.log(`\nDOM em volta de "${p.slice(4)}":\n` + cadeia.join("\n"));
      continue;
    }
    else await page.goto(BASE + p);
    await registrar(page, p);
  }
} finally { await e.fechar(); pararServidor(); }
