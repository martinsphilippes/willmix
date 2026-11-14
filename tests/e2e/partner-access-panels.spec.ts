import { expect, test, type Browser, type Page } from "@playwright/test";
import { PASSWORD, bookingSheet, importAndClose, login } from "./helpers";

/*
 * Cadastros → Parceiros em três abas (dono, 14/11/2026; docs/PARTNER_ACCESS.md
 * e docs/PARTNER_TYPES.md). Com um login Trading e outro Factory:
 * - gravar o acesso da Trading e ler de novo depois de recarregar;
 * - ocultar do menu (abre pelo endereço) é diferente de bloquear (recusa);
 * - revogar vale para a sessão que já está aberta, sem novo login;
 * - comparar (Abre e No menu separados) e copiar com prévia tela a tela;
 * - mexer na Trading não muda a Factory;
 * - um parceiro não abre registro de outra empresa;
 * - tipos de parceiro: novo, renomear sem perder tradução nem descrição,
 *   inativar e reativar pelo menu ⋯, "Configurar telas" no perfil certo.
 */

const tag = Date.now().toString(36);
const TRADING = `Trading Painel ${tag}`;
const FACTORY = `Factory Painel ${tag}`;
const TRADING_LOGIN = `tp-${tag}@trading.com`;
const FACTORY_LOGIN = `fp-${tag}@factory.com`;

/** Cadastra o parceiro do tipo e o login dele (papel do Fornecedor). */
async function partnerWithLogin(
  page: Page,
  type: string,
  name: string,
  email: string,
) {
  await page.goto(`/app/parties/new?type=${type}`);
  await expect(page.locator("[data-party-type]")).toHaveValue(type);
  await page.fill('input[name="name"]', name);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?]+$/);
  const access = page.locator("[data-party-access]");
  await access.locator('input[name="name"]').fill(`${name} usuário`);
  await access.locator('input[name="login"]').fill(email);
  await access.locator('input[name="password"]').fill(PASSWORD);
  await access.locator("[data-party-access-create]").click();
  await page.waitForURL(/saved=user/);
}

/** Abre a aba Acessos externos e espera as caixas responderem. */
async function openAccess(page: Page, url: string) {
  await page.goto(url);
  await expect(
    page.locator("[data-access-form][data-access-ready]"),
  ).toHaveCount(1);
}

async function openModule(page: Page, key: string) {
  const toggle = page.locator(`[data-access-module-toggle="${key}"]`);
  if (!(await toggle.isChecked()))
    await page.locator(`[data-access-module="${key}"] label`).first().click();
  await expect(toggle).toBeChecked();
}

/** Uma sessão à parte (outro navegador), que fica aberta durante o teste. */
async function session(browser: Browser, email: string) {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  const page = await context.newPage();
  await login(page, email);
  return { context, page };
}

test.describe.configure({ mode: "serial" });

