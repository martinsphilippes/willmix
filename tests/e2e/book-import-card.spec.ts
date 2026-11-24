import { expect, test, type Page } from "@playwright/test";
import { bookingSheet, fillBookMeta, login } from "./helpers";

/*
 * Card "Planilha do book" compacto, pelo desenho do dono (24/11/2026;
 * docs/BOOKING.md, "Card Planilha do book"): "Moeda padrão" estreita com o
 * ⓘ, Moeda | Nº da loja | Nome do supplier | Tipo de item numa linha no
 * computador e no iPad deitado (moeda e loja estreitas, supplier e tipo
 * dividem o resto), duas linhas no celular, sem rolagem para o lado. Só a
 * apresentação mudou: a moeda escolhida continua valendo para o preço sem
 * moeda na linha nem no cabeçalho.
 */

const FIELDS = [
  'select[name="currency"]',
  "[data-book-store-number]",
  "[data-book-supplier-name]",
  "[data-book-item-type]",
];

type Box = { top: number; left: number; right: number; width: number; height: number };

async function boxOf(page: Page, sel: string): Promise<Box> {
  const b = await page.locator(`[data-booking-import-form] ${sel}`).boundingBox();
  return {
    top: Math.round(b!.y),
    left: Math.round(b!.x),
    right: Math.round(b!.x + b!.width),
    width: Math.round(b!.width),
    height: Math.round(b!.height),
  };
}

/** Os quatro campos da linha. */
const row = (page: Page) => Promise.all(FIELDS.map((sel) => boxOf(page, sel)));

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
  await expect(
    form.locator("[data-field-label]", { hasText: /^Ou link do Google Sheets$/ }),
  ).toBeVisible();
  await expect(form.locator("[data-book-import-currency-hint]")).toHaveText(
    "Moeda padrão: aplicada apenas aos preços sem moeda na coluna ou no cabeçalho.",
  );
  // O ⓘ ao lado de "Moeda padrão" abre a explicação.
  await form.getByRole("button", { name: "Sobre a moeda padrão" }).click();
  await expect(
    page.getByText(
      "Aplicada apenas aos preços sem moeda na coluna ou no cabeçalho.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // Computador: uma linha; moeda e loja estreitas; supplier e tipo dividem o
  // resto até a borda do card; a dica do tipo fica sob o próprio campo.
  const wide = await row(page);
  expect(new Set(wide.map((f) => f.top)).size).toBe(1);
  expect(wide[0].width).toBeGreaterThanOrEqual(110);
  expect(wide[0].width).toBeLessThanOrEqual(130);
  expect(wide[1].width).toBeGreaterThanOrEqual(108);
  expect(wide[1].width).toBeLessThanOrEqual(130);
  expect(wide[2].width).toBeGreaterThan(150);
  expect(Math.abs(wide[2].width - wide[3].width)).toBeLessThanOrEqual(1);
  const url = await boxOf(page, 'input[name="sheetUrl"]');
  expect(Math.abs(wide[3].right - url.right)).toBeLessThanOrEqual(1);
  const typeHint = await boxOf(page, "[data-book-import-type-hint]");
  expect(Math.abs(typeHint.left - wide[3].left)).toBeLessThanOrEqual(1);
  for (const f of wide) {
    expect(f.height).toBeGreaterThanOrEqual(36);
    expect(f.height).toBeLessThanOrEqual(40);
  }
  expect(await noSideScroll(page)).toBe(true);

  // iPad deitado mais estreito (1080): ainda uma linha, moeda compacta.
  await page.setViewportSize({ width: 1080, height: 810 });
  const ipad = await row(page);
  expect(new Set(ipad.map((f) => f.top)).size).toBe(1);
  expect(ipad[0].width).toBeGreaterThanOrEqual(110);
  expect(ipad[0].width).toBeLessThanOrEqual(130);
  expect(ipad[2].width).toBeGreaterThanOrEqual(100);
  expect(Math.abs(ipad[2].width - ipad[3].width)).toBeLessThanOrEqual(1);
  expect(await noSideScroll(page)).toBe(true);

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
