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
// As duas telas da área (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md, etapa
// 5): Equipe Interna e Equipe Externa.
const sections = (page: Page) =>
  page.locator("[data-team-area-nav] [data-team-area]");
// As seções da Equipe Interna (Equipe; Cargos, áreas e funções; Linhas e
// divisões) e, dentro da segunda, Cargos, Áreas e Funções e acessos.
const teamSections = (page: Page) =>
  page.locator("[data-team-tabs] [data-team-section]");
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

  // Pelo menu: a área com as seções, na ordem (Áreas e Cargos entraram em
  // 16/11/2026).
  await footerItem(page).click();
  await page.waitForURL(/\/app\/team$/);
  await expectArea(page, "Equipe Interna");
  // Duas telas (dono, 17/11/2026): a seção Parceiros virou Equipe Externa, e
  // as seções da equipe ficaram dentro da Equipe Interna.
  expect(await texts(sections(page))).toEqual([
    "Equipe Interna",
    "Equipe Externa",
  ]);
  expect(await texts(teamSections(page))).toEqual([
    "Equipe",
    "Cargos, áreas e funções",
    "Linhas e divisões",
  ]);
  await teamSections(page)
    .filter({ hasText: "Cargos, áreas e funções" })
    .click();
  await page.waitForURL(/\/app\/team\?tab=positions$/);
  await expectArea(page, "Equipe Interna");
  expect(
    await texts(page.locator("[data-team-subtabs] [data-team-tab]")),
  ).toEqual(["Cargos", "Áreas", "Funções e acessos"]);

  // Seção Parceiros → aba Cadastros (a lista de sempre, com filtro e ações).
  await sections(page).filter({ hasText: "Equipe Externa" }).click();
  await page.waitForURL(/\/app\/parties$/);
  await expectArea(page, "Equipe Externa");
  // Tipos de parceiro e Acessos externos viraram "Tipos e acessos" (dono,
  // 17/11/2026), com as duas partes dentro.
  expect(await texts(partiesTabs(page))).toEqual([
    "Cadastros",
    "Tipos e acessos",
  ]);
  await expect(
    page.locator('[data-parties-tab="registry"][aria-current="page"]'),
  ).toBeVisible();
  await expect(page.locator("[data-party-new]")).toBeVisible();
  await expect(page.locator("[data-parties-filter]")).toBeVisible();
  // Os clientes têm a página própria (Cadastros → Clientes, 15/11/2026).
  await expect(page.locator("main")).toContainText("Shenzhen Supplier A");
  await expect(page.locator("main")).not.toContainText("Loja do João Ltda");

  // Tipos e acessos → Tipos de parceiro: o catálogo, com o menu ⋯ do
  // administrador.
  await page.locator('[data-parties-tab="types-access"]').click();
  await page.waitForURL(/\/app\/parties\/types$/);
  await expectArea(page, "Equipe Externa");
  await expect(
    page.locator('[data-parties-subtab="types"][aria-current="page"]'),
  ).toBeVisible();
  await expect(page.locator("[data-partner-type-menu]").first()).toBeVisible();

  // Perfis de login e telas: o perfil e os painéis de sempre.
  await page.locator('[data-parties-subtab="access"]').click();
  await page.waitForURL(/\/app\/parties\/access$/);
  await expectArea(page, "Equipe Externa");
  await expect(page.locator("[data-access-profile-select]")).toBeVisible();

  // Volta para a Equipe Interna pela área, e Funções e acessos dentro de
  // Cargos, áreas e funções.
  await sections(page).filter({ hasText: "Equipe Interna" }).click();
  await page.waitForURL(/\/app\/team$/);
  await teamSections(page)
    .filter({ hasText: "Cargos, áreas e funções" })
    .click();
  await page.locator('[data-team-subtabs] [data-team-tab="functions"]').click();
  await page.waitForURL(/\/app\/team\?tab=functions$/);
  await expectArea(page, "Equipe Interna");
});

