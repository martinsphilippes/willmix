import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  createTeamLogin,
  fillQuoteSheet,
  grantTeamScreen,
  login,
  openReplenishment,
} from "./helpers";

/*
 * Cotação de compra (mapa B13; dono, 15/11/2026; docs/PURCHASE_DEMAND.md):
 * (b) reposição → cotar → dois fornecedores respondem, um não, o Comprador
 * escolhe, a Diretoria aprova → solicitação ao fornecedor com os valores
 * cotados; e o isolamento: o fornecedor A não abre a resposta do B nem vê o
 * cliente; o cliente não abre a demanda de outra empresa nem vê fornecedor
 * ou custo. O prazo é curto (0,02 h) para vencer durante o teste; volta a 24.
 */

async function setQuoteHours(page: Page, hours: string) {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/settings");
  const field = page.locator("[data-setting-purchase-quote-hours]");
  await field.fill(hours);
  await field.evaluate((el) => (el as HTMLInputElement).form!.requestSubmit());
  await page.waitForURL(/\/app\/settings\?ok=1/);
}

/**
 * O fornecedor passa a atender a família de utilidades (Grupo de produto
 * (família) no cadastro; docs/PARTNER_FAMILIES.md): entra na cotação das
 * linhas dela e aparece vinculado na Estratégia de Compra.
 */
async function serveUtilities(page: Page, supplierId: string) {
  await page.goto(`/app/suppliers/${supplierId}?tab=info`);
  await page.locator('[data-party-family="20000000"]').check();
  await page.locator("[data-party-families-save]").click();
  await page.waitForURL(/[?&]families=saved/);
}

/**
 * Moeda e preço (dono, 20/11/2026; docs/PURCHASE_DEMAND.md, "Moeda e preço
 * na cotação"): a moeda fica ao lado do preço, RMB por padrão; o preço é
 * digitado só com números (caixa registradora: 210 → 2.10) e o campo segue
 * o símbolo e o separador da moeda (Real com vírgula).
 */
async function typePrice(
  form: Locator,
  digits: string,
  currency: "RMB" | "USD",
) {
  const box = form.locator('[data-quote-price-box="prod-jarra"]');
  const select = form.locator('[data-quote-currency="prod-jarra"]');
  const price = form.locator('[data-quote-price="prod-jarra"]');
  const symbol = box.locator("[data-money-symbol]");
  await expect(select).toHaveValue("RMB");
  await expect(symbol).toHaveText("¥");
  await expect(
    form.locator('[data-quote-price-hint="prod-jarra"]'),
  ).toContainText("4000 vira 40.00");
  await price.click();
  await price.pressSequentially(digits);
  const shown = `${digits.slice(0, -2) || "0"}.${digits.slice(-2)}`;
  await expect(price).toHaveValue(shown);
  if (currency === "USD") {
    // Real: a vírgula no lugar do ponto; Dólar: o ponto de novo.
    await select.selectOption("BRL");
    await expect(symbol).toHaveText("R$");
    await expect(price).toHaveValue(shown.replace(".", ","));
    await select.selectOption("USD");
    await expect(symbol).toHaveText("US$");
    await expect(price).toHaveValue(shown);
  }
}

async function answer(
  page: Page,
  email: string,
  quoteId: string,
  digits: string,
  currency: "RMB" | "USD" = "RMB",
) {
  await login(page, email);
  await page.goto("/app/purchase-quotes");
  await page.locator(`[data-quote-invite="${quoteId}"] a`).first().click();
  await page.waitForURL(new RegExp(`/app/purchase-quotes/${quoteId}`));
  const form = page.locator("[data-quote-answer-form]");
  await typePrice(form, digits, currency);
  // Ficha técnica (dono, 20/11/2026): sem ela e sem o comercial, o envio não
  // sai e a tela diz o que falta.
  if (await form.locator('[data-quote-sheet="prod-jarra"]').count()) {
    await form.locator("[data-quote-submit]").click();
    await expect(form.locator("[data-sheet-missing]")).toBeVisible();
    await expect(page).not.toHaveURL(/[?&]answered=1/);
  }
  await fillQuoteSheet(form, "prod-jarra");
  // 4.000 peças pela caixa dele (24 por caixa): 167 caixas master.
  await expect(
    form.locator('[data-sheet-your-box="prod-jarra"]'),
  ).toContainText("167");
  await form.locator("[data-quote-lead]").fill("35");
  await form.locator("[data-quote-port]").fill("Ningbo");
  await form.locator("[data-quote-moq]").fill("500");
  await form.locator("[data-quote-submit]").click();
  await page.waitForURL(/[?&]answered=1/);
}