test("Trading e Factory: gravar, recarregar, ocultar × bloquear, revogar com a sessão aberta, comparar e copiar", async ({
  page,
  browser,
}) => {
  await login(page, "admin@wellmix.com");
  await partnerWithLogin(page, "trading", TRADING, TRADING_LOGIN);
  await partnerWithLogin(page, "factory", FACTORY, FACTORY_LOGIN);
  // Começa do padrão (uma rodada anterior pode ter deixado a Trading mexida).
  await openAccess(page, "/app/parties/access?profile=type:trading");
  if (await page.locator("[data-access-reset]").count()) {
    page.once("dialog", (dialog) => void dialog.accept());
    await page.locator("[data-access-reset]").click();
    await page.waitForURL(/saved=reset/);
  }

  // A Trading entra (sessão que fica aberta) com as telas do Fornecedor.
  const trading = await session(browser, TRADING_LOGIN);
  const t = trading.page;
  await t.goto("/app/supplier-requests");
  await expect(t).toHaveURL(/\/app\/supplier-requests/);
  await t.goto("/app/orders");
  await expect(t).toHaveURL(/\/app\/orders$/);
  // No menu: o grupo da tela aberta vem aberto, com o atalho de Pedidos.
  await expect(
    t.locator('[data-nav-link="/app/orders"]').first(),
  ).toBeVisible();

  // Administrador: Pedidos fora do menu (continua abrindo) e Solicitações ao
  // fornecedor bloqueada, só na Trading.
  await openAccess(page, "/app/parties/access?profile=type:trading");
  await expect(page.locator("[data-access-profile]")).toHaveAttribute(
    "data-access-profile",
    "type:trading",
  );
  await openModule(page, "nav.group.orders");
  await page.locator('[data-access-menu="orders"]').uncheck();
  await page.locator('[data-access-open="quotes"]').uncheck();
  // "No menu" só existe com a tela aberta: bloquear trava e desmarca.
  await expect(page.locator('[data-access-menu="quotes"]')).toBeDisabled();
  await expect(page.locator('[data-access-menu="quotes"]')).not.toBeChecked();
  await expect(page.locator("[data-access-unsaved]")).toHaveAttribute(
    "data-access-unsaved",
    "1",
  );
  // Antes de salvar, o perfil afetado está à vista.
  await expect(page.locator("[data-access-target]")).toContainText("Trading");
  let confirmText = "";
  page.once("dialog", (dialog) => {
    confirmText = dialog.message();
    void dialog.accept();
  });
  await page.locator("[data-access-save]").click();
  await page.waitForURL(/saved=2/);
  expect(confirmText).toContain("Trading");
  // Sucesso depois da gravação no servidor, com o perfil.
  await expect(page.locator("[data-access-saved]")).toContainText(
    "Acessos de Trading salvos no servidor: 2",
  );

  // Recarregar: o servidor devolve o que foi gravado.
  await page.reload();
  await expect(page.locator('[data-access-screen="orders"]')).toHaveAttribute(
    "data-access-situation",
    "hidden",
  );
  await expect(page.locator('[data-access-screen="quotes"]')).toHaveAttribute(
    "data-access-situation",
    "blocked",
  );
  await openModule(page, "nav.group.orders");
  await expect(page.locator('[data-access-open="orders"]')).toBeChecked();
  await expect(page.locator('[data-access-menu="orders"]')).not.toBeChecked();
  await expect(page.locator('[data-access-source="orders"]')).toHaveText(
    "Tirada do menu à mão",
  );

  // A Factory não mudou.
  await openAccess(page, "/app/parties/access?profile=type:factory");
  await expect(page.locator('[data-access-screen="orders"]')).toHaveAttribute(
    "data-access-situation",
    "open",
  );
  await expect(page.locator('[data-access-screen="quotes"]')).toHaveAttribute(
    "data-access-situation",
    "open",
  );

  // Sessão da Trading, sem entrar de novo: Pedidos saiu do menu mas abre pelo
  // endereço; Solicitações ao fornecedor (que abria) agora recusa.
  await t.goto("/app/orders");
  await expect(t).toHaveURL(/\/app\/orders$/);
  await expect(t.locator('[data-nav-link="/app/orders"]')).toHaveCount(0);
  await t.goto("/app/supplier-requests");
  await expect(t).toHaveURL(/denied=quotes/);

  // Comparar (painel lateral): Trading × Factory, "Abre" e "No menu" separados.
  await page.goto("/app/parties/access?profile=type:trading&state=hidden");
  await page.locator("[data-access-open-compare]").click();
  await page.waitForURL(/panel=compare/);
  const compare = page.locator('[data-access-panel="compare"]');
  await expect(compare).toBeVisible();
  const compareForm = compare.locator("form");
  await expect(compareForm).toHaveAttribute("data-auto-apply-ready", "");
  await page.selectOption("[data-access-compare-b]", "type:factory");
  await page.waitForURL(/b=type%3Afactory/);
  await expect(page.locator('[data-access-compare="quotes"]')).toHaveAttribute(
    "data-open-differs",
    "1",
  );
  await expect(page.locator('[data-access-compare="orders"]')).toHaveAttribute(
    "data-menu-differs",
    "1",
  );
  await expect(
    page.locator('[data-access-compare="orders"]'),
  ).not.toHaveAttribute("data-open-differs", "1");
  await expect(page.locator("[data-access-compare-diff]")).toHaveAttribute(
    "data-access-compare-diff",
    "2",
  );
  // Só as diferenças: Mensagens (igual nos dois) não aparece.
  await expect(page.locator('[data-access-compare="messages"]')).toHaveCount(0);
  // Fechar devolve a visão e o filtro de antes.
  await page.locator("[data-side-panel-close]").click();
  await page.waitForURL((u) => !u.search.includes("panel="));
  expect(page.url()).toContain("state=hidden");
  expect(page.url()).toContain("profile=type%3Atrading");
  await expect(page.locator('[data-access-panel="compare"]')).toHaveCount(0);

  // Copiar (painel lateral): Solicitações ao fornecedor e Pedidos da Factory
  // para a Trading, substituindo; prévia tela a tela antes de aplicar.
  await page.locator("[data-access-open-copy]").click();
  await page.waitForURL(/panel=copy/);
  const copyForm = page.locator("[data-access-copy-form]");
  await expect(copyForm).toHaveAttribute("data-auto-apply-ready", "");
  await page.selectOption("[data-access-copy-from]", "type:factory");
  await page.waitForURL(/from=type%3Afactory/);
  await expect(page.locator("[data-access-copy-to]")).toHaveValue(
    "type:trading",
  );
  await page.selectOption("[data-access-copy-mode]", "replace");
  await page.waitForURL(/mode=replace/);
  // Sem telas marcadas: nada para aplicar.
  await expect(page.locator("[data-access-copy-apply]")).toBeDisabled();
  await page.locator('[data-access-copy-screen="quotes"]').check();
  await expect(page.locator('[data-access-copy-row="quotes"]')).toHaveAttribute(
    "data-changed",
    "1",
  );
  await page.locator('[data-access-copy-screen="orders"]').check();
  const ordersRow = page.locator('[data-access-copy-row="orders"]');
  await expect(ordersRow).toHaveAttribute("data-changed", "1");
  // Pedidos: abre continua "Sim"; o menu passa de "Não" para "Sim".
  await expect(ordersRow).toContainText("Sim");
  await expect(ordersRow).toContainText("Não");
  await expect(page.locator("[data-access-copy-count]")).toHaveAttribute(
    "data-access-copy-count",
    "2",
  );
  await expect(page.locator("[data-access-copy-apply]")).toBeEnabled();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.locator("[data-access-copy-apply]").click();
  await page.waitForURL(/copied=type%3Atrading/);
  await expect(page.locator("[data-access-saved]")).toContainText(
    "Cópia aplicada em Trading",
  );
  // A página voltou como estava (filtro "fora do menu" ainda aplicado).
  expect(page.url()).toContain("state=hidden");
  await expect(page.locator('[data-access-screen="orders"]')).toHaveCount(0);
  await openAccess(page, "/app/parties/access?profile=type:trading");
  await expect(page.locator('[data-access-screen="quotes"]')).toHaveAttribute(
    "data-access-situation",
    "open",
  );
  await expect(page.locator('[data-access-screen="orders"]')).toHaveAttribute(
    "data-access-situation",
    "open",
  );

  // A mesma cópia de novo: nada muda e "Aplicar cópia" fica desligado.
  await page.goto(
    "/app/parties/access?profile=type:trading&panel=copy&from=type:factory&to=type:trading&screens=quotes&screens=orders&mode=replace",
  );
  await expect(page.locator("[data-access-copy-none]")).toBeVisible();
  await expect(page.locator("[data-access-copy-apply]")).toBeDisabled();

  // A Factory continua no padrão (a cópia só mexeu no destino).
  await openAccess(page, "/app/parties/access?profile=type:factory");
  await expect(page.locator("[data-access-profile]")).not.toContainText(
    "Personalizado",
  );

  // Por tela: quem abre Pedidos; "Editar" leva ao perfil já na tela.
  await page.goto("/app/parties/access?view=screen&screen=orders");
  const holder = page.locator('[data-access-holder="type:trading"]');
  await expect(holder).toHaveAttribute("data-access-open", "1");
  await holder.locator("[data-access-edit]").click();
  await page.waitForURL(/focus=orders/);
  await expect(page.locator('[data-access-screen="orders"]')).toHaveAttribute(
    "data-access-focus",
    "1",
  );
  await expect(page.locator('[data-access-screen="orders"]')).toBeVisible();

  // Sessão da Trading de novo aberta: o acesso devolvido já vale.
  await t.goto("/app/supplier-requests");
  await expect(t).toHaveURL(/\/app\/supplier-requests$/);
  await t.goto("/app/orders");
  await expect(
    t.locator('[data-nav-link="/app/orders"]').first(),
  ).toBeVisible();

  // Celular: o painel ocupa a largura inteira.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "/app/parties/access?profile=type:trading&panel=copy&to=type:trading",
  );
  const box = await page.locator('[data-access-panel="copy"]').boundingBox();
  expect(Math.round(box?.width ?? 0)).toBe(390);
  await page.setViewportSize({ width: 1280, height: 900 });

  // Deixa a Trading como estava.
  await openAccess(page, "/app/parties/access?profile=type:trading");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.locator("[data-access-reset]").click();
  await page.waitForURL(/saved=reset/);
  await trading.context.close();
});

