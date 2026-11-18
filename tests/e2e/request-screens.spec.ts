import { expect, test, type Page } from "@playwright/test";
import {
  chooseCustomerLogin,
  fillCustomerContacts,
  fillOrderTerms,
  login,
  createdRequestId,
} from "./helpers";

/*
 * TS - Trading Sales e Venda - Encomenda (dono, 16/11/2026;
 * docs/REQUEST_SCREENS.md): duas telas de nova solicitação com o formulário
 * de sempre e o tipo de operação fixo pela tela; cada uma com o seu acesso
 * (Comprador só TS; Gerente de produto e diretorias as duas; administrador
 * tudo). Fora do menu: o "+ Adicionar" de Encomendas abre TS e o de
 * Reposição abre Venda (compra para estoque, origem reposição). A Nova
 * solicitação de Encomendas continua como está.
 */

const sidebar = (page: Page) => page.locator("[data-sidebar-nav]").first();

/** Os links do grupo Produto novo, na ordem do menu lateral. */
async function newProductLinks(page: Page) {
  await page.goto("/app");
  const group = sidebar(page).locator('[data-nav-group="Produto novo"]');
  await expect(group).toBeVisible();
  const toggle = group.locator("button").first();
  if ((await toggle.getAttribute("aria-expanded")) === "false")
    await toggle.click();
  await expect(group.locator("[data-nav-link]").first()).toBeVisible();
  return group
    .locator("[data-nav-link]")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
}

async function chooseCustomer(page: Page, text: string, id: string) {
  const picker = page.locator(
    '[data-request-customer] [data-party-picker="customer"]',
  );
  await picker.locator("[data-party-picker-input]").fill(text);
  await picker.locator(`[data-party-picker-option="${id}"]`).click();
}

async function pickDoll(page: Page) {
  const row = page.locator('[data-request-item="0"]');
  const product = row.locator('[data-product-picker="catalog"]');
  await product.locator("[data-product-picker-input]").fill("boneca");
  await product.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(row.locator('[role="status"]').first()).toBeVisible();
  await row
    .locator("[data-rounds-generator] [data-generate-total]")
    .fill("100");
}

async function send(page: Page) {
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await createdRequestId(page);
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** O tipo de operação: só o da tela, já marcado. */
async function expectFixedOperation(page: Page, op: "ts" | "sale") {
  const terms = page.locator("[data-order-terms]");
  await expect(
    terms.locator(`[data-order-terms-operation-fixed="${op}"]`),
  ).toBeVisible();
  await expect(
    terms.locator("[data-order-terms-operation-option]"),
  ).toHaveCount(1);
  await expect(
    terms.locator(`[data-order-terms-operation-option="${op}"]`),
  ).toBeChecked();
}

test("TS e Venda fora do menu: o + Adicionar de Encomendas abre TS e o de Reposição abre Venda; o tipo é o da tela; Encomendas igual", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  const links = await newProductLinks(page);
  // Fora do menu (dono, 16/11/2026); Encomendas e Reposição seguem nele.
  expect(links).not.toContain("/app/new-request/ts");
  expect(links).not.toContain("/app/new-request/sale");
  expect(links).toEqual(
    expect.arrayContaining(["/app/requests", "/app/replenishment"]),
  );

  // Encomendas: "+ Adicionar" abre TS - Trading Sales; o item do menu acende.
  await page.goto("/app/requests");
  await page.locator("[data-request-add]").click();
  await page.waitForURL(/\/app\/new-request\/ts$/);
  await expect(
    sidebar(page).locator('[data-nav-link="/app/requests"]'),
  ).toHaveAttribute("aria-current", "page");

  // TS - Trading Sales: a tela própria, sem compra para estoque.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "TS - Trading Sales",
  );
  await expect(page.locator('[data-request-screen="ts"]')).toBeVisible();
  await expect(page.locator("[data-stock-option]")).toHaveCount(0);
  await chooseCustomer(page, "loja", "cliente-joao");
  await expectFixedOperation(page, "ts");

  // Rascunho da tela de TS: fica nela; não aparece na de Venda nem em
  // Encomendas; apaga-se nela.
  await page.locator("[data-request-draft-save]").click();
  await page.waitForURL(/\/app\/new-request\/ts\?draft=[^&]+&draftSaved=1/);
  const draftId = new URL(page.url()).searchParams.get("draft")!;
  const draftRow = page.locator(`[data-request-draft="${draftId}"]`);
  await expect(draftRow).toBeVisible();
  await page.goto("/app/new-request/sale");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Venda - Encomenda",
  );
  await expect(draftRow).toHaveCount(0);
  await page.goto("/app/requests/new");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Nova solicitação",
  );
  await expect(draftRow).toHaveCount(0);
  await page.goto("/app/new-request/ts");
  await draftRow.locator("[data-request-draft-delete]").click();
  await page.waitForURL(/\/app\/new-request\/ts\?draftDeleted=1/);
  await expect(draftRow).toHaveCount(0);

  // Enviar: nasce TS.
  await page.goto("/app/new-request/ts");
  await chooseCustomer(page, "loja", "cliente-joao");
  await chooseCustomerLogin(page, "joao@lojista.com");
  await fillOrderTerms(page, { format: "wd", caller: "customer" });
  await pickDoll(page);
  await fillCustomerContacts(page, "loja-joao");
  await send(page);
  await expect(page.locator("[data-request-order-terms]")).toContainText(
    "TS (Trading Sales)",
  );

  // Venda - Encomenda: a mesma tela, com Venda fixa.
  await page.goto("/app/new-request/sale");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Venda - Encomenda",
  );
  await expect(page.locator("[data-stock-option]")).toHaveCount(0);
  await chooseCustomer(page, "loja", "cliente-joao");
  await expectFixedOperation(page, "sale");
  await chooseCustomerLogin(page, "joao@lojista.com");
  await fillOrderTerms(page, {
    format: "wd",
    caller: "customer",
    operation: "sale",
  });
  await pickDoll(page);
  await fillCustomerContacts(page, "loja-joao");
  await send(page);
  const terms = page.locator("[data-request-order-terms]");
  await expect(terms).toContainText("Venda");
  await expect(terms).not.toContainText("TS (Trading Sales)");

  // Reposição: "+ Adicionar" abre a tela Venda como compra para estoque.
  await page.goto("/app/replenishment");
  await page.locator("[data-replenishment-add]").click();
  await page.waitForURL(/\/app\/new-request\/sale\?from=replenishment$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Reposição - Adicionar",
  );
  await expect(page.locator("[data-stock-option]")).toBeChecked();
  await expect(
    sidebar(page).locator('[data-nav-link="/app/replenishment"]'),
  ).toHaveAttribute("aria-current", "page");

  // Encomendas → Nova solicitação: como sempre (TS marcado, Venda "(em
  // breve)", compra para estoque).
  await page.goto("/app/requests/new");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Nova solicitação",
  );
  await expect(page.locator("[data-request-screen]")).toHaveCount(0);
  await expect(page.locator("[data-stock-option]")).toBeVisible();
  await chooseCustomer(page, "loja", "cliente-joao");
  const legacy = page.locator("[data-order-terms]");
  await expect(
    legacy.locator('[data-order-terms-operation-option="ts"]'),
  ).toBeChecked();
  await expect(
    legacy.locator('[data-order-terms-operation-option="sale"]'),
  ).toBeDisabled();
  await expect(
    legacy.locator("[data-order-terms-operation-fixed]"),
  ).toHaveCount(0);
});

