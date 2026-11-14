import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Nova solicitação com o card "Gerar programação pela quantidade" (dono,
 * 14/11/2026): o mesmo card da Seleção de itens, ligado ao produto escolhido
 * no campo acima de cada linha. A boneca do cadastro de demonstração tem 48
 * peças por caixa master e as medidas da caixa (52 × 34 × 68 cm); a piscina,
 * 6 por caixa. Sem abrir a Seleção de itens.
 */

const row = (page: Page, n: number) =>
  page.locator(`[data-request-item="${n}"]`);

async function pick(page: Page, n: number, search: string, id: string) {
  const picker = row(page, n).locator('[data-product-picker="catalog"]');
  await picker.locator("[data-product-picker-input]").fill(search);
  await picker.locator(`[data-product-picker-option="${id}"]`).click();
  await expect(row(page, n).locator('[role="status"]').first()).toBeVisible();
}

test("Nova solicitação: gerar programação pelo produto escolhido, trocar, dois produtos, enviar e reabrir", async ({
  page,
}) => {
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  const first = row(page, 0);
  const gen = first.locator("[data-rounds-generator]");

  // Sem produto: o card pede o produto do campo acima e não gera.
  await expect(gen).toContainText("Escolha o produto no campo acima");
  await expect(gen.locator("[data-generate-submit]")).toBeDisabled();
  await expect(first.locator("[data-schedule-on]")).toBeDisabled();

  // Boneca: 61 caixas = 2.928 peças; a quantidade do produto acompanha.
  await pick(page, 0, "boneca", "prod-boneca");
  await expect(gen).not.toContainText("Escolha o produto no campo acima");
  await gen.locator("[data-generate-total]").fill("61");
  await expect(gen.locator("[data-selection-quantity]")).toHaveValue("2928");
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("2928");

  // Duas programações com sobra: 31 + 30 caixas (o resto vai para a 1ª).
  await gen.locator("[data-generate-rounds]").fill("2");
  await gen.locator("[data-generate-submit]").click();
  const qty = (n: number, i: number) =>
    page.locator(`input[name="p${n}.schedule.qty.${i}"]`);
  await expect(first.locator("[data-schedule-item]")).toHaveCount(2);
  await expect(qty(0, 1)).toHaveValue("1488");
  await expect(qty(0, 2)).toHaveValue("1440");
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("2928");
  // A conta de containers do card de referência (40HC, ocupação).
  await expect(first.locator("[data-round-fill]").first()).toBeVisible();
  await expect(first.locator("[data-schedule-load]").first()).toContainText(
    "31",
  );

  // Ajuste manual: "+ Aumentar" fecha o container da 1ª programação; a
  // quantidade do produto vira a soma.
  const up = first.locator('[data-schedule-item="1"] [data-round-up]').first();
  const target = await up.getAttribute("data-round-up");
  await up.click();
  await expect(qty(0, 1)).toHaveValue(target!);
  const sum = Number(target) + 1440;
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue(
    String(sum),
  );

  // Trocar o produto depois de gerar: a programação sai e o card avisa.
  await row(page, 0).locator("[data-product-picker-input]").fill("jarra");
  await row(page, 0)
    .locator('[data-product-picker-option="prod-jarra"]')
    .click();
  await expect(first.locator("[data-schedule-item]")).toHaveCount(0);
  await expect(first.locator("[data-schedule-regenerate]")).toBeVisible();
  await expect(page.locator('input[name="p0.schedule.count"]')).toHaveCount(0);
  // De volta à boneca, gera de novo (61 caixas em 2).
  await row(page, 0).locator("[data-product-picker-input]").fill("boneca");
  await row(page, 0)
    .locator('[data-product-picker-option="prod-boneca"]')
    .click();
  await gen.locator("[data-generate-total]").fill("61");
  await gen.locator("[data-generate-submit]").click();
  await expect(qty(0, 1)).toHaveValue("1488");
  await expect(first.locator("[data-schedule-regenerate]")).toHaveCount(0);
  await page.fill('textarea[name="p0.description"]', "Boneca programada");

  // Segundo produto, com a própria programação: piscina (pedido mínimo de
  // 300 peças), 60 caixas de 6 em 3 = 120 peças por programação.
  await page.click("[data-add-request-item]");
  await pick(page, 1, "piscina", "prod-piscina");
  const gen2 = row(page, 1).locator("[data-rounds-generator]");
  await gen2.locator("[data-generate-total]").fill("60");
  await gen2.locator("[data-generate-rounds]").fill("3");
  await gen2.locator("[data-generate-submit]").click();
  await expect(qty(1, 1)).toHaveValue("120");
  await expect(qty(1, 2)).toHaveValue("120");
  await expect(qty(1, 3)).toHaveValue("120");
  await expect(page.locator('input[name="p1.quantity"]')).toHaveValue("360");
  await page.fill('textarea[name="p1.description"]', "Piscina programada");
  // A boneca segue com a dela.
  await expect(qty(0, 1)).toHaveValue("1488");

  // Envia e reabre: cada produto com as datas e quantidades confirmadas.
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await page.waitForURL(/\/app\/requests\/batch\/[^?]+\?created=2$/);
  for (const [text, values] of [
    ["Boneca articulada", ["1.488", "1.440", "2.928"]],
    ["Piscina inflável", ["120", "360"]],
  ] as const) {
    const batchUrl = page.url();
    await page
      .locator(
        `[data-batch-item]:has-text('${text}') a[href^='/app/requests/']`,
      )
      .first()
      .click();
    await page.waitForURL(/\/app\/requests\/(?!new|batch)[^/?]+$/);
    const table = page.locator("[data-request-schedule-table]");
    for (const v of values) await expect(table).toContainText(v);
    await page.goto(batchUrl);
  }
});
