import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Tela Pedidos com o resumo por pedido em uso (auditoria de performance,
 * 14/11/2026): a lista não lê mais os itens de todos os pedidos. O produto da
 * linha vem do resumo, os itens inteiros só dos pedidos da página, e o filtro
 * de produto procura em nome e variação de todos os itens. Roda depois do
 * caminho principal (pedidos com itens no banco do teste).
 */
test("Pedidos com o resumo em uso: produto, itens da página e filtro de produto", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  // Resumos refeitos (o formato do código pode ter mudado desde a última vez).
  await page.goto("/app/settings/summaries");
  await page.locator("[data-summaries-rebuild]").click();
  await page.waitForURL(/\/app\/settings\/summaries\?ran=1/);

  await page.goto("/app/orders");
  const orderRow = page.locator('[data-orders-row^="order:"]').first();
  await expect(orderRow).toBeVisible();
  const key = (await orderRow.getAttribute("data-orders-row"))!;
  // Tabela padrão de pedidos (dono, 22/11/2026; docs/ORDER_TABLES.md): as
  // colunas das condições na ordem do dono, entre o número e o cliente.
  const heads = await page
    .locator("[data-orders-panel] thead tr")
    .first()
    .locator("[data-order-head]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-order-head")));
  expect(heads).toEqual([
    "negotiationDate",
    "saleType",
    "paymentTerm",
    "paymentMethod",
    "billing",
    "vip",
    "group",
    "customerCode",
    "status",
    "deliveries",
    "cbm",
    "value",
  ]);
  await expect(
    orderRow.locator('[data-order-col="negotiationDate"]'),
  ).not.toHaveText("—");
  // Lista no nível do pedido (dono, 18/11/2026): a coluna mostra quantos
  // produtos; o nome do 1º item, do resumo, fica na dica da célula.
  const products = orderRow.locator("[data-orders-products]");
  await expect(products).toHaveText(/^\d+$/);
  const product = ((await products.getAttribute("title")) ?? "").trim();
  expect(product).not.toBe("");

  // Itens da linha escolhida: lidos inteiros (só a página), o 1º é o produto.
  // Clique na linha (fora dos links, que abrem o pedido).
  await orderRow.dispatchEvent("click");
  const panel = page.locator("[data-orders-items]");
  await expect(panel).toHaveAttribute("data-orders-items", key);
  await expect(panel.locator("[data-orders-items-detailed]")).toHaveCount(1);
  const items = panel.locator("[data-orders-item]");
  await expect(items.first()).toBeVisible();
  await expect(items.first()).toContainText(product);
  // Tabela padrão de itens: a descrição numa linha e nada para abrir.
  await expect(
    items.first().locator("[data-orders-item-description]"),
  ).toContainText(product);
  await expect(panel.locator("[data-row-more-toggle]")).toHaveCount(0);

  // Filtro de produto: procura nos itens de todos os pedidos.
  await page.goto(`/app/orders?p=${encodeURIComponent(product)}`);
  await expect(page.locator(`[data-orders-row="${key}"]`)).toHaveCount(1);
  await page.goto("/app/orders?p=zz-produto-que-nao-existe-zz");
  await expect(page.locator("[data-orders-row]")).toHaveCount(0);
});
