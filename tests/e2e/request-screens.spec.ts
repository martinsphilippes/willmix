import { expect, test, type Page } from "@playwright/test";
import {
  chooseCustomerLogin,
  fillCustomerContacts,
  fillOrderTerms,
  login,
} from "./helpers";

/*
 * TS - Trading Sales e Venda - Encomenda (dono, 16/11/2026;
 * docs/REQUEST_SCREENS.md): no menu Produto novo, logo abaixo do Overview,
 * duas telas de nova solicitação com o formulário de sempre e o tipo de
 * operação fixo pela tela; cada uma com o seu acesso (Comprador só TS;
 * Gerente de produto e diretorias as duas; administrador tudo). A Nova
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
  await page.waitForURL(/\/app\/requests\/(?!new|batch)[^/?]+$/);
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

test("Produto novo: TS e Venda logo abaixo do Overview; o tipo é o da tela; Encomendas igual", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  const links = await newProductLinks(page);
  expect(links.slice(0, 3)).toEqual([
    "/app/flow/new-product",
    "/app/new-request/ts",
    "/app/new-request/sale",
  ]);
  const group = sidebar(page).locator('[data-nav-group="Produto novo"]');
  await expect(
    group.locator('[data-nav-link="/app/new-request/ts"]'),
  ).toHaveText(/TS - Trading Sales/);
  await expect(
    group.locator('[data-nav-link="/app/new-request/sale"]'),
  ).toHaveText(/Venda - Encomenda/);

  // TS - Trading Sales: a tela própria, sem compra para estoque.
  await group.locator('[data-nav-link="/app/new-request/ts"]').click();
  await page.waitForURL(/\/app\/new-request\/ts$/);
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
  // Comprador (e Planner): TS no menu e na tela; Venda nem no menu nem pelo
  // endereço.
  await login(page, "operador@wellmix.com");
  let links = await newProductLinks(page);
  expect(links).toContain("/app/new-request/ts");
  expect(links).not.toContain("/app/new-request/sale");
  await page.goto("/app/new-request/ts");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "TS - Trading Sales",
  );
  await page.goto("/app/new-request/sale");
  await page.waitForURL(/[?&]denied=requestSale/);

  // Diretoria de compras (a "Liderança"): as duas.
  await login(page, "diretoria@wellmix.com");
  links = await newProductLinks(page);
  expect(links.indexOf("/app/new-request/ts")).toBeGreaterThan(-1);
  expect(links.indexOf("/app/new-request/sale")).toBe(
    links.indexOf("/app/new-request/ts") + 1,
  );
  await page.goto("/app/new-request/sale");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Venda - Encomenda",
  );

  // Vendas: nenhuma das duas (o administrador libera em Funções e acessos).
  await login(page, "vendas@wellmix.com");
  await page.goto("/app");
  await expect(
    sidebar(page).locator('[data-nav-link^="/app/new-request/"]'),
  ).toHaveCount(0);
  await page.goto("/app/new-request/ts");
  await page.waitForURL(/[?&]denied=requestTs/);

  // O cliente também não abre (a tela é da Wellmix vendendo ao cliente): a
  // recusa leva à página inicial dele (a vitrine), com o aviso.
  await login(page, "joao@lojista.com");
  await page.goto("/app/new-request/ts");
  await page.waitForURL(/[?&]denied=requestTs/);
});
