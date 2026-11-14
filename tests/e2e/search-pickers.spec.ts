import { expect, test, type Locator } from "@playwright/test";
import { login } from "./helpers";

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
  // Compra para estoque: o campo de cliente fica desligado e vai a opção de estoque.
  await customerBlock.locator("[data-stock-option]").check();
  await expect(
    customerBlock.locator("[data-party-picker-input]"),
  ).toBeDisabled();
  await expect(page.locator('input[name="customerId"]')).toHaveValue("__stock");
  await customerBlock.locator("[data-stock-option]").uncheck();
  await choose(
    customerBlock.locator('[data-party-picker="customer"]'),
    "party-picker",
    "loja",
    "cliente-joao",
  );
  await expect(page.locator('input[name="customerId"]')).toHaveValue(
    "cliente-joao",
  );
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
  const option = target.locator(
    '[data-chat-target-option="party:transportador"]',
  );
  // Ao lado do nome, o tipo da empresa.
  await expect(option).toContainText(/Transportador|Carrier|承运商/);
  await option.click();
  await page
    .getByRole("button", { name: /abrir conversa|open conversation|打开对话/i })
    .click();
  await page.waitForURL(/\/app\/messages\?c=/);
});
