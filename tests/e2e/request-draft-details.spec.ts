import { expect, test, type Page } from "@playwright/test";
import { fillOrderTerms, login } from "./helpers";

/*
 * Detalhes do rascunho (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção
 * 7): em Encomendas, o número e o ícone do rascunho abrem a mesma tela de
 * detalhes da solicitação enviada (/app/requests/batch/<id>, pelo id do
 * rascunho), só para consulta. Lá: o número
 * persistente, o cliente, a data, "Rascunho" (privado), a próxima ação
 * "Concluir e enviar" com quem salvou, os totais (parciais quando falta
 * dado), a tabela de produtos e os detalhes de cada um; "Continuar edição"
 * volta ao formulário com tudo o que foi salvo. Abrir não muda nada (nem
 * contadores, nem número, nem avisos), e a volta para a lista mantém os
 * filtros e a rolagem. Só quem salvou abre (URL direta também).
 */
const TAG = `DRF${Date.now().toString(36).toUpperCase()}`;

async function chooseCustomer(page: Page, text: string, id: string) {
  const picker = page.locator(
    '[data-request-customer] [data-party-picker="customer"]',
  );
  await picker.locator("[data-party-picker-input]").fill(text);
  await picker.locator(`[data-party-picker-option="${id}"]`).click();
}

/**
 * O rascunho: a boneca em 3 entregas de 15 caixas de 48, um copo fora do
 * catálogo (100, a 2ª entrega em branco e um zero digitado na 3ª) e um prato
 * fora do catálogo ainda sem quantidade.
 */
async function saveDraft(page: Page): Promise<string> {
  await page.goto("/app/requests/new");
  await chooseCustomer(page, "loja", "cliente-joao");
  await fillOrderTerms(page);
  const doll = page.locator('[data-request-item="0"]');
  const picker = doll.locator('[data-product-picker="catalog"]');
  await picker.locator("[data-product-picker-input]").fill("boneca");
  await picker.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(doll.locator('[role="status"]').first()).toBeVisible();
  const planCount = page.locator("[data-order-plan-count]");
  await planCount.fill("3");
  await planCount.blur();
  await page.click('[data-order-plan-interval="30"]');
  await expect(doll.locator("[data-schedule-item]")).toHaveCount(3);
  for (const n of [1, 2, 3])
    await doll.locator(`[data-schedule-cartons="${n}"]`).fill("15");
  await page.click("[data-add-request-item]");
  await page.check('[data-request-item="1"] input[name="p1.sourcingDemand"]');
  await page.fill('input[name="p1.productName"]', `Copo ${TAG}`);
  await page.fill('textarea[name="p1.description"]', "Copo de vidro 300 ml");
  await page.fill('input[name="p1.schedule.qty.1"]', "100");
  await page.fill('input[name="p1.schedule.qty.3"]', "0");
  await page.click("[data-add-request-item]");
  await page.check('[data-request-item="2"] input[name="p2.sourcingDemand"]');
  await page.fill('input[name="p2.productName"]', `Prato ${TAG}`);
  await page.fill('textarea[name="p2.description"]', "Prato raso 26 cm");
  await page.locator("[data-request-draft-save]").click();
  await page.waitForURL(/[?&]draftSaved=1/);
  return new URL(page.url()).searchParams.get("draft")!;
}

/** Os números dos cards de Encomendas (Total, Abertas, Rascunhos, Atrasadas). */
async function cards(page: Page) {
  await page.goto("/app/requests");
  const out: Record<string, string | null> = {};
  for (const k of ["all", "open", "draft", "late"])
    out[k] = await page
      .locator(`[data-request-card="${k}"]`)
      .getAttribute("data-request-card-count");
  return out;
}