test("Acesso: Comprador só TS; diretoria as duas; Vendas nenhuma; endereço direto recusado", async ({
  page,
}) => {
  // Comprador (e Planner): TS pelo "+ Adicionar" de Encomendas, fora do menu;
  // Venda nem pelo endereço, só pela entrada da Reposição (ação "Abrir
  // reposição").
  await login(page, "operador@wellmix.com");
  let links = await newProductLinks(page);
  expect(links).not.toContain("/app/new-request/ts");
  expect(links).not.toContain("/app/new-request/sale");
  await page.goto("/app/requests");
  await expect(page.locator("[data-request-add]")).toHaveAttribute(
    "href",
    "/app/new-request/ts",
  );
  await page.goto("/app/new-request/ts");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "TS - Trading Sales",
  );
  await page.goto("/app/new-request/sale");
  await page.waitForURL(/[?&]denied=requestSale/);
  await page.goto("/app/new-request/sale?from=replenishment");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Reposição - Adicionar",
  );

  // Diretoria de compras (a "Liderança"): as duas telas, pelo endereço e
  // pelos botões; Reposição abre Venda.
  await login(page, "diretoria@wellmix.com");
  links = await newProductLinks(page);
  expect(links).not.toContain("/app/new-request/ts");
  expect(links).not.toContain("/app/new-request/sale");
  await page.goto("/app/replenishment");
  await expect(page.locator("[data-replenishment-add]")).toHaveAttribute(
    "href",
    /\/app\/new-request\/sale/,
  );
  await page.goto("/app/new-request/sale");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Venda - Encomenda",
  );
  // Sem a entrada da Reposição, a tela é só de venda ao cliente.
  await expect(page.locator("[data-stock-option]")).toHaveCount(0);

  // Vendas: nenhuma das duas (o administrador libera em Funções e acessos);
  // o "+ Adicionar" de Encomendas segue para a Nova solicitação de sempre.
  await login(page, "vendas@wellmix.com");
  await page.goto("/app/requests");
  await expect(page.locator("[data-request-add]")).toHaveAttribute(
    "href",
    "/app/requests/new",
  );
  await page.goto("/app/new-request/ts");
  await page.waitForURL(/[?&]denied=requestTs/);

  // O cliente também não abre (a tela é da Wellmix vendendo ao cliente): a
  // recusa leva à página inicial dele (a vitrine), com o aviso.
  await login(page, "joao@lojista.com");
  await page.goto("/app/new-request/ts");
  await page.waitForURL(/[?&]denied=requestTs/);
  await page.goto("/app/new-request/sale?from=replenishment");
  await page.waitForURL(/[?&]denied=requestSale/);
});

