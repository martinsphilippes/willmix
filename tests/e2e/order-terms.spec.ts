import { expect, test, type Page } from "@playwright/test";
import {
  chooseCustomerLogin,
  confirmAsCustomer,
  fillCustomerContacts,
  fillOrderTerms,
  login,
} from "./helpers";

/*
 * Nova solicitação da Wellmix para o cliente (dono, 15/11/2026;
 * docs/ORDER_TERMS.md): o bloco do cliente no lugar da busca por foto ou
 * link (contatos às cegas na primeira vez), as condições do pedido (só TS;
 * re-despacho Sim/Não; país > família), o login do cliente obrigatório, o
 * rascunho, a composição de containers e a confirmação do pedido pelo
 * cliente (aviso "sem devoluções" e o CNPJ da transportadora do
 * re-despacho).
 */

async function chooseCustomer(page: Page, text: string, id: string) {
  const picker = page.locator(
    '[data-request-customer] [data-party-picker="customer"]',
  );
  await picker.locator("[data-party-picker-input]").fill(text);
  await picker.locator(`[data-party-picker-option="${id}"]`).click();
}

async function pickDoll(page: Page) {
  const row = page.locator('[data-request-item="0"]');
  const product = row.locator('[data-product-picker="catalog"]');
  await product.locator("[data-product-picker-input]").fill("boneca");
  await product.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(row.locator('[role="status"]').first()).toBeVisible();
  await row
    .locator("[data-rounds-generator] [data-generate-total]")
    .fill("100");
}