test("Encomendas: o rascunho abre a mesma tela de detalhes, só para consulta", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  const draftId = await saveDraft(page);
  const before = await cards(page);
  const bell = await page
    .locator("[data-notifications-bell]")
    .getAttribute("data-notifications-bell");

  // Lista: o número e o ícone levam ao mesmo lugar (os detalhes).
  await page.setViewportSize({ width: 1280, height: 420 });
  await page.goto("/app/requests?situ=draft");
  const row = page.locator(`[data-request-list-draft="${draftId}"]`);
  const number = (await row.locator("[data-request-number]").textContent())!;
  expect(number.trim()).toMatch(/^\d+$/);
  // A mesma rota da solicitação enviada, pelo id do rascunho.
  const details = `/app/requests/batch/${draftId}`;
  await expect(row.locator("[data-request-draft-open]")).toHaveAttribute(
    "href",
    details,
  );
  await expect(row.locator("[data-request-list-draft-open]")).toHaveAttribute(
    "href",
    details,
  );
  // Rola até a linha (a tela baixa obriga a rolar) e abre pelo número.
  await row.locator("[data-request-draft-open]").scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => Math.round(window.scrollY));
  expect(y).toBeGreaterThan(0);
  await row.locator("[data-request-draft-open]").click();
  await page.waitForURL(new RegExp(`${details}$`));

  // Cabeçalho: número, cliente, data, Rascunho e a próxima ação com quem age.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("h1").first()).toContainText(`nº ${number.trim()}`);
  await expect(page.locator("[data-details-customer]")).toContainText(
    "Loja do João",
  );
  await expect(page.locator('[data-details-state="draft"]')).toBeVisible();
  const status = page.locator("[data-draft-status]");
  await expect(status).toContainText("Rascunho");
  await expect(status.locator('[data-request-next="draft"]')).toContainText(
    "Concluir e enviar",
  );
  await expect(status.locator("[data-request-responsible]")).toHaveText(
    "Ana Admin · Wellmix",
  );
  await expect(page.locator("[data-draft-private]")).toContainText(
    "só você vê",
  );
  await expect(page.locator("[data-draft-resume]")).toHaveAttribute(
    "href",
    `/app/requests/new?draft=${draftId}`,
  );
  // Nada de etapa, prazo ou pedido de solicitação enviada.
  await expect(page.locator("[data-request-turn]")).toHaveCount(0);
  await expect(page.locator("[data-batch-send-all]")).toHaveCount(0);

  // Totais: a boneca 3 × 720 = 2.160 e o copo 100; o prato sem quantidade
  // deixa os totais parciais (nunca um zero que ninguém digitou).
  const total = (key: string) =>
    page.locator(`[data-batch-total="${key}"] [data-request-total]`);
  await expect(total("pieces")).toHaveAttribute("data-total-value", "2260");
  await expect(total("pieces")).toHaveAttribute("data-total-partial", "");
  await expect(total("boxes")).toHaveAttribute("data-total-value", "45");
  await expect(total("price")).toHaveAttribute("data-total-empty", "");
  const items = page.locator("[data-batch-item]");
  await expect(items).toHaveCount(3);
  const doll = items.filter({ hasText: "Boneca" });
  await expect(doll.locator("[data-batch-per-box]")).toHaveText("48");
  await expect(doll.locator("[data-batch-pieces]")).toHaveText("2.160");
  await expect(doll.locator("[data-batch-boxes]")).toHaveText("45");
  await expect(doll.locator("[data-draft-deadline]")).toHaveText("—");
  const plate = items.filter({ hasText: `Prato ${TAG}` });
  await expect(plate.locator("[data-batch-pieces]")).toHaveText("—");
  await expect(plate.locator("[data-draft-incomplete]")).toBeVisible();

  // Detalhes de um produto: o copo, com a entrega em branco ("—") e o zero
  // digitado ("0 un").
  await items
    .filter({ hasText: `Copo ${TAG}` })
    .locator("[data-batch-product-open]")
    .click();
  await page.waitForURL(new RegExp(`${details}\\?item=2$`));
  const focus = page.locator('[data-draft-item-focus="2"]');
  await expect(focus).toContainText(`Copo ${TAG}`);
  await expect(focus.locator('[data-request-schedule-blank="2"]')).toHaveText(
    "—",
  );
  await expect(
    focus.locator("[data-request-schedule-table] tbody tr").nth(2),
  ).toContainText("0 un");
  await expect(page.locator("[data-batch-item]")).toHaveCount(1);
  await page.locator("[data-draft-item-all]").click();
  await page.waitForURL(new RegExp(`${details}$`));

  // Atualizar a página e abrir pela URL direta: a mesma tela.
  await page.reload();
  await expect(page.locator("[data-draft-status]")).toContainText("Rascunho");

  // Voltar: a lista com o filtro e a rolagem de antes.
  await page.setViewportSize({ width: 1280, height: 420 });
  await page.locator("[data-details-back]").click();
  await page.waitForURL(/\/app\/requests\?situ=draft$/);
  await expect
    .poll(() => page.evaluate(() => Math.round(window.scrollY)))
    .toBe(y);
  await page.setViewportSize({ width: 1280, height: 900 });

  // Só consulta: os cards, o número do rascunho e os avisos não mudaram.
  expect(await cards(page)).toEqual(before);
  await expect(page.locator("[data-notifications-bell]")).toHaveAttribute(
    "data-notifications-bell",
    bell ?? "0",
  );
  await page.goto("/app/requests?situ=draft");
  await expect(row.locator("[data-request-number]")).toHaveText(number);

  // Continuar edição: o formulário do rascunho, com os produtos, os nomes, o
  // total e cada entrega como foram salvos (docs/ORDER_LEVEL_LISTS.md, seção
  // 7.6): o copo volta 100 / 0 / 0 (a entrega em branco volta como zero,
  // como o envio também a conta), não a divisão igual 34 / 33 / 33.
  await page.goto(details);
  await page.locator("[data-draft-resume]").click();
  await page.waitForURL(new RegExp(`/app/requests/new\\?draft=${draftId}`));
  await expect(page.locator('input[name="p0.productId"]')).toHaveValue(
    "prod-boneca",
  );
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("2160");
  await expect(page.locator('input[name="p1.productName"]')).toHaveValue(
    `Copo ${TAG}`,
  );
  await expect(page.locator('textarea[name="p1.description"]')).toHaveValue(
    "Copo de vidro 300 ml",
  );
  await expect(page.locator('input[name="p1.quantity"]')).toHaveValue("100");
  for (const [n, value] of [
    [1, "100"],
    [2, "0"],
    [3, "0"],
  ] as const)
    await expect(
      page.locator(`input[name="p1.schedule.qty.${n}"]`),
    ).toHaveValue(value);
  // A boneca: 15 caixas em cada entrega, como foi salvo.
  for (const n of [1, 2, 3])
    await expect(
      page.locator(`input[name="p0.schedule.qty.${n}"]`),
    ).toHaveValue("720");
  await expect(page.locator('input[name="p2.productName"]')).toHaveValue(
    `Prato ${TAG}`,
  );
  await expect(page.locator('input[name="p2.quantity"]')).toHaveValue("");

  // iPad: a página não rola de lado (só a tabela).
  await page.setViewportSize({ width: 834, height: 1194 });
  await page.goto(details);
  await expect(page.locator("[data-batch-totals]")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);

  // Outro login da Wellmix e o cliente: 404 pela URL direta (o rascunho é
  // de quem salvou).
  for (const email of ["operador@wellmix.com", "joao@lojista.com"]) {
    await login(page, email);
    const response = await page.goto(details);
    expect(response?.status()).toBe(404);
    await expect(page.locator("[data-draft-status]")).toHaveCount(0);
  }
});

