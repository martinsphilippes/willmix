import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "willmix123";
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
    const forms = page.locator("form:has(input[name=requirementId])");
    const count = await forms.count();
    if (count === 0) return;
    const form = forms.first();
    const file = form.locator("input[type=file]");
    const number = form.locator("input[type=number]");
    const date = form.locator("input[type=date]");
    const text = form.locator("textarea[name=value]");
    // valor específico por rótulo (ex.: peso)
    const row = form.locator("xpath=ancestor::li[1]");
    const label =
      (await row.locator("span.font-medium").first().textContent()) ?? "";
    if (await file.count()) {
      await file.setInputFiles(
        (await file.getAttribute("accept"))?.includes("image") ? png : pdf,
      );
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
  await page.goto("/app/requests/new");
  await page.selectOption("select[name=productId]", "prod-jarra");
  await page.fill(
    "textarea[name=description]",
    "Jarra de vidro com tampa de bambu",
  );
  await page.fill("input[name=quantity]", "1200");
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await page.waitForURL(/\/app\/requests\/(?!new)[^/]+$/);
  const requestUrl = page.url();
  await expect(page.getByText(/Solicitado/).first()).toBeVisible();

  // 2. Willmix abre RFQ para dois fornecedores
  await login(page, "operador@willmix.com");
  await page.goto(requestUrl);
  await page.getByLabel(/Shenzhen Supplier A/).check();
  await page.getByLabel(/Guangzhou Supplier B/).check();
  await page.getByRole("button", { name: /Abrir RFQ/ }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/RFQ aberta/).first()).toBeVisible();

  // 3. Fornecedor A responde (interface em chinês)
  await login(page, "supplier.a@china.com");
  await page.goto("/app");
  await page
    .getByRole("link", { name: /打开|Open|Abrir/ })
    .first()
    .click();
  await page.waitForURL(/\/app\/quotes\//);
  await page.fill("input[name=price]", "2.35");
  await page.fill("input[name=leadTimeDays]", "30");
  await page.fill("textarea[name=conditions]", "FOB Shenzhen, 30/70");
  await page.getByRole("button", { name: /提交|Send|Enviar/ }).click();
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
  await page.fill("input[name=price]", "2.6");
  await page.fill("input[name=leadTimeDays]", "25");
  await page.getByRole("button", { name: /Send|Enviar/ }).click();
  await page.waitForLoadState("networkidle");

  // 4. Willmix compara e seleciona A com preço ao cliente
  await login(page, "operador@willmix.com");
  await page.goto(requestUrl);
  await expect(page.getByText("Shenzhen Supplier A").first()).toBeVisible();
  await expect(page.getByText("Guangzhou Supplier B").first()).toBeVisible();
  const quoteValue = await page
    .locator("select[name=quoteId] option", { hasText: "Shenzhen" })
    .getAttribute("value");
  await page.selectOption("select[name=quoteId]", quoteValue!);
  await page.fill("input[name=sellPrice]", "28000");
  await page.getByRole("button", { name: /^Selecionar$/ }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/Aguardando sinal/).first()).toBeVisible();

  // 5. Cliente vê a proposta, mas não vê fornecedor nem FOB
  await login(page, "joao@lojista.com");
  await page.goto(requestUrl);
  await expect(page.getByText(/Sinal/).first()).toBeVisible();
  await expect(page.getByText("Shenzhen Supplier A")).toHaveCount(0);
  await expect(page.getByText(/FOB/)).toHaveCount(0);

  // 6. Willmix confirma o sinal (manual) → pedido criado
  await login(page, "operador@willmix.com");
  await page.goto(requestUrl);
  await page.getByRole("button", { name: /Confirmar sinal recebido/ }).click();
  await page.waitForURL(/\/app\/orders\/[^/]+$/);
  const orderUrl = page.url();
  await expect(page.getByText(/Pedido #\d+/).first()).toBeVisible();

  // 7. ORDER_CREATED: operador confirma (Willmix pode preencher tudo; limitamos a 1 envio)
  await fillMyRequirements(page, orderUrl, {}, 1);
  await page.goto(orderUrl);
  await expect(page.getByText("Preparação").first()).toBeVisible();

  // 8. PREPARATION: fornecedor cumpre checklist (peso 12)
  await login(page, "supplier.a@china.com");
  await fillMyRequirements(page, orderUrl, {
    重量: "12",
    weight: "12",
    peso: "12",
  });
  await page.goto(orderUrl);
  await expect(
    page
      .locator("main h2")
      .filter({
        hasText: /供应商付款|Supplier payment|Pagamento ao fornecedor/,
      })
      .first(),
  ).toContainText(/进行中|In progress|Em andamento/);

  // 9. SUPPLIER_PAYMENT: Willmix registra pagamento, fornecedor confirma
  await login(page, "operador@willmix.com");
  await page.goto(orderUrl);
  await page
    .getByRole("button", { name: /Registrar pagamento ao fornecedor/ })
    .click();
  await page.waitForLoadState("networkidle");
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

  // 11. INSPECTION: peso divergente bloqueia; Willmix revisa
  await login(page, "supplier.a@china.com");
  await fillMyRequirements(page, orderUrl, {
    重量: "15",
    weight: "15",
    peso: "15",
  });
  await login(page, "operador@willmix.com");
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

  // 15. Control Tower da Willmix carrega
  await login(page, "admin@willmix.com");
  await page.goto("/app");
  await expect(page.getByText("Control Tower").first()).toBeVisible();
});
