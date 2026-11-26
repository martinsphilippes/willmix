import { expect, test } from "@playwright/test";
import {
  bookingSheet,
  chooseItem,
  importAndClose,
  login,
  setManualFx,
} from "./helpers";

/*
 * Escolha do vencedor e variações de cor (Seleção de itens; docs/
 * PURCHASE_SCHEDULE.md, "Cores"): "Escolher" marca o item e recolhe os
 * demais ("Rever opções" reabre); o card "Variações" traz uma linha por cor
 * do Book, todas incluídas; a composição por cor divide o total entre as
 * cores e as datas em caixas master inteiras (48 peças na planilha de teste),
 * diz o ajuste quando não fecha e não deixa gravar; o item sem variações
 * segue com uma linha. Gravada no book da Wellmix, cada cor vira uma
 * cotação, com as peças dela em cada data (dono, 26/11/2026).
 */

const TAG = `COR${Date.now().toString(36).toUpperCase()}`;

test("vencedor, variações de cor e composição por data até a solicitação", async ({
  page,
}) => {
  const colored = `${TAG}-A`;
  const plain = `${TAG}-B`;
  await login(page, "admin@wellmix.com");
  await setManualFx(page);
  await importAndClose(
    page,
    bookingSheet(
      "Shenzhen Supplier A",
      colored,
      `Vaso ${TAG} listrado`,
      "BEGE / CARVALHO / MARROM",
    ),
    "Shenzhen Supplier A",
  );
  await importAndClose(
    page,
    bookingSheet("Guangzhou Supplier B", plain, `Vaso ${TAG} liso`),
    "Guangzhou Supplier B",
  );

  // Grupo dos dois itens (aba Itens → Agrupar).
  await page.goto(`/app/booking/selection?q=${encodeURIComponent(TAG)}`);
  await page.locator("input[data-basket-all]").check();
  await page.click("[data-selection-group]");
  await page.waitForURL(/tab=selection&ids=/);
  const rowA = page.locator("[data-selection-item]", { hasText: colored });
  const rowB = page.locator("[data-selection-item]", { hasText: plain });
  const bar = page.locator("[data-selection-winner-bar]");
  await expect(rowA).toBeVisible();
  await expect(rowB).toBeVisible();
  await expect(bar).toBeHidden();
  await expect(rowA.locator("[data-selection-choose-button]")).toHaveText(
    "Escolher",
    { useInnerText: true },
  );

  // 1. Escolher: o vencedor em destaque, o outro recolhido.
  await chooseItem(page, colored);
  await expect(rowB).toBeHidden();
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("1 outros itens recolhidos");
  await expect(rowA.locator("[data-selection-choose-button]")).toHaveText(
    "✓ Escolhido",
    { useInnerText: true },
  );

  // 2. Variações: uma linha por cor do Book, todas incluídas.
  const card = page.locator(`[data-selection-variations]`);
  await expect(card).toBeVisible();
  const lines = card.locator("[data-selection-color]");
  await expect(lines).toHaveCount(3);
  await expect(lines.nth(0)).toContainText("BEGE");
  await expect(lines.nth(1)).toContainText("CARVALHO");
  await expect(lines.nth(2)).toContainText("MARROM");
  await expect(card.locator("[data-selection-variations-count]")).toHaveText(
    "3 de 3 cores na compra",
  );

  // 3. Pedido único: 60 caixas (2.880 peças) em 3 cores = 960 cada.
  await page.locator("[data-generate-total]").fill("60");
  await expect(page.locator("[data-selection-quantity]")).toHaveValue("2880");
  const preview = page.locator('[data-color-preview="ok"]');
  await expect(preview.locator("[data-color-round]")).toHaveCount(1);
  await expect(
    preview.locator('[data-color-line="BEGE"] [data-color-pieces]'),
  ).toHaveText("960");
  await expect(preview.locator("[data-color-grand]")).toHaveText("2.880");
  await expect(
    card.locator(
      '[data-selection-color="MARROM"] [data-selection-color-pieces]',
    ),
  ).toHaveText("960 peças");
  // As peças do gerador ficam travadas (dono, 14/11/2026): só as caixas se
  // digitam, e o que se digita sempre fecha caixas inteiras para as cores.
  const adjust = page.locator('[data-colors-error="cartons"]');
  await expect(page.locator("[data-selection-quantity]")).not.toBeEditable();
  await expect(adjust).toHaveCount(0);

  // 4. Duas datas (exemplo do dono): 480 de cada cor por data, 1.440 por data.
  const gen = page.locator("[data-rounds-generator]");
  await gen.locator("[data-generate-rounds]").fill("2");
  await gen.locator("[data-generate-submit]").click();
  await expect(page.locator("[data-schedule-item]")).toHaveCount(2);
  const round = (n: number) => preview.locator(`[data-color-round="${n}"]`);
  for (const n of [1, 2]) {
    for (const c of ["BEGE", "CARVALHO", "MARROM"])
      await expect(
        round(n).locator(`[data-color-line="${c}"] [data-color-pieces]`),
      ).toHaveText("480");
    await expect(round(n).locator("[data-color-subtotal]")).toHaveText("1.440");
  }
  await expect(preview.locator("[data-color-grand]")).toHaveText("2.880");

  // 5. Cor retirada: só BEGE e MARROM, 720 de cada por data.
  await card
    .locator('[data-selection-color="CARVALHO"] input[type=checkbox]')
    .uncheck();
  await expect(card.locator("[data-selection-variations-count]")).toHaveText(
    "2 de 3 cores na compra",
  );
  await expect(card.locator('[data-selection-color="CARVALHO"]')).toContainText(
    "fora desta compra",
  );
  await expect(preview.locator('[data-color-line="CARVALHO"]')).toHaveCount(0);
  await expect(
    round(1).locator('[data-color-line="BEGE"] [data-color-pieces]'),
  ).toHaveText("720");
  await card
    .locator('[data-selection-color="CARVALHO"] input[type=checkbox]')
    .check();

  // 6. Divisão desigual: 61 caixas em 2 datas (31 + 30) e 3 cores. A 1ª
  // data dá 11, 10 e 10 caixas; a 2ª, 10 de cada (o saldo vai para a 1ª cor).
  await page.locator("[data-generate-total]").fill("61");
  await gen.locator("[data-generate-submit]").click();
  await expect(round(1).locator("[data-color-subtotal]")).toHaveText("1.488");
  await expect(
    round(1).locator('[data-color-line="BEGE"] [data-color-pieces]'),
  ).toHaveText("528");
  await expect(
    round(1).locator('[data-color-line="MARROM"] [data-color-pieces]'),
  ).toHaveText("480");
  await expect(round(2).locator("[data-color-subtotal]")).toHaveText("1.440");
  await expect(preview.locator('[data-color-total="BEGE"]')).toContainText(
    "1.008",
  );
  await expect(preview.locator("[data-color-grand]")).toHaveText("2.928");

  // 7. Cada programação em caixas (dono, 14/11/2026): as peças ficam
  // travadas e a programação sempre fecha caixas inteiras para as cores.
  const qty1 = page.locator('input[name="schedule.qty.1"]');
  await expect(qty1).toHaveAttribute("readonly", "");
  const boxes1 = page.locator('[data-schedule-cartons="1"]');
  await expect(boxes1).toHaveValue("31");
  await boxes1.fill("32");
  await expect(qty1).toHaveValue("1536");
  await expect(adjust).toHaveCount(0);
  await expect(round(1).locator("[data-color-subtotal]")).toHaveText("1.536");
  await boxes1.fill("31");
  await expect(qty1).toHaveValue("1488");
  await expect(preview.locator("[data-color-grand]")).toHaveText("2.928");

  // 7b. Caixas por cor livres (dono, 14/11/2026): BEGE vai de 21 para 30
  // caixas, as outras ficam com 20 e o total vira a soma (70 caixas = 3.360
  // peças), espalhada pelas datas (36 + 34 caixas).
  const bege = card.locator(
    '[data-selection-color="BEGE"] [data-selection-color-cartons]',
  );
  await expect(bege).toHaveValue("21");
  await bege.fill("30");
  await bege.press("Enter");
  await expect(page.locator("[data-selection-quantity]")).toHaveValue("3360");
  await expect(preview.locator("[data-color-grand]")).toHaveText("3.360");
  await expect(preview.locator('[data-color-total="BEGE"]')).toContainText(
    "1.440",
  );
  await expect(preview.locator('[data-color-total="MARROM"]')).toContainText(
    "960",
  );
  await expect(round(1).locator("[data-color-subtotal]")).toHaveText("1.728");
  await expect(round(2).locator("[data-color-subtotal]")).toHaveText("1.632");
  await expect(
    card.locator('[data-selection-color="BEGE"] [data-selection-color-pieces]'),
  ).toHaveText("1.440 peças");
  await expect(
    card.locator(
      '[data-selection-color="CARVALHO"] [data-selection-color-cartons]',
    ),
  ).toHaveValue("20");
  await expect(
    preview.locator('[data-color-custom] input[name^="colorCartons."]'),
  ).toHaveValue('{"BEGE|1":30,"CARVALHO|1":20,"MARROM|1":20}');
  // "Dividir igualmente" volta à divisão igual, com o mesmo total.
  await preview.locator("[data-color-reset]").click();
  await expect(preview.locator("[data-color-custom]")).toHaveCount(0);
  await expect(bege).toHaveValue("24");
  await expect(preview.locator("[data-color-grand]")).toHaveText("3.360");

  // 8. Produto sem variações: o card fica (dá para digitar uma variação),
  // com uma linha só, o item como está, e sem a composição por cor.
  await chooseItem(page, plain);
  await expect(rowA).toBeHidden();
  await expect(page.locator("[data-selection-variations]")).toHaveCount(1);
  await expect(lines).toHaveCount(1);
  await expect(page.locator("[data-color-preview]")).toHaveCount(0);
  await chooseItem(page, colored);
  await expect(lines).toHaveCount(3);

  // 9. Grava com CARVALHO fora e duas datas: no book da Wellmix, uma
  // cotação por variação (dono, 26/11/2026), BEGE e MARROM, direto com o
  // Supplier do book.
  await page.locator("[data-generate-total]").fill("61");
  await gen.locator("[data-generate-submit]").click();
  await card
    .locator('[data-selection-color="CARVALHO"] input[type=checkbox]')
    .uncheck();
  await expect(
    round(1).locator('[data-color-line="BEGE"] [data-color-pieces]'),
  ).toHaveText("768");
  await expect(card.locator("[data-selection-variations-count]")).toHaveText(
    "2 de 3 cores na compra",
  );
  await page.click("[data-selection-submit]");
  await page.waitForURL(/[?&]opened=2/);
  await expect(page).toHaveURL(/[?&]tab=requested/);
  await expect(page.locator("[data-selection-opened]")).toBeVisible();

  // 10. Cada cotação é de uma cor, com as peças dela em cada data. Com
  // variação, as entregas ficam no quadro "Variação e embalagem" (data,
  // peças e caixas), no lugar do quadro "Programação de compra" (dono,
  // 26/11/2026; docs/SUPPLIER_REQUESTS.md, "Embalagens e variações").
  await page.goto("/app/supplier-requests");
  const rows = page.locator("[data-supplier-request-row]");
  const ids = await rows.evaluateAll((els) =>
    els.slice(0, 2).map((el) => el.getAttribute("data-supplier-request-row")),
  );
  const seen: Record<string, { pieces: string[]; total: string }> = {};
  for (const id of ids) {
    await page.goto(`/app/supplier-requests/${id}?view=item`);
    const variant = page.locator("[data-request-variant]");
    await expect(variant).toBeVisible();
    const key = (await variant.getAttribute("data-request-variant"))!;
    await expect(page.locator("[data-purchase-schedule]")).toHaveCount(0);
    await expect(variant.locator("[data-request-variant-round]")).toHaveCount(
      2,
    );
    seen[key] = {
      pieces: await variant
        .locator("[data-request-variant-round-pieces]")
        .allInnerTexts(),
      total: (
        await variant.locator("[data-request-variant-quantity]").innerText()
      ).trim(),
    };
  }
  expect(Object.keys(seen).sort()).toEqual(["BEGE|1", "MARROM|1"]);
  // BEGE: 768 + 720 = 1.488; MARROM: 720 + 720 = 1.440.
  expect(seen["BEGE|1"]).toEqual({
    pieces: ["768", "720"],
    total: "1.488 peças",
  });
  expect(seen["MARROM|1"]).toEqual({
    pieces: ["720", "720"],
    total: "1.440 peças",
  });
});
