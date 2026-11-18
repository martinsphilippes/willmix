import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Produto novo → Encomendas (dono, 16/11/2026 e 18/11/2026): as colunas na
 * ordem Pedido → Cliente → Produtos → Quantidade → Situação → Próximo passo,
 * sem a coluna Foto, e cada linha com o pedido inteiro: em Produtos, só
 * quantos produtos o pedido tem (nenhum nome), e a soma das peças. A
 * etiqueta da encomenda fica embaixo do cliente. A conta por pedido com os
 * itens do pedido (histórico do Sankhya) está em
 * tests/unit/request-composition.test.ts.
 */
const TAG = `CMP${Date.now().toString(36).toUpperCase()}`;

/** Pedido de um produto só: a boneca, 100 caixas de 48. */
async function sendDoll(page: Page) {
  await page.goto("/app/requests/new");
  const row = page.locator('[data-request-item="0"]');
  const product = row.locator('[data-product-picker="catalog"]');
  await product.locator("[data-product-picker-input]").fill("boneca");
  await product.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(row.locator('[role="status"]').first()).toBeVisible();
  const gen = row.locator("[data-rounds-generator]");
  await gen.locator("[data-generate-total]").fill("100");
  await expect(gen.locator("[data-generate-submit]")).toBeHidden();
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await page.waitForURL(/\/app\/requests\/(?!new|batch)[^/?]+$/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** Lote: a jarra do catálogo (1.007 peças) e um copo fora dele (200). */
async function sendBatch(page: Page) {
  await page.goto("/app/requests/new");
  const product = page.locator(
    '[data-request-item="0"] [data-product-picker="catalog"]',
  );
  await product.locator("[data-product-picker-input]").fill("jarra");
  await product.locator('[data-product-picker-option="prod-jarra"]').click();
  await expect(
    page.locator('[data-request-item="0"] [role="status"]'),
  ).toBeVisible();
  const planCount = page.locator("[data-order-plan-count]");
  await planCount.fill("3");
  await planCount.blur();
  await page.click('[data-order-plan-interval="30"]');
  await expect(
    page.locator('[data-request-item="0"] [data-schedule-item]'),
  ).toHaveCount(3);
  await page.fill('input[name="p0.schedule.qty.1"]', "334");
  await page.fill('input[name="p0.schedule.qty.2"]', "333");
  await page.fill('input[name="p0.schedule.qty.3"]', "340");
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("1007");
  await page.click("[data-add-request-item]");
  await page.check('[data-request-item="1"] input[name="p1.sourcingDemand"]');
  await page.fill('input[name="p1.productName"]', `Copo de vidro ${TAG}`);
  await page.fill('textarea[name="p1.description"]', "Copo de vidro 300 ml");
  await page.fill('input[name="p1.schedule.qty.1"]', "100");
  await page.fill('input[name="p1.schedule.qty.2"]', "50");
  await page.fill('input[name="p1.schedule.qty.3"]', "50");
  await expect(page.locator('input[name="p1.quantity"]')).toHaveValue("200");
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await page.waitForURL(/\/app\/requests\/batch\/[^?]+\?created=2$/);
  return new URL(page.url()).pathname;
}

test("Encomendas: Pedido → Cliente → Produtos (só quantos) → Quantidade, sem Foto, com o pedido inteiro em cada linha", async ({
  page,
}) => {
  // O cliente lança um pedido de um produto e um lote de dois.
  await login(page, "joao@lojista.com");
  const singleId = await sendDoll(page);
  const batchPath = await sendBatch(page);

  // A lista de Encomendas da Wellmix.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/requests");
  const titles = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-table-tools] thead th"), (th) =>
      (th.textContent ?? "").replace(/\s+/g, " ").trim(),
    ),
  );
  // Sem a coluna Foto.
  expect(titles.some((t) => t.startsWith("Foto"))).toBe(false);
  const order = [
    "Pedido",
    "Cliente",
    "Produtos",
    "Quantidade",
    "Situação",
    "Próximo passo",
  ].map((title) => titles.findIndex((t) => t.startsWith(title)));
  expect(order.every((i) => i >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  // Cliente logo antes de Produtos.
  expect(order[2] - order[1]).toBe(1);
  // As demais colunas continuam, depois do Próximo passo.
  for (const rest of ["Prazo de resposta", "Analista", "Data"])
    expect(titles.findIndex((t) => t.startsWith(rest))).toBeGreaterThan(
      order[order.length - 1],
    );

  // Lote de dois produtos: só "2 produtos" (nenhum nome, nenhuma foto) e a
  // soma das peças.
  const batch = page.locator(`[data-batch-row]:has(a[href="${batchPath}"])`);
  await expect(batch).toHaveCount(1);
  await expect(
    batch.locator("[data-photo-grid], [data-gallery-open]"),
  ).toHaveCount(0);
  const batchProducts = batch.locator("[data-request-products]");
  await expect(batchProducts).toHaveAttribute("data-request-products", "2");
  await expect(batchProducts).toHaveText("2 produtos");
  await expect(batchProducts.locator("xpath=ancestor::td")).toHaveText(
    "2 produtos",
  );
  await expect(batch).not.toContainText("Jarra");
  await expect(batch).not.toContainText(`Copo de vidro ${TAG}`);
  await expect(batch.locator("[data-request-total]")).toHaveText("1.207 un");
  await expect(batch.locator("[data-request-order]")).toHaveText("—");
  // A etiqueta da encomenda embaixo do cliente.
  await expect(
    batch.locator("[data-request-customer] [data-demand-tags]"),
  ).toHaveCount(1);
  // As células na ordem: pedido, cliente, produtos e quantidade.
  const cellOrder = await batch.evaluate((tr) =>
    [
      "[data-request-order]",
      "[data-request-customer]",
      "[data-request-products]",
      "[data-request-total]",
    ].map(
      (sel) =>
        (tr.querySelector(sel)!.closest("td") as HTMLTableCellElement)
          .cellIndex,
    ),
  );
  expect([...cellOrder].sort((a, b) => a - b)).toEqual(cellOrder);
  expect(cellOrder[2] - cellOrder[1]).toBe(1);
  // "2 produtos" abre o lote.
  await expect(batchProducts).toHaveAttribute("href", batchPath);

  // Pedido de um produto só: "1 produto" e a quantidade dele.
  const single = page.locator(
    `tr:has(a[data-request-open][href="/app/requests/${singleId}"])`,
  );
  const singleProducts = single.locator("[data-request-products]");
  await expect(singleProducts).toHaveAttribute("data-request-products", "1");
  await expect(singleProducts).toHaveText("1 produto");
  await expect(single).not.toContainText("Boneca");
  await expect(single.locator("[data-request-total]")).toHaveText("4.800 un");
});
