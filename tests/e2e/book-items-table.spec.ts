import {
  devices,
  expect,
  test,
  type Locator,
  type Page,
} from "@playwright/test";
import { fillBookMeta, login } from "./helpers";
import { PNG_1X1, xlsxBytes } from "../unit/xlsx-fixture";

/*
 * Tabela de itens do Book (Produto novo → Books; dono, 16/11/2026):
 * - INNER opcional: sem asterisco, em branco não fica destacado nem conta
 *   como faltando, grava vazio (sem zero), o Book fecha e a consulta mostra
 *   "—"; preenchido, o número continua validado.
 * - Coluna FOTO presa na rolagem para o lado (a tabela com cabeçalho
 *   congelado; a primeira coluna, "#", também fica presa e a FOTO vem logo
 *   depois dela): rolando até a última coluna e depois a página para baixo,
 *   as fotos continuam à vista, por cima das outras colunas, alinhadas às
 *   linhas e ao título. No desktop e na tela do iPad.
 */

const SUPPLIER = "Shenzhen Supplier A";
const ITEMS = 8;
const HEADER = [
  "DATE",
  "LOCAL",
  "SUPPLIER NAME",
  "SKU/FACTORY ITEM CODE",
  "DESCRIPTION",
  "FOB/EXW",
  "CONI US $/RMB",
  "PRICE",
  "QTY/BOX",
  "QTY/INNER",
  "N.W./PC",
  "G.W./PC",
  "CBM",
  "SIZE(CM) LENGTH",
  "SIZE(CM) WIDTH",
  "SIZE(CM) HEIGHT",
  "CAPACITY(ML)",
  "PACKAGE",
  "MATERIAL",
  "MOQ",
  "PURCHASE QTY IN PCS",
  "PHOTO",
];
const PHOTO_COL = HEADER.indexOf("PHOTO");

const line = (code: string, description: string, inner: string) => [
  "2026.10.13",
  "Yiwu",
  SUPPLIER,
  code,
  description,
  "FOB",
  "USD",
  "1.25",
  "48",
  inner,
  "0.3",
  "0.35",
  "0.12",
  "10",
  "8",
  "20",
  "350",
  "color box",
  "glass",
  "1000",
  "3000",
  "",
];

