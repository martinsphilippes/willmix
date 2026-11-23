import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * O produto neste pedido (dono, 23/11/2026; docs/REQUEST_SHEET.md, seção 7):
 * a tela de um produto mostra só ele, mesmo quando o pedido tem vários (os
 * outros ficam na página do pedido). Sem tabela: no alto, a foto e os números
 * principais; embaixo, um quadro por grupo (Produto, Embalagem e cubagem,
 * Valores e Pagamento), com a origem de cada dado; a conversa fica à vista na
 * lateral. Sem dado: "—". Cada perfil vê o que já via: custo e compra só com
 * "Ver preço de compra"; o cliente, o que a solicitação dele gravou e a venda.
 *
 * Cadastro de demonstração: a boneca tem 48 peças por caixa master, caixa de
 * 52 × 34 × 68 cm (0,1202 m³) e custo de US$ 3,20; a piscina, 6 por caixa.
 */

const row = (page: Page, n: number) =>
  page.locator(`[data-request-item="${n}"]`);

async function pick(page: Page, n: number, search: string, id: string) {
  const picker = row(page, n).locator('[data-product-picker="catalog"]');
  await picker.locator("[data-product-picker-input]").fill(search);
  await picker.locator(`[data-product-picker-option="${id}"]`).click();
  await expect(row(page, n).locator('[role="status"]').first()).toBeVisible();
}

/** Programações do pedido (bloco "Programação de compra do pedido"). */
async function setPlan(page: Page, count: string) {
  const input = page.locator("[data-order-plan-count]");
  await input.fill(count);
  await input.blur();
}

/** O gerador do produto reparte o total de caixas nas datas do pedido. */
async function generate(page: Page, n: number, cartons: string) {
  const gen = row(page, n).locator("[data-rounds-generator]");
  await gen.locator("[data-generate-total]").fill(cartons);
  await gen.locator("[data-generate-submit]").click();
}

const current = (page: Page) =>
  page.locator("[data-sheet-row][data-sheet-current]");
const cell = (page: Page, key: string) =>
  current(page).locator(`[data-sheet-cell="${key}"]`);
const field = (page: Page, key: string) =>
  current(page).locator(`[data-sheet-field="${key}"]`);

/** A página não rola de lado (nada cortado) na largura atual. */
async function noSideScroll(page: Page) {
  const extra = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(extra).toBeLessThanOrEqual(1);
}

