import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Equipe Acessos e Parceiros (dono, 15/11/2026; docs/FLOW_MENU.md): a área
 * de Parceiros (antes Cadastros → Parceiros) entrou na área de Equipe, que
 * passou a se chamar "Equipe Acessos e Parceiros" no menu e no título. As
 * seções: Equipe, Funções e acessos, Linha de produto e divisão e Parceiros;
 * dentro de Parceiros, as três abas de sempre. Os endereços não mudaram (os
 * links antigos abrem a mesma tela, com os filtros) e cada login vê só o que
 * já abria: o administrador tudo; o comprador só Parceiros (sem Acessos
 * externos); Vendas, nenhuma das duas.
 */

const AREA = "Equipe Acessos e Parceiros";

const sidebar = (page: Page) =>
  page.locator("[data-sidebar]").filter({ visible: true }).first();
const footerItem = (page: Page) =>
  sidebar(page).locator("[data-sidebar-footer] [data-nav-link]", {
    hasText: AREA,
  });
const sections = (page: Page) =>
  page.locator("[data-team-area-nav] [data-team-tab]");
const partiesTabs = (page: Page) =>
  page.locator("[data-parties-tabs] [data-parties-tab]");

async function texts(locator: ReturnType<Page["locator"]>) {
  return (await locator.allInnerTexts()).map((t) => t.trim());
}

/** A área aberta: o título e a seção ativa; o item do menu aceso. */
async function expectArea(page: Page, section: string) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(AREA);
  await expect(
    page.locator('[data-team-area-nav] [aria-current="page"]'),
  ).toHaveText(section);
  await expect(footerItem(page)).toHaveAttribute("aria-current", "page");
}

test("administrador: Parceiros dentro de Equipe Acessos e Parceiros, as três abas pelo novo menu", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app");

  // Menu: Parceiros saiu de Cadastros; o item do rodapé tem o nome novo.
  await expect(
    sidebar(page).locator('[data-nav-link="/app/parties"]'),
  ).toHaveCount(0);
  await expect(footerItem(page)).toHaveAttribute("data-nav-link", "/app/team");
  await expect(sidebar(page)).not.toContainText("Equipe e acessos");

  // Pelo menu: a área com as quatro seções, na ordem.
  await footerItem(page).click();
  await page.waitForURL(/\/app\/team$/);
  await expectArea(page, "Equipe");
  expect(await texts(sections(page))).toEqual([
    "Equipe",
    "Funções e acessos",
    "Linha de produto e divisão",
    "Parceiros",
  ]);

  // Seção Parceiros → aba Cadastros (a lista de sempre, com filtro e ações).
  await sections(page).filter({ hasText: "Parceiros" }).click();
  await page.waitForURL(/\/app\/parties$/);
  await expectArea(page, "Parceiros");
  expect(await texts(partiesTabs(page))).toEqual([
    "Cadastros",
    "Tipos de parceiro",
    "Acessos externos",
  ]);
  await expect(
    page.locator('[data-parties-tab="registry"][aria-current="page"]'),
  ).toBeVisible();
  await expect(page.locator("[data-party-new]")).toBeVisible();
  await expect(page.locator("[data-parties-filter]")).toBeVisible();
  await expect(page.locator("main")).toContainText("Loja do João Ltda");

  // Aba Tipos de parceiro: o catálogo, com o menu ⋯ do administrador.
  await page.locator('[data-parties-tab="types"]').click();
  await page.waitForURL(/\/app\/parties\/types$/);
  await expectArea(page, "Parceiros");
  await expect(
    page.locator('[data-parties-tab="types"][aria-current="page"]'),
  ).toBeVisible();
  await expect(page.locator("[data-partner-type-menu]").first()).toBeVisible();

  // Aba Acessos externos: o perfil e os painéis de sempre.
  await page.locator('[data-parties-tab="access"]').click();
  await page.waitForURL(/\/app\/parties\/access$/);
  await expectArea(page, "Parceiros");
  await expect(page.locator("[data-access-profile-select]")).toBeVisible();

  // Volta para a Equipe pela seção.
  await sections(page).filter({ hasText: "Funções e acessos" }).click();
  await page.waitForURL(/\/app\/team\?tab=functions$/);
  await expectArea(page, "Funções e acessos");
});

test("links antigos de Parceiros abrem a mesma tela, com os filtros e os parâmetros", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");

  // Cadastros com o tipo e a busca no endereço: nada redireciona.
  await page.goto("/app/parties?type=customer&q=loja");
  expect(new URL(page.url()).pathname).toBe("/app/parties");
  expect(new URL(page.url()).searchParams.get("type")).toBe("customer");
  expect(new URL(page.url()).searchParams.get("q")).toBe("loja");
  await expectArea(page, "Parceiros");
  await expect(page.locator("main")).toContainText("Loja do João Ltda");
  await expect(page.locator("main")).not.toContainText("Shenzhen Supplier A");

  // Acessos externos com o perfil no endereço.
  await page.goto("/app/parties/access?profile=type:trading");
  await expect(page.locator("[data-access-profile-select]")).toHaveValue(
    "type:trading",
  );
  await expectArea(page, "Parceiros");

  // Tipos, cadastro novo, ficha do parceiro e as listas antigas.
  for (const path of [
    "/app/parties/types",
    "/app/parties/new?type=customer",
    "/app/parties/cliente-joao",
    "/app/customers",
    "/app/suppliers",
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    expect(page.url(), path).toContain(path.split("?")[0]);
    await expect(footerItem(page), path).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
  await expect(page.locator("main")).toContainText("Shenzhen Supplier A");
});

test("comprador: entra em Parceiros pelo novo item, só com as seções que já abria", async ({
  page,
}) => {
  await login(page, "operador@wellmix.com");
  await page.goto("/app");

  // O item leva direto a Parceiros (não abre a Equipe).
  await expect(footerItem(page)).toHaveAttribute(
    "data-nav-link",
    "/app/parties",
  );
  await expect(
    sidebar(page).locator('[data-nav-link="/app/team"]'),
  ).toHaveCount(0);
  await footerItem(page).click();
  await page.waitForURL(/\/app\/parties$/);
  await expectArea(page, "Parceiros");
  // Só a seção Parceiros; sem Acessos externos.
  expect(await texts(sections(page))).toEqual(["Parceiros"]);
  expect(await texts(partiesTabs(page))).toEqual([
    "Cadastros",
    "Tipos de parceiro",
  ]);
  await page.locator('[data-parties-tab="types"]').click();
  await page.waitForURL(/\/app\/parties\/types$/);
  await expect(page.locator("[data-partner-type-menu]")).toHaveCount(0);

  // Pela URL: a Equipe continua só do administrador; Acessos externos
  // continua mostrando o aviso de antes.
  await page.goto("/app/team");
  await page.waitForURL(/\/app\?denied=team/);
  await page.goto("/app/parties/access");
  await expect(page.locator("main")).toContainText(
    "Só o administrador abre a Gestão de telas.",
  );
  await expect(page.locator("[data-access-profile-select]")).toHaveCount(0);
});

test("sem Parceiros nem Equipe (Vendas): nenhum item da área e nenhuma das telas", async ({
  page,
}) => {
  await login(page, "vendas@wellmix.com");
  await page.goto("/app");
  await expect(
    sidebar(page).locator("[data-sidebar-footer]", { hasText: AREA }),
  ).toHaveCount(0);
  await page.goto("/app/parties");
  await page.waitForURL(/\/app\?denied=parties/);
  await page.goto("/app/team");
  await page.waitForURL(/\/app\?denied=team/);
});
