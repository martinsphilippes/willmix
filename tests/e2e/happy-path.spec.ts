import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "wellmix123";
const png = {
  name: "foto.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
};
const pdf = {
  name: "doc.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n%fake\n"),
};

/** Resposta da RFQ: ficha de compra completa (campos obrigatórios), sem fotos. */
async function fillQuoteSheet(page: Page, price: string) {
  await page.fill("input[name=supplierName]", "Supplier Ltd");
  await page.selectOption("select[name=incoterm]", "FOB");
  await page.selectOption("select[name=currency]", "USD");
  await page.fill("[data-money=price]", price);
  await page.fill("input[name=moq]", "500");
  await page.fill("input[name=masterCartonQty]", "24");
  await page.fill("input[name=cbmPerCarton]", "0.06");
  await page.fill("input[name=packageType]", "COLOR BOX");
  await page.fill("input[name=heightCm]", "30");
  await page.fill("input[name=widthCm]", "40");
  await page.fill("input[name=lengthCm]", "50");
  await page.fill("input[name=netWeightPcKg]", "0.4");
  await page.fill("input[name=grossWeightPcKg]", "0.5");
  await page.fill("input[name=colorAssortment]", "WHITE");
  // Cor Pantone pela tabela (busca por número → RGB).
  await page.locator("[data-pantone-picker][data-ready]").waitFor();
  await page.fill("[data-pantone-search]", "185 C");
  await page.getByRole("option", { name: /PANTONE 185 C/ }).click();
  await expect(page.locator('[data-pantone-chip="185 C"]')).toBeVisible();
  await page.fill("input[name=material]", "GLASS");
  await page.fill("input[name=productionStartAt]", "2026-11-02");
  await page.locator("[data-sheet-schedule][data-ready]").waitFor();
  await page.fill("input[name=lot1Interval]", "30");
  await page.fill("input[name=lot1Cartons]", "50");
  // Conta ao vivo e sugestão para fechar o container (sem aplicar).
  await expect(page.locator("[data-sheet-totals]")).toContainText("1.200");
  await expect(page.locator("[data-fill-suggestion]")).toHaveAttribute(
    "data-fill-suggestion",
    "partial",
  );
  await expect(page.locator("[data-fill-apply=add]")).toBeVisible();
  // Salva o rascunho (os botões ficam no fim, depois das fotos; o `form` liga ao formulário).
  await Promise.all([
    page.waitForURL(/saved=/),
    page
      .getByRole("button", { name: /保存草稿|Save draft|Salvar rascunho/ })
      .click(),
  ]);
  // As 5 fotos do produto são obrigatórias já na cotação. Escolher a foto já envia.
  for (const kind of [
    "weight_scale",
    "dimension_scale",
    "dimension_side",
    "angle",
    "original",
  ]) {
    // A foto sobe no lugar, sem navegar: a linha ganha a miniatura.
    const row = page.locator(`li:has(input[name=kind][value=${kind}])`);
    await row.locator("input[name=photos]").setInputFiles(png);
    await row.locator("img").first().waitFor();
  }
}

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/e-mail|email|邮箱/i).fill(email);
  await page.getByLabel(/senha|password|密码/i).fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await page.waitForURL(/\/app/);
}

/** Preenche todos os requisitos pendentes que o usuário logado pode preencher na tela do pedido. */
async function fillMyRequirements(
  page: Page,
  orderUrl: string,
  values: Record<string, string> = {},
  limit = 12,
) {
  for (let guard = 0; guard < limit; guard++) {
    await page.goto(orderUrl);
    // O formulário "Excluir" de um anexo enviado não é um requisito a preencher.
    const forms = page.locator(
      "form:has(input[name=requirementId]):not([data-requirement-clear])",
    );
    const count = await forms.count();
    if (count === 0) return;
    const form = forms.first();
    const file = form.locator("input[type=file]");
    const number = form.locator("input[type=number]");
    const amount = form.locator("[data-money=amount]");
    const date = form.locator("input[type=date]");
    const text = form.locator("textarea[name=value]");
    // valor específico por rótulo (ex.: peso)
    const row = form.locator("xpath=ancestor::li[1]");
    const label =
      (await row.locator("span.font-medium").first().textContent()) ?? "";
    if (await file.count()) {
      // Foto e arquivo enviam sozinhos ao escolher (sem botão Enviar).
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST"),
        file.setInputFiles(
          (await file.getAttribute("accept"))?.includes("image") ? png : pdf,
        ),
      ]);
      await page.waitForLoadState("networkidle");
      if (page.url().includes("error=")) {
        const alert = await page.locator("main").innerText();
        throw new Error(
          `Falha ao enviar "${label}": ${page.url()}\n${alert.slice(0, 400)}`,
        );
      }
      continue;
    } else if (await amount.count()) {
      // Custos: moeda + valor (o símbolo vem da moeda escolhida).
      await form.locator("select[name=currency]").selectOption("BRL");
      await amount.fill("1.234,56");
    } else if (await number.count()) {
      const key = Object.keys(values).find((k) =>
        label.toLowerCase().includes(k.toLowerCase()),
      );
      await number.fill(key ? values[key] : "10");
    } else if (await date.count()) {
      await date.fill("2026-10-15");
    } else if (await text.count()) {
      await text.fill("ok");
    }
    await form.locator("button[type=submit]").first().click();
    await page.waitForLoadState("networkidle");
    if (page.url().includes("error=")) {
      const alert = await page.locator("main").innerText();
      throw new Error(
        `Falha ao enviar "${label}": ${page.url()}\n${alert.slice(0, 400)}`,
      );
    }
  }
}