async function send(page: Page) {
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await page.waitForURL(/\/app\/requests\/(?!new|batch)[^/?]+$/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

test("Nova solicitação (Wellmix): cliente, condições, rascunho e confirmação do cliente", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  // Um cliente novo (sem contatos pelo portal e sem login).
  const tag = Date.now().toString(36);
  // Novo cliente em Cadastros → Clientes (docs/EQUIPE_ACESSOS.md, etapa 4).
  await page.goto("/app/customers/new");
  await page.fill('input[name="name"]', `Mercado ${tag}`);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/customers\/[^/?#]+\/edit(#access)?$/);
  const newCustomer = new URL(page.url()).pathname.split("/").at(-2)!;

  await page.goto("/app/requests/new");
  // O bloco do cliente no lugar da busca por foto ou link.
  await expect(page.locator("input[name=url]")).toHaveCount(0);
  const contacts = page.locator("[data-customer-contacts]");
  await expect(contacts).toHaveAttribute("data-customer-contacts", "pick");
  // Só TS; Venda desabilitada. O aviso agora é do cliente.
  const terms = page.locator("[data-order-terms]");
  await expect(
    terms.locator('[data-order-terms-operation-option="ts"]'),
  ).toBeChecked();
  await expect(
    terms.locator('[data-order-terms-operation-option="sale"]'),
  ).toBeDisabled();
  await expect(page.locator("[data-order-terms-confirm-note]")).toBeVisible();
  // Sem país e família, a busca de produto espera.
  await expect(page.locator("[data-request-origin-missing]")).toBeVisible();

  // Cliente sem contatos pelo portal: às cegas (campos vazios).
  await chooseCustomer(page, tag, newCustomer);
  await expect(contacts).toHaveAttribute("data-customer-contacts", "blind");
  await expect(
    contacts.locator('input[name="contact.partner.email"]'),
  ).toHaveValue("");
  // Solicitante da equipe interna (dono, 18/11/2026): os contatos são
  // opcionais (o aviso aparece e nenhum campo é obrigatório).
  await expect(
    contacts.locator("[data-customer-contacts-optional]"),
  ).toBeVisible();
  await expect(contacts.locator("input[required]")).toHaveCount(0);

  // Rascunho: salva como está (sem conferir) e volta igual.
  await terms.locator('[data-order-terms-format-option="wellmix"]').check();
  await terms.locator("[data-order-terms-tier]").selectOption("hiper");
  await contacts
    .locator('input[name="contact.buyer.phone"]')
    .fill("(47) 98888-0000");
  await page.locator("[data-request-draft-save]").click();
  await page.waitForURL(/[?&]draftSaved=1/);
  const draftId = new URL(page.url()).searchParams.get("draft")!;
  await expect(page.locator(`[data-request-draft="${draftId}"]`)).toBeVisible();
  // O rascunho também fica em Encomendas, com a situação "Rascunho"
  // (dono, 17/11/2026), e "Continuar" volta a ele.
  await page.goto("/app/requests");
  const listed = page.locator(`[data-request-list-draft="${draftId}"]`);
  await expect(listed).toContainText(/Rascunho|Draft/);
  // Também com filtro de situação (dono, 17/11/2026).
  await page.goto("/app/requests?situ=late");
  await expect(listed).toBeVisible();
  await listed.locator("[data-request-list-draft-open]").click();
  await page.waitForURL(new RegExp(`/app/requests/new\\?draft=${draftId}`));
  await expect(
    terms.locator('[data-order-terms-format-option="wellmix"]'),
  ).toBeChecked();
  await expect(terms.locator("[data-order-terms-tier]")).toHaveValue("hiper");
  await expect(
    page.locator("[data-request-customer] [data-party-picker-input]"),
  ).toHaveValue(`Mercado ${tag}`);
  await expect(
    contacts.locator('input[name="contact.buyer.phone"]'),
  ).toHaveValue("(47) 98888-0000");

  // Completa para o João (login com acesso obrigatório) e envia.
  await chooseCustomer(page, "loja", "cliente-joao");
  await chooseCustomerLogin(page, "joao@lojista.com");
  await fillOrderTerms(page, { format: "wd", redispatch: "yes" });
  await expect(page.locator("[data-request-origin-missing]")).toHaveCount(0);
  // A Wellmix chama o transportador: com re-despacho, duas transportadoras.
  await expect(
    terms.locator("[data-order-terms-redispatch-carrier-summary]"),
  ).toBeVisible();
  // O cliente chama: as transportadoras saem daqui (ele informa).
  await terms
    .locator('[data-order-terms-carrier-caller-option="customer"]')
    .check();
  await expect(terms.locator("[data-order-terms-carrier]")).toHaveCount(0);
  // O valor do transporte continua (tem custo de toda forma; dono,
  // 18/11/2026); só a escolha da transportadora sai.
  await expect(terms.locator("[data-order-terms-freight]")).toBeVisible();
  await expect(
    terms.locator("[data-order-terms-carrier-caller-hint]"),
  ).toContainText("porto ao cliente");
  await terms
    .locator('[data-order-terms-carrier-caller-option="wellmix"]')
    .check();
  await terms
    .locator("[data-order-terms-carrier]")
    .selectOption("portal:transportador");
  await terms
    .locator("[data-order-terms-redispatch-carrier]")
    .selectOption("portal:transportador");
  // Cliente e transportador escolhidos: código (e CNPJ do transportador) e
  // nome logo abaixo. A busca por nome, código ou CNPJ saiu (dono,
  // 16/11/2026): só a lista "Escolha o transportador".
  await expect(page.locator("[data-request-customer-summary]")).toContainText(
    "Código",
  );
  await expect(
    page.locator("[data-order-terms-carrier-summary]"),
  ).toBeVisible();
  await expect(terms.locator("[data-order-terms-carrier-search]")).toHaveCount(
    0,
  );
  // Composição de containers: vazia sem produto; com a boneca, o container
  // 1 da programação 1 com a ocupação, fechado; abre para ver o produto.
  const composition = page.locator("[data-container-composition]");
  await expect(composition).toHaveAttribute(
    "data-container-composition",
    "empty",
  );
  await pickDoll(page);
  await expect(composition).toHaveAttribute(
    "data-container-composition",
    "ready",
  );
  await expect(composition.locator('[data-composition-cell="1-1"]')).toHaveText(
    /^\d+%$/,
  );
  await composition.locator('[data-composition-toggle="1"]').click();
  await expect(
    composition.locator("[data-composition-product]").first(),
  ).toContainText("Boneca");
  expect(
    await page
      .locator("[data-request-side-sticky]")
      .evaluate((el) => getComputedStyle(el).position),
  ).toBe("sticky");

  // Contato igual ao do vendedor (o próprio login): recusado.
  await fillCustomerContacts(page, "loja-joao");
  await contacts
    .locator('input[name="contact.buyer.email"]')
    .fill("admin@wellmix.com");
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await page.waitForURL(/error=contacts_same_as_seller/);
  await expect(page.locator("main")).toContainText(
    "não podem ser iguais aos do representante ou vendedor",
  );

  // Pelo rascunho de novo, tudo certo: nasce aguardando o cliente.
  await page.goto(`/app/requests/new?draft=${draftId}`);
  await chooseCustomer(page, "loja", "cliente-joao");
  await chooseCustomerLogin(page, "joao@lojista.com");
  // Agora o cliente chama o transportador: ele informa as duas.
  await fillOrderTerms(page, {
    format: "wd",
    redispatch: "yes",
    caller: "customer",
  });
  await pickDoll(page);
  await fillCustomerContacts(page, "loja-joao");
  const requestId = await send(page);
  await expect(page.locator("[data-request-awaiting-customer]")).toBeVisible();
  const view = page.locator("[data-request-order-terms]");
  await expect(view).toContainText("TS (Trading Sales)");
  await expect(view).toContainText("CHINA");
  await expect(view).toContainText("Brinquedos");
  await expect(view.locator("[data-request-confirmation]")).toHaveAttribute(
    "data-request-confirmation",
    "pending",
  );
  // O rascunho enviado sai da lista.
  await page.goto("/app/requests/new");
  await expect(page.locator(`[data-request-draft="${draftId}"]`)).toHaveCount(
    0,
  );

  // O cliente confirma: aviso "sem devoluções" e o CNPJ do re-despacho.
  await login(page, "joao@lojista.com");
  await page.goto(`/app/requests/${requestId}`);
  await expect(
    page.locator("[data-customer-confirm-disclaimer]"),
  ).toContainText("não há devoluções previstas para esta operação");
  await expect(page.locator("[data-customer-confirm-carrier]")).toBeVisible();
  await confirmAsCustomer(
    page,
    requestId,
    { cnpj: "11.222.333/0001-81", name: "Rodo Sul Transportes" },
    { cnpj: "11.444.777/0001-61", name: "Trans Norte Cargas" },
  );
  await expect(page.locator("[data-customer-confirm]")).toHaveCount(0);

  // A Wellmix vê o pedido confirmado, com a transportadora do re-despacho.
  await login(page, "admin@wellmix.com");
  await page.goto(`/app/requests/${requestId}`);
  await expect(page.locator("[data-request-awaiting-customer]")).toHaveCount(0);
  await expect(
    page.locator('[data-request-confirmation="confirmed"]'),
  ).toBeVisible();
  await expect(page.locator("[data-request-order-terms]")).toContainText(
    "Rodo Sul Transportes",
  );
  await expect(page.locator("[data-request-order-terms]")).toContainText(
    "Trans Norte Cargas",
  );

  // Compra para estoque: sem bloco do cliente nem condições.
  await page.goto("/app/requests/new");
  await page.locator("[data-request-customer] [data-stock-option]").check();
  await expect(contacts).toHaveAttribute("data-customer-contacts", "stock");
  await expect(page.locator('[data-order-terms="stock"]')).toBeVisible();
  await expect(page.locator("[data-request-origin-missing]")).toHaveCount(0);
});

test("Nova solicitação do próprio cliente: segue com a busca por foto ou link", async ({
  page,
}) => {
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  await expect(page.locator("input[name=url]")).toBeVisible();
  await expect(page.locator("[data-customer-contacts]")).toHaveCount(0);
  await expect(page.locator("[data-order-terms]")).toHaveCount(0);
});

test("Histórico do cliente → pedido: filtra pela família, acrescenta com um clique e marca; a composição leva ao produto", async ({
  page,
}) => {
  // Histórico do Sankhya simulado (visão Produto) com um produto da família
  // escolhida (a boneca) e outro de outra família (a jarra).
  const product = (
    code: number,
    name: string,
    productId: string,
    family: string,
  ) => ({
    key: String(code),
    code,
    name,
    total: [{ unit: "UN", quantity: 480 }],
    value: null,
    days: [{ date: "2026-09-01", quantities: [{ unit: "UN", quantity: 480 }] }],
    productId,
    family,
  });
  await page.route("**/api/purchase-history/sankhya?**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      json:
        url.searchParams.get("view") === "products"
          ? {
              state: "ok",
              products: [
                product(
                  11,
                  "Boneca articulada 30 cm",
                  "prod-boneca",
                  "fm:BRINQUEDOS",
                ),
                product(
                  12,
                  "Jarra de vidro 1,5 L",
                  "prod-jarra",
                  "fm:UTILIDADES_DOMESTICAS",
                ),
              ],
              orders: 1,
              from: "2026-09-01",
              to: "2026-09-01",
              complete: true,
              money: false,
            }
          : {
              state: "ok",
              orders: [
                {
                  nunota: 9001,
                  numnota: 1,
                  date: "2026-09-01",
                  company: 1,
                  top: 1,
                  topName: "VENDA",
                  pending: false,
                  status: "L",
                  totalBrl: null,
                  items: 2,
                },
              ],
              next: null,
            },
    });
  });
  await login(page, "admin@wellmix.com");
  await page.goto("/app/requests/new");
  await chooseCustomer(page, "loja", "cliente-joao");
  await chooseCustomerLogin(page, "joao@lojista.com");
  await fillOrderTerms(page);
  const history = page.locator("[data-sankhya-history]");
  await history
    .locator('[data-sankhya-history-view-button="products"]')
    .click();
  // Só a família escolhida (Brinquedos): a jarra fica de fora, com o aviso.
  await expect(
    history.locator('[data-history-pick="prod-boneca"]'),
  ).toBeVisible();
  await expect(history.locator('[data-history-pick="prod-jarra"]')).toHaveCount(
    0,
  );
  await expect(history.locator("[data-history-family-filtered]")).toBeVisible();
  // Clique: a boneca entra no pedido (no lugar da linha vazia) e fica marcada.
  await history.locator('[data-history-pick="prod-boneca"]').click();
  const row = page.locator('[data-request-item="1"]');
  await expect(
    row.locator('[data-product-picker="catalog"] [data-product-picker-input]'),
  ).toHaveValue(/Boneca/);
  await expect(page.locator('[data-request-item="0"]')).toHaveCount(0);
  await expect(
    history.locator('[data-history-pick="prod-boneca"]'),
  ).toHaveAttribute("data-history-pick-state", "in-order");
  await expect(history.locator("[data-history-in-order]")).toBeVisible();
  // Composição: abrir o container e clicar no produto leva até a linha dele.
  await row
    .locator("[data-rounds-generator] [data-generate-total]")
    .fill("100");
  const composition = page.locator("[data-container-composition]");
  await expect(composition).toHaveAttribute(
    "data-container-composition",
    "ready",
  );
  await composition.locator('[data-composition-toggle="1"]').click();
  // A composição fica fixa: só o histórico rola, dentro do espaço dele.
  const historyScroll = page.locator("[data-request-history-scroll]");
  expect(
    await historyScroll.evaluate((el) => getComputedStyle(el).overflowY),
  ).toBe("auto");
  await historyScroll.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(composition).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(composition).toBeInViewport();
  await composition.locator('[data-composition-goto="row-1"]').click();
  await expect(row).toBeInViewport();

  // Trocar a família com produto no pedido: o aviso recomenda terminar este
  // pedido; "Manter" desfaz a troca, "Trocar" limpa os produtos.
  const family = page.locator("[data-order-terms-group]");
  const dialog = page.locator("[data-order-terms-switch]");
  await family.selectOption("fm:INFLAVEIS");
  await expect(dialog).toBeVisible();
  await dialog.locator("[data-order-terms-switch-keep]").click();
  await expect(dialog).toBeHidden();
  await expect(family).toHaveValue("fm:BRINQUEDOS");
  await expect(
    row.locator('[data-product-picker="catalog"] [data-product-picker-input]'),
  ).toHaveValue(/Boneca/);
  await family.selectOption("fm:INFLAVEIS");
  await dialog.locator("[data-order-terms-switch-confirm]").click();
  await expect(dialog).toBeHidden();
  await expect(family).toHaveValue("fm:INFLAVEIS");
  await expect(page.locator("[data-request-item]")).toHaveCount(1);
  await expect(row).toHaveCount(0);
  await expect(
    page.locator(
      '[data-request-item] [data-product-picker="catalog"] [data-product-picker-input]',
    ),
  ).toHaveValue("");
});

