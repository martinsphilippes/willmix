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
 * segue com uma linha. Gravada, a escolha volta com as cores e a solicitação
 * ao fornecedor mostra cada cor na própria linha, por data.
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

  // 7. Quantidade que não fecha caixas: diz o ajuste e não grava.
  const qty1 = page.locator('input[name="schedule.qty.1"]');
  await qty1.fill("1500");
  const adjust = page.locator('[data-colors-error="cartons"]');
  await expect(adjust).toContainText(
    "1.500 peças na programação 1 não fecham caixas master inteiras de 48",
  );
  await expect(adjust).toContainText("Ajuste para 1.488 ou 1.536 peças");
  await page.click("[data-selection-submit]");
  await expect(page).not.toHaveURL(/[?&]saved=1/);
  await qty1.fill("1488");
  await expect(adjust).toHaveCount(0);
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
  ).toHaveValue('{"BEGE":30,"CARVALHO":20,"MARROM":20}');
  // "Dividir igualmente" volta à divisão igual, com o mesmo total.
  await preview.locator("[data-color-reset]").click();
  await expect(preview.locator("[data-color-custom]")).toHaveCount(0);
  await expect(bege).toHaveValue("24");
  await expect(preview.locator("[data-color-grand]")).toHaveText("3.360");

  // 8. Produto sem variações: sem o card, uma linha só (fluxo de sempre).
  await chooseItem(page, plain);
  await expect(rowA).toBeHidden();
  await expect(page.locator("[data-selection-variations]")).toHaveCount(0);
  await expect(page.locator("[data-color-preview]")).toHaveCount(0);
  await chooseItem(page, colored);
  await expect(lines).toHaveCount(3);

  // 9. Grava com CARVALHO fora e duas datas.
  await page.locator("[data-generate-total]").fill("61");
  await gen.locator("[data-generate-submit]").click();
  await card
    .locator('[data-selection-color="CARVALHO"] input[type=checkbox]')
    .uncheck();
  await expect(
    round(1).locator('[data-color-line="BEGE"] [data-color-pieces]'),
  ).toHaveText("768");
  await page.click("[data-selection-submit]");
  await page.waitForURL(/[?&]saved=1/);
  const resolved = page.locator("[data-selection-resolved=saved]");
  await expect(resolved).toHaveCount(1);
  await expect(resolved.locator("[data-selection-winner]")).toContainText(
    "Por cor: BEGE 1.488, MARROM 1.440",
  );

  // 10. Rever a escolha: volta com as cores e a composição gravadas.
  await resolved.locator("[data-selection-block-open]").click();
  // Depois de gravar, o endereço já tem `ids=`: espera a página de rever
  // (sem o `saved=1`).
  await page.waitForURL(
    (u) => u.searchParams.has("ids") && !u.searchParams.has("saved"),
  );
  await expect(rowB).toBeHidden();
  await expect(
    card.locator('[data-selection-color="CARVALHO"] input[type=checkbox]'),
  ).not.toBeChecked();
  await expect(
    card.locator('[data-selection-color="BEGE"] input[type=checkbox]'),
  ).toBeChecked();
  await expect(preview.locator("[data-color-grand]")).toHaveText("2.928");
  // "Rever opções" mostra a comparação de novo.
  await bar.locator("label:has(input[data-selection-review])").click();
  await expect(rowB).toBeVisible();
  await page.goBack();

  // 11. Solicitação ao fornecedor: cada cor na própria linha, por data.
  await page.click("[data-selection-open-all]");
  await page.waitForURL(/\/app\/supplier-requests\/[^/?]+\?.*created=1/);
  const plan = page.locator("[data-request-color-plan]");
  await expect(plan).toBeVisible();
  await expect(plan.locator("[data-color-round]")).toHaveCount(2);
  await expect(
    plan.locator('[data-color-round="1"] [data-color-line="BEGE"]'),
  ).toContainText("768 pcs");
  await expect(
    plan.locator('[data-color-round="1"] [data-color-subtotal]'),
  ).toContainText("1.488");
  await expect(plan.locator("[data-color-grand]")).toContainText("2.928");
  await expect(plan.locator("[data-color-excluded]")).toContainText("CARVALHO");
});
