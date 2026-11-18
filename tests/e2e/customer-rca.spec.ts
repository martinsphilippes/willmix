import { expect, test, type Locator, type Page } from "@playwright/test";
import { fillCustomerContacts, fillOrderTerms, login } from "./helpers";

/*
 * RCA do cliente (dono, 15/11/2026; docs/CUSTOMER_RCA.md). No cadastro do
 * cliente, o campo "RCA responsável" com os vendedores do Sankhya (no E2E,
 * a lista de demonstração: Ana 101, Bruno 102 e Carla 103, inativa): trocar,
 * remover e ver o mesmo ao reabrir. Na Nova solicitação: o RCA do cliente
 * escolhido (só consulta), trocando junto com o cliente; "Sem RCA
 * vinculado"; o Solicitante é quem está criando; o Login do cliente com
 * acesso só com os logins do cliente escolhido; compra para estoque limpa o
 * RCA e o acesso. A solicitação aberta pela Wellmix e a aberta pelo próprio
 * cliente seguem as regras de visibilidade de antes.
 */

const people = (page: Page) => page.locator("[data-request-people]");
const rcaField = (page: Page) => page.locator("[data-request-rca]");
// Login do cliente com acesso (dono, 18/11/2026): só mostra que a
// solicitação vai para todos os logins do cliente.
const access = (page: Page) => page.locator("[data-request-access-all]");
const picker = (page: Page) =>
  page.locator('[data-request-customer] [data-party-picker="customer"]');

async function chooseCustomer(page: Page, text: string, id: string) {
  await picker(page).locator("[data-party-picker-input]").fill(text);
  const option = picker(page).locator(`[data-party-picker-option="${id}"]`);
  await expect(option).toBeVisible();
  await option.click();
}

/** O RCA mostrado na Nova solicitação e o estado do campo. */
async function expectRca(page: Page, state: string, text: string) {
  await expect(rcaField(page)).toHaveAttribute("data-request-rca-state", state);
  await expect(rcaField(page)).toHaveValue(text);
}

async function openParty(page: Page, id: string) {
  await page.goto(`/app/parties/${id}`);
  return page.locator("[data-party-rca]");
}

/** Grava o RCA no cadastro do cliente (o botão Salvar do cadastro). */
async function saveRca(page: Page, block: Locator, code: string) {
  await block.locator("[data-party-rca-select]").selectOption(code);
  // A ação volta para o mesmo endereço: espera a resposta do envio.
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page
      .locator("form:has([data-party-rca])")
      .getByRole("button", { name: /^(Salvar|Save)$/ })
      .click(),
  ]);
}