test("um parceiro não abre o registro de outra empresa", async ({ page }) => {
  await login(page, "admin@wellmix.com");
  // Booking com a Trading de responsável.
  const code = `ISO${tag.toUpperCase()}`;
  await importAndClose(
    page,
    bookingSheet("Shenzhen Supplier A", `${code}-T`, `Glass jar ${code}`),
    "Shenzhen Supplier A",
  );
  const lotUrl = new URL(page.url()).pathname;
  const partner = page.locator(
    "[data-booking-lot-partner] input[role=combobox]",
  );
  await partner.click();
  await partner.fill(TRADING);
  await page
    .locator("[data-booking-lot-partner] [role=option]")
    .filter({ hasText: TRADING })
    .first()
    .click();
  await expect(
    page.locator('[data-booking-lot-partner] [data-booking-row-note="saved"]'),
  ).toBeVisible();

  // A Trading vê o booking dela.
  await login(page, TRADING_LOGIN);
  await page.goto("/app/booking");
  await expect(
    page.locator("[data-partner-booking]", { hasText: `booking-${code}-T` }),
  ).toHaveCount(1);
  const own = await page.goto(lotUrl);
  expect(own?.status()).toBe(200);

  // A Factory (outra empresa, mesma tela Booking) não vê nem abre.
  await login(page, FACTORY_LOGIN);
  await page.goto("/app/booking");
  await expect(
    page.locator("[data-partner-booking]", { hasText: `booking-${code}-T` }),
  ).toHaveCount(0);
  const foreign = await page.goto(lotUrl);
  expect(foreign?.status()).toBe(404);
  // E não abre a área de Parceiros (só a Wellmix).
  await page.goto("/app/parties/access");
  await expect(page).toHaveURL(/denied=parties/);
});