test("solicitação → RFQ → cotação → seleção → sinal → pedido → checklist → inspeção → embarque → desembaraço → transporte → entrega", async ({
  page,
}) => {
  // 1. Cliente cria solicitação
  await login(page, "joao@lojista.com");
  // O início do cliente é Solicitações, com o atalho para nova solicitação.
  await page.goto("/app");
  await page.waitForURL(/\/app\/requests$/);
  await expect(page.getByText("Precisa importar um produto?")).toBeVisible();
  await page.goto("/app/requests/new");
  await page.selectOption('select[name="p0.productId"]', "prod-jarra");
  await page.fill(
    'textarea[name="p0.description"]',
    "Jarra de vidro com tampa de bambu",
  );
  await page.fill('input[name="p0.quantity"]', "1200");
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await page.waitForURL(/\/app\/requests\/(?!new)[^/]+$/);
  const requestUrl = page.url();
  await expect(page.getByText(/Solicitado/).first()).toBeVisible();

  // 2. Wellmix abre RFQ para dois fornecedores
  await login(page, "operador@wellmix.com");
  await page.goto(requestUrl);
  await page.getByLabel(/Shenzhen Supplier A/).check();
  await page.getByLabel(/Guangzhou Supplier B/).check();
  await page.getByRole("button", { name: /Abrir RFQ/ }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/RFQ aberta/).first()).toBeVisible();

  // 3. Fornecedor A responde (interface em chinês)
  await login(page, "supplier.a@china.com");
  // Pendências vêm pelo prazo: abre a da RFQ, não a primeira da lista.
  await page.goto("/app/tasks");
  await page
    .locator("li", { hasText: /RFQ/ })
    .first()
    .getByRole("link", { name: /打开|Open|Abrir/ })
    .click();
  await page.waitForURL(/\/app\/quotes\//);
  await fillQuoteSheet(page, "2.35");
  await page.fill("input[name=leadTimeDays]", "30");
  await page.fill("textarea[name=conditions]", "FOB Shenzhen, 30/70");
  await page
    .getByRole("button", { name: /提交报价|Send quotation|Enviar cotação/ })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText(/报价已提交|Quotation sent|Cotação enviada/),
  ).toBeVisible();

  // Fornecedor B responde (inglês)
  await login(page, "supplier.b@china.com");
  await page.goto("/app");
  await page
    .getByRole("link", { name: /Open|Abrir/ })
    .first()
    .click();
  await page.waitForURL(/\/app\/quotes\//);
  await fillQuoteSheet(page, "2.6");
  await page.fill("input[name=leadTimeDays]", "25");
  await page
    .getByRole("button", { name: /提交报价|Send quotation|Enviar cotação/ })
    .click();
  await page.waitForLoadState("networkidle");

  // 4. Wellmix compara e seleciona A com preço ao cliente
  await login(page, "operador@wellmix.com");
  await page.goto(requestUrl);
  await expect(page.getByText("Shenzhen Supplier A").first()).toBeVisible();
  await expect(page.getByText("Guangzhou Supplier B").first()).toBeVisible();
  const quoteValue = await page
    .locator("select[name=quoteId] option", { hasText: "Shenzhen" })
    .getAttribute("value");
  await page.selectOption("select[name=quoteId]", quoteValue!);
  await page.fill("[data-money=sellPrice]", "28000");
  await page.getByRole("button", { name: /^Selecionar$/ }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/Aguardando sinal/).first()).toBeVisible();

  // 5. Cliente vê a proposta, mas não vê fornecedor nem FOB
  await login(page, "joao@lojista.com");
  await page.goto(requestUrl);
  await expect(page.getByText(/Sinal/).first()).toBeVisible();
  await expect(page.getByText("Shenzhen Supplier A")).toHaveCount(0);
  await expect(page.getByText(/FOB/)).toHaveCount(0);

  // 6. Wellmix confirma o sinal (manual) → pedido criado
  await login(page, "operador@wellmix.com");
  await page.goto(requestUrl);
  await page.getByRole("button", { name: /Confirmar sinal recebido/ }).click();
  await page.waitForURL(/\/app\/orders\/[^/]+$/);
  const orderUrl = page.url();
  await expect(page.getByText(/Pedido #\d+/).first()).toBeVisible();

  // 7. ORDER_CREATED: operador confirma (Wellmix pode preencher tudo; limitamos a 1 envio)
  await fillMyRequirements(page, orderUrl, {}, 1);
  await page.goto(orderUrl);
  await expect(page.getByText("Preparação").first()).toBeVisible();

  // 8. PREPARATION: a ficha completa (com fotos) veio da cotação, então a etapa
  // se concluiu sozinha e o pedido já está no pagamento ao fornecedor.
  await login(page, "supplier.a@china.com");
  await page.goto(orderUrl);
  await expect(
    page
      .locator("main h2")
      .filter({
        hasText: /供应商付款|Supplier payment|Pagamento ao fornecedor/,
      })
      .first(),
  ).toContainText(/进行中|In progress|Em andamento/);

  // 9. SUPPLIER_PAYMENT: Wellmix registra pagamento, fornecedor confirma
  await login(page, "operador@wellmix.com");
  await page.goto(orderUrl);
  // Valor devido já calculado; copiar os dados para o banco registra o pagamento.
  await expect(page.getByText("Valor a pagar ao fornecedor")).toBeVisible();
  await Promise.all([
    page.waitForURL(/paid=transfer_copied/),
    page.getByRole("button", { name: /Copiar dados para o banco/ }).click(),
  ]);
  await expect(
    page.getByText(/Dados copiados e pagamento registrado/),
  ).toBeVisible();
  await login(page, "supplier.a@china.com");
  await page.goto(orderUrl);
  await page
    .getByRole("button", {
      name: /确认收款|Confirm receipt|Confirmar recebimento/,
    })
    .first()
    .click();
  await page.waitForLoadState("networkidle");
  await fillMyRequirements(page, orderUrl);

  // 10. PACKAGING: fornecedor envia arte, agência aprova
  await fillMyRequirements(page, orderUrl);
  await login(page, "agencia@design.com");
  await page.goto(orderUrl);
  await page.getByRole("button", { name: /Aprovar/ }).click();
  await page.waitForLoadState("networkidle");

  // 11. INSPECTION: peso divergente bloqueia; Wellmix revisa
  await login(page, "supplier.a@china.com");
  await fillMyRequirements(page, orderUrl, {
    重量: "15",
    weight: "15",
    peso: "15",
  });
  await login(page, "operador@wellmix.com");
  await page.goto(orderUrl);
  await expect(page.getByText(/Revisão necessária/).first()).toBeVisible();
  await page.getByRole("button", { name: /Aprovar/ }).click();
  await page.waitForLoadState("networkidle");
  await page.goto(orderUrl);
  await expect(page.getByText(/Embarque/).first()).toBeVisible();

  // 12. SHIPPING, CUSTOMS, TRANSPORT pelos parceiros
  await login(page, "armador@maritima.com");
  await fillMyRequirements(page, orderUrl);
  await login(page, "despachante@comex.com");
  await fillMyRequirements(page, orderUrl);
  await login(page, "transportadora@rodo.com");
  await fillMyRequirements(page, orderUrl);

  // 13. Cliente confirma o recebimento e vê o pedido encerrado
  await login(page, "joao@lojista.com");
  await fillMyRequirements(page, orderUrl);
  await page.goto(orderUrl);
  await expect(page.getByText(/Pedido encerrado/).first()).toBeVisible();

  // 14. Isolamento: fornecedor B não acessa o pedido
  await login(page, "supplier.b@china.com");
  const res = await page.goto(orderUrl);
  expect(res?.status()).toBe(404);

  // 15. Control Tower da Wellmix carrega
  await login(page, "admin@wellmix.com");
  await page.goto("/app");
  await expect(page.getByText("Control Tower").first()).toBeVisible();
});

test("vários produtos numa solicitação: cada um vira uma solicitação do mesmo lote", async ({
  page,
}) => {
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  await page.selectOption('select[name="p0.productId"]', "prod-jarra");
  await page.fill('textarea[name="p0.description"]', "Jarra de vidro");
  await page.fill('input[name="p0.quantity"]', "100");
  await page.click("[data-add-request-item]");
  await page.check('[data-request-item="1"] input[name="p1.sourcingDemand"]');
  await page.fill('input[name="p1.productName"]', "Copo de vidro");
  await page.fill('textarea[name="p1.description"]', "Copo de vidro 300 ml");
  await page.fill('input[name="p1.quantity"]', "200");
  // Terceira linha adicionada e removida: não vira solicitação.
  await page.click("[data-add-request-item]");
  await page.getByRole("button", { name: /Remover: Produto 3/ }).click();
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await page.waitForURL(/\/app\/requests\?group=[^&]+&created=2$/);
  await expect(page.locator("[data-batch-created]")).toBeVisible();
  await expect(page.locator("[data-batch-badge]")).toHaveCount(2);
  await expect(
    page.locator("table tr:has-text('Copo de vidro')"),
  ).toBeVisible();
  // Cada solicitação mostra a outra do lote.
  await page
    .locator("table tr:has-text('Copo de vidro') a[href^='/app/requests/']")
    .first()
    .click();
  await page.waitForURL(/\/app\/requests\/(?!new)[^/?]+$/);
  await expect(page.locator("[data-batch-siblings]")).toContainText(
    "Jarra de vidro",
  );
});
