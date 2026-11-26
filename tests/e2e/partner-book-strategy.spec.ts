import { expect, test } from "@playwright/test";
import { chooseItem, fillBookMeta, login, setBookFamily } from "./helpers";
import { xlsxBytes } from "../unit/xlsx-fixture";

/*
 * Book enviado pelo parceiro (dono, 26/11/2026; docs/SUPPLIER_REQUESTS.md,
 * "Book enviado pelo parceiro"): o fornecedor sobe e envia o book; a
 * Wellmix fecha, escolhe o item e grava; cada variação vira uma demanda de
 * compra para estoque na Estratégia de compra, com o parceiro já marcado; o
 * envio abre a cotação de compra do item de book, sem produto do cadastro,
 * e o parceiro a vê no portal.
 */
const TAG = `PBS${Date.now().toString(36).toUpperCase()}`;

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
  "SUPPLIER STORE NO",
  "COLOR ASSORTMENT",
];
const sheet = {
  name: `${TAG}.xlsx`,
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  buffer: Buffer.from(
    xlsxBytes([
      {
        name: "BOOKING",
        cells: [
          HEADER,
          [
            "2026.10.13",
            "Yiwu",
            "Shenzhen Supplier A",
            `${TAG}-1`,
            `Pote ${TAG}`,
            "FOB",
            "USD",
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
            "960",
            "A 154678",
            "AZUL / ROSA",
          ],
        ],
      },
    ]),
  ),
};

test("book do parceiro: Estratégia com o parceiro marcado e a cotação do item de book", async ({
  page,
}) => {
  test.slow();
  // 1. O fornecedor sobe o book e envia para a Wellmix conferir.
  await login(page, "supplier.a@china.com");
  await page.goto("/app/booking/import");
  await page
    .locator("[data-partner-booking-launch-form] input[type=file]")
    .setInputFiles(sheet);
  await fillBookMeta(page, `Pote ${TAG}`);
  await page.locator("[data-partner-booking-launch-submit]").click();
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  const lotPath = new URL(page.url()).pathname;
  await page.locator('[data-partner-booking-send="top"]').click();
  await page.waitForURL(/sent=1/);

  // 2. A Wellmix confere (NCM) e fecha o book.
  await login(page, "admin@wellmix.com");
  await page.goto(lotPath);
  const ncm = page.locator("input[data-booking-item-ncm]").first();
  await ncm.fill("7013.37.00");
  await ncm.press("Enter");
  await expect(
    page.locator('[data-booking-row-note="saved"]').first(),
  ).toBeVisible();
  await setBookFamily(page);
  await page.click("[data-booking-lot-close-submit]");
  await page.waitForURL(/[?&]closed=1/);

  // 3. Seleção: o item sozinho, as duas cores, 30 caixas de 48.
  await page.goto(`/app/booking/selection?q=${encodeURIComponent(TAG)}`);
  await page.locator("[data-selection-invite]").first().click();
  await page.waitForURL(/tab=selection&ids=/);
  await chooseItem(page, `${TAG}-1`);
  const card = page.locator("[data-selection-variations]");
  await expect(card.locator("[data-selection-color]")).toHaveCount(2);
  await page.locator("[data-generate-total]").fill("30");
  await expect(page.locator("[data-selection-quantity]")).toHaveValue("1440");
  await page.click("[data-selection-submit]");
  // Book do parceiro: as duas combinações foram para a Estratégia.
  await page.waitForURL(/[?&]strategy=2/);
  await expect(page.locator("[data-selection-strategy]")).toBeVisible();
  // Na aba Com Solicitação Aberta, o grupo leva à Estratégia.
  await expect(
    page
      .locator("[data-selection-group-row]", { hasText: `Pote ${TAG}` })
      .locator("[data-selection-strategy-link]"),
  ).toBeVisible();

  // 4. Estratégia: uma solicitação com os dois SKUs e o parceiro marcado.
  await page.goto("/app/purchase-strategy");
  const line = page.locator("[data-strategy-line]", {
    hasText: `Pote ${TAG}`,
  });
  await expect(line).toHaveCount(1);
  const demandId = (await line.getAttribute("data-strategy-line"))!;
  await expect(line).toContainText("AZUL");
  await expect(line).toContainText("ROSA");
  await line.locator('[data-strategy-choice="quote"]').check();
  const partner = line.locator("input[data-strategy-recipient-box]:checked");
  await expect(partner).toHaveCount(1);
  await expect(
    line.locator("[data-strategy-recipient]", {
      hasText: "Shenzhen Supplier A",
    }),
  ).toHaveCount(1);
  await page.screenshot({
    path: "test-results/partner-book-strategy.png",
    fullPage: true,
  });
  await page.locator(`[data-strategy-confirm="${demandId}"]`).click();
  await page.waitForURL(/\/app\/purchase-strategy\/sends\/[^/?]+\?done=1/);
  const quoteId = (await page
    .locator("[data-strategy-send-quote]")
    .first()
    .getAttribute("data-strategy-send-quote"))!;

  // 5. O parceiro vê a cotação de compra com o item de book (sem produto).
  await login(page, "supplier.a@china.com");
  await page.goto(`/app/purchase-quotes/${quoteId}`);
  await expect(page.locator('[data-quote-product-row^="bk-"]')).toHaveCount(2);
  await expect(page.locator("body")).toContainText(`Pote ${TAG}`);
});