test("Produto no pedido: só ele na tela, em quadros, com a conversa à vista, permissões e telas estreitas", async ({
  page,
}) => {
  // 1. O cliente pede dois produtos de uma vez, num pedido em 2
  // programações (as datas são do pedido): a boneca com 300 caixas (150 +
  // 150 = 14.400 peças) e a piscina com 50 (25 + 25 = 300 peças).
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  await pick(page, 0, "boneca", "prod-boneca");
  await setPlan(page, "2");
  await expect(row(page, 0).locator("[data-schedule-item]")).toHaveCount(2);
  await generate(page, 0, "300");
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("14400");
  await page.click("[data-add-request-item]");
  await pick(page, 1, "piscina", "prod-piscina");
  await expect(row(page, 1).locator("[data-schedule-item]")).toHaveCount(2);
  await generate(page, 1, "50");
  await expect(page.locator('input[name="p1.quantity"]')).toHaveValue("300");
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await page.waitForURL(/\/app\/requests\/batch\/[^?]+\?created=2$/);
  await page
    .locator(
      "[data-batch-item]:has-text('Boneca articulada') a[href^='/app/requests/']",
    )
    .first()
    .click();
  await page.waitForURL(/\/app\/requests\/(?!new|batch)[^/?]+$/);
  const url = page.url();

  // 2. Cliente: só este produto na tela (o pedido tem dois; o outro fica
  // na página do pedido), com o total da programação; sem caixa, cubagem,
  // custo nem compra (é da Wellmix). Sem dado: "—".
  const sheet = page.locator("[data-request-sheet]");
  await expect(sheet).toHaveAttribute("data-sheet-mode", "product");
  await expect(page.locator("[data-sheet-row]")).toHaveCount(1);
  await expect(sheet).not.toContainText("Piscina");
  await expect(page.locator("[data-batch-siblings]")).toContainText("Piscina");
  await expect(cell(page, "pieces")).toContainText("14.400 peças");
  await expect(cell(page, "pieces")).toContainText("Programação");
  for (const key of ["boxes", "cbm", "cost", "purchase"])
    await expect(cell(page, key)).toHaveCount(0);
  await expect(cell(page, "sale")).toContainText("—");
  await expect(
    cell(page, "sale").locator("[data-sheet-missing]"),
  ).toHaveAttribute("title", "Não informado");
  // A programação de compra continua na tela, com o mesmo total.
  await expect(page.locator("[data-request-schedule-table]")).toContainText(
    "14.400",
  );
  // Os quatro grupos em quadros, já abertos (sem "Ver ficha completa").
  await expect(page.locator('[data-sheet-mode-link="full"]')).toHaveCount(0);
  await expect(
    page.locator("[data-sheet-full] [data-sheet-group]"),
  ).toHaveCount(4);
  await expect(field(page, "measure.0")).toContainText(
    "Comprimento 12 cm · Largura 8 cm · Altura 32 cm",
  );
  await expect(field(page, "perBox")).toContainText("48");
  await expect(field(page, "perBox")).toContainText("Solicitação");
  await expect(current(page).locator("[data-sheet-thumb]")).toHaveCount(1);
  // A conversa à vista na lateral, com o botão de conversar.
  const chat = page.locator("[data-request-side] [data-request-chat]");
  await expect(chat).toBeVisible();
  await expect(chat.locator("[data-chat-floating-open]")).toBeVisible();
  // Valores: só a venda; Pagamento: só o do cliente.
  await expect(field(page, "saleUnit")).toHaveCount(1);
  await expect(field(page, "quote")).toHaveCount(0);
  await expect(field(page, "saleTerms")).toHaveCount(1);
  await expect(field(page, "terms")).toHaveCount(0);
  await expect(current(page)).not.toContainText("Ficha atual");
  await expect(current(page)).not.toContainText("3,20");

  // 3. Celular: os quadros um embaixo do outro; a página não rola de lado.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await expect(cell(page, "pieces")).toBeVisible();
  await expect(page.locator("[data-sheet-full]")).toBeVisible();
  await noSideScroll(page);

  // 4. Administrador (vê valores): caixas e cubagem calculadas, custo da
  // ficha atual, compra e venda ainda não informadas.
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, "admin@wellmix.com");
  await page.goto(url);
  await expect(current(page)).toContainText("BRQ-001");
  await expect(cell(page, "boxes")).toContainText("300 caixas");
  await expect(cell(page, "boxes")).toContainText("Calculado");
  await expect(cell(page, "cbm")).toContainText("36,06 m³");
  await expect(cell(page, "cost")).toContainText("US$ 3,20");
  await expect(cell(page, "cost")).toContainText("Ficha atual");
  await expect(cell(page, "purchase")).toContainText("—");
  await expect(field(page, "sku")).toContainText("Ficha atual");
  // O cadastro grava o CBM da caixa (das medidas, ao salvar): gravado, não calculado.
  await expect(field(page, "cbmPerBox")).toContainText("0,1202 m³");
  await expect(field(page, "cbmPerBox")).toContainText("Ficha atual");
  await expect(field(page, "cbmTotal")).toContainText("300 caixas × 0,1202 m³");
  await expect(field(page, "negotiated")).toContainText("—");
  await expect(field(page, "supplier")).toContainText("Guangzhou Supplier B");
  await expect(field(page, "terms")).toContainText("—");
  // 5. iPad: os quadros cabem na tela; a página não rola de lado.
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.reload();
  await expect(field(page, "cost")).toBeVisible();
  await noSideScroll(page);

  // 6. Comprador (operador: "Ver preço de compra", sem "Ver valores e
  // margem"; dono, 15/11/2026, docs/LINHA_DE_VISAO.md): vê o custo
  // registrado e a compra; a venda, não.
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, "operador@wellmix.com");
  await page.goto(url);
  await expect(cell(page, "boxes")).toContainText("300 caixas");
  await expect(cell(page, "cost")).toContainText("US$ 3,20");
  await expect(cell(page, "purchase")).toHaveCount(1);
  await expect(cell(page, "sale")).toHaveCount(0);

  // 7. Vendas (sem "Ver preço de compra"): a ficha técnica, sem custo,
  // compra, venda nem condições; o aviso de quem vê fica embaixo da tabela.
  await login(page, "vendas@wellmix.com");
  await page.goto(url);
  await expect(cell(page, "boxes")).toContainText("300 caixas");
  for (const key of ["cost", "purchase", "sale"])
    await expect(cell(page, key)).toHaveCount(0);
  await expect(page.locator('[data-sheet-restricted="values"]')).toContainText(
    "Ver preço de compra",
  );
  await expect(
    page.locator("[data-sheet-full] [data-sheet-group]"),
  ).toHaveCount(2);
  await expect(current(page)).not.toContainText("3,20");
});
