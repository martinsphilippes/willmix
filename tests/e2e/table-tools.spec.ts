import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Padrão das tabelas (src/components/table-tools.tsx): ordenar pelo
 * cabeçalho, buscar ao digitar em todas as colunas e paginar em 15/25/50.
 * Desde 17/11/2026 a lista de parceiros (Equipe Externa) filtra no servidor,
 * com filtro em cada coluna; a tabela padrão é conferida na Auditoria, com os
 * registros que o próprio teste cria (um por cadastro novo).
 */
test("tabela padrão: ordena, busca e pagina", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "admin@wellmix.com");
  const tag = `tt${Date.now().toString(36)}`;
  for (let i = 1; i <= 7; i++) {
    await page.goto("/app/parties/new?type=carrier");
    await page.fill('input[name="name"]', `Tabela ${tag} ${i}`);
    await page.getByRole("button", { name: "Salvar" }).first().click();
    await page.waitForURL(/\/app\/parties\/[^/?#]+(#access)?$/);
  }
  await page.goto(`/app/audit?q=${tag}`);

  const tools = page.locator("[data-table-tools]").first();
  const rows = tools.locator("tbody tr:visible");
  const whatCell = () => rows.first().locator("td").nth(3).innerText();
  const total = await tools.locator("tbody tr").count();
  const firstPage = Math.min(total, 15);
  expect(total).toBeGreaterThanOrEqual(7);
  await expect(rows).toHaveCount(firstPage);

  // Ordem pela coluna "O que" (o nome de cada cadastro).
  const what = tools.locator("th[data-table-sort]").nth(3);
  await what.click();
  await expect(what).toHaveAttribute("aria-sort", "ascending");
  const asc = await whatCell();
  await what.click();
  await expect(what).toHaveAttribute("aria-sort", "descending");
  expect(await whatCell()).not.toBe(asc);

  // Busca em qualquer coluna, sem acento nem caixa.
  await tools.locator("[data-table-search]").fill(`TABELA ${tag} 3`);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(`Tabela ${tag} 3`);
  await tools.locator("[data-table-search]").fill("nada-assim-xyz");
  await expect(rows).toHaveCount(0);
  await expect(tools.locator("[data-table-none]")).toBeVisible();
  await tools.locator("[data-table-search]").fill("");
  await expect(rows).toHaveCount(firstPage);

  // Paginação: 15, 25 ou 50 linhas.
  const size = tools.locator("[data-table-page-size]");
  await expect(size.locator("option")).toHaveText(["15", "25", "50"]);
  await expect(tools.locator("[data-table-range]")).toContainText(
    `1–${firstPage} de ${total}`,
  );
});