/**
 * O caso do dono (19/11/2026): na lista, a nº 3 enviada (de um cliente) e o
 * nº 5 em rascunho (de outro). O número de cada um abre a tela de detalhes
 * daquele registro, com os dados dele; ir e voltar entre os dois não mistura
 * nada, e o rascunho continua rascunho.
 */
test("Encomendas: o número abre os detalhes do registro certo (rascunho de um cliente, enviada de outro)", async ({
  page,
}) => {
  // A enviada: o João (Loja do João) pede a boneca, 100 caixas de 48.
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  const line = page.locator('[data-request-item="0"]');
  const catalog = line.locator('[data-product-picker="catalog"]');
  await catalog.locator("[data-product-picker-input]").fill("boneca");
  await catalog.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(line.locator('[role="status"]').first()).toBeVisible();
  await line
    .locator("[data-rounds-generator] [data-generate-total]")
    .fill("100");
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await page.waitForURL(/\/app\/requests\/batch\/[^/?]+\?created=1/);
  const sentPath = new URL(page.url()).pathname;

  // O rascunho: outro cliente, a boneca em 4 entregas (465, 465, 465 e 375
  // caixas = 22.320, 22.320, 22.320 e 18.000 peças).
  await login(page, "admin@wellmix.com");
  await page.goto("/app/customers/new");
  const other = `Campineira ${TAG}`;
  await page.fill('input[name="name"]', other);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/customers\/[^/?#]+\/edit(#access)?$/);
  const otherId = new URL(page.url()).pathname.split("/").at(-2)!;
  await page.goto("/app/requests/new");
  await chooseCustomer(page, TAG, otherId);
  await fillOrderTerms(page);
  const draftLine = page.locator('[data-request-item="0"]');
  const picker = draftLine.locator('[data-product-picker="catalog"]');
  await picker.locator("[data-product-picker-input]").fill("boneca");
  await picker.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(draftLine.locator('[role="status"]').first()).toBeVisible();
  const planCount = page.locator("[data-order-plan-count]");
  await planCount.fill("4");
  await planCount.blur();
  await page.click('[data-order-plan-interval="45"]');
  await expect(draftLine.locator("[data-schedule-item]")).toHaveCount(4);
  for (const [i, n] of [465, 465, 465, 375].entries())
    await draftLine
      .locator(`[data-schedule-cartons="${i + 1}"]`)
      .fill(String(n));
  await page.locator("[data-request-draft-save]").click();
  await page.waitForURL(/[?&]draftSaved=1/);
  const draftId = new URL(page.url()).searchParams.get("draft")!;
  const draftPath = `/app/requests/batch/${draftId}`;
  const before = await cards(page);

  // Os números na lista.
  await page.goto("/app/requests");
  const draftRow = page.locator(`[data-request-list-draft="${draftId}"]`);
  const sentRow = page.locator(
    `[data-request-row]:has(a[data-request-open][href="${sentPath}"])`,
  );
  const draftNumber = (await draftRow
    .locator("[data-request-number]")
    .textContent())!.trim();
  const sentNumber = (await sentRow
    .locator("[data-request-number]")
    .textContent())!.trim();
  expect(draftNumber).not.toBe(sentNumber);

  const expectDraft = async () => {
    await expect(page.locator("h1").first()).toContainText(
      `Solicitação nº ${draftNumber}`,
    );
    await expect(page.locator("[data-details-customer]")).toHaveText(other);
    await expect(page.locator('[data-details-state="draft"]')).toBeVisible();
    await expect(page.locator("[data-draft-status]")).toContainText("Rascunho");
    const items = page.locator("[data-batch-item]");
    await expect(items).toHaveCount(1);
    await expect(items.locator("[data-batch-pieces]")).toHaveText("84.960");
    await expect(items.locator("[data-batch-boxes]")).toHaveText("1.770");
    // Nada da enviada: nem o cliente dela, nem a vez, nem o "Enviar para
    // cotação".
    await expect(page.locator("main")).not.toContainText("Loja do João");
    await expect(page.locator("[data-request-turn]")).toHaveCount(0);
    await expect(page.locator("[data-batch-send-all]")).toHaveCount(0);
  };
  const expectSent = async () => {
    await expect(page.locator("h1").first()).toContainText(
      `Solicitação nº ${sentNumber}`,
    );
    await expect(page.locator("[data-details-customer]")).toHaveText(
      "Loja do João Ltda",
    );
    await expect(page.locator('[data-details-state="sent"]')).toBeVisible();
    await expect(page.locator("[data-draft-status]")).toHaveCount(0);
    await expect(page.locator("[data-request-turn]").first()).toBeVisible();
    const items = page.locator("[data-batch-item]");
    await expect(items).toHaveCount(1);
    await expect(items.locator("[data-batch-pieces]")).toHaveText("4.800");
    await expect(page.locator("main")).not.toContainText(other);
  };

  // Clicar no número do rascunho: os detalhes dele (não o formulário).
  await draftRow.locator("[data-request-draft-open]").click();
  await page.waitForURL(new RegExp(`${draftPath}$`));
  await expectDraft();
  // Voltar e clicar no número da enviada: os detalhes dela.
  await page.locator("[data-details-back]").click();
  await page.waitForURL(/\/app\/requests$/);
  await sentRow.locator("[data-request-open]").click();
  await page.waitForURL(new RegExp(`${sentPath}$`));
  await expectSent();
  // Ir e voltar de novo, pelo voltar do navegador e pelo ícone.
  await page.goBack();
  await page.waitForURL(/\/app\/requests$/);
  await draftRow.locator("[data-request-list-draft-open]").click();
  await page.waitForURL(new RegExp(`${draftPath}$`));
  await expectDraft();
  await page.goBack();
  await sentRow.locator("[data-request-open]").click();
  await page.waitForURL(new RegExp(`${sentPath}$`));
  await expectSent();
  // Atualizar e abrir pela URL direta.
  await page.goto(draftPath);
  await expectDraft();
  await page.reload();
  await expectDraft();

  // Continuar edição: o formulário do rascunho, com o cliente, o produto e
  // cada entrega como foi salva (22.320 / 22.320 / 22.320 / 18.000, não a
  // divisão igual 21.240 em cada; docs/ORDER_LEVEL_LISTS.md, seção 7.6).
  await page.locator("[data-draft-resume]").click();
  await page.waitForURL(new RegExp(`/app/requests/new\\?draft=${draftId}`));
  await expect(
    page.locator("[data-request-customer] [data-party-picker-input]"),
  ).toHaveValue(other);
  await expect(page.locator('input[name="p0.productId"]')).toHaveValue(
    "prod-boneca",
  );
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("84960");
  const resumed = page.locator('[data-request-item="0"]');
  for (const [n, pieces, boxes] of [
    [1, "22320", "465"],
    [2, "22320", "465"],
    [3, "22320", "465"],
    [4, "18000", "375"],
  ] as const) {
    await expect(
      page.locator(`input[name="p0.schedule.qty.${n}"]`),
    ).toHaveValue(pieces);
    await expect(resumed.locator(`[data-schedule-cartons="${n}"]`)).toHaveValue(
      boxes,
    );
  }
  // Salvar de novo não muda a divisão (o que foi reaberto é o que foi salvo).
  await page.locator("[data-request-draft-save]").click();
  await page.waitForURL(/[?&]draftSaved=1/);
  await page.goto(draftPath);
  const saved = page.locator("[data-batch-item]");
  await expect(saved.locator("[data-batch-pieces]")).toHaveText("84.960");
  await page.goto(`${draftPath}?item=1`);
  const rounds = page.locator(
    "[data-draft-item-focus] [data-request-schedule-table] tbody tr",
  );
  for (const [i, text] of [
    [0, "22.320"],
    [1, "22.320"],
    [2, "22.320"],
    [3, "18.000"],
  ] as const)
    await expect(rounds.nth(i)).toContainText(text);

  // Depois da consulta: segue rascunho, com o mesmo número, e nada mudou nos
  // cards.
  expect(await cards(page)).toEqual(before);
  await page.goto("/app/requests?situ=draft");
  await expect(draftRow.locator("[data-request-number]")).toHaveText(
    draftNumber,
  );
  await expect(draftRow).toContainText("Rascunho");

  // iPad: o mesmo caminho pelo número.
  await page.setViewportSize({ width: 834, height: 1194 });
  await page.goto("/app/requests");
  await draftRow.locator("[data-request-draft-open]").click();
  await page.waitForURL(new RegExp(`${draftPath}$`));
  await expectDraft();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});
