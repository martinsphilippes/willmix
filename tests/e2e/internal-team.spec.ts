import { expect, test, type Page } from "@playwright/test";
import { createTeamLogin, grantTeamScreen, login } from "./helpers";

/*
 * Equipe Interna (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md, etapa 5): a
 * lista Nome | Cargo | Área | Função | Responde a | Telas, o atalho de cada
 * informação num painel aberto pelo endereço (fechar volta à lista como
 * estava), a Gestão de telas nos dois modos (por usuário, cargo, área ou
 * função e por tela), várias funções, ajuste individual, campos vazios ("—"),
 * o administrador ("Todas") e os endereços antigos com "#".
 */

const panel = (page: Page, kind: string) =>
  page.locator(`[data-team-panel="${kind}"]`);

async function closePanel(page: Page, back: RegExp) {
  await page.keyboard.press("Escape");
  await page.waitForURL(back);
}

test("Equipe Interna: colunas, atalhos de cada informação e a Gestão de telas", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const tag = Date.now().toString(36).toUpperCase();
  const named = (name: string) => `${name} ${tag}`;
  await login(page, "admin@wellmix.com");

  // Os dados do teste: uma área, um cargo nela, um gestor e uma pessoa com
  // duas funções que responde a ele (nível maior que o do gestor).
  await page.goto("/app/team?tab=areas");
  await page
    .locator('[data-area-new] input[name="name"]')
    .fill(named("Compras"));
  await page
    .locator("[data-area-new]")
    .getByRole("button", { name: "Criar área" })
    .click();
  await page.waitForURL(/saved=area_created/);
  await page.goto("/app/team?tab=positions");
  const newPosition = page.locator("[data-position-new]");
  await newPosition.locator('input[name="name"]').fill(named("Analista"));
  await newPosition
    .locator('select[name="areaId"]')
    .selectOption({ label: named("Compras") });
  await newPosition.locator('button[type="submit"]').click();
  await page.waitForURL(/saved=position_created/);
  const chefeId = await createTeamLogin(
    page,
    named("Chefe"),
    `chefe-${tag.toLowerCase()}@wellmix.com`,
    ["planner"],
  );
  const duoId = await createTeamLogin(
    page,
    named("Duo"),
    `duo-${tag.toLowerCase()}@wellmix.com`,
    ["buyer", "designer"],
  );
  await page.goto(`/app/team/${chefeId}`);
  await page.locator("[data-team-level]").selectOption("analyst");
  await page.locator("[data-team-save]").click();
  await expect(page.locator("[data-team-saved]")).toBeVisible();
  await page.goto(`/app/team/${duoId}`);
  await page
    .locator("[data-team-position]")
    .selectOption({ label: named("Analista") });
  await page.locator("[data-team-level]").selectOption("coordinator");
  await page
    .locator("[data-team-manager]")
    .selectOption({ label: named("Chefe") });
  await page.locator("[data-team-save]").click();
  await expect(page.locator("[data-team-saved]")).toBeVisible();

  // A lista, na ordem pedida, buscando pelo teste.
  const list = `/app/team?q=${tag}`;
  await page.goto(list);
  expect(
    (await page.locator("thead tr").first().locator("th").allInnerTexts()).map(
      (s) => s.trim().toUpperCase(),
    ),
  ).toEqual(["NOME", "CARGO", "ÁREA", "FUNÇÃO", "RESPONDE A", "TELAS"]);
  await expect(page.locator("[data-team-count]")).toHaveAttribute(
    "data-team-count",
    "2",
  );
  const duo = page.locator(`tr[data-team-member="${duoId}"]`);
  const chefe = page.locator(`tr[data-team-member="${chefeId}"]`);
  await expect(
    duo.locator(`[data-team-member-position="${duoId}"]`),
  ).toHaveText(named("Analista"));
  await expect(duo.locator(`[data-team-member-area="${duoId}"]`)).toHaveText(
    named("Compras"),
  );
  // Várias funções: um link para cada.
  await expect(duo.locator("[data-team-function-link]")).toHaveCount(2);
  await expect(duo.locator(`[data-team-member-manager="${duoId}"]`)).toHaveText(
    named("Chefe"),
  );
  await expect(duo.locator(`[data-team-screens="${duoId}"]`)).toHaveText(
    /^\d+ telas$/,
  );
  // Campos vazios: "—".
  await expect(
    chefe.locator(`[data-team-member-position="${chefeId}"]`),
  ).toHaveText("—");
  await expect(
    chefe.locator(`[data-team-member-area="${chefeId}"]`),
  ).toHaveText("—");
  await expect(
    chefe.locator(`[data-team-member-manager="${chefeId}"]`),
  ).toHaveText("—");

  // Cargo: o detalhe com as pessoas; fechar volta à lista com a busca.
  await duo.locator("[data-team-position-link]").click();
  await page.waitForURL(/panel=position/);
  await expect(panel(page, "position")).toContainText(named("Compras"));
  await expect(
    panel(page, "position").locator(`[data-team-panel-person="${duoId}"]`),
  ).toBeVisible();
  await closePanel(page, new RegExp(`/app/team\\?q=${tag}$`));
  await expect(duo).toBeVisible();

  // Área: os cargos da área e as pessoas.
  await duo.locator("[data-team-area-link]").click();
  await expect(panel(page, "area")).toContainText(named("Analista"));
  await expect(
    panel(page, "area").locator(`[data-team-panel-person="${duoId}"]`),
  ).toBeVisible();
  await closePanel(page, new RegExp(`/app/team\\?q=${tag}$`));

  // Função: o detalhe, as telas, as ações e as pessoas.
  await duo.locator('[data-team-function-link="designer"]').click();
  await expect(panel(page, "function")).toHaveAttribute(
    "data-team-panel-id",
    "designer",
  );
  await expect(
    panel(page, "function").locator(`[data-team-panel-person="${duoId}"]`),
  ).toBeVisible();
  await closePanel(page, new RegExp(`/app/team\\?q=${tag}$`));

  // Responde a: o gestor, a cadeia, os subordinados e o aviso de nível.
  await duo.locator("[data-team-manager-link]").click();
  await expect(panel(page, "manager")).toHaveAttribute(
    "data-team-panel-id",
    chefeId,
  );
  await expect(
    panel(page, "manager").locator(`[data-team-report="${duoId}"]`),
  ).toBeVisible();
  await expect(
    panel(page, "manager").locator(`[data-team-level-warning="${duoId}"]`),
  ).toBeVisible();
  await closePanel(page, new RegExp(`/app/team\\?q=${tag}$`));

  // Telas: o painel já na pessoa da linha, com a origem e os atalhos.
  await duo.locator(`[data-team-screens="${duoId}"]`).click();
  const screens = panel(page, "screens");
  await expect(
    screens.locator(`[data-team-screens-user="${duoId}"]`),
  ).toBeVisible();
  const orders = screens.locator('[data-team-screen-row="orders"]');
  await expect(orders).toHaveAttribute("data-team-screen-opens", "1");
  await expect(orders.locator("[data-team-screen-origin]")).toContainText(
    "Função:",
  );
  // "No menu" da equipe interna acompanha "Abre" (só consulta).
  await expect(orders.locator("[data-team-screen-menu]")).toHaveText("Sim");
  await expect(
    screens.locator('[data-team-screen-row="finance"]'),
  ).toHaveAttribute("data-team-screen-opens", "0");
  await expect(screens.locator("[data-team-screens-links]")).toContainText(
    named("Analista"),
  );
  await closePanel(page, new RegExp(`/app/team\\?q=${tag}$`));

  // Gestão de telas pelo botão: por função e por tela.
  await page.locator("[data-team-screens-open]").click();
  await expect(screens.locator("[data-team-screens-empty]")).toBeVisible();
  await screens.locator('[data-team-screens-option="scope-function"]').click();
  await page.waitForURL(/scope=function/);
  await expect(
    screens.locator("[data-team-screens-record-form][data-auto-apply-ready]"),
  ).toBeAttached();
  await screens.locator("[data-team-screens-record]").selectOption("designer");
  await expect(
    screens.locator('[data-team-screens-function="designer"]'),
  ).toBeVisible();
  await screens.locator('[data-team-screens-option="screen"]').click();
  await page.waitForURL(/mode=screen/);
  await expect(
    screens.locator("[data-team-screens-screen-form][data-auto-apply-ready]"),
  ).toBeAttached();
  await screens
    .locator("[data-team-screens-screen-select]")
    .selectOption("finance");
  await expect(
    screens.locator('[data-team-screens-screen="finance"]'),
  ).toBeVisible();
  await expect(
    screens.locator(`[data-team-screen-person="${duoId}"]`),
  ).toHaveAttribute("data-team-screen-opens", "0");

  // Ajuste individual: Financeiro marcado à mão aparece com a origem e como
  // tela protegida.
  await grantTeamScreen(page, duoId, named("Duo"), "finance");
  await page.goto(
    `/app/team?q=${tag}&panel=screens&mode=scope&scope=user&id=${duoId}`,
  );
  const finance = screens.locator('[data-team-screen-row="finance"]');
  await expect(finance).toHaveAttribute("data-team-screen-opens", "1");
  await expect(finance.locator("[data-team-screen-origin]")).toHaveText(
    "Ajuste individual (marcada)",
  );
  await expect(finance).toContainText("Protegida");
  await expect(page.locator(`[data-team-screens="${duoId}"]`)).toContainText(
    "Personalizado",
  );

  // Filtro por função e Limpar filtros.
  await page.goto(`/app/team?q=${tag}&function=designer`);
  await expect(page.locator("[data-team-count]")).toHaveAttribute(
    "data-team-count",
    "1",
  );
  await page.locator("[data-team-clear]").click();
  await page.waitForURL(/\/app\/team$/);

  // Administrador: todas as telas.
  const admin = page.locator(
    'tr[data-team-member]:has-text("admin@wellmix.com")',
  );
  await expect(admin.locator("[data-team-screens]")).toHaveText("Todas");
});

