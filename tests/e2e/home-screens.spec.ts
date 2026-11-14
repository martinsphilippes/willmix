import { expect, test, type Locator, type Page } from "@playwright/test";
import { PASSWORD, login } from "./helpers";

/*
 * Telas do Início por função (Equipe e acessos → Funções → Telas e links,
 * card "Início"). O administrador cria duas funções, desmarca o Control Tower
 * e o Painel de SLA só numa delas e salva. Quem tem essa função não vê as
 * duas no menu, não abre o SLA pelo endereço e cai na primeira tela que abre;
 * quem tem a outra função continua com tudo. Funções novas, para não mexer
 * nas de fábrica que os outros testes usam.
 */

async function createFunction(page: Page, name: string): Promise<string> {
  await page.goto("/app/team?tab=functions");
  // "+ Nova função" abre o campo do nome (dono, 14/11/2026). No iPad e no
  // celular a lista vira um seletor; o botão fica no pé da coluna.
  await page.locator("[data-fn-new-open]").click();
  const form = page.locator("[data-fn-new]");
  await form.locator('input[name="name"]').fill(name);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL(/saved=created/);
  return new URL(page.url()).searchParams.get("fn")!;
}

/** Abre todas as seções recolhidas de um painel de permissões. */
async function expandAll(panel: Locator) {
  const closed = panel.locator('[data-perm-section][aria-expanded="false"]');
  while ((await closed.count()) > 0) await closed.first().click();
}

/** Marca as telas na aba "Telas e links" e salva ("Salvar permissões"). */
async function saveScreens(
  page: Page,
  key: string,
  marks: Record<string, boolean>,
) {
  await page.goto(`/app/team?tab=functions&fn=${key}&view=screens`);
  const editor = page.locator(`[data-fn-detail="${key}"]`);
  const panel = editor.locator(`[data-fn-screens="${key}"]`);
  await expandAll(panel);
  for (const [screen, on] of Object.entries(marks)) {
    const box = panel.locator(`[data-fn-screen="${screen}"]`);
    await expect(box).toBeEnabled();
    await box.setChecked(on);
  }
  await editor.locator("[data-fn-save]").click();
  await expect(editor.locator("[data-fn-saved]")).toBeVisible();
}

async function createLogin(
  page: Page,
  name: string,
  email: string,
  fn: string,
) {
  await page.goto("/app/team?tab=team&new=1");
  const form = page.locator("[data-team-new-login]");
  await form.locator('input[name="name"]').fill(name);
  await form.locator('input[name="login"]').fill(email);
  await form.locator('input[name="password"]').fill(PASSWORD);
  await form.locator(`input[name="functions"][value="${fn}"]`).check();
  await form.locator('input[name="mustChange"]').uncheck();
  await form.getByRole("button", { name: "Criar login" }).click();
  await page.waitForURL(/\/app\/team\/[^/?]+\?created=/);
}

test("Início por função: menu e endereço seguem o que foi salvo", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  await login(page, "admin@wellmix.com");
  const alfa = await createFunction(page, `Alfa ${tag}`);
  const beta = await createFunction(page, `Beta ${tag}`);

  // Telas do Início vêm marcadas e editáveis; Alfa perde Control Tower e SLA.
  await saveScreens(page, alfa, { orders: true, home: false, sla: false });
  await saveScreens(page, beta, { orders: true });
  await page.goto(`/app/team?tab=functions&fn=${alfa}&view=screens`);
  const saved = page.locator(`[data-fn-detail="${alfa}"]`);
  await expandAll(saved.locator(`[data-fn-screens="${alfa}"]`));
  await expect(saved.locator('[data-fn-screen="sla"]')).not.toBeChecked();
  await expect(saved.locator('[data-fn-screen="home"]')).not.toBeChecked();
  await expect(saved.locator('[data-fn-screen="tasks"]')).toBeChecked();
  await expect(saved).toContainText("configuráveis por função");

  const emailA = `alfa-${tag}@wellmix.com`;
  const emailB = `beta-${tag}@wellmix.com`;
  await createLogin(page, `Alfa ${tag}`, emailA, alfa);
  await createLogin(page, `Beta ${tag}`, emailB, beta);

  // Alfa: sem Control Tower, o início vai às Pendências; SLA fora do menu e
  // recusado pelo endereço.
  await login(page, emailA);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/tasks/);
  await expect(page.locator('[data-nav-link="/app/sla"]')).toHaveCount(0);
  await expect(page.locator('[data-nav-link="/app"]')).toHaveCount(0);
  await expect(
    page.locator('[data-nav-link="/app/tasks"]').first(),
  ).toBeVisible();
  await page.goto("/app/sla");
  await expect(page).not.toHaveURL(/\/app\/sla/);
  await expect(page).toHaveURL(/\/app\/tasks\?denied=sla/);

  // Beta: tudo como antes.
  await login(page, emailB);
  await page.goto("/app/sla");
  await expect(page).toHaveURL(/\/app\/sla$/);
  // O SLA fica num grupo do menu (pode estar recolhido): basta estar lá.
  await expect(page.locator('[data-nav-link="/app/sla"]')).not.toHaveCount(0);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app$/);
});

/*
 * Mensagens e Notificações só no cabeçalho (dono, 14/11/2026): a barra
 * lateral e o menu do celular não mostram as duas linhas; os ícones do alto,
 * à direita, continuam lá e levam às mesmas telas.
 */
test("Mensagens e Notificações ficam só nos ícones do cabeçalho", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/tasks");
  await expect(
    page.locator('[data-sidebar-nav] [data-nav-link="/app/tasks"]:visible'),
  ).toHaveCount(1);
  await expect(page.locator('[data-nav-link="/app/messages"]')).toHaveCount(0);
  await expect(
    page.locator('[data-nav-link="/app/notifications"]'),
  ).toHaveCount(0);
  await page.locator("[data-messages-link]").click();
  await expect(page).toHaveURL(/\/app\/messages/);
  await page.locator("[data-notifications-bell]").click();
  await expect(page).toHaveURL(/\/app\/notifications/);

  // No celular: os ícones seguem no alto e o menu aberto também não tem as duas.
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "supplier.a@china.com");
  await page.goto("/app");
  await expect(page.locator("[data-messages-link]")).toBeVisible();
  await expect(page.locator("[data-notifications-bell]")).toBeVisible();
  await page.locator("[data-mobile-menu]").click();
  await expect(page.locator('[data-nav-link="/app"]:visible')).toHaveCount(1);
  await expect(page.locator('[data-nav-link="/app/messages"]')).toHaveCount(0);
  await expect(
    page.locator('[data-nav-link="/app/notifications"]'),
  ).toHaveCount(0);
});
