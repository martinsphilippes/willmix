import { expect, test, type Page } from "@playwright/test";
import {
  bookingSheet,
  fillMyRequirements,
  gotoProduct,
  importAndClose,
  login,
  pdf,
  png,
  selectAndOpenSupplierRequest,
} from "./helpers";

/** Marca única por execução: a busca acha só os itens deste teste. */
const TAG = `HP${Date.now().toString(36).toUpperCase()}`;

/** Item da etapa pelo rótulo (as raias levam o nome do produto no rótulo). */
const requirementRow = (page: Page, label: RegExp) =>
  page.locator("li", {
    has: page.locator("span.font-medium", { hasText: label }),
  });

/**
 * Contrato do pedido de compra (docs/PURCHASE_ORDER.md, seção 3): baixa o
 * PDF, assina, carimba e sobe o arquivo (sem o aceite no portal). Escolher o
 * arquivo já registra a assinatura.
 */
async function uploadSignedContract(page: Page, orderUrl: string) {
  await page.goto(`${orderUrl}/purchase-order`);
  await expect(page.locator("[data-order-sign-turn]")).toBeVisible();
  // Só o arquivo: o formulário do aceite no portal não aparece.
  await expect(page.locator("[data-order-sign-form]")).toHaveCount(0);
  await page
    .locator("[data-order-sign-file] input[type=file]")
    .setInputFiles(pdf);
  await page.waitForURL(/signed=1/);
}

