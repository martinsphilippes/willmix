import { expect, test } from "@playwright/test";
import {
  bookingSheet,
  importAndClose,
  login,
  selectAndOpenSupplierRequest,
  setManualFx,
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
  // Câmbio manual: a simulação da proposta (adiante) precisa de câmbio.
  await setManualFx(page);
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
  // escolhe o A, com o B de alternativa, e abre a solicitação. A quantidade
  // é digitada em caixas: 60 caixas de 48 = 2.880 peças (a planilha traz
  // 3.000, que o campo das caixas mostra como 63; em branco valeria ela).
  const requestUrl = await selectAndOpenSupplierRequest(
    page,
    TAG,
    codeA,
    codeB,
    "Cor âmbar e caixa com a marca",
    { cartons: 60 },
  );
  const itemUrl = `${requestUrl}?view=item`;
  await expect(page.locator("[data-supplier-request-alternative]")).toHaveCount(
    1,
  );
  await expect(page.locator("[data-supplier-request-needs]")).toContainText(
    "Cor âmbar",
  );

  // 2b. Aba "Com Solicitação Aberta": o grupo é uma linha recolhida,
  // com o link da solicitação e o resumo do escolhido; a seta mostra o item
  // comparado que não foi escolhido e um novo clique recolhe.
  const requestPath = new URL(requestUrl).pathname;
  const requestedRow = () =>
    page
      .locator(
        '[data-selection-section="requested"] [data-selection-group-row]',
      )
      .filter({ has: page.locator(`a[href="${requestPath}"]`) });
  const checkRequestedRow = async () => {
    const row = requestedRow();
    await expect(row).toHaveCount(1);
    // `data-ready`: a seta já responde ao toque (tela hidratada).
    const toggle = row.locator("[data-expand-toggle][data-ready]");
    const others = row.locator("[data-expand-detail]");
    await expect(row.locator("[data-selection-winner]")).toContainText(
      `Glass cup ${TAG} 350ml`,
    );
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(others).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(others.locator("[data-selection-other]")).toHaveCount(1);
    await expect(others).toContainText(`Glass cup ${TAG} with handle`);
    await expect(others).toContainText("Guangzhou Supplier B");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(others).toBeHidden();
    return { row, toggle, others };
  };
  // A lista fica só na aba Com Solicitação Aberta (dono, 14/11/2026): nem os
  // blocos nem os filtros (que não valem para ela) aparecem ali, e a aba
  // Blocos Sugeridos não repete a lista.
  await page.goto(
    `/app/booking/selection?q=${encodeURIComponent(TAG)}&tab=blocks`,
  );
  // O único bloco desta busca já tem solicitação: a aba diz isso e leva à
  // lista, sem repeti-la.
  const allRequested = page.locator("[data-selection-blocks-requested]");
  await expect(allRequested).toBeVisible();
  await expect(
    page.locator('[data-selection-section="requested"]'),
  ).toHaveCount(0);
  await allRequested
    .getByRole("link", { name: "Com Solicitação Aberta" })
    .click();
  await page.waitForURL(/tab=requested/);
  await expect(page.locator("[data-selection-blocks]")).toHaveCount(0);
  await expect(page.locator("[data-selection-search]")).toHaveCount(0);
  const listed = await checkRequestedRow();
  // O link fica fora do botão da seta: tocar nele não abre a linha (aqui com
  // a navegação impedida, para a linha continuar na tela)…
  const requestLink = listed.row.locator("[data-selection-request-link]");
  await requestLink.evaluate((el) => {
    el.addEventListener("click", (e) => e.preventDefault(), { once: true });
    (el as HTMLElement).click();
  });
  await expect(listed.toggle).toHaveAttribute("aria-expanded", "false");
  await expect(listed.others).toBeHidden();
  // …e, tocado de verdade, abre a solicitação.
  await requestLink.click();
  await page.waitForURL((url) => url.pathname === requestPath);
  // Com a busca tirando a alternativa da tela (só o escolhido combina), a
  // linha aberta ainda mostra o grupo inteiro: a lista não depende do filtro.
  const onlyChosen = encodeURIComponent(`${TAG} 350ml`);
  await page.goto(`/app/booking/selection?q=${onlyChosen}`);
  await expect(page.locator("[data-selection-item]")).toHaveCount(1);
  await page.goto(`/app/booking/selection?q=${onlyChosen}&tab=requested`);
  const filtered = await checkRequestedRow();
  // "Rever a escolha" continua abrindo o grupo para comparar.
  await filtered.row.locator("[data-selection-block-open]").click();
  await page.waitForURL(/[?&]ids=/);
  await expect(page.locator("[data-selection-item]")).toHaveCount(2);
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
  // Ficha técnica na tabela: a mesma do Book, e os totais do que foi pedido.
  const specs = page.locator("[data-supplier-table-row]");
  await expect(specs.locator("[data-supplier-table-master]")).toHaveText("48");
  await expect(specs.locator("[data-supplier-table-inner]")).toHaveText("12");
  await expect(specs.locator("[data-supplier-table-cbm]")).toHaveText(
    /0[.,]12/,
  );
  await expect(specs.locator("[data-supplier-table-package]")).toHaveText(
    "color box",
  );
  await expect(specs.locator("[data-supplier-table-capacity]")).toHaveText(
    "350 ml",
  );
  await expect(specs.locator("[data-supplier-table-measures]")).toHaveText(
    "10 × 8 × 20",
  );
  await expect(specs.locator("[data-supplier-table-total-cartons]")).toHaveText(
    /\d/,
  );
  await expect(specs.locator("[data-supplier-table-total-cbm]")).toHaveText(
    /\d/,
  );
  // Dados complementares na própria linha; o link do Book é só da Wellmix.
  await specs.locator("[data-supplier-table-details] summary").click();
  await expect(
    specs.locator("[data-supplier-table-detail=grossWeight]"),
  ).toContainText(/0[.,]35/);
  await expect(specs.locator("[data-supplier-table-book]")).toBeVisible();

  // 3. O fornecedor A vê primeiro a tabela dos produtos da solicitação e
  // responde "sim" na caixa rápida da linha, sem a alternativa; o B não abre.
  await login(page, "supplier.a@china.com");
  await page.goto(requestUrl);
  await expect(page.locator("[data-supplier-table-row]")).toHaveCount(1);
  await expect(page.locator("[data-supplier-request-alternative]")).toHaveCount(
    0,
  );
  // "Situação / SLA" (a geral do produto e, embaixo, o SLA; antes eram duas
  // colunas) fecha a tabela, antes de "Ações", e o conjunto fica fixo à
  // direita na rolagem (dono, 13/11/2026). Aqui com os três botões do
  // fornecedor; adiante, com os dois da Wellmix.
  const pinnedColumns = async () => {
    const read = (end: boolean) =>
      page.evaluate((toEnd) => {
        const table = document.querySelector<HTMLTableElement>(
          "[data-supplier-table] table",
        )!;
        const frame = table.parentElement!;
        frame.scrollLeft = toEnd ? frame.scrollWidth : 0;
        const left = frame.getBoundingClientRect().left + frame.clientLeft;
        const span = (cell: Element) => {
          const box = cell.getBoundingClientRect();
          return [Math.round(box.left - left), Math.round(box.right - left)];
        };
        const row = table.tBodies[0].rows[0];
        const lastTwo = (cells: HTMLCollectionOf<HTMLTableCellElement>) =>
          Array.from(cells)
            .slice(-2)
            .map((cell) => cell.getAttribute("data-supplier-table-pin"));
        return {
          width: frame.clientWidth,
          scrolled: Math.round(frame.scrollLeft),
          head: lastTwo(table.tHead!.rows[0].cells),
          body: lastTwo(row.cells),
          pins: ["status", "actions"].map((name) =>
            span(row.querySelector(`td[data-supplier-table-pin=${name}]`)!),
          ),
          first: span(row.cells[0]),
        };
      }, end);
    const start = await read(false);
    const end = await read(true);
    expect(start.head).toEqual(["status", "actions"]);
    expect(start.body).toEqual(["status", "actions"]);
    // A tabela rola (o resto anda) e as duas ficam onde estavam, coladas
    // uma na outra e na borda direita.
    expect(end.scrolled).toBeGreaterThan(0);
    expect(end.first[0]).toBeLessThan(start.first[0]);
    expect(end.pins).toEqual(start.pins);
    const [status, actions] = start.pins;
    expect(Math.abs(actions[1] - start.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(status[1] - actions[0])).toBeLessThanOrEqual(1);
    expect(status[0]).toBeGreaterThan(0);
    // A largura do conjunto fixo.
    return start.width - status[0];
  };
  const supplierPinned = await pinnedColumns();
  await expect(page.locator("[data-supplier-table-master]")).toHaveText("48");
  await expect(page.locator("[data-supplier-table-book]")).toHaveCount(0);
  await expect(page.locator("[data-supplier-table-detail=ncm]")).toHaveCount(0);
  // Três respostas por produto: aprovar a oferta do book (com o valor no
  // nome do botão), renegociar (formulário já preenchido com ela) ou recusar.
  // Só ícones, em duas linhas (dono, 14/11/2026): em cima mensagem e abrir o
  // produto; embaixo aprovar, renegociar e recusar, nessa ordem, cada um com
  // nome para leitor de tela e dica.
  const actions = page.locator("[data-supplier-table-actions]");
  await expect(actions.locator(":scope > div")).toHaveCount(2);
  await expect(
    actions
      .locator(":scope > div")
      .first()
      .locator(":scope > button, :scope > a"),
  ).toHaveCount(2);
  const answers = actions
    .locator("[data-supplier-table-offer]")
    .locator(
      "[data-supplier-table-confirm], [data-supplier-table-answer-open], [data-supplier-table-refuse]",
    );
  expect(
    await answers.evaluateAll((list) =>
      list.map((b) =>
        ["confirm", "answer-open", "refuse"].find((a) =>
          b.hasAttribute(`data-supplier-table-${a}`),
        ),
      ),
    ),
  ).toEqual(["confirm", "answer-open", "refuse"]);
  await expect(answers).toHaveText(["", "", ""]);
  await expect(
    page.locator("[data-supplier-table-confirm]"),
  ).toHaveAccessibleName(/1[.,]25 USD/);
  for (const answer of await answers.all()) {
    await expect(answer).toHaveAccessibleName(/\S/);
    await expect(answer).toHaveAttribute("title", /\S/);
  }
  // A coluna ficou estreita (antes, os três botões com texto pediam 188 px)
  // e a área de toque vai além do desenho: 3 px fora do ícone ainda é ele.
  const actionsBox = await page
    .locator("td[data-supplier-table-pin=actions]")
    .boundingBox();
  expect(actionsBox!.width).toBeLessThanOrEqual(121);
  expect(
    await page.locator("[data-supplier-table-refuse]").evaluate((b) => {
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.right + 3, r.top + r.height / 2);
      return !!hit && (hit === b || b.contains(hit));
    }),
  ).toBe(true);
  await page.locator("[data-supplier-table-answer-open]").click();
  await expect(
    page.locator("[data-supplier-table-answer-price-input]"),
  ).toHaveValue(/1[.,]25/);
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
  // As duas colunas fixas, agora com os dois botões da Wellmix (o conjunto
  // fica mais estreito que o do fornecedor).
  expect(await pinnedColumns()).toBeLessThan(supplierPinned);
  // "Situação / SLA": a situação geral do produto e, embaixo, o SLA. A
  // situação das condições finais é outra coluna, continua no lugar dela e
  // não fica fixa.
  const statusCell = page.locator("td[data-supplier-table-pin=status]");
  await expect(page.locator("th[data-supplier-table-pin=status]")).toHaveText(
    "Situação / SLA",
  );
  await expect(statusCell).toHaveAttribute(
    "data-supplier-table-status",
    "answered",
  );
  await expect(
    statusCell.locator("[data-supplier-table-status-badge]"),
  ).toHaveText("Respondida");
  // SLA: o selo e, à direita na mesma linha, o "+"; a data e a hora do prazo
  // começam recolhidas. "+" mostra embaixo do selo e vira "−"; "−" recolhe.
  const sla = statusCell.locator("[data-supplier-request-sla]");
  await expect(sla).toHaveAttribute("data-supplier-request-sla", "ok");
  await expect(sla).toContainText("No prazo");
  const slaToggle = sla.locator("[data-supplier-table-sla-toggle]");
  const slaDue = sla.locator("[data-supplier-table-sla-due]");
  await expect(slaToggle).toHaveText("+");
  await expect(slaToggle).toHaveAttribute("aria-expanded", "false");
  await expect(slaDue).toBeHidden();
  const slaBadge = (await sla
    .locator("[data-supplier-table-sla-badge]")
    .boundingBox())!;
  const toggleBox = (await slaToggle.boundingBox())!;
  expect(toggleBox.x).toBeGreaterThan(slaBadge.x + slaBadge.width - 1);
  expect(
    Math.abs(
      toggleBox.y + toggleBox.height / 2 - (slaBadge.y + slaBadge.height / 2),
    ),
  ).toBeLessThan(4);
  const cellWidth = (await statusCell.boundingBox())!.width;
  await slaToggle.click();
  await expect(slaToggle).toHaveText("−");
  await expect(slaToggle).toHaveAttribute("aria-expanded", "true");
  await expect(slaDue).toBeVisible();
  await expect(slaDue).toHaveText(/^\d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}$/);
  const dueBox = (await slaDue.boundingBox())!;
  expect(dueBox.y).toBeGreaterThan(slaBadge.y + slaBadge.height - 1);
  // A coluna mantém a largura com o prazo aberto.
  expect(
    Math.abs((await statusCell.boundingBox())!.width - cellWidth),
  ).toBeLessThan(1);
  await slaToggle.click();
  await expect(slaToggle).toHaveText("+");
  await expect(slaDue).toBeHidden();
  const finalState = page.locator("td[data-supplier-table-final-state]");
  await expect(finalState).toHaveCount(1);
  await expect(finalState).not.toHaveAttribute("data-supplier-table-pin");
  await expect(finalState).toHaveCSS("position", "static");
  await page.goto(itemUrl);
  const propose = page.locator("[data-negotiation-propose-form]");
  // Os mesmos campos da resposta (com FOB/EXW) e a estimativa do Superplan:
  // ao digitar o preço, custo e mínimo; pela inversa, o preço necessário.
  await propose.locator("[data-negotiation-price]").fill("1,30");
  await expect(propose.locator("[data-proposal-sim-cost]")).toBeVisible();
  await propose.locator("[data-proposal-sim-target]").fill("500");
  await expect(propose.locator("[data-proposal-sim-needed]")).toBeVisible();
  await propose.locator("[data-proposal-sim-use]").click();
  await expect(propose.locator("[data-negotiation-price]")).not.toHaveValue(
    "1,30",
  );
  await propose.locator("[data-negotiation-price]").fill("1,30");
  // O prazo combinado (35 dias) vai preencher o campo do prazo no pedido.
  await propose.locator("[data-negotiation-lead-time]").fill("35");
  await propose.locator("[data-negotiation-incoterm]").selectOption("FOB");
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
  // A oferta vigente passou a ser a contraproposta: é ela que se aprova.
  await expect(
    page.locator("[data-supplier-table-confirm]"),
  ).toHaveAccessibleName(/1[.,]3 USD/);
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
  // "✓ Enviado" ao lado de "Enviar resposta" (dono, 14/11/2026): há resposta
  // gravada; continua ao recarregar; some ao mudar um campo e volta ao
  // gravar de novo.
  const sent = page.locator("[data-supplier-answer-form] [data-sent-mark]");
  await expect(sent).toHaveAttribute("data-sent-mark", "on");
  // O fornecedor de teste usa o portal em chinês.
  await expect(sent).toHaveText(/^(Enviado|Sent|已发送)$/);
  await page.reload();
  await expect(sent).toHaveAttribute("data-sent-mark", "on");
  const answerNote = page.locator(
    '[data-supplier-answer-form] textarea[name="note"]',
  );
  const noteBefore = await answerNote.inputValue();
  await answerNote.fill("Caixa confirmada.");
  await expect(sent).toHaveAttribute("data-sent-mark", "off");
  await expect(sent).toBeHidden();
  // Voltar ao que estava gravado mostra de novo.
  await answerNote.fill(noteBefore);
  await expect(sent).toHaveAttribute("data-sent-mark", "on");
  await answerNote.fill("Caixa confirmada.");
  await expect(sent).toBeHidden();
  await page.click("[data-supplier-answer-submit]");
  await expect(answerNote).toHaveValue("Caixa confirmada.");
  await expect(sent).toHaveAttribute("data-sent-mark", "on");
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
  // Produto e pedido de compra só depois da amostra aprovada; prazo de 1 dia.
  await expect(
    page.locator("[data-request-product-waits-sample]"),
  ).toBeVisible();
  await expect(page.locator("[data-request-product-create]")).toHaveCount(0);
  await expect(page.locator("[data-sampling-due=ok]")).toBeVisible();

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
  // Na tabela, a situação mostra a aprovação e, embaixo, a amostragem (que
  // leva ao quadro dela no produto); decidida, a solicitação não tem SLA.
  await page.goto(requestUrl);
  await expect(statusCell).toHaveAttribute(
    "data-supplier-table-status",
    "approved",
  );
  await expect(statusCell).toContainText("Aprovada");
  const samplingLink = statusCell.locator(
    "[data-supplier-table-sampling=approved]",
  );
  await expect(samplingLink).toContainText("Amostra aprovada");
  await expect(samplingLink).toHaveAttribute("href", /view=item#amostragem$/);
  await expect(page.locator("[data-supplier-request-sla]")).toHaveCount(0);
  await page.goto(itemUrl);
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
  const orderUrl = page.url().split("?")[0];
  // A Wellmix vê a seção inteira, com as outras raias.
  const prep = page.locator('[data-stage-tasks="PREPARATION"]');
  await expect(prep).toContainText("MOQ confirmado (peças)");
  await expect(prep).toContainText("Certificado (Inmetro)");

  // 7. Visão do fornecedor (dono, 13/11/2026): na Preparação, só a faca, a
  // foto em alta e o prazo de cada produto, com a ajuda falando delas; o
  // prazo já vem com o combinado na negociação, para ele conferir e enviar.
  await login(page, "supplier.a@china.com");
  await page.goto(orderUrl);
  // A ajuda da seção é a dele, no idioma do login (este lê em chinês).
  await expect(page.locator("[data-stage-help=supplier]")).toContainText(
    /die[ -]cut/i,
  );
  const product = `Copo de vidro ${TAG}`;
  const tasks = prep.locator("li", {
    has: page.locator("span.font-medium", { hasText: product }),
  });
  await expect(tasks).toHaveCount(3);
  for (const label of [
    "Faca (die cut)",
    "Foto em alta resolução",
    "Prazo de produção confirmado (dias)",
  ])
    await expect(tasks.filter({ hasText: label })).toHaveCount(1);
  await expect(prep).not.toContainText(/MOQ|Arte|Certificado|Validação/);
  const leadTime = tasks.filter({ hasText: "Prazo de produção" });
  await expect(leadTime.locator("input[name=value]")).toHaveValue("35");
  await expect(leadTime.locator("button[type=submit]")).toBeVisible();
});

