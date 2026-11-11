import { expect, test, type Page } from "@playwright/test";
import { xlsxBytes } from "../unit/xlsx-fixture";

/*
 * Do booking ao produto (docs/BOOKING.md, seção 0, e docs/SUPPLIER_REQUESTS.md):
 * a Wellmix sobe as planilhas de dois fornecedores e fecha os bookings (o
 * Superplan analisa os itens); na Seleção de itens compara os parecidos e
 * abre a solicitação ao fornecedor do escolhido, com o outro de
 * alternativa; o fornecedor responde no portal sem ver a alternativa, o
 * outro fornecedor não abre a solicitação; a Wellmix devolve com
 * contraproposta e o fornecedor aceita; a Wellmix aprova, cria o produto
 * (fora da vitrine até liberar), grava o CODPROD do Sankhya e gera o pedido
 * de compra (com as três raias na Preparação).
 */

const PASSWORD = "wellmix123";
/** Marca única por execução: a busca acha só os itens deste teste. */
const TAG = `E2E${Date.now().toString(36).toUpperCase()}`;

const HEADER = [
  "DATE",
  "LOCAL",
  "SUPPLIER NAME",
  "SKU/FACTORY ITEM CODE",
  "DESCRIPTION",
  "FOB/EXW",
  "CONI US $/RMB",
  "PRICE",
  "QTY/BOX",
  "QTY/INNER",
  "N.W./PC",
  "G.W./PC",
  "CBM",
  "SIZE(CM) LENGTH",
  "SIZE(CM) WIDTH",
  "SIZE(CM) HEIGHT",
  "CAPACITY(ML)",
  "PACKAGE",
  "MATERIAL",
  "MOQ",
  "PURCHASE QTY IN PCS",
];

