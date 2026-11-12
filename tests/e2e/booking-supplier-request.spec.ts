import { expect, test } from "@playwright/test";
import {
  bookingSheet,
  importAndClose,
  login,
  selectAndOpenSupplierRequest,
} from "./helpers";

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

/** Marca única por execução: a busca acha só os itens deste teste. */
const TAG = `E2E${Date.now().toString(36).toUpperCase()}`;

test("booking → seleção de itens → solicitação ao fornecedor → produto", async ({
  page,
}) => {
  const codeA = `${TAG}-A`;
  const codeB = `${TAG}-B`;

  // 1. Dois bookings de fornecedores diferentes, com o mesmo tipo de item.
  await login(page, "admin@wellmix.com");
  await importAndClose(
    page,
    bookingSheet("Shenzhen Supplier A", codeA, `Glass cup ${TAG} 350ml`),
    "Shenzhen Supplier A",
    { checkSupplierPicker: true },
  );
  await importAndClose(
    page,
    bookingSheet("Guangzhou Supplier B", codeB, `Glass cup ${TAG} with handle`),
    "Guangzhou Supplier B",
    { checkSupplierPicker: true },
  );
  await page.goto("/app/booking");
  await page.fill("[data-booking-lots-search]", codeA.slice(0, 6));
  await expect(page.locator("[data-booking-lot-row]").first()).toBeVisible();

  // 2. Seleção: a busca por parte da descrição traz os dois lado a lado;
  // escolhe o A, com o B de alternativa, e abre a solicitação.
  const requestUrl = await selectAndOpenSupplierRequest(
    page,
    TAG,
    codeA,
    codeB,
    "Cor âmbar e caixa com a marca",
  );
  const itemUrl = `${requestUrl}?view=item`;
  await expect(page.locator("[data-supplier-request-alternative]")).toHaveCount(
    1,
  );
  await expect(page.locator("[data-supplier-request-needs]")).toContainText(
    "Cor âmbar",
  );
  // A resposta é do fornecedor: a Wellmix (admin) não responde por ele e,
  // antes da resposta, só cancela ou manda mensagem.
  await page.goto(itemUrl);
  await expect(page.locator("[data-supplier-answer-form]")).toHaveCount(0);
  await expect(page.locator("[data-supplier-decide-waiting]")).toBeVisible();
  await expect(page.locator("[data-supplier-decide=cancelled]")).toBeVisible();
  await expect(page.locator("[data-supplier-decide=declined]")).toHaveCount(0);
  await expect(page.locator("[data-supplier-decide=approved]")).toHaveCount(0);
  await page.goto(requestUrl);
  await expect(page.locator("[data-supplier-table-answer-open]")).toHaveCount(
    0,
  );
  await expect(page.locator("[data-supplier-table-message]")).toBeVisible();

  // 3. O fornecedor A vê primeiro a tabela dos produtos da solicitação e
  // responde "sim" na caixa rápida da linha, sem a alternativa; o B não abre.
  await login(page, "supplier.a@china.com");
  await page.goto(requestUrl);
  await expect(page.locator("[data-supplier-table-row]")).toHaveCount(1);
  await expect(page.locator("[data-supplier-request-alternative]")).toHaveCount(
    0,
  );
  await page.locator("[data-supplier-table-answer-open]").click();
  await page.fill("[data-supplier-table-answer-price-input]", "1,40");
  await page.fill("[data-supplier-table-answer-moq]", "2000");
  await page.selectOption("[data-supplier-table-answer-incoterm]", "EXW");
  await page.click("[data-supplier-table-answer=yes]");
  await page.waitForURL(/[?&]answered=1/);
  const row = page.locator("[data-supplier-table-row]");
  await expect(row.locator("[data-supplier-table-answer-price]")).toContainText(
    /1[.,]4\b/,
  );
  await expect(row.locator("[data-supplier-table-incoterm]")).toHaveText("EXW");
  // Condições iniciais = as do booking; finais = a última proposta enviada.
  await expect(
    row.locator("[data-supplier-table-initial-price]"),
  ).toContainText(/1[.,]25\b/);
  await expect(row.locator("[data-supplier-table-final-state]")).toBeVisible();

  await login(page, "supplier.b@china.com");
  const other = await page.goto(requestUrl);
  expect(other?.status()).toBe(404);

  // 3b. Negociação (docs/SUPPLIER_REQUESTS.md, "Negociação"): a Wellmix
  // devolve com contraproposta; até o fornecedor responder, não aprova.
  // A Wellmix também vê a tabela primeiro; a contraproposta fica no produto.
  await login(page, "admin@wellmix.com");
  await page.goto(requestUrl);
  await expect(page.locator("[data-supplier-table-row]")).toHaveCount(1);
  await expect(page.locator("[data-supplier-request-sla]")).toBeVisible();
  await page.goto(itemUrl);
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
  // Linha do tempo: abertura, resposta, contraproposta e a mensagem.
  await expect(page.locator('[data-timeline-entry="proposal"]')).toContainText(
    "Fechamos a 1,30?",
  );
  await expect(page.locator("[data-timeline-entry]")).toHaveCount(4);
  // Chat flutuante: a mensagem da tabela está lá; manda outra por ele.
  await page.click("[data-request-chat-toggle]");
  const chat = page.locator("[data-request-chat]");
  await expect(chat.locator("[data-request-chat-message]")).toHaveCount(1);
  await chat.locator("[data-negotiation-message-text]").fill("Foto amanhã.");
  await chat.locator("[data-negotiation-message-submit]").click();
  await expect(chat.locator("[data-request-chat-message]")).toHaveCount(2);
  // Fecha o chat flutuante: com o menu lateral, ele cobre os botões da resposta.
  await page.click("[data-request-chat-toggle]");
  await page.click("[data-negotiation-respond=accept]");
  await page.waitForURL(/[?&]negotiation=accept/);
  await expect(page.locator('[data-timeline-entry="accept"]')).toBeVisible();
  await expect(page.locator("[data-supplier-answer]")).toContainText(
    /1[.,]3\b/,
  );
  // Ficha negociada: o preço combinado, com o do booking riscado ao lado;
  // o Superplan refeito é só da Wellmix.
  await expect(page.locator('[data-negotiated-value="price"]')).toContainText(
    /1[.,]3\b/,
  );
  await expect(page.locator('[data-negotiated-before="price"]')).toContainText(
    /1[.,]25\b/,
  );
  await expect(page.locator("[data-negotiated-superplan]")).toHaveCount(0);

  // 4. A Wellmix aprova e cria o produto (fora da vitrine até liberar).
  await login(page, "admin@wellmix.com");
  await page.goto(itemUrl);
  await expect(page.locator("[data-negotiated-superplan]")).toBeVisible();
  await expect(page.locator("[data-alternative-open]")).toHaveCount(1);
  // Nova referência: abre a solicitação para a alternativa (fornecedor B);
  // as duas ficam ligadas.
  await page.locator("[data-alternative-open]").click();
  await page.waitForURL(/[?&]created=1/);
  const altUrl = page.url().split("?")[0];
  expect(altUrl).not.toBe(requestUrl);
  await page.goto(itemUrl);
  await expect(page.locator("[data-linked-request]")).toHaveCount(1);
  await page.click("[data-supplier-decide=approved]");
  await page.waitForURL(/[?&]decided=approved/);
  // Aprovada esta, a ligada pede resposta: continuar negociando ou recusar.
  await expect(page.locator("[data-linked-approved-ask]")).toBeVisible();
  await page
    .locator("[data-linked-asked] [data-linked-resolve=decline]")
    .click();
  await page.waitForURL(/[?&]linked=decline/);
  await expect(page.locator("[data-linked-asked]")).toHaveCount(0);
  await page.goto(`${altUrl}?view=item`);
  await expect(page.locator("[data-linked-ask]")).toHaveCount(0);
  await page.goto(itemUrl);
  // A aprovação abre a amostragem, esperando o responsável pelo booking.
  await expect(page.locator("[data-sampling=pending]")).toBeVisible();
  await expect(page.locator("[data-sampling-upload]")).toHaveCount(0);

  // 4.1 Amostragem: o responsável sobe uma foto da amostra e envia.
  await login(page, "supplier.a@china.com");
  await page.goto(itemUrl);
  await page.setInputFiles("[data-sampling-upload] input[type=file]", {
    name: "amostra.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });
  await page.waitForURL(/[?&]sampling=file/);
  await expect(page.locator("[data-sampling-file]")).toHaveCount(1);
  await page.click("[data-sampling-submit]");
  await page.waitForURL(/[?&]sampling=submitted/);
  await expect(page.locator("[data-sampling=submitted]")).toBeVisible();

  // 4.2 A Wellmix valida a amostra.
  await login(page, "admin@wellmix.com");
  await page.goto(itemUrl);
  await expect(page.locator("[data-sampling-file]")).toHaveCount(1);
  await page.click("[data-sampling-review=approve]");
  await page.waitForURL(/[?&]sampling=approved/);
  await expect(page.locator("[data-sampling=approved]")).toBeVisible();
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
  await page.goto(itemUrl);
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
  // Lista: produtos distintos e a finalização (aprovada) com o SLA.
  await expect(page.locator("[data-supplier-request-count]")).toBeVisible();
  await expect(
    page.locator(
      `[data-supplier-request-finished="${requestUrl.split("/").pop()}"]`,
    ),
  ).not.toHaveText("—");
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
