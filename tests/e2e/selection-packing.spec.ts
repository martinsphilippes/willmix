import { expect, test } from "@playwright/test";
import {
  bookingSheet,
  chooseItem,
  importAndClose,
  login,
  png,
  setManualFx,
} from "./helpers";

/*
 * Embalagens e variações do vencedor (dono, 26/11/2026;
 * docs/SUPPLIER_REQUESTS.md, "Embalagens e variações"): "Alterar" a
 * Qtd/caixa (o CBM acompanha), "+ Embalagem" com a Qtd/Embalagem (preço × N,
 * Qtd/caixa e MOQ ÷ N), o toggle da tabela pai, a matriz variação ×
 * embalagem com uma variação digitada, o Mix de cores com a arte por
 * embalagem e, ao gravar no book da Wellmix, uma cotação por combinação
 * direto com o Supplier do book.
 */

const TAG = `EMB${Date.now().toString(36).toUpperCase()}`;

test("Alterar, embalagens, variações e uma cotação por combinação", async ({
  page,
}) => {
  const code = `${TAG}-A`;
  await login(page, "admin@wellmix.com");
  await setManualFx(page);
  await importAndClose(
    page,
    bookingSheet("Shenzhen Supplier A", code, `Copo ${TAG}`, "AZUL / ROSA"),
    "Shenzhen Supplier A",
  );

  await page.goto(`/app/booking/selection?q=${encodeURIComponent(TAG)}`);
  await page.locator(`[data-selection-invite]`).first().click();
  await page.waitForURL(/tab=selection&ids=/);
  await chooseItem(page, code);

  // 1. Alterar: a Qtd/caixa 48 → 24 e o CBM 0,12 → 0,06.
  const section = page.locator("[data-packing-section]");
  await section.locator("[data-packing-alter]").click();
  const altered = section.locator("[data-packing-altered]");
  await expect(altered.locator("[data-packing-carton]")).toHaveValue("48");
  await altered.locator("[data-packing-carton]").fill("24");
  await expect(altered.locator("[data-packing-cbm]")).toHaveText("0,06");

  // 2. + Embalagem com 3 peças: preço × 3, Qtd/caixa 24 ÷ 3 e MOQ ÷ 3 (para cima).
  await altered.locator("[data-packing-add]").click();
  const packs = section.locator("[data-packing-packs]");
  await packs.locator("[data-packing-units]").fill("5");
  await expect(packs.locator('[data-packing-error="divide"]')).toBeVisible();
  await packs.locator("[data-packing-units]").fill("3");
  await expect(packs.locator("[data-packing-error]")).toHaveCount(0);
  const pack = packs.locator('[data-packing-pack="3"]');
  await expect(pack.locator("[data-packing-price]")).toContainText("3,75");
  await expect(pack.locator("[data-packing-box]")).toHaveText("8");
  await expect(pack.locator("[data-packing-moq]")).toHaveText("334");
  await expect(pack.locator("[data-packing-cbm]")).toHaveText("0,06");

  // 3. A tabela pai conta como opção: duas colunas na matriz.
  const parent = packs.locator('[data-packing-switch="parent"]');
  await expect(parent).toHaveAttribute("aria-checked", "true");
  const card = page.locator("[data-selection-variations]");
  await expect(card.locator("[data-packing-option]")).toHaveCount(2);
  await parent.click();
  await expect(card.locator("[data-packing-option]")).toHaveCount(1);
  await parent.click();

  // 4. Uma variação digitada: 3 variações × 2 embalagens = 6 cotações.
  await card.locator("[data-packing-variation-add]").click();
  await card.locator("[data-packing-variation-input]").fill("Preto fosco");
  await expect(card.locator("[data-selection-variations-count]")).toContainText(
    "6",
  );
  await page.screenshot({
    path: "test-results/selection-packing-matrix.png",
    fullPage: true,
  });

  // 5. Mix de cores: a arte é uma por embalagem.
  await card.locator('[data-packing-switch="mix"]').click();
  await expect(card.locator("[data-packing-art-row]")).toBeVisible();
  await card
    .locator('[data-packing-art-row] input[data-packing-art-input="|3"]')
    .setInputFiles(png);
  await expect(
    card.locator('[data-packing-art-row] [data-packing-art="|3"] img'),
  ).toBeVisible();

  // 6. 12 caixas de 24 peças: 2 caixas por combinação.
  await page.locator("[data-generate-total]").fill("12");
  await expect(page.locator("[data-selection-quantity]")).toHaveValue("288");
  const cell = card.locator('[data-packing-cell="Preto fosco|3"]');
  await expect(cell.locator("[data-selection-color-cartons]")).toHaveValue("2");
  await expect(cell.locator("[data-selection-color-pieces]")).toHaveText(
    "16 emb.",
  );

  // 6b. Rascunho (dono, 26/11/2026): recarregar a seleção traz tudo de volta,
  // também a arte do Mix.
  await expect(page.locator("[data-selection-draft-saved]")).toBeVisible();
  await page.waitForTimeout(3500);
  await page.reload();
  await expect(page.locator("[data-selection-draft-restored]")).toBeVisible();
  await expect(card.locator('[data-packing-switch="mix"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(
    card.locator('[data-packing-art-row] [data-packing-art="|3"] img'),
  ).toBeVisible();
  await expect(page.locator("[data-selection-quantity]")).toHaveValue("288");
  await expect(
    card
      .locator('[data-packing-cell="Preto fosco|3"]')
      .locator("[data-selection-color-cartons]"),
  ).toHaveValue("2");

  // 7. Gravar: book da Wellmix, uma solicitação só com um item por
  // combinação (dono, 26/11/2026), que abre direto.
  await page.click("[data-selection-submit]");
  await page.waitForURL(/[?&]created=1/);
  await expect(page.locator("[data-supplier-table-row]")).toHaveCount(6);

  // 8. O item do Preto fosco em embalagem de 3: a variação, a embalagem (8
  // por caixa) e a arte do Mix.
  const preto = page.locator("[data-supplier-table-row]").filter({
    has: page.locator('[data-supplier-table-variant="Preto fosco|3"]'),
  });
  await expect(
    preto.locator('[data-supplier-table-variant="Preto fosco|3"]'),
  ).toHaveText("Preto fosco · Emb. 3 pç");
  const last = await preto.getAttribute("data-supplier-table-row");
  // Na tabela dos produtos (dono, 26/11/2026): sem o quadro do produto em
  // cima, o item com embalagem conta sets e mostra as peças por set.
  await expect(page.locator("[data-request-variant]")).toHaveCount(0);
  await expect(page.locator("[data-supplier-table]")).toContainText(
    "Total de sets",
  );
  await expect(
    page.locator(`[data-supplier-table-pieces-per-set="${last}"]`),
  ).toHaveText("3");
  // A arte da Wellmix na coluna "Foto Marketing" (dono, 26/11/2026).
  await expect(page.locator("[data-supplier-table]")).toContainText(
    "Foto Marketing",
  );
  await expect(
    page.locator(`[data-supplier-table-marketing="${last}"] img`),
  ).toBeVisible();
  await page.goto(`/app/supplier-requests/${last}?view=item`);
  const variant = page.locator('[data-request-variant="Preto fosco|3"]');
  await expect(variant).toBeVisible();
  await expect(variant).toContainText("Embalagem com 3 peças (8 embalagens");
  await expect(variant).toContainText("Mix de cores");
  await expect(
    variant.locator('[data-request-variant-altered="48"]'),
  ).toBeVisible();
  // A caixa e o preço contam embalagens: os rótulos dizem isso.
  await expect(page.locator("[data-negotiation-sheet]")).toContainText(
    "Embalagens por caixa master",
  );
  await expect(
    page.locator('[data-negotiation-main] [data-sheet-field="price"]'),
  ).toContainText("Preço/embalagem (3 pç)");
  await expect(variant.locator("[data-request-variant-art] img")).toBeVisible();
  const url = page.url().split("?")[0];
  await page.screenshot({
    path: "test-results/selection-packing-request.png",
    fullPage: true,
  });

  // 9. O fornecedor (Supplier do book) vê a mesma variação e abre a arte.
  await login(page, "supplier.a@china.com");
  await page.goto(`${url}?view=item`);
  await expect(variant).toBeVisible();
  const art = variant.locator("[data-request-variant-art] img");
  await expect(art).toBeVisible();
  const src = await art.getAttribute("src");
  const res = await page.request.get(src!);
  expect(res.status()).toBe(200);
});
