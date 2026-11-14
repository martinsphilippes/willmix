import { expect, test, type Locator, type Page } from "@playwright/test";
import { PASSWORD, login } from "./helpers";

/*
 * Equipe e acessos (dono, 14/11/2026; docs/ACCESS.md):
 *
 * - Funções e acessos: renomear e restaurar o nome pelo menu ⋯; Telas e
 *   links e Ações no mesmo painel, com um "Salvar permissões" só; o que foi
 *   marcado fica ao trocar de aba e depois de recarregar.
 * - Editar acessos em painel lateral na lista: prévia de "Acessos efetivos"
 *   recalculada na hora (cargo e funções), com a origem de cada permissão.
 * - Aplicação: menu, cabeçalho, endereço direto e servidor seguem o que foi
 *   salvo, inclusive numa sessão aberta; duas funções, Personalizado e
 *   administrador.
 * - Desktop, iPad e celular.
 *
 * Logins novos e, no fim, a função Designer de volta ao padrão, para não
 * mexer no que os outros testes usam.
 */

async function createLogin(
  page: Page,
  name: string,
  email: string,
  functions: string[],
): Promise<string> {
  await page.goto("/app/team?tab=team&new=1");
  const form = page.locator("[data-team-new-login]");
  await form.locator('input[name="name"]').fill(name);
  await form.locator('input[name="login"]').fill(email);
  await form.locator('input[name="password"]').fill(PASSWORD);
  for (const fn of functions)
    await form.locator(`input[name="functions"][value="${fn}"]`).check();
  await form.locator('input[name="mustChange"]').uncheck();
  await form.getByRole("button", { name: "Criar login" }).click();
  await page.waitForURL(/\/app\/team\/[^/?]+\?created=/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** Abre todas as seções recolhidas de um painel de permissões. */
async function expandAll(panel: Locator) {
  const closed = panel.locator('[data-perm-section][aria-expanded="false"]');
  while ((await closed.count()) > 0) await closed.first().click();
}

/** Abre "Editar acessos" da pessoa no painel lateral da lista. */
async function openDrawer(page: Page, id: string, name: string) {
  if (!/\/app\/team(\?tab=team)?$/.test(page.url()))
    await page.goto("/app/team");
  // Com a busca da tabela à vista (lista longa), filtra pela pessoa.
  const search = page.locator("[data-table-search]").first();
  if (await search.count()) await search.fill(name);
  await page.locator(`[data-team-edit="${id}"]`).click();
  const drawer = page.locator(`[data-team-drawer-panel="${id}"]`);
  await expect(drawer).toBeVisible();
  return drawer;
}

/** Cada caixa da prévia e se está marcada (telas e ações). */
const previewMarks = (drawer: Locator) =>
  drawer
    .locator("[data-team-screen], [data-team-action]")
    .evaluateAll((els) =>
      els.map(
        (el) =>
          `${el.getAttribute("data-team-screen") ?? el.getAttribute("data-team-action")}:${(el as HTMLInputElement).checked}`,
      ),
    );

test("Designer: tela do Início e ação salvas valem no painel, no login e com a sessão aberta", async ({
  page,
  browser,
}) => {
  const tag = Date.now().toString(36);
  const email = `desi-${tag}@wellmix.com`;
  await login(page, "admin@wellmix.com");
  const desiId = await createLogin(page, `Desi ${tag}`, email, ["designer"]);

  // 1. Menu ⋯: o campo de nome só aparece ao escolher "Renomear função".
  await page.goto("/app/team?tab=functions&fn=designer");
  let fn = page.locator('[data-fn-detail="designer"]');
  await expect(fn.locator("[data-fn-rename]")).toHaveCount(0);
  await fn.locator("[data-fn-menu]").click();
  await fn.locator("[data-fn-menu-rename]").click();
  await fn.locator('[data-fn-rename] input[name="name"]').fill(`Arte ${tag}`);
  await fn.locator("[data-fn-rename-save]").click();
  await page.waitForURL(/saved=renamed/);
  fn = page.locator('[data-fn-detail="designer"]');
  await expect(fn.locator("[data-fn-name]")).toHaveText(`Arte ${tag}`);
  await fn.locator("[data-fn-menu]").click();
  await fn.locator("[data-fn-menu-restore-name]").click();
  await page.waitForURL(/saved=renamed/);
  await expect(
    page.locator('[data-fn-detail="designer"] [data-fn-name]'),
  ).toHaveText("Designer");

  // 2. Uma tela do Início (Painel de SLA) e uma ação (Ver valores e margem),
  // nas duas abas, com um "Salvar permissões" só.
  fn = page.locator('[data-fn-detail="designer"]');
  await fn.locator('[data-fn-screen="sla"]').uncheck();
  await fn.locator('[data-fn-view="actions"]').click();
  await fn.locator("[data-fn-search]").fill("valores");
  await fn.locator('[data-fn-action="values.view"]').check();
  await fn.locator('[data-fn-view="screens"]').click();
  await fn.locator("[data-fn-search]").fill("");
  // Trocar de aba não perde o que foi marcado.
  await expect(fn.locator('[data-fn-screen="sla"]')).not.toBeChecked();
  await expect(fn.locator("[data-fn-status]")).toHaveAttribute(
    "data-fn-status",
    "dirty",
  );
  await fn.locator("[data-fn-save]").click();
  await expect(fn.locator("[data-fn-saved]")).toBeVisible();
  // Recarregada a tela, as duas mudanças continuam gravadas.
  await page.reload();
  fn = page.locator('[data-fn-detail="designer"]');
  await expect(fn.locator('[data-fn-screen="sla"]')).not.toBeChecked();
  await expect(fn.locator('[data-fn-screen="tasks"]')).toBeChecked();
  await fn.locator('[data-fn-view="actions"]').click();
  await fn.locator("[data-fn-search]").fill("valores");
  await expect(fn.locator('[data-fn-action="values.view"]')).toBeChecked();

  // 3. Editar acessos no painel lateral: a lista fica por baixo.
  await page.goto("/app/team");
  const drawer = await openDrawer(page, desiId, `Desi ${tag}`);
  await expect(page).toHaveURL(/\/app\/team$/);
  await expect(drawer.locator('[data-team-screen="sla"]')).not.toBeChecked();
  await expect(drawer.locator('[data-perm-row="tasks"]')).toContainText(
    "Herdado de Designer",
  );
  await drawer.locator('[data-team-view="actions"]').click();
  await expandAll(drawer.locator("[data-team-actions-panel]"));
  await expect(
    drawer.locator('[data-team-action="values.view"]'),
  ).toBeChecked();
  await expect(drawer.locator('[data-perm-row="values.view"]')).toContainText(
    "Herdado de Designer",
  );
  await drawer.locator('[data-team-view="screens"]').click();
  await expandAll(drawer.locator("[data-team-screens-panel]"));

  // 4. Cargo: a prévia é recalculada e fica igual (o cargo não libera nada).
  const before = await previewMarks(drawer);
  await drawer.locator("[data-team-level]").selectOption("manager");
  expect(await previewMarks(drawer)).toEqual(before);

  // 5. Função: o Planner traz o SLA e o Book na hora, com a origem; tirar
  // volta como estava.
  await drawer.locator("[data-team-function-add]").selectOption("planner");
  await expect(drawer.locator('[data-team-screen="sla"]')).toBeChecked();
  await expect(drawer.locator('[data-perm-row="sla"]')).toContainText(
    "Herdado de Planner",
  );
  await expect(drawer.locator('[data-team-screen="booking"]')).toBeChecked();
  await drawer.locator('[data-team-function-remove="planner"]').click();
  await expect(drawer.locator('[data-team-screen="sla"]')).not.toBeChecked();
  expect(await previewMarks(drawer)).toEqual(before);

  // 6. Fechar sem salvar (o cargo mudou: pergunta antes).
  page.once("dialog", (d) => void d.accept());
  await drawer.locator("[data-team-cancel]").click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/\/app\/team$/);

  // 7. O próprio login Designer: sem o SLA no menu e pelo endereço; com a
  // faixa de valores no Control Tower (a ação nova).
  const other = await browser.newContext();
  const designer = await other.newPage();
  await login(designer, email);
  await designer.goto("/app");
  await expect(
    designer.locator('section[aria-label="Financeiro"]'),
  ).toBeVisible();
  await expect(designer.locator('[data-nav-link="/app/sla"]')).toHaveCount(0);
  await expect(designer.locator("[data-notifications-bell]")).toBeVisible();
  await designer.goto("/app/sla");
  await expect(designer).toHaveURL(/denied=sla/);
  await designer.goto("/app");

  // 8. Sessão aberta: o administrador tira Notificações e a ação de valores
  // do Designer; na próxima navegação do Designer (sem recarregar), o sino e
  // a faixa de valores somem e o endereço recusa.
  await page.goto("/app/team?tab=functions&fn=designer");
  fn = page.locator('[data-fn-detail="designer"]');
  await fn.locator('[data-fn-screen="notifications"]').uncheck();
  await fn.locator('[data-fn-view="actions"]').click();
  await fn.locator("[data-fn-search]").fill("valores");
  await fn.locator('[data-fn-action="values.view"]').uncheck();
  await fn.locator("[data-fn-save]").click();
  await expect(fn.locator("[data-fn-saved]")).toBeVisible();
  await designer
    .locator('[data-sidebar-nav] [data-nav-link="/app/tasks"]:visible')
    .first()
    .click();
  await expect(designer).toHaveURL(/\/app\/tasks/);
  await expect(designer.locator("[data-notifications-bell]")).toHaveCount(0, {
    timeout: 15_000,
  });
  await designer.goto("/app/notifications");
  await expect(designer).toHaveURL(/denied=notifications/);
  await designer.goto("/app");
  await expect(
    designer.locator('section[aria-label="Financeiro"]'),
  ).toHaveCount(0);
  await other.close();

  // 9. Designer de volta ao padrão (menu ⋯).
  await page.goto("/app/team?tab=functions&fn=designer");
  fn = page.locator('[data-fn-detail="designer"]');
  page.once("dialog", (d) => void d.accept());
  await fn.locator("[data-fn-menu]").click();
  await fn.locator("[data-fn-menu-reset]").click();
  await page.waitForURL(/saved=reset/);
  await expect(
    page.locator('[data-fn-detail="designer"] [data-fn-screen="sla"]'),
  ).toBeChecked();
});

test("Editar acessos: duas funções, Personalizado e administrador", async ({
  page,
  browser,
}) => {
  const tag = Date.now().toString(36);
  await login(page, "admin@wellmix.com");
  const duoId = await createLogin(
    page,
    `Duo ${tag}`,
    `duo-${tag}@wellmix.com`,
    ["designer", "planner"],
  );
  const custId = await createLogin(
    page,
    `Cust ${tag}`,
    `cust-${tag}@wellmix.com`,
    ["designer"],
  );

  // Duas funções: cada permissão diz de qual função vem.
  await page.goto("/app/team");
  let drawer = await openDrawer(page, duoId, `Duo ${tag}`);
  await expect(drawer.locator('[data-perm-row="tasks"]')).toContainText(
    "Herdado de Planner, Designer",
  );
  await expandAll(drawer.locator("[data-team-screens-panel]"));
  await expect(drawer.locator('[data-perm-row="booking"]')).toContainText(
    "Herdado de Planner",
  );
  await expect(drawer.locator('[data-perm-row="marketing"]')).toContainText(
    "Herdado de Designer",
  );
  await drawer.locator("[data-team-drawer-close]").click();
  await expect(drawer).toHaveCount(0);

  // Personalizado: Mensagens fora e Financeiro dentro, à mão. Salvar fecha
  // o painel com o aviso e a lista se atualiza no lugar.
  drawer = await openDrawer(page, custId, `Cust ${tag}`);
  await drawer.locator('[data-team-screens-mode="custom"]').check();
  await drawer.locator('[data-team-screen="messages"]').uncheck();
  await expandAll(drawer.locator("[data-team-screens-panel]"));
  await drawer.locator('[data-team-screen="finance"]').check();
  await expect(drawer.locator('[data-perm-row="finance"]')).toContainText(
    "Personalizado",
  );
  await expect(drawer.locator('[data-perm-row="messages"]')).toContainText(
    "Removida no personalizado",
  );
  await drawer.locator("[data-team-save]").click();
  await expect(page.locator("[data-team-saved-toast]")).toContainText(
    `Cust ${tag}`,
  );
  await expect(drawer).toHaveCount(0);
  await expect(page.locator(`[data-team-screens="${custId}"]`)).toContainText(
    "Personalizado",
  );

  // Reaberto: as personalizações continuam e mostram como entram no
  // resultado; a tela Financeiro não dá a ação de ver valores.
  drawer = await openDrawer(page, custId, `Cust ${tag}`);
  await expect(
    drawer.locator('[data-team-screens-mode="custom"]'),
  ).toBeChecked();
  await expect(
    drawer.locator('[data-team-screen="messages"]'),
  ).not.toBeChecked();
  await expect(drawer.locator('[data-perm-row="messages"]')).toContainText(
    "Removida no personalizado",
  );
  await expandAll(drawer.locator("[data-team-screens-panel]"));
  await expect(drawer.locator('[data-team-screen="finance"]')).toBeChecked();
  await drawer.locator('[data-team-view="actions"]').click();
  await expandAll(drawer.locator("[data-team-actions-panel]"));
  await expect(
    drawer.locator('[data-team-action="values.view"]'),
  ).not.toBeChecked();
  await drawer.locator("[data-team-drawer-close]").click();

  // Os logins: o personalizado sem mensagens (ícone e endereço) e com o
  // Financeiro; o de duas funções com o SLA (o planner deixa marcado).
  const other = await browser.newContext();
  const user = await other.newPage();
  await login(user, `cust-${tag}@wellmix.com`);
  await user.goto("/app/tasks");
  await expect(user.locator("[data-messages-link]")).toHaveCount(0);
  await expect(user.locator("[data-notifications-bell]")).toBeVisible();
  await user.goto("/app/messages");
  await expect(user).toHaveURL(/denied=messages/);
  await user.goto("/app/finance");
  await expect(user).toHaveURL(/\/app\/finance$/);
  await user.goto("/app");
  await expect(user.locator('section[aria-label="Financeiro"]')).toHaveCount(0);
  await login(user, `duo-${tag}@wellmix.com`);
  await user.goto("/app/sla");
  await expect(user).toHaveURL(/\/app\/sla$/);
  await other.close();

  // Administrador: tudo marcado, sem modo para escolher; abre tudo.
  await page.goto("/app/team");
  const adminId = await page
    .locator('tr[data-team-member]:has-text("admin@wellmix.com")')
    .first()
    .getAttribute("data-team-member");
  drawer = await openDrawer(page, adminId!, "admin@wellmix.com");
  await expect(drawer.locator("[data-team-screens-mode]")).toHaveCount(0);
  await expect(drawer.locator('[data-team-screen="home"]')).toBeChecked();
  await expect(drawer.locator('[data-perm-row="home"]')).toContainText(
    "Administrador",
  );
  await drawer.locator("[data-team-drawer-close]").click();
  await page.goto("/app/sla");
  await expect(page).toHaveURL(/\/app\/sla$/);
});

const SIZES = [
  ["desktop", { width: 1366, height: 900 }],
  ["iPad", { width: 820, height: 1180 }],
  ["celular", { width: 390, height: 844 }],
] as const;

for (const [name, viewport] of SIZES)
  test(`Equipe e acessos no ${name}: painel lateral, lista preservada e salvar à vista`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await login(page, "admin@wellmix.com");
    await page.goto("/app/team");
    const opId = await page
      .locator('tr[data-team-member]:has-text("operador@wellmix.com")')
      .first()
      .getAttribute("data-team-member");
    const search = page.locator("[data-table-search]").first();
    const filtered = (await search.count()) > 0;
    if (filtered)
      // Digita depois que a tabela já responde (antes disso o texto se perde).
      await expect(async () => {
        await search.fill("operador");
        await expect(
          page.locator('tr[data-team-member]:has-text("admin@wellmix.com")'),
        ).toBeHidden({ timeout: 1_000 });
      }).toPass();
    const edit = page.locator(`[data-team-edit="${opId}"]`);
    await edit.scrollIntoViewIfNeeded();
    const scrolled = await page.evaluate(() => window.scrollY);
    await edit.click();
    const panel = page.locator(`[data-team-drawer-panel="${opId}"]`);
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    if (name === "celular") expect(Math.round(box.width)).toBe(viewport.width);
    else expect(box.width).toBeLessThan(viewport.width);
    await expect(panel.locator("[data-team-save]")).toBeInViewport();
    await panel.locator("[data-team-drawer-close]").click();
    await expect(panel).toHaveCount(0);
    // A lista fica onde estava, com o filtro.
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
    if (filtered) {
      await expect(search).toHaveValue("operador");
      await expect(
        page.locator('tr[data-team-member]:has-text("admin@wellmix.com")'),
      ).toBeHidden();
    }

    // Funções e acessos: busca, seções e o botão de salvar à vista.
    await page.goto("/app/team?tab=functions&fn=buyer");
    const fn = page.locator('[data-fn-detail="buyer"]');
    await fn.locator("[data-fn-search]").scrollIntoViewIfNeeded();
    await expect(fn.locator("[data-fn-save]")).toBeInViewport();
    await fn.locator("[data-fn-search]").fill("contrato");
    await expect(
      fn.locator('[data-fn-screens="buyer"] [data-perm-row]'),
    ).toHaveCount(0);
    await fn.locator('[data-fn-view="actions"]').click();
    await expect(
      fn.locator('[data-fn-actions="buyer"] [data-perm-row="contract.sign"]'),
    ).toBeVisible();
  });
