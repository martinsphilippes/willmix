import { expect, test, type Page } from "@playwright/test";

/*
 * Tipos de parceiro (docs/PARTNER_TYPES.md): no "Novo parceiro" aberto por
 * Parceiros nada vem marcado e Fornecedor não aparece; o atalho cria o tipo,
 * deixa-o selecionado e mantém o que já estava digitado; o tipo novo vira
 * opção do filtro com busca da lista; quem não é administrador não vê o
 * atalho.
 */
const PASSWORD = "wellmix123";

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/e-mail|email|邮箱/i).fill(email);
  await page.getByLabel(/senha|password|密码/i).fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await page.waitForURL(/\/app/);
}

test("novo parceiro: cria o tipo pelo atalho, mantém o digitado e o tipo vira filtro", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  const typeName = `Empresa de Inspeção ${tag}`;
  const partyName = `Inspecta ${tag}`;
  await login(page, "admin@wellmix.com");
  await page.goto("/app/parties/new");
  const type = page.locator("[data-party-type]");
  // Aberto por Outros parceiros: nada marcado, sem Cliente nem Fornecedor.
  await expect(type).toHaveValue("");
  await expect(type.locator('option[value="supplier"]')).toHaveCount(0);
  await expect(type.locator('option[value="customer"]')).toHaveCount(0);
  await expect(type.locator('option[value="carrier"]')).toHaveCount(1);

  await page.fill('input[name="name"]', partyName);
  await page.fill('input[name="email"]', `contato-${tag}@inspecta.com`);
  await page.fill('input[name="country"]', "BR");
  await page.fill('textarea[name="notes"]', "Faz inspeção em Yiwu.");
  await page.locator("[data-party-quick-type] summary").click();
  await page.fill('input[name="newTypeName"]', typeName);
  await page.click("[data-party-quick-type-submit]");
  await page.waitForURL(/typeCreated=1/);
  // O tipo novo veio selecionado e os campos continuam preenchidos.
  await expect(type).toHaveValue(/^custom:/);
  await expect(type.locator("option:checked")).toHaveText(typeName);
  await expect(page.locator('input[name="name"]')).toHaveValue(partyName);
  await expect(page.locator('input[name="email"]')).toHaveValue(
    `contato-${tag}@inspecta.com`,
  );
  await expect(page.locator('textarea[name="notes"]')).toHaveValue(
    "Faz inspeção em Yiwu.",
  );
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?]+$/);
  // Tipo criado no painel: sem classe de login, o cadastro não cria acesso.
  await expect(page.locator("[data-party-no-login-class]")).toBeVisible();

  // Na lista, o tipo é uma opção do filtro com busca e mostra o parceiro.
  await page.goto("/app/parties");
  const input = page.locator("[data-party-type-filter-input]");
  await expect(input).toHaveAttribute("data-party-type-filter-ready", "1");
  await input.click();
  await input.fill(typeName.slice(0, 18));
  const option = page.locator("[data-party-type-filter-option]", {
    hasText: typeName,
  });
  await expect(option).toBeVisible();
  await option.click();
  await page.waitForURL(/type=custom/);
  await expect(page.getByRole("link", { name: partyName })).toBeVisible();
  await expect(page.getByRole("cell", { name: typeName })).toBeVisible();

  // Tela dos tipos: o novo aparece, com um parceiro.
  await page.goto("/app/parties/types");
  const row = page.locator("[data-partner-type-list] tr", {
    hasText: typeName,
  });
  await expect(row).toBeVisible();
  await expect(row.locator("[data-partner-type-count]")).toHaveText("1");

  // Novo cliente continua vindo com Cliente marcado.
  await page.goto("/app/parties/new?type=customer");
  await expect(page.locator("[data-party-type]")).toHaveValue("customer");

  // Quem não é administrador não cria tipo.
  await login(page, "operador@wellmix.com");
  await page.goto("/app/parties/new");
  await expect(page.locator("[data-party-quick-type]")).toHaveCount(0);
});
