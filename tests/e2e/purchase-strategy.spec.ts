import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  bookingSheet,
  importAndClose,
  login,
  openReplenishment,
  selectAndOpenSupplierRequest,
  createdRequestId,
} from "./helpers";

/*
 * Estratégia de compra (mapa B10?; dono, 15/11/2026; docs/PURCHASE_DEMAND.md):
 * (a) reposição aberta pelo Planner → fornecedor da última compra → pedido
 * de compra; (c) encomenda pela tela do cliente → estratégia → pedido de
 * compra com o vínculo à encomenda e a reserva para o cliente. A "última
 * compra" nasce aqui pelo caminho de sempre (book, solicitação ao
 * fornecedor, amostra, produto e pedido de compra).
 */
const TAG = `PS${Date.now().toString(36).toUpperCase()}`;
const productName = `Garrafa ${TAG}`;

async function choose(
  picker: Locator,
  marker: string,
  text: string,
  value?: string,
) {
  await picker.locator(`[data-${marker}-input]`).fill(text);
  const option = value
    ? picker.locator(`[data-${marker}-option="${value}"]`)
    : picker.locator(`[data-${marker}-option]`).first();
  await expect(option).toBeVisible();
  await option.click();
}

/** A primeira compra do produto: pedido de compra do fornecedor A a USD 1,40. */
async function firstPurchase(page: Page): Promise<string> {
  const codeA = `${TAG}-A`;
  const codeB = `${TAG}-B`;
  await login(page, "admin@wellmix.com");
  await importAndClose(
    page,
    bookingSheet("Shenzhen Supplier A", codeA, `Bottle ${TAG} 500ml`),
    "Shenzhen Supplier A",
  );
  await importAndClose(
    page,
    bookingSheet("Guangzhou Supplier B", codeB, `Bottle ${TAG} with lid`),
    "Guangzhou Supplier B",
  );
  const requestUrl = await selectAndOpenSupplierRequest(
    page,
    TAG,
    codeA,
    codeB,
    "Caixa com a marca",
  );
  const requestId = requestUrl.split("/").pop()!;
  const itemUrl = `${requestUrl}?view=item`;
  await login(page, "supplier.a@china.com");
  await page.goto(requestUrl);
  await page.locator("[data-supplier-table-answer-open]").click();
  await page.fill("[data-supplier-table-answer-price-input]", "1,40");
  await page.fill("[data-supplier-table-answer-moq]", "1000");
  await page.selectOption("[data-supplier-table-answer-incoterm]", "FOB");
  await page.click("[data-supplier-table-answer=yes]");
  await page.waitForURL(/[?&]answered=1/);
  await login(page, "admin@wellmix.com");
  await page.goto(itemUrl);
  await page.click("[data-supplier-decide=approved]");
  await page.waitForURL(/[?&]decided=approved/);
  await login(page, "supplier.a@china.com");
  await page.goto(itemUrl);
  await page.setInputFiles("[data-sampling-upload] input[type=file]", {
    name: "amostra.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });
  await page.waitForURL(/[?&]sampling=file/);
  await page.click("[data-sampling-submit]");
  await page.waitForURL(/[?&]sampling=submitted/);
  await login(page, "admin@wellmix.com");
  await page.goto(itemUrl);
  await page.click("[data-sampling-review=approve]");
  await page.waitForURL(/[?&]sampling=approved/);
  await page.fill("[data-request-product-name]", productName);
  await page.selectOption("[data-request-product-line]", "linha-utilidades");
  await page.click("[data-request-product-create]");
  await page.waitForURL(/[?&]product=created/);
  // Liberado na vitrine: o cliente encomenda pela tela dele.
  await page.goto(itemUrl);
  await page.click("[data-request-product-release]");
  await page.waitForURL(/[?&]product=released/);
  await page.goto("/app/supplier-requests?tab=closed");
  await page.locator(`[data-request-to-order="${requestId}"]`).click();
  await page.waitForURL(/[?&]pick=/);
  // O quadro "Gerar pedido de compra" abre com só esta solicitação marcada;
  // outras do mesmo fornecedor podem ser marcadas para entrar juntas.
  const group = page.locator(
    `form:has([data-purchase-candidate="${requestId}"])`,
  );
  await expect(
    group.locator(
      `[data-purchase-candidate="${requestId}"] input[type=checkbox]`,
    ),
  ).toBeChecked();
  await expect(
    group.locator(
      `[data-purchase-candidate]:not([data-purchase-candidate="${requestId}"]) input[type=checkbox]:checked`,
    ),
  ).toHaveCount(0);
  await group.locator("[data-purchase-submit]").click();
  await page.waitForURL(/\/app\/orders\/[^/?]+\?purchase=created/);
  return page.url().split("?")[0];
}

/**
 * O Comprador escolhe a estratégia do produto (uma linha por demanda; dono,
 * 18/11/2026), revisa o resumo e confirma. Devolve a estratégia criada (pedido
 * direto) ou a cotação aberta.
 */
async function chooseFor(
  page: Page,
  demandId: string,
  choice: "last_supplier" | "quote_last",
) {
  await page.goto("/app/purchase-strategy");
  const line = page.locator(`[data-strategy-line="${demandId}"]`);
  await expect(line).toBeVisible();
  await line.locator(`[data-strategy-choice="${choice}"]`).check();
  await page.locator("[data-strategy-review]").click();
  await expect(
    page.locator(`[data-strategy-summary-line="${demandId}"]`),
  ).toBeVisible();
  await page.locator("[data-strategy-confirm]").click();
  await page.waitForURL(/\/app\/purchase-strategy\/sends\/[^/?]+\?done=1/);
  const marker =
    choice === "last_supplier"
      ? "data-strategy-send-decision"
      : "data-strategy-send-quote";
  return (await page.locator(`[${marker}]`).first().getAttribute(marker))!;
}

/** Encomendas → marca a encomenda → "Enviar para cotação". */
async function sendToQuotation(page: Page, demandId: string) {
  await page.goto("/app/requests");
  await page
    .locator(`input[type="checkbox"][name="ids"][value="${demandId}"]`)
    .check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-bulk-lead="strategy"] button').click();
  await page.waitForURL(/[?&]strategySent=1/);
}

async function approve(page: Page, decisionId: string) {
  await login(page, "diretoria@wellmix.com");
  await page.goto("/app/purchase-strategy");
  const section = page.locator(`#decision-${decisionId}`);
  await expect(section).toHaveAttribute("data-strategy-decision", "pending");
  await section.locator("[data-strategy-approve]").click();
  await page.waitForURL(/[?&]decided=\d+/);
}

test("estratégia de compra: reposição e encomenda pelo fornecedor da última compra", async ({
  page,
}) => {
  test.slow();
  const firstOrder = await firstPurchase(page);
  expect(firstOrder).toContain("/app/orders/");

  // (a) Reposição aberta pelo Planner.
  await login(page, "operador@wellmix.com");
  const replenishment = await openReplenishment(page, TAG, "3000");
  // O Comprador: a reposição entra sozinha na fila; a última compra aparece
  // (fornecedor A, 1,40) e ele escolhe o pedido direto.
  await page.goto("/app/purchase-strategy");
  const line = page.locator(`[data-strategy-line="${replenishment}"]`);
  await expect(line.locator("[data-strategy-last]")).toContainText("Shenzhen");
  await expect(line.locator("[data-strategy-last]")).toContainText("1,4");
  const decisionA = await chooseFor(page, replenishment, "last_supplier");
  // A Diretoria de compras aprova.
  await approve(page, decisionA);
  // O Comprador gera o pedido com as condições da última compra.
  await login(page, "operador@wellmix.com");
  await page.goto("/app/purchase-strategy");
  // Rótulo curto do card (dono, 19/11/2026): a explicação aparece por cima,
  // inteira (nada em volta a corta; a grade rola para os lados e cortaria o
  // que sai do card).
  const tip = page
    .locator(
      `#decision-${decisionA} [data-strategy-pack-cell="master"] [data-strategy-tip]`,
    )
    .first();
  await tip.hover();
  await expect(tip.locator("[data-strategy-tip-box]")).toBeVisible();
  expect(
    await tip.evaluate((el) => {
      const box = el.querySelector<HTMLElement>("[data-strategy-tip-box]")!;
      const r = box.getBoundingClientRect();
      const card = el.closest("section")!.getBoundingClientRect();
      box.style.pointerEvents = "auto";
      const corners = [
        [r.left + 6, r.top + 6],
        [r.right - 6, r.top + 6],
        [r.left + 6, r.bottom - 6],
        [r.right - 6, r.bottom - 6],
      ];
      const onTop = corners.every(([x, y]) =>
        box.contains(document.elementFromPoint(x, y)),
      );
      box.style.pointerEvents = "";
      return onTop && r.left >= card.left - 1 && r.right <= card.right + 1;
    }),
  ).toBe(true);
  // Card compacto (dono, 19/11/2026): o formulário abre num painel.
  await page.locator(`[data-strategy-open-order="${decisionA}"]`).click();
  const orderForm = page.locator(
    `#decision-${decisionA} [data-strategy-order-form]`,
  );
  await expect(orderForm.locator("[data-strategy-order-price]")).toHaveValue(
    "1.4",
  );
  // Quantidade (peças) | Caixas master | Caixas inner | Cubagem (dono,
  // 18/11/2026): pela embalagem do Book (48 por master, 12 por inner,
  // 0,12 m³), refeitas a cada tecla com a mesma conta do servidor. A
  // reposição foi aberta com 3.000 caixas: 144.000 peças.
  const qty = orderForm.locator("[data-strategy-order-quantity]");
  const master = orderForm.locator('[data-strategy-pack="master"]');
  const inner = orderForm.locator('[data-strategy-pack="inner"]');
  const cbm = orderForm.locator('[data-strategy-pack="cbm"]');
  const warnings = orderForm.locator("[data-strategy-pack-warnings]");
  await expect(qty).toHaveValue("144.000");
  await expect(master).toContainText("3.000");
  await expect(inner).toContainText("12.000");
  await expect(cbm).toContainText("360");
  await expect(warnings).toHaveCount(0);
  // 24 peças a mais: uma caixa master a mais, com 24 de 48 (aviso).
  await qty.fill("144.024");
  await expect(master).toContainText("3.001");
  await expect(inner).toContainText("12.002");
  await expect(cbm).toContainText("360,12");
  await expect(warnings).toContainText("24 de 48");
  await qty.fill("144000");
  await expect(master).toContainText("3.000");
  await expect(warnings).toHaveCount(0);
  await orderForm.locator("[data-strategy-order]").click();
  await page.waitForURL(/\/app\/orders\/[^/?]+\?created=1/);
  await expect(page.locator("main")).toContainText(productName);

  // (c) Encomenda pela tela do cliente.
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  const item = page.locator('[data-request-item="0"]');
  await choose(
    item.locator('[data-product-picker="catalog"]'),
    "product-picker",
    TAG,
  );
  // Produto do catálogo: a quantidade já vem no pedido mínimo (em caixas).
  await expect(item.locator("[data-selection-quantity]")).not.toHaveValue("");
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await createdRequestId(page);
  const encomenda = new URL(page.url()).pathname.split("/").pop()!;
  // O cliente não vê fornecedor nem custo na encomenda.
  await expect(page.locator("main")).not.toContainText("Shenzhen");
  await login(page, "operador@wellmix.com");
  // Ainda encomenda: está na lista de Encomendas, esperando o envio.
  // (a linha abre a página do pedido; docs/ORDER_LEVEL_LISTS.md)
  await page.goto("/app/requests");
  await expect(
    page.locator(`a[href="/app/requests/batch/${encomenda}"]`).first(),
  ).toBeVisible();
  // Só entra na Estratégia de Compra depois de "Enviar para cotação".
  await page.goto("/app/purchase-strategy");
  await expect(page.locator(`[data-strategy-line="${encomenda}"]`)).toHaveCount(
    0,
  );
  await sendToQuotation(page, encomenda);
  const decisionC = await chooseFor(page, encomenda, "last_supplier");
  await approve(page, decisionC);
  await login(page, "operador@wellmix.com");
  await page.goto("/app/purchase-strategy");
  await page.locator(`[data-strategy-open-order="${decisionC}"]`).click();
  await page.locator(`#decision-${decisionC} [data-strategy-order]`).click();
  await page.waitForURL(/\/app\/orders\/[^/?]+\?created=1/);
  // A encomenda virou "pedido" e a mercadoria fica reservada para o cliente.
  await page.goto(`/app/requests/${encomenda}`);
  await expect(page.locator("main")).toContainText(/Pedido/);
  // Virou pedido: já não é da etapa de encomenda (dono, 16/11/2026), sai da
  // lista de Encomendas e segue de Pedido em diante.
  await page.goto("/app/requests");
  await expect(
    page.locator(`a[href="/app/requests/${encomenda}"]`),
  ).toHaveCount(0);
  await page.goto("/app/inventory/reservations");
  await expect(page.locator("main")).toContainText(
    /Encomenda nº \d+: pedido de compra #\d+/,
  );
  // O cliente acompanha a encomenda, sem o botão do pedido de compra.
  await login(page, "joao@lojista.com");
  await page.goto(`/app/requests/${encomenda}`);
  await expect(page.locator(`a[href^="/app/orders/"]`)).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Shenzhen");

  // (d) Cotar com o fornecedor da última compra (dono, 18/11/2026): sem
  // aprovação antes, a cotação vai só para ele; ele vê e responde no portal.
  await login(page, "operador@wellmix.com");
  const again = await openReplenishment(page, TAG, "1500");
  const quoteId = await chooseFor(page, again, "quote_last");
  await expect(
    page.locator(
      '[data-strategy-send-recipient="fornecedor-a"][data-strategy-send-recipient-status="sent"]',
    ),
  ).toBeVisible();
  await login(page, "supplier.a@china.com");
  await page.goto("/app/purchase-quotes");
  await page.locator(`[data-quote-invite="${quoteId}"] a`).first().click();
  await page.waitForURL(new RegExp(`/app/purchase-quotes/${quoteId}`));
  await expect(page.locator("[data-quote-answer-form]")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Loja do João");

  // (e) Encomenda cancelada depois da aprovação (dono, 18 e 19/11/2026): a
  // estratégia para (sem "Gerar pedido") e o Comprador a encerra.
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  const item2 = page.locator('[data-request-item="0"]');
  await choose(
    item2.locator('[data-product-picker="catalog"]'),
    "product-picker",
    TAG,
  );
  await expect(item2.locator("[data-selection-quantity]")).not.toHaveValue("");
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await createdRequestId(page);
  const cancelled = new URL(page.url()).pathname.split("/").pop()!;
  await login(page, "operador@wellmix.com");
  await sendToQuotation(page, cancelled);
  const decisionE = await chooseFor(page, cancelled, "last_supplier");
  await approve(page, decisionE);
  await login(page, "operador@wellmix.com");
  await page.goto(`/app/requests/batch/${cancelled}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator(
      `form:has(input[name="ids"][value="${cancelled}"]) button[type="submit"]`,
    )
    .first()
    .click();
  await page.waitForURL(/[?&]deleted=1/);
  await page.goto("/app/purchase-strategy");
  const stopped = page.locator(`#decision-${decisionE}`);
  await expect(stopped).toHaveAttribute("data-strategy-blocked", "1");
  await expect(stopped.locator("[data-strategy-order-form]")).toHaveCount(0);
  // Card mais baixo (dono, 19/11/2026): a observação fica numa caixa.
  await stopped.locator("[data-strategy-close-open]").click();
  page.once("dialog", (dialog) => dialog.accept());
  await stopped.locator("[data-strategy-close]").click();
  await page.waitForURL(/[?&]closed=\d+/);
  await expect(page.locator("[data-strategy-closed]")).toBeVisible();
  await expect(page.locator(`#decision-${decisionE}`)).toHaveCount(0);
});
