import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  createTeamLogin,
  fillQuoteSheet,
  grantTeamScreen,
  login,
  openReplenishment,
  setManualFx,
} from "./helpers";

/*
 * Cotação de compra (mapa B13; dono, 15/11/2026; docs/PURCHASE_DEMAND.md):
 * (b) reposição → cotar → dois fornecedores respondem, um não, o Comprador
 * escolhe, a Diretoria aprova → solicitação ao fornecedor com os valores
 * cotados; e o isolamento: o fornecedor A não abre a resposta do B nem vê o
 * cliente; o cliente não abre a demanda de outra empresa nem vê fornecedor
 * ou custo. O prazo é curto (0,02 h) para vencer durante o teste; volta a 24.
 */

async function setQuoteHours(page: Page, hours: string) {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/settings");
  const field = page.locator("[data-setting-purchase-quote-hours]");
  await field.fill(hours);
  await field.evaluate((el) => (el as HTMLInputElement).form!.requestSubmit());
  await page.waitForURL(/\/app\/settings\?ok=1/);
}

/**
 * O fornecedor passa a atender a família de utilidades (Grupo de produto
 * (família) no cadastro; docs/PARTNER_FAMILIES.md): entra na cotação das
 * linhas dela e aparece vinculado na Estratégia de Compra.
 */
async function serveUtilities(page: Page, supplierId: string) {
  await page.goto(`/app/suppliers/${supplierId}?tab=info`);
  await page.locator('[data-party-family="20000000"]').check();
  await page.locator("[data-party-families-save]").click();
  await page.waitForURL(/[?&]families=saved/);
}

/**
 * Moeda e preço (dono, 20/11/2026; docs/PURCHASE_DEMAND.md, "Moeda e preço
 * na cotação"): a moeda fica ao lado do preço, RMB por padrão; o preço é
 * digitado só com números (caixa registradora: 210 → 2.10) e o campo segue
 * o símbolo e o separador da moeda (Real com vírgula).
 */
async function typePrice(
  form: Locator,
  digits: string,
  currency: "RMB" | "USD",
) {
  const box = form.locator('[data-quote-price-box="prod-jarra"]');
  const select = form.locator('[data-quote-currency="prod-jarra"]');
  const price = form.locator('[data-quote-price="prod-jarra"]');
  const symbol = box.locator("[data-money-symbol]");
  await expect(select).toHaveValue("RMB");
  // A ordem pedida pelo dono: RMB, Dólar, Euro e Real.
  await expect(select.locator("option")).toHaveText([
    /RMB/,
    /USD/,
    /EUR/,
    /BRL/,
  ]);
  await expect(symbol).toHaveText("¥");
  await expect(
    form.locator('[data-quote-price-hint="prod-jarra"]'),
  ).toContainText(/4000\D+40\.00/); // no idioma do fornecedor (zh)
  await price.click();
  await price.pressSequentially(digits);
  const shown = `${digits.slice(0, -2) || "0"}.${digits.slice(-2)}`;
  await expect(price).toHaveValue(shown);
  if (currency === "USD") {
    // Trocar a moeda converte o preço pelo câmbio do dia (dono, 21/11/2026;
    // docs/PURCHASE_DEMAND.md, "Conversão ao trocar a moeda"). "Manter os
    // valores digitados" volta ao número, no formato da moeda nova: Real com
    // vírgula, Dólar com ponto.
    const fx = (await (await form.page().request.get("/api/fx")).json()) as {
      rates: Record<string, number>;
    };
    const typed = Number(shown);
    const round2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
    await select.selectOption("BRL");
    await expect(symbol).toHaveText("R$");
    await expect(price).toHaveValue(
      round2(typed * fx.rates.RMB).replace(".", ","),
    );
    await expect(box.locator("[data-fx-note]")).toBeVisible();
    await box.locator("[data-fx-keep]").click();
    await expect(price).toHaveValue(shown.replace(".", ","));
    await expect(box.locator("[data-fx-note]")).toHaveCount(0);
    await select.selectOption("USD");
    await expect(symbol).toHaveText("US$");
    await expect(price).toHaveValue(round2(typed / fx.rates.USD));
    await box.locator("[data-fx-keep]").click();
    await expect(price).toHaveValue(shown);
  }
}

