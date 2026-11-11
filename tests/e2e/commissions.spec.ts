import { expect, test, type Page } from "@playwright/test";

/*
 * Acordos e comissões pela tela (docs/COMMISSIONS.md): acordo padrão por
 * linha para transportadores (R$ 10.000 a 2% + R$ 5.000 a 4% = R$ 400), a
 * exceção negociada com um transportador (linha A a 3% = R$ 500) e o bônus
 * de R$ 250 na entrega (R$ 750), tudo conferido no simulador, que usa o
 * mesmo cálculo da apuração. Quem não é administrador não abre.
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

/** Preenche uma regra do formulário do acordo. */
async function rule(
  page: Page,
  i: number,
  fields: {
    name: string;
    kind?: string;
    rate?: string;
    amount?: string;
    line?: number;
    accumulate?: boolean;
    success?: string;
  },
) {
  const box = page.locator(`[data-commission-rule="${i}"]`);
  await box.locator(`input[name="c${i}.name"]`).fill(fields.name);
  if (fields.kind)
    await box.locator(`select[name="c${i}.kind"]`).selectOption(fields.kind);
  if (fields.rate)
    await box.locator(`input[name="c${i}.rate"]`).fill(fields.rate);
  if (fields.amount)
    await box.locator(`input[name="c${i}.amount"]`).fill(fields.amount);
  if (fields.line !== undefined)
    await box
      .locator(`select[name="c${i}.line"]`)
      .selectOption({ index: fields.line });
  if (fields.accumulate)
    await box.locator(`input[name="c${i}.accumulate"]`).check();
  if (fields.success)
    await box
      .locator(`select[name="c${i}.successEvent"]`)
      .selectOption(fields.success);
}

async function simulate(
  page: Page,
  party: string,
  events: string[] = [],
): Promise<string | null> {
  await page.goto("/app/commissions?tab=simulator");
  await page.selectOption('select[name="lineA"]', { index: 1 });
  await page.fill('input[name="sampleA"]', "10000");
  await page.selectOption('select[name="lineB"]', { index: 2 });
  await page.fill('input[name="sampleB"]', "5000");
  await page.selectOption('select[name="type"]', "carrier");
  await page.fill('input[name="party"]', party);
  for (const e of events)
    await page.locator(`input[name="events"][value="${e}"]`).check();
  await page.locator("[data-commission-sim-run]").click();
  await page.waitForURL(/run=1/);
  return page
    .locator("[data-commission-sim-total]")
    .getAttribute("data-commission-sim-total");
}

test("acordo padrão por linha, exceção individual e bônus por sucesso no simulador", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  const carrierX = `Transportes X ${tag}`;
  const carrierY = `Transportes Y ${tag}`;
  const category = `comissao-${tag}`;
  await login(page, "admin@wellmix.com");

  // Dois transportadores, sem login.
  for (const name of [carrierX, carrierY]) {
    await page.goto("/app/parties/new?type=carrier");
    await page.fill('input[name="name"]', name);
    await page.getByRole("button", { name: "Salvar" }).first().click();
    await page.waitForURL(/\/app\/parties\/[^/?]+/);
  }

  // Acordo padrão dos transportadores: linha A 2%, linha B 4%.
  await page.goto("/app/commissions");
  await page.locator("[data-commission-new]").click();
  await page.fill('input[name="name"]', `Padrão transportadores ${tag}`);
  await page.fill('input[name="category"]', category);
  await page.selectOption('select[name="beneficiaryType"]', "carrier");
  await rule(page, 0, { name: "Linha A 2%", rate: "2", line: 1 });
  await rule(page, 1, { name: "Linha B 4%", rate: "4", line: 2 });
  await page.locator("[data-agreement-save]").click();
  await page.waitForURL(/saved=1/);
  // Rascunho: ainda não vale, mas a simulação com ele mostra o que viria.
  page.once("dialog", (d) => d.accept());
  await page.locator("[data-agreement-activate]").click();
  await page.waitForURL(/saved=activate/);

  // 1. R$ 10.000 a 2% + R$ 5.000 a 4% = R$ 400.
  expect(await simulate(page, carrierX)).toBe("400");

  // Exceção negociada com o Transportes X: linha A a 3% e bônus de 250 na entrega.
  await page.goto("/app/commissions/agreements/new");
  await page.fill('input[name="name"]', `Negociado ${carrierX}`);
  await page.fill('input[name="category"]', category);
  await page.fill('input[name="beneficiary"]', carrierX);
  await rule(page, 0, { name: "Linha A 3%", rate: "3", line: 1 });
  await rule(page, 1, {
    name: "Bônus por entrega",
    kind: "fixed",
    amount: "250",
    accumulate: true,
    success: "delivered",
  });
  await page.locator("[data-agreement-save]").click();
  await page.waitForURL(/saved=1/);
  page.once("dialog", (d) => d.accept());
  await page.locator("[data-agreement-activate]").click();
  await page.waitForURL(/saved=activate/);

  // 2. Para o Transportes X, R$ 500; o Transportes Y continua em R$ 400.
  expect(await simulate(page, carrierX)).toBe("500");
  await expect(page.locator("[data-commission-sim-result]")).toContainText(
    "exceção individual",
  );
  expect(await simulate(page, carrierY)).toBe("400");
  // 3. Entregue: o bônus entra (R$ 750).
  expect(await simulate(page, carrierX, ["delivered"])).toBe("750");

  // Outro acordo padrão igual: o conflito aparece e a ativação fica travada.
  await page.goto("/app/commissions/agreements/new");
  await page.fill('input[name="name"]', `Outro padrão ${tag}`);
  await page.fill('input[name="category"]', category);
  await page.selectOption('select[name="beneficiaryType"]', "carrier");
  await rule(page, 0, { name: "Linha A 5%", rate: "5", line: 1 });
  await page.locator("[data-agreement-save]").click();
  await page.waitForURL(/saved=1/);
  await expect(page.locator("[data-commission-conflict]")).toBeVisible();
  await expect(page.locator("[data-agreement-activate]")).toBeDisabled();

  // As outras abas abrem.
  await page.goto("/app/commissions?tab=entries");
  await expect(page.locator("[data-commission-accrue]")).toBeVisible();
  await page.goto("/app/commissions?tab=statement");
  await expect(page.locator("[data-commission-tab=statement]")).toBeVisible();

  // Fornecedor não abre os acordos nem as comissões.
  await login(page, "supplier.a@china.com");
  await page.goto("/app/commissions");
  await expect(page).toHaveURL(/denied=finance/);
});