/*
 * Aprovar e recusar pela tabela pedem confirmação (dono, 14/11/2026;
 * docs/SUPPLIER_REQUESTS.md, "Ações só com ícones"): o ícone abre a caixa
 * com o produto e as condições da oferta; Cancelar, Esc e tocar fora não
 * enviam nada; só o botão da caixa grava, com o mesmo envio de antes.
 */
test("tabela da solicitação: aprovar e recusar pedem confirmação", async ({
  page,
}) => {
  const tag = `OFR${Date.now().toString(36).toUpperCase()}`;
  await login(page, "admin@wellmix.com");
  await setManualFx(page);
  await importAndClose(
    page,
    bookingSheet("Shenzhen Supplier A", `${tag}-A`, `Glass cup ${tag} 350ml`),
    "Shenzhen Supplier A",
  );
  await importAndClose(
    page,
    bookingSheet(
      "Guangzhou Supplier B",
      `${tag}-B`,
      `Glass cup ${tag} with handle`,
    ),
    "Guangzhou Supplier B",
  );
  const requestUrl = await selectAndOpenSupplierRequest(
    page,
    tag,
    `${tag}-A`,
    `${tag}-B`,
    "Caixa com a marca",
  );

  await login(page, "supplier.a@china.com");
  await page.goto(requestUrl);
  const row = page.locator("[data-supplier-table-row]");
  await expect(row).toHaveCount(1);
  const offer = row.locator("[data-supplier-table-offer]");
  const canDo = row.locator("[data-supplier-table-can-do]");
  await expect(offer).toHaveAttribute("data-supplier-table-offer", "book");
  await expect(canDo).toHaveAttribute("data-supplier-table-can-do", "waiting");
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/app/supplier-requests/"))
      posts++;
  });

  // A caixa de aprovar mostra o produto e as condições do book.
  const box = page.locator("dialog[open]");
  await row.locator("[data-supplier-table-confirm]").click();
  await expect(box).toContainText(`Glass cup ${tag} 350ml`);
  await expect(
    box.locator('[data-supplier-table-offer-summary-value="price"]'),
  ).toHaveText(/1[.,]25 USD/);
  await expect(
    box.locator("[data-supplier-table-confirm-submit]"),
  ).toBeVisible();
  // Cancelar, Esc e tocar fora fecham sem enviar nada.
  await box.locator("[data-supplier-table-confirm-cancel]").click();
  await expect(box).toHaveCount(0);
  await row.locator("[data-supplier-table-refuse]").click();
  await expect(
    box.locator("[data-supplier-table-refuse-submit]"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);
  await row.locator("[data-supplier-table-confirm]").click();
  await expect(box).toHaveCount(1);
  await page.mouse.click(5, 5);
  await expect(box).toHaveCount(0);
  expect(posts).toBe(0);
  await expect(canDo).toHaveAttribute("data-supplier-table-can-do", "waiting");

  // Recusar pela caixa: grava "não faz" e a oferta volta a ser a do book.
  await row.locator("[data-supplier-table-refuse]").click();
  await box.locator("[data-supplier-table-refuse-submit]").click();
  await page.waitForURL(/[?&]offer=refused/);
  await expect(canDo).toHaveAttribute("data-supplier-table-can-do", "no");
  await expect(offer).toHaveAttribute("data-supplier-table-offer", "book");

  // Aprovar pela caixa: grava "faz" com as condições do book; a oferta passa
  // a ser a dele, sem o que aprovar.
  await row.locator("[data-supplier-table-confirm]").click();
  await box.locator("[data-supplier-table-confirm-submit]").click();
  await page.waitForURL(/[?&]offer=confirmed/);
  await expect(canDo).toHaveAttribute("data-supplier-table-can-do", "yes");
  await expect(offer).toHaveAttribute("data-supplier-table-offer", "own");
  await expect(row.locator("[data-supplier-table-confirm]")).toHaveCount(0);
  await expect(row.locator("[data-supplier-table-answer-price]")).toContainText(
    /1[.,]25\b/,
  );
  expect(posts).toBe(2);
});
