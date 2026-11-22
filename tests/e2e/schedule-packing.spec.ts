import { expect, test } from "@playwright/test";
import { createdRequestId, login } from "./helpers";

/*
 * Caixas master, cubagem e containers de cada programação (dono, 22/11/2026;
 * docs/ECONOMIC_GROUPS.md, "Caixas, cubagem e containers por programação"):
 * o cliente também vê, na Programação de compra da solicitação dele, as
 * caixas, a cubagem e os containers de cada entrega, com o total. A boneca:
 * 48 peças e 0,1202 m³ por caixa; um container 40HC (68 m³) por entrega.
 */
test("Programação de compra: o cliente vê as caixas, a cubagem e os containers de cada entrega", async ({
  page,
}) => {
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  const line = page.locator('[data-request-item="0"]');
  const catalog = line.locator('[data-product-picker="catalog"]');
  await catalog.locator("[data-product-picker-input]").fill("boneca");
  await catalog.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(line.locator('[role="status"]').first()).toBeVisible();
  // Três entregas a cada 30 dias: 20, 15 e 10 caixas.
  const planCount = page.locator("[data-order-plan-count]");
  await planCount.fill("3");
  await planCount.blur();
  await page.click('[data-order-plan-interval="30"]');
  await expect(line.locator("[data-schedule-item]")).toHaveCount(3);
  for (const [n, cartons] of [
    [1, "20"],
    [2, "15"],
    [3, "10"],
  ] as const)
    await line.locator(`[data-schedule-cartons="${n}"]`).fill(cartons);
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await createdRequestId(page);

  // A solicitação do cliente: as colunas novas na Programação de compra.
  const schedule = page.locator("[data-request-schedule-table]");
  await expect(
    schedule.locator('[data-request-schedule-col="containers"]'),
  ).toHaveText("Containers (40HC)");
  for (const [key, text] of [
    ["boxes:1", "20"],
    ["boxes:2", "15"],
    ["boxes:3", "10"],
    ["boxes:total", "45"],
    ["cbm:1", "2,404"],
    ["cbm:2", "1,803"],
    ["cbm:3", "1,202"],
    ["cbm:total", "5,409"],
    ["containers:1", "1"],
    ["containers:3", "1"],
    ["containers:total", "3"],
  ] as const)
    await expect(
      schedule.locator(`[data-request-schedule-packing="${key}"]`),
    ).toHaveText(text);
  // A ficha continua sem a embalagem para o cliente (só a Wellmix vê).
  await expect(page.locator('[data-sheet-cell="boxes"]')).toHaveCount(0);
});
