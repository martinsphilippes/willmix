import { expect, test, type Locator, type Page } from "@playwright/test";
import { bookingSheet, chooseItem, importAndClose, login } from "./helpers";

/*
 * Um gerador só no portal (dono, 14/11/2026): o bloco "Programação de
 * compra" da Seleção de itens e o da Nova solicitação são o mesmo componente
 * com a mesma conta. Com a mesma entrada (a caixa da boneca do cadastro: 48
 * peças e 0,1202 m³; 300 caixas em 2 datas), as duas telas mostram o mesmo
 * cálculo, as mesmas peças por data e os mesmos containers. Na Seleção, 13
 * datas (sem o teto de 12) são gravadas, voltam ao rever a escolha e vão
 * para a solicitação ao fornecedor.
 */

const TAG = `PRG${Date.now().toString(36).toUpperCase()}`;

/** O que o bloco mostra: o cálculo, os containers e cada programação. */
async function snapshot(scope: Locator) {
  const gen = scope.locator("[data-rounds-generator]");
  const text = (sel: string) => gen.locator(sel).innerText();
  return {
    item: await text('[data-generate-item="ok"]'),
    result: await text("[data-generate-result]"),
    each: await text("[data-generate-each]"),
    containers: await text("[data-generate-containers]"),
    perRound: await text("[data-generate-per-round]"),
    total: await text("[data-generate-total-containers]"),
    pieces: await scope
      .locator('input[name*="schedule.qty."]')
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value)),
    load: await scope.locator("[data-schedule-load]").allInnerTexts(),
    status: await scope.locator("[data-round-status]").allInnerTexts(),
  };
}

async function generate(scope: Locator, cartons: string, rounds: string) {
  const gen = scope.locator("[data-rounds-generator]");
  await gen.locator("[data-generate-total]").fill(cartons);
  await gen.locator("[data-generate-rounds]").fill(rounds);
  await gen.locator("[data-generate-submit]").click();
}

async function openSelection(page: Page, code: string) {
  await page.goto(`/app/booking/selection?q=${encodeURIComponent(TAG)}`);
  await page.locator("input[data-basket-all]").check();
  await page.click("[data-selection-group]");
  await page.waitForURL(/tab=selection&ids=/);
  await chooseItem(page, code);
}

test("Programação de compra: a mesma entrada nas duas telas e 13 datas gravadas na Seleção", async ({
  page,
}) => {
  const code = `${TAG}-A`;
  await login(page, "admin@wellmix.com");
  // Item do Book com a caixa da boneca do cadastro: 48 peças, 0,1202 m³.
  await importAndClose(
    page,
    bookingSheet("Shenzhen Supplier A", code, `Boneca ${TAG}`, undefined, {
      cbm: "0.1202",
    }),
    "Shenzhen Supplier A",
  );

  // 1. Seleção de itens: 300 caixas em 2 datas.
  await openSelection(page, code);
  const choice = page.locator("[data-selection-quantity-block]");
  await expect(choice.locator("[data-request-schedule] > legend")).toHaveText(
    "Programação de compra",
  );
  await generate(choice, "300", "2");
  await expect(choice.locator("[data-schedule-item]")).toHaveCount(2);
  const selection = await snapshot(choice);
  expect(selection.pieces).toEqual(["7200", "7200"]);
  expect(selection.result).toContain("300 caixas (14.400 peças)");
  expect(selection.perRound).toBe("1");
  expect(selection.total).toBe("2");
  expect(selection.status).toEqual([
    "1 container previsto · 26% ocupado",
    "1 container previsto · 26% ocupado",
  ]);

  // 2. Nova solicitação: a boneca do cadastro e a mesma entrada dão o mesmo.
  await page.goto("/app/requests/new");
  const line = page.locator('[data-request-item="0"]');
  const picker = line.locator('[data-product-picker="catalog"]');
  await picker.locator("[data-product-picker-input]").fill("boneca");
  await picker.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(line.locator('[role="status"]').first()).toBeVisible();
  await expect(line.locator('[data-generate-item="ok"]')).toBeVisible();
  await generate(line, "300", "2");
  await expect(line.locator("[data-schedule-item]")).toHaveCount(2);
  expect(await snapshot(line)).toEqual(selection);

  // 3. Seleção: 12 datas, "+ Programação" → 13 (sem o teto de 12), gravar.
  await openSelection(page, code);
  await generate(choice, "300", "12");
  await expect(choice.locator("[data-schedule-item]")).toHaveCount(12);
  await choice.locator("[data-schedule-add]").click();
  await expect(choice.locator("[data-schedule-item]")).toHaveCount(13);
  const before = await snapshot(choice);
  expect(before.pieces).toEqual(["1152", ...Array(12).fill("1104")]);
  const dates = await choice.locator("[data-schedule-date]").allInnerTexts();
  expect(dates).toHaveLength(13);
  await page.click("[data-selection-submit]");
  await page.waitForURL(/[?&]saved=1/);
  const resolved = page.locator("[data-selection-resolved=saved]");
  await expect(resolved).toHaveCount(1);

  // 4. Rever a escolha: as 13 programações voltam com as peças e as datas.
  await resolved.locator("[data-selection-block-open]").click();
  await page.waitForURL(
    (u) => u.searchParams.has("ids") && !u.searchParams.has("saved"),
  );
  await expect(choice.locator("[data-schedule-item]")).toHaveCount(13);
  expect((await snapshot(choice)).pieces).toEqual(before.pieces);
  expect(await choice.locator("[data-schedule-date]").allInnerTexts()).toEqual(
    dates,
  );
  await page.goBack();

  // 5. A solicitação ao fornecedor leva as 13 programações.
  await page.click("[data-selection-open-all]");
  await page.waitForURL(/\/app\/supplier-requests\/[^/?]+\?.*created=1/);
  const schedule = page.locator("[data-purchase-schedule]");
  await expect(schedule).toBeVisible();
  // 13 programações e a linha do total.
  await expect(schedule.locator("tbody tr")).toHaveCount(14);
  await expect(schedule).toContainText("1.152");
  await expect(schedule).toContainText("14.400");
});