/** Planilha de booking de um fornecedor do cadastro de demonstração, com um item. */
function sheet(supplier: string, code: string, description: string) {
  const row = [
    "2026.10.13",
    "Yiwu",
    supplier,
    code,
    description,
    "FOB",
    "USD",
    "1.25",
    "48",
    "12",
    "0.3",
    "0.35",
    "0.12",
    "10",
    "8",
    "20",
    "350",
    "color box",
    "glass",
    "1000",
    "3000",
  ];
  return {
    name: `booking-${code}.xlsx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(xlsxBytes([{ name: "BOOKING", cells: [HEADER, row] }])),
  };
}

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/e-mail|email|邮箱/i).fill(email);
  await page.getByLabel(/senha|password|密码/i).fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await page.waitForURL(/\/app/);
}

/** Sobe a planilha e fecha o booking (fornecedor e data vêm dela). */
async function importAndClose(
  page: Page,
  file: ReturnType<typeof sheet>,
  supplierName: string,
) {
  await page.goto("/app/booking/import");
  await page
    .locator("[data-booking-import-form] input[type=file]")
    .setInputFiles(file);
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  // Fornecedor do cadastro (tem login): nenhum aviso de "sem acesso".
  await expect(page.locator("[data-supplier-no-login]")).toHaveCount(0);
  // Fornecedor com busca: digitar filtra a lista até sobrar o que se quer.
  const combo = page.locator(
    "[data-booking-lot-supplier] input[role=combobox]",
  );
  await expect(combo).toHaveValue(new RegExp(supplierName));
  await combo.click();
  await combo.fill(supplierName.toLowerCase().split(" ").slice(0, 2).join(" "));
  const options = page.locator("[data-booking-lot-supplier] [role=option]");
  await expect(options.first()).toContainText(supplierName);
  await combo.fill("zzz-nada-casa");
  await expect(options).toHaveCount(0);
  await combo.press("Escape");
  await expect(combo).toHaveValue(new RegExp(supplierName));
  // Trocar e voltar: cada escolha grava sozinha.
  await combo.click();
  await options.first().click();
  await expect(
    page.locator('[data-booking-lot-supplier] [data-booking-row-note="saved"]'),
  ).toBeVisible();
  await combo.click();
  await combo.fill(supplierName);
  await options.filter({ hasText: supplierName }).first().click();
  await expect(combo).toHaveValue(new RegExp(supplierName));
  await expect(
    page.locator('[data-booking-lot-supplier] [data-booking-row-note="saved"]'),
  ).toBeVisible();
  // NCM obrigatório (docs/BOOKING.md, "NCM do item"): sem produto parecido
  // no cadastro, o item fica com o despachante; a Wellmix preenche aqui.
  const ncmInputs = page.locator("input[data-booking-item-ncm]");
  for (let i = 0; i < (await ncmInputs.count()); i++) {
    const input = ncmInputs.nth(i);
    if (await input.inputValue()) continue;
    await input.fill("7013.37.00");
    await input.press("Enter");
    await expect(
      page.locator('[data-booking-row-note="saved"]').nth(i),
    ).toBeVisible();
  }
  await page.click("[data-booking-lot-close-submit]");
  await page.waitForURL(/[?&]closed=1/);
  await expect(page.locator("[data-booking-item-analysis]")).toHaveCount(1);
}

test("booking → seleção de itens → solicitação ao fornecedor → produto", async ({
  page,
}) => {
  const codeA = `${TAG}-A`;
  const codeB = `${TAG}-B`;

  // 1. Dois bookings de fornecedores diferentes, com o mesmo tipo de item.
  await login(page, "admin@wellmix.com");
  await importAndClose(
    page,
    sheet("Shenzhen Supplier A", codeA, `Glass cup ${TAG} 350ml`),
    "Shenzhen Supplier A",
  );
  await importAndClose(
    page,
    sheet("Guangzhou Supplier B", codeB, `Glass cup ${TAG} with handle`),
    "Guangzhou Supplier B",
  );
  await page.goto("/app/booking");
  await page.fill("[data-booking-lots-search]", codeA.slice(0, 6));
  await expect(page.locator("[data-booking-lot-row]").first()).toBeVisible();

  // 2. Seleção: a busca por parte da descrição traz os dois lado a lado.
  await page.goto(`/app/booking/selection?q=${encodeURIComponent(TAG)}`);
  await expect(page.locator("[data-selection-item]")).toHaveCount(2);
  // A aba Itens só agrupa; a solicitação abre no grupo (aba Seleção).
  await page.locator("input[data-basket-all]").check();
  await page.click("[data-selection-group]");
  await page.waitForURL(/tab=selection&ids=/);
  await expect(page.locator("[data-selection-item]")).toHaveCount(2);
  const rowA = page.locator("[data-selection-item]", { hasText: codeA });
  const rowB = page.locator("[data-selection-item]", { hasText: codeB });
  await rowA.locator("input[data-selection-choose]").check();
  await rowB.locator("input[data-selection-alternative]").check();
  await page.fill("[data-selection-needs]", "Cor âmbar e caixa com a marca");
  await page.click("[data-selection-submit]");
  await page.waitForURL(/\/app\/supplier-requests\/[^/?]+\?created=1/);
  const requestUrl = page.url().split("?")[0];
  await expect(page.locator("[data-supplier-request-alternative]")).toHaveCount(
    1,
  );
  await expect(page.locator("[data-supplier-request-needs]")).toContainText(
    "Cor âmbar",
  );

  // 3. O fornecedor A vê primeiro a tabela dos produtos da solicitação e
  // responde "sim" na caixa rápida da linha, sem a alternativa; o B não abre.
  await login(page, "supplier.a@china.com");
  await page.goto(requestUrl);
  await expect(page.locator("[data-supplier-table-row]")).toHaveCount(1);
  await expect(page.locator("[data-supplier-request-alternative]")).toHaveCount(
    0,
  );
  await page.locator("[data-supplier-table-answer-open]").click();
  await page.fill("[data-supplier-table-answer-price]", "1,40");
  await page.click("[data-supplier-table-answer=yes]");
  await page.waitForURL(/[?&]answered=1/);
  await expect(page.locator("[data-supplier-table-answer-text]")).toContainText(
    /1[.,]4\b/,
  );

  await login(page, "supplier.b@china.com");
  const other = await page.goto(requestUrl);
  expect(other?.status()).toBe(404);

  // 3b. Negociação (docs/SUPPLIER_REQUESTS.md, "Negociação"): a Wellmix
  // devolve com contraproposta; até o fornecedor responder, não aprova.
  await login(page, "admin@wellmix.com");
  await page.goto(requestUrl);
  await expect(page.locator("[data-supplier-request-sla]")).toBeVisible();
  const propose = page.locator("[data-negotiation-propose-form]");
  await propose.locator("[data-negotiation-price]").fill("1,30");
  await propose.locator("[data-negotiation-text]").fill("Fechamos a 1,30?");
  await page.click("[data-negotiation-propose-submit]");
  await page.waitForURL(/[?&]negotiation=proposal/);
  await expect(page.locator("[data-supplier-decide=approved]")).toHaveCount(0);
  await expect(page.locator("[data-supplier-decide-blocked]")).toBeVisible();

  // O fornecedor manda uma mensagem e aceita: o preço proposto vira a resposta.
  // A mensagem sai pela caixa rápida da tabela; "Abrir produto" leva à tela
  // completa, onde ele aceita a contraproposta.
  await login(page, "supplier.a@china.com");
  await page.goto(requestUrl);
  await expect(page.locator("[data-supplier-table-pending]")).toBeVisible();
  await page.locator("[data-supplier-table-message]").click();
  await page.fill("[data-supplier-table-message-text]", "Ok, segue a caixa.");
  await page.click("[data-supplier-table-message-submit]");
  await page.waitForURL(/[?&]negotiation=message/);
  await page.locator("[data-supplier-table-open]").click();
  await page.waitForURL(/[?&]view=item/);
  await expect(
    page.locator('[data-negotiation-event="proposal"]'),
  ).toContainText("Fechamos a 1,30?");
  await page.click("[data-negotiation-respond=accept]");
  await page.waitForURL(/[?&]negotiation=accept/);
  await expect(page.locator("[data-negotiation-event]")).toHaveCount(3);
  await expect(page.locator("[data-supplier-answer]")).toContainText(
    /1[.,]3\b/,
  );

  // 4. A Wellmix aprova e cria o produto (fora da vitrine até liberar).
  await login(page, "admin@wellmix.com");
  await page.goto(requestUrl);
  await page.click("[data-supplier-decide=approved]");
  await page.waitForURL(/[?&]decided=approved/);
  await page.fill("[data-request-product-name]", `Copo de vidro ${TAG}`);
  await page.selectOption("[data-request-product-line]", { index: 1 });
  await page.click("[data-request-product-create]");
  await page.waitForURL(/[?&]product=created/);
  const productHref = await page
    .locator("[data-request-product-open]")
    .getAttribute("href");
  expect(productHref).toMatch(/^\/app\/products\/[^/]+$/);
  const showcaseHref = productHref!.replace("/app/products/", "/app/explore/");

  await login(page, "joao@lojista.com");
  expect((await page.goto(showcaseHref))?.status()).toBe(404);

  // 5. Libera na vitrine e grava o CODPROD (sem Sankhya: "não conferido").
  await login(page, "admin@wellmix.com");
  await page.goto(requestUrl);
  await page.click("[data-request-product-release]");
  await page.waitForURL(/[?&]product=released/);
  await page.fill("[data-request-product-erp-input]", "40123");
  await page.click("[data-request-product-erp-save]");
  await page.waitForURL(/[?&]erp=(checked|unchecked)/);
  await expect(page.locator("[data-request-product-erp-code]")).toContainText(
    "40123",
  );
  await page.goto(productHref!);
  await expect(page.locator("[data-product-erp-code]")).toHaveAttribute(
    "data-product-erp-code",
    "40123",
  );

  await login(page, "joao@lojista.com");
  expect((await page.goto(showcaseHref))?.status()).toBe(200);

  // 6. Pedido de compra (docs/PURCHASE_ORDER.md): o produto aprovado vira o
  // pedido do fornecedor, que já abre as três raias na Preparação.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/supplier-requests");
  const requestId = requestUrl.split("/").pop()!;
  const group = page.locator(
    `form:has([data-purchase-candidate="${requestId}"])`,
  );
  await expect(group).toBeVisible();
  await group.locator("[data-purchase-submit]").click();
  await page.waitForURL(/\/app\/orders\/[^/?]+\?purchase=created/);
  await expect(
    page.getByText("Preparação, arte e certificação").first(),
  ).toBeVisible();
  await expect(page.getByText(/Faca \(die cut\)/).first()).toBeVisible();
});
