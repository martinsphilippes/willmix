import { expect, test, type Locator } from "@playwright/test";
import { chooseOrderOrigin, login } from "./helpers";

/*
 * Campos com busca no lugar das listas de seleção com o cadastro inteiro
 * (auditoria de performance, 14/11/2026): produto (nome ou código), cliente,
 * fornecedor e destinatário de mensagem. A busca começa com 2 letras e o
 * valor escolhido vai no mesmo campo de antes, para a mesma ação.
 */

/** Digita no campo com busca e escolhe a opção pelo valor gravado. */
async function choose(
  picker: Locator,
  marker: string,
  text: string,
  value: string,
) {
  await picker.locator(`[data-${marker}-input]`).fill(text);
  const option = picker.locator(`[data-${marker}-option="${value}"]`);
  await expect(option).toBeVisible();
  await option.click();
}

test("novo kit de marketing: produto pelo código e cliente pelo nome", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/marketing/new");
  const product = page.locator('[data-product-picker="catalog"]');
  // Uma letra só: pede mais.
  await product.locator("[data-product-picker-input]").fill("u");
  await expect(product.locator("[data-product-picker-hint]")).toBeVisible();
  // Pelo código, sem caixa.
  await choose(product, "product-picker", "utl-001", "prod-jarra");
  await expect(product.locator("[data-product-picker-input]")).toHaveValue(
    "Jarra de vidro 1,5 L (UTL-001)",
  );
  await expect(page.locator('input[name="productId"]')).toHaveValue(
    "prod-jarra",
  );
  const customer = page.locator('[data-party-picker="customer"]');
  await choose(customer, "party-picker", "loja", "cliente-joao");
  await expect(page.locator('input[name="customerId"]')).toHaveValue(
    "cliente-joao",
  );
});

test("nova solicitação (Wellmix): compra para estoque, cliente e produto com a ficha", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/requests/new");
  const customerBlock = page.locator("[data-request-customer]");
  // Histórico de compras do cliente (docs/PURCHASE_HISTORY.md): sem cliente,
  // o pedido para escolher.
  const history = page.locator("[data-purchase-history]");
  await expect(history).toHaveAttribute(
    "data-purchase-history-state",
    "select",
  );
  await expect(history.locator("[data-purchase-history-select]")).toBeVisible();
  // Compra para estoque: o campo de cliente fica desligado e vai a opção de
  // estoque; o histórico some.
  await customerBlock.locator("[data-stock-option]").check();
  await expect(
    customerBlock.locator("[data-party-picker-input]"),
  ).toBeDisabled();
  await expect(page.locator('input[name="customerId"]')).toHaveValue("__stock");
  await expect(history).toHaveCount(0);
  await customerBlock.locator("[data-stock-option]").uncheck();
  await expect(history).toHaveAttribute(
    "data-purchase-history-state",
    "select",
  );
  const customerPicker = customerBlock.locator(
    '[data-party-picker="customer"]',
  );
  // Wellmix acha o cliente também pelo código do Sankhya e pelo CNPJ (dono,
  // 15/11/2026): o campo diz isso.
  await expect(
    customerPicker.locator("[data-party-picker-input]"),
  ).toHaveAttribute("placeholder", /código|code|代码/i);
  await choose(customerPicker, "party-picker", "loja", "cliente-joao");
  await expect(page.locator('input[name="customerId"]')).toHaveValue(
    "cliente-joao",
  );
  // Escolhido o cliente, o histórico dele carrega (com ou sem compras).
  await expect(history).toHaveAttribute(
    "data-purchase-history-state",
    /^(ready|empty)$/,
  );
  // Voltou a digitar sem escolher: o histórico volta a pedir o cliente.
  await customerPicker.locator("[data-party-picker-input]").fill("lo");
  await expect(history).toHaveAttribute(
    "data-purchase-history-state",
    "select",
  );
  await choose(customerPicker, "party-picker", "loja", "cliente-joao");
  await expect(history).toHaveAttribute(
    "data-purchase-history-state",
    /^(ready|empty)$/,
  );
  // Venda ao cliente: país e grupo antes do produto (docs/ORDER_TERMS.md).
  await chooseOrderOrigin(page);
  // Produto pelo nome: a ficha vem do servidor e preenche nome e descrição.
  const item = page.locator('[data-request-item="0"]');
  await choose(
    item.locator('[data-product-picker="catalog"]'),
    "product-picker",
    "boneca",
    "prod-boneca",
  );
  await expect(item.locator('[role="status"]')).toContainText(
    /catálogo|catalog|目录/,
  );
  await expect(item.locator('input[name="p0.productName"]')).toHaveValue(
    "Boneca articulada 30 cm",
  );
  await expect(item.locator('input[name="p0.productId"]')).toHaveValue(
    "prod-boneca",
  );
});

test("Superplan: o produto escolhido na busca carrega a conta", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/superplan");
  await choose(
    page.locator('[data-product-picker="active"]'),
    "product-picker",
    "boneca",
    "prod-boneca",
  );
  await page.waitForURL(/\/app\/superplan\?product=prod-boneca/);
  await expect(
    page.locator('[data-product-picker="active"] [data-product-picker-input]'),
  ).toHaveValue("Boneca articulada 30 cm (BRQ-001)");
});

test("Produtos: filtro de fornecedor pela busca", async ({ page }) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/products");
  await choose(
    page.locator('[data-party-picker="supplier"]'),
    "party-picker",
    "shenzhen",
    "fornecedor-a",
  );
  await page.getByRole("button", { name: /^(buscar|search|搜索)$/i }).click();
  await page.waitForURL(/supplier=fornecedor-a/);
  // O filtro volta preenchido com o nome do fornecedor.
  await expect(
    page.locator('[data-party-picker="supplier"] [data-party-picker-input]'),
  ).toHaveValue("Shenzhen Supplier A");
});

test("Containers e Mensagens: cliente e destinatário pela busca", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/containers");
  await choose(
    page.locator('[data-party-picker="customer"]'),
    "party-picker",
    "loja",
    "cliente-joao",
  );
  await expect(page.locator('input[name="customerId"]')).toHaveValue(
    "cliente-joao",
  );

  await page.goto("/app/messages");
  const target = page.locator('[data-chat-target="new"]');
  await target.locator("[data-chat-target-input]").fill("trans");
  // A conversa é com o login da pessoa (docs/CHAT_IDENTITY.md): ao lado do
  // nome, a empresa e o e-mail.
  const option = target.locator('[data-chat-target-option^="user:"]', {
    hasText: "transportadora@rodo.com",
  });
  await expect(option).toContainText("Trans Rodo");
  await option.click();
  await page
    .getByRole("button", { name: /abrir conversa|open conversation|打开对话/i })
    .click();
  await page.waitForURL(/\/app\/messages\?c=/);
  // Destinatário: a pessoa escolhida, com o login.
  await expect(
    page.locator('[data-chat-identity-block="recipient"]'),
  ).toContainText("transportadora@rodo.com");
});