async function answer(
  page: Page,
  email: string,
  quoteId: string,
  digits: string,
  currency: "RMB" | "USD" = "RMB",
  reload = false,
) {
  await login(page, email);
  await page.goto("/app/purchase-quotes");
  await page.locator(`[data-quote-invite="${quoteId}"] a`).first().click();
  await page.waitForURL(new RegExp(`/app/purchase-quotes/${quoteId}`));
  const form = page.locator("[data-quote-answer-form]");
  await typePrice(form, digits, currency);
  // Ficha técnica (dono, 20/11/2026): sem ela e sem o comercial, o envio não
  // sai e a tela diz o que falta.
  if (await form.locator('[data-quote-sheet="prod-jarra"]').count()) {
    await form.locator("[data-quote-submit]").click();
    await expect(form.locator("[data-sheet-missing]")).toBeVisible();
    await expect(page).not.toHaveURL(/[?&]answered=1/);
  }
  await fillQuoteSheet(form, "prod-jarra");
  // 4.000 peças pela caixa dele (24 por caixa): 167 caixas master.
  await expect(
    form.locator('[data-sheet-your-box="prod-jarra"]'),
  ).toContainText("167");
  if (reload) {
    // Rascunho automático (dono, 20/11/2026): o que foi digitado vai para o
    // servidor a cada pausa; a página recarregada (versão nova no ar, iPad)
    // traz tudo de volta.
    await expect(
      form.locator(
        '[data-quote-draft-status="saved"][data-quote-draft-dirty="0"]',
      ),
    ).toBeVisible();
    await page.reload();
    await expect(form.locator("[data-quote-draft-restored]")).toBeVisible();
    await expect(form.locator('[data-quote-price="prod-jarra"]')).toHaveValue(
      `${digits.slice(0, -2) || "0"}.${digits.slice(-2)}`,
    );
    await expect(
      form.locator('[data-sheet-field="prod-jarra.masterBoxQty"]'),
    ).toHaveValue("24");
    await expect(
      form.locator('[data-sheet-field="prod-jarra.factoryItemCode"]'),
    ).toHaveValue("JR-01");
    // O material do catálogo volta escolhido (dono, 21/11/2026).
    await expect(
      form.locator('[data-material-chip="mat-vidro"]'),
    ).toBeVisible();
    // "Sem peso": o campo trava e mostra "Peso bruto não informado"; ao
    // desmarcar, o número digitado volta (não se perde).
    const gross = form.locator(
      '[data-sheet-field="prod-jarra.grossWeightBoxKg"]',
    );
    await form.locator('[data-sheet-gross-unknown="prod-jarra"]').check();
    await expect(gross).toBeDisabled();
    await expect(
      form.locator('[data-sheet-gross-unknown-text="prod-jarra"]'),
    ).toBeVisible();
    await form.locator('[data-sheet-gross-unknown="prod-jarra"]').uncheck();
    await expect(gross).toBeEnabled();
    await expect(gross).toHaveValue("12,5");
    await expect(
      form.locator('[data-quote-currency="prod-jarra"]'),
    ).toHaveValue(currency);
  }
  await form.locator("[data-quote-lead]").fill("35");
  await form.locator("[data-quote-port]").fill("Ningbo");
  await form.locator("[data-quote-moq]").fill("500");
  await form.locator("[data-quote-submit]").click();
  await page.waitForURL(/[?&]answered=1/);
}

