import { expect, test, type Page } from "@playwright/test";
import { fillBookMeta, login } from "./helpers";
import { xlsxBytes } from "../unit/xlsx-fixture";

/*
 * Dinâmica dos books (dono, 23/11/2026; docs/BOOKING.md): várias planilhas
 * num book com Loja/Fábrica e Tipo de item; a linha de cima preenche todas
 * as linhas quando nenhuma está marcada; a seta para baixo desce de célula;
 * os itens marcados vão direto para a Seleção de itens; a trava esconde o
 * book dos outros analistas e quem supervisiona vê com quem está.
 */
const TAG = `BW${Date.now().toString(36).toUpperCase()}`;
const TYPE = `Vidro ${TAG}`;

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
];
const row = (n: number, supplier = "Shenzhen Supplier A") => [
  "2026.10.13",
  "Yiwu",
  supplier,
  `${TAG}-${n}`,
  `Zqw widget ${TAG} ${n}`,
  "FOB",
  "RMB",
  "1.25",
  "48",
  "12",
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
];
const sheet = (name: string, rows: number[], supplier?: string) => ({
  name,
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  buffer: Buffer.from(
    xlsxBytes([
      {
        name: "BOOKING",
        cells: [HEADER, ...rows.map((n) => row(n, supplier))],
      },
    ]),
  ),
});

const head = (page: Page) => page.locator("[data-table-sticky-head]");

