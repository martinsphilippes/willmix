import { expect, test } from "@playwright/test";
import { PASSWORD, login } from "./helpers";

/*
 * Clientes com telas próprias (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md,
 * etapa 4): o novo cliente e o cadastro do cliente em Cadastros → Clientes;
 * os endereços de antes (/app/parties/<id> e /app/parties/new?type=customer)
 * levam para cá; "Acessos dos clientes" e desativar e reativar o login na
 * ficha, só o administrador.
 */

test("Clientes: novo cliente, cadastro e login na tela própria; endereços antigos levam para lá", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const tag = `cs${Date.now().toString(36)}`;
  await login(page, "admin@wellmix.com");

  // Novo cliente pelo botão da lista.
  await page.goto("/app/customers");
  await page.locator("[data-customers-new]").click();
  await page.waitForURL(/\/app\/customers\/new$/);
  await expect(page.locator("[data-party-type]")).toHaveValue("customer");
  await page.fill('input[name="name"]', `Cliente ${tag}`);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/customers\/[^/?#]+\/edit(#access)?$/);
  const id = new URL(page.url()).pathname.split("/").at(-2)!;
  // O cadastro abre no menu de Clientes, com o quadro de acesso.
  await expect(page.locator("[data-party-access]")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('[data-nav-link="/app/customers"][aria-current="page"]')
        .count(),
    )
    .toBeGreaterThan(0);

  // Login do cliente pelo cadastro (administrador).
  const card = page.locator("[data-party-access]");
  await card.locator('input[name="name"]').fill(`Comprador ${tag}`);
  await card.locator('input[name="login"]').fill(`cl-${tag}@cliente.com`);
  await card.locator('input[name="password"]').fill(PASSWORD);
  await card.locator("[data-party-access-create]").click();
  await page.waitForURL(/saved=user/);
  expect(new URL(page.url()).pathname).toBe(`/app/customers/${id}/edit`);

  // Endereços de antes levam para Clientes, com os parâmetros.
  await page.goto(`/app/parties/${id}?saved=1`);
  await page.waitForURL(new RegExp(`/app/customers/${id}/edit\\?saved=1$`));
  await page.goto("/app/parties/new?type=customer");
  await page.waitForURL(/\/app\/customers\/new$/);

  // Na lista: editar e o login levam ao cadastro em Clientes.
  await page.goto(`/app/customers?q=${tag}`);
  const row = page.locator(`[data-customer-row="${id}"]`);
  await expect(row.locator("[data-party-logins]")).toHaveText("1 login(s)");
  await expect(
    row.locator("[data-party-logins]").locator("xpath=.."),
  ).toHaveAttribute("href", `/app/customers/${id}/edit#access`);

  // Acessos dos clientes: o perfil de telas dos logins de cliente.
  await page.locator("[data-customers-access]").click();
  await page.waitForURL(/profile=role(%3A|:)customer/);
  await expect(page.locator("[data-access-profile-select]")).toHaveValue(
    "role:customer",
  );

  // Ficha do cliente: desativar e reativar o login.
  await page.goto(`/app/customers/${id}?tab=info`);
  const loginRow = page.locator("[data-account-login]");
  await expect(loginRow).toHaveAttribute("data-account-login-state", "active");
  page.once("dialog", (d) => void d.accept());
  await page.locator('[data-account-login-toggle="off"]').click();
  await page.waitForURL(/saved=login_off/);
  await expect(page.locator("[data-account-login]")).toHaveAttribute(
    "data-account-login-state",
    "inactive",
  );
  await page.locator('[data-account-login-toggle="on"]').click();
  await page.waitForURL(/saved=login_on/);
  await expect(page.locator("[data-account-login]")).toHaveAttribute(
    "data-account-login-state",
    "active",
  );
});

test("Clientes: quem não é administrador não vê Acessos dos clientes nem desativa login", async ({
  page,
}) => {
  await login(page, "operador@wellmix.com");
  await page.goto("/app/customers");
  await expect(page.locator("[data-customers-new]")).toBeVisible();
  await expect(page.locator("[data-customers-access]")).toHaveCount(0);
  await page.goto("/app/customers/cliente-joao?tab=info");
  await expect(page.locator("[data-account-login]").first()).toBeVisible();
  await expect(page.locator("[data-account-login-toggle]")).toHaveCount(0);
});