test("tipos de parceiro: novo, renomear sem perder tradução, inativar e reativar pelo menu ⋯", async ({
  page,
}) => {
  const name = `Inspeção ${tag}`;
  const english = `Inspection ${tag}`;
  await login(page, "admin@wellmix.com");
  await page.goto("/app/parties/types");
  await page.locator("[data-partner-type-new-open]").click();
  await page.waitForURL(/panel=new/);
  const panel = page.locator('[data-partner-type-panel="new"]');
  await panel.locator('input[name="name"]').fill(name);
  await panel.locator('input[name="nameEn"]').fill(english);
  await panel.locator('textarea[name="description"]').fill("Faz inspeção.");
  await page.locator("[data-partner-type-create]").click();
  await page.waitForURL(/saved=new/);
  const row = page.locator("[data-partner-type-list] tr", { hasText: name });
  await expect(row).toBeVisible();
  const key = await row.getAttribute("data-partner-type");

  // Renomear (menu ⋯): só os nomes mudam; descrição e inglês ficam.
  const menu = page.locator(`[data-partner-type-menu="${key}"]`);
  await expect(menu).toHaveAttribute("data-ready", "1");
  await menu.click();
  await page.locator(`[data-partner-type-rename="${key}"]`).click();
  await page.waitForURL(/panel=rename/);
  const rename = page.locator('[data-partner-type-panel="rename"]');
  await expect(rename.locator('input[name="nameEn"]')).toHaveValue(english);
  await rename.locator('input[name="name"]').fill(`${name} nova`);
  await page.locator("[data-partner-type-panel-save]").click();
  await page.waitForURL(/saved=renamed/);
  const renamed = page.locator(`[data-partner-type="${key}"]`);
  await expect(renamed).toContainText(`${name} nova`);
  await expect(renamed).toContainText("Faz inspeção.");
  await menu.click();
  await page.locator(`[data-partner-type-edit="${key}"]`).click();
  await page.waitForURL(/panel=edit/);
  const edit = page.locator('[data-partner-type-panel="edit"]');
  await expect(edit.locator('input[name="nameEn"]')).toHaveValue(english);
  await expect(edit.locator('textarea[name="description"]')).toHaveValue(
    "Faz inspeção.",
  );
  await page.locator("[data-side-panel-close]").click();
  await page.waitForURL((u) => !u.search.includes("panel="));

  // Inativar e reativar (com confirmação), sem mudar o nome.
  await menu.click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.locator(`[data-partner-type-toggle="${key}"]`).click();
  await page.waitForURL(/saved=deactivated/);
  await expect(renamed).toHaveAttribute("data-partner-type-active", "0");
  await expect(renamed).toContainText(`${name} nova`);
  await menu.click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.locator(`[data-partner-type-toggle="${key}"]`).click();
  await page.waitForURL(/saved=activated/);
  await expect(renamed).toHaveAttribute("data-partner-type-active", "1");

  // "Configurar telas" da Trading: Acessos externos já no perfil dela.
  await page.locator('[data-partner-type-access="trading"]').first().click();
  await page.waitForURL(/profile=type%3Atrading|profile=type:trading/);
  await expect(page.locator("[data-access-profile-select]")).toHaveValue(
    "type:trading",
  );
  await expect(page.locator('[data-parties-tab="access"]')).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Quem não é administrador lê os tipos, sem o menu ⋯ e sem Acessos externos.
  await login(page, "operador@wellmix.com");
  const res = await page.goto("/app/parties/types");
  if (res?.url().includes("denied=")) return; // operador sem Cadastros
  await expect(page.locator("[data-partner-type-menu]")).toHaveCount(0);
  await expect(page.locator('[data-parties-tab="access"]')).toHaveCount(0);
});
