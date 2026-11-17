import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Cadastros → Clientes (dono, 15/11/2026; docs/FLOW_MENU.md): os clientes
 * saíram de Equipe Acessos e Parceiros → Parceiros → Cadastros e ganharam a
 * página própria no menu (a tela Clientes de sempre, /app/customers, com o
 * Login de acesso de cada cliente que vinha de Parceiros). Parceiros não lista mais
 * clientes, nem em "Todos os tipos"; o endereço antigo
 * (/app/parties?type=customer) leva para Clientes com a busca. Os cadastros,
 * os IDs e os vínculos não mudaram: o seletor de cliente e o RCA na Nova
 * solicitação seguem funcionando.
 */

const sidebar = (page: Page) =>
  page.locator("[data-sidebar]").filter({ visible: true }).first();
const customersLink = (page: Page) =>
  sidebar(page).locator('[data-nav-link="/app/customers"]');
const rows = (page: Page) => page.locator("[data-customer-row]");

/** Nomes das linhas da lista de Clientes. */
async function customerNames(page: Page) {
  // Só o link do nome (embaixo dele fica o link do login de acesso).
  return (
    await rows(page)
      .locator('td:nth-child(2) a[href^="/app/customers/"]')
      .allInnerTexts()
  ).map((n) => n.trim());
}

test("Cadastros → Clientes: página própria, só clientes, busca e ações", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app");

  // No menu: Clientes dentro de Cadastros.
  const registry = sidebar(page).locator('[data-nav-group="Cadastros"]');
  await registry.locator("button").first().click();
  await expect(customersLink(page)).toHaveText(/Clientes/);
  await customersLink(page).click();
  await page.waitForURL(/\/app\/customers$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Clientes");
  await expect(customersLink(page)).toHaveAttribute("aria-current", "page");
  // O item de Equipe Acessos e Parceiros não acende aqui.
  await expect(
    sidebar(page).locator(
      '[data-sidebar-footer] [data-nav-link][aria-current="page"]',
    ),
  ).toHaveCount(0);

  // Só clientes (ativos e inativos), nenhum fornecedor ou outro parceiro.
  await page.goto("/app/customers?status=all");
  const names = await customerNames(page);
  expect(names).toContain("Loja do João Ltda");
  expect(names).toContain("Wellmix SC");
  for (const other of [
    "Shenzhen Supplier A",
    "Guangzhou Supplier B",
    "Agência Criativa",
    "Comex Despachos",
  ])
    expect(names).not.toContain(other);

  // Busca.
  await page.goto("/app/customers?q=loja");
  expect(await customerNames(page)).toEqual(["Loja do João Ltda"]);

  // Ações: novo cliente, ficha, editar o cadastro e o login de acesso.
  await expect(page.locator("[data-customers-new]")).toHaveAttribute(
    "href",
    "/app/parties/new?type=customer",
  );
  await expect(page.locator("[data-customers-import]")).toBeVisible();
  const joao = page.locator('[data-customer-row="cliente-joao"]');
  await expect(joao.locator("[data-party-logins]")).toHaveText("1 login(s)");
  await joao.locator("[data-party-logins]").click();
  await page.waitForURL(/\/app\/parties\/cliente-joao#access$/);
  await expect(page.locator("[data-party-access]")).toBeVisible();
  await expect(page.locator("[data-party-access]")).toContainText(
    "joao@lojista.com",
  );
  await page.goto("/app/customers?q=loja");
  await joao.locator('a[href="/app/customers/cliente-joao"]').first().click();
  await page.waitForURL(/\/app\/customers\/cliente-joao$/);
  await expect(customersLink(page)).toHaveAttribute("aria-current", "page");
  await page.goto("/app/customers?q=loja");
  await expect(
    joao.locator('a[href="/app/parties/cliente-joao"]'),
  ).toBeVisible();
});

test("Parceiros sem clientes, também em Todos os tipos; o endereço antigo leva a Clientes", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");

  // Todos os tipos: fornecedores e demais parceiros, nenhum cliente.
  await page.goto("/app/parties");
  const main = page.locator("main");
  await expect(main).toContainText("Shenzhen Supplier A");
  await expect(main).toContainText("Agência Criativa");
  for (const customer of ["Loja do João Ltda", "Wellmix SC"])
    await expect(main).not.toContainText(customer);
  // Sem a opção Clientes no filtro nem o link para a lista de clientes.
  await page.locator("[data-party-type-filter-input]").click();
  await expect(
    page.locator('[data-party-type-filter-option="supplier"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-party-type-filter-option="customer"]'),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    page.locator('[data-parties-all] a[href="/app/customers"]'),
  ).toHaveCount(0);
  // Cadastros e Tipos e acessos (as antigas Tipos de parceiro e Acessos
  // externos, juntas desde 17/11/2026).
  await expect(
    page.locator("[data-parties-tabs] [data-parties-tab]"),
  ).toHaveCount(2);

  // Endereço antigo: Clientes, com a busca e a ordem que valem lá.
  await page.goto("/app/parties?type=customer&q=loja&sort=-name&page=2");
  await page.waitForURL(/\/app\/customers\?/);
  const url = new URL(page.url());
  expect(url.pathname).toBe("/app/customers");
  expect(url.searchParams.get("q")).toBe("loja");
  expect(url.searchParams.get("sort")).toBe("-name");
  expect(url.searchParams.get("type")).toBeNull();
  expect(url.searchParams.get("page")).toBeNull();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Clientes");
  expect(await customerNames(page)).toEqual(["Loja do João Ltda"]);
  // Sem parâmetros: a lista inteira de Clientes.
  await page.goto("/app/parties?type=customer");
  await page.waitForURL(/\/app\/customers$/);
});

test("Nova solicitação: o seletor de cliente e o RCA vinculado seguem funcionando", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/requests/new");
  const picker = page.locator(
    '[data-request-customer] [data-party-picker="customer"]',
  );
  await picker.locator("[data-party-picker-input]").fill("loja");
  await picker.locator('[data-party-picker-option="cliente-joao"]').click();
  await expect(page.locator('input[name="customerId"]')).toHaveValue(
    "cliente-joao",
  );
  const rca = page.locator("[data-request-rca]");
  await expect(rca).toHaveAttribute("data-request-rca-state", "ready");
  await expect(rca).toHaveValue("5101 - Ana Representações");
});

test("permissões: comprador abre Clientes; Vendas não vê nem abre", async ({
  page,
}) => {
  await login(page, "operador@wellmix.com");
  await page.goto("/app");
  await sidebar(page)
    .locator('[data-nav-group="Cadastros"] button')
    .first()
    .click();
  await expect(customersLink(page)).toHaveCount(1);
  await customersLink(page).click();
  await page.waitForURL(/\/app\/customers$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Clientes");
  expect(await customerNames(page)).toContain("Loja do João Ltda");

  await login(page, "vendas@wellmix.com");
  await page.goto("/app");
  await expect(customersLink(page)).toHaveCount(0);
  await page.goto("/app/customers");
  await page.waitForURL(/\/app\?denied=parties/);
});
