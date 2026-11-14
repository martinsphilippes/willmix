import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * "Criar pedido" (dono, 14/11/2026): a entrada da encomenda do cliente
 * (/app/requests/new) aparece no Overview do bloco Pedido, no passo Pedidos
 * e na lista de pedidos para a Wellmix; o cliente tem o link no menu e o
 * botão na lista; o fornecedor não vê o botão.
 */
test("Criar pedido: Wellmix e cliente chegam à encomenda", async ({ page }) => {
  await login(page, "admin@wellmix.com");
  for (const path of [
    "/app/flow/order",
    "/app/flow/order/orders",
    "/app/orders",
  ]) {
    await page.goto(path);
    const button = page.locator("[data-create-order]");
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("href", "/app/requests/new");
  }
  await page.locator("[data-create-order]").click();
  await page.waitForURL(/\/app\/requests\/new/);

  await page.context().clearCookies();
  await login(page, "joao@lojista.com");
  await page.goto("/app/orders");
  await expect(page.locator("[data-create-order]")).toBeVisible();
  await expect(
    page.locator('nav a[href="/app/requests/new"]').first(),
  ).toBeAttached();
  await page.locator("[data-create-order]").click();
  await page.waitForURL(/\/app\/requests\/new/);
  await expect(page.locator("h1")).toBeVisible();
});

test("Criar pedido: o fornecedor não vê o botão", async ({ page }) => {
  await login(page, "supplier.a@china.com");
  await page.goto("/app/flow/order/orders");
  await expect(page.locator("[data-flow-step]")).toBeVisible();
  await expect(page.locator("[data-create-order]")).toHaveCount(0);
});
