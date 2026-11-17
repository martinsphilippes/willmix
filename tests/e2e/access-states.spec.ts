import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, login } from "./helpers";

/*
 * Estados de cadastro e login (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md,
 * R7): o administrador desativa e reativa o login do parceiro pelo painel da
 * Equipe Externa; a sessão aberta cai na próxima página com o motivo; a
 * entrada diz o motivo só com a senha certa. A regra "cadastro e login
 * ativos" só vale depois que o administrador a liga, vendo antes quem seria
 * bloqueado. No fim, a regra volta desligada e o cadastro ativo.
 */

const ADMIN = "admin@wellmix.com";

/** Tenta entrar e espera a recusa na tela (sem esperar ir para o portal). */
async function tryLogin(page: Page, email: string, password: string) {
  await page.getByLabel(/e-mail|email|邮箱/i).fill(email);
  await page.getByLabel(/senha|password|密码/i).fill(password);
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
}

/** Liga ou desliga o "Ativo" do cadastro e espera gravar. */
async function setPartyActive(page: Page, partyId: string, active: boolean) {
  await page.goto(`/app/parties/${partyId}`);
  const box = page.locator('input[type="checkbox"][name="active"]');
  if (active) await box.check();
  else await box.uncheck();
  const form = page.locator("form", { has: box });
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().includes(`/app/parties/${partyId}`),
  );
  await form.getByRole("button", { name: "Salvar" }).click();
  await saved;
}

test("desativar e reativar login; regra cadastro e login ativos ligada pelo administrador", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const tag = `st${Date.now().toString(36)}`;
  const email = `st-${tag}@login.com`;
  await login(page, ADMIN);

  // Parceiro com um login.
  await page.goto("/app/parties/new?type=carrier");
  await page.fill('input[name="name"]', `Estado ${tag}`);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?#]+(#access)?$/);
  const partyId = new URL(page.url()).pathname.split("/").pop()!;
  const card = page.locator("[data-party-access]");
  await card.locator('input[name="name"]').fill(`Pessoa ${tag}`);
  await card.locator('input[name="login"]').fill(email);
  await card.locator('input[name="password"]').fill(PASSWORD);
  await card.locator("[data-party-access-create]").click();
  await page.waitForURL(/saved=user/);

  // A sessão do parceiro fica aberta em outro navegador.
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  const partner = await context.newPage();
  try {
    await login(partner, email);

    // 1. Desativar o login pelo painel (com a confirmação).
    await page.goto(`/app/parties?name=${tag}`);
    await page
      .locator(`[data-party-row="${partyId}"] [data-party-logins]`)
      .click();
    const panel = page.locator(`[data-party-logins-panel="${partyId}"]`);
    page.once("dialog", (d) => void d.accept());
    await panel.locator('[data-party-login-toggle="off"]').click();
    await page.waitForURL(/saved=login_off/);
    await expect(
      panel.locator('[data-party-login-state="inactive"]'),
    ).toHaveCount(1);
    await expect(
      panel.locator('[data-party-logins-notice="success"]'),
    ).toBeVisible();
    await expect(
      page.locator(
        `[data-party-row="${partyId}"] [data-party-logins-inactive]`,
      ),
    ).toBeVisible();

    // 2. A sessão aberta cai na próxima página, com o motivo.
    await partner.goto("/app/orders");
    await partner.waitForURL(/\/login/);
    await expect(
      partner.locator('[data-login-session-blocked="login_inactive"]'),
    ).toContainText("Seu login está desativado");
    // 3. Senha certa: o motivo; senha errada: a mensagem de sempre.
    await tryLogin(partner, email, PASSWORD);
    await expect(partner.locator("[data-login-error]")).toContainText(
      "Seu login está desativado",
    );
    await tryLogin(partner, email, "senha-errada-xyz");
    await expect(partner.locator("[data-login-error]")).toHaveText(
      "Credenciais inválidas",
    );

    // 4. Reativar: entra de novo.
    await panel.locator('[data-party-login-toggle="on"]').click();
    await page.waitForURL(/saved=login_on/);
    await expect(
      panel.locator('[data-party-login-state="active"]'),
    ).toHaveCount(1);
    await login(partner, email);

    // 5. Cadastro inativo com a regra desligada: entra, e a lista avisa.
    await setPartyActive(page, partyId, false);
    await page.goto(`/app/parties?name=${tag}`);
    await expect(
      page.locator(
        `[data-party-row="${partyId}"] [data-party-access-warning="login-active"]`,
      ),
    ).toBeVisible();
    await expect(page.locator('[data-access-rule="off"]')).toBeVisible();
    await login(partner, email);

    // 6. Ligar a regra, vendo antes o parceiro que deixa de entrar.
    await page.locator("[data-access-rule-review]").click();
    const rule = page.locator('[data-access-rule-panel="off"]');
    await expect(
      rule.locator(`[data-access-rule-party="${partyId}"]`),
    ).toContainText(email);
    await rule.locator('[data-access-rule-toggle="on"]').click();
    await page.waitForURL(/saved=rule_on/);
    await expect(page.locator('[data-access-rule="on"]')).toBeVisible();
    await expect(
      page.locator(
        `[data-party-row="${partyId}"] [data-party-access-warning="blocked"]`,
      ),
    ).toBeVisible();

    // 7. A sessão aberta do parceiro cai; a entrada diz que o cadastro está
    // inativo.
    await partner.goto("/app/orders");
    await partner.waitForURL(/\/login/);
    await expect(
      partner.locator('[data-login-session-blocked="party_inactive"]'),
    ).toBeVisible();
    await tryLogin(partner, email, PASSWORD);
    await expect(partner.locator("[data-login-error]")).toContainText(
      "O cadastro da sua empresa está inativo",
    );
  } finally {
    // O portal volta como estava: regra desligada e cadastro ativo.
    await page.goto("/app/parties?panel=access-rule");
    const on = page.locator('[data-access-rule-panel="on"]');
    if (await on.count()) {
      await on.locator('[data-access-rule-toggle="off"]').click();
      await page.waitForURL(/saved=rule_off/);
    }
    await setPartyActive(page, partyId, true);
  }
  // 8. Regra desligada e cadastro ativo: entra de novo.
  await login(partner, email);
  await context.close();
});