test("cotação de compra: dois respondem, um não; Comprador escolhe, Diretoria aprova, nasce a solicitação ao fornecedor", async ({
  page,
}) => {
  test.slow();
  await setQuoteHours(page, "0.02");
  // Câmbio garantido para a conversão da moeda (o do dia, quando há, vale).
  await setManualFx(page);
  // A, B e C marcam a família das utilidades (Grupo de produto (família)):
  // aparecem vinculados na Estratégia de Compra e entram na cotação.
  for (const id of ["fornecedor-a", "fornecedor-b", "fornecedor-c"])
    await serveUtilities(page, id);

  // Reposição da jarra pelo Planner; o Comprador escolhe cotar com os
  // fornecedores vinculados à família (já vêm marcados) e confirma: a cotação
  // vai na hora, sem aprovação antes (dono, 18/11/2026).
  await login(page, "operador@wellmix.com");
  const demandId = await openReplenishment(page, "UTL-001", "4000");
  await page.goto("/app/purchase-strategy");
  const line = page.locator(`[data-strategy-line="${demandId}"]`);
  await line.locator('[data-strategy-choice="quote"]').check();
  for (const id of ["fornecedor-a", "fornecedor-b", "fornecedor-c"])
    await expect(
      line.locator(`[data-strategy-recipient-box="${id}"]`),
    ).toBeChecked();
  // A lista do País × Família vem marcada; o Comprador pode desmarcar e
  // marcar de novo (dono, 18/11/2026).
  const boxC = line.locator('[data-strategy-recipient-box="fornecedor-c"]');
  await boxC.uncheck();
  await expect(boxC).not.toBeChecked();
  await boxC.check();
  // O resumo do envio fica logo abaixo do card da solicitação, na mesma
  // largura (dono, 22/11/2026).
  const summary = page.locator(`[data-strategy-summary-line="${demandId}"]`);
  await expect(summary).toContainText("(3)");
  const [cardBox, summaryBox] = [
    (await line.boundingBox())!,
    (await summary.boundingBox())!,
  ];
  expect(Math.abs(cardBox.x - summaryBox.x)).toBeLessThan(2);
  expect(Math.abs(cardBox.width - summaryBox.width)).toBeLessThan(2);
  expect(summaryBox.y).toBeGreaterThanOrEqual(cardBox.y + cardBox.height - 1);
  await page.locator(`[data-strategy-confirm="${demandId}"]`).click();
  await page.waitForURL(/\/app\/purchase-strategy\/sends\/[^/?]+\?done=1/);
  // Resultado por destinatário: os três receberam.
  await expect(
    page.locator('[data-strategy-send-recipient-status="sent"]'),
  ).toHaveCount(3);
  const quoteId = await page
    .locator("[data-strategy-send-quote]")
    .getAttribute("data-strategy-send-quote");
  expect(quoteId).toBeTruthy();
  // Uma aba por estágio (dono, 22/11/2026): o resumo do envio fica abaixo do
  // card (já saiu da fila) e, em "Enviadas", a linha abre a cotação de fato.
  await page.goto("/app/purchase-strategy?tab=sent");
  await expect(page.locator('[data-strategy-tabs="sent"]')).toBeVisible();
  await expect(page.locator("[data-strategy-queue]")).toHaveCount(0);
  await page
    .locator(`[data-strategy-sent-row="${quoteId}"] [data-strategy-sent-open]`)
    .click();
  await page.waitForURL(new RegExp(`/app/purchase-quotes/${quoteId}`));
  await page.goto(`/app/purchase-quotes/${quoteId}`);
  await expect(page.locator("[data-quote-response]")).toHaveCount(3);

  // Cotação nas Pendências do fornecedor (dono, 21/11/2026): acende a etapa
  // "Responder a solicitação" em amarelo; ao tocar, a lista mostra a
  // cotação, que abre a resposta. (O C só tem esta pendência.)
  await login(page, "supplier.c@china.com");
  await page.goto("/app/tasks");
  const step = page.locator('[data-supplier-step="request"]');
  await expect(step).toHaveAttribute("data-supplier-step-tone", "warning");
  await expect(step).toHaveAttribute("data-supplier-step-count", "1");
  await step.click();
  await page.waitForURL(/[?&]type=supplier\.request/);
  const quoteRow = page.locator("[data-task-row]", {
    has: page.locator(`a[href="/app/purchase-quotes/${quoteId}"]`),
  });
  await expect(quoteRow).toHaveAttribute("data-task-group", "supplier.request");
  await quoteRow
    .locator(`a[href="/app/purchase-quotes/${quoteId}"]`)
    .first()
    .click();
  await page.waitForURL(new RegExp(`/app/purchase-quotes/${quoteId}`));
  await expect(page.locator("[data-quote-answer-form]")).toBeVisible();

  // A e B respondem; C não. A em RMB (o padrão), B em Dólar.
  await answer(page, "supplier.a@china.com", quoteId!, "210", "RMB", true);
  // O aviso diz até quando dá para corrigir: a hora em Brasília e na China
  // (dono, 21/11/2026, opção 1; A está em chinês).
  await expect(page.locator("[data-quote-answered]")).toContainText(
    /Brasília|巴西利亚/,
  );
  await answer(page, "supplier.b@china.com", quoteId!, "185", "USD");

  // Amostragem dentro da cotação (dono, 22/11/2026;
  // docs/SUPPLIER_SAMPLING.md): o B vê as fotos do produto e envia a amostra
  // sem esperar a escolha; a Wellmix valida no quadro comparativo do produto.
  const sample = page.locator('[data-quote-sampling-product="prod-jarra"]');
  await expect(
    sample.locator('[data-quote-product-photos="prod-jarra"]'),
  ).toBeVisible();
  await sample
    .locator("[data-sampling-upload] input[type=file]")
    .setInputFiles({
      name: "amostra.png",
      mimeType: "image/png",
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
  await page.waitForURL(/[?&]sampling=file/);
  await sample.locator("[data-sampling-submit]").click();
  await page.waitForURL(/[?&]sampling=submitted/);
  await expect(sample.locator("[data-sampling=submitted]")).toBeVisible();
  await login(page, "admin@wellmix.com");
  await page.goto(
    `/app/supplier-requests/${quoteId}?view=item&product=prod-jarra`,
  );
  // A amostragem fica num lugar só da tela: o card Imagens, à direita, com
  // a amostra de cada fornecedor e o aprovar ou reprovar.
  const sampleB = page.locator("[data-item-images] [data-sampling=submitted]");
  await expect(sampleB.locator("[data-sampling-file]")).toHaveCount(1);
  await sampleB.locator("[data-sampling-review=approve]").click();
  await page.waitForURL(/[?&]sampling=approved/);
  await expect(
    page.locator("[data-item-images] [data-sampling=approved]"),
  ).toHaveCount(1);
  await expect(page.locator("[data-quotation-sample]")).toHaveCount(0);
  // Imagens sempre à vista na tela do item (fora do chat): a referência da
  // Wellmix e a amostra de cada fornecedor, com o botão de copiar para
  // colar no chat.
  const images = page.locator("[data-item-images]");
  await expect(
    images.locator('[data-item-images-group="reference"]'),
  ).toBeVisible();
  await expect(
    images.locator('[data-item-image="photo"] [data-copy-image]'),
  ).not.toHaveCount(0);
  // O chat fica só com as mensagens; a imagem entra como anexo.
  await page
    .locator("[data-quotation-row]", {
      has: page.locator("[data-quotation-price]", { hasText: /1[.,]85/ }),
    })
    .locator("[data-quotation-chat]")
    .click();
  const sampleChat = page.locator("dialog[open] [data-quote-chat]");
  await expect(sampleChat.locator("[data-item-image]")).toHaveCount(0);
  await sampleChat.locator("[data-quote-chat-file]").setInputFiles({
    name: "detalhe.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });
  await sampleChat.locator("[data-quote-chat-text]").fill("Veja a tampa.");
  await sampleChat.locator("[data-quote-chat-submit]").click();
  await page.waitForURL(/[?&]chat=response/);
  await expect(
    page.locator("[data-quote-chat-attachment]").first(),
  ).toBeAttached();

  // Isolamento: A abre a dele, sem o preço do B, sem o nome do B nem o cliente.
  await login(page, "supplier.a@china.com");
  await page.goto(`/app/purchase-quotes/${quoteId}`);
  await expect(page.locator("[data-quote-supplier]")).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toContain("1.85");
  expect(text).not.toContain("1,85");
  expect(text).not.toContain("Guangzhou");
  expect(text).not.toContain("Loja do João");
  expect(text).not.toContain("Estoque Wellmix");

  // O prazo vence; o Comprador vê o quadro e escolhe o B.
  await login(page, "operador@wellmix.com");
  const board = page.locator("[data-quote-choose-form]");
  await expect(async () => {
    await page.goto(`/app/purchase-quotes/${quoteId}`);
    await expect(board).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 120_000, intervals: [5000] });
  // Passado o prazo, A vê só a resposta que enviou, sem o formulário (dono,
  // 21/11/2026, opção 1).
  await login(page, "supplier.a@china.com");
  await page.goto(`/app/purchase-quotes/${quoteId}`);
  await expect(page.locator('[data-quote-locked="deadline"]')).toBeVisible();
  await expect(page.locator("[data-quote-answer-form]")).toHaveCount(0);
  await expect(
    page.locator('[data-quote-sent-item="prod-jarra"] [data-quote-sent-price]'),
  ).toContainText(/RMB 2[.,]1/);
  await login(page, "operador@wellmix.com");
  await page.goto(`/app/purchase-quotes/${quoteId}`);
  await expect(board).toBeVisible();
  await expect(
    page.locator('[data-quote-response-state="expired"]'),
  ).toHaveCount(1);
  // A moeda de cada um chegou com o preço digitado.
  await expect(
    page.locator('[data-quote-response="fornecedor-a"]'),
  ).toContainText("RMB 2.1");
  await expect(
    page.locator('[data-quote-response="fornecedor-b"]'),
  ).toContainText("USD 1.85");
  await expect(page.locator("[data-quote-reference]")).toBeVisible();
  // Ficha técnica das respostas (dono, 20/11/2026): a caixa de cada um e as
  // caixas e o m³ pela caixa dele (4.000 ÷ 24 = 167 caixas · 14,028 m³).
  for (const id of ["fornecedor-a", "fornecedor-b"]) {
    const row = page.locator(`[data-quote-sheet-row="${id}:prod-jarra"]`);
    await expect(row.locator("[data-quote-sheet-boxes]")).toHaveText("167");
    await expect(row.locator("[data-quote-sheet-cbm]")).toHaveText(/14[,.]028/);
  }
  // Só vence quem tem a amostra aprovada (ou é conhecido do produto): o A,
  // que não enviou a amostra, não pode ser escolhido.
  await expect(
    board.locator('[data-quote-winner-option="fornecedor-b"]'),
  ).toHaveAttribute("data-quote-winner-ready", "1");
  await expect(
    board.locator('[data-quote-winner-option="fornecedor-a"]'),
  ).toBeDisabled();
  await board.locator('[data-quote-winner-option="fornecedor-b"]').check();
  await board.locator("[data-quote-choose]").click();
  await page.waitForURL(/[?&]chosen=1/);

  // A Diretoria aprova a vencedora: nasce a solicitação ao fornecedor.
  await login(page, "diretoria@wellmix.com");
  await page.goto(`/app/purchase-quotes/${quoteId}`);
  await page.locator("[data-quote-approve]").click();
  await page.waitForURL(/[?&]decided=approve/);
  await page.locator("[data-quote-supplier-request]").first().click();
  await page.waitForURL(/\/app\/supplier-requests\/[^/?]+/);
  await expect(page.locator("main")).toContainText(/1[,.]85/);
  const bornRequest = page.url();

  // Sem "Ver preço de compra" (dono, 15/11/2026; docs/LINHA_DE_VISAO.md,
  // seção 7): um login de Cadastro com a tela de cotações liberada à mão
  // (sem a permissão) vê o quadro com os fornecedores, a situação e as
  // condições, sem preços, total nem a última compra; a solicitação que
  // nasceu também sem o preço cotado.
  await login(page, "admin@wellmix.com");
  const plannerEmail = `cadastro.${quoteId}@wellmix.com`;
  const plannerId = await createTeamLogin(
    page,
    "Cadastro cotação",
    plannerEmail,
    ["catalog"],
  );
  await grantTeamScreen(page, plannerId, "Cadastro cotação", "quotes");
  await login(page, plannerEmail);
  await page.goto(`/app/purchase-quotes/${quoteId}`);
  await expect(page.locator("[data-quote-response]").first()).toBeVisible();
  await expect(page.locator("[data-quote-reference]")).toHaveCount(0);
  await expect(page.locator("[data-quote-price-restricted]")).toBeVisible();
  const plannerBoard = await page.locator("[data-quote-board]").innerText();
  expect(plannerBoard).not.toMatch(/1[,.]85/);
  await page.goto(bornRequest);
  await expect(page.locator("[data-supplier-table-row]").first()).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(/1[,.]85/);

  // O cliente não abre a demanda de outra empresa (a reposição da Wellmix).
  await login(page, "joao@lojista.com");
  const response = await page.goto(`/app/requests/${demandId}`);
  expect(
    response?.status() === 404 ||
      !(await page.locator("main").innerText()).includes("Jarra"),
  ).toBe(true);

  // Fichas técnicas dos fornecedores (o Cadastro; o administrador faz tudo):
  // a lista e a ficha de cada um, nosso cadastro ao lado do informado.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/supplier-sheets?review=all");
  const sheetRow = page.locator("[data-supplier-sheet-row]").first();
  await expect(sheetRow).toBeVisible();
  await sheetRow.locator("[data-open-link]").click();
  await page.waitForURL(/\/app\/supplier-sheets\/[^/?]+$/);
  await expect(
    page.locator('[data-supplier-sheet-field="masterBoxQty"]'),
  ).toContainText("24");

  await setQuoteHours(page, "24");
});

/*
 * Cotação unificada (dono, 22/11/2026; docs/QUOTATION.md): a cotação de
 * compra aparece na Cotação (/app/supplier-requests), o produto abre com o
 * quadro comparativo dos fornecedores, a contraproposta vai a todos de uma
 * vez, e a conversa e a sequência de propostas de cada fornecedor abrem num
 * modal. O fornecedor vê a contraproposta e a conversa só na cotação dele.
 */
test("cotação unificada: quadro comparativo do produto, contraproposta em massa, conversa e histórico por fornecedor", async ({
  page,
}) => {
  test.slow();
  await login(page, "admin@wellmix.com");
  await setManualFx(page);
  for (const id of ["fornecedor-a", "fornecedor-b"])
    await serveUtilities(page, id);

  await login(page, "operador@wellmix.com");
  // Menu: a seção Cotação com "Entrada" (Book, Reposição e Encomendas) e um
  // item só para a cotação.
  await page.goto("/app/purchase-strategy");
  const sidebar = page.locator("[data-sidebar]");
  const entry = sidebar.locator("[data-nav-subgroup-toggle]");
  await expect(entry).toBeVisible();
  if ((await entry.getAttribute("aria-expanded")) !== "true")
    await entry.click();
  for (const href of ["/app/booking", "/app/replenishment", "/app/requests"])
    await expect(sidebar.locator(`[data-nav-link="${href}"]`)).toBeVisible();
  await expect(
    sidebar.locator('[data-nav-link="/app/supplier-requests"]'),
  ).toBeVisible();
  await expect(
    sidebar.locator('[data-nav-link="/app/purchase-quotes"]'),
  ).toHaveCount(0);
  await expect(
    sidebar.locator('[data-nav-link="/app/supplier-requests/invites"]'),
  ).toHaveCount(0);

  const demandId = await openReplenishment(page, "UTL-001", "4000");
  await page.goto("/app/purchase-strategy");
  const line = page.locator(`[data-strategy-line="${demandId}"]`);
  await line.locator('[data-strategy-choice="quote"]').check();
  await page.locator(`[data-strategy-confirm="${demandId}"]`).click();
  await page.waitForURL(/\/app\/purchase-strategy\/sends\/[^/?]+\?done=1/);
  const quoteId = await page
    .locator("[data-strategy-send-quote]")
    .getAttribute("data-strategy-send-quote");
  expect(quoteId).toBeTruthy();

  // A e B respondem (em RMB; a ficha técnica só quando a tela pede).
  for (const [email, digits] of [
    ["supplier.a@china.com", "210"],
    ["supplier.b@china.com", "185"],
  ] as const) {
    await login(page, email);
    await page.goto(`/app/purchase-quotes/${quoteId}`);
    const answerForm = page.locator("[data-quote-answer-form]");
    const price = answerForm.locator('[data-quote-price="prod-jarra"]');
    await price.click();
    await price.pressSequentially(digits);
    await fillQuoteSheet(answerForm, "prod-jarra");
    await answerForm.locator("[data-quote-lead]").fill("35");
    await answerForm.locator("[data-quote-port]").fill("Ningbo");
    await answerForm.locator("[data-quote-moq]").fill("500");
    await answerForm.locator("[data-quote-submit]").click();
    await page.waitForURL(/[?&]answered=1/);
  }

  // A cotação de compra está na lista da Cotação, com a aba dos convites.
  await login(page, "operador@wellmix.com");
  await page.goto("/app/supplier-requests");
  await expect(
    page.locator('[data-supplier-request-tab="invites"]'),
  ).toBeVisible();
  const row = page.locator(`[data-quotation-quote-row="${quoteId}"]`);
  await expect(row).toBeVisible();
  // Origem: três (Book, Encomenda ou Reposição); esta veio da Reposição.
  await expect(row.locator("[data-quotation-origin]")).toHaveText("Reposição");
  await row.locator("[data-quotation-quote-open]").click();
  await page.waitForURL(new RegExp(`/app/supplier-requests/${quoteId}$`));
  await expect(page.locator("[data-quote-board]")).toBeVisible();

  // O produto da cotação: o quadro comparativo, uma linha por fornecedor.
  await page.locator('[data-quote-item-open="prod-jarra"]').click();
  await page.waitForURL(/[?&]view=item&product=prod-jarra/);
  await expect(page.locator("[data-quotation-product]")).toBeVisible();
  const rows = page.locator("[data-quotation-row]");
  expect(await rows.count()).toBeGreaterThanOrEqual(2);
  // Só quem respondeu pode receber a contraproposta.
  await expect(page.locator("[data-quotation-select]")).toHaveCount(2);

  // Sem marcar ninguém, "Enviar aos marcados" não envia e o texto fica.
  const form = page.locator("[data-negotiation-propose-form]");
  await form.locator("[data-negotiation-price]").fill("1,5");
  await form.locator("[data-negotiation-text]").fill("Conseguem a 1,50?");
  await form.locator("[data-negotiation-propose-submit]").click();
  await expect(
    form.locator('[data-action-form-error="quote_counter_none"]'),
  ).toBeVisible();
  await expect(form.locator("[data-negotiation-text]")).toHaveValue(
    "Conseguem a 1,50?",
  );
  // "Enviar a todos": os dois recebem.
  await form.locator("[data-quotation-counter-all]").click();
  await page.waitForURL(/[?&]countered=2/);
  await expect(page.locator("[data-quotation-countered]")).toBeVisible();
  await expect(page.locator("[data-quotation-pending]")).toHaveCount(2);

  // Sequência de propostas e contrapropostas do primeiro fornecedor, no modal.
  const first = page.locator("[data-quotation-row]", {
    has: page.locator("[data-quotation-pending]"),
  });
  await first.first().locator("[data-quotation-history]").click();
  const history = page.locator("dialog[open] [data-quotation-history-list]");
  await expect(
    history.locator('[data-quotation-history-entry="answer"]'),
  ).toHaveCount(1);
  await expect(
    history.locator('[data-quotation-history-entry="proposal"]'),
  ).toContainText("Conseguem a 1,50?");
  await page.keyboard.press("Escape");

  // Conversa com o fornecedor A sobre o produto, no modal.
  const rowA = page.locator("[data-quotation-row]", {
    has: page.locator("[data-quotation-price]", { hasText: /2[.,]1/ }),
  });
  await rowA.locator("[data-quotation-chat]").click();
  const chat = page.locator("dialog[open] [data-quote-chat]");
  await chat.locator("[data-quote-chat-text]").fill("A caixa é com 24?");
  await chat.locator("[data-quote-chat-submit]").click();
  await page.waitForURL(/[?&]chat=response/);
  await expect(
    page.locator('[data-quote-chat-message="mine"]', {
      hasText: "A caixa é com 24?",
    }),
  ).toHaveCount(1);

  // O fornecedor A vê a contraproposta e a mensagem na cotação dele, com o
  // formulário aberto para corrigir, e responde na conversa.
  await login(page, "supplier.a@china.com");
  await page.goto(`/app/purchase-quotes/${quoteId}`);
  const mine = page.locator("[data-quote-negotiation]");
  await expect(mine.locator('[data-quote-counter="prod-jarra"]')).toContainText(
    "Conseguem a 1,50?",
  );
  await expect(page.locator("[data-quote-answer-form]")).toBeVisible();
  await expect(mine.locator('[data-quote-chat-message="other"]')).toContainText(
    "A caixa é com 24?",
  );
  // Nada do outro fornecedor.
  expect(await page.locator("main").innerText()).not.toMatch(/1[.,]85/);
  await mine.locator("[data-quote-chat-text]").fill("Sim, 24 por caixa.");
  await mine.locator("[data-quote-chat-submit]").click();
  await page.waitForURL(/[?&]message=1/);
  await expect(mine.locator('[data-quote-chat-message="mine"]')).toContainText(
    "Sim, 24 por caixa.",
  );
  // A contraproposta entrou nas Pendências dele.
  await page.goto("/app/tasks");
  await expect(
    page.locator(`a[href="/app/purchase-quotes/${quoteId}"]`).first(),
  ).toBeVisible();
});