test("Book do fornecedor: várias planilhas, preencher todas as linhas e seta para baixo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "supplier.a@china.com");
  await page.goto("/app/booking/import");
  await page
    .locator("[data-partner-booking-launch-form] input[type=file]")
    .setInputFiles([
      sheet("um.xlsx", [1, 2, 3]),
      sheet("dois.xlsx", [4, 5]),
      // Uma linha de outro fabricante (a Fábrica do book é a Supplier A).
      sheet("tres.xlsx", [9], "Outra Fabrica Ltd"),
    ]);
  await expect(page.locator("[data-sheet-import-files]")).toHaveAttribute(
    "data-sheet-import-files",
    "3",
  );
  await fillBookMeta(page, TYPE);
  await page.locator("[data-book-supplier-name]").fill("Shenzhen Supplier A");
  await page.locator("[data-partner-booking-launch-submit]").click();
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  const lines = page.locator("tr[data-partner-booking-item]");
  // O book é a soma das planilhas, na ordem.
  await expect(lines).toHaveCount(6);
  // Fabricante: a Fábrica digitada repetida em todas as linhas; a linha de
  // outro fabricante fica marcada e o book não é enviado com ela.
  await expect(page.locator("[data-book-manufacturer-alert]")).toHaveAttribute(
    "data-book-manufacturer-alert",
    "1",
  );
  await expect(page.locator('[data-book-manufacturer="mismatch"]')).toHaveCount(
    1,
  );
  await expect(page.locator('[data-book-manufacturer="ok"]')).toHaveCount(5);
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator('[data-partner-booking-send="top"]').click();
  await page.waitForURL(/error=booking_manufacturer_mismatch/);
  await expect(lines).toHaveCount(6);
  // Remove a linha do outro fabricante: sobram as cinco.
  await page.locator("[data-book-manufacturer-remove]").click();
  await page.waitForURL(/removed=1/);
  await expect(page.locator("[data-book-manufacturer-alert]")).toHaveCount(0);
  await expect(lines).toHaveCount(5);
  const field = (n: number, name: string) =>
    lines.nth(n - 1).locator(`input[data-partner-item-field$=":${name}"]`);
  await expect(field(4, "factoryItemCode")).toHaveValue(`${TAG}-4`);
  // Sem o Nome, o Nº do item, a programação, o intervalo e as duas últimas.
  for (const gone of [
    "productName",
    "itemNumber",
    "purchaseSchedule",
    "departureIntervalDays",
    "purchaseQty",
    "plannedQty",
  ])
    await expect(
      page.locator(`[data-partner-item-field$=":${gone}"]`),
    ).toHaveCount(0);

  // Nenhuma linha marcada: o valor de cima vai para todas (Enter carrega).
  const bulk = head(page).locator('[data-bulk-field="material"]');
  await bulk.fill("steel");
  await bulk.press("Enter");
  // (o login do fornecedor de demonstração abre em chinês: só o número)
  await expect(head(page).locator('[data-bulk-status="ok"]')).toContainText(
    "5",
  );
  for (let n = 1; n <= 5; n++)
    await expect(field(n, "material")).toHaveValue("steel");

  // Seta para baixo e para cima: o foco anda na mesma coluna.
  await field(1, "moq").focus();
  await page.keyboard.press("ArrowDown");
  await expect(field(2, "moq")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(field(3, "moq")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(field(2, "moq")).toBeFocused();
  await head(page).locator('[data-bulk-field="moq"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect(field(1, "moq")).toBeFocused();

  // Enviado: a lista dele mostra o tipo e o percentual trabalhado.
  await page.locator('[data-partner-booking-send="top"]').click();
  await page.waitForURL(/sent=1/);
  await expect(
    page.locator('[data-partner-booking-row-worked="no"]'),
  ).toHaveCount(5);
  await page.goto("/app/booking");
  const mine = page.locator("tr[data-partner-booking]", { hasText: TYPE });
  await expect(mine).toContainText("Shenzhen Supplier A");
  await expect(mine.locator("[data-partner-booking-worked]")).toContainText(
    "0%",
  );
});

test("Book da Wellmix: seleção direto do book e trava", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  await login(page, "admin@wellmix.com");
  const lockType = `Trava ${TAG}`;
  await page.goto("/app/booking/import");
  await page
    .locator("[data-booking-import-form] input[type=file]")
    .setInputFiles([sheet("w1.xlsx", [6, 7]), sheet("w2.xlsx", [8])]);
  await fillBookMeta(page, lockType);
  // EXW no lugar do FOB da planilha: abre o valor do EXW, que fica no book.
  await expect(page.locator("[data-book-exw-value]")).toHaveCount(0);
  await page.locator("[data-book-incoterm]").selectOption("EXW");
  await page.locator("[data-book-exw-value]").fill("0,35");
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  const lotPath = new URL(page.url()).pathname;
  const lotId = lotPath.split("/").pop()!;
  await expect(page.locator("tr[data-booking-item]")).toHaveCount(3);
  await expect(page.locator("[data-booking-lot-sheets]")).toHaveAttribute(
    "data-booking-lot-sheets",
    "2",
  );
  await expect(page.locator("[data-book-item-type]")).toHaveValue(lockType);
  await expect(page.locator("[data-booking-lot-incoterm]")).toContainText(
    "0,35",
  );
  for (const n of [0, 1, 2])
    await expect(
      page
        .locator("tr[data-booking-item]")
        .nth(n)
        .locator('[data-booking-item-field$=":incoterm"] select'),
    ).toHaveValue("EXW");
  await expect(page.locator('tr[data-booking-item-worked="no"]')).toHaveCount(
    3,
  );

  // Marca dois itens e leva direto para a Seleção de itens.
  await expect(page.locator('[data-bulk-to-selection="off"]')).toBeVisible();
  for (const n of [0, 2])
    await page
      .locator("tr[data-booking-item]")
      .nth(n)
      .locator("[data-bulk-check]")
      .check();
  await page.locator('[data-bulk-to-selection="2"]').click();
  await page.waitForURL(/\/app\/booking\/selection\?.*tab=selection/);
  await expect(page.locator("main")).toContainText(`${TAG}-6`);
  await expect(page.locator("main")).toContainText(`${TAG}-8`);
  await expect(page.locator("main")).not.toContainText(`${TAG}-7`);

  // No rascunho o book ainda não trava (só depois de fechado).
  await page.goto(lotPath);
  await expect(page.locator("[data-booking-lot-no-lock]")).toBeVisible();
  await expect(page.locator("[data-booking-lock]")).toHaveCount(0);
  const ncmInputs = page.locator("input[data-booking-item-ncm]");
  for (let i = 0; i < (await ncmInputs.count()); i++) {
    await ncmInputs.nth(i).fill("7013.37.00");
    await ncmInputs.nth(i).press("Enter");
    await expect(
      page.locator('[data-booking-row-note="saved"]').nth(i),
    ).toBeVisible();
  }
  await page.click("[data-booking-lot-close-submit]");
  await page.waitForURL(/[?&]closed=1/);

  // Fechado: o analista trava o book e só ele continua vendo.
  await login(page, "operador@wellmix.com");
  await page.goto(lotPath);
  await page.locator("[data-booking-lock]").click();
  await page.waitForURL(/locked=1/);
  await expect(page.locator("[data-booking-lot-held]")).toContainText("Otávio");
  await page.goto("/app/booking");
  await expect(page.locator("[data-booking-lot-row]")).toHaveCount(1);
  await expect(page.locator(`[data-booking-lot-row="${lotId}"]`)).toBeVisible();

  // Quem supervisiona (administrador) vê todos e com quem está cada um.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/booking");
  const held = page.locator(`[data-booking-lot-row="${lotId}"]`);
  await expect(held.locator("[data-booking-lot-holder]")).toContainText(
    "Otávio",
  );
  await expect(held).toContainText("No prazo (3 h)");
  // E libera a trava de qualquer pessoa.
  await held.locator("[data-booking-unlock-row]").click();
  await page.waitForURL(/unlocked=1/);
  await expect(
    page
      .locator(`[data-booking-lot-row="${lotId}"]`)
      .locator('[data-booking-lot-holder="free"]'),
  ).toBeVisible();
});
