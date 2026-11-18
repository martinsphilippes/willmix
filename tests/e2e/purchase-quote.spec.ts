import { expect, test, type Page } from "@playwright/test";
import {
  createTeamLogin,
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
 * Os fornecedores B e C passam a atender a família de utilidades (Grupo de
 * produto (família) no cadastro; docs/PARTNER_FAMILIES.md): entram na
 * cotação das linhas dela.
 */
async function serveUtilities(page: Page, supplierId: string) {
  await page.goto(`/app/suppliers/${supplierId}?tab=info`);
  await page.locator('[data-party-family="20000000"]').check();
  await page.locator("[data-party-families-save]").click();
  await page.waitForURL(/[?&]families=saved/);
}

/**
 * Famílias atendidas (dono, 18/11/2026): o fornecedor fica vinculado à
 * família das utilidades domésticas e aparece na Estratégia de Compra.
 */
async function serveFamily(page: Page, supplierId: string) {
  await page.goto(`/app/suppliers/${supplierId}?tab=info`);
  const box = page.locator('[data-partner-family="fm:UTILIDADES_DOMESTICAS"]');
  if (!(await box.isChecked())) {
    await box.check();
    await page.locator("[data-partner-families-save]").click();
    await page.waitForURL(/[?&]families=saved/);
  }
}

async function answer(
  page: Page,
  email: string,
  quoteId: string,
  price: string,
) {
  await login(page, email);
  await page.goto("/app/purchase-quotes");
  await page.locator(`[data-quote-invite="${quoteId}"] a`).click();
  await page.waitForURL(new RegExp(`/app/purchase-quotes/${quoteId}`));
  const form = page.locator("[data-quote-answer-form]");
  await form.locator('[data-quote-price="prod-jarra"]').fill(price);
  await form.locator("[data-quote-lead]").fill("35");
  await form.locator("[data-quote-port]").fill("Ningbo");
  await form.locator("[data-quote-submit]").click();
  await page.waitForURL(/[?&]answered=1/);
}

test("cotação de compra: dois respondem, um não; Comprador escolhe, Diretoria aprova, nasce a solicitação ao fornecedor", async ({
  page,
}) => {
  test.slow();
  await setQuoteHours(page, "0.02");
  await serveUtilities(page, "fornecedor-b");
  await serveUtilities(page, "fornecedor-c");
  for (const id of ["fornecedor-a", "fornecedor-b", "fornecedor-c"])
    await serveFamily(page, id);

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

  // A e B respondem; C não.
  await answer(page, "supplier.a@china.com", quoteId!, "2,10");
  await answer(page, "supplier.b@china.com", quoteId!, "1,85");

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
  await expect(page.locator("[data-quote-reference]")).toBeVisible();
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

  await setQuoteHours(page, "24");
});
