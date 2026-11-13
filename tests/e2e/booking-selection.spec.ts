import { expect, test, type Page } from "@playwright/test";
import { xlsxBytes } from "../unit/xlsx-fixture";

/*
 * Seleção de itens, abas Itens e Seleção (docs/SUPPLIER_REQUESTS.md): o
 * rascunho aparece (sem poder abrir a solicitação), os filtros de status,
 * fornecedor e período (calendário de intervalo) mudam a lista, a cesta
 * marca todos os da tela e "Agrupar" leva para a comparação; a aba Seleção
 * sugere o bloco dos itens parecidos de vários fornecedores.
 */

const PASSWORD = "wellmix123";
const TAG = `SEL${Date.now().toString(36).toUpperCase()}`;

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
  // Cabeçalho: dono e fábrica do registro, sem o nome do arquivo.
  const heading = page.locator("[data-booking-lot-heading]");
  await expect(heading).toContainText(
    `Informações lançadas da Fábrica ${supplierName}`,
  );
  await expect(heading).not.toContainText(".xlsx");
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

async function importDraft(page: Page, file: ReturnType<typeof sheet>) {
  await page.goto("/app/booking/import");
  await page
    .locator("[data-booking-import-form] input[type=file]")
    .setInputFiles(file);
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  // Sem NCM: "Estimar o NCM de novo" refaz a aproximação e avisa o resultado.
  // Com bookings de execuções anteriores (DATA_DIR reaproveitado), o item já
  // nasce com o NCM do parecido e o botão não aparece: aí todos têm NCM.
  const reclassify = page.locator("[data-booking-lot-ncm-reclassify]");
  if (await reclassify.count()) {
    await reclassify.locator("button[type=submit]").click();
    await page.waitForURL(/ncmMatched=\d+&ncmLeft=\d+/);
  } else {
    const ncm = page.locator("input[data-booking-item-ncm]");
    for (let i = 0; i < (await ncm.count()); i++)
      await expect(ncm.nth(i)).not.toHaveValue("");
  }
}

/**
 * Câmbio manual em Configurações. O custo por peça do Superplan (R$) precisa
 * de câmbio, e o do dia vem de sites públicos que nem todo ambiente de teste
 * alcança (rede restrita). Com a cotação do dia ela continua valendo; sem
 * ela, vale este, e a conta sai do mesmo jeito.
 */
async function setManualFx(page: Page) {
  await page.goto("/app/settings");
  const usd = page.locator('input[name="fxManualRates.USD"]');
  await usd.fill("5.5");
  await page.locator('input[name="fxManualRates.RMB"]').fill("0.78");
  await page.locator('input[name="fxManualRates.EUR"]').fill("6");
  await usd.evaluate((el) => (el as HTMLInputElement).form!.requestSubmit());
  await page.waitForURL(/\/app\/settings\?ok=1/);
}

