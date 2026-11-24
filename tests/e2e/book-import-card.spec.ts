import { expect, test, type Page } from "@playwright/test";
import { bookingSheet, fillBookMeta, login } from "./helpers";

/*
 * Card "Planilha do book" compacto (dono, 24/11/2026; docs/BOOKING.md, "Card
 * Planilha do book"): "Moeda padrão" estreita, Moeda | Nº da loja | Nome do
 * supplier | Tipo de item numa linha no computador e no iPad deitado, duas
 * linhas no celular, sem rolagem para o lado. Só a apresentação mudou: a
 * moeda escolhida continua valendo para o preço sem moeda na linha nem no
 * cabeçalho.
 */

const FIELDS = [
  'select[name="currency"]',
  "[data-book-store-number]",
  "[data-book-supplier-name]",
  "[data-book-item-type]",
];

/** Posição e tamanho dos quatro campos da linha, em px. */
async function row(page: Page) {
  return Promise.all(
    FIELDS.map(async (sel) => {
      const box = await page
        .locator(`[data-booking-import-form] ${sel}`)
        .boundingBox();
      return {
        top: Math.round(box!.y),
        width: Math.round(box!.width),
        height: Math.round(box!.height),
      };
    }),
  );
}

const noSideScroll = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );

test("Planilha do book: Moeda padrão estreita e os quatro campos numa linha; a moeda escolhida vale para o preço sem moeda", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "admin@wellmix.com");
  await page.goto("/app/booking/import");
  const form = page.locator("[data-booking-import-form]");
  await expect(
    form.locator("[data-field-label]", { hasText: /^Moeda padrão$/ }),
  ).toBeVisible();
  await expect(form.locator("[data-book-import-currency-hint]")).toHaveText(
    "Moeda padrão · Aplicada apenas aos preços sem moeda na coluna ou no cabeçalho.",
  );

  // Computador (1440) e iPad deitado mais estreito (1080): uma linha só, a
  // moeda de 110 a 130 px, os outros perto de 130 px, campos de 36 a 40 px.
  for (const width of [1440, 1080]) {
    await page.setViewportSize({ width, height: 900 });
    const fields = await row(page);
    expect(new Set(fields.map((f) => f.top)).size, `${width}px`).toBe(1);
    expect(fields[0].width).toBeGreaterThanOrEqual(110);
    expect(fields[0].width).toBeLessThanOrEqual(130);
    for (const f of fields.slice(1)) {
      expect(f.width).toBeGreaterThanOrEqual(108);
      expect(f.width).toBeLessThanOrEqual(130);
    }
    for (const f of fields) {
      expect(f.height).toBeGreaterThanOrEqual(36);
      expect(f.height).toBeLessThanOrEqual(40);
    }
    expect(await noSideScroll(page)).toBe(true);
  }

  // Celular: duas linhas (moeda e loja; supplier e tipo), moeda compacta.
  await page.setViewportSize({ width: 390, height: 844 });
  const phone = await row(page);
  expect(phone[0].top).toBe(phone[1].top);
  expect(phone[2].top).toBe(phone[3].top);
  expect(phone[2].top).toBeGreaterThan(phone[0].top);
  expect(phone[0].width).toBeLessThanOrEqual(130);
  expect(await noSideScroll(page)).toBe(true);

  // A moeda escolhida vale para o preço sem moeda na coluna nem no cabeçalho.
  await page.setViewportSize({ width: 1440, height: 900 });
  const currency = form.locator('select[name="currency"]');
  await expect(currency).toHaveValue("USD");
  await currency.selectOption("RMB");
  await form
    .locator("input[type=file]")
    .setInputFiles(
      bookingSheet(
        "Shenzhen Supplier A",
        `CARD-${Date.now()}`,
        "Copo de vidro do card",
        undefined,
        { coin: "", coinHeader: "COIN" },
      ),
    );
  await fillBookMeta(page);
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  await expect(
    page.locator('[data-booking-item-field$=":currency"] select').first(),
  ).toHaveValue("RMB");
});
