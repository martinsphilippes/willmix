import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Nova solicitação com o bloco "Programação de compra" da Seleção de itens
 * (dono, 14/11/2026): o mesmo bloco (título, gerador, datas, um cartão por
 * programação), ligado ao produto escolhido no campo acima de cada linha. A
 * linha antiga de quantidade e unidade saiu da tela (os dois seguem no
 * formulário); o pedido único se digita no bloco. Sem o teto de 6 datas;
 * faltando caixa para uma por data, o aviso diz quantas faltam.
 *
 * Cadastro de demonstração: a boneca tem 48 peças por caixa master, caixa de
 * 52 × 34 × 68 cm (0,1202 m³, 565 caixas por 40HC) e pedido mínimo de 2.000;
 * a piscina, 6 por caixa e mínimo de 300; a jarra não tem caixa master.
 */

const row = (page: Page, n: number) =>
  page.locator(`[data-request-item="${n}"]`);

async function pick(page: Page, n: number, search: string, id: string) {
  const picker = row(page, n).locator('[data-product-picker="catalog"]');
  await picker.locator("[data-product-picker-input]").fill(search);
  await picker.locator(`[data-product-picker-option="${id}"]`).click();
  await expect(row(page, n).locator('[role="status"]').first()).toBeVisible();
}

const qty = (page: Page, n: number, i: number) =>
  page.locator(`input[name="p${n}.schedule.qty.${i}"]`);

/** Gera pelo card: total de caixas e número de datas. */
async function generate(
  page: Page,
  n: number,
  cartons: string,
  rounds: string,
) {
  const gen = row(page, n).locator("[data-rounds-generator]");
  await gen.locator("[data-generate-total]").fill(cartons);
  await gen.locator("[data-generate-rounds]").fill(rounds);
  await gen.locator("[data-generate-submit]").click();
}

async function quantities(page: Page, n: number) {
  return row(page, n)
    .locator('input[name*=".schedule.qty."]')
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
}