test("seleção: rascunho, filtros, período, cesta, agrupar e blocos", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await setManualFx(page);
  await importAndClose(
    page,
    sheet("Shenzhen Supplier A", `${TAG}-A`, `Glass cup ${TAG} 350ml`),
    "Shenzhen Supplier A",
  );
  await importAndClose(
    page,
    sheet("Guangzhou Supplier B", `${TAG}-B`, `Glass cup ${TAG} with handle`),
    "Guangzhou Supplier B",
  );
  await importDraft(
    page,
    sheet("Guangzhou Supplier B", `${TAG}-C`, `Glass cup ${TAG} draft`),
  );

  // 1. Itens: o rascunho entra, sem poder ser o escolhido.
  const base = `/app/booking/selection?q=${TAG}`;
  await page.goto(base);
  const rows = page.locator("[data-selection-item]");
  await expect(rows).toHaveCount(3);
  const draftRow = rows.filter({ hasText: `${TAG}-C` });
  await expect(
    draftRow.locator('[data-selection-lot-status="draft"]'),
  ).toBeVisible();
  // Os fechados mostram o custo por peça do Superplan (R$), com a explicação.
  await expect(page.locator("[data-selection-cost-hint]")).toBeVisible();
  for (const code of [`${TAG}-A`, `${TAG}-B`])
    await expect(
      rows.filter({ hasText: code }).locator("[data-selection-cost]"),
    ).toContainText("R$");
  // A aba Itens só agrupa: sem escolher nem abrir solicitação.
  await expect(page.locator("[data-selection-choose]")).toHaveCount(0);
  await expect(page.locator("[data-selection-submit]")).toHaveCount(0);

  // 2. Filtro de status: sem o rascunho, sobram os dois fechados.
  await page.locator('[data-selection-filter-status="draft"]').uncheck();
  await expect(rows).toHaveCount(2);
  await page.goto(base);

  // 3. Fornecedor: só os do B (o fechado e o rascunho). O envio automático
  // dos filtros só liga com a página pronta: mexer antes não filtrava (era a
  // causa de este passo falhar de vez em quando).
  await page.locator("[data-auto-submit-ready]").waitFor({ state: "attached" });
  const supplierSelect = page.locator("[data-selection-filter-supplier]");
  const optionB = supplierSelect.locator("option", {
    hasText: "Guangzhou Supplier B",
  });
  await supplierSelect.selectOption(
    (await optionB.first().getAttribute("value"))!,
  );
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: `${TAG}-A` })).toHaveCount(0);

  // 4. Período: a data das planilhas é 13/10/2026.
  await page.goto(`${base}&from=2026-10-01&to=2026-10-31`);
  await expect(rows).toHaveCount(3);
  await page.goto(`${base}&from=2026-11-01&to=2026-11-30`);
  await expect(rows).toHaveCount(0);
  // Calendário: dois cliques marcam o intervalo e "Aplicar" filtra.
  await page.goto(`${base}&from=2026-10-01&to=2026-10-31`);
  await page.click("[data-date-range-toggle]");
  await page.click('[data-range-day="2026-10-10"]');
  await page.click('[data-range-day="2026-10-20"]');
  await page.click("[data-date-range-apply]");
  await page.waitForURL(/from=2026-10-10&to=2026-10-20/);
  await expect(rows).toHaveCount(3);

  // 5. Cesta: todos os da tela, agrupar e comparar.
  await page.goto(base);
  await page.locator("input[data-basket-all]").check();
  await expect(page.locator("[data-selection-basket]")).toHaveAttribute(
    "data-selection-basket",
    "3",
  );
  await page.click("[data-selection-group]");
  await page.waitForURL(/tab=selection&ids=/);
  await expect(page.locator("[data-selection-group-view]")).toHaveAttribute(
    "data-selection-group-view",
    "3",
  );
  // No grupo (aba Seleção) é que se escolhe; o item de rascunho não pode.
  await expect(
    page
      .locator("[data-selection-item]", { hasText: `${TAG}-C` })
      .locator("[data-selection-choose]"),
  ).toBeDisabled();
  await expect(page.locator("[data-selection-submit]")).toBeVisible();
  await expect(page.locator("[data-selection-item]")).toHaveCount(3);
  // Abaixo do bloco, os três prompts de IA com os padrões das Configurações.
  await expect(page.locator("[data-ai-prompt]")).toHaveCount(3);
  await expect(page.locator('[data-ai-prompt="product"]')).not.toHaveValue("");
  // Desenho (pedido do dono, 13/11/2026): "Gravar a escolha do grupo" em cima
  // e "Prompts de IA" logo abaixo, os dois na largura toda; com essa largura,
  // os três prompts ficam lado a lado e os campos do gerador numa linha só.
  const choiceCard = (await page
    .locator("[data-selection-choice-cards] > section")
    .first()
    .boundingBox())!;
  const promptsCard = (await page.locator("[data-ai-prompts]").boundingBox())!;
  expect(promptsCard.y).toBeGreaterThanOrEqual(
    choiceCard.y + choiceCard.height,
  );
  expect(Math.abs(promptsCard.width - choiceCard.width)).toBeLessThan(2);
  const tops = (selector: string, edge: "top" | "bottom") =>
    page
      .locator(selector)
      .evaluateAll(
        (els, e) =>
          els.map((el) => Math.round(el.getBoundingClientRect()[e as "top"])),
        edge,
      );
  expect(new Set(await tops("[data-ai-prompt]", "top")).size).toBe(1);
  // Os seis campos do gerador numa linha só. "Quantidade (peças)" fica logo
  // à direita de "Total de caixas", com a mesma largura e altura e os
  // rótulos alinhados (dono, 13/11/2026; antes ficava no alto do cartão).
  const fieldCells =
    "[data-generate-fields] > label, [data-generate-fields] > div";
  const generatorFields = await tops(fieldCells, "bottom");
  expect(generatorFields).toHaveLength(6);
  expect(new Set(generatorFields).size).toBe(1);
  await expect(
    page
      .locator("[data-generate-fields] > *")
      .nth(0)
      .locator("[data-generate-total]"),
  ).toHaveCount(1);
  await expect(
    page
      .locator("[data-generate-fields] > *")
      .nth(1)
      .locator("[data-selection-quantity]"),
  ).toHaveCount(1);
  const boxesBox = (await page.locator("[data-generate-total]").boundingBox())!;
  const piecesBox = (await page
    .locator("[data-selection-quantity]")
    .boundingBox())!;
  expect(Math.abs(piecesBox.y - boxesBox.y)).toBeLessThan(1);
  expect(Math.abs(piecesBox.width - boxesBox.width)).toBeLessThan(1);
  expect(Math.abs(piecesBox.height - boxesBox.height)).toBeLessThan(1);
  const between = piecesBox.x - (boxesBox.x + boxesBox.width);
  expect(between).toBeGreaterThan(0);
  expect(between).toBeLessThan(16);
  expect(
    new Set(await tops("[data-generate-fields] > label > span", "top")).size,
  ).toBe(1);
  // Um campo de quantidade só no cartão (o do alto saiu), com a dica dele
  // logo abaixo da linha dos campos.
  await expect(page.locator("[data-selection-quantity]")).toHaveCount(1);
  await expect(page.locator("[data-selection-quantity-hint]")).toHaveText(
    "Em branco: a quantidade da planilha do item escolhido.",
  );
  // Em tela larga o botão fica na mesma linha dos campos; nesta, logo abaixo.
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 1440, height: 900 });
  const wideRow = await tops(`${fieldCells}, [data-generate-submit]`, "bottom");
  expect(wideRow).toHaveLength(7);
  expect(new Set(wideRow).size).toBe(1);
  await page.setViewportSize(viewport);
  // Programação de compra pela quantidade (docs/PURCHASE_SCHEDULE.md): 48
  // peças e 0,12 m³ por caixa → 566 caixas (27.168 peças) por 40HC. O total
  // em CAIXAS master (dono, 13/11/2026) e o número de rodadas mandam: 1.250
  // caixas = 60.000 peças em 3 rodadas iguais (417 + 417 + 416 caixas); os
  // containers saem da conta.
  const gen = page.locator("[data-rounds-generator]");
  const calc = gen.locator("[data-generate-calc]");
  // Sem nenhum item marcado como escolhido, a conta não some: usa o primeiro
  // do grupo com caixa master e CBM, e diz qual.
  await expect(gen.locator("[data-generate-item]")).toHaveAttribute(
    "data-generate-item",
    "assumed",
  );
  await expect(gen.locator("[data-generate-assumed]")).toBeVisible();
  await expect(calc).toContainText("27.168");
  await page
    .locator("[data-selection-item]", { hasText: `${TAG}-A` })
    .locator("[data-selection-choose]")
    .check();
  await expect(gen.locator("[data-generate-item]")).toHaveAttribute(
    "data-generate-item",
    "ok",
  );
  await expect(gen.locator("[data-generate-assumed]")).toHaveCount(0);
  // O campo do total se chama "Total de caixas" e recebe caixas master: sem
  // nada digitado, mostra as peças da planilha (3.000) em caixas inteiras.
  await expect(
    gen.getByLabel("Total de caixas", { exact: true }),
  ).toBeVisible();
  await expect(gen.locator("[data-generate-total]")).toHaveValue("63");
  // "Total de caixas" e "Quantidade (peças)" são o mesmo número em duas
  // unidades (dono, 13/11/2026): o que se digita num aparece no outro, pelas
  // 48 peças por caixa master do item escolhido. Sem programação, as peças
  // são a quantidade da escolha (em branco = a da planilha).
  const boxesField = gen.locator("[data-generate-total]");
  const piecesField = gen.locator("[data-selection-quantity]");
  await expect(
    gen.getByLabel("Quantidade (peças)", { exact: true }),
  ).toBeVisible();
  await expect(piecesField).toHaveValue("");
  await expect(piecesField).toBeEditable();
  await expect(piecesField).toHaveAttribute("name", "quantity");
  await boxesField.fill("10");
  await expect(piecesField).toHaveValue("480");
  // 500 peças = 10,4 caixas: 11 (inteiras, para cima).
  await piecesField.fill("500");
  await expect(boxesField).toHaveValue("11");
  await expect(calc.locator("[data-generate-extra]")).toContainText("28");
  // Apagar as peças volta à quantidade da planilha; apagar as caixas não
  // devolve o número antigo enquanto se digita.
  await piecesField.fill("");
  await expect(boxesField).toHaveValue("63");
  await boxesField.fill("");
  await expect(piecesField).toHaveValue("");
  await expect(boxesField).toHaveValue("");
  await boxesField.fill("1250");
  await expect(piecesField).toHaveValue("60000");
  // O campo do número de rodadas se chama "Programações" (dono, 13/11/2026).
  await expect(gen.getByLabel("Programações", { exact: true })).toBeVisible();
  await gen.locator("[data-generate-rounds]").fill("3");
  // "Containers por rodada" é só informativo (não é campo): quantos
  // containers cada rodada precisa, já na prévia. O cálculo fica escrito.
  const perRound = gen.locator("[data-generate-per-round]");
  await expect(perRound).toHaveText("1");
  // Ao lado, os containers no total (a soma das rodadas), também informativo.
  const totalContainers = gen.locator("[data-generate-total-containers]");
  await expect(totalContainers).toHaveText("3");
  await expect(gen.locator("input[data-generate-per-round]")).toHaveCount(0);
  // A prévia já diz as caixas em peças: 1.250 × 48 = 60.000.
  await expect(calc.locator("[data-generate-result]")).toContainText("1.250");
  await expect(calc.locator("[data-generate-result]")).toContainText("60.000");
  await gen.locator("[data-generate-submit]").click();
  await expect(page.locator("[data-schedule-item]")).toHaveCount(3);
  const qty = (n: number) => page.locator(`input[name="schedule.qty.${n}"]`);
  const card = (n: number) => page.locator(`[data-schedule-item="${n}"]`);
  await expect(qty(1)).toHaveValue("20016");
  await expect(qty(2)).toHaveValue("20016");
  await expect(qty(3)).toHaveValue("19968");
  await expect(page.locator("[data-selection-quantity]")).toHaveValue("60000");
  // O cálculo escrito: caixas, m³ e containers do total, a ocupação das
  // rodadas e quantos containers no total.
  await expect(calc.locator("[data-generate-result]")).toContainText("1.250");
  await expect(calc.locator("[data-generate-result]")).toContainText("2,21");
  await expect(calc.locator("[data-generate-containers]")).toContainText("3");
  // Cada rodada diz quantos containers ocupa e traz os DOIS ajustes: sem
  // container cheio abaixo, o de diminuir aparece desligado.
  await expect(card(1).locator("[data-round-fill]")).toHaveAttribute(
    "data-round-fill",
    "partial",
  );
  await expect(card(1).locator("[data-round-status]")).toContainText("73%");
  await expect(card(1).locator("[data-round-up]")).toBeVisible();
  await expect(card(1).locator("[data-round-down-off]")).toBeDisabled();
  // Aumentar: fecha o container da rodada 1 (566 caixas = 27.168 peças). A
  // quantidade de peças muda em consequência: a da rodada, a soma e o total
  // do gerador, em caixas (mesmo com outro número digitado nele antes).
  await expect(page.locator("[data-selection-quantity-hint]")).toHaveText(
    "Com a programação de compra, a quantidade é a soma das rodadas.",
  );
  // Com a programação aberta, o campo das peças não vai no formulário (a
  // quantidade gravada é a soma das rodadas) e os dois continuam ligados.
  await expect(piecesField).not.toHaveAttribute("name", "quantity");
  await piecesField.fill("24000");
  await expect(boxesField).toHaveValue("500");
  await gen.locator("[data-generate-total]").fill("1000");
  await expect(piecesField).toHaveValue("48000");
  await card(1).locator("[data-round-up]").click();
  await expect(qty(1)).toHaveValue("27168");
  await expect(card(1).locator("[data-round-fill]")).toHaveAttribute(
    "data-round-fill",
    "full",
  );
  await expect(page.locator("[data-selection-quantity]")).toHaveValue("67152");
  // 67.152 peças ÷ 48 = 1.399 caixas.
  await expect(gen.locator("[data-generate-total]")).toHaveValue("1399");
  await expect(perRound).toHaveText("1");
  // Diminuir: 30.000 peças passam de um container (o segundo com 10%): a
  // rodada precisa de 2 e o informativo mostra "1 a 2". Tirar o excedente
  // deixa a rodada 2 com um container cheio.
  await qty(2).fill("30000");
  await expect(card(2).locator("[data-round-status]")).toContainText("10%");
  await expect(perRound).toHaveText("1 a 2");
  await expect(totalContainers).toHaveText("4");
  await card(2).locator("[data-round-down]").click();
  await expect(qty(2)).toHaveValue("27168");
  // 74.304 peças ÷ 48 = 1.548 caixas.
  await expect(gen.locator("[data-generate-total]")).toHaveValue("1548");
  await expect(perRound).toHaveText("1");
  await expect(totalContainers).toHaveText("3");
  // Margem de 5%: 26.000 peças = 542 caixas = 95% do container: cheio.
  await qty(3).fill("26000");
  await expect(card(3).locator("[data-round-fill]")).toHaveAttribute(
    "data-round-fill",
    "full",
  );
  await expect(card(3).locator("[data-round-status]")).toContainText("95%");
  // "+ Rodada" redivide o total em caixas master inteiras.
  await page.locator("[data-schedule-add]").click();
  await expect(page.locator("[data-schedule-item]")).toHaveCount(4);
  await expect(qty(1)).toHaveValue("20112");
  await expect(qty(4)).toHaveValue("20064");
  await expect(gen.locator("[data-generate-rounds]")).toHaveValue("4");

  // 6. Seleção: o bloco sugerido junta os três copos de dois fornecedores.
  await page.goto(`${base}&tab=selection`);
  const block = page.locator("[data-selection-block]").first();
  await expect(block).toHaveAttribute("data-selection-block", "3");
  await expect(block).toContainText("2");
  await block.locator("[data-selection-block-open]").click();
  await page.waitForURL(/ids=/);
  await expect(page.locator("[data-selection-item]")).toHaveCount(3);

  // 7. "Quantidade (peças)" nos dois modos, com o mesmo valor. Com a
  // programação aberta, Enter no campo gera de novo com o total digitado
  // (como em "Total de caixas"); fechada, o campo continua na tela, é ele
  // que a escolha grava (10 caixas de 48 = 480 peças) e Enter grava, como
  // antes. Nada é gravado aqui: a escolha gravada com as caixas digitadas e
  // a volta dela aos dois campos estão em booking-supplier-request.spec.ts.
  await page
    .locator("[data-selection-item]", { hasText: `${TAG}-A` })
    .locator("[data-selection-choose]")
    .check();
  const savedBoxes = page.locator("[data-generate-total]");
  const savedPieces = page.locator("[data-selection-quantity]");
  /** Enter no campo: o gerador ficou com ele (true) ou deixou o formulário gravar. */
  const enterTaken = () =>
    savedPieces.evaluate((el) => {
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    });
  /** O que o formulário mandaria como quantidade (nulo: não vai no formulário). */
  const formQuantity = () =>
    savedPieces.evaluate((el) =>
      new FormData((el as HTMLInputElement).form!).get("quantity"),
    );
  await savedBoxes.fill("100");
  await page.locator("[data-generate-submit]").click();
  await expect(page.locator("[data-schedule-item]")).toHaveCount(2);
  await expect(savedPieces).toHaveValue("4800");
  expect(await formQuantity()).toBeNull();
  await savedPieces.fill("9600");
  await savedPieces.press("Enter");
  await expect(page.locator('input[name="schedule.qty.1"]')).toHaveValue(
    "4800",
  );
  await expect(page.locator('input[name="schedule.qty.2"]')).toHaveValue(
    "4800",
  );
  await expect(savedPieces).toHaveValue("9600");
  await expect(savedBoxes).toHaveValue("200");
  await expect(page).not.toHaveURL(/[?&]saved=1/);
  await page
    .getByRole("button", { name: "Sem programação (pedido único)" })
    .click();
  await expect(page.locator('[data-request-schedule="off"]')).toBeVisible();
  await expect(savedPieces).toHaveValue("9600");
  await expect(savedBoxes).toHaveValue("200");
  await expect(savedPieces).toBeEditable();
  await expect(savedPieces).toHaveAttribute("name", "quantity");
  await savedBoxes.fill("10");
  await expect(savedPieces).toHaveValue("480");
  expect(await formQuantity()).toBe("480");
  expect(await enterTaken()).toBe(false);
  // Em branco, o formulário manda a quantidade vazia: vale a da planilha.
  await savedPieces.fill("");
  expect(await formQuantity()).toBe("");
});