test("booking → seleção → solicitação ao fornecedor → produto → pedido de compra → raias → contrato → pagamento → inspeção → embarque → desembaraço → transporte → entrega", async ({
  page,
}) => {
  const codeA = `${TAG}-A`;
  const codeB = `${TAG}-B`;
  const productName = `Copo de vidro ${TAG}`;

  // 0. Cliente: o início é a vitrine (Explorar); Solicitações ("Orçamentos")
  // fica em "Meus pedidos", com o atalho para nova solicitação.
  await login(page, "joao@lojista.com");
  await page.goto("/app");
  await page.waitForURL(/\/app\/explore$/);
  await expect(page.locator("[data-explore]")).toBeVisible();
  await page.goto("/app/requests");
  await expect(page.getByText("Precisa importar um produto?")).toBeVisible();
  // "Como funciona" saiu de todas as telas (pedido do dono).
  await expect(page.locator("[data-page-help]")).toHaveCount(0);

  // 1. Booking por planilha: dois fornecedores com o mesmo tipo de item.
  await login(page, "admin@wellmix.com");
  // Resumos dos pedidos ligados (docs/RESUMOS.md): daqui em diante a Control
  // Tower lê o resumo, recalculado a cada gravação dos pedidos do fluxo.
  await page.goto("/app/settings/summaries");
  await page.locator("[data-summaries-rebuild]").click();
  await page.waitForURL(/\/app\/settings\/summaries\?ran=1/);
  await expect(page.locator("[data-summaries-status]")).toBeVisible();
  // Sourcing em espera (pedido do dono): a tela guarda tudo, mostra a
  // situação e o interruptor do administrador (liga e volta para espera).
  await page.goto("/app/sourcing");
  await expect(page.locator("[data-sourcing-state=off]")).toBeVisible();
  await expect(page.locator("[data-sourcing-standby]")).toBeVisible();
  await page.locator("[data-sourcing-switch=on]").click();
  await page.waitForURL(/\/app\/sourcing\?saved=on/);
  await expect(page.locator("[data-sourcing-state=on]")).toBeVisible();
  await page.locator("[data-sourcing-switch=off]").click();
  await page.waitForURL(/\/app\/sourcing\?saved=off/);
  await expect(page.locator("[data-sourcing-state=off]")).toBeVisible();
  await importAndClose(
    page,
    bookingSheet("Shenzhen Supplier A", codeA, `Glass cup ${TAG} 350ml`),
    "Shenzhen Supplier A",
  );
  await importAndClose(
    page,
    bookingSheet("Guangzhou Supplier B", codeB, `Glass cup ${TAG} with handle`),
    "Guangzhou Supplier B",
  );

  // 2. Seleção de itens: o A é o escolhido, o B a alternativa; abre a
  // solicitação ao fornecedor A.
  const requestUrl = await selectAndOpenSupplierRequest(
    page,
    TAG,
    codeA,
    codeB,
    "Caixa com a marca",
  );
  const requestId = requestUrl.split("/").pop()!;
  const itemUrl = `${requestUrl}?view=item`;

  // 3. O fornecedor A responde "sim" na caixa rápida da tabela; o B não abre.
  await login(page, "supplier.a@china.com");
  await page.goto(requestUrl);
  await expect(page.locator("[data-supplier-table-row]")).toHaveCount(1);
  // Fornecedor de verdade: embaixo do nome continua o papel, no idioma do
  // login (este lê em chinês). Os tipos que entram como ele, Trading e os
  // demais, mostram o nome do tipo.
  await expect(page.locator("[data-user-role]")).toHaveText(
    /^(Fornecedor|Supplier|供应商)$/,
  );
  await page.locator("[data-supplier-table-answer-open]").click();
  await page.fill("[data-supplier-table-answer-price-input]", "1,40");
  await page.fill("[data-supplier-table-answer-moq]", "2000");
  await page.selectOption("[data-supplier-table-answer-incoterm]", "FOB");
  await page.click("[data-supplier-table-answer=yes]");
  await page.waitForURL(/[?&]answered=1/);
  await login(page, "supplier.b@china.com");
  expect((await page.goto(requestUrl))?.status()).toBe(404);

  // 4. A Wellmix aprova a resposta e cadastra o produto vencedor.
  await login(page, "admin@wellmix.com");
  await page.goto(itemUrl);
  await page.click("[data-supplier-decide=approved]");
  await page.waitForURL(/[?&]decided=approved/);
  // Amostragem (docs/SUPPLIER_SAMPLING.md): o produto sai depois da amostra
  // aprovada; o fornecedor manda a foto da peça e a Wellmix aprova.
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
  // A busca no catálogo fica na tela do produto (não volta à tabela).
  await page.fill("[data-request-product-search=pq]", "garrafa");
  await page.press("[data-request-product-search=pq]", "Enter");
  await page.waitForURL(/[?&]pq=garrafa/);
  expect(page.url()).toContain("view=item");
  await page.fill("[data-request-product-name]", productName);
  await page.selectOption("[data-request-product-line]", { index: 1 });
  await page.click("[data-request-product-create]");
  await page.waitForURL(/[?&]product=created/);

  // 5. Gerar pedido de compra: só o produto deste teste (outros aprovados
  // do mesmo fornecedor, de rodadas anteriores, ficam desmarcados).
  await page.goto("/app/supplier-requests");
  await expect(page.locator("[data-purchase-customer]")).toBeVisible();
  const group = page.locator(
    `form:has([data-purchase-candidate="${requestId}"])`,
  );
  await expect(group).toBeVisible();
  const others = group.locator(
    `[data-purchase-candidate]:not([data-purchase-candidate="${requestId}"]) input[type=checkbox]`,
  );
  for (let i = 0; i < (await others.count()); i++)
    await others.nth(i).uncheck();
  await group.locator("[data-purchase-submit]").click();
  await page.waitForURL(/\/app\/orders\/[^/?]+\?purchase=created/);
  const orderUrl = page.url().split("?")[0];
  const orderNumber = (
    await page
      .getByText(/Pedido #\d+/)
      .first()
      .textContent()
  )?.match(/#(\d+)/)?.[1];
  expect(orderNumber).toBeTruthy();
  await expect(
    page.getByText("Preparação, arte e certificação").first(),
  ).toBeVisible();
  // Na tabela "Etapas do pedido", a linha da etapa 2 leva o nome novo.
  await expect(
    page.getByRole("link", { name: "Die-Cut, Arte e Certificação" }),
  ).toHaveCount(1);
  // Transportador: o pedido só designa sozinho quando há exatamente um ativo
  // no cadastro. Outros testes cadastram mais transportadores (que nascem
  // ativos), então a Wellmix designa aqui, em Parceiros do pedido.
  const carrierRow = page.locator('[data-order-partner="carrier"]');
  await carrierRow.locator("select").selectOption({ label: "Trans Rodo" });
  await carrierRow.locator("button[type=submit]").click();
  await page.waitForLoadState("networkidle");
  await page.goto(orderUrl);
  await expect(carrierRow.locator("td").nth(1)).toHaveText("Trans Rodo");
  // A solicitação fica presa ao pedido: não volta a ser candidata.
  await page.goto("/app/supplier-requests");
  await expect(
    page.locator(`[data-purchase-candidate="${requestId}"]`),
  ).toHaveCount(0);

  // 6. As três raias, em paralelo. A arte final espera a validação e o
  // certificado; a validação espera a arte.
  await page.goto(orderUrl);
  await expect(requirementRow(page, /Arte final com o selo/)).toContainText(
    /Pendente/,
  );
  // 6a. Fornecedor: faca, foto em alta, MOQ e prazo.
  await login(page, "supplier.a@china.com");
  await page.goto(orderUrl);
  await expect(requirementRow(page, /Faca \(die cut\)/).first()).toBeVisible();
  // A pendência dele cai na etapa "Die Cut" e abre o quadro do pedido, com
  // os quatro itens do produto: die-cut, foto em alta, pedido mínimo e prazo.
  await page.goto("/app/tasks");
  const dieCutTask = page.locator(
    `[data-task-group="supplier.dieline"]:has(a[href*="${new URL(orderUrl, "http://x").pathname}/die-cut"])`,
  );
  await expect(dieCutTask).toHaveCount(1);
  await expect(dieCutTask).toContainText(/Die Cut/);
  await dieCutTask.getByRole("link").first().click();
  await page.waitForURL(/\/die-cut/);
  const board = page.locator("[data-die-cut-product]");
  await expect(board).toHaveAttribute("data-complete", "no");
  for (const [item, file] of [
    ["dieline", pdf],
    ["hd", png],
  ] as const) {
    await board
      .locator(`[data-die-cut-item="${item}"] input[type=file]`)
      .last()
      .setInputFiles(file);
    await page.waitForURL(new RegExp(`saved=${item}`));
    await expect(
      board.locator(`[data-die-cut-item="${item}"]`),
    ).toHaveAttribute("data-done", "yes");
  }
  // O pedido mínimo e o prazo vêm com o negociado; ele corrige o prazo.
  const terms = board.locator("[data-die-cut-terms]");
  await expect(terms.locator("input[name=moq]")).toHaveValue("2000");
  await terms.locator("input[name=leadTimeDays]").fill("45");
  await terms.getByRole("button").click();
  await page.waitForURL(/saved=terms/);
  await expect(board).toHaveAttribute("data-complete", "yes");
  // Nada mais dele na Preparação: o pedido mostra os quatro concluídos.
  await page.goto(orderUrl);
  await expect(page.locator("[data-die-cut-link]")).toBeVisible();
  await expect(requirementRow(page, /Faca \(die cut\)/).first()).toContainText(
    /doc\.pdf/,
  );
  await fillMyRequirements(page, orderUrl);
  // 6b. Agência: envia a arte. A arte final com o selo ainda não sobe
  // (falta a arte validada e o certificado).
  await login(page, "agencia@design.com");
  await fillMyRequirements(page, orderUrl, {}, 1);
  await page.goto(orderUrl);
  await expect(requirementRow(page, /^Arte ·/)).toContainText(/Concluído/);
  await requirementRow(page, /Arte final com o selo/)
    .locator("input[type=file]")
    .last()
    .setInputFiles(pdf);
  await page.waitForURL(/[?&]error=lane_prerequisite/);
  // 6c. A Wellmix devolve a arte com o motivo; a agência reenvia.
  await login(page, "admin@wellmix.com");
  await page.goto(orderUrl);
  const review = requirementRow(page, /Validação da arte pela Wellmix/);
  await review.locator("input[name=note]").fill("Logo maior");
  await review.locator("button[value=reject]").click();
  await page.waitForLoadState("networkidle");
  await login(page, "agencia@design.com");
  await page.goto(orderUrl);
  await expect(requirementRow(page, /^Arte ·/)).toContainText(
    /Reprovado|Pendente/,
  );
  await expect(page.locator("main")).toContainText("Logo maior");
  await fillMyRequirements(page, orderUrl, {}, 1);
  // A Wellmix valida a arte reenviada.
  await login(page, "admin@wellmix.com");
  await page.goto(orderUrl);
  await requirementRow(page, /Validação da arte pela Wellmix/)
    .locator("button[value=approve]")
    .click();
  await page.waitForLoadState("networkidle");
  // 6d. Certificadora: o certificado.
  await login(page, "ocp@certifica.com");
  await fillMyRequirements(page, orderUrl);
  // 6e. Agência: com a arte validada e o certificado, a arte final com o selo.
  await login(page, "agencia@design.com");
  await fillMyRequirements(page, orderUrl);

  // 7. Contrato: o documento traz a arte final; a Wellmix sobe o arquivo
  // assinado e carimbado, depois o fornecedor.
  await login(page, "admin@wellmix.com");
  await page.goto(`${orderUrl}/purchase-order`);
  await expect(page.locator("[data-contract-final-arts] li")).toHaveCount(1);
  await uploadSignedContract(page, orderUrl);
  await expect(
    page.locator("[data-order-signature=wellmix][data-signed=yes]"),
  ).toBeVisible();
  await expect(
    page.locator("[data-order-signature=supplier][data-signed=no]"),
  ).toBeVisible();
  await login(page, "supplier.a@china.com");
  const pdfResponse = await page.request.get(
    `${orderUrl.replace("/app/orders/", "/api/orders/")}/purchase-order`,
  );
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toBe("application/pdf");
  expect((await pdfResponse.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await uploadSignedContract(page, orderUrl);
  await expect(
    page.locator("[data-order-signature=supplier][data-signed=yes]"),
  ).toBeVisible();
  await expect(
    page.locator("[data-order-document-status=signed]"),
  ).toBeVisible();

  // 8. Pagamento ao fornecedor (fora do fluxo): a condição do cadastro do
  // fornecedor, parcela 1 vence no pedido. Financeiro é só do admin.
  await login(page, "operador@wellmix.com");
  await page.goto("/app/payables");
  await page.waitForURL(/\/app\?denied=payables/);
  await login(page, "admin@wellmix.com");
  await page.goto("/app/payables");
  await expect(
    page.locator(`[data-payable-row="${orderNumber}-1"]`),
  ).toBeVisible();
  await page.goto(orderUrl);
  await expect(page.locator("[data-terms-text]")).toContainText(
    /30% na data do pedido \+ 70% 90 dias após a entrega/,
  );
  await Promise.all([
    page.waitForURL(/paid=transfer_copied/),
    page.getByRole("button", { name: /Copiar dados para o banco/ }).click(),
  ]);
  await expect(page.locator('[data-installment="1"]')).toHaveAttribute(
    "data-status",
    "requested",
  );
  // Produção: o cartão aparece para a Wellmix no pedido.
  await expect(page.locator("[data-production-card]")).toBeVisible();
  // O fornecedor confirma o recebimento na conta corrente.
  await login(page, "supplier.a@china.com");
  await page.goto("/app/account");
  await expect(
    page.locator(`[data-forecast-row="${orderNumber}-1"]`),
  ).toBeVisible();
  await page
    .locator("tr", {
      has: page.locator("td", { hasText: new RegExp(`^#${orderNumber}$`) }),
    })
    .getByRole("button", {
      name: /确认收款|Confirm receipt|Confirmar recebimento/,
    })
    .click();
  await page.waitForLoadState("networkidle");
  await page.goto(orderUrl);
  await expect(page.locator('[data-installment="1"]')).toHaveAttribute(
    "data-status",
    "received",
  );

  // 9. Inspeção: o fornecedor manda as fotos e o peso medido. Nestes
  // pedidos não há peso declarado para comparar (sem ficha de compra):
  // a etapa conclui e o pedido vai ao Embarque.
  await fillMyRequirements(page, orderUrl, {
    重量: "15",
    weight: "15",
    peso: "15",
  });
  await login(page, "operador@wellmix.com");
  await page.goto(orderUrl);
  await expect(page.getByText(/Revisão necessária/)).toHaveCount(0);
  await expect(
    page
      .locator("main h2")
      .filter({ hasText: /^Embarque/ })
      .first(),
  ).toContainText(/Em andamento/);
  // Embarque (Wellmix): botão de importar a planilha da companhia marítima
  // (tarifário de frete), que leva ao tarifário e volta ao pedido.
  const tariffBox = page.locator("[data-tariff-box]");
  await expect(tariffBox).toBeVisible();
  await expect(tariffBox.locator("[data-tariff-import-link]")).toHaveAttribute(
    "href",
    /\/app\/freight\/tariff\?from=%2Fapp%2Forders%2F/,
  );
  // Embarque e desembaraço (Fase D): os passos aparecem para a Wellmix.
  await expect(page.locator("[data-import-step=booking]")).toBeVisible();

  // 10. Embarque, desembaraço e transporte pelos parceiros do pedido.
  await login(page, "armador@maritima.com");
  await page.goto(orderUrl);
  // A companhia marítima não vê o comparativo (tem as tarifas das outras);
  // vê só o botão de enviar a tabela de frete dela.
  await expect(page.locator("[data-tariff-box]")).toHaveCount(0);
  const uploadBox = page.locator("[data-tariff-upload-box]");
  await expect(uploadBox).toBeVisible();
  await expect(uploadBox.locator("[data-tariff-import-link]")).toHaveAttribute(
    "href",
    /\/app\/freight\/tariff\?from=%2Fapp%2Forders%2F/,
  );
  // A previsão de chegada espera a data de embarque e nunca fica antes dela.
  await expect(
    page.locator("[data-requirement-waiting]", {
      hasText:
        /Aguardando a data de embarque|Waiting for the shipping date|等待装船日期/,
    }),
  ).toBeVisible();
  const shipDate = page.locator("input[type=date]").first();
  await shipDate.fill("2026-10-15");
  await page
    .locator("form", { has: shipDate })
    .locator("button[type=submit]")
    .click();
  await page.waitForLoadState("networkidle");
  await page.goto(orderUrl);
  const eta = page.locator('input[type=date][min="2026-10-15"][data-ready]');
  await eta.fill("2026-10-14");
  await expect(page.locator("[data-date-error]")).toBeVisible();
  await eta.fill("2026-10-15");
  await expect(page.locator("[data-date-error]")).toHaveCount(0);
  await fillMyRequirements(page, orderUrl);
  await login(page, "despachante@comex.com");
  await fillMyRequirements(page, orderUrl);
  await login(page, "transportadora@rodo.com");
  await fillMyRequirements(page, orderUrl);

  // 11. Entrega: o cliente do pedido é a própria Wellmix (CODEMP do
  // Sankhya), sem login; a Wellmix confirma o recebimento e o pedido encerra.
  await login(page, "admin@wellmix.com");
  await page.goto(orderUrl);
  await page
    .locator("[data-requirement-form=receipt_confirmed] button[type=submit]")
    .click();
  await page.waitForLoadState("networkidle");
  await page.goto(orderUrl);
  await expect(page.getByText(/Pedido encerrado/).first()).toBeVisible();
  // Recebimento (Fase E) e artes (Fase F) no pedido encerrado.
  await expect(page.locator("[data-receiving-card]")).toBeVisible();
  await expect(page.locator("[data-artwork-card]")).toBeVisible();
  const zip = await page.request.get(
    (await page.locator("[data-artwork-zip]").getAttribute("href"))!,
  );
  expect([200, 404]).toContain(zip.status());

  // 12. Isolamento: o fornecedor B não abre o pedido nem o contrato.
  await login(page, "supplier.b@china.com");
  expect((await page.goto(orderUrl))?.status()).toBe(404);
  expect((await page.goto(`${orderUrl}/purchase-order`))?.status()).toBe(404);

  // 13. Painéis por área, auditoria e Control Tower da Wellmix.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/dashboards?area=production");
  await expect(page.locator("[data-dash-area=production]")).toBeVisible();
  await page.goto("/app/audit");
  await expect(page.locator("[data-audit-row]").first()).toBeVisible();
  await page.goto("/app");
  await expect(page.getByText("Control Tower").first()).toBeVisible();
  // O pedido do fluxo (criado depois da reconstrução e encerrado no passo 11)
  // está no resumo, já encerrado: o recálculo por evento acompanhou o fluxo.
  await page.goto("/app?filter=closed");
  await expect(
    page.locator(
      `[data-tower-list=closed] a[href="${new URL(orderUrl).pathname}"]`,
    ),
  ).toBeVisible();

  // 14. Contas de demonstração: em Configurações todas existem; o seletor
  // "Demo" do topo troca de conta sem deslogar antes (entra como OCP) e volta.
  await page.goto("/app/settings");
  await expect(page.locator("[data-demo-accounts]")).toBeVisible();
  // Banco de antes de um papel novo: o botão cria o que falta.
  const createDemo = page.locator("[data-demo-create]");
  if (await createDemo.isVisible()) {
    await createDemo.click();
    await page.waitForURL(/[?&]demo=\d+/);
  }
  await expect(page.locator("[data-demo-exists='0']")).toHaveCount(0);
  const demoSelect = page
    .getByRole("combobox", {
      name: /Conta de demonstração|Demo account|演示账号/,
    })
    .first();
  await demoSelect.selectOption("ocp@certifica.com");
  await page.waitForURL(/\/app$/);
  await expect(
    page.getByRole("button", { name: /Olga OCP/ }).first(),
  ).toBeVisible();
  await expect(page.locator("[data-demo-switch-error]")).toHaveCount(0);
});

test("vários produtos numa solicitação: cada um vira uma solicitação do mesmo lote", async ({
  page,
}) => {
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  await page.selectOption('select[name="p0.productId"]', "prod-jarra");
  await page.fill('textarea[name="p0.description"]', "Jarra de vidro");
  // A quantidade fica acima do pedido mínimo da jarra, se houver (a tela
  // sobe e o servidor recusa abaixo dele).
  await page.fill('input[name="p0.quantity"]', "1000");
  // Programação de entregas: 2 entregas (500 + 500), "+ Programação" → 3 (334 + 333 + 333),
  // intervalo 30 dias; a 3ª vira 340 → total 1007 e a quantidade acompanha.
  await page.click('[data-request-item="0"] [data-schedule-on]');
  await expect(
    page.locator('[data-request-item="0"] [data-schedule-item]'),
  ).toHaveCount(2);
  await page.click('[data-request-item="0"] [data-schedule-add]');
  await expect(
    page.locator('[data-request-item="0"] [data-schedule-item]'),
  ).toHaveCount(3);
  await page.click('[data-request-item="0"] [data-schedule-interval="30"]');
  await page.fill('input[name="p0.schedule.qty.3"]', "340");
  await expect(
    page.locator('[data-request-item="0"] [data-schedule-total]'),
  ).toContainText("1.007");
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("1007");
  await page.click("[data-add-request-item]");
  await page.check('[data-request-item="1"] input[name="p1.sourcingDemand"]');
  await page.fill('input[name="p1.productName"]', "Copo de vidro");
  await page.fill('textarea[name="p1.description"]', "Copo de vidro 300 ml");
  await page.fill('input[name="p1.quantity"]', "200");
  // Terceira linha adicionada e removida: não vira solicitação.
  await page.click("[data-add-request-item]");
  await page.getByRole("button", { name: /Remover: Produto 3/ }).click();
  await page.getByRole("button", { name: /enviar|send/i }).click();
  // O lote abre numa página só, com os dois produtos dentro.
  await page.waitForURL(/\/app\/requests\/batch\/[^?]+\?created=2$/);
  const batchUrl = page.url().replace(/\?.*$/, "");
  await expect(page.locator("[data-batch-created]")).toBeVisible();
  await expect(page.locator("[data-batch-item]")).toHaveCount(2);
  // O lote nasce com um número (o mesmo para os dois produtos).
  await expect(page.locator("h1")).toContainText(/nº \d+ · 2 produtos/);
  // Na lista, o lote é uma linha só, que leva à página do lote.
  await page.goto("/app/requests");
  const batchPath = new URL(batchUrl).pathname;
  const batchRow = page.locator(`[data-batch-row]:has(a[href="${batchPath}"])`);
  await expect(batchRow).toHaveCount(1);
  await expect(batchRow.locator("[data-request-number]")).toHaveText(/^\d+$/);
  await expect(batchRow).toContainText("Copo de vidro");
  await expect(batchRow).toContainText("Jarra de vidro");
  await batchRow.getByRole("link", { name: /Abrir|Open|打开/ }).click();
  await page.waitForURL(batchUrl);
  // Cada solicitação mostra a outra do lote.
  await page
    .locator(
      "[data-batch-item]:has-text('Copo de vidro') a[href^='/app/requests/']",
    )
    .first()
    .click();
  await page.waitForURL(/\/app\/requests\/(?!new)[^/?]+$/);
  await expect(page.locator("[data-batch-siblings]")).toContainText(
    "Jarra de vidro",
  );
  // A Jarra guarda a programação: 3 entregas, total 1.007.
  await page.locator("[data-batch-siblings] a").first().click();
  await page.waitForURL(/\/app\/requests\/(?!new)[^/?]+$/);
  await expect(page.locator("[data-request-schedule-table]")).toContainText(
    "1.007",
  );
});

test("sugestão da IA: a opção marcada desmarca e escolher já marca o Aplicar", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  // IA em modo de exemplo (mock): a sugestão sai sem chave e sem foto.
  await page.goto("/app/settings");
  const mode = page.locator('select[name="aiMode"]');
  await mode.selectOption("MOCK");
  await mode.evaluate((el) => (el as HTMLSelectElement).form!.requestSubmit());
  await page.waitForURL(/\/app\/settings\?ok=1/);
  await gotoProduct(page, "prod-panela");
  await page
    .locator('form:has(textarea[name="context"]) button[type="submit"]')
    .click();
  const row = page.locator('[data-apply-row="material"]');
  await expect(row).toBeVisible();
  await expect(row.locator("[data-ai-choice][data-ready]")).toBeAttached();
  const apply = row.locator('input[name="apply"]');
  const option = row.locator('input[type="radio"]').first();
  const value = await option.inputValue();
  // Escolher marca o "Aplicar"; tocar de novo desmarca os dois.
  await option.click();
  await expect(option).toBeChecked();
  await expect(apply).toBeChecked();
  await option.click();
  await expect(option).not.toBeChecked();
  await expect(apply).not.toBeChecked();
  // Outro valor também marca; "Limpar" deixa em branco.
  const other = row.getByRole("textbox");
  await other.fill("Inox 304");
  await expect(apply).toBeChecked();
  await row.locator("[data-ai-choice-clear]").click();
  await expect(other).toHaveValue("");
  await expect(apply).not.toBeChecked();
  // Mexido no cadastro e ainda não salvo: continua depois de aplicar (o
  // formulário é refeito com os dados novos e o rascunho devolve o resto).
  const active = page.locator(
    '#product-form input[type="checkbox"][name="active"]',
  );
  // Os quadros do cadastro começam recolhidos (linha fina): um toque abre.
  const productFold = page.locator('#product-form [data-fold-card="product"]');
  await expect(productFold).not.toHaveAttribute("open", "");
  await productFold.locator("summary").click();
  await active.uncheck();
  const spec = page.locator("#product-form [data-product-spec]");
  const specMode = (await spec.getAttribute("data-product-spec")) ?? "";
  // Escolhe de novo e aplica: o material entra no produto.
  await option.click();
  await page
    .getByRole("button", { name: /Aplicar selecionados|Apply selected|应用/ })
    .click();
  await expect(page.locator("[data-apply-row]")).toHaveCount(0);
  // O resultado aparece na própria seção (antes parecia que nada acontecia).
  await expect(page.locator("[data-ai-applied]")).toBeVisible();
  await expect(page.locator('input[name="material"]').first()).toHaveValue(
    value,
  );
  await expect(active).not.toBeChecked();
  // A especificação automática não vira "manual" com texto velho.
  await expect(spec).toHaveAttribute("data-product-spec", specMode);
});

test("ficha pela foto do quadro: preenche e a Wellmix decide a divergência", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  // IA em modo de exemplo (mock): o quadro de exemplo tem MOQ, caixa e material.
  await page.goto("/app/settings");
  const mode = page.locator('select[name="aiMode"]');
  await mode.selectOption("MOCK");
  await mode.evaluate((el) => (el as HTMLSelectElement).form!.requestSubmit());
  await page.waitForURL(/\/app\/settings\?ok=1/);
  // A ficha mestre da piscina, gravada com o incoterm FOB, leva também o
  // fornecedor, o material, o MOQ e a caixa do cadastro: o quadro de
  // exemplo diverge deles (e só preenche o que está vazio). Sem ficha
  // gravada, a leitura só preencheria. A jarra fica de fora: a leitura
  // gravaria nela o MOQ de exemplo, e outro teste pede a jarra abaixo dele.
  await gotoProduct(page, "prod-piscina");
  // A ficha vem em blocos, um por vez: abre todos.
  const one = page.locator("button[data-sheet-sections-mode=one]");
  if (await one.count()) await one.click();
  await expect(
    page.locator("button[data-sheet-sections-mode=all]"),
  ).toBeVisible();
  await page
    .locator('#product-sheet-form select[name="incoterm"]')
    .selectOption("FOB");
  await Promise.all([
    page.waitForURL(/[?&]sheet=(partial|complete)/),
    page
      .locator("#product-sheet-form")
      .getByRole("button", { name: /Salvar ficha mestre/ })
      .click(),
  ]);
  await gotoProduct(page, "prod-piscina");
  const board = page.locator('[data-sheet-board="product"]');
  // Um toque: escolhida a foto, a leitura começa sozinha.
  await board.locator('input[name="photo"]').setInputFiles(png);
  await page.waitForURL(/[?&]board=\d+-\d+/);
  await expect(page.locator("[data-board-done]")).toBeVisible();
  await expect(page.locator("[data-board-photo]")).toBeVisible();
  const list = page.locator("[data-board-divergences]");
  // O quadro de exemplo diverge da ficha mestre (fornecedor, material, MOQ).
  await expect(list).toBeVisible();
  const before = Number(await list.getAttribute("data-board-divergences"));
  const first = list.locator("[data-board-divergence]").first();
  await first
    .getByRole("button", {
      name: /Vale o da ficha|Sheet is right|以采购单为准/,
    })
    .click();
  await page.waitForURL(/[?&]board=resolved/);
  await expect(page.locator("[data-board-resolved]")).toBeVisible();
  if (before > 1)
    await expect(page.locator("[data-board-divergences]")).toHaveAttribute(
      "data-board-divergences",
      String(before - 1),
    );
  else await expect(page.locator("[data-board-ok]")).toBeVisible();
});

test("vitrine: busca, página do produto, carrinho e pedido de orçamento", async ({
  page,
}) => {
  await login(page, "joao@lojista.com");
  // Carrinho vazio para começar (o banco do E2E pode vir de outra rodada).
  await page.goto("/app/explore/cart");
  const leftovers = page.locator("[data-cart-remove]");
  while ((await leftovers.count()) > 0) {
    const before = await leftovers.count();
    await leftovers.first().click();
    await expect(leftovers).toHaveCount(before - 1);
  }
  await page.goto("/app");
  await page.waitForURL(/\/app\/explore$/);
  await expect(
    page.locator('[data-explore-product="prod-panela"]'),
  ).toBeVisible();
  // Nada do fornecedor nem do preço de compra na vitrine do cliente.
  await expect(page.locator("[data-explore]")).not.toContainText("Shenzhen");
  await expect(page.locator("[data-explore-missing]")).toHaveCount(0);

  // Busca sem acento e sem maiúscula.
  await page.fill("[data-explore-search]", "PANELAS");
  await page.keyboard.press("Enter");
  await page.waitForURL(/[?&]q=PANELAS/);
  await expect(page.locator("[data-explore-product]")).toHaveCount(1);

  // Página do produto: quantidade e personalização, depois o carrinho.
  await page.locator('[data-explore-product="prod-panela"] a').first().click();
  await page.waitForURL(/\/app\/explore\/prod-panela/);
  await expect(page.locator("h1")).toContainText("Jogo de panelas");
  await page.fill("[data-quantity-input]", "300");
  // Abaixo do pedido mínimo (500): avisa enquanto digita (ao sair do campo,
  // voltaria ao mínimo); aqui corrigimos para 600 antes de sair.
  await expect(page.locator("[data-below-moq]")).toBeVisible();
  await page.fill("[data-quantity-input]", "600");
  await expect(page.locator("[data-below-moq]")).toHaveCount(0);
  await page.fill("#explore-notes", "Logo da loja na caixa");
  await page.locator("[data-explore-add-detail]").click();
  await page.waitForURL(/[?&]added=prod-panela/);
  await expect(page.locator("[data-explore-added]")).toBeVisible();
  await expect(page.locator("[data-explore-cart-link]")).toHaveAttribute(
    "data-explore-cart-link",
    "1",
  );

  // Direto do card da vitrine: o botão diz a quantidade (pedido mínimo) e o
  // card mostra "No carrinho" no lugar (a tela volta para ele).
  await page.goto("/app/explore");
  await expect(page.locator('[data-explore-add="prod-boneca"]')).toContainText(
    "2.000 un",
  );
  await page.locator('[data-explore-add="prod-boneca"]').click();
  await page.waitForURL(/[?&]added=prod-boneca/);
  await expect(
    page.locator('[data-explore-in-cart="prod-boneca"]'),
  ).toBeVisible();
  await expect(page.locator("[data-explore-cart-link]")).toHaveAttribute(
    "data-explore-cart-link",
    "2",
  );

  // Carrinho: muda a quantidade e envia para orçamento.
  await page.goto("/app/explore/cart");
  await expect(page.locator("[data-cart-line]")).toHaveCount(2);
  // As observações do envio, já digitadas, ficam ao mudar um item.
  await page.fill("[data-cart-notes]", "Entrega em Curitiba");
  await page.fill('[data-cart-quantity="prod-boneca"]', "2500");
  await page.locator('[data-cart-update="prod-boneca"]').click();
  await expect(page.locator('[data-cart-line="prod-boneca"]')).toHaveAttribute(
    "data-cart-qty",
    "2500",
  );
  // Sair do campo já grava (sem precisar de "Atualizar").
  await page.fill('[data-cart-quantity="prod-panela"]', "800");
  await page.locator("[data-cart-notes]").click();
  await expect(page.locator('[data-cart-line="prod-panela"]')).toHaveAttribute(
    "data-cart-qty",
    "800",
  );
  await expect(page.locator("[data-cart-notes]")).toHaveValue(
    "Entrega em Curitiba",
  );
  await page.fill("[data-cart-deadline]", "2099-12-20");
  await page.locator("[data-cart-checkout]").click();
  await page.waitForURL(/\/app\/requests\/batch\/.+fromCart=1/);
  await expect(page.locator("[data-batch-created]")).toContainText(
    "Pedido de orçamento enviado",
  );
  await expect(page.locator("main")).toContainText("Jogo de panelas");
  await expect(page.locator("main")).toContainText("Boneca articulada");
  await page.goto("/app/explore/cart");
  await expect(page.getByText("Seu carrinho está vazio.")).toBeVisible();

  // "Solicitar orçamento agora": só aquele produto, sem passar pelo carrinho.
  await page.goto("/app/explore/prod-piscina");
  await page.fill("[data-quantity-input]", "400");
  await page.locator("[data-explore-buy-now]").click();
  await page.waitForURL(/\/app\/requests\/[^/]+\?fromCart=1/);
  await expect(page.locator("[data-cart-sent]")).toBeVisible();
  await expect(page.locator("h1")).toContainText("Piscina");

  // Wellmix vê a vitrine como o cliente, sem carrinho, e o que falta no preço.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/explore");
  await expect(page.getByText(/vitrine como o cliente vê/)).toBeVisible();
  await expect(page.locator("[data-explore-add]")).toHaveCount(0);
  await expect(
    page.locator('[data-explore-product="prod-jarra"] [data-explore-missing]'),
  ).toBeVisible();
});
