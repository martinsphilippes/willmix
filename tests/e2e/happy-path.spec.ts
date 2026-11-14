import { expect, test, type Page, type Route } from "@playwright/test";
import {
  approveMilestoneRows,
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
 * Ordem dos blocos no detalhe do pedido (dono, 14/11/2026), no login do
 * despachante, no desktop, no iPad e no celular: Documentos logo depois de
 * Etapas do pedido; a Certificação no meio, na ordem de antes; Embarque e
 * desembaraço por último. A linha da tabela e o link Documentos da
 * Certificação levam às posições novas.
 */
async function expectOrderBlocks(page: Page, orderUrl: string) {
  const initial = page.viewportSize();
  for (const size of [
    { width: 1440, height: 900 },
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.goto(orderUrl);
    const layout = await page.evaluate(() => {
      const stages = document.querySelector(
        '[data-order-section="order-stages"]',
      );
      const docs = document.querySelector(
        '[data-order-section="order-documents"]',
      );
      const cert = document.getElementById("certification");
      const flow = document.querySelector("[data-order-import-flow]");
      const main = document.querySelector("main");
      if (!stages || !docs || !cert || !flow || !main) return null;
      const follows = (a: Element, b: Element) =>
        !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return {
        docsRightAfterStages: stages.nextElementSibling === docs,
        certAfterDocs: follows(docs, cert),
        flowAfterCert: follows(cert, flow),
        // Nenhuma seção de conteúdo depois do Embarque e desembaraço.
        sectionsAfterFlow: [...main.querySelectorAll("section")].filter(
          (el) => !flow.contains(el) && follows(flow, el),
        ).length,
      };
    });
    expect(layout, `${size.width}×${size.height}`).toEqual({
      docsRightAfterStages: true,
      certAfterDocs: true,
      flowAfterCert: true,
      sectionsAfterFlow: 0,
    });
    // Linha "Embarque e desembaraço" da tabela: leva ao quadro no fim.
    await page
      .locator('[data-order-part="import"] [data-order-part-open="import"]')
      .click();
    await expect(page).toHaveURL(/#import-flow$/);
    await expect(page.locator("#import-flow")).toBeInViewport();
    // Link "Documentos" da Certificação: leva à tabela embaixo das etapas.
    await page
      .locator('[data-certifier-dossier] a[href="#order-documents"]')
      .click();
    await expect(page).toHaveURL(/#order-documents$/);
    await expect(
      page.locator('[data-order-section="order-documents"] h2'),
    ).toBeInViewport();
  }
  if (initial) await page.setViewportSize(initial);
}

/**
 * Documentos do pedido (no lugar novo): abrir o arquivo registra
 * "Visualizado" e não confirma; confirmar a leitura é o botão.
 */
async function expectDocumentAck(page: Page, orderUrl: string) {
  await page.goto(orderUrl);
  const docs = page.locator('[data-order-section="order-documents"]');
  const href = await docs
    .locator("[data-order-document]", { has: page.locator("form button") })
    .first()
    .locator("a[href^='/api/files/']")
    .getAttribute("href");
  expect(href).toBeTruthy();
  expect((await page.request.get(href!)).status()).toBe(200);
  await page.goto(orderUrl);
  const row = docs.locator("[data-order-document]", {
    has: page.locator(`a[href="${href}"]`),
  });
  await expect(row).toContainText(/Visualizado \d{2}\/\d{2}\/\d{4}/);
  const confirm = row.getByRole("button", { name: "Confirmar leitura" });
  await expect(confirm).toBeVisible();
  await Promise.all([page.waitForLoadState("load"), confirm.click()]);
  await expect(row).toContainText("Leitura confirmada");
  await expect(
    row.getByRole("button", { name: "Confirmar leitura" }),
  ).toHaveCount(0);
}

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

/** Passo do cartão de embarque ou do container na origem: preenche e envia. */
async function sendStep(
  page: Page,
  orderUrl: string,
  anchor: "import-flow" | "container-origin" | "samples-flow",
  key: string,
  input: { value?: string; file?: boolean },
) {
  await page.goto(`${orderUrl}#${anchor}`);
  await page.waitForLoadState("networkidle");
  const row = page.locator(`#${anchor}-step-${key}`);
  if (input.value !== undefined)
    await row.locator("input[name=value]").fill(input.value);
  if (input.file) await row.locator("input[type=file]").setInputFiles(pdf);
  await Promise.all([
    page.waitForURL(/importStep=submitted/),
    row.locator(`[data-import-submit="${key}"]`).click(),
  ]);
}

async function validateStep(
  page: Page,
  orderUrl: string,
  anchor: "import-flow" | "container-origin" | "samples-flow",
  key: string,
) {
  await page.goto(`${orderUrl}#${anchor}`);
  await page.waitForLoadState("networkidle");
  await Promise.all([
    page.waitForURL(/importStep=validated/),
    page
      .locator(`#${anchor}-step-${key} [data-import-validate="${key}"]`)
      .click(),
  ]);
}

/** Pesos que faltarem no cadastro: o fornecedor completa no documento. */
async function fillMissingWeights(
  page: Page,
  form: ReturnType<Page["locator"]>,
) {
  for (const [prefix, value] of [
    ["pieces_", "1"],
    ["netKg_", "1"],
    ["grossKg_", "1.2"],
  ] as const) {
    const inputs = form.locator(`input[name^="${prefix}"]`);
    for (let i = 0; i < (await inputs.count()); i++)
      if (!(await inputs.nth(i).inputValue())) await inputs.nth(i).fill(value);
  }
}

test("booking → seleção → solicitação ao fornecedor → produto → pedido de compra → raias → contrato → pagamento → inspeção → embarque → desembaraço → transporte → entrega", async ({
  page,
}) => {
  // Caminho inteiro, do Booking à entrega (com o container e os documentos do embarque).
  test.slow();
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

  // Overview do Produto novo pelos books e solicitações (docs/FLOW_MENU.md):
  // a solicitação aberta está em Negociações e abre na linha do tempo dela;
  // os books fechados estão na Seleção de itens.
  await page.goto("/app/flow/new-product");
  await expect(page.locator("[data-flow-kpis]")).toBeVisible();
  await expect(page.locator("[data-flow-general-block]")).toHaveCount(4);
  await expect(
    page.locator('[data-flow-entity-kind="book"]').first(),
  ).toBeVisible();
  await page.locator('[data-flow-timeline-step="negotiations"]').click();
  await page.waitForURL(/step=negotiations/);
  const npRow = page.locator(
    `[data-flow-entity="${requestId}"][data-flow-entity-kind="request"]`,
  );
  await expect(npRow.locator("[data-flow-entity-block]")).toHaveAttribute(
    "data-flow-entity-block",
    "25",
  );
  await npRow.locator("[data-flow-entity-open]").click();
  await page.waitForURL(new RegExp(`/app/supplier-requests/${requestId}`));
  await expect(
    page.locator('[data-entity-timeline-step="negotiations"]'),
  ).toHaveAttribute("data-entity-timeline-state", "current");
  await expect(
    page.locator('[data-entity-timeline-block="order"]'),
  ).toBeVisible();

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
  // Brinquedos exige Inmetro (mapa do processo, P6): o pedido terá o
  // certificado e a arte final com o selo.
  await page.selectOption("[data-request-product-line]", "linha-brinquedos");
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
  // Certificação no login responsável (docs/CERTIFICATION.md, seção 13): o
  // memorial e o selo são da certificadora (OCP) do pedido (dono,
  // 14/11/2026); o analista do pedido (quem gerou) não recebe nenhum dos dois.
  const orderPath = new URL(orderUrl).pathname;
  const certFeaturedTask = `[data-task-row] a[href="${orderPath}#certification-featured"]`;
  await page.goto("/app/tasks");
  // (A lista pagina no navegador: as linhas das outras páginas também contam.)
  await expect(page.locator(certFeaturedTask)).toHaveCount(0);
  await page.goto(orderUrl);
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

  // 5b. Cadastro e fiscal (mapa, P9/P14): o contrato espera o NCM validado e
  // a ficha mestre completa. O sistema confere; o atalho leva à tela dona.
  // A mesa do cadastro mostra o NCM e a ficha a fazer (docs/DESKS.md).
  await page.goto("/app/tasks");
  await page.locator("[data-desk-link]").click();
  await page.goto("/app/tasks/desk?desk=cadastro");
  await expect(
    page.locator("[data-desk-queue=ncm] [data-desk-row]").first(),
  ).toBeVisible();
  await page.goto(orderUrl);
  const ncmGate = page.locator("[data-requirement-gate=ncm_validated]");
  await expect(ncmGate).toBeVisible();
  const taxUrl = (await ncmGate.getAttribute("href"))!;
  const productId = taxUrl.split("/")[3];
  await page.goto(taxUrl);
  const taxAdd = page.locator("form[data-tax-add]");
  await taxAdd.locator("input[name=ncm]").fill("7013.37.00");
  await Promise.all([
    page.waitForLoadState("networkidle"),
    taxAdd.locator("button[type=submit]").click(),
  ]);
  await page.goto(taxUrl);
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.locator("form[data-tax-validate] button[type=submit]").first().click(),
  ]);
  // Ficha: as cinco fotos obrigatórias e a cor.
  for (const kind of [
    "weight_scale",
    "dimension_scale",
    "dimension_side",
    "angle",
    "original",
  ]) {
    await gotoProduct(page, productId);
    await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "POST" && r.status() < 400,
      ),
      page
        .locator(`[data-sheet-photo="${kind}"] input[type=file]`)
        .first()
        .setInputFiles(png),
    ]);
    await page.waitForLoadState("networkidle");
  }
  await gotoProduct(page, productId);
  // O cadastro fica em quadros recolhidos: abre todos.
  await page
    .locator("#product-form details[data-fold-card]")
    .evaluateAll((els) =>
      els.forEach((el) => ((el as HTMLDetailsElement).open = true)),
    );
  await page.locator("#product-form input[name=color]").fill("Transparente");
  await Promise.all([
    page.waitForURL(/[?&]saved=1/),
    page.locator("#product-form button[type=submit]").last().click(),
  ]);
  await page.goto(orderUrl);
  await expect(requirementRow(page, /^NCM validado/)).toContainText(
    /Concluído/,
  );
  await expect(requirementRow(page, /^Ficha mestre completa/)).toContainText(
    /Concluído/,
  );

  // 6. As raias, em paralelo. A arte espera a faca e a foto em alta; a arte
  // final espera a validação e o certificado; a validação espera a arte.
  await page.goto(orderUrl);
  await expect(requirementRow(page, /Arte final com o selo/)).toContainText(
    /Pendente/,
  );
  // 6a. Fornecedor: faca, foto em alta, MOQ e prazo.
  await login(page, "supplier.a@china.com");
  await page.goto(orderUrl);
  await expect(requirementRow(page, /Faca \(die cut\)/).first()).toBeVisible();
  // Na seção ele vê só a faca, a foto em alta e o prazo (dono, 13/11/2026).
  // Sem prazo na resposta à solicitação, o campo do prazo vem vazio.
  const prep = page.locator('[data-stage-tasks="PREPARATION"]');
  await expect(prep.locator("li:not([data-die-cut-link])")).toHaveCount(3);
  await expect(prep).not.toContainText(/MOQ|Arte|Certificado|Validação/);
  const leadTimeRow = requirementRow(page, /Prazo de produção confirmado/);
  await expect(leadTimeRow.locator("input[name=value]")).toHaveValue("");
  // A pendência dele cai na etapa "Die Cut" e abre o quadro do pedido, com
  // os quatro itens do produto: die-cut, foto em alta, pedido mínimo e prazo.
  await page.goto("/app/tasks");
  // Certificação e artes não são dele: nenhuma dessas pendências aparece.
  await expect(
    page.locator(
      `[data-task-row] a[href*="${orderPath}#certification"], [data-task-row] a[href*="${orderPath}#artwork"]`,
    ),
  ).toHaveCount(0);
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
  // "+" (dono, 14/11/2026): mais uma foto em cada seção, como anexo próprio;
  // as duas continuam ao recarregar, a faca (PDF) inclusive. Excluir uma
  // tira só ela.
  for (const item of ["dieline", "hd"] as const) {
    const section = board.locator(`[data-die-cut-item="${item}"]`);
    const add = section.locator(`[data-die-cut-add="${item}"]`);
    // Nome acessível do "+" (o fornecedor de teste usa o portal em chinês).
    await expect(add.locator("input[type=file]")).toHaveAttribute(
      "aria-label",
      /^(Adicionar foto|Add photo|添加照片)$/,
    );
    await add.locator("input[type=file]").setInputFiles(png);
    await page.waitForURL(/saved=photo/);
    await expect(section.locator("[data-die-cut-file]")).toHaveCount(2);
    await expect(section).toHaveAttribute("data-done", "yes");
  }
  await page.reload();
  await expect(
    board.locator('[data-die-cut-item="dieline"] [data-die-cut-file]'),
  ).toHaveCount(2);
  await expect(
    board.locator('[data-die-cut-item="dieline"] [data-die-cut-file]').first(),
  ).toContainText(".pdf");
  await expect(
    board.locator('[data-die-cut-item="hd"] [data-die-cut-file] img'),
  ).toHaveCount(2);
  // Exclui só a segunda foto em alta.
  const hdFiles = board.locator('[data-die-cut-item="hd"] [data-die-cut-file]');
  page.once("dialog", (d) => d.accept());
  await hdFiles.nth(1).locator("button").click();
  await expect(hdFiles).toHaveCount(1);
  await expect(board.locator('[data-die-cut-item="hd"]')).toHaveAttribute(
    "data-done",
    "yes",
  );
  // O pedido mínimo e o prazo vêm com o negociado; ele corrige o prazo.
  const termsItem = board.locator('[data-die-cut-item="terms"]');
  const terms = termsItem.locator("[data-die-cut-terms]");
  await expect(terms.locator("input[name=moq]")).toHaveValue("2000");
  await terms.locator("input[name=leadTimeDays]").fill("45");
  await terms.getByRole("button").click();
  await page.waitForURL(/saved=terms/);
  await expect(board).toHaveAttribute("data-complete", "yes");
  // Confirmado (dono, 13/11/2026): no lugar do formulário, o resumo com o
  // selo, os valores e quem confirmou, sem o botão de confirmar e sem o
  // "confira os números". Recarregar mostra o mesmo (vem do registro
  // salvo). O fornecedor do teste lê em chinês.
  const termsValues = termsItem.locator("[data-die-cut-terms-values]");
  const editTerms = termsItem.locator("[data-die-cut-terms-edit]");
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await expect(terms).toHaveCount(0);
    await expect(termsItem).toContainText("已确认");
    await expect(termsValues).toHaveText("2,000 件 · 45 天");
    await expect(termsItem.locator("[data-die-cut-terms-by]")).toContainText(
      "Li Wei",
    );
    await expect(termsItem).not.toContainText("请核对数字");
    await expect(editTerms).toBeVisible();
  }
  // "Editar" abre o formulário com os valores salvos (foco no primeiro
  // campo); "Cancelar" volta ao resumo.
  await editTerms.click();
  await expect(terms.locator("input[name=moq]")).toBeFocused();
  await expect(terms.locator("input[name=moq]")).toHaveValue("2000");
  await expect(terms.locator("input[name=leadTimeDays]")).toHaveValue("45");
  await terms.locator("[data-die-cut-terms-cancel]").click();
  await expect(terms).toHaveCount(0);
  await expect(editTerms).toBeFocused();
  // Recusa: o que foi digitado fica e o erro aparece junto ao formulário,
  // sem trocar de tela.
  await editTerms.click();
  await terms.locator("input[name=moq]").fill("0");
  const beforeRefusal = page.url();
  await terms.locator("button[type=submit]").click();
  await expect(
    terms.locator('[data-die-cut-terms-error="invalid_moq"]'),
  ).toContainText("起订量无效");
  await expect(terms.locator("input[name=moq]")).toHaveValue("0");
  await expect(terms.locator("input[name=moq]")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(terms.locator("input[name=leadTimeDays]")).toHaveValue("45");
  expect(page.url()).toBe(beforeRefusal);
  // Enquanto envia, o botão fica desativado (sem clique repetido); salvo,
  // volta o resumo. Mesmos valores: nada muda para a Wellmix.
  const slowSave = async (route: Route) => {
    if (route.request().method() === "POST")
      await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  };
  await page.route(/\/die-cut/, slowSave);
  await terms.locator("input[name=moq]").fill("2000");
  await terms.locator("button[type=submit]").click();
  await expect(terms.locator("button[type=submit]")).toBeDisabled();
  await expect(terms).toHaveCount(0);
  await page.unroute(/\/die-cut/, slowSave);
  await expect(termsValues).toHaveText("2,000 件 · 45 天");
  // Nada mais dele na Preparação: o pedido mostra os quatro concluídos.
  await page.goto(orderUrl);
  await expect(page.locator("[data-die-cut-link]")).toBeVisible();
  await expect(requirementRow(page, /Faca \(die cut\)/).first()).toContainText(
    /doc\.pdf/,
  );
  // O prazo confirmado aparece na linha, sem o campo.
  await expect(leadTimeRow).toContainText("45");
  await expect(leadTimeRow.locator("input[name=value]")).toHaveCount(0);
  await fillMyRequirements(page, orderUrl);
  // 6b. Agência: com a faca e a foto em alta, envia a arte. A arte final com
  // o selo ainda não sobe (falta a arte validada e o certificado): a linha
  // diz o que ela aguarda.
  await login(page, "agencia@design.com");
  await fillMyRequirements(page, orderUrl, {}, 1);
  await page.goto(orderUrl);
  await expect(requirementRow(page, /^Arte ·/)).toContainText(/Concluído/);
  await expect(
    requirementRow(page, /Arte final com o selo/).locator(
      "[data-requirement-waiting]",
    ),
  ).toContainText(/Aguarda/);
  // 6c. A Wellmix devolve a arte com o motivo; a agência reenvia.
  await login(page, "admin@wellmix.com");
  await page.goto(orderUrl);
  const review = requirementRow(page, /Validação da arte pela Wellmix/);
  // Quem valida abre a arte enviada na própria linha da validação.
  await expect(review.locator("[data-lane-inputs] a")).toHaveCount(1);
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
  // A Wellmix valida a arte reenviada na tela do passo Pedido → Arte (menu
  // por blocos, docs/FLOW_MENU.md): o menu conta a validação, a tela traz a
  // arte enviada e o aprovar; a ação volta para a tela do passo.
  await login(page, "admin@wellmix.com");
  // Aba "Todos no passo": todos os pedidos no passo, de qualquer
  // responsável, com o link para o detalhe (docs/FLOW_MENU.md).
  await page.goto("/app/flow/order/art?tab=all");
  const allOrderId = new URL(orderUrl, "http://x").pathname.split("/").pop()!;
  await expect(
    page.locator('[data-flow-tab="all"][aria-current="page"]'),
  ).toBeVisible();
  await expect(
    page
      .locator(`[data-flow-all-order="${allOrderId}"] [data-flow-all-view]`)
      .first(),
  ).toHaveAttribute("href", `/app/flow/order/art/${allOrderId}`);
  // O pedido na tela do passo: tudo do passo para ele (feito e aberto).
  await page
    .locator(`[data-flow-all-order="${allOrderId}"] [data-flow-all-view]`)
    .first()
    .click();
  await page.waitForURL(new RegExp(`/app/flow/order/art/${allOrderId}$`));
  await expect(page.locator(`[data-flow-order="${allOrderId}"]`)).toBeVisible();
  await expect(
    page.locator('[data-flow-order-requirement^="art"]').first(),
  ).toBeVisible();
  // No passo Pedidos (onde o pedido é criado): só a criação, com os itens.
  await page.goto(`/app/flow/order/orders/${allOrderId}`);
  await expect(page.locator("[data-flow-order-item]").first()).toBeVisible();
  await expect(page.locator("[data-production-card]")).toHaveCount(0);
  // Overview do bloco pelos pedidos (docs/FLOW_MENU.md, 14/11/2026): KPIs,
  // a linha do tempo geral, o passo com o número de pedidos e a tabela com a
  // completude; o pedido abre na linha do tempo dele, com o bloco em foco.
  await page.goto("/app/flow/order");
  await expect(page.locator("[data-flow-kpis]")).toBeVisible();
  await expect(page.locator("[data-flow-general-block]")).toHaveCount(4);
  await expect(
    page.locator('[data-flow-timeline-step="art"]'),
  ).not.toHaveAttribute("data-flow-entities", "0");
  await page.locator('[data-flow-timeline-step="art"]').click();
  await page.waitForURL(/step=art/);
  const entity = page.locator(`[data-flow-entity="${allOrderId}"]`);
  await expect(entity.locator("[data-flow-entity-block]")).toBeVisible();
  await expect(entity.locator("[data-flow-entity-overall]")).toBeVisible();
  await entity.locator("[data-flow-entity-open]").click();
  await page.waitForURL(/from=order/);
  await expect(page.locator('[data-order-progress="order"]')).toBeVisible();
  await expect(
    page.locator('[data-order-progress-block="order"]'),
  ).toHaveAttribute("aria-current", "step");
  await expect(
    page.locator('[data-order-progress-stage="PACKAGING"]'),
  ).toBeVisible();
  // Pedido → Arte (dono, 14/11/2026), o padrão da Certificação: só a lista,
  // uma linha por produto, sem os cartões dos pedidos embaixo. O "Resolver"
  // abre o produto no pedido no passo, onde a Wellmix valida a arte
  // reenviada; a ação volta ao mesmo produto, e a lista, a aba e o menu
  // contam uma a menos.
  await page.goto("/app/flow/order/art");
  await expect(
    page.locator('[data-flow-tab="pending"][aria-current="page"]'),
  ).toBeVisible();
  const artBadge = page
    .locator('[data-nav-link="/app/flow/order/art"] [data-nav-badge]')
    .filter({ visible: true })
    .first();
  await expect(artBadge).toBeVisible();
  await expect(
    page.locator(
      "[data-flow-requirements], [data-flow-artwork], [data-flow-work]",
    ),
  ).toHaveCount(0);
  const orderId = new URL(orderUrl, "http://x").pathname.split("/").pop()!;
  const artRows = page.locator("[data-flow-case]");
  const rowsBefore = await artRows.count();
  // O menu conta o mesmo que a lista mostra (uma linha por produto).
  expect(Number(await artBadge.getAttribute("data-nav-badge"))).toBe(
    rowsBefore,
  );
  await expect(page.locator('[data-flow-tab="pending"]')).toContainText(
    `(${rowsBefore})`,
  );
  const artRow = page.locator(
    `[data-flow-case][data-flow-case-order="${orderId}"][data-flow-case-item]`,
  );
  await expect(artRow).toHaveCount(1);
  const artItem = (await artRow.getAttribute("data-flow-case-item"))!;
  await Promise.all([
    page.waitForURL(
      new RegExp(`/app/flow/order/art/${orderId}\\?item=${artItem}$`),
    ),
    artRow.locator("[data-flow-case-open]").click(),
  ]);
  await expect(page.locator("[data-flow-order-focus]")).toBeVisible();
  const artReview = page.locator(
    `[data-flow-order-requirement="art_review__${artItem}"]`,
  );
  await expect(artReview).toHaveAttribute("data-status", "pending");
  // Quem valida abre a arte enviada na própria linha.
  await expect(artReview.locator('a[href^="/api/files/"]')).toHaveCount(1);
  await artReview.locator("button[value=approve]").click();
  await expect(artReview).toHaveAttribute("data-status", "done");
  expect(page.url()).toContain(`item=${artItem}`);
  await page.goto("/app/flow/order/art");
  await expect(artRow).toHaveCount(0);
  await expect(artRows).toHaveCount(rowsBefore - 1);
  await expect(page.locator('[data-flow-tab="pending"]')).toContainText(
    `(${rowsBefore - 1})`,
  );
  if (rowsBefore > 1)
    await expect(artBadge).toHaveAttribute(
      "data-nav-badge",
      String(rowsBefore - 1),
    );
  else await expect(artBadge).toHaveCount(0);
  await page.goto(orderUrl);
  await expect(
    requirementRow(page, /Validação da arte pela Wellmix/),
  ).toContainText(/Concluído/);
  // 6d. Certificadora (OCP) do pedido: o certificado das raias e, no cartão
  // Certificação, o memorial e o selo (dono, 14/11/2026). O despachante não
  // envia nenhum deles.
  await login(page, "despachante@comex.com");
  await page.goto(orderUrl);
  await expect(
    requirementRow(page, /^Certificado/).locator(
      "form:has(input[name=requirementId])",
    ),
  ).toHaveCount(0);
  // Detalhe do pedido no login do despachante (dono, 14/11/2026): a ordem
  // dos blocos, os atalhos e a confirmação de leitura dos documentos.
  await expectOrderBlocks(page, orderUrl);
  await expectDocumentAck(page, orderUrl);
  await login(page, "ocp@certifica.com");
  // Pedido → Certificação (dono, 14/11/2026): a tela do passo é só a lista,
  // uma linha por produto, com as abas, os filtros e os contadores, sem os
  // cartões dos pedidos embaixo. O "Resolver" da linha abre o produto no
  // detalhe do pedido no passo, com a foto e o arquivo para enviar, e o
  // envio volta ao mesmo produto.
  await page.goto("/app/flow/order/certification");
  await expect(page.locator("[data-flow-tab]")).toHaveCount(2);
  await expect(page.locator("[data-flow-filter]")).toHaveCount(4);
  await expect(page.locator("[data-flow-requirements]")).toHaveCount(0);
  await expect(page.locator("[data-flow-work]")).toHaveCount(0);
  const certRow = page.locator(
    `[data-flow-case][data-flow-case-order="${orderId}"][data-flow-case-item]`,
  );
  await expect(certRow).toHaveCount(1);
  const certItem = (await certRow.getAttribute("data-flow-case-item"))!;
  await Promise.all([
    page.waitForURL(
      new RegExp(
        `/app/flow/order/certification/${orderId}\\?item=${certItem}$`,
      ),
    ),
    certRow.locator("[data-flow-case-open]").click(),
  ]);
  await expect(page.locator("[data-flow-order-focus]")).toBeVisible();
  await expect(page.locator("[data-flow-order-requirement]")).toHaveCount(1);
  const certReq = page.locator(
    `[data-flow-order-requirement="certificate__${certItem}"]`,
  );
  await expect(certReq).toHaveAttribute("data-flow-order-item", certItem);
  const certForms = certReq.locator("[data-requirement-upload] form");
  await expect(certForms).toHaveCount(2);
  await Promise.all([
    page.waitForURL(/[?&]saved=1/),
    certForms.last().locator("input[type=file]").setInputFiles(pdf),
  ]);
  expect(page.url()).toContain(`item=${certItem}`);
  await expect(certReq).not.toHaveAttribute("data-status", "pending");
  await fillMyRequirements(page, orderUrl);
  // Memorial e selo: as pendências são dela e levam ao quadro do alto do
  // cartão Certificação, onde ela preenche e envia os dois.
  await page.goto("/app/tasks");
  await expect(page.locator(certFeaturedTask)).not.toHaveCount(0);
  for (const key of ["cert_memorial", "cert_seal"] as const) {
    await page.goto(`${orderUrl}#certification`);
    await page.waitForLoadState("networkidle");
    const box = page.locator(`[data-import-featured="${key}"]`);
    if (key === "cert_seal")
      await box.locator("input[name=value]").fill("SELO-E2E-1");
    await box.locator("input[type=file]").setInputFiles(pdf);
    await Promise.all([
      page.waitForURL(/certStep=submitted/),
      box.locator(`[data-import-submit="${key}"]`).click(),
    ]);
  }
  await page.goto("/app/tasks");
  await expect(page.locator(certFeaturedTask)).toHaveCount(0);
  // Depois do envio, cada quadro recolhe (também ao recarregar): sem "Enviar
  // de novo", com o botão "Substituir arquivo". Cancelar e falhar mantêm o
  // arquivo atual; trocar atualiza o link, diz "Arquivo substituído" e
  // mantém o número do selo.
  await page.goto(`${orderUrl}#certification`);
  await page.reload();
  const sealBox = page.locator('[data-import-featured="cert_seal"]');
  for (const key of ["cert_memorial", "cert_seal"] as const) {
    const box = page.locator(`[data-import-featured="${key}"]`);
    await expect(box).toHaveAttribute("data-import-featured-state", "sent");
    await expect(box.locator("[data-import-submit]")).toHaveCount(0);
    await expect(box).not.toContainText("Enviar de novo");
    await expect(box.locator(`[data-replace-start="${key}"]`)).toBeVisible();
  }
  await expect(sealBox.locator("[data-import-featured-value]")).toContainText(
    "SELO-E2E-1",
  );
  const sealLink = sealBox.locator("[data-import-featured-file]");
  const firstSeal = await sealLink.getAttribute("href");
  const pickSeal = async (file: typeof pdf) => {
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      sealBox.locator('[data-replace-start="cert_seal"]').click(),
    ]);
    await chooser.setFiles(file);
    await expect(sealBox.locator("[data-replace-name]")).toHaveText(file.name);
  };
  await pickSeal({ ...pdf, name: "selo-v2.pdf" });
  await sealBox.locator("[data-replace-cancel]").click();
  await expect(sealBox.locator("[data-replace-start]")).toBeVisible();
  await expect(sealLink).toHaveAttribute("href", firstSeal!);
  // Falha no envio (arquivo vazio, recusado pelo servidor).
  await pickSeal({ ...pdf, name: "vazio.pdf", buffer: Buffer.alloc(0) });
  await Promise.all([
    page.waitForURL(/replaceFailed=cert_seal/),
    sealBox.locator("[data-replace-confirm]").click(),
  ]);
  await expect(sealBox.locator("[data-import-replace-failed]")).toBeVisible();
  await expect(sealLink).toHaveAttribute("href", firstSeal!);
  await pickSeal({ ...pdf, name: "selo-v2.pdf" });
  await Promise.all([
    page.waitForURL(/certReplaced=cert_seal/),
    sealBox.locator("[data-replace-confirm]").click(),
  ]);
  await expect(sealBox.locator("[data-import-replaced]")).toHaveText(
    "Arquivo substituído",
  );
  await expect(sealLink).not.toHaveAttribute("href", firstSeal!);
  await expect(sealBox.locator("[data-import-featured-value]")).toContainText(
    "SELO-E2E-1",
  );
  // O despachante vê o cartão, mas não envia nem substitui.
  await login(page, "despachante@comex.com");
  await page.goto(`${orderUrl}#certification`);
  await expect(sealBox).toBeVisible();
  await expect(
    page.locator(
      "#certification-featured [data-replace-start], #certification-featured [data-import-submit]",
    ),
  ).toHaveCount(0);
  // O Comprador acompanha o mesmo pedido: a situação, quem faz e os arquivos
  // enviados, sem campo, seletor de arquivo nem botão de envio (o servidor
  // também recusa: tests/unit/cert-seal.test.ts).
  await login(page, "operador@wellmix.com");
  await page.goto(`${orderUrl}#certification`);
  for (const key of ["cert_memorial", "cert_seal"] as const) {
    const box = page.locator(`[data-import-featured="${key}"]`);
    await expect(box).toBeVisible();
    await expect(box.locator("form, input, [data-import-submit]")).toHaveCount(
      0,
    );
    const file = box.locator("[data-import-featured-file]");
    await expect(file).toBeVisible();
    const opened = await page.request.get((await file.getAttribute("href"))!);
    expect(opened.status()).toBe(200);
    const row = page.locator(`#certification-step-${key}`);
    await expect(row).toContainText("Faz: OCP");
    await expect(
      row.locator("form, input, [data-import-submit], a[href$='-featured']"),
    ).toHaveCount(0);
  }
  await expect(page.locator("#certification-step-cert_seal")).toContainText(
    "SELO-E2E-1",
  );
  // 6e. Agência: com a arte validada e o certificado, a arte final com o selo.
  await login(page, "agencia@design.com");
  await fillMyRequirements(page, orderUrl);
  // 6f. Aprovações do mapa no fim dos marcos (docs/MILESTONES.md): o GP
  // aprova o cadastro e a certificação, o Comprador o material de arte.
  await login(page, "admin@wellmix.com");
  await approveMilestoneRows(page, orderUrl, [
    /Cadastro e fiscal aprovados pelo GP/,
    /Material de arte aprovado pelo Comprador/,
    /Certificação aprovada pelo GP/,
  ]);

  // 7. Contrato: o documento traz a arte final; a Wellmix sobe o arquivo
  // assinado e carimbado, depois o fornecedor.
  await login(page, "admin@wellmix.com");
  // 7a. Pedido de amostras (P17): antes de assinar, a Wellmix gera o pedido
  // de amostras (5 × 3 por variante; o produto não tem variantes: 15).
  await page.goto(`${orderUrl}/purchase-order`);
  await expect(page.locator("[data-sign-wait-samples]")).toBeVisible();
  await page.goto(`${orderUrl}/samples`);
  await expect(page.locator("[data-sample-total]")).toHaveText("15");
  await Promise.all([
    page.waitForURL(/[?&]decided=ordered/),
    page.locator("form[data-sample-order-create] button[type=submit]").click(),
  ]);
  await expect(page.locator("[data-sample-order-status=sent]")).toBeVisible();
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
  // O fornecedor aceita o pedido de amostras à parte.
  await page.goto(`${orderUrl}/samples`);
  const accept = page.locator("form[data-sample-order-accept]");
  await accept.locator("input[name=name]").fill("Li Wei");
  await accept.locator("input[name=agree]").check();
  await Promise.all([
    page.waitForURL(/[?&]accepted=1/),
    accept.locator("button[type=submit]").click(),
  ]);
  await expect(
    page.locator("[data-sample-order-status=accepted]"),
  ).toBeVisible();

  // Assinado pelos dois: a produção espera o sinal (mapa, P12?/P12).
  await login(page, "admin@wellmix.com");
  await page.goto(orderUrl);
  await expect(requirementRow(page, /^Sinal pago ao fornecedor/)).toContainText(
    /Pendente/,
  );

  // 8. Pagamento ao fornecedor: a condição do cadastro do fornecedor,
  // parcela 1 (o sinal) vence no pedido. Financeiro é só do admin.
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

  // Sinal recebido: a Diretoria de compras aprova (docs/MILESTONES.md).
  await login(page, "admin@wellmix.com");
  await approveMilestoneRows(page, orderUrl, [
    /Sinal aprovado pela Diretoria de compras/,
  ]);
  // Sinal pago e a produção sem ETD: o pedido aparece em Produção →
  // Pré-produção, com os dados da produção e o ETD (docs/FLOW_MENU.md).
  // Para a Wellmix a tela do passo é só a lista (dono, 14/11/2026: "no acesso
  // dos ADMs e gestores"); o "Resolver" abre o pedido no passo.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/flow/production/pre-production");
  const preId = new URL(orderUrl, "http://x").pathname.split("/").pop()!;
  await expect(page.locator("[data-flow-production]")).toHaveCount(0);
  await Promise.all([
    page.waitForURL(
      new RegExp(`/app/flow/production/pre-production/${preId}$`),
    ),
    page
      .locator(`[data-flow-case-order="${preId}"] [data-flow-case-open]`)
      .first()
      .click(),
  ]);
  await expect(page.locator("[data-production-plan]")).toBeVisible();
  await expect(page.locator("[data-production-etd]")).toBeVisible();

  // De volta ao fornecedor: a inspeção é dele.
  await login(page, "supplier.a@china.com");
  // Menu do parceiro pelos passos dele (docs/FLOW_MENU.md): Produção →
  // Inspeção com o contador; a aba Todos traz o pedido dele; o pedido no
  // passo mostra só o que é dele (sem o cliente).
  await page.goto("/app/flow/production/inspection");
  await expect(
    page
      .locator(
        '[data-nav-link="/app/flow/production/inspection"] [data-nav-badge]',
      )
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(page.locator("[data-flow-case]").first()).toBeVisible();
  // O parceiro segue com os cartões nos passos dele (só a Wellmix e as
  // telas de Arte e Certificação ficam só com a lista).
  await expect(
    page.locator("[data-flow-requirements], [data-flow-production]"),
  ).not.toHaveCount(0);
  await page.goto("/app/flow/production/inspection?tab=all");
  await page
    .locator(`[data-flow-all-order="${preId}"] [data-flow-all-view]`)
    .first()
    .click();
  await page.waitForURL(
    new RegExp(`/app/flow/production/inspection/${preId}$`),
  );
  await expect(
    page.locator('[data-flow-order-requirement="photo_unpacked"]'),
  ).toBeVisible();
  await expect(page.locator(`[data-flow-order="${preId}"]`)).not.toContainText(
    /Cliente|Customer|客户/,
  );
  // Passo que não é dele: não abre.
  expect(
    (await page.goto(`/app/flow/delivery/storage/${preId}`))?.status(),
  ).toBe(404);

  // 9. Inspeção (mapa R3/R4?): o fornecedor manda as fotos, o peso, o vídeo
  // da produção e a declaração de conformidade. Nestes pedidos não há peso
  // declarado para comparar (sem ficha de compra).
  // Com as medidas extras ligadas, são 15 itens do fornecedor.
  await fillMyRequirements(
    page,
    orderUrl,
    { 重量: "15", weight: "15", peso: "15" },
    20,
  );
  // A Wellmix aprova o SKU pelo "Resolver" de Produção → Inspeção (a tela
  // do passo é só a lista para ela): o pedido no passo traz o relatório da
  // inspeção e a decisão por SKU (docs/FLOW_MENU.md); só então vai ao
  // Embarque. A ação volta para o pedido no passo.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/flow/production/inspection");
  const inspId = new URL(orderUrl, "http://x").pathname.split("/").pop()!;
  await expect(page.locator("[data-flow-production]")).toHaveCount(0);
  await Promise.all([
    page.waitForURL(new RegExp(`/app/flow/production/inspection/${inspId}$`)),
    page
      .locator(`[data-flow-case-order="${inspId}"] [data-flow-case-open]`)
      .first()
      .click(),
  ]);
  await expect(page.locator("[data-flow-inspection-report]")).toBeVisible();
  await expect(page.locator("[data-production-plan]")).toHaveCount(0);
  const skuRow = page.locator("[data-sku-item]").first();
  await expect(skuRow).toHaveAttribute("data-sku-status", "pending");
  await skuRow.locator("[data-sku-approve]").click();
  await expect(page.locator("[data-sku-item]").first()).not.toHaveAttribute(
    "data-sku-status",
    "pending",
  );
  expect(page.url()).toContain(`/app/flow/production/inspection/${inspId}`);
  await page.waitForLoadState("networkidle");
  await page.goto(orderUrl);
  await expect(page.locator("[data-sku-item]").first()).toHaveAttribute(
    "data-sku-status",
    "approved",
  );
  // O Planner aprova a pré-produção (docs/MILESTONES.md).
  await approveMilestoneRows(page, orderUrl, [
    /Pré-produção \(dados e ETD\) aprovada pelo Planner/,
  ]);
  // Operador da Wellmix: "Etapas do pedido" só com as tarefas dele
  // (docs/PURCHASE_ORDER.md, seção 2e). O pedido de compra é de quem o gerou
  // (o administrador, responsável interno) e os itens do Embarque são do
  // armador designado: nenhuma tarefa dele aqui, nem o card do Embarque.
  await login(page, "operador@wellmix.com");
  await page.goto(orderUrl);
  await expect(page.locator("[data-stage-mine-hint]")).toBeVisible();
  await expect(page.locator("[data-stage-mine-empty]")).toBeVisible();
  await expect(page.locator("[data-stage-row]")).toHaveCount(0);
  await expect(page.locator("[data-stage-card]")).toHaveCount(0);
  // O administrador continua com a linha do tempo inteira.
  await login(page, "admin@wellmix.com");
  await page.goto(orderUrl);
  await expect(page.locator("[data-stage-mine-hint]")).toHaveCount(0);
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

  // Container na origem e documentos do embarque (docs/SHIPPING_DOCS.md):
  // booking, container vazio, check list de carga, packing list, invoice
  // (conferida com o packing list) e BL da marítima (conferido com a invoice).
  await expect(page.locator("[data-import-step=invoice_packing]")).toHaveCount(
    0,
  );
  await login(page, "admin@wellmix.com");
  await sendStep(page, orderUrl, "import-flow", "booking", { value: "BK-E2E" });
  await login(page, "operador@wellmix.com");
  await validateStep(page, orderUrl, "import-flow", "booking");
  await login(page, "supplier.a@china.com");
  await sendStep(page, orderUrl, "container-origin", "container_at_factory", {
    value: "2026-10-10",
  });
  await sendStep(page, orderUrl, "container-origin", "container_empty", {
    file: true,
  });
  await page.goto(`${orderUrl}/shipping-docs`);
  const loadForm = page.locator("form[data-shipping-load-form]");
  const loadRows = loadForm.locator("[data-load-line]");
  for (let i = 0; i < (await loadRows.count()); i++) {
    const row = loadRows.nth(i);
    const left = (
      await row.locator("[data-load-remaining]").innerText()
    ).trim();
    await row
      .locator('input[name^="add_"]')
      .fill(/^\d+$/.test(left) ? left : "1");
  }
  await Promise.all([
    page.waitForURL(/done=load/),
    loadForm.locator("button[type=submit]").click(),
  ]);
  await expect(
    page.locator("[data-shipping-doc=load] [data-shipping-status]"),
  ).toHaveAttribute("data-shipping-status", "accepted");
  const packing = page.locator("form[data-shipping-form=packing_list]");
  await fillMissingWeights(page, packing);
  await Promise.all([
    page.waitForURL(/done=packing_list/),
    packing.locator("button[type=submit]").click(),
  ]);
  // Invoice da trading (login do fornecedor do pedido): bate com o packing list.
  const invoice = page.locator("form[data-shipping-form=invoice]");
  await invoice.locator("input[name=number]").fill("INV-E2E");
  await invoice.locator("input[type=file]").setInputFiles(pdf);
  await Promise.all([
    page.waitForURL(/done=invoice/),
    invoice.locator("button[type=submit]").click(),
  ]);
  await expect(
    page.locator("[data-shipping-doc=invoice] [data-shipping-status]"),
  ).toHaveAttribute("data-shipping-status", "accepted");
  // Amostras (docs/SAMPLE_FLOW.md): o pedido tem pedido de amostras, então
  // o carregamento espera a amostra da China voltar à trading, depois das
  // fotos reais aprovadas. Sem agência na China designada, a Wellmix faz a
  // parte dela.
  await sendStep(page, orderUrl, "samples-flow", "samples_picked", {
    value: "2026-10-11",
  });
  await sendStep(page, orderUrl, "samples-flow", "samples_brazil", {
    value: "AWB-BR-E2E",
    file: true,
  });
  await sendStep(page, orderUrl, "samples-flow", "samples_china", {
    value: "SF-CN-E2E",
    file: true,
  });
  await login(page, "admin@wellmix.com");
  await page.goto(`${orderUrl}#samples`);
  await expect(page.locator("[data-sample-split]").first()).toBeVisible();
  await sendStep(page, orderUrl, "samples-flow", "samples_china_received", {
    value: "2026-10-12",
  });
  await page.goto(`${orderUrl}/real-media`);
  const sendForms = page.locator("form[data-real-media-send]");
  while ((await sendForms.count()) > 0) {
    const form = sendForms.first();
    await form.locator("input[type=file]").setInputFiles(png);
    await Promise.all([
      page.waitForURL(/done=uploaded/),
      form.locator("button[type=submit]").click(),
    ]);
  }
  const decideForms = page.locator("form[data-real-media-decide]");
  while ((await decideForms.count()) > 0) {
    await Promise.all([
      page.waitForURL(/done=approved/),
      decideForms.first().locator("[data-real-media-approve]").click(),
    ]);
  }
  await expect(
    page.locator("[data-real-media-status]").first(),
  ).toHaveAttribute("data-real-media-status", "approved");
  // Show room do Brasil: a Wellmix confere as peças que chegaram (as
  // esperadas já vêm preenchidas) e vendas fica sabendo.
  await page.goto(`${orderUrl}#samples`);
  const showroomForm = page.locator("form[data-showroom-form]");
  await Promise.all([
    page.waitForURL(/showroom=received/),
    showroomForm.locator("button[type=submit]").click(),
  ]);
  await expect(page.locator("[data-showroom-status]")).toHaveAttribute(
    "data-showroom-status",
    "ok",
  );
  // Vendas (docs/FLOW_MENU.md): a amostra que chegou ao Brasil vira caso em
  // Vendas → Amostras; o produto com a venda ativada (foto real aprovada),
  // em Vendas → Ofertas. Registrar a quem foi oferecido tira o caso.
  const salesOrderId = new URL(orderUrl, "http://x").pathname.split("/").pop()!;
  await page.goto("/app/flow/sales/samples");
  const sampleCase = page.locator(`[data-flow-sales-case="${salesOrderId}"]`);
  await sampleCase.locator("[data-flow-sales-to]").fill("Loja Exemplo E2E");
  await Promise.all([
    page.waitForURL(/\/app\/flow\/sales\/samples\?saved=1/),
    sampleCase.locator("[data-flow-sales-submit]").click(),
  ]);
  await expect(
    page.locator(`[data-flow-sales-case="${salesOrderId}"]`),
  ).toHaveCount(0);
  await expect(
    page.locator("[data-flow-sales-offer]", { hasText: "Loja Exemplo E2E" }),
  ).toBeVisible();
  await page.goto("/app/flow/sales/offers");
  const productCase = page.locator("[data-flow-sales-case]").first();
  await productCase.locator("[data-flow-sales-to]").fill("Rede Exemplo E2E");
  await Promise.all([
    page.waitForURL(/\/app\/flow\/sales\/offers\?saved=1/),
    productCase.locator("[data-flow-sales-submit]").click(),
  ]);
  await expect(
    page.locator("[data-flow-sales-offer]", { hasText: "Rede Exemplo E2E" }),
  ).toBeVisible();
  await sendStep(page, orderUrl, "samples-flow", "samples_returned", {
    value: "Amostra devolvida à trading",
  });
  await login(page, "supplier.a@china.com");
  await validateStep(page, orderUrl, "samples-flow", "samples_returned");
  // O carregamento é conferido pela Wellmix; depois lacre e porto.
  await sendStep(page, orderUrl, "container-origin", "container_loaded", {
    value: "Carga completa",
    file: true,
  });
  await login(page, "admin@wellmix.com");
  await validateStep(page, orderUrl, "container-origin", "container_loaded");
  await login(page, "supplier.a@china.com");
  await sendStep(page, orderUrl, "container-origin", "container_sealed", {
    value: "MSCU1234567",
    file: true,
  });
  await sendStep(page, orderUrl, "container-origin", "container_at_port", {
    value: "2026-10-14",
  });
  // BL da companhia marítima, conferido com a invoice.
  await login(page, "armador@maritima.com");
  await page.goto(`${orderUrl}/shipping-docs`);
  const bl = page.locator("form[data-shipping-form=bl]");
  await bl.locator("input[name=number]").fill("BL-E2E");
  await bl.locator("input[name=containerNumber]").fill("MSCU1234567");
  await bl.locator("input[type=file]").setInputFiles(pdf);
  await Promise.all([
    page.waitForURL(/done=bl/),
    bl.locator("button[type=submit]").click(),
  ]);
  await expect(
    page.locator("[data-shipping-doc=bl] [data-shipping-status]"),
  ).toHaveAttribute("data-shipping-status", "accepted");

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
  // Pedido entregue no CD: o recebimento aparece em Entrega → Armazenagem
  // (descarga e contagem), sem as partes do Retorno (docs/FLOW_MENU.md).
  // Só a lista para a Wellmix; o "Resolver" abre o pedido no passo.
  await page.goto("/app/flow/delivery/storage");
  const deliveredId = new URL(orderUrl, "http://x").pathname.split("/").pop()!;
  await expect(page.locator("[data-flow-receiving]")).toHaveCount(0);
  await Promise.all([
    page.waitForURL(new RegExp(`/app/flow/delivery/storage/${deliveredId}$`)),
    page
      .locator(`[data-flow-case-order="${deliveredId}"] [data-flow-case-open]`)
      .first()
      .click(),
  ]);
  await expect(page.locator("[data-receiving-unloading-row]")).toBeVisible();
  await expect(page.locator("[data-receiving-ric]")).toHaveCount(0);
  await page.goto(orderUrl);
  // Fatura ativa (R24): com o BL conferido, o faturamento já tem vencimento.
  await expect(page.locator("[data-invoice-due]")).toBeVisible();
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
  // Produto escolhido pela busca (nome ou código); a ficha vem do servidor
  // e preenche a linha antes de a descrição ser trocada.
  const product = page.locator(
    '[data-request-item="0"] [data-product-picker="catalog"]',
  );
  await product.locator("[data-product-picker-input]").fill("jarra");
  await product.locator('[data-product-picker-option="prod-jarra"]').click();
  await expect(
    page.locator('[data-request-item="0"] [role="status"]'),
  ).toBeVisible();
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
