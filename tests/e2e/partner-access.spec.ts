import { expect, test, type Page } from "@playwright/test";

/*
 * Tipos em destaque e Gestão de telas (docs/PARTNER_ACCESS.md): Trading,
 * Factory, Supplier e GP nos filtros; uma Factory com login entra com as
 * telas do Fornecedor; o administrador tira uma tela (vale na hora), compara
 * dois perfis e copia a tela de volta com prévia; uma tela de outra classe
 * de login (Multas) é liberada e mostra só os dados da própria empresa.
 */
const PASSWORD = "wellmix123";

async function login(page: Page, user: string, password = PASSWORD) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/e-mail|email|邮箱/i).fill(user);
  await page.getByLabel(/senha|password|密码/i).fill(password);
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await page.waitForURL(/\/app/);
}

test("Factory com login: telas do Fornecedor, revogar, comparar e copiar", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  const factoryName = `Fábrica ${tag}`;
  const userLogin = `li-${tag}@factory.com`;
  await login(page, "admin@wellmix.com");

  // Os quatro tipos novos vêm primeiro nos filtros; Gestão de telas à vista.
  await page.goto("/app/parties");
  const chips = page.locator("[data-party-type-chip]");
  await expect(chips.nth(0)).toHaveText("Trading");
  await expect(chips.nth(1)).toHaveText("Factory");
  await expect(chips.nth(2)).toHaveText("Supplier");
  await expect(chips.nth(3)).toHaveText("GP");
  await expect(page.locator("[data-partner-access-link]")).toBeVisible();

  // Novo parceiro a partir do filtro Factory: o tipo já vem marcado.
  await page.locator('[data-party-type-chip="factory"]').click();
  await page.waitForURL(/type=factory/);
  await page.locator("[data-party-new]").click();
  await expect(page.locator("[data-party-type]")).toHaveValue("factory");
  await page.fill('input[name="name"]', factoryName);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?]+$/);

  // Depois de cadastrar, a tela já abre no quadro de acesso, com o atalho no topo.
  await expect(page).toHaveURL(/#access$/);
  await expect(page.locator("[data-party-login-jump]")).toBeVisible();
  // Usuário vinculado: entra com o papel do Fornecedor.
  const access = page.locator("[data-party-access]");
  await expect(access.locator('select[name="role"]')).toHaveValue("supplier");
  await access.locator('input[name="name"]').fill("Li Factory");
  await access.locator('input[name="login"]').fill(userLogin);
  await access.locator('input[name="password"]').fill(PASSWORD);
  await access.locator("[data-party-access-create]").click();
  await page.waitForURL(/saved=user/);
  await expect(page.locator("[data-party-access-profile]")).toContainText(
    "Factory",
  );

  // Na lista, a coluna do login mostra que o parceiro já tem acesso.
  await page.goto("/app/parties?type=factory");
  await expect(
    page.locator("tr", { hasText: factoryName }).locator("[data-party-logins]"),
  ).toHaveAttribute("data-party-logins", "1");

  // Como Factory: as mesmas telas do Fornecedor (o menu é conferido nos testes unitários).
  await login(page, userLogin);
  await page.goto("/app/quotes");
  await expect(page).toHaveURL(/\/app\/quotes/);
  await expect(page.getByRole("heading", { name: "Cotações" })).toBeVisible();

  // Administrador: tira Cotações da Factory na Gestão de telas.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/parties/access?profile=type:factory");
  await expect(page.locator("[data-access-users]")).toHaveAttribute(
    "data-access-users",
    /^[1-9]/,
  );
  // O catálogo mostra todas as telas, inclusive internas (bloqueadas).
  await expect(page.locator('[data-access-screen="finance"]')).toHaveAttribute(
    "data-access-state",
    "internal",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-access-open="quotes"]').uncheck();
  await page.locator("[data-access-save]").click();
  await page.waitForURL(/saved=/);
  await expect(page.locator('[data-access-screen="quotes"]')).toHaveAttribute(
    "data-access-state",
    "blocked",
  );

  // A vitrine é de outra classe de login: pode ser liberada, com o aviso de
  // que neste perfil ainda abre sem dados.
  await expect(page.locator('[data-access-screen="explore"]')).toHaveAttribute(
    "data-access-state",
    "blocked",
  );
  await expect(page.locator('[data-access-limited="explore"]')).toBeVisible();
  await expect(page.locator('[data-access-limited="orders"]')).toHaveCount(0);

  // Comparar Factory com o Fornecedor: a diferença é Cotações.
  await page.goto(
    "/app/parties/access?view=compare&a=type:factory&b=role:supplier",
  );
  await expect(page.locator('[data-access-compare="quotes"]')).toHaveAttribute(
    "data-differs",
    "1",
  );
  await expect(page.locator("[data-access-compare-diff]")).toHaveAttribute(
    "data-access-compare-diff",
    "1",
  );

  // Como Factory: Cotações recusa, mesmo pelo endereço; a Gestão de telas
  // não abre para quem não é administrador.
  await login(page, userLogin);
  await page.goto("/app/quotes");
  await expect(page).toHaveURL(/denied=quotes/);
  await page.goto("/app/parties/access");
  await expect(page).toHaveURL(/denied=parties/);

  // Administrador: copia Cotações do Fornecedor de volta para a Factory, com prévia.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/parties/access?view=copy");
  await page.selectOption('select[name="from"]', "role:supplier");
  await page.selectOption('select[name="to"]', "type:factory");
  await page.locator('[data-access-copy-screen="quotes"]').check();
  await page.locator("[data-access-copy-preview]").click();
  await expect(page.locator("[data-access-copy-result]")).toContainText(
    "Passa a abrir",
  );
  await page.locator("[data-access-copy-apply]").click();
  await page.waitForURL(/saved=1/);
  await expect(page.locator('[data-access-screen="quotes"]')).toHaveAttribute(
    "data-access-state",
    "open",
  );
  // Por tela: quem abre Cotações.
  await page.goto("/app/parties/access?view=screen&screen=quotes");
  await expect(
    page.locator('[data-access-holder="type:factory"]'),
  ).toHaveAttribute("data-access-open", "1");
  await expect(
    page.locator('[data-access-holder="role:customer"]'),
  ).toHaveAttribute("data-access-open", "0");
  // Copiar Multas (do jurídico) para a Factory: vale, com prévia.
  await page.goto(
    "/app/parties/access?view=copy&preview=1&from=role:legal&to=type:factory&screens=penalties&mode=add",
  );
  await expect(page.locator("[data-access-copy-result]")).toContainText(
    "Passa a abrir",
  );
  await page.locator("[data-access-copy-apply]").click();
  await page.waitForURL(/saved=1/);

  // Como Factory de novo: Cotações voltou a abrir.
  await login(page, userLogin);
  await page.goto("/app/quotes");
  await expect(page.getByRole("heading", { name: "Cotações" })).toBeVisible();
  // Multas abre para a Factory e mostra só as da própria empresa (nenhuma).
  await page.goto("/app/penalties");
  await expect(page).toHaveURL(/\/app\/penalties/);
  await expect(page.locator("tbody tr")).toHaveCount(0);

  // Deixa o perfil como estava para os outros testes.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/parties/access?profile=type:factory");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("[data-access-reset]").click();
  await page.waitForURL(/saved=reset/);
});
