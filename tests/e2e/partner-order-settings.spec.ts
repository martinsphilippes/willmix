import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Condição de pagamento, início da produção e fatura no cadastro de quem pode
 * ser o fornecedor do pedido (docs/PARTNER_FAMILIES.md, decisão 1): Trading,
 * Supplier e Factory vencem a cotação de compra, viram o fornecedor do pedido
 * e, sem a condição de pagamento, o pedido ficava parado esperando o sinal ou
 * a conta corrente. O administrador grava os três quadros na ficha dele.
 */

const tag = Date.now().toString(36);

/** Cadastra um parceiro do tipo e devolve o endereço da ficha dele. */
async function newPartner(page: Page, type: string, name: string) {
  await page.goto(`/app/parties/new?type=${type}`);
  await expect(page.locator("[data-party-type]")).toHaveValue(type);
  await page.fill('input[name="name"]', name);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?]+$/);
  return new URL(page.url()).pathname;
}

for (const [type, label] of [
  ["trading", "Trading"],
  ["supplier_partner", "Supplier"],
  ["factory", "Factory"],
] as const) {
  test(`${label}: grava a condição de pagamento, o início da produção e a fatura`, async ({
    page,
  }) => {
    await login(page, "admin@wellmix.com");
    const path = await newPartner(page, type, `${label} Pedido ${tag}`);

    // Início da produção.
    const start = page.locator("[data-production-start-form]");
    await start.locator('input[name="productionStartDays"]').fill("7");
    await start.getByRole("button").click();
    await page.waitForURL(/saved=production/);
    await expect(
      page.getByText("Prazo de início da produção salvo."),
    ).toBeVisible();
    await expect(
      page
        .locator("[data-production-start-form]")
        .locator('input[name="productionStartDays"]'),
    ).toHaveValue("7");

    // Fatura ativa.
    const invoice = page.locator("[data-invoice-days-form]");
    await invoice.locator('input[name="invoiceDays"]').fill("25");
    await invoice.getByRole("button").click();
    await page.waitForURL(/saved=invoice/);
    await expect(page.getByText("Prazo da fatura salvo.")).toBeVisible();
    await expect(
      page
        .locator("[data-invoice-days-form]")
        .locator('input[name="invoiceDays"]'),
    ).toHaveValue("25");

    // Condição de pagamento: vazia antes, gravada depois.
    const terms = page.locator("[data-payment-terms]");
    await expect(terms).toBeVisible();
    await terms.locator('[data-terms-preset="0"]').click();
    await terms.getByRole("button", { name: "Salvar condição" }).click();
    await page.waitForURL(/saved=terms/);
    await expect(page.getByText("Condição de pagamento salva.")).toBeVisible();
    await expect(page.locator("[data-terms-sum]")).toHaveAttribute(
      "data-terms-sum",
      "100",
    );

    // Recarregada, a ficha mantém os três.
    await page.goto(path);
    await expect(
      page
        .locator("[data-production-start-form]")
        .locator('input[name="productionStartDays"]'),
    ).toHaveValue("7");
    await expect(
      page
        .locator("[data-invoice-days-form]")
        .locator('input[name="invoiceDays"]'),
    ).toHaveValue("25");
    await expect(page.locator('[data-term-row="1"]')).toBeVisible();
  });
}
