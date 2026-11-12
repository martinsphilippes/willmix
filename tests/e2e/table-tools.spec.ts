import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Padrão das tabelas (src/components/table-tools.tsx): ordenar pelo
 * cabeçalho, buscar ao digitar em todas as colunas e paginar em 15/25/50.
 */
test("tabela padrão: ordena, busca e pagina", async ({ page }) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/parties");

  const tools = page.locator("[data-table-tools]").first();
  const rows = tools.locator("tbody tr:visible");
  const firstName = () => rows.first().locator("td").first().innerText();
  // Outros testes também cadastram parceiros: a página mostra até 15.
  const total = await tools.locator("tbody tr").count();
  const firstPage = Math.min(total, 15);
  expect(total).toBeGreaterThanOrEqual(6);
  await expect(rows).toHaveCount(firstPage);

  const name = tools.locator("th[data-table-sort]").first();
  await name.click();
  await expect(name).toHaveAttribute("aria-sort", "ascending");
  const asc = await firstName();
  await name.click();
  await expect(name).toHaveAttribute("aria-sort", "descending");
  expect(await firstName()).not.toBe(asc);

  // Busca em qualquer coluna (aqui o e-mail), sem acento nem caixa.
  await tools.locator("[data-table-search]").fill("TRANSPORTADORA@RODO");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Trans Rodo");
  await tools.locator("[data-table-search]").fill("nada-assim-xyz");
  await expect(rows).toHaveCount(0);
  await expect(tools.locator("[data-table-none]")).toBeVisible();
  await tools.locator("[data-table-search]").fill("");
  await expect(rows).toHaveCount(firstPage);

  // Paginação: 15, 25 ou 50 linhas.
  const size = tools.locator("[data-table-page-size]");
  await expect(size.locator("option")).toHaveText(["15", "25", "50"]);
  // "1–15 de 17": a faixa vai até o fim da primeira página, não do total.
  await expect(tools.locator("[data-table-range]")).toContainText(
    `1–${firstPage} de ${total}`,
  );
});