test("Nova solicitação: o bloco Programação de compra, pedido único, sobra, ajuste, caixas que faltam, 7 e 12 datas, troca, três produtos, enviar e reabrir", async ({
  page,
}) => {
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  const first = row(page, 0);
  const gen = first.locator("[data-rounds-generator]");
  const pieces = gen.locator("[data-selection-quantity]");

  // 1. O bloco da Seleção: o título "Programação de compra" e, logo abaixo,
  // "Gerar programação pela quantidade". A linha de quantidade e unidade
  // saiu da tela; os dois continuam no formulário.
  await expect(first.locator("[data-request-schedule] > legend")).toHaveText(
    "Programação de compra",
  );
  await expect(gen).toContainText("Gerar programação pela quantidade");
  await expect(page.locator('input[name="p0.quantity"]')).toHaveAttribute(
    "type",
    "hidden",
  );
  await expect(page.locator('input[name="p0.unit"]')).toHaveAttribute(
    "type",
    "hidden",
  );
  await expect(page.locator('input[name="p0.unit"]')).toHaveValue("un");
  await expect(first.getByLabel("Unidade", { exact: true })).toHaveCount(0);
  await expect(first.getByLabel("Quantidade", { exact: true })).toHaveCount(0);

  // Sem produto: o card pede o produto do campo acima e não gera.
  await expect(gen).toContainText("Escolha o produto no campo acima");
  await expect(gen.locator("[data-generate-submit]")).toBeDisabled();
  await expect(first.locator("[data-schedule-on]")).toBeDisabled();

  // 2. Boneca: a quantidade (pedido único) se digita no bloco, com o pedido
  // mínimo. Abaixo dele, o aviso; ao sair do campo, volta ao mínimo.
  await pick(page, 0, "boneca", "prod-boneca");
  await expect(gen).not.toContainText("Escolha o produto no campo acima");
  await expect(pieces).toHaveValue("2000");
  const moqHint = gen.locator("[data-request-moq-hint]");
  await expect(moqHint).toHaveText("Pedido mínimo: 2.000 un");
  await pieces.fill("1000");
  await expect(moqHint).toHaveAttribute("data-request-moq-hint", "below");
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("1000");
  await pieces.blur();
  await expect(pieces).toHaveValue("2000");
  await expect(moqHint).toHaveAttribute("data-request-moq-hint", "ok");
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("2000");

  // 3. O exemplo da captura: 300 caixas de 48 em 2 programações = 14.400
  // peças, 150 caixas e 7.200 peças por data. Containers previstos (1 por
  // data, 2 no total) separados do percentual ocupado (26%).
  await gen.locator("[data-generate-total]").fill("300");
  await expect(pieces).toHaveValue("14400");
  await gen.locator("[data-generate-rounds]").fill("2");
  await gen.locator("[data-generate-submit]").click();
  await expect(first.locator("[data-schedule-item]")).toHaveCount(2);
  expect(await quantities(page, 0)).toEqual(["7200", "7200"]);
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("14400");
  await expect(gen.locator("[data-generate-per-round]")).toHaveText("1");
  await expect(gen.locator("[data-generate-total-containers]")).toHaveText("2");
  const card1 = first.locator('[data-schedule-item="1"]');
  await expect(card1.locator("[data-schedule-load]")).toHaveText(
    "150 caixas master · 18,03 m³",
  );
  await expect(card1.locator("[data-round-status]")).toHaveText(
    "1 container previsto · 26% ocupado",
  );
  await expect(gen.locator("[data-generate-each]")).toContainText(
    "1 container 40HC previsto, com 26% ocupado",
  );
  await expect(gen.locator("[data-generate-containers]")).toHaveText(
    "Containers 40HC previstos no total: 2.",
  );

  // 4. Sobra: 61 caixas em 2 = 31 + 30 (o resto vai para a 1ª).
  await generate(page, 0, "61", "2");
  await expect(qty(page, 0, 1)).toHaveValue("1488");
  await expect(qty(page, 0, 2)).toHaveValue("1440");
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("2928");

  // 5. Ajuste: "+ Aumentar" fecha o container da 1ª (565 caixas); os totais
  // e os containers acompanham.
  const up = card1.locator("[data-round-up]").first();
  const target = await up.getAttribute("data-round-up");
  expect(target).toBe(String(565 * 48));
  await up.click();
  await expect(qty(page, 0, 1)).toHaveValue(target!);
  await expect(card1.locator("[data-round-fill]")).toHaveAttribute(
    "data-round-fill",
    "full",
  );
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue(
    String(565 * 48 + 1440),
  );
  await expect(gen.locator("[data-generate-total]")).toHaveValue(
    String(565 + 30),
  );

  // 6. Caixas que faltam: 5 caixas em 7 datas não geram; o aviso diz
  // quantas faltam, com as duas saídas.
  await generate(page, 0, "5", "7");
  const short = gen.locator("[data-generate-short]");
  await expect(short).toHaveText(
    /Faltam 2 caixa\(s\) master para dar pelo menos 1 caixa a cada uma das 7 datas: o total tem 5 caixa\(s\)\./,
  );
  await expect(first.locator("[data-schedule-item]")).toHaveCount(2);
  await short.locator("[data-generate-short-down]").click();
  await expect(short).toHaveCount(0);
  expect(await quantities(page, 0)).toEqual(Array(5).fill("48"));
  await generate(page, 0, "5", "7");
  await short.locator("[data-generate-short-up]").click();
  expect(await quantities(page, 0)).toEqual(Array(7).fill("48"));
  await expect(gen.locator("[data-generate-total]")).toHaveValue("7");

  // 7. 12 datas (sem o teto de 6) e "+ Programação": cada clique acrescenta
  // uma data, com o total dividido de novo em caixas inteiras.
  await generate(page, 0, "300", "12");
  expect(await quantities(page, 0)).toEqual(Array(12).fill("1200"));
  await first.locator("[data-schedule-add]").click();
  expect(await quantities(page, 0)).toEqual([
    "1152",
    ...Array(12).fill("1104"),
  ]);
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("14400");
  await expect(gen.locator("[data-generate-rounds]")).toHaveValue("13");
  // A 13ª data: 1ª + 12 × 45 dias.
  const dates13 = await first.locator("[data-schedule-date]").allInnerTexts();
  expect(dates13).toHaveLength(13);
  // "+ Programação" sem caixa para mais uma data: o aviso, e "Manter".
  await generate(page, 0, "13", "13");
  await first.locator("[data-schedule-add]").click();
  await expect(short).toContainText("Faltam 1 caixa(s)");
  await expect(short.locator("[data-generate-short-up]")).toHaveText(
    "Aumentar o total para 14 caixas",
  );
  await short.locator("[data-generate-short-keep]").click();
  await expect(short).toHaveCount(0);
  await expect(first.locator("[data-schedule-item]")).toHaveCount(13);

  // 8. Trocar o produto depois de gerar: a programação sai e o card avisa;
  // de volta à boneca, gera de novo (7 datas: 43 × 6 + 42 caixas).
  await generate(page, 0, "300", "7");
  await row(page, 0).locator("[data-product-picker-input]").fill("jarra");
  await row(page, 0)
    .locator('[data-product-picker-option="prod-jarra"]')
    .click();
  await expect(first.locator("[data-schedule-item]")).toHaveCount(0);
  await expect(first.locator("[data-schedule-regenerate]")).toBeVisible();
  await expect(page.locator('input[name="p0.schedule.count"]')).toHaveCount(0);
  await row(page, 0).locator("[data-product-picker-input]").fill("boneca");
  await row(page, 0)
    .locator('[data-product-picker-option="prod-boneca"]')
    .click();
  await expect(gen.locator('[data-generate-item="ok"]')).toBeVisible();
  await generate(page, 0, "300", "7");
  expect(await quantities(page, 0)).toEqual([...Array(6).fill("2064"), "2016"]);
  await expect(first.locator("[data-schedule-regenerate]")).toHaveCount(0);
  await page.fill('textarea[name="p0.description"]', "Boneca programada");

  // 9. Segundo produto, com a própria programação de 12 datas: piscina, 120
  // caixas de 6 = 60 peças por data (720 no total, acima do mínimo de 300).
  await page.click("[data-add-request-item]");
  await pick(page, 1, "piscina", "prod-piscina");
  await generate(page, 1, "120", "12");
  expect(await quantities(page, 1)).toEqual(Array(12).fill("60"));
  await expect(page.locator('input[name="p1.quantity"]')).toHaveValue("720");
  await page.fill('textarea[name="p1.description"]', "Piscina programada");
  // A boneca segue com a dela.
  await expect(first.locator("[data-schedule-item]")).toHaveCount(7);

  // 10. Terceiro produto em pedido único (a jarra não tem caixa master: o
  // card diz os dados que faltam e a quantidade se digita em peças).
  await page.click("[data-add-request-item]");
  await pick(page, 2, "jarra", "prod-jarra");
  const gen3 = row(page, 2).locator("[data-rounds-generator]");
  await expect(gen3.locator("[data-generate-item]")).toHaveAttribute(
    "data-generate-item",
    "no-data",
  );
  await gen3.locator("[data-selection-quantity]").fill("1000");
  await expect(page.locator('input[name="p2.quantity"]')).toHaveValue("1000");
  await expect(page.locator('input[name="p2.schedule.count"]')).toHaveCount(0);
  await page.fill('textarea[name="p2.description"]', "Jarra pedido único");

  // As datas de cada programação, como estão na tela antes de enviar.
  const datesOf = (n: number) =>
    row(page, n).locator("[data-schedule-date]").allInnerTexts();
  const bonecaDates = await datesOf(0);
  const piscinaDates = await datesOf(1);
  expect(bonecaDates).toHaveLength(7);
  expect(piscinaDates).toHaveLength(12);

  // 11. Envia e reabre: cada produto com as datas e as quantidades dele.
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await page.waitForURL(/\/app\/requests\/batch\/[^?]+\?created=3$/);
  const batchUrl = page.url();
  const open = async (text: string) => {
    await page.goto(batchUrl);
    await page
      .locator(
        `[data-batch-item]:has-text('${text}') a[href^='/app/requests/']`,
      )
      .first()
      .click();
    await page.waitForURL(/\/app\/requests\/(?!new|batch)[^/?]+$/);
    return page.locator("[data-request-schedule-table]");
  };
  let table = await open("Boneca articulada");
  await expect(table).toContainText("Programação de compra");
  await expect(table).toContainText("7 programações a cada 45 dias");
  await expect(table.locator("tbody tr")).toHaveCount(8);
  for (const v of ["2.064", "2.016", "14.400", ...bonecaDates])
    await expect(table).toContainText(v);
  table = await open("Piscina inflável");
  await expect(table).toContainText("12 programações a cada 45 dias");
  await expect(table.locator("tbody tr")).toHaveCount(13);
  for (const v of ["60", "720", ...piscinaDates])
    await expect(table).toContainText(v);
  table = await open("Jarra de vidro");
  await expect(table).toHaveCount(0);
  // Pedido único: a quantidade digitada no bloco, sem programação.
  await expect(page.locator("main")).toContainText("1000 un");
});
