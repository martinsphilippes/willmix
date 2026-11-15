import { expect, test, type Page } from "@playwright/test";
import {
  chooseOrderOrigin,
  fillCustomerContacts,
  fillOrderTerms,
  login,
} from "./helpers";

/*
 * Nova solicitação da Wellmix para o cliente (dono, 15/11/2026;
 * docs/ORDER_TERMS.md): o bloco do cliente no lugar da busca por foto ou
 * link (contatos às cegas na primeira vez; depois, com "Editar"), as
 * condições do pedido (tipo de operação, formato de venda, entrega, país >
 * grupo) e o aviso de que não há devoluções.
 */

async function chooseCustomer(page: Page, text: string, id: string) {
  const picker = page.locator(
    '[data-request-customer] [data-party-picker="customer"]',
  );
  await picker.locator("[data-party-picker-input]").fill(text);
  await picker.locator(`[data-party-picker-option="${id}"]`).click();
}

async function pickDoll(page: Page) {
  const row = page.locator('[data-request-item="0"]');
  const product = row.locator('[data-product-picker="catalog"]');
  await product.locator("[data-product-picker-input]").fill("boneca");
  await product.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(row.locator('[role="status"]').first()).toBeVisible();
  await row
    .locator("[data-rounds-generator] [data-generate-total]")
    .fill("100");
}

async function send(page: Page) {
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await page.waitForURL(/\/app\/requests\/(?!new|batch)[^/?]+$/);
}

test("Nova solicitação (Wellmix): bloco do cliente, condições do pedido e aviso", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  // Um cliente novo (sem contatos atualizados pelo portal).
  const tag = Date.now().toString(36);
  await page.goto("/app/parties/new?type=customer");
  await page.fill('input[name="name"]', `Mercado ${tag}`);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?]+$/);
  const customerId = new URL(page.url()).pathname.split("/").pop()!;

  await page.goto("/app/requests/new");
  // O bloco do cliente no lugar da busca por foto ou link.
  await expect(page.locator("input[name=url]")).toHaveCount(0);
  const contacts = page.locator("[data-customer-contacts]");
  await expect(contacts).toHaveAttribute("data-customer-contacts", "pick");
  // Aviso de que não há devoluções, bem visível.
  await expect(page.locator("[data-order-terms-disclaimer]")).toContainText(
    "não há devoluções previstas para esta operação",
  );
  // Sem país e grupo, a busca de produto espera.
  await expect(page.locator("[data-request-origin-missing]")).toBeVisible();

  // Cliente sem contatos pelo portal: às cegas (campos vazios).
  await chooseCustomer(page, tag, customerId);
  await expect(contacts).toHaveAttribute("data-customer-contacts", "blind");
  await expect(
    contacts.locator('input[name="contact.partner.email"]'),
  ).toHaveValue("");

  // Formato Wellmix pede o nível; o grupo vem pelo país.
  await fillOrderTerms(page, {
    operation: "ts",
    format: "wellmix",
    tier: "hiper",
  });
  await page
    .locator("[data-order-terms-carrier]")
    .selectOption("portal:transportador");
  await expect(page.locator("[data-request-origin-missing]")).toHaveCount(0);
  await pickDoll(page);

  // Contato igual ao do vendedor (o próprio login): recusado.
  await fillCustomerContacts(page, "mercado-maria");
  await contacts
    .locator('input[name="contact.buyer.email"]')
    .fill("admin@wellmix.com");
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await page.waitForURL(/error=contacts_same_as_seller/);
  await expect(page.locator("main")).toContainText(
    "não podem ser iguais aos do representante ou vendedor",
  );

  // Tudo certo: grava a solicitação e os contatos.
  await chooseCustomer(page, tag, customerId);
  await fillOrderTerms(page, { operation: "sale", format: "wd" });
  await pickDoll(page);
  await fillCustomerContacts(page, "mercado-maria");
  await send(page);
  const terms = page.locator("[data-request-order-terms]");
  await expect(terms).toContainText("Venda");
  await expect(terms).toContainText("WD");
  await expect(terms).toContainText("CHINA");
  await expect(terms).toContainText("Brinquedos");

  // Próxima venda: os contatos aparecem, com "Editar".
  await page.goto("/app/requests/new");
  await chooseCustomer(page, tag, customerId);
  await expect(contacts).toHaveAttribute("data-customer-contacts", "known");
  await expect(
    contacts.locator('[data-customer-contact-view="buyer"]'),
  ).toContainText("buyer@mercado-maria.com");
  await contacts.locator("[data-customer-contacts-edit]").click();
  await expect(contacts).toHaveAttribute("data-customer-contacts", "edit");
  await expect(
    contacts.locator('input[name="contact.buyer.email"]'),
  ).toHaveValue("buyer@mercado-maria.com");
  await contacts.locator("[data-customer-contacts-cancel]").click();
  await expect(contacts).toHaveAttribute("data-customer-contacts", "known");

  // Sem editar, envia direto (os contatos já estão no cadastro).
  await chooseOrderOrigin(page);
  await page.locator('[data-order-terms-operation-option="sale"]').check();
  await page.locator('[data-order-terms-format-option="wd"]').check();
  await pickDoll(page);
  await send(page);

  // Compra para estoque: sem bloco do cliente nem condições.
  await page.goto("/app/requests/new");
  await page.locator("[data-request-customer] [data-stock-option]").check();
  await expect(contacts).toHaveAttribute("data-customer-contacts", "stock");
  await expect(page.locator('[data-order-terms="stock"]')).toBeVisible();
  await expect(page.locator("[data-request-origin-missing]")).toHaveCount(0);
});

test("Nova solicitação do próprio cliente: segue com a busca por foto ou link", async ({
  page,
}) => {
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  await expect(page.locator("input[name=url]")).toBeVisible();
  await expect(page.locator("[data-customer-contacts]")).toHaveCount(0);
  await expect(page.locator("[data-order-terms]")).toHaveCount(0);
});
