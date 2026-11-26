import { expect, test, type Page } from "@playwright/test";
import { fillBookMeta, login } from "./helpers";
import { PNG_1X1, xlsxBytes } from "../unit/xlsx-fixture";

/*
 * Fotos do item do book (dono, 26/11/2026; docs/BOOKING.md, "Fotos da
 * planilha" e "Fotos do item"):
 * - a coluna "PHOTOS" (no plural) é lida, e as duas fotos da mesma linha
 *   entram no item (a de cima é a principal);
 * - o "+" da célula Foto carrega mais fotos no item sem foto;
 * - a galeria troca a principal e tira uma foto do item;
 * - "Buscar as fotos na planilha" aparece enquanto há item sem foto.
 */

const HEADER = [
  "PHOTOS",
  "DATE",
  "LOCAL",
  "SUPPLIER NAME",
  "SKU/FACTORY ITEM CODE",
  "DESCRIPTION",
  "FOB/EXW",
  "CONI US $/RMB",
  "PRICE",
  "QTY/BOX",
  "MOQ",
];

const line = (code: string) => [
  "",
  "2026.10.13",
  "Yiwu",
  "Shenzhen Supplier A",
  code,
  `Espelho ${code}`,
  "FOB",
  "USD",
  "1.25",
  "48",
  "1000",
];

/** PNG com um byte a mais no fim (cada foto é um arquivo diferente). */
const png = (n: number) => {
  const out = new Uint8Array(PNG_1X1.length + 1);
  out.set(PNG_1X1);
  out[out.length - 1] = n;
  return out;
};

function sheet(tag: string) {
  return {
    name: `book-fotos-${tag}.xlsx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(
      xlsxBytes(
        [
          {
            name: "BOOKING",
            cells: [HEADER, line(`${tag}-1`), line(`${tag}-2`)],
          },
        ],
        {
          images: [
            { sheet: 0, col: 0, row: 1, bytes: png(1), ext: "png" },
            {
              sheet: 0,
              col: 0,
              row: 1,
              rowOff: 4000,
              bytes: png(2),
              ext: "png",
            },
          ],
        },
      ),
    ),
  };
}

async function importBook(page: Page, tag: string) {
  await page.goto("/app/booking/import");
  await page
    .locator("[data-booking-import-form] input[type=file]")
    .setInputFiles(sheet(tag));
  await fillBookMeta(page);
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  await expect(page.locator("[data-booking-item]")).toHaveCount(2);
}

test("Book: fotos da coluna PHOTOS, carregar, trocar a principal e tirar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const tag = `FT${Date.now().toString(36)}`;
  await login(page, "admin@wellmix.com");
  await importBook(page, tag);
  const rows = page.locator("[data-booking-item]");
  const first = rows.nth(0);
  const second = rows.nth(1);

  // As duas fotos da linha 2 da planilha entraram no item.
  await expect(
    first.locator("[data-booking-item-photo-count='2']"),
  ).toBeVisible();
  await expect(first.locator("[data-booking-item-photo] img")).toHaveCount(3);
  // Item sem foto: o aviso para buscar na planilha e o "+".
  await expect(
    page.locator("[data-booking-lot-photos-reload='1']"),
  ).toBeVisible();
  await second
    .locator("[data-booking-item-photo-add='cell'] input[type=file]")
    .setInputFiles({
      name: "foto.png",
      mimeType: "image/png",
      buffer: Buffer.from(png(3)),
    });
  await expect(
    second.locator("[data-booking-item-photo-count='1']"),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-booking-lot-photos-reload]")).toHaveCount(0);

  // Galeria do primeiro item: a segunda vira a principal, depois sai.
  await first.getByRole("button", { name: /Fotos do item \(2\)/ }).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog.locator("[data-booking-item-photo-doc]")).toHaveCount(2);
  const docs = await dialog
    .locator("[data-booking-item-photo-doc]")
    .evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-booking-item-photo-doc")),
    );
  await dialog
    .locator(`[data-booking-item-photo-doc='${docs[1]}']`)
    .getByRole("button", { name: "Tornar principal" })
    .click();
  await expect(
    first.locator(`[data-booking-item-photo] a[href='/api/files/${docs[1]}']`),
  ).toBeVisible({ timeout: 20_000 });
  await first.getByRole("button", { name: /Fotos do item \(2\)/ }).click();
  await page
    .locator("dialog[open]")
    .locator(`[data-booking-item-photo-doc='${docs[0]}']`)
    .getByRole("button", { name: "Tirar do item" })
    .click();
  await expect(
    first.locator("[data-booking-item-photo-count='1']"),
  ).toBeVisible({ timeout: 20_000 });
});
