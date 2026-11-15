import { expect, test } from "@playwright/test";
import { createTeamLogin, login } from "./helpers";

/*
 * Sourcing sem "Ver preço de compra" (dono, 15/11/2026; docs/LINHA_DE_VISAO.md,
 * seção 7): o Cadastro abre o Sourcing, mas o preço achado na feira e as
 * faixas de preço ficam para quem tem a permissão. Salvar o item pela tela
 * dele não mexe no preço gravado (o servidor mantém o que já estava).
 */

/** Marca única por execução: a busca acha só o item deste teste. */
const TAG = `SRC${Date.now().toString(36).toUpperCase()}`;

test("Sourcing: preço e faixas de preço só com Ver preço de compra", async ({
  page,
}) => {
  // 1. O administrador registra o item da feira com o preço.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/sourcing/items/new");
  await page.locator('input[name="name"]').fill(`Garrafa ${TAG}`);
  await page.locator('details:has([data-money="price"]) > summary').click();
  await page.locator('[data-money="price"]').fill("2,75");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForURL(/\/app\/sourcing\/items\/[^/?]+\?saved=1/);
  const itemUrl = page.url().split("?")[0];
  await expect(page.locator("main")).toContainText("2,75");

  // 2. Um login só de Cadastro abre o item: sem preço no formulário, na
  // negociação e nas faixas (o aviso diz quem vê); na lista, sem a coluna.
  const email = `cadastro.${TAG.toLowerCase()}@wellmix.com`;
  await createTeamLogin(page, `Cadastro ${TAG}`, email, ["catalog"]);
  await login(page, email);
  await page.goto(itemUrl);
  await expect(page.locator('input[name="name"]')).toHaveValue(
    `Garrafa ${TAG}`,
  );
  await expect(page.locator('[data-money="price"]')).toHaveCount(0);
  await expect(page.locator("[data-sourcing-price-restricted]")).toContainText(
    "Ver preço de compra",
  );
  expect(await page.locator("main").innerText()).not.toContain("2,75");
  await page.goto("/app/sourcing");
  await expect(page.locator("main")).toContainText(`Garrafa ${TAG}`);
  expect(await page.locator("main").innerText()).not.toContain("2,75");

  // 3. Salvar pela tela do Cadastro mantém o preço gravado (o botão do
  // formulário do item; a tela tem outros formulários).
  await page.goto(itemUrl);
  await page
    .locator('form:has(input[name="name"])')
    .getByRole("button", { name: "Salvar", exact: true })
    .click();
  await page.waitForURL(/\?saved=1/);
  await login(page, "admin@wellmix.com");
  await page.goto(itemUrl);
  await expect(page.locator('[data-money="price"]')).toHaveValue(/2,75/);
});