test("links antigos de Parceiros abrem a mesma tela, com os filtros e os parâmetros", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");

  // Cadastros com o tipo e a busca no endereço: nada redireciona.
  await page.goto("/app/parties?type=supplier&q=shenzhen");
  expect(new URL(page.url()).pathname).toBe("/app/parties");
  expect(new URL(page.url()).searchParams.get("type")).toBe("supplier");
  expect(new URL(page.url()).searchParams.get("q")).toBe("shenzhen");
  await expectArea(page, "Equipe Externa");
  await expect(page.locator("main")).toContainText("Shenzhen Supplier A");
  // O filtro de tipo vale (a busca curta fica na tabela, no navegador).
  await expect(page.locator("main")).not.toContainText("Agência Criativa");

  // Acessos externos com o perfil no endereço.
  await page.goto("/app/parties/access?profile=type:trading");
  await expect(page.locator("[data-access-profile-select]")).toHaveValue(
    "type:trading",
  );
  await expectArea(page, "Equipe Externa");
  // A tela de entrada (/app) no perfil externo (dono, 15/11/2026): o nome diz
  // o que o login vê ali (as Pendências dele, se o perfil abre Pendências),
  // nunca "Control Tower", que é só da equipe Wellmix.
  const homeName = page.locator('[data-access-screen-name="home"]');
  const tasksBlocked =
    (await page
      .locator('[data-access-screen="tasks"]')
      .getAttribute("data-access-situation")) === "blocked";
  await expect(homeName).toHaveText(
    tasksBlocked ? "Início" : "Início (Pendências do login)",
  );
  await expect(page.locator("[data-access-home-hint]")).toContainText(
    "Na equipe Wellmix esta tela é o Control Tower",
  );
  await page.goto("/app/parties/access?profile=role:customer");
  await expect(homeName).toHaveText("Início (vitrine ou solicitações)");

  // Tipos, cadastro novo, ficha do parceiro e a lista de Fornecedores
  // (Clientes é de Cadastros: tests/e2e/customers-registry.spec.ts).
  // O cadastro de cliente e o novo cliente passaram para Cadastros →
  // Clientes (etapa 4; os endereços de antes levam para lá: ver
  // tests/e2e/customers-registry.spec.ts).
  for (const path of ["/app/parties/types", "/app/suppliers"]) {
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
  await expectArea(page, "Equipe Externa");
  // Só a seção Parceiros; sem Acessos externos.
  expect(await texts(sections(page))).toEqual(["Equipe Externa"]);
  expect(await texts(partiesTabs(page))).toEqual([
    "Cadastros",
    "Tipos e acessos",
  ]);
  await page.locator('[data-parties-tab="types-access"]').click();
  await page.waitForURL(/\/app\/parties\/types$/);
  // Só os tipos: os perfis de login e telas são do administrador.
  await expect(page.locator("[data-parties-subtab]")).toHaveCount(1);
  await expect(page.locator('[data-parties-subtab="access"]')).toHaveCount(0);
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

test("Vitrine pelas caixas de acesso: Cliente com Explorar no menu; equipe e parceiros pela caixa", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  // Acessos externos, perfil Cliente: a vitrine aberta e no menu (padrão).
  await page.goto("/app/parties/access?profile=role:customer&q=explore");
  await expect(page.locator('[data-access-screen="explore"]')).toHaveAttribute(
    "data-access-situation",
    "open",
  );
  // Equipe: o administrador vê a vitrine do cliente em Cadastros.
  await page.goto("/app/products");
  await expect(
    sidebar(page).locator('[data-nav-link="/app/explore"]'),
  ).toHaveText(/Vitrine do cliente/);

  // O cliente entra na vitrine e a tem no menu (Explorar).
  await login(page, "joao@lojista.com");
  await page.goto("/app");
  await page.waitForURL(/\/app\/explore/);
  const explore = sidebar(page).locator('[data-nav-link="/app/explore"]');
  await expect(explore).toHaveText(/Explorar/);
  await expect(explore).toHaveAttribute("aria-current", "page");
});