/** A quantidade de entregas programadas (o número de programações do pedido). */
async function setPlanCount(page: Page, n: string) {
  const input = page.locator("[data-order-plan-count]");
  await input.fill(n);
  await input.blur();
}

test("TS e Venda: as programações falam do recebimento previsto pelo cliente; Encomendas com os textos de sempre", async ({
  page,
}) => {
  const date = /\d{2}\/\d{2}\/\d{4}/;
  await login(page, "admin@wellmix.com");

  // TS - Trading Sales: o bloco do pedido, as datas, os cartões de cada
  // produto e a Composição de containers dizem que cada programação é um
  // recebimento previsto pelo cliente.
  await page.goto("/app/new-request/ts");
  await chooseCustomer(page, "loja", "cliente-joao");
  await fillOrderTerms(page, { format: "wd", caller: "customer" });
  await setPlanCount(page, "2");
  const plan = page.locator("[data-order-plan]");
  for (const text of [
    "Programação de entregas ao cliente",
    "Quantidade de entregas programadas",
    "Intervalo entre recebimentos previstos",
    "Data prevista do 1º recebimento",
    "Datas previstas de recebimento pelo cliente",
  ])
    await expect(plan).toContainText(text);
  await expect(plan).not.toContainText("Datas das programações");
  await expect(page.locator('[data-order-plan-date="1"]')).toHaveText(
    new RegExp(`^Programação 1 — Recebimento previsto: ${date.source}`),
  );
  await expect(page.locator('[data-order-plan-date="2"]')).toHaveText(
    new RegExp(`^Programação 2 — Recebimento previsto: ${date.source}`),
  );
  await pickDoll(page);
  // Gera as entregas pelo total de caixas: a composição sai delas.
  await page
    .locator(
      '[data-request-item="0"] [data-rounds-generator] [data-generate-submit]',
    )
    .click();
  const card = page.locator('[data-request-item="0"] [data-schedule-item="1"]');
  await expect(card).toContainText("Programação 1");
  await expect(card).toContainText("Recebimento previsto:");
  const round = page.locator('[data-composition-round="1"]');
  await expect(round).toContainText("Programação 1");
  await expect(round.locator("[data-composition-round-date]")).toHaveText(
    new RegExp(`^Recebimento previsto: ${date.source}$`),
  );

  // Venda - Encomenda: os mesmos textos.
  await page.goto("/app/new-request/sale");
  await setPlanCount(page, "2");
  await expect(page.locator('[data-order-plan-date="1"]')).toHaveText(
    new RegExp(`^Programação 1 — Recebimento previsto: ${date.source}`),
  );

  // Encomendas → Nova solicitação: os textos de sempre.
  await page.goto("/app/requests/new");
  await page.locator("[data-request-customer] [data-stock-option]").check();
  await setPlanCount(page, "2");
  await expect(page.locator("[data-order-plan]")).toContainText(
    "Datas das programações",
  );
  await expect(page.locator('[data-order-plan-date="1"]')).toHaveText(
    new RegExp(`^Programação 1: ${date.source}`),
  );
  await expect(page.locator("[data-order-plan-receipt]")).toHaveCount(0);
  const picker = page.locator(
    '[data-request-item="0"] [data-product-picker="catalog"]',
  );
  await picker.locator("[data-product-picker-input]").fill("boneca");
  await picker.locator('[data-product-picker-option="prod-boneca"]').click();
  await page
    .locator(
      '[data-request-item="0"] [data-rounds-generator] [data-generate-total]',
    )
    .fill("100");
  await page
    .locator(
      '[data-request-item="0"] [data-rounds-generator] [data-generate-submit]',
    )
    .click();
  await expect(
    page.locator('[data-composition-round="1"] [data-composition-round-date]'),
  ).toHaveText(new RegExp(`^${date.source}$`));
});

test("TS e Venda: a recusa depois de criar fala das entregas programadas; Encomendas com o texto de sempre", async ({
  page,
}) => {
  // Revisão completa dos textos das programações (dono, 16/11/2026).
  await login(page, "admin@wellmix.com");
  for (const path of ["/app/new-request/ts", "/app/new-request/sale"]) {
    await page.goto(`${path}?error=after_create`);
    await expect(
      page.getByText(
        "As solicitações foram criadas, mas uma etapa seguinte falhou (anexo, foto da busca ou entregas programadas ao cliente).",
        { exact: false },
      ),
    ).toBeVisible();
  }
  await page.goto("/app/requests/new?error=after_create");
  await expect(
    page.getByText("(anexo, foto da busca ou programação)", { exact: false }),
  ).toBeVisible();
});
