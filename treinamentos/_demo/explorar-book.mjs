// Exploração (só para escrever o roteiro com os textos reais): percorre o fluxo
// do book à solicitação e guarda capturas de cada tela.
import fs from "node:fs";
import path from "node:path";
import { BASE, abrirEnsaio, entrar, salvarPonto, subirServidor, zerarDados } from "../_pipeline/lib.mjs";
import { cambioManual, fecharBook, importarBook, PLANILHAS } from "./preparo.mjs";

const OUT = process.argv[2] ?? "/tmp/explorar-book";
fs.mkdirSync(OUT, { recursive: true });
const foto = async (page, nome, full = false) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.screenshot({ path: path.join(OUT, `${nome}.png`), fullPage: full }); };
const textos = async (page, sel) => page.locator(sel).evaluateAll((els) => els.map((e) => (e.innerText || e.value || "").replace(/\s+/g, " ").trim()).filter(Boolean));

await zerarDados();
const e = await abrirEnsaio();
const { page } = e;
try {
  await cambioManual(page);
  await entrar(page, "operador@wellmix.com");
  await importarBook(page, "book-guangzhou-supplier-b.xlsx");
  await fecharBook(page);
  salvarPonto("aval-base");

  await page.goto(`${BASE}/app/booking`);
  await foto(page, "01-books");
  console.log("BOOKS botões:", await textos(page, "main a, main button"));
  await page.goto(`${BASE}/app/booking/import`);
  await foto(page, "02-importar");
  console.log("IMPORTAR:", await textos(page, "main h1, main h2, main label, main button, main p"));
  await page.locator("[data-booking-import-form] input[type=file]").setInputFiles(path.join(PLANILHAS, "book-shenzhen-supplier-a.xlsx"));
  await foto(page, "03-importar-com-arquivo");
  console.log("IMPORTAR depois do arquivo:", await textos(page, "[data-booking-import-form] p, [data-booking-import-form] span"));
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  await foto(page, "04-book-rascunho");
  await foto(page, "04-book-rascunho-inteiro", true);
  console.log("BOOK rascunho títulos:", await textos(page, "main h1, main h2, main h3"));
  console.log("BOOK avisos:", await textos(page, "main [role=status], main [role=alert], main .bg-emerald-50, main .bg-amber-50"));
  console.log("BOOK botões:", await textos(page, "main button"));
  console.log("NCM campos:", await page.locator("input[data-booking-item-ncm]").evaluateAll((els) => els.map((x) => ({ v: x.value, ph: x.placeholder }))));
  await fecharBook(page);
  await foto(page, "05-book-fechado");
  await foto(page, "05-book-fechado-inteiro", true);
  console.log("BOOK fechado avisos:", await textos(page, "main .bg-emerald-50, main [role=status]"));
  salvarPonto("aval-book-fechado");

  await page.goto(`${BASE}/app/booking/selection`);
  await foto(page, "06-selecao");
  await foto(page, "06-selecao-inteiro", true);
  console.log("SELEÇÃO botões:", await textos(page, "main button, main a[role=tab], main [role=tab]"));
  await page.goto(`${BASE}/app/booking/selection?q=jar`);
  await foto(page, "07-selecao-busca");
  console.log("ITENS:", await page.locator("[data-selection-item]").count());
  await page.locator("input[data-basket-all]").check();
  await foto(page, "08-selecao-marcados");
  await page.click("[data-selection-group]");
  await page.waitForURL(/tab=selection&ids=/);
  await foto(page, "09-grupo");
  await foto(page, "09-grupo-inteiro", true);
  console.log("GRUPO botões:", await textos(page, "main button"));
  await page.locator("[data-selection-item]", { hasText: "SZ-JR15" }).locator("[data-selection-choose-button]").click();
  await foto(page, "10-escolhido");
  await foto(page, "10-escolhido-inteiro", true);
  await page.fill("[data-selection-needs]", "Caixa com a marca Wellmix e tampa na cor preta.");
  await foto(page, "11-precisa", true);
  await page.click("[data-selection-submit]");
  await page.waitForURL(/[?&]saved=1/);
  await foto(page, "12-blocos");
  await foto(page, "12-blocos-inteiro", true);
  console.log("BLOCOS botões:", await textos(page, "main button"));
  await page.click("[data-selection-open-all]");
  await page.waitForURL(/\/app\/supplier-requests\/[^/?]+\?.*created=1/);
  await foto(page, "13-solicitacao");
  await foto(page, "13-solicitacao-inteiro", true);
  console.log("SOLICITAÇÃO títulos:", await textos(page, "main h1, main h2, main h3"));
  console.log("URL:", page.url());
} finally { await e.fechar(); }