/** Itens com foto: o primeiro sem INNER, os outros com 12. */
function sheet(tag: string) {
  const rows = Array.from({ length: ITEMS }, (_, i) =>
    line(`${tag}-${i + 1}`, `Copo ${i + 1} ${tag}`, i === 0 ? "" : "12"),
  );
  return {
    name: `book-inner-${tag}.xlsx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(
      xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }], {
        images: rows.map((_, i) => ({
          sheet: 0,
          col: PHOTO_COL,
          row: i + 1,
          bytes: PNG_1X1,
          ext: "png" as const,
        })),
      }),
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
  await expect(page.locator("[data-booking-item]")).toHaveCount(ITEMS);
}

/** Os títulos das colunas (o cabeçalho congelado, linha que ordena). */
const titles = (page: Page) =>
  page.locator("[data-table-sticky-head] tr[data-table-sort-row] th");

/** Posição da coluna pelo título (a mesma no cabeçalho e no corpo). */
const columnIndex = (page: Page, title: RegExp) =>
  titles(page).evaluateAll(
    (ths, source) =>
      ths.findIndex((th) =>
        new RegExp(source, "i").test((th.textContent ?? "").trim()),
      ),
    title.source,
  );

const cellAt = (row: Locator, index: number) =>
  row.locator(":scope > td").nth(index);

/** O aviso da célula ("saved", "error") ao lado do campo. */
const note = (input: Locator, state: string) =>
  input.locator("xpath=..").locator(`[data-booking-row-note="${state}"]`);

/**
 * O teste do dono: rola a tabela até a última coluna e depois a página para
 * baixo; as fotos continuam à vista, por cima das colunas que passam,
 * alinhadas às linhas e ao título. De volta ao início, a FOTO fica logo
 * depois do "#".
 */
async function checkPhotos(page: Page) {
  const body = page.locator("[data-table-sticky-body]");
  const head = page.locator("[data-table-sticky-head]");
  const first = titles(page).nth(0);
  const photo = titles(page).nth(1);
  const rows = page.locator("[data-booking-item]");
  await expect(photo).toHaveText(/foto/i);
  await page.locator("[data-table-frame]").scrollIntoViewIfNeeded();

  await body.evaluate((el) => (el.scrollLeft = 0));
  const f0 = (await first.boundingBox())!;
  const p0 = (await photo.boundingBox())!;
  expect(Math.abs(p0.x - (f0.x + f0.width))).toBeLessThan(2);

  // Até a última coluna (o cabeçalho acompanha).
  await body.evaluate((el) => (el.scrollLeft = el.scrollWidth));
  await expect
    .poll(() =>
      body.evaluate((el) => el.scrollLeft + el.clientWidth - el.scrollWidth),
    )
    .toBeGreaterThanOrEqual(-1);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const b = document.querySelector("[data-table-sticky-body]")!;
        const h = document.querySelector("[data-table-sticky-scroll]")!;
        return Math.abs(b.scrollLeft - h.scrollLeft);
      }),
    )
    .toBeLessThan(1);

  const pinned = async () => {
    const box = (await body.boundingBox())!;
    const f = (await first.boundingBox())!;
    const p = (await photo.boundingBox())!;
    const last = (await titles(page).last().boundingBox())!;
    expect(Math.abs(f.x - box.x)).toBeLessThan(2);
    expect(Math.abs(p.x - (f.x + f.width))).toBeLessThan(2);
    expect(last.x + last.width).toBeLessThanOrEqual(box.x + box.width + 1);
    const headBox = (await head.boundingBox())!;
    const viewport = page.viewportSize()!;
    let seen = 0;
    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i);
      const r = (await row.boundingBox())!;
      if (r.y + r.height < 0 || r.y > viewport.height) continue;
      seen++;
      const cell = row.locator("[data-booking-item-photo]");
      const c = (await cell.boundingBox())!;
      // Embaixo do título e na altura da própria linha.
      expect(Math.abs(c.x - p.x)).toBeLessThan(2);
      expect(Math.abs(c.y - r.y)).toBeLessThan(1);
      expect(Math.abs(c.height - r.height)).toBeLessThan(1);
      await expect(cell.locator("img").first()).toBeVisible();
      // No lugar da foto aparece a foto: as outras colunas passam por trás.
      const x = c.x + c.width / 2;
      const y = c.y + c.height / 2;
      if (y > headBox.y + headBox.height && y < viewport.height)
        expect(
          await page.evaluate(
            ([px, py]) =>
              !!document
                .elementFromPoint(px, py)
                ?.closest("[data-booking-item-photo]"),
            [x, y],
          ),
        ).toBe(true);
    }
    expect(seen).toBeGreaterThan(0);
  };
  await pinned();
  // A página para baixo: o cabeçalho fica no alto e as fotos acompanham.
  await page.evaluate(() => window.scrollBy(0, 300));
  await pinned();

  await body.evaluate((el) => (el.scrollLeft = 0));
  const f1 = (await first.boundingBox())!;
  const p1 = (await photo.boundingBox())!;
  expect(Math.abs(p1.x - (f1.x + f1.width))).toBeLessThan(2);
}

test("Book: INNER opcional e fotos presas na rolagem (desktop)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const tag = `IN${Date.now().toString(36)}`;
  await login(page, "admin@wellmix.com");
  await importBook(page, tag);
  const rows = page.locator("[data-booking-item]");

  // INNER sem asterisco; os outros obrigatórios continuam com ele.
  const innerAt = await columnIndex(page, /^Qtd\/inner/);
  const boxAt = await columnIndex(page, /^Qtd\/caixa/);
  expect(innerAt).toBeGreaterThan(1);
  await expect(titles(page).nth(innerAt)).not.toContainText("*");
  await expect(titles(page).nth(boxAt)).toContainText("*");

  // Em branco (da planilha): sem valor, sem destaque, fora do que falta.
  const id1 = await rows.nth(0).getAttribute("data-booking-item");
  const id2 = await rows.nth(1).getAttribute("data-booking-item");
  const inner1 = page.locator(
    `input[data-booking-item-field="${id1}:innerQty"]`,
  );
  const inner2 = page.locator(
    `input[data-booking-item-field="${id2}:innerQty"]`,
  );
  await expect(inner1).toHaveValue("");
  await expect(inner2).toHaveValue("12");
  await expect(inner1.locator("xpath=../..")).not.toHaveClass(/ring-amber-300/);
  for (const missing of await rows
    .nth(0)
    .locator("[data-booking-item-missing]")
    .evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-booking-item-missing") ?? ""),
    ))
    expect(missing).not.toContain("innerQty");

  // Preencher e apagar: grava vazio (sem zero).
  await inner1.fill("6");
  await inner1.press("Enter");
  await expect(note(inner1, "saved")).toBeVisible();
  await inner1.fill("");
  await inner1.press("Enter");
  // Preenchido, o número continua validado.
  await inner2.fill("abc");
  await inner2.press("Enter");
  await expect(note(inner2, "error")).toBeVisible();
  await page.reload();
  await expect(inner1).toHaveValue("");
  await expect(inner2).toHaveValue("12");

  await checkPhotos(page);

  // Fecha com o INNER em branco (o NCM é obrigatório: a Wellmix preenche).
  await page.evaluate(() => window.scrollTo(0, 0));
  const ncm = page.locator("input[data-booking-item-ncm]");
  for (let i = 0; i < (await ncm.count()); i++) {
    const input = ncm.nth(i);
    if (await input.inputValue()) continue;
    await input.fill("7013.37.00");
    await input.press("Enter");
    await expect(note(input, "saved")).toBeVisible();
  }
  await page.click("[data-booking-lot-close-submit]");
  await page.waitForURL(/[?&]closed=1/);

  // Consulta: "—" no INNER sem valor e o número nos outros.
  await expect(cellAt(rows.nth(0), innerAt)).toHaveText("—");
  await expect(cellAt(rows.nth(1), innerAt)).toHaveText("12");
  await checkPhotos(page);
});

test.describe("tela do iPad", () => {
  // O iPad do Playwright usa o WebKit, que não vem instalado neste ambiente:
  // aqui é o Chromium com a tela, o toque e a identificação do iPad.
  const { defaultBrowserType: _webkit, ...ipad } = devices["iPad Pro 11"];
  void _webkit;
  test.use(ipad);

  test("Book: fotos presas na rolagem na tela do iPad", async ({ page }) => {
    const tag = `IP${Date.now().toString(36)}`;
    await login(page, "admin@wellmix.com");
    await importBook(page, tag);
    const innerAt = await columnIndex(page, /^Qtd\/inner/);
    await expect(titles(page).nth(innerAt)).not.toContainText("*");
    await checkPhotos(page);
  });
});
