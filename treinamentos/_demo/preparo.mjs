// Preparação de dados de demonstração (fora da gravação): cada função leva o portal de
// treino a um estado e pode salvar um ponto de salvamento. Tudo fictício, modo memória.
import path from "node:path";
import { BASE, DEMO, entrar } from "../_pipeline/lib.mjs";

export const PLANILHAS = path.join(DEMO, "planilhas");

/** Câmbio manual em Configurações (o do dia depende de sites públicos fora do alcance daqui). */
export async function cambioManual(page) {
  await entrar(page, "admin@wellmix.com");
  await page.goto(`${BASE}/app/settings`);
  const usd = page.locator('input[name="fxManualRates.USD"]');
  await usd.fill("5.5");
  await page.locator('input[name="fxManualRates.RMB"]').fill("0.78");
  await page.locator('input[name="fxManualRates.EUR"]').fill("6");
  await usd.evaluate((el) => el.form.requestSubmit());
  await page.waitForURL(/\/app\/settings\?ok=1/);
}

/** Sobe uma planilha de book e devolve o endereço do book em rascunho. */
export async function importarBook(page, arquivo) {
  await page.goto(`${BASE}/app/booking/import`);
  await page.locator("[data-booking-import-form] input[type=file]").setInputFiles(path.join(PLANILHAS, arquivo));
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  return page.url().split("?")[0];
}

/** Preenche o NCM que faltar (vidro de mesa: 7013.37.00) e fecha o book. */
export async function fecharBook(page, ncm = "7013.37.00") {
  const campos = page.locator("input[data-booking-item-ncm]");
  for (let i = 0; i < (await campos.count()); i++) {
    const campo = campos.nth(i);
    if (await campo.inputValue()) continue;
    await campo.fill(ncm);
    await campo.press("Enter");
    await page.locator('[data-booking-row-note="saved"]').nth(i).waitFor();
  }
  await page.click("[data-booking-lot-close-submit]");
  await page.waitForURL(/[?&]closed=1/);
}

/** O login passa a usar o portal em português (o seletor do cabeçalho grava no cadastro). */
export async function idiomaPortugues(page, email) {
  await entrar(page, email);
  await page.locator("header").getByRole("button", { name: "Português" }).click();
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Seleção de itens: busca, agrupa, escolhe o item e abre a solicitação ao fornecedor. */
export async function abrirSolicitacao(page, busca, codigoEscolhido, precisa) {
  await page.goto(`${BASE}/app/booking/selection?q=${encodeURIComponent(busca)}`);
  await page.locator("input[data-basket-all]").check();
  await page.click("[data-selection-group]");
  await page.waitForURL(/tab=selection&ids=/);
  await page.locator("[data-selection-item]", { hasText: codigoEscolhido }).locator("[data-selection-choose-button]").click();
  await page.fill("[data-selection-needs]", precisa);
  await page.click("[data-selection-submit]");
  await page.waitForURL(/[?&]saved=1/);
  await page.click("[data-selection-open-all]");
  await page.waitForURL(/\/app\/supplier-requests\/[^/?]+\?.*created=1/);
  return page.url().split("?")[0];
}

/** Convite de book: a Wellmix pede a um parceiro o book de um item parecido. */
export async function convidarParaBook(page, busca, codigoItem, parceiro, mensagem) {
  await page.goto(`${BASE}/app/booking/selection?q=${encodeURIComponent(busca)}`);
  await page.locator("[data-selection-item]", { hasText: codigoItem }).locator("[data-selection-invite]").click();
  await page.waitForURL(/\/app\/booking\/invite\//);
  const form = page.locator("[data-booking-invite-form]");
  await form.locator(`[data-booking-invite-partner="${parceiro}"] input`).check();
  await form.locator("textarea[name=message]").fill(mensagem);
  await page.click("[data-booking-invite-submit]");
  await page.waitForURL(/invited=1/);
}
