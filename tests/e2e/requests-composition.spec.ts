import { expect, test, type Page } from "@playwright/test";
import { gotoProduct, login, png } from "./helpers";

/*
 * Produto novo → Encomendas (dono, 16/11/2026): as colunas na ordem Foto →
 * Pedido → Produtos → Quantidade → Cliente → Situação → Próximo passo, e
 * cada linha com o pedido inteiro: uma miniatura por produto no quadrado da
 * foto (foto real; sem foto, a inicial), o início do nome de todos os
 * produtos e a soma das peças. A conta por pedido com os itens do pedido
 * (histórico do Sankhya) está em tests/unit/request-composition.test.ts.
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

test("Encomendas: Foto → Pedido → Produtos → Quantidade, com o pedido inteiro em cada linha", async ({
  page,
}) => {
  // Foto real da jarra no cadastro; o copo (fora do catálogo) não tem.
  await login(page, "admin@wellmix.com");
  await gotoProduct(page, "prod-jarra");
  await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && r.status() < 400,
    ),
    page
      .locator('[data-sheet-photo="original"] input[type=file]')
      .first()
      .setInputFiles(png),
  ]);
  await page.waitForLoadState("networkidle");

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
  const order = [
    "Foto",
    "Pedido",
    "Produtos",
    "Quantidade",
    "Cliente",
    "Situação",
    "Próximo passo",
  ].map((title) => titles.findIndex((t) => t.startsWith(title)));
  expect(order.every((i) => i >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  // As demais colunas continuam, depois do Próximo passo.
  for (const rest of ["Prazo de resposta", "Analista", "Data"])
    expect(titles.findIndex((t) => t.startsWith(rest))).toBeGreaterThan(
      order[order.length - 1],
    );

  // Lote de dois produtos: a grade com a foto da jarra e a inicial do copo,
  // os dois nomes (o início de cada um) e a soma das peças.
  const batch = page.locator(`[data-batch-row]:has(a[href="${batchPath}"])`);
  await expect(batch).toHaveCount(1);
  await expect(batch.locator("[data-photo-grid]")).toHaveAttribute(
    "data-photo-grid",
    "2",
  );
  await expect(batch.locator('[data-photo-tile="photo"]')).toHaveCount(1);
  await expect(batch.locator('[data-photo-tile="none"]')).toHaveText("C");
  await expect(batch.locator("[data-request-products]")).toHaveAttribute(
    "data-request-products",
    "2",
  );
  const names = await batch
    .locator("[data-request-product-name]")
    .allTextContents();
  expect(names.map((n) => n.replace(/^\s*·\s*/, "").trim())).toEqual([
    expect.stringMatching(/^Jarra/),
    expect.stringMatching(/^Copo de vidro/),
  ]);
  await expect(batch.locator("[data-request-total]")).toHaveText("1.207 un");
  await expect(batch.locator("[data-request-order]")).toHaveText("—");
  // As células na ordem: foto, pedido, produtos e quantidade.
  const cellOrder = await batch.evaluate((tr) =>
    [
      "[data-photo-grid]",
      "[data-request-order]",
      "[data-request-products]",
      "[data-request-total]",
    ].map(
      (sel) =>
        (tr.querySelector(sel)!.closest("td") as HTMLTableCellElement)
          .cellIndex,
    ),
  );
  expect([...cellOrder].sort((a, b) => a - b)).toEqual(cellOrder);
  // A grade abre a galeria com a foto de cada produto que tem foto.
  await batch.locator("[data-gallery-open]").click();
  await expect(
    page.locator("dialog[data-gallery][open] [data-gallery-item]"),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");

  // Pedido de um produto só: sem grade, o nome e a quantidade dele.
  const single = page.locator(
    `tr:has(a[data-request-open][href="/app/requests/${singleId}"])`,
  );
  await expect(single.locator("[data-photo-grid]")).toHaveCount(0);
  await expect(single.locator("[data-request-products]")).toHaveAttribute(
    "data-request-products",
    "1",
  );
  await expect(single.locator("[data-request-total]")).toHaveText("4.800 un");
});