test("Lupa da busca de produto: seletor com Grupo, Sub grupo e Coleção, seleção, quantidade padrão e filtro visto", async ({
  page,
}) => {
  // O seletor lê /api/products/browse; aqui a família com dois produtos
  // em dois sub grupos (no modo memória não há a árvore do Sankhya).
  type Combo = [string | null, string | null, string | null];
  const catalog = [
    {
      id: "prod-boneca",
      name: "Boneca articulada 30 cm",
      sku: "BRQ-001",
      photoId: null,
      levels: ["lv:BRINQUEDOS", "lv:BONECAS", "lv:ARTICULADAS"] as Combo,
    },
    {
      id: "prod-piscina",
      name: "Piscina inflável 2.000 L",
      sku: "INF-001",
      photoId: null,
      levels: ["lv:BRINQUEDOS", "lv:PISCINAS", "lv:INFLAVEIS"] as Combo,
    },
  ];
  const names: Record<string, string> = {
    "lv:BRINQUEDOS": "BRINQUEDOS",
    "lv:BONECAS": "BONECAS",
    "lv:PISCINAS": "PISCINAS",
    "lv:ARTICULADAS": "ARTICULADAS",
    "lv:INFLAVEIS": "INFLAVEIS",
  };
  const matches = (c: Combo, l: Combo) => c.every((v, i) => !v || l[i] === v);
  await page.route("**/api/products/browse?**", async (route) => {
    const url = new URL(route.request().url());
    const filters = [1, 2, 3].map(
      (i) => url.searchParams.get(`l${i}`) || null,
    ) as Combo;
    const seen = JSON.parse(url.searchParams.get("seen") || "[]") as Combo[];
    const isSeen = (l: Combo) => seen.some((c) => matches(c, l));
    const facets = [0, 1, 2].map((level) => {
      const counts = new Map<string, { products: number; seen: number }>();
      for (const p of catalog) {
        if (!filters.every((v, i) => i === level || !v || p.levels[i] === v))
          continue;
        const key = p.levels[level]!;
        const c = counts.get(key) ?? { products: 0, seen: 0 };
        c.products++;
        if (isSeen(p.levels)) c.seen++;
        counts.set(key, c);
      }
      return [...counts].map(([key, c]) => ({ key, name: names[key], ...c }));
    });
    const items = catalog.filter((p) => matches(filters, p.levels));
    await route.fulfill({
      json: {
        facets,
        items: items.map((p) => ({ ...p, seen: isSeen(p.levels) })),
        total: items.length,
        page: 1,
        pages: 1,
        family: {
          products: catalog.length,
          seen: catalog.filter((p) => isSeen(p.levels)).length,
        },
      },
    });
  });
  await login(page, "admin@wellmix.com");
  await page.goto("/app/requests/new");
  // Sem país e família, a lupa espera.
  await expect(
    page.locator("[data-product-browser-open]").first(),
  ).toBeDisabled();
  await chooseCustomer(page, "loja", "cliente-joao");
  await chooseCustomerLogin(page, "joao@lojista.com");
  await fillOrderTerms(page);
  await page.locator("[data-product-browser-open]").first().click();
  const browser = page.locator("[data-product-browser]");
  await expect(browser).toBeVisible();
  await expect(browser.locator("[data-product-browser-item]")).toHaveCount(2);
  // Quantidade padrão em caixas master (dono, 16/11/2026).
  await browser.locator("[data-product-browser-qty]").fill("60");

  // Sub grupo BONECAS: só a boneca; a coleção acompanha. Marca como visto.
  await browser
    .locator('[data-product-browser-level="2"]')
    .selectOption("lv:BONECAS");
  await expect(browser.locator("[data-product-browser-item]")).toHaveCount(1);
  await expect(
    browser.locator('[data-product-browser-level="3"] option'),
  ).toHaveText(["Todos", "ARTICULADAS (1)"]);
  await browser.locator("[data-product-browser-seen]").click();
  await expect(browser.locator("[data-product-browser-seen]")).toHaveAttribute(
    "data-product-browser-seen",
    "on",
  );
  await expect(browser.locator("[data-product-browser-progress]")).toHaveText(
    "1 de 2 produtos da família já vistos",
  );
  // De volta a todos: BONECAS aparece como visto.
  await browser.locator('[data-product-browser-level="2"]').selectOption("");
  await expect(
    browser.locator(
      '[data-product-browser-level="2"] option[value="lv:BONECAS"]',
    ),
  ).toHaveAttribute("data-seen", "all");

  // Clique na boneca: entra no pedido e o seletor continua aberto.
  await browser.locator('[data-product-browser-add="prod-boneca"]').click();
  await expect(
    browser.locator('[data-product-browser-item="prod-boneca"]'),
  ).toHaveAttribute("data-state", "in-order");
  await expect(browser).toBeVisible();
  // Selecionar todos (a boneca já está no pedido) e adicionar.
  await browser.locator("[data-product-browser-select-all]").check();
  await browser.locator("[data-product-browser-add-selected]").click();
  await expect(browser.locator("[data-product-browser-added]")).toHaveText(
    "1 produto(s) acrescentado(s) ao pedido.",
  );
  await expect(
    browser.locator('[data-product-browser-item="prod-piscina"]'),
  ).toHaveAttribute("data-state", "in-order");
  await browser.locator("[data-product-browser-close]").click();
  await expect(browser).toHaveCount(0);

  // Os dois no pedido com a quantidade padrão em caixas (60 caixas × peças
  // por caixa, acima do mínimo de cada um), já recolhidos em "Produtos no
  // pedido" (dono, 16/11/2026).
  const items = page.locator("[data-request-item]");
  await expect(items).toHaveCount(2);
  await expect(page.locator("[data-request-items-row]")).toHaveCount(2);
  for (let i = 0; i < 2; i++) await expect(items.nth(i)).toBeHidden();
  const inputs = page.locator(
    '[data-request-item] [data-product-picker="catalog"] [data-product-picker-input]',
  );
  await expect(inputs.nth(0)).toHaveValue(/Boneca/);
  await expect(inputs.nth(1)).toHaveValue(/Piscina/);
  for (const [i, pieces] of [
    [0, "2880"],
    [1, "360"],
  ] as const)
    await expect(
      items.nth(i).locator('input[type="hidden"][name$=".quantity"]'),
    ).toHaveValue(pieces);

  // Reabre: com os produtos recolhidos, "+ Adicionar outro produto" abre a
  // ficha nova com a lupa; o filtro visto continua (no navegador).
  await page.click("[data-add-request-item]");
  await page.locator("[data-product-browser-open]:visible").click();
  await expect(browser.locator("[data-product-browser-progress]")).toHaveText(
    "1 de 2 produtos da família já vistos",
  );

  // Rascunho automático com os produtos (dono, 18/11/2026): reaberto, volta
  // com os dois (e a linha nova, ainda vazia); e só abrir não grava por cima
  // (abre de novo, igual).
  await expect(page.locator("[data-request-autosaved='1']")).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(3_000);
  const draftId = new URL(page.url()).searchParams.get("draft");
  expect(draftId).toBeTruthy();
  for (let i = 0; i < 2; i++) {
    await page.goto(`/app/requests/new?draft=${draftId}`);
    await expect(page.locator("[data-request-item]")).toHaveCount(3);
    await expect(inputs.nth(0)).toHaveValue(/Boneca/);
    await page.waitForTimeout(3_000);
  }
});

