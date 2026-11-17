import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, login } from "./helpers";

/*
 * Equipe Externa (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md): uma linha por
 * parceiro nas colunas Nome | Tipo | Situação | Login de Acesso | País |
 * E-mail, com filtro em cada coluna, a busca em toda a tabela (os logins só
 * para o administrador), "Limpar filtros" e o painel dos logins de cada
 * parceiro. Gerar login é só do administrador (R5).
 */

const ADMIN = "admin@wellmix.com";
const BUYER = "operador@wellmix.com";

/** Cadastra um transportador sem e-mail e os logins dados; devolve o id. */
async function partnerWithLogins(page: Page, name: string, logins: string[]) {
  await page.goto("/app/parties/new?type=carrier");
  await page.fill('input[name="name"]', name);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?#]+(#access)?$/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  for (const email of logins) {
    const access = page.locator("[data-party-access]");
    await access.locator('input[name="name"]').fill(`Pessoa ${email}`);
    await access.locator('input[name="login"]').fill(email);
    await access.locator('input[name="password"]').fill(PASSWORD);
    await access.locator("[data-party-access-create]").click();
    await page.waitForURL(/saved=user/);
  }
  return id;
}

const rows = (page: Page) => page.locator("[data-party-row]");

/** Filtro de tipo (seletor com busca no cabeçalho): digita e escolhe. */
async function chooseType(page: Page, text: string, value: string) {
  const input = page.locator("[data-party-type-filter-input]");
  await expect(input).toHaveAttribute("data-party-type-filter-ready", "1");
  await input.click();
  await input.fill(text);
  await page.locator(`[data-party-type-filter-option="${value}"]`).click();
  await page.waitForURL(new RegExp(`type=${encodeURIComponent(value)}`));
}

