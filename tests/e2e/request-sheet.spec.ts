import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Ficha completa da solicitação (dono, 15/11/2026; docs/REQUEST_SHEET.md):
 * na seção "Solicitações", uma linha por produto (a solicitação com vários
 * produtos mostra todos) com os dados principais e "Ver ficha completa" na
 * própria linha; a ficha abre na largura do cartão em quatro grupos e não
 * corta nada no iPad nem no celular. Cada perfil vê o que já via: custo e
 * compra só para quem vê valores; o cliente, o que a solicitação dele
 * gravou e a venda.
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
  await expect(
    row(page, n).locator('[data-generate-item="ok"]'),
  ).toBeVisible();
}

async function generate(page: Page, n: number, cartons: string, rounds: string) {
  const gen = row(page, n).locator("[data-rounds-generator]");
  await gen.locator("[data-generate-total]").fill(cartons);
  await gen.locator("[data-generate-rounds]").fill(rounds);
  await gen.locator("[data-generate-submit]").click();
  await expect(row(page, n).locator("[data-schedule-item]")).toHaveCount(
    Number(rounds),
  );
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

test("Solicitações: uma linha por produto, ficha completa nos quatro grupos, permissões e telas estreitas", async ({
  page,
}) => {
  // 1. O cliente pede dois produtos de uma vez: a boneca em 2 programações
  // (300 caixas = 14.400 peças) e a piscina em pedido único.
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  await pick(page, 0, "boneca", "prod-boneca");
  await generate(page, 0, "300", "2");
  await page.fill('textarea[name="p0.description"]', "Boneca da ficha");
  await page.click("[data-add-request-item]");
  await pick(page, 1, "piscina", "prod-piscina");
  await row(page, 1)
    .locator("[data-rounds-generator] [data-generate-total]")
    .fill("50");
  await expect(page.locator('input[name="p1.quantity"]')).toHaveValue("300");
  await page.fill('textarea[name="p1.description"]', "Piscina da ficha");
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

  // 2. Cliente: as duas linhas; a desta solicitação com o total da
  // programação; sem caixa, cubagem, custo nem compra (é da Wellmix).
  const sheet = page.locator("[data-request-sheet]");
  await expect(sheet.locator("[data-sheet-row]")).toHaveCount(2);
  await expect(cell(page, "pieces")).toContainText("14.400 peças");
  await expect(cell(page, "pieces")).toContainText("Programação");
  for (const key of ["boxes", "cbm", "cost", "purchase"])
    await expect(cell(page, key)).toHaveCount(0);
  await expect(cell(page, "sale")).toContainText("Não informado");
  // A programação de compra continua abaixo da tabela, com o mesmo total.
  await expect(page.locator("[data-request-schedule-table]")).toContainText(
    "14.400",
  );
  // Ver ficha completa: Produto, Embalagem e cubagem, Valores (só a venda) e
  // Pagamento (só a venda ao cliente).
  await current(page).locator("[data-sheet-toggle]").click();
  const detail = current(page).locator("[data-sheet-detail]");
  await expect(detail).toBeVisible();
  await expect(detail.locator("[data-sheet-group]")).toHaveCount(4);
  await expect(field(page, "measure.0")).toContainText(
    "Comprimento 12 cm · Largura 8 cm · Altura 32 cm",
  );
  await expect(field(page, "perBox")).toContainText("48");
  await expect(field(page, "perBox")).toContainText("Solicitação");
  await expect(
    detail.locator('[data-sheet-group="values"] [data-sheet-section]'),
  ).toHaveCount(1);
  await expect(
    detail.locator('[data-sheet-group="payment"] [data-sheet-section]'),
  ).toHaveCount(1);
  await expect(detail).not.toContainText("Ficha atual");
  await expect(detail).not.toContainText("3,20");

  // 3. Celular: a linha vira cartão e a ficha cabe na tela.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await current(page).locator("[data-sheet-toggle]").click();
  await expect(current(page).locator("[data-sheet-detail]")).toBeVisible();
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
  await expect(cell(page, "purchase")).toContainText("Não informado");
  await current(page).locator("[data-sheet-toggle]").click();
  await expect(field(page, "sku")).toContainText("Ficha atual");
  // O cadastro grava o CBM da caixa (das medidas, ao salvar): gravado, não calculado.
  await expect(field(page, "cbmPerBox")).toContainText("0,1202 m³");
  await expect(field(page, "cbmPerBox")).toContainText("Ficha atual");
  await expect(field(page, "cbmTotal")).toContainText("300 caixas × 0,1202 m³");
  await expect(field(page, "negotiated")).toContainText("Não informado");
  await expect(field(page, "supplier")).toContainText("Guangzhou Supplier B");
  await expect(field(page, "terms")).toContainText("Não informado");
  // A outra linha do lote abre a ficha dela e o link da solicitação.
  const other = page.locator("[data-sheet-row]:not([data-sheet-current])");
  await other.locator("[data-sheet-toggle]").click();
  await expect(other.locator("[data-sheet-detail]")).toContainText(
    "Abrir a solicitação",
  );
  await expect(
    other.locator('[data-sheet-field="pieces"]'),
  ).toContainText("300 peças");

  // 5. iPad: nada cortado com a ficha aberta.
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.reload();
  await current(page).locator("[data-sheet-toggle]").click();
  await expect(field(page, "cost")).toBeVisible();
  await noSideScroll(page);

  // 6. Operador sem "Ver valores e margem": a ficha técnica, sem custo,
  // compra, venda nem condições.
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, "operador@wellmix.com");
  await page.goto(url);
  await expect(cell(page, "boxes")).toContainText("300 caixas");
  for (const key of ["cost", "purchase", "sale"])
    await expect(cell(page, key)).toHaveCount(0);
  await current(page).locator("[data-sheet-toggle]").click();
  await expect(
    current(page).locator('[data-sheet-group="values"] [data-sheet-restricted]'),
  ).toContainText("Ver valores e margem");
  await expect(current(page).locator("[data-sheet-detail]")).not.toContainText(
    "3,20",
  );
});
