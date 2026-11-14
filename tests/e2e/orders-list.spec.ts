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
  // Produto da linha (o 1º item do pedido), do resumo.
  const product = (
    await orderRow.locator("td").nth(1).locator("a").innerText()
  ).trim();
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

  // Filtro de produto: procura nos itens de todos os pedidos.
  await page.goto(`/app/orders?p=${encodeURIComponent(product)}`);
  await expect(page.locator(`[data-orders-row="${key}"]`)).toHaveCount(1);
  await page.goto("/app/orders?p=zz-produto-que-nao-existe-zz");
  await expect(page.locator("[data-orders-row]")).toHaveCount(0);
});
