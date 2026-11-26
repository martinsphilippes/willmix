import { expect, test } from "@playwright/test";
import { bookingSheet, chooseItem, fillBookMeta, login } from "./helpers";

/*
 * Grupo de um item só na Seleção de itens (dono, 26/11/2026;
 * docs/PURCHASE_SCHEDULE.md, "De qual item é a caixa"): a caixa da conta é a
 * do item, sem marcar "Escolher", também no book em rascunho (em que
 * "Escolher" fica desligado), como o produto único da Nova solicitação.
 * "Total de caixas" vira "Quantidade (peças)" e "Gerar programação" gera.
 * Com o book fechado, marcar o item depois não desfaz a programação.
 */

const TAG = `UNI${Date.now().toString(36).toUpperCase()}`;

test("Seleção: grupo de um item só faz a conta e gera a programação sem Escolher", async ({
  page,
}) => {
  const code = `${TAG}-A`;
  await login(page, "admin@wellmix.com");
  // Book em rascunho (sem fechar): 48 peças e 0,12 m³ por caixa master.
  await page.goto("/app/booking/import");
  await page
    .locator("[data-booking-import-form] input[type=file]")
    .setInputFiles(bookingSheet("Shenzhen Supplier A", code, `Boneca ${TAG}`));
  await fillBookMeta(page);
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  const lotUrl = page.url().replace(/\?.*$/, "");

  // Seleção de itens: o item sozinho num grupo.
  await page.goto(`/app/booking/selection?q=${encodeURIComponent(TAG)}`);
  await page.locator("input[data-basket-all]").check();
  await page.click("[data-selection-group]");
  await page.waitForURL(/tab=selection&ids=/);
  const groupUrl = page.url();
  await expect(page.locator("[data-selection-item]")).toHaveCount(1);
  // Rascunho: "Escolher" desligado.
  await expect(page.locator("input[data-selection-choose]")).toBeDisabled();

  const gen = page.locator("[data-rounds-generator]");
  const boxes = gen.locator("[data-generate-total]");
  const pieces = gen.locator("[data-selection-quantity]");
  await expect(gen.locator("[data-generate-select-item]")).toHaveCount(0);
  await expect(gen.locator('[data-generate-item="ok"]')).toBeVisible();
  // Sem nada digitado: as 3.000 peças da planilha em caixas inteiras.
  await expect(boxes).toHaveValue("63");
  await boxes.fill("100");
  await expect(pieces).toHaveValue("4800");
  await expect(pieces).not.toBeEditable();
  await gen.locator("[data-generate-rounds]").fill("2");
  const submit = gen.locator("[data-generate-submit]");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator("[data-schedule-item]")).toHaveCount(2);
  await expect(page.locator('input[name="schedule.qty.1"]')).toHaveValue(
    "2400",
  );
  await expect(page.locator('input[name="schedule.qty.2"]')).toHaveValue(
    "2400",
  );

  // Book fechado: marcar o item (o único) não desfaz a programação gerada.
  await page.goto(lotUrl);
  const ncm = page.locator("input[data-booking-item-ncm]").first();
  if (!(await ncm.inputValue())) {
    await ncm.fill("7013.37.00");
    await ncm.press("Enter");
    await expect(
      page.locator('[data-booking-row-note="saved"]').first(),
    ).toBeVisible();
  }
  await page.click("[data-booking-lot-close-submit]");
  await page.waitForURL(/[?&]closed=1/);
  await page.goto(groupUrl);
  await expect(page.locator("input[data-selection-choose]")).toBeEnabled();
  await gen.locator("[data-generate-total]").fill("10");
  await expect(pieces).toHaveValue("480");
  await gen.locator("[data-generate-rounds]").fill("2");
  await gen.locator("[data-generate-submit]").click();
  await expect(page.locator("[data-schedule-item]")).toHaveCount(2);
  await chooseItem(page, code);
  await expect(page.locator("[data-schedule-item]")).toHaveCount(2);
  await expect(page.locator("[data-schedule-regenerate]")).toHaveCount(0);
  await expect(page.locator('input[name="schedule.qty.1"]')).toHaveValue("240");
});
