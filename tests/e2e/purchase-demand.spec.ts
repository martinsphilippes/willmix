import { expect, test, type Locator, type Page } from "@playwright/test";
import { fillCustomerContacts, fillOrderTerms, login } from "./helpers";

/*
 * Compra por demanda (mapa B10 e B14; dono, 15/11/2026;
 * docs/PURCHASE_DEMAND.md): a encomenda pelas quatro portas (vitrine,
 * cliente, vendedor, operador) e a reposição aberta à mão pelo Planner,
 * todas na mesma fila.
 */

async function choose(
  picker: Locator,
  marker: string,
  text: string,
  value: string,
) {
  await picker.locator(`[data-${marker}-input]`).fill(text);
  const option = picker.locator(`[data-${marker}-option="${value}"]`);
  await expect(option).toBeVisible();
  await option.click();
}

/** Nova solicitação pela Wellmix em nome do cliente João (produto novo). */
async function orderForJoao(page: Page, name: string) {
  await page.goto("/app/requests/new");
  await choose(
    page.locator('[data-request-customer] [data-party-picker="customer"]'),
    "party-picker",
    "loja",
    "cliente-joao",
  );
  // Condições do pedido e contatos do cliente (docs/ORDER_TERMS.md).
  await fillOrderTerms(page);
  await fillCustomerContacts(page, "loja-joao");
  await page.check('[data-request-item="0"] input[name="p0.sourcingDemand"]');
  await page.fill('input[name="p0.productName"]', name);
  await page.fill('textarea[name="p0.description"]', `Encomenda ${name}`);
  await page
    .locator('[data-request-item="0"] [data-selection-quantity]')
    .fill("500");
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await page.waitForURL(/\/app\/requests\/(?!new|batch)[^/?]+/);
}

test("encomenda lançada pelo vendedor e pelo operador em nome do cliente", async ({
  page,
}) => {
  const tag = `ENC${Date.now().toString(36).toUpperCase()}`;
  await login(page, "vendas@wellmix.com");
  // Vendas abre Encomendas (no menu, bloco Produto novo).
  await page.goto("/app/requests");
  await expect(page.locator("h1")).toContainText("Encomendas");
  await orderForJoao(page, `Pote ${tag} V`);
  await login(page, "operador@wellmix.com");
  await orderForJoao(page, `Pote ${tag} O`);

  // Na lista de Encomendas, cada uma com a porta de entrada.
  await page.goto(`/app/requests?kind=order&q=${tag}`);
  await expect(page.locator('[data-demand-channel="vendedor"]')).toHaveCount(1);
  await expect(page.locator('[data-demand-channel="operador"]')).toHaveCount(1);
  // O cliente vê as duas em Encomendas (lançadas em nome da empresa dele).
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests");
  await expect(page.locator("h1")).toContainText("Encomendas");
});

test("carrinho da vitrine: um item de pronta entrega e outro sob encomenda", async ({
  page,
}) => {
  // Saldo a caminho de jarras, sem pedido (container com item de estoque).
  await login(page, "admin@wellmix.com");
  await page.goto("/app/containers");
  await page.fill('input[name="code"]', `CTE2E${Date.now().toString(36)}`);
  await page.getByRole("button", { name: /criar container|create/i }).click();
  await page.waitForURL(/\/app\/containers\/[^/?]+/);
  const stockForm = page
    .locator("form")
    .filter({ has: page.locator('input[name="mode"][value="stock"]') });
  await stockForm
    .locator('select[name="productId"]')
    .selectOption("prod-jarra");
  await stockForm.locator('input[name="quantity"]').fill("100000");
  await stockForm.locator('input[name="unitsPerBox"]').fill("100");
  await stockForm.locator('input[name="boxCount"]').fill("1000");
  await stockForm.locator('input[name="cbmPerBox"]').fill("0.05");
  await stockForm.locator('button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  expect(page.url()).not.toMatch(/[?&]error=/);

  await login(page, "joao@lojista.com");
  await page.goto("/app/explore/cart");
  const leftovers = page.locator("[data-cart-remove]");
  while ((await leftovers.count()) > 0) {
    const before = await leftovers.count();
    await leftovers.first().click();
    await expect(leftovers).toHaveCount(before - 1);
  }
  for (const id of ["prod-jarra", "prod-panela"]) {
    await page.goto("/app/explore");
    await page.locator(`[data-explore-add="${id}"]`).click();
    await page.waitForURL(new RegExp(`[?&]added=${id}`));
  }
  // Antes de confirmar: o que é pronta entrega e o que é encomenda.
  await page.goto("/app/explore/cart");
  await expect(
    page.locator('[data-cart-line="prod-jarra"] [data-cart-fulfilment]'),
  ).toHaveAttribute("data-cart-fulfilment", "ready");
  await expect(
    page.locator('[data-cart-line="prod-panela"] [data-cart-fulfilment]'),
  ).toHaveAttribute("data-cart-fulfilment", "order");
  await expect(page.locator("[data-cart-split]")).toHaveAttribute(
    "data-cart-split",
    "1/1",
  );
  await page.locator("[data-cart-checkout]").click();
  // Nasce a encomenda (a panela) e a ordem de venda (a jarra).
  await page.waitForURL(/\/app\/requests\/[^/]+\?fromCart=1&sale=\d+/);
  await expect(page.locator("[data-cart-sent]")).toContainText(
    /ordem de venda/,
  );
  await expect(page.locator("h1")).toContainText("Jogo de panelas");
  const sale = new URL(page.url()).searchParams.get("sale");

  // Vendas encontra a ordem de venda em rascunho, com a jarra.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/sales-orders");
  const row = page.locator("[data-sales-order-row]", { hasText: `#${sale}` });
  await expect(row).toBeVisible();
  await row.locator("a").first().click();
  await expect(page.locator("main")).toContainText(/Jarra/);
  // E a encomenda da vitrine aparece com a porta "Vitrine".
  await page.goto("/app/requests?kind=order&q=panelas");
  await expect(
    page.locator('[data-demand-channel="vitrine"]').first(),
  ).toBeVisible();
});

test("reposição aberta pelo Planner entra na fila", async ({ page }) => {
  await login(page, "operador@wellmix.com");
  await page.goto("/app/replenishment");
  await expect(page.locator("[data-replenishment-manual]")).toBeVisible();
  const form = page.locator("[data-replenishment-new]");
  await choose(
    form.locator('[data-product-picker="active"]'),
    "product-picker",
    "boneca",
    "prod-boneca",
  );
  await form.locator("[data-replenishment-quantity]").fill("3000");
  await form.locator("[data-replenishment-date]").fill("2099-03-01");
  await form.locator("[data-replenishment-submit]").click();
  await page.waitForURL(/[?&]opened=/);
  await expect(page.locator("[data-replenishment-opened]")).toBeVisible();
  const opened = new URL(page.url()).searchParams.get("opened");
  await expect(
    page.locator(`[data-replenishment-row="${opened}"]`),
  ).toContainText("Boneca");
  // Na lista geral, com a etiqueta de reposição.
  await page.goto("/app/requests?kind=replenishment");
  await expect(
    page.locator('[data-demand-tags="replenishment"]').first(),
  ).toBeVisible();
});
