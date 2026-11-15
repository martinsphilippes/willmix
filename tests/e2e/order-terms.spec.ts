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
  await page.goto("/app/parties/new?type=customer");
  await page.fill('input[name="name"]', `Mercado ${tag}`);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?]+$/);
  const newCustomer = new URL(page.url()).pathname.split("/").pop()!;

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
  // Cliente e transportador escolhidos: código (e CNPJ do transportador) e
  // nome logo abaixo; o transportador também se busca por código ou CNPJ.
  await expect(page.locator("[data-request-customer-summary]")).toContainText(
    "Código",
  );
  await expect(
    page.locator("[data-order-terms-carrier-summary]"),
  ).toBeVisible();
  await terms.locator("[data-order-terms-carrier-search]").fill("zzzz-nada");
  await expect(terms.locator("[data-order-terms-carrier]")).toHaveValue(
    "portal:transportador",
  );
  await terms.locator("[data-order-terms-carrier-search]").fill("");
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
  await fillOrderTerms(page, { format: "wd", redispatch: "yes" });
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
  await confirmAsCustomer(page, requestId, {
    cnpj: "11.222.333/0001-81",
    name: "Rodo Sul Transportes",
  });
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