test.describe("Equipe Externa", () => {
  const tag = `ext${Date.now().toString(36)}`;
  let many = "";
  let one = "";
  let none = "";

  test("colunas na ordem, filtro em cada coluna, filtros combinados e Limpar filtros", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await login(page, ADMIN);
    many = await partnerWithLogins(page, `Externa ${tag} Muitos`, [
      `m1-${tag}@login.com`,
      `m2-${tag}@login.com`,
    ]);
    one = await partnerWithLogins(page, `Externa ${tag} Um`, [
      `u1-${tag}@login.com`,
    ]);
    none = await partnerWithLogins(page, `Externa ${tag} Zero`, []);

    await page.goto("/app/parties");
    // A seção com o nome novo e as colunas na ordem pedida.
    await expect(
      page.locator('[data-team-area-nav] [aria-current="page"]'),
    ).toHaveText("Equipe Externa");
    const heads = page.locator("thead tr").first().locator("th");
    const expected = [
      "Nome",
      "Tipo",
      "Situação",
      "Login de Acesso",
      "País",
      "E-mail",
    ];
    await expect(heads).toHaveCount(expected.length);
    for (const [i, label] of expected.entries())
      await expect(heads.nth(i)).toContainText(label);
    await expect(page.locator("[data-parties-filters] th")).toHaveCount(6);
    await expect(page.locator("[data-parties-clear]")).toHaveCount(0);

    // Nome (texto).
    const form = page.locator("[data-parties-filter]");
    await expect(form).toHaveAttribute("data-auto-apply-ready", "");
    await page.locator("[data-parties-filter-name]").fill(tag);
    await page.waitForURL(new RegExp(`name=${tag}`));
    await expect(rows(page)).toHaveCount(3);

    // Login de Acesso: as opções vêm dos dados (0, 1, 2…).
    const logins = page.locator("[data-parties-filter-logins]");
    await logins.selectOption("2");
    await page.waitForURL(/logins=2/);
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator(`[data-party-row="${many}"]`)).toBeVisible();
    await expect(
      page.locator(`[data-party-row="${many}"] [data-party-logins]`),
    ).toHaveText("2 login(s)");
    await logins.selectOption("0");
    await page.waitForURL(/logins=0/);
    await expect(rows(page)).toHaveCount(1);
    await expect(
      page.locator(`[data-party-row="${none}"] [data-party-logins]`),
    ).toHaveText("Sem login");

    // Limpar filtros volta à lista inteira.
    await page.locator("[data-parties-clear]").click();
    await page.waitForURL(/\/app\/parties$/);
    expect(await rows(page).count()).toBeGreaterThan(3);

    // Tipo + Situação + País, juntos: só fornecedores ativos da China.
    await chooseType(page, "Fornec", "supplier");
    await page.locator("[data-parties-filter-status]").selectOption("active");
    await page.waitForURL(/status=active/);
    await page.locator("[data-parties-filter-country]").selectOption("CN");
    await page.waitForURL(/country=CN/);
    const shown = await rows(page).count();
    expect(shown).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < shown; i++) {
      const cells = rows(page).nth(i).locator("td");
      await expect(cells.nth(1)).toHaveText("Fornecedor");
      await expect(cells.nth(2)).toHaveText("Ativo");
      await expect(cells.nth(4)).toHaveText("CN");
    }
    await expect(page.locator("main")).toContainText("Ningbo Supplier C");
    await expect(page.locator("main")).not.toContainText(`Externa ${tag}`);

    // E-mail (texto).
    await page.goto("/app/parties?email=rodo");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Trans Rodo");
  });

  test("buscar em toda a tabela: as seis colunas e, para o administrador, o login", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto("/app/parties");
    const search = page.locator("[data-parties-search]");
    await expect(search).toHaveAttribute("placeholder", /login \(e-mail/);
    // Nome.
    await search.fill("Ningbo");
    await page.waitForURL(/q=Ningbo/);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Ningbo Supplier C");
    // Login (e-mail ou usuário): só o login liga o parceiro à busca.
    await search.fill(`u1-${tag}`);
    await page.waitForURL(new RegExp(`q=u1-${tag}`));
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator(`[data-party-row="${one}"]`)).toBeVisible();
    // Busca junto com um filtro de coluna.
    await page.goto(`/app/parties?q=${tag}&logins=1`);
    await expect(rows(page)).toHaveCount(1);
    await page.goto(`/app/parties?q=nada-assim-${tag}`);
    await expect(page.locator("[data-parties-empty]")).toBeVisible();
  });

  test("Login de Acesso: o painel com zero, um e vários logins, e a lista como estava ao fechar", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto(`/app/parties?name=${tag}`);
    // Vários logins: cada um com o estado.
    await page
      .locator(`[data-party-row="${many}"] [data-party-logins]`)
      .click();
    await page.waitForURL(new RegExp(`panel=logins&party=${many}`));
    let panel = page.locator(`[data-party-logins-panel="${many}"]`);
    await expect(panel).toBeVisible();
    await expect(panel.locator("[data-party-login]")).toHaveCount(2);
    await expect(
      panel.locator('[data-party-login-state="active"]'),
    ).toHaveCount(2);
    await expect(panel).toContainText(`m1-${tag}@login.com`);
    await expect(panel.locator("[data-party-logins-create]")).toBeVisible();
    await panel.locator("[data-side-panel-close]").click();
    await page.waitForURL(new RegExp(`/app/parties\\?name=${tag}$`));
    await expect(page.locator("[data-party-logins-panel]")).toHaveCount(0);

    // Um login.
    await page.locator(`[data-party-row="${one}"] [data-party-logins]`).click();
    panel = page.locator(`[data-party-logins-panel="${one}"]`);
    await expect(panel.locator("[data-party-login]")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await page.waitForURL(new RegExp(`/app/parties\\?name=${tag}$`));

    // Zero logins.
    await page
      .locator(`[data-party-row="${none}"] [data-party-logins]`)
      .click();
    panel = page.locator(`[data-party-logins-panel="${none}"]`);
    await expect(panel.locator("[data-party-logins-empty]")).toBeVisible();
    await expect(panel.locator("[data-party-login]")).toHaveCount(0);

    // Rolagem: abrir e fechar o painel não leva a lista para o topo.
    await page.setViewportSize({ width: 1280, height: 520 });
    await page.goto("/app/parties");
    const last = rows(page).last();
    await last.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(50);
    await last.locator("[data-party-logins]").click();
    await page.waitForURL(/panel=logins/);
    await page
      .locator("[data-party-logins-panel] [data-side-panel-close]")
      .click();
    await page.waitForURL(/\/app\/parties$/);
    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(40);
  });

  test("Comprador: vê a lista, não acha pelo login e não gera login", async ({
    page,
  }) => {
    await login(page, BUYER);
    await page.goto("/app/parties");
    const search = page.locator("[data-parties-search]");
    await expect(search).toHaveAttribute(
      "placeholder",
      "Nome, tipo, situação, login, país ou e-mail",
    );
    // O login não entra na busca de quem não é administrador.
    await page.goto(`/app/parties?q=u1-${tag}`);
    await expect(page.locator("[data-parties-empty]")).toBeVisible();
    // Pelo nome, acha.
    await page.goto(`/app/parties?q=Externa ${tag} Um`);
    await expect(rows(page)).toHaveCount(1);
    // O painel mostra os logins, sem gerar nem alterar.
    await page.locator(`[data-party-row="${one}"] [data-party-logins]`).click();
    const panel = page.locator(`[data-party-logins-panel="${one}"]`);
    await expect(panel.locator("[data-party-login]")).toHaveCount(1);
    await expect(panel.locator("[data-party-logins-admin-only]")).toBeVisible();
    await expect(panel.locator("[data-party-logins-create]")).toHaveCount(0);
    // No cadastro: o aviso no lugar do formulário.
    await page.goto(`/app/parties/${none}`);
    await expect(page.locator("[data-party-access-admin-only]")).toBeVisible();
    await expect(page.locator("[data-party-access-create]")).toHaveCount(0);
    await expect(page.locator("[data-party-no-access]")).toContainText(
      "Só o administrador cria o login.",
    );
  });
});