test("Equipe Interna: endereços antigos com # e o painel da pessoa pelo endereço", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/team");
  const id = (await page
    .locator('tr[data-team-member]:has-text("operador@wellmix.com")')
    .first()
    .getAttribute("data-team-member"))!;

  // #u-<id> (a linha da pessoa) abre o painel dela.
  await page.goto(`/app/team#u-${id}`);
  await page.waitForURL(new RegExp(`panel=person&id=${id}`));
  const drawer = page.locator(`[data-team-drawer-panel="${id}"]`);
  await expect(drawer).toBeVisible();
  // Fechar tira o painel do endereço; a lista fica.
  await drawer.locator("[data-team-drawer-close]").click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/\/app\/team$/);

  // O endereço do painel abre direto.
  await page.goto(`/app/team?panel=person&id=${id}`);
  await expect(drawer).toBeVisible();
  // O Voltar do navegador fecha o painel aberto pela lista.
  await drawer.locator("[data-team-drawer-close]").click();
  await page.locator(`[data-team-edit="${id}"]`).click();
  await expect(drawer).toBeVisible();
  await page.goBack();
  await expect(drawer).toHaveCount(0);

  // #distribute: Linhas e divisões, na distribuição.
  await page.goto("/app/team#distribute");
  await page.waitForURL(/\/app\/team\?tab=lines#distribute$/);
  await expect(page.locator("[data-team-distribute]")).toBeVisible();
});
