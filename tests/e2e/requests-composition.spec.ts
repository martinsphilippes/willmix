import { expect, test, type Page } from "@playwright/test";
import { gotoProduct, login, png, createdRequestId } from "./helpers";

/*
 * Encomendas no nível do pedido (dono, 18/11/2026): a lista sem foto, nome
 * ou quantidade de produto, na ordem Nº → Cliente → Produtos (SKUs) →
 * Situação → Containers por programação → Programações → Próximo passo →
 * Prazo. Abrir é sempre a página do pedido (também com um produto só), e
 * lá cada produto tem foto, peças por caixa, caixas e a conversa dele. A
 * conta de produtos por pedido com os itens do pedido (histórico do
 * Sankhya) está em tests/unit/request-composition.test.ts; a de
 * programações e containers, em tests/unit/request-rounds.test.ts.
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
  await createdRequestId(page);
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

test("Encomendas: lista no nível do pedido e a página do pedido com os produtos", async ({
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
  // Cabeçalhos curtos (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 6).
  const order = [
    "Solicitação",
    "Cliente",
    "Itens",
    "Situação",
    "Cont./prog.",
    "Entregas",
    "Próxima ação",
  ].map((title) => titles.findIndex((t) => t.startsWith(title)));
  expect(order.every((i) => i >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(titles).not.toContain("Pedido");
  for (const rest of ["Prazo", "Analista", "Data"])
    expect(titles.findIndex((t) => t.startsWith(rest))).toBeGreaterThan(
      order[order.length - 1],
    );
  // Sem foto nem quantidade de produto na lista.
  expect(titles).not.toContain("Foto");
  expect(titles).not.toContain("Quantidade");

  // Lote de dois produtos: 2 SKUs, 3 programações; o copo não tem caixa
  // master, então os containers ficam em "—".
  const batch = page.locator(`[data-batch-row]:has(a[href="${batchPath}"])`);
  await expect(batch).toHaveCount(1);
  await expect(batch.locator("[data-photo-grid]")).toHaveCount(0);
  await expect(batch.locator("[data-request-products]")).toHaveText("2");
  await expect(batch.locator("[data-request-rounds]")).toHaveText("3");
  await expect(batch.locator("[data-request-containers]")).toHaveText("—");
  // Sem a coluna Pedido (dono, 19/11/2026): o vínculo segue na página.
  await expect(batch.locator("[data-request-order]")).toHaveCount(0);
  // Abrir é um ícone, sem a palavra.
  const open = batch.locator(`a[data-open-link][href="${batchPath}"]`);
  await expect(open).toHaveText("");
  await expect(open).toHaveAttribute("aria-label", "Abrir o pedido");

  // Pedido de um produto só: abre a página do pedido, não a do produto.
  const singlePath = `/app/requests/batch/${singleId}`;
  const single = page.locator(
    `tr:has(a[data-request-open][href="${singlePath}"])`,
  );
  await expect(single.locator("[data-request-products]")).toHaveText("1");
  await single.locator("a[data-request-open]").click();
  await page.waitForURL(new RegExp(`${singlePath}$`));
  const doll = page.locator("[data-batch-item]");
  await expect(doll).toHaveCount(1);
  // A boneca: 48 peças por caixa, 100 caixas.
  await expect(doll.locator("[data-batch-per-box]")).toHaveText("48");
  await expect(doll.locator("[data-batch-boxes]")).toHaveText("100");
  await expect(doll.locator('[data-chat-open^="request:"]')).toHaveCount(1);
  // O produto abre a tela dele neste pedido, com o caminho de volta.
  await doll.locator(`a[href="/app/requests/${singleId}"]`).first().click();
  await page.waitForURL(new RegExp(`/app/requests/${singleId}$`));
  await expect(page.locator("[data-back-to-order]")).toHaveAttribute(
    "href",
    singlePath,
  );

  // O lote: cada produto com foto (a jarra) ou sem (o copo), e a conversa.
  await page.goto(batchPath);
  await expect(page.locator("[data-batch-item]")).toHaveCount(2);
  await expect(page.locator("[data-batch-summary]")).toContainText(
    "3 programação",
  );
  await expect(page.locator('[data-chat-open^="request:"]')).toHaveCount(2);
});
