import { expect, test } from "@playwright/test";
import { login, openReplenishment } from "./helpers";

/*
 * Gerar o login do parceiro na tela da Estratégia de compra (dono,
 * 20/11/2026; docs/PURCHASE_DEMAND.md, "Login do parceiro na Estratégia"):
 * o fornecedor "Sem login ativo" ganha o acesso ali mesmo, sem ir ao
 * cadastro; criado, ele é conferido de novo, fica Apto e marcado, e a
 * escolha "cotar com outros" continua.
 */
test("Estratégia de compra: o administrador gera o login do parceiro ali mesmo e ele fica Apto", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  const email = `vendas-${tag}@fornecedor.cn`;
  await login(page, "admin@wellmix.com");

  // Um fornecedor novo da China, da família das utilidades, sem login.
  await page.goto("/app/parties/new?type=supplier");
  await page.fill('input[name="name"]', `Fornecedor Sem Login ${tag}`);
  await page.fill('input[name="country"]', "China");
  await page.fill('input[name="email"]', email);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?#]+(#access)?$/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  await page.goto(`/app/suppliers/${id}?tab=info`);
  await page.locator('[data-party-family="20000000"]').check();
  await page.locator("[data-party-families-save]").click();
  await page.waitForURL(/[?&]families=saved/);

  // Reposição da jarra; na Estratégia, cotar com outros fornecedores.
  const demandId = await openReplenishment(page, "UTL-001", "4000");
  await page.goto("/app/purchase-strategy");
  const line = page.locator(`[data-strategy-line="${demandId}"]`);
  await line.locator('[data-strategy-choice="quote"]').check();
  const row = line.locator(`[data-strategy-recipient="${id}"]`);
  await expect(row).toHaveAttribute("data-strategy-recipient-ok", "0");
  await expect(row.locator("[data-strategy-recipient-issues]")).toContainText(
    "Sem login ativo",
  );

  // "Gerar o login aqui": já vem o e-mail do cadastro e o chinês.
  await row.locator(`[data-partner-login-open="${id}"]`).click();
  const form = row.locator(`[data-partner-login-form="${id}"]`);
  await expect(form.locator("[data-partner-login-login]")).toHaveValue(email);
  await expect(form.locator("[data-partner-login-locale]")).toHaveValue("zh");
  const password = await form
    .locator("[data-partner-login-password-input]")
    .inputValue();
  expect(password.length).toBeGreaterThanOrEqual(8);
  await form.locator("[data-partner-login-submit]").click();

  // Criado: o login e a senha para passar ao parceiro, na mesma tela.
  const done = row.locator(`[data-partner-login-done="${id}"]`);
  await expect(done.locator("[data-partner-login-created]")).toHaveText(email);
  await expect(done.locator("[data-partner-login-password]")).toHaveText(
    password,
  );
  // Conferido de novo: Apto e marcado; a escolha continua.
  await expect(row).toHaveAttribute("data-strategy-recipient-ok", "1");
  await expect(
    line.locator(`[data-strategy-recipient-box="${id}"]`),
  ).toBeChecked();
  await expect(line.locator('[data-strategy-choice="quote"]')).toBeChecked();
});