/** Uma linha de produto (boneca) e o envio; devolve o id da solicitação. */
async function sendDoll(page: Page) {
  const row = page.locator('[data-request-item="0"]');
  const product = row.locator('[data-product-picker="catalog"]');
  await product.locator("[data-product-picker-input]").fill("boneca");
  await product.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(row.locator('[role="status"]').first()).toBeVisible();
  // Pedido único (1 programação, o padrão): só a quantidade, sem gerar.
  const gen = row.locator("[data-rounds-generator]");
  await gen.locator("[data-generate-total]").fill("100");
  await expect(gen.locator("[data-generate-submit]")).toBeHidden();
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await page.waitForURL(/\/app\/requests\/(?!new|batch)[^/?]+$/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

test("RCA no cadastro do cliente: trocar, remover e reabrir", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  let block = await openParty(page, "cliente-joao");
  const select = () => block.locator("[data-party-rca-select]");
  await expect(block).toContainText("RCA responsável");
  await expect(select()).toHaveValue("101");
  await expect(block.locator("[data-party-rca-list]")).toHaveText(
    "Lista de demonstração: 3 vendedores (no portal real ela vem do Sankhya).",
  );
  // Os ativos, com o código; o inativo não é oferecido.
  const options = await select().locator("option").allInnerTexts();
  expect(options).toEqual([
    "Sem RCA",
    "5101 - Ana Representações",
    "5102 - Bruno Vendas",
  ]);

  // Trocar: Bruno; ao reabrir, o Bruno.
  await saveRca(page, block, "102");
  block = await openParty(page, "cliente-joao");
  await expect(select()).toHaveValue("102");
  // Remover: sem RCA; ao reabrir, sem RCA.
  await saveRca(page, block, "0");
  block = await openParty(page, "cliente-joao");
  await expect(select()).toHaveValue("0");
  // De volta à Ana (o RCA da demonstração).
  await saveRca(page, block, "101");
  block = await openParty(page, "cliente-joao");
  await expect(select()).toHaveValue("101");

  // Fornecedor não tem RCA.
  await page.goto("/app/parties/fornecedor-a");
  await expect(page.locator("[data-party-rca]")).toHaveCount(0);
});

test("Nova solicitação (Wellmix): RCA do cliente, solicitante e login com acesso", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/requests/new");
  // Cliente | Login do cliente com acesso; Solicitante | RCA do cliente.
  await expect(people(page)).toContainText("Login do cliente com acesso");
  await expect(people(page)).toContainText("Solicitante");
  await expect(people(page)).toContainText("RCA do cliente");
  await expect(people(page)).not.toContainText(
    "Solicitante (login do cliente)",
  );
  // O solicitante é quem está criando (só consulta).
  const requester = people(page).locator("[data-request-requester]");
  await expect(requester).toHaveValue("Ana Admin");
  await expect(requester).toHaveAttribute("readonly", "");
  await expect(rcaField(page)).toHaveAttribute("readonly", "");
  // Sem cliente: escolher o cliente.
  await expectRca(page, "pick", "Escolha o cliente para ver o RCA.");
  await expect(access(page)).toHaveValue("");
  await expect(access(page)).toHaveAttribute("readonly", "");

  // RCA ao lado do Solicitante (mesma linha nas telas largas).
  const req = await requester.boundingBox();
  const rca = await rcaField(page).boundingBox();
  expect(req && rca).toBeTruthy();
  expect(Math.abs(req!.y - rca!.y)).toBeLessThan(4);
  expect(rca!.x).toBeGreaterThan(req!.x);

  // Loja do João: RCA Ana; a solicitação vai para todos os logins dele
  // (sem escolher; dono, 18/11/2026).
  await chooseCustomer(page, "loja", "cliente-joao");
  await expectRca(page, "ready", "5101 - Ana Representações");
  await expect(access(page)).toHaveValue("Todos os logins do cliente (1)");
  await expect(page.locator('select[name="requestedForUserId"]')).toHaveCount(
    0,
  );

  // Trocar para a Wellmix SC: outro RCA (Bruno); sem login no portal.
  await chooseCustomer(page, "wellmix sc", "wellmix-sc");
  await expectRca(page, "ready", "5102 - Bruno Vendas");
  await expect(access(page)).toHaveValue("");
  await expect(people(page)).toContainText(
    "Este cliente não tem login no portal.",
  );

  // Compra para estoque: sem RCA e sem acesso de cliente; o solicitante fica.
  await page.locator("[data-request-customer] [data-stock-option]").check();
  await expectRca(page, "stock", "Compra para estoque: sem RCA.");
  await expect(access(page)).toHaveValue("");
  await expect(requester).toHaveValue("Ana Admin");
  // A compra para estoque tira o cliente da busca (dono, 16/11/2026): ao
  // desmarcar, o campo fica em branco e o RCA espera a escolha.
  await expect(
    page.locator("[data-request-customer] [data-party-picker-input]"),
  ).toHaveValue("");
  await page.locator("[data-request-customer] [data-stock-option]").uncheck();
  await expect(rcaField(page)).toHaveAttribute(
    "data-request-rca-state",
    "pick",
  );

  // De volta ao João: Ana de novo e todos os logins dele.
  await chooseCustomer(page, "loja", "cliente-joao");
  await expectRca(page, "ready", "5101 - Ana Representações");
  await expect(access(page)).toHaveValue("Todos os logins do cliente (1)");

  // Cliente sem RCA: tira o RCA do João no cadastro.
  let block = await openParty(page, "cliente-joao");
  await saveRca(page, block, "0");
  await page.goto("/app/requests/new");
  await chooseCustomer(page, "loja", "cliente-joao");
  await expectRca(page, "none", "Sem RCA vinculado");
  block = await openParty(page, "cliente-joao");
  await saveRca(page, block, "101");

  // Solicitação aberta pela Wellmix para o João, sem escolher login: vai
  // para todos os logins do cliente, e o João vê a solicitação.
  await page.goto("/app/requests/new");
  await chooseCustomer(page, "loja", "cliente-joao");
  await expectRca(page, "ready", "5101 - Ana Representações");
  // Condições do pedido e contatos do cliente (docs/ORDER_TERMS.md).
  await fillOrderTerms(page);
  await fillCustomerContacts(page, "loja-joao");
  const requestId = await sendDoll(page);
  await expect(
    page.locator('[data-request-requester] select[name="requestedForUserId"]'),
  ).toHaveValue("");
  await login(page, "joao@lojista.com");
  const seen = await page.goto(`/app/requests/${requestId}`);
  expect(seen?.status()).toBe(200);
  await expect(page.locator("main")).not.toContainText(/não encontrad/i);
});

test("Nova solicitação aberta pelo próprio cliente: ele é o solicitante e o login com acesso", async ({
  page,
}) => {
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  const self = page.locator('[data-request-people="self"]');
  await expect(self.locator("[data-request-requester]")).toHaveValue(
    "João Cliente",
  );
  await expect(self.locator('[data-request-access="self"]')).toHaveValue(
    "João Cliente (joao@lojista.com)",
  );
  await expect(self).toContainText(
    "O seu login: você vê a solicitação e o pedido.",
  );
  // O cliente não escolhe cliente nem vê o RCA (dado interno da Wellmix).
  await expect(page.locator("[data-request-customer]")).toHaveCount(0);
  await expect(page.locator("[data-request-rca]")).toHaveCount(0);
  expect(
    (await page.request.get("/api/parties/rca?customer=cliente-joao")).status(),
  ).toBe(404);
  const requestId = await sendDoll(page);
  // Na lista dele, a solicitação que ele abriu (a linha abre a página do
  // pedido, também com um produto só; docs/ORDER_LEVEL_LISTS.md).
  await page.goto("/app/requests");
  await expect(
    page.locator(`a[href="/app/requests/batch/${requestId}"]`).first(),
  ).toBeVisible();
});
