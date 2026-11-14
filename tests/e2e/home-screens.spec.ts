import { expect, test, type Page } from "@playwright/test";
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
  const form = page.locator("[data-fn-new]");
  await form.locator('input[name="name"]').fill(name);
  await form.getByRole("button").click();
  await page.waitForURL(/saved=created/);
  return new URL(page.url()).searchParams.get("fn")!;
}

async function saveScreens(
  page: Page,
  key: string,
  marks: Record<string, boolean>,
) {
  await page.goto(`/app/team?tab=functions&fn=${key}&view=screens`);
  const form = page.locator(`[data-fn-screens="${key}"]`);
  for (const [screen, on] of Object.entries(marks)) {
    const box = form.locator(`input[name="screens"][value="${screen}"]`);
    await expect(box).toBeEnabled();
    await box.setChecked(on);
  }
  await form.locator("[data-fn-save-screens]").click();
  await page.waitForURL(/saved=screens/);
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
  const saved = page.locator(`[data-fn-screens="${alfa}"]`);
  await expect(saved.locator('input[value="sla"]')).not.toBeChecked();
  await expect(saved.locator('input[value="home"]')).not.toBeChecked();
  await expect(saved.locator('input[value="tasks"]')).toBeChecked();
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
