// Ensaio exploratório dos capítulos 2 e 3 do Módulo 2 (não salva nada).
import fs from "node:fs";
import path from "node:path";
import { BASE, abrirEnsaio, entrar, restaurarPonto, pararServidor } from "../_pipeline/lib.mjs";
import { ARQUIVOS, HISTORIA } from "./caminho-fornecedor.mjs";

const OUT = process.argv[2] ?? "/tmp/explorar-m2c";
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
const foto = async (page, nome) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, "0")}-${nome}.png`) }); };
const texto = async (page, sel = "main") => (await page.locator(sel).first().innerText()).replace(/\n+/g, " | ");

await restaurarPonto("forn-m2-base");
const e = await abrirEnsaio();
const { page } = e;
try {
  await entrar(page, "supplier.a@china.com");
  // resposta da nº 1 (como no capítulo 1)
  await page.locator("main table tbody tr", { hasText: "Solicitação nº 1" }).getByRole("link", { name: /Abrir/ }).first().click();
  await page.locator("[data-supplier-table-open]").click(); await page.waitForURL(/view=item/);
  const r = HISTORIA.principal.resposta;
  await page.selectOption("[data-supplier-answer-cando]", { label: "Sim, faço" });
  await page.fill("[data-supplier-answer-price]", "2,25"); await page.fill('form:has([data-supplier-answer-submit]) input[name="moq"]', r.moq);
  await page.fill('input[name="leadTimeDays"]', r.prazoDias); await page.fill('form:has([data-supplier-answer-submit]) textarea[name="note"]', r.obs);
  await page.click("[data-supplier-answer-submit]"); await page.waitForURL(/answered=1/);
  await page.goto(`${BASE}/app`); await foto(page, "pendencias-depois-da-resposta");
  console.log("PENDÊNCIAS:", await page.locator("main table tbody tr").evaluateAll((els) => els.map((x) => x.innerText.replace(/\s+/g, " ").trim().slice(0, 110))));
  console.log("MENU:", await page.locator("aside a, aside button").evaluateAll((els) => els.map((x) => `${x.tagName}:${x.getAttribute("href") ?? ""}:${x.getAttribute("aria-expanded") ?? ""}:${x.innerText.replace(/\s+/g, " ").trim()}`)));
  // capítulo 2: lista, aprovar a nº 2, recusar a nº 3
  await page.goto(`${BASE}/app/supplier-requests`); await foto(page, "lista");
  console.log("LISTA:", await texto(page));
  await page.locator("main table tbody tr", { hasText: "Glass cup 350ml" }).locator("a").first().click(); await page.waitForLoadState("networkidle");
  await page.locator("[data-supplier-table-confirm]").click(); await foto(page, "aprovar-dialogo-2");
  await page.locator("dialog[open] [data-supplier-table-confirm-submit], [data-supplier-table-confirm-submit]:visible").first().click();
  await page.waitForLoadState("networkidle"); await foto(page, "aprovada-2"); console.log("APÓS APROVAR:", page.url(), "|", (await texto(page)).slice(0, 400));
  console.log("ÍCONES APÓS APROVAR:", await page.locator("main table tbody tr td:last-child button, main table tbody tr td:last-child a").evaluateAll((els) => els.map((x) => x.getAttribute("aria-label"))));
  await page.locator("a", { hasText: "Voltar às solicitações" }).click(); await page.waitForLoadState("networkidle");
  await page.locator("main table tbody tr", { hasText: "Glass bowl 500ml" }).locator("a").first().click(); await page.waitForLoadState("networkidle");
  const precisa = page.getByText(HISTORIA.recusada.precisa).first();
  await precisa.scrollIntoViewIfNeeded(); await foto(page, "tabela-3-rolada-precisa");
  console.log("CAIXA 'precisa':", await precisa.boundingBox());
  await page.locator("[data-supplier-table-refuse]").click(); await foto(page, "recusar-dialogo-3");
  await page.locator("[data-supplier-table-refuse-submit]:visible").first().click();
  await page.waitForLoadState("networkidle"); await foto(page, "recusada-3"); console.log("APÓS RECUSAR:", page.url(), "|", (await texto(page)).slice(0, 400));
  await page.goto(`${BASE}/app/supplier-requests`); await foto(page, "lista-depois"); console.log("LISTA DEPOIS:", await texto(page));
  // capítulo 3: conversa na nº 1
  await page.locator("main table tbody tr", { hasText: "Glass jar" }).locator("a").first().click(); await page.waitForLoadState("networkidle");
  await foto(page, "tabela-1-respondida");
  const vez = page.getByText(/Esperando a Wellmix/).first(); if (await vez.count()) { await vez.scrollIntoViewIfNeeded(); await foto(page, "tabela-1-vez"); }
  await page.locator("[data-supplier-table-open]").click(); await page.waitForURL(/view=item/);
  await page.click("[data-request-chat-toggle]");
  // mensagem vazia
  await page.click("[data-negotiation-message-submit]"); await page.waitForTimeout(700); await foto(page, "conversa-vazia-enviar"); console.log("APÓS ENVIAR VAZIO:", page.url());
  if (!(await page.locator("[data-negotiation-message-text]").isVisible())) await page.click("[data-request-chat-toggle]");
  // arquivo não aceito (vídeo)
  await page.locator("[data-negotiation-message-file]").setInputFiles(path.join(ARQUIVOS, "amostra-3d-video.mp4")); await page.waitForTimeout(500); await foto(page, "conversa-video-escolhido");
  await page.click("[data-negotiation-message-submit]"); await page.waitForLoadState("networkidle"); await page.waitForTimeout(600); await foto(page, "conversa-video-enviado"); console.log("APÓS VÍDEO:", page.url(), "|", (await texto(page)).slice(0, 300));
  if (!(await page.locator("[data-negotiation-message-text]").isVisible())) await page.click("[data-request-chat-toggle]");
  // mensagem com foto
  await page.fill("[data-negotiation-message-text]", HISTORIA.mensagem.texto);
  await page.locator("[data-negotiation-message-file]").setInputFiles(path.join(ARQUIVOS, HISTORIA.mensagem.arquivo)); await page.waitForTimeout(500); await foto(page, "conversa-pronta");
  await page.click("[data-negotiation-message-submit]"); await page.waitForLoadState("networkidle"); await page.waitForTimeout(800); await foto(page, "conversa-enviada"); console.log("APÓS MENSAGEM:", page.url());
  if (!(await page.locator("[data-negotiation-message-text]").isVisible())) { await page.click("[data-request-chat-toggle]"); await foto(page, "conversa-reaberta"); }
  console.log("CONVERSA:", await texto(page, "[data-request-chat-panel], [data-request-chat]").catch(() => "?"));
  console.log("GANCHOS data-request-chat*:", await page.locator("[data-request-chat-toggle], [data-request-chat-panel], [data-request-chat], [data-request-chat-close]").evaluateAll((els) => els.map((x) => `${x.tagName}:${[...x.attributes].filter((a) => a.name.startsWith("data-") || a.name.startsWith("aria-")).map((a) => a.name + "=" + a.value).join(",")}`)));
} finally { await e.fechar(); pararServidor(); }
