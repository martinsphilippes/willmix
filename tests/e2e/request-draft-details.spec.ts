import { expect, test, type Page } from "@playwright/test";
import { fillOrderTerms, login } from "./helpers";

/*
 * Detalhes do rascunho (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção
 * 7): em Encomendas, o número e o ícone do rascunho abrem a mesma tela de
 * detalhes da solicitação enviada, só para consulta. Lá: o número
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
  const details = `/app/requests/draft/${draftId}`;
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
  await expect(page.locator("h1").first()).toContainText(
    `nº ${number.trim()}`,
  );
  await expect(page.locator("[data-draft-customer]")).toContainText(
    "Loja do João",
  );
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

  // Continuar edição: o formulário do rascunho, com os produtos, os nomes e
  // o total de cada um como foram salvos. (A divisão por entrega ao reabrir
  // é do formulário: docs/ORDER_LEVEL_LISTS.md, seção 7.6.)
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
