import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Painel do cliente e do grupo (dono, 19/11/2026; docs/TRADE_COMERCIAL.md, PRs
 * 3 e 4): abre pelo grupo econômico, mostra as abas 01 a 11 do painel do
 * Projeto Campineira (e o atalho para o Plano de ação), avisa quando as
 * vendas ainda não foram carregadas e, com o cliente sem código do Sankhya,
 * o "Atualizar agora" avisa em vez de inventar dados.
 */

const TAG = `PNL${Date.now().toString(36).toUpperCase()}`;

test("Painel comercial: grupo, abas, aviso sem carga e Atualizar agora sem código do Sankhya", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/portfolio/groups");
  const create = page.locator("[data-portfolio-group-new]");
  await create.locator('input[name="name"]').fill(`Grupo ${TAG}`);
  await create.getByRole("button", { name: "Criar grupo" }).click();
  await page.waitForURL(/\/app\/portfolio\/groups\/[^/?]+\?created=1/);
  const find = page.locator("[data-portfolio-group-find]");
  await find.locator('input[name="find"]').fill("Loja do João");
  await find.getByRole("button", { name: "Buscar" }).click();
  await page
    .locator(
      '[data-portfolio-group-candidate="cliente-joao"] [data-portfolio-group-add]',
    )
    .click();
  await page.waitForURL(/\?added=1/);

  // Pelo atalho do grupo.
  await page.locator("[data-portfolio-group-panel]").click();
  await page.waitForURL(/\/app\/portfolio\/panel\?scope=g:/);
  await expect(page.locator("h1")).toContainText(`Grupo ${TAG}`);
  await expect(page.locator("[data-panel-tab]")).toHaveCount(11);
  await expect(page.locator("[data-panel-loaded]")).toHaveAttribute(
    "data-panel-loaded",
    "no",
  );
  await expect(page.locator("main")).toContainText(
    "As vendas ainda não foram carregadas",
  );

  // Outra aba mantém o grupo.
  await page.locator('[data-panel-tab="abc"]').click();
  await page.waitForURL(/tab=abc/);
  await expect(page.locator('[data-panel-tab="abc"]')).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Cliente sem código do Sankhya: nada é lido nem inventado; o painel avisa.
  await page.locator("[data-panel-refresh]").click();
  await page.waitForURL(/refreshed=0-1/);
  await expect(page.locator("[data-panel-refreshed]")).toContainText("0 de 1");
  await expect(page.locator("[data-panel-load-warnings]")).toContainText(
    "sem código do Sankhya",
  );

  // A escolha do painel lista o grupo.
  await page.goto("/app/portfolio");
  await page.locator("[data-portfolio-panel-link]").click();
  await page.waitForURL(/\/app\/portfolio\/panel$/);
  await expect(page.locator("[data-panel-choose-groups]")).toContainText(
    `Grupo ${TAG}`,
  );
});
