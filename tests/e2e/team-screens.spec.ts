import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, login } from "./helpers";

/*
 * Editar acessos (dono, 14/11/2026; docs/ACCESS.md): o card "Telas que o
 * login abre" reage na hora ao cargo e às funções, sem salvar. No
 * Personalizado, o que o administrador marca ou desmarca à mão continua
 * quando as funções mudam, e as caixas do Início ficam livres. O que foi
 * salvo vale no menu, nos ícones do cabeçalho e no endereço direto do login
 * editado. Login novo, para não mexer nas contas que os outros testes usam.
 */

async function createLogin(page: Page, name: string, email: string) {
  await page.goto("/app/team?tab=team&new=1");
  const form = page.locator("[data-team-new-login]");
  await form.locator('input[name="name"]').fill(name);
  await form.locator('input[name="login"]').fill(email);
  await form.locator('input[name="password"]').fill(PASSWORD);
  await form.locator('input[name="functions"][value="designer"]').check();
  await form.locator('input[name="mustChange"]').uncheck();
  await form.getByRole("button", { name: "Criar login" }).click();
  await page.waitForURL(/\/app\/team\/[^/?]+\?created=/);
  return new URL(page.url()).pathname;
}

/** Cada caixa de tela e se está marcada, para comparar antes e depois. */
const boxes = (page: Page) =>
  page
    .locator("[data-team-screen]")
    .evaluateAll((els) =>
      els.map(
        (el) =>
          `${el.getAttribute("data-team-screen")}:${(el as HTMLInputElement).checked}`,
      ),
    );

test("Editar acessos: as telas reagem às funções e o Início personalizado vale no login", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  const email = `telas-${tag}@wellmix.com`;
  await login(page, "admin@wellmix.com");
  const memberPath = await createLogin(page, `Telas ${tag}`, email);

  const card = page.locator("[data-team-screens-card]");
  const screen = (key: string) => page.locator(`[data-team-screen="${key}"]`);
  const fn = (key: string) => page.locator(`[data-team-function="${key}"]`);

  // Padrão das funções: o resultado do designer, só leitura; o Início sem
  // o rótulo "(sempre)".
  await expect(card).toHaveAttribute("data-team-screens-card", "default");
  await expect(screen("marketing")).toBeChecked();
  await expect(screen("booking")).not.toBeChecked();
  await expect(screen("tasks")).toBeChecked();
  await expect(screen("tasks")).toBeDisabled();
  await expect(card).not.toContainText("sempre");

  // 1. Cargo: nenhum cargo libera telas; trocar o cargo deixa as caixas
  // exatamente como estavam.
  const before = await boxes(page);
  await page.locator('select[name="jobLevel"]').selectOption("manager");
  await expect(page.locator('select[name="jobLevel"]')).toHaveValue("manager");
  expect(await boxes(page)).toEqual(before);

  // 2. Função: marcar o planner traz as telas dele na hora; desmarcar tira.
  await fn("planner").check();
  await expect(screen("booking")).toBeChecked();
  await expect(screen("dashboards")).toBeChecked();
  await expect(page.locator("[data-team-screens-summary]")).toContainText(
    "Painéis por área",
  );
  await fn("planner").uncheck();
  await expect(screen("booking")).not.toBeChecked();
  await expect(screen("dashboards")).not.toBeChecked();
  expect(await boxes(page)).toEqual(before);

  // 3. Personalizado: as caixas ficam livres, inclusive as do Início; o que
  // foi marcado ou desmarcado à mão continua quando as funções mudam.
  await page.locator('[data-team-screens-mode="custom"]').check();
  await expect(card).toHaveAttribute("data-team-screens-card", "custom");
  await expect(screen("tasks")).toBeEnabled();
  await screen("products").uncheck();
  await screen("finance").check();
  await fn("buyer").check();
  await expect(screen("booking")).toBeChecked();
  await expect(screen("products")).not.toBeChecked();
  await expect(screen("finance")).toBeChecked();
  await fn("buyer").uncheck();
  await expect(screen("booking")).not.toBeChecked();
  await expect(screen("products")).not.toBeChecked();
  await expect(screen("finance")).toBeChecked();

  // 4. Início: desmarca Mensagens, salva e reabre o cadastro.
  await screen("messages").uncheck();
  await page.locator("[data-team-save]").click();
  await page.waitForURL(/\/app\/team\?saved=member/);
  await page.goto(memberPath);
  await expect(card).toHaveAttribute("data-team-screens-card", "custom");
  await expect(screen("messages")).not.toBeChecked();
  await expect(screen("notifications")).toBeChecked();
  await expect(screen("tasks")).toBeChecked();
  await expect(screen("finance")).toBeChecked();
  await expect(screen("products")).not.toBeChecked();
  await expect(screen("marketing")).toBeChecked();
  await expect(page.locator('select[name="jobLevel"]')).toHaveValue("manager");

  // Vale no login editado: sem o ícone de mensagens no cabeçalho e sem abrir
  // Mensagens pelo endereço; o sino e o Financeiro (posto à mão) continuam.
  await login(page, email);
  await page.goto("/app/tasks");
  await expect(page.locator("[data-notifications-bell]")).toBeVisible();
  await expect(page.locator("[data-messages-link]")).toHaveCount(0);
  await page.goto("/app/messages");
  await expect(page).not.toHaveURL(/\/app\/messages/);
  await expect(page).toHaveURL(/denied=messages/);
  await page.goto("/app/finance");
  await expect(page).toHaveURL(/\/app\/finance$/);
});

test("Editar acessos de um administrador: abre tudo e não há telas a marcar", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/team");
  // A lista pode estar paginada: o id sai da linha, mesmo fora da página.
  const id = await page
    .locator('tr[data-team-member]:has-text("admin@wellmix.com")')
    .first()
    .getAttribute("data-team-member");
  await page.goto(`/app/team/${id}`);
  await expect(page.locator("[data-team-screen]")).toHaveCount(0);
  await expect(
    page.getByText("Administrador: abre todas as telas"),
  ).toBeVisible();
});
