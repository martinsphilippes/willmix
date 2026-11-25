// Ensaio exploratório do Módulo 2 (não salva nada): faz as ações do fornecedor na
// solicitação e guarda uma captura de cada momento, para o roteiro sair com a tela real.
import fs from "node:fs";
import path from "node:path";
import { BASE, abrirEnsaio, entrar, restaurarPonto, pararServidor } from "../_pipeline/lib.mjs";
import { ARQUIVOS } from "./caminho-fornecedor.mjs";

const OUT = process.argv[2] ?? "/tmp/explorar-m2b";
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
const foto = async (page, nome) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, "0")}-${nome}.png`) }); };
const avisos = (page) => page.locator("main [role=status], main [role=alert], main .bg-emerald-50, main .bg-red-50, main .bg-amber-50").evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()).filter(Boolean));

await restaurarPonto("forn-m2-base");
const e = await abrirEnsaio();
const { page } = e;
try {
  await entrar(page, "supplier.a@china.com");
  // 1. Pendências → Abrir na solicitação nº 1
  await page.locator("main table tbody tr", { hasText: "Solicitação nº 1" }).getByRole("link", { name: /Abrir/ }).first().click();
  await page.waitForLoadState("networkidle"); console.log("ABRIR leva a:", page.url());
  await foto(page, "abrir-da-pendencia");
  const id1 = page.url().match(/supplier-requests\/([^/?#]+)/)[1];
  await page.goto(`${BASE}/app/supplier-requests/${id1}`);
  await page.locator("summary", { hasText: "Mais detalhes" }).click(); await foto(page, "tabela-mais-detalhes");
  await page.locator("[data-supplier-table-sla-toggle]").click(); await foto(page, "tabela-sla-aberto");
  console.log("LARGURA DA TABELA:", await page.locator("main table").first().evaluate((t) => ({ rolavel: t.parentElement.scrollWidth, visivel: t.parentElement.clientWidth })));
  console.log("CABEÇALHOS:", await page.locator("main table thead th").allInnerTexts());
  // 2. Diálogos da tabela (abre e fecha)
  await page.locator("[data-supplier-table-confirm]").click(); await foto(page, "dialogo-aprovar");
  console.log("DIÁLOGO APROVAR:", (await page.locator("dialog[open], [role=dialog]").first().innerText().catch(() => "?")).replace(/\n+/g, " | "));
  await page.locator("[data-supplier-table-confirm-cancel]").click();
  await page.locator("[data-supplier-table-answer-open]").click(); await foto(page, "dialogo-renegociar");
  console.log("DIÁLOGO RENEGOCIAR:", (await page.locator("dialog[open], [role=dialog]").first().innerText().catch(() => "?")).replace(/\n+/g, " | "));
  await page.keyboard.press("Escape");
  await page.locator("[data-supplier-table-refuse]").click(); await foto(page, "dialogo-recusar");
  console.log("DIÁLOGO RECUSAR:", (await page.locator("dialog[open], [role=dialog]").first().innerText().catch(() => "?")).replace(/\n+/g, " | "));
  await page.locator("[data-supplier-table-refuse-cancel]").click();
  await page.locator("[data-supplier-table-message]").click(); await foto(page, "dialogo-mensagem");
  console.log("DIÁLOGO MENSAGEM:", (await page.locator("dialog[open], [role=dialog]").first().innerText().catch(() => "?")).replace(/\n+/g, " | "));
  await page.keyboard.press("Escape");
  // 3. Tela do produto: erro sem preço, depois a resposta completa
  await page.locator("[data-supplier-table-open]").click(); await page.waitForURL(/view=item/); console.log("PRODUTO URL:", page.url());
  await page.selectOption("[data-supplier-answer-cando]", { label: "Sim, faço" });
  console.log("PREÇO required?", await page.locator("[data-supplier-answer-price]").evaluate((el) => ({ required: el.required, type: el.type, inputmode: el.inputMode, placeholder: el.placeholder })));
  await page.click("[data-supplier-answer-submit]"); await foto(page, "erro-sem-preco"); console.log("URL após enviar sem preço:", page.url(), "AVISOS:", await avisos(page));
  await page.selectOption("[data-supplier-answer-cando]", { label: "Sim, faço" });
  await page.fill("[data-supplier-answer-price]", "2,25"); await page.fill('input[name="moq"]', "1200"); await page.fill('input[name="leadTimeDays"]', "35");
  await page.fill('textarea[name="note"]', "Tampa preta e caixa com a marca: USD 2,25 por peça."); await foto(page, "resposta-preenchida");
  await page.click("[data-supplier-answer-submit]"); await page.waitForLoadState("networkidle"); await foto(page, "resposta-enviada");
  console.log("URL após resposta:", page.url(), "AVISOS:", await avisos(page));
  console.log("PRODUTO DEPOIS:\n" + (await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 2500));
  // 4. Conversa flutuante: arquivo não aceito e mensagem com foto
  await page.click("[data-request-chat-toggle]"); await foto(page, "conversa-aberta");
  const chat = page.locator("[data-request-chat], [data-request-chat-panel], dialog[open], [role=dialog]").first();
  console.log("CONVERSA:", (await chat.innerText().catch(() => "?")).replace(/\n+/g, " | "));
  console.log("CONVERSA GANCHOS:", await page.locator("form:has([data-request-chat-text]), form:has(textarea[name=text])").last().locator("input, textarea, button").evaluateAll((els) => els.map((x) => `<${x.tagName.toLowerCase()} ${[...x.attributes].map((a) => `${a.name}=${JSON.stringify(a.value.slice(0, 50))}`).join(" ")}>`)));
  fs.writeFileSync(path.join(OUT, "conversa.html"), await page.locator("body").innerHTML());
} finally { await e.fechar(); pararServidor(); }
