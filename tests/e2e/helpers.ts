import { expect, type Locator, type Page } from "@playwright/test";
import { xlsxBytes } from "../unit/xlsx-fixture";

/*
 * Passos comuns dos testes de ponta a ponta: login das contas de
 * demonstração, booking por planilha (docs/BOOKING.md, seção 0), Seleção de
 * itens, ficha do produto e o preenchimento dos itens do pedido.
 */

export const PASSWORD = "wellmix123";

export const png = {
  name: "foto.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
};

export const pdf = {
  name: "doc.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n%fake\n"),
};

export async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/e-mail|email|邮箱/i).fill(email);
  await page.getByLabel(/senha|password|密码/i).fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await page.waitForURL(/\/app/);
}

/**
 * Login novo da equipe (Equipe → Criar login), com as funções dadas e a
 * senha de demonstração, sem trocar no primeiro acesso. Precisa estar logado
 * como administrador. Devolve o id da pessoa.
 */
export async function createTeamLogin(
  page: Page,
  name: string,
  email: string,
  functions: string[],
): Promise<string> {
  await page.goto("/app/team?tab=team&new=1");
  const form = page.locator("[data-team-new-login]");
  await form.locator('input[name="name"]').fill(name);
  await form.locator('input[name="login"]').fill(email);
  await form.locator('input[name="password"]').fill(PASSWORD);
  for (const fn of functions)
    await form.locator(`input[name="functions"][value="${fn}"]`).check();
  await form.locator('input[name="mustChange"]').uncheck();
  await form.getByRole("button", { name: "Criar login" }).click();
  await page.waitForURL(/\/app\/team\/[^/?]+\?created=/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

/**
 * Libera uma tela a mais para a pessoa (Equipe → Editar acessos →
 * Personalizado), sem mexer nas funções nem nas ações dela. Precisa estar
 * logado como administrador.
 */
export async function grantTeamScreen(
  page: Page,
  id: string,
  name: string,
  screen: string,
) {
  // A lista busca no servidor (Equipe Interna, 50 por página): pela pessoa.
  await page.goto(`/app/team?q=${encodeURIComponent(name)}`);
  await page.locator(`[data-team-edit="${id}"]`).click();
  const drawer = page.locator(`[data-team-drawer-panel="${id}"]`);
  await expect(drawer).toBeVisible();
  await drawer.locator('[data-team-screens-mode="custom"]').check();
  const panel = drawer.locator("[data-team-screens-panel]");
  const closed = panel.locator('[data-perm-section][aria-expanded="false"]');
  while ((await closed.count()) > 0) await closed.first().click();
  await drawer.locator(`[data-team-screen="${screen}"]`).check();
  await drawer.locator("[data-team-save]").click();
  await expect(page.locator("[data-team-saved-toast]")).toContainText(name);
}

/**
 * Salva as permissões da função aberta em Funções e acessos. Com alguém
 * ganhando ou perdendo acesso, a prévia de impacto aparece antes de gravar
 * (docs/EQUIPE_ACESSOS.md, R1): confirma e grava. Devolve se houve prévia.
 */
export async function saveFunction(fn: Locator): Promise<boolean> {
  await fn.locator("[data-fn-save]").click();
  const confirm = fn.locator("[data-fn-impact-confirm]");
  const saved = fn.locator("[data-fn-saved]");
  await expect(confirm.or(saved)).toBeVisible();
  const previewed = await confirm.isVisible();
  if (previewed) await confirm.click();
  await expect(saved).toBeVisible();
  return previewed;
}

/**
 * Câmbio manual em Configurações (Wellmix). As contas do Superplan (custo por
 * peça, simulação da proposta) precisam de câmbio, e o do dia vem de sites
 * públicos que nem todo ambiente de teste alcança (rede restrita). Com a
 * cotação do dia ela continua valendo; sem ela, vale este.
 */
export async function setManualFx(page: Page) {
  await page.goto("/app/settings");
  const usd = page.locator('input[name="fxManualRates.USD"]');
  await usd.fill("5.5");
  await page.locator('input[name="fxManualRates.RMB"]').fill("0.78");
  await page.locator('input[name="fxManualRates.EUR"]').fill("6");
  await usd.evaluate((el) => (el as HTMLInputElement).form!.requestSubmit());
  await page.waitForURL(/\/app\/settings\?ok=1/);
}

/**
 * "Encomenda vira cotação sozinha" nas Configurações (dono, 22/11/2026;
 * docs/PURCHASE_DEMAND.md, "Encomenda vira cotação na hora"). Os testes do
 * fluxo manual da Estratégia desligam a chave e os da cotação na hora a
 * ligam, cada um no começo (o servidor é o mesmo para todos). Precisa do
 * login de administrador.
 */
export async function setAutoQuote(page: Page, on: boolean) {
  await page.goto("/app/settings");
  const select = page.locator("[data-setting-auto-quote]");
  await select.selectOption(on ? "true" : "false");
  await select.evaluate((el) =>
    (el as HTMLSelectElement).form!.requestSubmit(),
  );
  await page.waitForURL(/\/app\/settings\?ok=1/);
}

const BOOKING_HEADER = [
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
export function bookingSheet(
  supplier: string,
  code: string,
  description: string,
  /** Cores do item (coluna COLOR ASSORTMENT), ex.: "BEGE / CARVALHO / MARROM". */
  colors?: string,
  /** CBM da caixa master (padrão: 0,12). */
  { cbm = "0.12" }: { cbm?: string } = {},
) {
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
    cbm,
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
    buffer: Buffer.from(
      xlsxBytes([
        {
          name: "BOOKING",
          cells: colors
            ? [
                [...BOOKING_HEADER, "COLOR ASSORTMENT"],
                [...row, colors],
              ]
            : [BOOKING_HEADER, row],
        },
      ]),
    ),
  };
}

/**
 * Sobe a planilha e fecha o booking (fornecedor e data vêm dela). Com
 * `checkSupplierPicker`, confere também a busca do fornecedor (filtra,
 * troca e volta, gravando a cada escolha).
 */
export async function importAndClose(
  page: Page,
  file: ReturnType<typeof bookingSheet>,
  supplierName: string,
  { checkSupplierPicker = false } = {},
) {
  await page.goto("/app/booking/import");
  await page
    .locator("[data-booking-import-form] input[type=file]")
    .setInputFiles(file);
  await fillBookMeta(page);
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  // A etapa chama-se Book (dono, 13/11/2026; antes "Booking"): o título, a
  // caixa de dados, o botão de fechar e o menu ("Books", no bloco Produto
  // novo desde 14/11/2026, docs/FLOW_MENU.md).
  await expect(
    page.getByRole("heading", { name: /^Book nº \d+/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fechar o book" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Books?$/ }).first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /booking/i })).toHaveCount(0);
  // Na caixa "Dados do book" (dono, 13/11/2026): quem fabrica é a
  // Fábrica (antes "Fornecedor") e para quem vão as solicitações é o
  // Fornecedor (antes "Responsável pelo booking").
  const data = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Dados do book" }) })
    .first();
  await expect(
    data.getByText("Fábrica", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    data.getByText("Fornecedor", { exact: true }).first(),
  ).toBeVisible();
  await expect(data).not.toContainText(/Responsável pelo book/);
  // Primeira linha da caixa (dono, 13/11/2026): o Fornecedor (dono do book) à
  // esquerda e a Fábrica à direita, lado a lado.
  const labels = data.locator("dt");
  await expect(labels.nth(0)).toHaveText("Fornecedor");
  await expect(labels.nth(1)).toHaveText("Fábrica");
  const ownerLabel = (await labels.nth(0).boundingBox())!;
  const factoryLabel = (await labels.nth(1).boundingBox())!;
  expect(ownerLabel.x).toBeLessThan(factoryLabel.x);
  expect(Math.abs(ownerLabel.y - factoryLabel.y)).toBeLessThan(2);
  // Fornecedor do cadastro (tem login): nenhum aviso de "sem acesso".
  await expect(page.locator("[data-supplier-no-login]")).toHaveCount(0);
  const combo = page.locator(
    "[data-booking-lot-supplier] input[role=combobox]",
  );
  await expect(combo).toHaveValue(new RegExp(supplierName));
  if (checkSupplierPicker) {
    // Fornecedor com busca: digitar filtra a lista até sobrar o que se quer.
    await combo.click();
    await combo.fill(
      supplierName.toLowerCase().split(" ").slice(0, 2).join(" "),
    );
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
      page.locator(
        '[data-booking-lot-supplier] [data-booking-row-note="saved"]',
      ),
    ).toBeVisible();
    await combo.click();
    await combo.fill(supplierName);
    await options.filter({ hasText: supplierName }).first().click();
    await expect(combo).toHaveValue(new RegExp(supplierName));
    await expect(
      page.locator(
        '[data-booking-lot-supplier] [data-booking-row-note="saved"]',
      ),
    ).toBeVisible();
  }
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

/**
 * "Escolher" na linha do item (Seleção de itens): o botão marca o vencedor e
 * recolhe os demais. Com a linha recolhida, abre "Rever opções" antes.
 */
export async function chooseItem(page: Page, hasText: string) {
  const row = page.locator("[data-selection-item]", { hasText });
  if (!(await row.isVisible()))
    await page
      .locator(
        "[data-selection-winner-bar] label:has(input[data-selection-review])",
      )
      .click();
  await row.locator("[data-selection-choose-button]").click();
  await expect(row.locator("input[data-selection-choose]")).toBeChecked();
}

/**
 * Seleção de itens (docs/SUPPLIER_REQUESTS.md): a busca pela marca traz os
 * dois itens; agrupa, escolhe `chosen` (código) com `alternative` de
 * alternativa, grava e abre a solicitação ao fornecedor do escolhido.
 * Devolve o endereço da solicitação (sem a busca).
 *
 * Com `cartons` (caixas master de 48 peças, a da planilha de teste), a
 * quantidade é digitada em "Total de caixas": confere que "Quantidade
 * (peças)" acompanha, que é ela que a escolha grava e que os dois campos
 * voltam com o mesmo número ao rever a escolha.
 */
export async function selectAndOpenSupplierRequest(
  page: Page,
  tag: string,
  chosen: string,
  alternative: string,
  needs: string,
  { cartons = null as number | null } = {},
) {
  await page.goto(`/app/booking/selection?q=${encodeURIComponent(tag)}`);
  await expect(page.locator("[data-selection-item]")).toHaveCount(2);
  // A aba Itens só agrupa; a solicitação abre no grupo (aba Seleção).
  await page.locator("input[data-basket-all]").check();
  await page.click("[data-selection-group]");
  await page.waitForURL(/tab=selection&ids=/);
  await expect(page.locator("[data-selection-item]")).toHaveCount(2);
  await chooseItem(page, chosen);
  // Sem a coluna "Alternativa" (dono, 13/11/2026): só se escolhe o ganhador
  // e "Foto" vem logo depois de "Escolher". O outro item do grupo continua
  // indo como alternativa da solicitação (quem chama confere mais adiante).
  await expect(
    page.locator("[data-selection-item]", { hasText: alternative }),
  ).toHaveCount(1);
  await expect(page.locator("input[data-selection-alternative]")).toHaveCount(
    0,
  );
  await expect(page.locator('input[name="alternatives"]')).toHaveCount(0);
  const heads = page.locator("table[data-selection-items] thead th");
  await expect(heads.nth(1)).toContainText("Escolher");
  await expect(heads.nth(2)).toContainText("Foto");
  await expect(
    page.locator("table[data-selection-items] thead"),
  ).not.toContainText("Alternativa");
  // Cada linha tem as mesmas colunas do cabeçalho (nenhuma célula sobrando).
  const columns = await heads.count();
  await expect(
    page.locator("[data-selection-item]").first().locator("td"),
  ).toHaveCount(columns);
  await page.fill("[data-selection-needs]", needs);
  // Sem programação de compra, "Quantidade (peças)" é a quantidade da
  // escolha (dono, 13/11/2026): digitar as caixas calcula as peças.
  const pieces = cartons === null ? null : String(cartons * 48);
  if (cartons !== null) {
    await page.locator("[data-generate-total]").fill(String(cartons));
    await expect(page.locator("[data-selection-quantity]")).toHaveValue(
      pieces!,
    );
  }
  // Gravar só guarda a escolha (nada vai ao fornecedor); a tela vai para a
  // aba Blocos Sugeridos, onde o grupo aparece resolvido, com o ganhador em
  // verde, e a solicitação abre dali.
  await page.click("[data-selection-submit]");
  await page.waitForURL(/[?&]saved=1/);
  await expect(page).toHaveURL(/[?&]tab=blocks/);
  await expect(page.locator("[data-selection-saved]")).toBeVisible();
  const resolved = page.locator("[data-selection-resolved=saved]");
  await expect(resolved).toHaveCount(1);
  await expect(resolved.locator("[data-selection-winner]")).toContainText(tag);
  if (cartons !== null) {
    // A escolha gravou as peças das caixas digitadas; ao rever, os dois
    // campos voltam com o mesmo número.
    await expect(resolved.locator("[data-selection-winner]")).toContainText(
      `${(cartons * 48).toLocaleString("pt-BR")} peças`,
    );
    await resolved.locator("[data-selection-block-open]").click();
    await page.waitForURL(/ids=/);
    await expect(page.locator("[data-selection-quantity]")).toHaveValue(
      pieces!,
    );
    await expect(page.locator("[data-generate-total]")).toHaveValue(
      String(cartons),
    );
    await page.goBack();
    await expect(resolved).toHaveCount(1);
  }
  await page.click("[data-selection-open-all]");
  // Recém-aberta, a solicitação abre na tela do produto (view=item).
  await page.waitForURL(/\/app\/supplier-requests\/[^/?]+\?.*created=1/);
  return page.url().split("?")[0];
}

/**
 * Tela do produto: as seções vêm recolhidas. Abre todas (a tela lembra as
 * abertas na aba e reabre sozinha depois de cada salvamento).
 */
export async function gotoProduct(page: Page, id: string) {
  await page.goto(`/app/products/${id}`);
  const folds = page.locator("details[data-fold-section]");
  await expect(folds.first()).toBeAttached();
  await page.waitForLoadState("networkidle");
  await folds.evaluateAll((els) =>
    els.forEach((el) => ((el as HTMLDetailsElement).open = true)),
  );
}

/**
 * Preenche, um por vez, os itens pendentes que o usuário logado pode
 * preencher na tela do pedido (aprovação: aprova). `values` dá o número por
 * trecho do rótulo (ex.: peso). Para quando não sobra nenhum ou no `limit`.
 */
export async function fillMyRequirements(
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

/**
 * Aprovações do mapa no fim dos marcos (docs/MILESTONES.md): o login (com a
 * ação, ou o administrador) aprova cada item pelo rótulo, na página do pedido.
 */
export async function approveMilestoneRows(
  page: Page,
  orderUrl: string,
  labels: RegExp[],
) {
  // A mesma linha de item que o caminho principal usa (o <li> do rótulo).
  const requirementRow = (p: Page, label: RegExp) =>
    p.locator("li").filter({
      has: p.locator("span.font-medium", { hasText: label }),
    });
  for (const label of labels) {
    await page.goto(orderUrl);
    const row = requirementRow(page, label).first();
    await expect(row).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      row.locator("form button[type=submit]").first().click(),
    ]);
    await page.waitForLoadState("networkidle");
    // A última aprovação pode concluir a etapa (a linha some com ela).
    expect(page.url()).not.toContain("error=");
  }
}

/**
 * País de origem e grupo de produto da Nova solicitação (Wellmix vendendo ao
 * cliente; docs/ORDER_TERMS.md): a busca de produto só abre depois deles.
 */
export async function chooseOrderOrigin(
  page: Page,
  country = "CHINA",
  family = "fm:BRINQUEDOS",
) {
  const terms = page.locator("[data-order-terms]");
  const countrySelect = terms.locator("[data-order-terms-country]");
  await expect(
    countrySelect.locator(`option[value="${country}"]`),
  ).toBeAttached();
  await countrySelect.selectOption(country);
  const groupSelect = terms.locator("[data-order-terms-group]");
  await expect(groupSelect.locator(`option[value="${family}"]`)).toBeAttached();
  await groupSelect.selectOption(family);
}

/**
 * Condições do pedido (docs/ORDER_TERMS.md): TS (o único liberado), formato
 * de venda (e o nível, no Wellmix), transportador, re-despacho Sim/Não,
 * país e família. O aviso "sem devoluções" é do cliente, na confirmação.
 */
export async function fillOrderTerms(
  page: Page,
  options: {
    format?: "wd" | "wellmix";
    tier?: string;
    redispatch?: "yes" | "no";
    /** Quem chama o transportador (16/11/2026); padrão: a Wellmix. */
    caller?: "customer" | "wellmix";
    country?: string;
    family?: string;
    /**
     * Tipo de operação já marcado: TS (Encomendas e a tela TS - Trading
     * Sales) ou Venda (a tela Venda - Encomenda; docs/REQUEST_SCREENS.md).
     */
    operation?: "ts" | "sale";
    /** Forma de pagamento pelo nome; padrão: a primeira ativa. */
    paymentPlan?: string;
  } = {},
) {
  const terms = page.locator("[data-order-terms]");
  await expect(
    terms.locator(
      `[data-order-terms-operation-option="${options.operation ?? "ts"}"]`,
    ),
  ).toBeChecked();
  await terms
    .locator(`[data-order-terms-format-option="${options.format ?? "wd"}"]`)
    .check();
  if ((options.format ?? "wd") === "wellmix")
    await terms
      .locator("[data-order-terms-tier]")
      .selectOption(options.tier ?? "pleno");
  await terms
    .locator(
      `[data-order-terms-redispatch-option="${options.redispatch ?? "no"}"]`,
    )
    .check();
  const caller = options.caller ?? "wellmix";
  await terms
    .locator(`[data-order-terms-carrier-caller-option="${caller}"]`)
    .check();
  // A Wellmix chama: escolhe a transportadora (e a do re-despacho, com Sim);
  // o cliente chama: ele informa as dele na confirmação.
  if (caller === "wellmix") {
    await terms
      .locator("[data-order-terms-carrier]")
      .selectOption("portal:transportador");
    if (options.redispatch === "yes")
      await terms
        .locator("[data-order-terms-redispatch-carrier]")
        .selectOption("portal:transportador");
  }
  // Forma de pagamento (obrigatória; dono, 16/11/2026): a 1ª da lista, salvo
  // outra pedida pelo nome.
  const plan = terms.locator("[data-order-terms-payment-plan]");
  const planValue = options.paymentPlan
    ? await plan
        .locator("option", { hasText: options.paymentPlan })
        .first()
        .getAttribute("value")
    : await plan
        .locator("option:not([disabled])")
        .first()
        .getAttribute("value");
  await plan.selectOption(planValue!);
  await chooseOrderOrigin(page, options.country, options.family);
}

/**
 * Condições do pedido completas se recolhem num resumo (dono, 19/11/2026):
 * "Editar" abre o bloco de novo para mexer nos campos. Dois quadros (dono,
 * 21/11/2026): Condições do pedido e Entrega, cada um com o seu "Editar";
 * abre os dois.
 */
export async function editOrderTerms(page: Page) {
  const edit = page.locator('[data-order-terms-toggle="edit"]');
  while (await edit.count()) await edit.first().click();
  for (const body of await page.locator("[data-order-terms-body]").all())
    await expect(body).toBeVisible();
}

/** O login do cliente com acesso (obrigatório na venda pela Wellmix). */
export async function chooseCustomerLogin(page: Page, email: string) {
  // Venda da Wellmix ao cliente (dono, 18/11/2026): o login não se escolhe
  // mais; a solicitação vai para todos os logins do cliente.
  const all = page.locator("[data-request-people] [data-request-access-all]");
  if (await all.count()) {
    await expect(all).toHaveValue(/\(\d+\)/);
    return;
  }
  const access = page.locator(
    '[data-request-people] select[name="requestedForUserId"]',
  );
  await expect(access).toBeEnabled();
  const value = await access
    .locator("option", { hasText: email })
    .getAttribute("value");
  await access.selectOption(value!);
}

/** O cliente confirma o pedido (aviso "sem devoluções" e, com re-despacho, o CNPJ). */
export async function confirmAsCustomer(
  page: Page,
  requestId: string,
  redispatch?: { cnpj: string; name: string },
  /** Quem chama = Cliente: a transportadora do pedido. */
  carrier?: { cnpj: string; name: string },
) {
  await page.goto(`/app/requests/${requestId}`);
  const card = page.locator("[data-customer-confirm]");
  await expect(card).toBeVisible();
  for (const [block, data, field] of [
    ["carrier", carrier, "mainCarrierName"],
    ["redispatch", redispatch, "carrierName"],
  ] as const) {
    if (!data) continue;
    const box = card.locator(`[data-customer-confirm-${block}]`);
    await box.locator("[data-customer-confirm-cnpj]").fill(data.cnpj);
    await box.locator("[data-customer-confirm-lookup]").click();
    // Modo memória: sem a consulta do CNPJ, o nome se digita.
    await box.locator(`input[name="${field}"]`).fill(data.name);
  }
  await card.locator("[data-customer-confirm-accept]").check();
  await card
    .getByRole("button", { name: /confirmar pedido|confirm order/i })
    .click();
  await page.waitForURL(/[?&]confirmed=1/);
}

/** Os contatos do cliente (bloco "Cliente"), quando o portal os pede. */
export async function fillCustomerContacts(page: Page, prefix = "cliente") {
  const block = page.locator("[data-customer-contacts]");
  await expect(block).toHaveAttribute(
    "data-customer-contacts",
    /^(blind|known|edit)$/,
  );
  // Já atualizados pelo portal: "Editar" abre os campos.
  if ((await block.getAttribute("data-customer-contacts")) === "known")
    await block.locator("[data-customer-contacts-edit]").click();
  for (const [i, role] of [
    "partner",
    "buyer",
    "finance",
    "logistics",
  ].entries()) {
    await block
      .locator(`input[name="contact.${role}.phone"]`)
      .fill(`(47) 99999-000${i + 1}`);
    await block
      .locator(`input[name="contact.${role}.email"]`)
      .fill(`${role}@${prefix}.com`);
  }
}

/**
 * Reposição pelo "+ Adicionar" (dono, 16/11/2026; docs/REQUEST_SCREENS.md,
 * seção 7): o botão da fila abre a tela Venda como compra para estoque. Abre
 * a reposição de um produto do catálogo (a busca e o total de caixas) e
 * devolve o id da solicitação, que a fila de Reposição mostra.
 */
export async function openReplenishment(
  page: Page,
  search: string,
  total: string,
): Promise<string> {
  await page.goto("/app/replenishment");
  await page.locator("[data-replenishment-add]").click();
  await page.waitForURL(/\/app\/new-request\/sale\?from=replenishment$/);
  const row = page.locator('[data-request-item="0"]');
  const picker = row.locator('[data-product-picker="catalog"]');
  await picker.locator("[data-product-picker-input]").fill(search);
  const option = picker.locator("[data-product-picker-option]").first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(row.locator('[role="status"]').first()).toBeVisible();
  await row
    .locator("[data-rounds-generator] [data-generate-total]")
    .fill(total);
  // Produto sem peças por caixa master: as caixas não viram peças, e a
  // quantidade (peças) é digitada.
  const pieces = row.locator("[data-selection-quantity]");
  if (!(await pieces.inputValue())) await pieces.fill(total);
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await page.waitForURL(/\/app\/replenishment\?opened=/);
  return new URL(page.url()).searchParams.get("opened")!;
}

/**
 * Depois de "Enviar" uma solicitação de um produto só: a tela cai na página
 * da solicitação (nível do pedido; docs/ORDER_LEVEL_LISTS.md). Devolve o id
 * do produto e, com `open`, abre a tela dele (o que os testes conferem).
 */
export async function createdRequestId(
  page: Page,
  { open = true }: { open?: boolean } = {},
): Promise<string> {
  await page.waitForURL(/\/app\/requests\/batch\/[^/?]+\?created=1/);
  const id = (await page
    .locator("[data-batch-item]")
    .first()
    .getAttribute("data-batch-item"))!;
  if (open) await page.goto(`/app/requests/${id}`);
  return id;
}

/**
 * Ficha técnica de um produto na resposta da cotação (dono, 20/11/2026;
 * docs/PURCHASE_DEMAND.md, "Ficha técnica na cotação"): na primeira vez do
 * par produto × fornecedor, preenche tudo (24 por caixa, 60 × 40 × 35 cm,
 * 0,45 kg por peça, 12,5 kg a caixa, vidro do catálogo, JR-01); quem já
 * vendeu marca "Confirmo os dados deste produto". Sem a ficha (já
 * confirmada), nada. O inner não é dele (exigência do cliente, travada).
 */
export async function fillQuoteSheet(form: Locator, productId: string) {
  if (!(await form.locator(`[data-quote-sheet="${productId}"]`).count()))
    return;
  const field = (key: string) =>
    form.locator(`[data-sheet-field="${productId}.${key}"]`);
  // O inner não é dele (exigência do cliente, travada); "Sem peso" desmarcado.
  const noCode = form.locator(`[data-sheet-no-code="${productId}"]`);
  if (await noCode.isChecked()) await noCode.uncheck();
  const noWeight = form.locator(`[data-sheet-gross-unknown="${productId}"]`);
  if (await noWeight.isChecked()) await noWeight.uncheck();
  for (const [key, value] of [
    ["masterBoxQty", "24"],
    ["boxLengthCm", "60"],
    ["boxWidthCm", "40"],
    ["boxHeightCm", "35"],
    ["cbm", ""],
    ["netWeightKg", "0,45"],
    ["grossWeightBoxKg", "12,5"],
    ["factoryItemCode", "JR-01"],
  ] as const)
    await field(key).fill(value);
  // Material só pelo catálogo (dono, 21/11/2026): busca e escolhe "Vidro".
  const chip = form.locator(
    `[data-material-picker="${productId}.material"] [data-material-chip="mat-vidro"]`,
  );
  if (!(await chip.count())) {
    await field("material").fill("vidro");
    await form
      .locator(
        `[data-material-options="${productId}.material"] [data-material-option="mat-vidro"]`,
      )
      .click();
  }
  await expect(chip).toBeVisible();
  const confirm = form.locator(`[data-sheet-confirm="${productId}"]`);
  if (await confirm.count()) await confirm.check();
}

/**
 * Importar book: nº da loja e nome do supplier (abertos) e o Tipo de item,
 * obrigatório (dono, 23 e 24/11/2026; docs/BOOKING.md, "Dinâmica dos books").
 */
export async function fillBookMeta(page: Page, itemType = "Teste E2E") {
  // FOB ou EXW (dono, 24/11/2026): FOB, como as planilhas dos testes.
  await page.locator("[data-book-incoterm]").selectOption("FOB");
  await page.locator("[data-book-store-number]").fill("A 154678");
  // A Fábrica fica em branco: vale a da planilha (digitada diferente, as
  // linhas divergem e o book não fecha; coberto em book-work.spec.ts).
  await page.locator("[data-book-item-type]").fill(itemType);
}