test("Lupa com a ficha demorando: dois produtos seguidos ficam os dois no pedido", async ({
  page,
}) => {
  // O seletor lê /api/products/browse; aqui a família com dois produtos
  // em dois sub grupos (no modo memória não há a árvore do Sankhya).
  type Combo = [string | null, string | null, string | null];
  const catalog = [
    {
      id: "prod-boneca",
      name: "Boneca articulada 30 cm",
      sku: "BRQ-001",
      photoId: null,
      levels: ["lv:BRINQUEDOS", "lv:BONECAS", "lv:ARTICULADAS"] as Combo,
    },
    {
      id: "prod-piscina",
      name: "Piscina inflável 2.000 L",
      sku: "INF-001",
      photoId: null,
      levels: ["lv:BRINQUEDOS", "lv:PISCINAS", "lv:INFLAVEIS"] as Combo,
    },
  ];
  const names: Record<string, string> = {
    "lv:BRINQUEDOS": "BRINQUEDOS",
    "lv:BONECAS": "BONECAS",
    "lv:PISCINAS": "PISCINAS",
    "lv:ARTICULADAS": "ARTICULADAS",
    "lv:INFLAVEIS": "INFLAVEIS",
  };
  const matches = (c: Combo, l: Combo) => c.every((v, i) => !v || l[i] === v);
  await page.route("**/api/products/browse?**", async (route) => {
    const url = new URL(route.request().url());
    const filters = [1, 2, 3].map(
      (i) => url.searchParams.get(`l${i}`) || null,
    ) as Combo;
    const seen = JSON.parse(url.searchParams.get("seen") || "[]") as Combo[];
    const isSeen = (l: Combo) => seen.some((c) => matches(c, l));
    const facets = [0, 1, 2].map((level) => {
      const counts = new Map<string, { products: number; seen: number }>();
      for (const p of catalog) {
        if (!filters.every((v, i) => i === level || !v || p.levels[i] === v))
          continue;
        const key = p.levels[level]!;
        const c = counts.get(key) ?? { products: 0, seen: 0 };
        c.products++;
        if (isSeen(p.levels)) c.seen++;
        counts.set(key, c);
      }
      return [...counts].map(([key, c]) => ({ key, name: names[key], ...c }));
    });
    const items = catalog.filter((p) => matches(filters, p.levels));
    await route.fulfill({
      json: {
        facets,
        items: items.map((p) => ({ ...p, seen: isSeen(p.levels) })),
        total: items.length,
        page: 1,
        pages: 1,
        family: {
          products: catalog.length,
          seen: catalog.filter((p) => isSeen(p.levels)).length,
        },
      },
    });
  });
  // A ficha do produto demora (o Sankhya em produção).
  await page.route("**/api/products/fill?**", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await login(page, "admin@wellmix.com");
  await page.goto("/app/requests/new");
  await chooseCustomer(page, "loja", "cliente-joao");
  await chooseCustomerLogin(page, "joao@lojista.com");
  await fillOrderTerms(page);
  await page.locator("[data-product-browser-open]").first().click();
  const browser = page.locator("[data-product-browser]");
  await expect(browser.locator("[data-product-browser-item]")).toHaveCount(2);
  await browser.locator("[data-product-browser-qty]").fill("60");
  await browser.locator('[data-product-browser-add="prod-boneca"]').click();
  await browser.locator('[data-product-browser-add="prod-piscina"]').click();
  await browser.locator("[data-product-browser-close]").click();
  await expect(page.locator("[data-request-items-row]")).toHaveCount(2);
  const items = page.locator("[data-request-item]");
  await expect(items).toHaveCount(2);
  for (const [i, pieces] of [
    [0, "2880"],
    [1, "360"],
  ] as const)
    await expect(
      items.nth(i).locator('input[type="hidden"][name$=".quantity"]'),
    ).toHaveValue(pieces);
});

test("Previsão de preço (cotação V2): manda formato, nível e quem chama; mostra o preço, o frete e o WD", async ({
  page,
}) => {
  // O frete de entrega padrão fica nas Configurações (R$ 8.000 de início).
  await login(page, "admin@wellmix.com");
  await page.goto("/app/settings");
  await expect(page.locator("[data-settings-delivery-freight]")).toHaveValue(
    "8000",
  );
  // A previsão é do Sankhya (aqui simulada): confere o que a tela manda.
  const asked: URLSearchParams[] = [];
  await page.route("**/api/price-forecast?**", async (route) => {
    asked.push(new URL(route.request().url()).searchParams);
    await route.fulfill({
      json: {
        mode: "api",
        kind: "forecast",
        salePrice: null,
        tablePrice: null,
        wholesalePrice: null,
        retailPrice: null,
        targetPrice: null,
        cost: null,
        profitPercent: null,
        goalPercent: null,
        status: "PRONTA",
        productPrice: 9.2,
        freightUnit: 0.8,
        withFreight: 10,
        wdBase: null,
        wdPercent: null,
        wdPrice: 10.63,
        wdWithFreight: 11.43,
        goalReached: true,
        sent: { vip: 3, route: "PORTO_CLIENTE", deliveryFreightBrl: 8000 },
      },
    });
  });
  await page.goto("/app/requests/new");
  await chooseCustomer(page, "loja", "cliente-joao");
  await chooseCustomerLogin(page, "joao@lojista.com");
  await fillOrderTerms(page, {
    format: "wellmix",
    tier: "hiper",
    caller: "customer",
  });
  await pickDoll(page);
  const forecast = page
    .locator('[data-request-item="0"] [data-price-forecast]')
    .first();
  // Sem botão (dono, 16/11/2026): escolhido o produto, a conta roda sozinha.
  await expect(forecast.locator("[data-price-forecast-submit]")).toHaveCount(0);
  // Só "Preço" e "Valor total": sempre com frete (dono, 16/11/2026), mesmo
  // com o cliente chamando (PRECO_COM_FRETE_REFERENCIA).
  const priceLine = forecast.locator('[data-price-forecast-line="price"]');
  await expect(priceLine).toHaveText(/10,00/);
  await expect(
    forecast.locator('[data-price-forecast-line="total"]'),
  ).toHaveText(/R\$/);
  for (const gone of ["product", "withFreight", "wd", "retail"])
    await expect(
      forecast.locator(`[data-price-forecast-line="${gone}"]`),
    ).toHaveCount(0);
  await expect(forecast.locator("[data-price-forecast-sent]")).toHaveCount(0);
  await expect(forecast.getByText("Memória de cálculo")).toHaveCount(0);
  // O preço de venda desejado só na compra para estoque.
  await expect(
    forecast.locator('[data-price-forecast-mode="target"]'),
  ).toHaveCount(0);
  // Valor total do pedido, ao lado do formato de venda: a soma das linhas.
  const quantity = Number(
    await page
      .locator(
        '[data-request-item="0"] input[type="hidden"][name$=".quantity"]',
      )
      .inputValue(),
  );
  await expect(page.locator("[data-order-terms-total]")).toHaveAttribute(
    "data-order-terms-total",
    (10 * quantity).toFixed(2),
  );
  // Forma de pagamento logo abaixo do Valor total (dono, 16/11/2026): a
  // previsão reparte o valor total pelas parcelas da forma escolhida.
  const payment = page.locator("[data-order-terms-payment]");
  await payment
    .locator("[data-order-terms-payment-plan]")
    .selectOption({ label: "10% no pedido; 90% no embarque" });
  const total = 10 * quantity;
  await expect(
    payment.locator('[data-order-terms-payment-row="1"]'),
  ).toHaveAttribute("data-amount", (total * 0.1).toFixed(2));
  await expect(
    payment.locator('[data-order-terms-payment-row="2"]'),
  ).toHaveAttribute("data-amount", (total * 0.9).toFixed(2));
  await expect(
    payment.locator('[data-order-terms-payment-row="1"]'),
  ).toContainText("No pedido");
  await expect(
    payment.locator('[data-order-terms-payment-row="2"]'),
  ).toContainText("No embarque");
  const last = () => asked[asked.length - 1];
  expect(last().get("saleFormat")).toBe("wellmix");
  expect(last().get("tier")).toBe("hiper");
  expect(last().get("caller")).toBe("customer");
  expect(last().get("freight")).toBeNull();

  // A Wellmix chama: o preço é o com frete e o valor do transporte digitado
  // vai no lugar do padrão; a conta roda de novo sozinha.
  const terms = page.locator("[data-order-terms]");
  await terms
    .locator('[data-order-terms-carrier-caller-option="wellmix"]')
    .check();
  await terms
    .locator("[data-order-terms-carrier]")
    .selectOption("portal:transportador");
  await terms.locator("[data-order-terms-freight]").fill("1.500,50");
  await expect(priceLine).toHaveText(/10,00/);
  await expect.poll(() => last().get("freight")).toBe("1500.5");
  expect(last().get("caller")).toBe("wellmix");

  // Formato WD (dono, 16/11/2026): o preço é o WD com frete
  // (PRECO_WD_COM_FRETE_REFERENCIA), com o valor do transporte na chamada.
  await terms.locator('[data-order-terms-format-option="wd"]').check();
  await expect(priceLine).toHaveText(/11,43/);
  await expect.poll(() => last().get("saleFormat")).toBe("wd");
  expect(last().get("freight")).toBe("1500.5");
  // WD com o cliente chamando: o valor do transporte continua na tela.
  await terms
    .locator('[data-order-terms-carrier-caller-option="customer"]')
    .check();
  await expect(terms.locator("[data-order-terms-freight]")).toHaveValue(
    "1.500,50",
  );
  await expect(priceLine).toHaveText(/11,43/);
  await expect.poll(() => last().get("caller")).toBe("customer");
  expect(last().get("freight")).toBe("1500.5");

  // Compra para estoque: o cliente sai da busca e aparece o preço desejado.
  await page.locator("[data-stock-option]").check();
  await expect(
    page.locator("[data-request-customer] [data-party-picker-input]"),
  ).toHaveValue("");
  await expect(
    forecast.locator('[data-price-forecast-mode="target"]'),
  ).toBeVisible();
});
