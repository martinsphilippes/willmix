import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  bookingSheet,
  importAndClose,
  login,
  openReplenishment,
  selectAndOpenSupplierRequest,
} from "./helpers";

/*
 * Estratégia de compra (mapa B10?; dono, 15/11/2026; docs/PURCHASE_DEMAND.md):
 * (a) reposição aberta pelo Planner → fornecedor da última compra → pedido
 * de compra; (c) encomenda pela tela do cliente → estratégia → pedido de
 * compra com o vínculo à encomenda e a reserva para o cliente. A "última
 * compra" nasce aqui pelo caminho de sempre (book, solicitação ao
 * fornecedor, amostra, produto e pedido de compra).
 */
const TAG = `PS${Date.now().toString(36).toUpperCase()}`;
const productName = `Garrafa ${TAG}`;

async function choose(
  picker: Locator,
  marker: string,
  text: string,
  value?: string,
) {
  await picker.locator(`[data-${marker}-input]`).fill(text);
  const option = value
    ? picker.locator(`[data-${marker}-option="${value}"]`)
    : picker.locator(`[data-${marker}-option]`).first();
  await expect(option).toBeVisible();
  await option.click();
}

/** A primeira compra do produto: pedido de compra do fornecedor A a USD 1,40. */
async function firstPurchase(page: Page): Promise<string> {
  const codeA = `${TAG}-A`;
  const codeB = `${TAG}-B`;
  await login(page, "admin@wellmix.com");
  await importAndClose(
    page,
    bookingSheet("Shenzhen Supplier A", codeA, `Bottle ${TAG} 500ml`),
    "Shenzhen Supplier A",
  );
  await importAndClose(
    page,
    bookingSheet("Guangzhou Supplier B", codeB, `Bottle ${TAG} with lid`),
    "Guangzhou Supplier B",
  );
  const requestUrl = await selectAndOpenSupplierRequest(
    page,
    TAG,
    codeA,
    codeB,
    "Caixa com a marca",
  );
  const requestId = requestUrl.split("/").pop()!;
  const itemUrl = `${requestUrl}?view=item`;
  await login(page, "supplier.a@china.com");
  await page.goto(requestUrl);
  await page.locator("[data-supplier-table-answer-open]").click();
  await page.fill("[data-supplier-table-answer-price-input]", "1,40");
  await page.fill("[data-supplier-table-answer-moq]", "1000");
  await page.selectOption("[data-supplier-table-answer-incoterm]", "FOB");
  await page.click("[data-supplier-table-answer=yes]");
  await page.waitForURL(/[?&]answered=1/);
  await login(page, "admin@wellmix.com");
  await page.goto(itemUrl);
  await page.click("[data-supplier-decide=approved]");
  await page.waitForURL(/[?&]decided=approved/);
  await login(page, "supplier.a@china.com");
  await page.goto(itemUrl);
  await page.setInputFiles("[data-sampling-upload] input[type=file]", {
    name: "amostra.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });
  await page.waitForURL(/[?&]sampling=file/);
  await page.click("[data-sampling-submit]");
  await page.waitForURL(/[?&]sampling=submitted/);
  await login(page, "admin@wellmix.com");
  await page.goto(itemUrl);
  await page.click("[data-sampling-review=approve]");
  await page.waitForURL(/[?&]sampling=approved/);
  await page.fill("[data-request-product-name]", productName);
  await page.selectOption("[data-request-product-line]", "linha-utilidades");
  await page.click("[data-request-product-create]");
  await page.waitForURL(/[?&]product=created/);
  // Liberado na vitrine: o cliente encomenda pela tela dele.
  await page.goto(itemUrl);
  await page.click("[data-request-product-release]");
  await page.waitForURL(/[?&]product=released/);
  await page.goto("/app/supplier-requests?tab=closed");
  await page.locator(`[data-request-to-order="${requestId}"]`).click();
  await page.waitForURL(/[?&]pick=/);
  // O quadro "Gerar pedido de compra" abre com só esta solicitação marcada;
  // outras do mesmo fornecedor podem ser marcadas para entrar juntas.
  const group = page.locator(
    `form:has([data-purchase-candidate="${requestId}"])`,
  );
  await expect(
    group.locator(
      `[data-purchase-candidate="${requestId}"] input[type=checkbox]`,
    ),
  ).toBeChecked();
  await expect(
    group.locator(
      `[data-purchase-candidate]:not([data-purchase-candidate="${requestId}"]) input[type=checkbox]:checked`,
    ),
  ).toHaveCount(0);
  await group.locator("[data-purchase-submit]").click();
  await page.waitForURL(/\/app\/orders\/[^/?]+\?purchase=created/);
  return page.url().split("?")[0];
}

/** O Comprador escolhe a estratégia do grupo onde está a demanda. */
async function chooseFor(
  page: Page,
  demandId: string,
  choice: "last_supplier" | "quote",
) {
  await page.goto("/app/purchase-strategy");
  const form = page.locator(`form:has([data-strategy-demand="${demandId}"])`);
  await expect(form).toBeVisible();
  // Só esta demanda (outras do mesmo grupo, de outros testes, ficam fora).
  const others = form.locator(
    `[data-strategy-demand]:not([data-strategy-demand="${demandId}"]) input[type=checkbox]`,
  );
  for (let i = 0; i < (await others.count()); i++)
    await others.nth(i).uncheck();
  await form.locator(`[data-strategy-choice="${choice}"]`).check();
  await form.locator("[data-strategy-submit]").click();
  await page.waitForURL(/[?&]chosen=\d+/);
  return page.url().split("#decision-")[1];
}

async function approve(page: Page, decisionId: string) {
  await login(page, "diretoria@wellmix.com");
  await page.goto("/app/purchase-strategy");
  const section = page.locator(`#decision-${decisionId}`);
  await expect(section).toHaveAttribute("data-strategy-decision", "pending");
  await section.locator("[data-strategy-approve]").click();
  await page.waitForURL(/[?&]decided=\d+/);
}

test("estratégia de compra: reposição e encomenda pelo fornecedor da última compra", async ({
  page,
}) => {
  test.slow();
  const firstOrder = await firstPurchase(page);
  expect(firstOrder).toContain("/app/orders/");

  // (a) Reposição aberta pelo Planner.
  await login(page, "operador@wellmix.com");
  const replenishment = await openReplenishment(page, TAG, "3000");
  // O Comprador: a última compra aparece (fornecedor A, 1,40) e ele escolhe.
  await page.goto("/app/purchase-strategy");
  const group = page.locator(
    `form:has([data-strategy-demand="${replenishment}"])`,
  );
  await expect(group.locator("[data-last-purchase]")).toContainText("Shenzhen");
  await expect(group.locator("[data-last-purchase]")).toContainText("1,4");
  const decisionA = await chooseFor(page, replenishment, "last_supplier");
  // A Diretoria de compras aprova.
  await approve(page, decisionA);
  // O Comprador gera o pedido com as condições da última compra.
  await login(page, "operador@wellmix.com");
  await page.goto("/app/purchase-strategy");
  const orderForm = page.locator(
    `#decision-${decisionA} [data-strategy-order-form]`,
  );
  await expect(orderForm.locator("[data-strategy-order-price]")).toHaveValue(
    "1.4",
  );
  await orderForm.locator("[data-strategy-order]").click();
  await page.waitForURL(/\/app\/orders\/[^/?]+\?created=1/);
  await expect(page.locator("main")).toContainText(productName);

  // (c) Encomenda pela tela do cliente.
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  const item = page.locator('[data-request-item="0"]');
  await choose(
    item.locator('[data-product-picker="catalog"]'),
    "product-picker",
    TAG,
  );
  // Produto do catálogo: a quantidade já vem no pedido mínimo (em caixas).
  await expect(item.locator("[data-selection-quantity]")).not.toHaveValue("");
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await page.waitForURL(/\/app\/requests\/(?!new|batch)[^/?]+/);
  const encomenda = new URL(page.url()).pathname.split("/").pop()!;
  // O cliente não vê fornecedor nem custo na encomenda.
  await expect(page.locator("main")).not.toContainText("Shenzhen");
  await login(page, "operador@wellmix.com");
  // Ainda encomenda: está na lista de Encomendas.
  // (a linha abre a página do pedido; docs/ORDER_LEVEL_LISTS.md)
  await page.goto("/app/requests");
  await expect(
    page.locator(`a[href="/app/requests/batch/${encomenda}"]`).first(),
  ).toBeVisible();
  const decisionC = await chooseFor(page, encomenda, "last_supplier");
  await approve(page, decisionC);
  await login(page, "operador@wellmix.com");
  await page.goto("/app/purchase-strategy");
  await page.locator(`#decision-${decisionC} [data-strategy-order]`).click();
  await page.waitForURL(/\/app\/orders\/[^/?]+\?created=1/);
  // A encomenda virou "pedido" e a mercadoria fica reservada para o cliente.
  await page.goto(`/app/requests/${encomenda}`);
  await expect(page.locator("main")).toContainText(/Pedido/);
  // Virou pedido: já não é da etapa de encomenda (dono, 16/11/2026), sai da
  // lista de Encomendas e segue de Pedido em diante.
  await page.goto("/app/requests");
  await expect(
    page.locator(`a[href="/app/requests/${encomenda}"]`),
  ).toHaveCount(0);
  await page.goto("/app/inventory/reservations");
  await expect(page.locator("main")).toContainText(
    /Encomenda nº \d+: pedido de compra #\d+/,
  );
  // O cliente acompanha a encomenda, sem o botão do pedido de compra.
  await login(page, "joao@lojista.com");
  await page.goto(`/app/requests/${encomenda}`);
  await expect(page.locator(`a[href^="/app/orders/"]`)).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Shenzhen");
});
