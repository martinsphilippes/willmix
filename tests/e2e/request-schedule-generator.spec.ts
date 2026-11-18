import { expect, test, type Page } from "@playwright/test";
import { login, createdRequestId } from "./helpers";

/*
 * Nova solicitação com a programação de compra DO PEDIDO (dono, 15/11/2026):
 * o número de programações e as datas são do pedido (bloco "Programação de
 * compra do pedido"), iguais para todos os produtos; o bloco "Programação de
 * compra" de cada produto (o da Seleção de itens, com o gerador em caixas e
 * os containers) só reparte a quantidade dele nessas datas. Produto do
 * catálogo: descrição e especificação só para leitura, à direita da busca.
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

/** Gera pelo card: o total de caixas nas datas do pedido. */
async function generate(page: Page, n: number, cartons: string) {
  const gen = row(page, n).locator("[data-rounds-generator]");
  await gen.locator("[data-generate-total]").fill(cartons);
  await gen.locator("[data-generate-submit]").click();
}

async function quantities(page: Page, n: number) {
  return row(page, n)
    .locator('input[name*=".schedule.qty."]')
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
}

async function setPlan(page: Page, count: string) {
  const input = page.locator("[data-order-plan-count]");
  await input.fill(count);
  await input.blur();
}

test("Nova solicitação: programação do pedido, produto só para leitura, gerador em caixas, troca do número de datas, três produtos, enviar e reabrir", async ({
  page,
}) => {
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  const first = row(page, 0);
  const gen = first.locator("[data-rounds-generator]");
  const pieces = gen.locator("[data-selection-quantity]");
  const plan = page.locator("[data-order-plan]");

  // 1. O bloco do pedido começa no pedido único; o do produto não liga nem
  // desliga programação (sem "+ Programação de compra").
  await expect(plan).toHaveAttribute("data-order-plan", "single");
  await expect(first.locator("[data-schedule-title]")).toHaveText(
    "Programação de compra",
  );
  await expect(first.locator("[data-schedule-on]")).toHaveCount(0);
  await expect(gen.locator("[data-generate-rounds]")).toBeHidden();
  await expect(gen.locator("[data-generate-submit]")).toBeHidden();
  await expect(page.locator('input[name="p0.quantity"]')).toHaveAttribute(
    "type",
    "hidden",
  );
  await expect(page.locator('input[name="p0.unit"]')).toHaveValue("un");

  // 2. Boneca do catálogo: nome na busca, descrição e especificação à
  // direita, só para leitura (sem campo para digitar). O pedido único se
  // digita em caixas; o mínimo (2.000) vira 42 caixas = 2.016 peças.
  await pick(page, 0, "boneca", "prod-boneca");
  // Produto (Nome), Descrição e Especificação saíram da tela (dono,
  // 16/11/2026): os textos da ficha vão escondidos no formulário.
  await expect(first.locator("[data-request-product-locked]")).toHaveCount(0);
  await expect(first.locator('textarea[name="p0.description"]')).toHaveCount(0);
  await expect(first.locator('input[name="p0.description"]')).toHaveValue(
    /Boneca/,
  );
  await expect(first.locator('input[name="p0.productName"]')).toHaveAttribute(
    "type",
    "hidden",
  );
  const boxes = gen.locator("[data-generate-total]");
  await expect(pieces).toHaveAttribute("readonly", "");
  await expect(pieces).toHaveValue("2016");
  await expect(boxes).toHaveValue("42");
  const moqHint = gen.locator("[data-request-moq-hint]");
  await expect(moqHint).toHaveText("Pedido mínimo: 2.000 un (42 caixas)");
  await boxes.fill("20");
  await expect(moqHint).toHaveAttribute("data-request-moq-hint", "below");
  await boxes.blur();
  await expect(boxes).toHaveValue("42");
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("2016");

  // 3. Pedido em 3 programações: as datas aparecem no bloco do pedido; a
  // quantidade da boneca é repartida nelas em caixas inteiras (42 = 14 × 3).
  await setPlan(page, "3");
  await expect(plan).toHaveAttribute("data-order-plan", "3");
  await expect(page.locator("[data-order-plan-date]")).toHaveCount(3);
  await expect(first.locator("[data-schedule-item]")).toHaveCount(3);
  expect(await quantities(page, 0)).toEqual(["672", "672", "672"]);
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("2016");
  // "Programações" travado no número do pedido; sem "+", "×" nem intervalo.
  const rounds = gen.locator("[data-generate-rounds]");
  await expect(rounds).toHaveValue("3");
  await expect(rounds).toHaveAttribute("readonly", "");
  await expect(first.locator("[data-schedule-add]")).toHaveCount(0);
  await expect(first.locator("[data-schedule-interval]").first()).toBeHidden();
  // As datas do produto são as do pedido.
  const planDates = (
    await page.locator("[data-order-plan-date]").allInnerTexts()
  ).map((t) => t.split(": ")[1]);
  expect(await first.locator("[data-schedule-date]").allInnerTexts()).toEqual(
    planDates,
  );

  // 4. O gerador reparte o total de caixas nas 3 datas: 300 caixas = 100
  // por data (4.800 peças), com os containers de cada data.
  await generate(page, 0, "300");
  expect(await quantities(page, 0)).toEqual(["4800", "4800", "4800"]);
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("14400");
  await expect(gen.locator("[data-generate-per-round]")).toHaveText("1");
  // Mudar as caixas de uma data muda o total.
  const card2 = first.locator('[data-schedule-item="2"]');
  await card2.locator("[data-schedule-cartons]").fill("50");
  await expect(qty(page, 0, 2)).toHaveValue("2400");
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("12000");

  // 5. Segundo produto: já nasce com as 3 datas do pedido.
  await page.click("[data-add-request-item]");
  await expect(row(page, 1).locator("[data-schedule-item]")).toHaveCount(3);
  await pick(page, 1, "piscina", "prod-piscina");
  await generate(page, 1, "120");
  expect(await quantities(page, 1)).toEqual(["240", "240", "240"]);
  await expect(page.locator('input[name="p1.quantity"]')).toHaveValue("720");

  // 6. O pedido passa a 2 programações: cada produto reparte de novo o que
  // tinha (boneca 250 caixas = 125 + 125; piscina 120 = 60 + 60).
  await setPlan(page, "2");
  await expect(first.locator("[data-schedule-item]")).toHaveCount(2);
  await expect(row(page, 1).locator("[data-schedule-item]")).toHaveCount(2);
  expect(await quantities(page, 0)).toEqual(["6000", "6000"]);
  expect(await quantities(page, 1)).toEqual(["360", "360"]);
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("12000");
  await expect(page.locator('input[name="p1.quantity"]')).toHaveValue("720");

  // 7. Terceiro produto, sem caixa master: as peças de cada data à mão.
  await page.click("[data-add-request-item]");
  await pick(page, 2, "jarra", "prod-jarra");
  await qty(page, 2, 1).fill("600");
  await qty(page, 2, 2).fill("400");
  await expect(page.locator('input[name="p2.quantity"]')).toHaveValue("1000");

  const dates = (
    await page.locator("[data-order-plan-date]").allInnerTexts()
  ).map((t) => t.split(": ")[1]);
  expect(dates).toHaveLength(2);
  for (const n of [0, 1, 2])
    expect(
      await row(page, n).locator("[data-schedule-date]").allInnerTexts(),
    ).toEqual(dates);

  // 8. Envia e reabre: os três com as mesmas 2 datas, cada um com as
  // quantidades dele.
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
    await createdRequestId(page);
    return page.locator("[data-request-schedule-table]");
  };
  for (const [name, values] of [
    ["Boneca articulada", ["6.000", "12.000"]],
    ["Piscina inflável", ["360", "720"]],
    ["Jarra de vidro", ["600", "400", "1.000"]],
  ] as const) {
    const table = await open(name);
    await expect(table).toContainText("2 programações a cada 45 dias");
    await expect(table.locator("tbody tr")).toHaveCount(3);
    for (const v of [...values, ...dates]) await expect(table).toContainText(v);
  }
});