test("cotação de compra: dois respondem, um não; Comprador escolhe, Diretoria aprova, nasce a solicitação ao fornecedor", async ({
  page,
}) => {
  test.slow();
  await setQuoteHours(page, "0.02");
  // A, B e C marcam a família das utilidades (Grupo de produto (família)):
  // aparecem vinculados na Estratégia de Compra e entram na cotação.
  for (const id of ["fornecedor-a", "fornecedor-b", "fornecedor-c"])
    await serveUtilities(page, id);

  // Reposição da jarra pelo Planner; o Comprador escolhe cotar com os
  // fornecedores vinculados à família (já vêm marcados) e confirma: a cotação
  // vai na hora, sem aprovação antes (dono, 18/11/2026).
  await login(page, "operador@wellmix.com");
  const demandId = await openReplenishment(page, "UTL-001", "4000");
  await page.goto("/app/purchase-strategy");
  const line = page.locator(`[data-strategy-line="${demandId}"]`);
  await line.locator('[data-strategy-choice="quote"]').check();
  for (const id of ["fornecedor-a", "fornecedor-b", "fornecedor-c"])
    await expect(
      line.locator(`[data-strategy-recipient-box="${id}"]`),
    ).toBeChecked();
  // A lista do País × Família vem marcada; o Comprador pode desmarcar e
  // marcar de novo (dono, 18/11/2026).
  const boxC = line.locator('[data-strategy-recipient-box="fornecedor-c"]');
  await boxC.uncheck();
  await expect(boxC).not.toBeChecked();
  await boxC.check();
  await page.locator("[data-strategy-review]").click();
  await expect(
    page.locator(`[data-strategy-summary-line="${demandId}"]`),
  ).toContainText("(3)");
  await page.locator("[data-strategy-confirm]").click();
  await page.waitForURL(/\/app\/purchase-strategy\/sends\/[^/?]+\?done=1/);
  // Resultado por destinatário: os três receberam.
  await expect(
    page.locator('[data-strategy-send-recipient-status="sent"]'),
  ).toHaveCount(3);
  const quoteId = await page
    .locator("[data-strategy-send-quote]")
    .getAttribute("data-strategy-send-quote");
  expect(quoteId).toBeTruthy();
  await page.goto(`/app/purchase-quotes/${quoteId}`);
  await expect(page.locator("[data-quote-response]")).toHaveCount(3);

  // A e B respondem; C não. A em RMB (o padrão), B em Dólar.
  await answer(page, "supplier.a@china.com", quoteId!, "210");
  await answer(page, "supplier.b@china.com", quoteId!, "185", "USD");

  // Isolamento: A abre a dele, sem o preço do B, sem o nome do B nem o cliente.
  await login(page, "supplier.a@china.com");
  await page.goto(`/app/purchase-quotes/${quoteId}`);
  await expect(page.locator("[data-quote-supplier]")).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toContain("1.85");
  expect(text).not.toContain("1,85");
  expect(text).not.toContain("Guangzhou");
  expect(text).not.toContain("Loja do João");
  expect(text).not.toContain("Estoque Wellmix");

  // O prazo vence; o Comprador vê o quadro e escolhe o B.
  await login(page, "operador@wellmix.com");
  const board = page.locator("[data-quote-choose-form]");
  await expect(async () => {
    await page.goto(`/app/purchase-quotes/${quoteId}`);
    await expect(board).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 120_000, intervals: [5000] });
  await expect(
    page.locator('[data-quote-response-state="expired"]'),
  ).toHaveCount(1);
  // A moeda de cada um chegou com o preço digitado.
  await expect(
    page.locator('[data-quote-response="fornecedor-a"]'),
  ).toContainText("RMB 2.1");
  await expect(
    page.locator('[data-quote-response="fornecedor-b"]'),
  ).toContainText("USD 1.85");
  await expect(page.locator("[data-quote-reference]")).toBeVisible();
  // Ficha técnica das respostas (dono, 20/11/2026): a caixa de cada um e as
  // caixas e o m³ pela caixa dele (4.000 ÷ 24 = 167 caixas · 14,028 m³).
  for (const id of ["fornecedor-a", "fornecedor-b"]) {
    const row = page.locator(`[data-quote-sheet-row="${id}:prod-jarra"]`);
    await expect(row.locator("[data-quote-sheet-boxes]")).toHaveText("167");
    await expect(row.locator("[data-quote-sheet-cbm]")).toHaveText(/14[,.]028/);
  }
  await board.locator('[data-quote-winner-option="fornecedor-b"]').check();
  await board.locator("[data-quote-choose]").click();
  await page.waitForURL(/[?&]chosen=1/);

  // A Diretoria aprova a vencedora: nasce a solicitação ao fornecedor.
  await login(page, "diretoria@wellmix.com");
  await page.goto(`/app/purchase-quotes/${quoteId}`);
  await page.locator("[data-quote-approve]").click();
  await page.waitForURL(/[?&]decided=approve/);
  await page.locator("[data-quote-supplier-request]").first().click();
  await page.waitForURL(/\/app\/supplier-requests\/[^/?]+/);
  await expect(page.locator("main")).toContainText(/1[,.]85/);
  const bornRequest = page.url();

  // Sem "Ver preço de compra" (dono, 15/11/2026; docs/LINHA_DE_VISAO.md,
  // seção 7): um login de Cadastro com a tela de cotações liberada à mão
  // (sem a permissão) vê o quadro com os fornecedores, a situação e as
  // condições, sem preços, total nem a última compra; a solicitação que
  // nasceu também sem o preço cotado.
  await login(page, "admin@wellmix.com");
  const plannerEmail = `cadastro.${quoteId}@wellmix.com`;
  const plannerId = await createTeamLogin(
    page,
    "Cadastro cotação",
    plannerEmail,
    ["catalog"],
  );
  await grantTeamScreen(page, plannerId, "Cadastro cotação", "quotes");
  await login(page, plannerEmail);
  await page.goto(`/app/purchase-quotes/${quoteId}`);
  await expect(page.locator("[data-quote-response]").first()).toBeVisible();
  await expect(page.locator("[data-quote-reference]")).toHaveCount(0);
  await expect(page.locator("[data-quote-price-restricted]")).toBeVisible();
  const plannerBoard = await page.locator("[data-quote-board]").innerText();
  expect(plannerBoard).not.toMatch(/1[,.]85/);
  await page.goto(bornRequest);
  await expect(page.locator("[data-supplier-table-row]").first()).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(/1[,.]85/);

  // O cliente não abre a demanda de outra empresa (a reposição da Wellmix).
  await login(page, "joao@lojista.com");
  const response = await page.goto(`/app/requests/${demandId}`);
  expect(
    response?.status() === 404 ||
      !(await page.locator("main").innerText()).includes("Jarra"),
  ).toBe(true);

  // Fichas técnicas dos fornecedores (o Cadastro; o administrador faz tudo):
  // a lista e a ficha de cada um, nosso cadastro ao lado do informado.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/supplier-sheets?review=all");
  const sheetRow = page.locator("[data-supplier-sheet-row]").first();
  await expect(sheetRow).toBeVisible();
  await sheetRow.locator("[data-open-link]").click();
  await page.waitForURL(/\/app\/supplier-sheets\/[^/?]+$/);
  await expect(
    page.locator('[data-supplier-sheet-field="masterBoxQty"]'),
  ).toContainText("24");

  await setQuoteHours(page, "24");
});
