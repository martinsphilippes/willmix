import { expect, test, type Page } from "@playwright/test";
import {
  chooseCustomerLogin,
  confirmAsCustomer,
  createdRequestId,
  fillCustomerContacts,
  fillOrderTerms,
  login,
  setAutoQuote,
} from "./helpers";

/*
 * De quem é a vez (dono, 18/11/2026; docs/TURNS.md): a venda pela Wellmix
 * aguardando o cliente aparece em "Em aberto" com a situação "Aguardando
 * cliente" e o Próximo passo "Confirmar pedido"; o cliente recebe a ação nas
 * Pendências dele; confirmada, a pendência dele some, a encomenda entra direto
 * na Estratégia e a cotação sai sozinha (dono, 22/11/2026: sem o "Enviar para
 * cotação"), com a vez no fornecedor e o filtro "Com quem está" coerente. A
 * encomenda aberta pelo próprio cliente continua com o "Enviar para cotação"
 * da Wellmix.
 */

async function newSaleForJoao(page: Page) {
  await page.goto("/app/requests/new");
  const picker = page.locator(
    '[data-request-customer] [data-party-picker="customer"]',
  );
  await picker.locator("[data-party-picker-input]").fill("loja");
  await picker.locator('[data-party-picker-option="cliente-joao"]').click();
  await chooseCustomerLogin(page, "joao@lojista.com");
  await fillOrderTerms(page);
  const row = page.locator('[data-request-item="0"]');
  const product = row.locator('[data-product-picker="catalog"]');
  await product.locator("[data-product-picker-input]").fill("boneca");
  await product.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(row.locator('[role="status"]').first()).toBeVisible();
  await row
    .locator("[data-rounds-generator] [data-generate-total]")
    .fill("100");
  await fillCustomerContacts(page, "loja-joao");
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await createdRequestId(page);
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** Encomenda aberta pelo próprio cliente: segue com o "Enviar para cotação". */
async function customerEncomenda(page: Page) {
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  const item = page.locator('[data-request-item="0"]');
  const product = item.locator('[data-product-picker="catalog"]');
  await product.locator("[data-product-picker-input]").fill("boneca");
  await product.locator('[data-product-picker-option="prod-boneca"]').click();
  // Produto do catálogo: a quantidade já vem no pedido mínimo (em caixas).
  await expect(item.locator("[data-selection-quantity]")).not.toHaveValue("");
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  await createdRequestId(page);
  return new URL(page.url()).pathname.split("/").pop()!;
}

test("venda aguardando o cliente: Em aberto e com o cliente; ele confirma pelas Pendências e a cotação sai sozinha", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  // A chave do padrão: a encomenda vira cotação sozinha (dono, 22/11/2026).
  await setAutoQuote(page, true);
  const requestId = await newSaleForJoao(page);

  // Detalhe: a vez é do cliente e o Próximo passo é Confirmar pedido.
  await expect(
    page.locator('[data-request-turn="customer"]').first(),
  ).toContainText("Aguardando cliente");
  await expect(page.locator('[data-request-next="confirm"]')).toContainText(
    "Confirmar pedido",
  );

  // Lista: em "Em aberto", no filtro "Com quem está: Cliente".
  await page.goto("/app/requests?situ=open&vez=customer");
  await expect(page.locator('[data-turn="customer"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
  const row = page.locator(`[data-request-row="${requestId}"]`);
  await expect(row.locator('[data-request-turn="customer"]')).toContainText(
    "Aguardando cliente",
  );
  await expect(row.locator('[data-request-next="confirm"]')).toContainText(
    "Confirmar pedido",
  );
  // Quem deve agir (dono, 19/11/2026): o login do cliente que confirma.
  await expect(
    row.locator('[data-request-next="confirm"] [data-request-responsible]'),
  ).toHaveText("João Cliente · Cliente");

  // O cliente: "Confirmar pedido" nas Pendências, levando ao cartão.
  await login(page, "joao@lojista.com");
  await page.goto("/app/tasks?type=customer_confirm");
  const task = page.locator(
    `[data-task-row][data-task-group="customer_confirm"] a[href="/app/requests/${requestId}"]:not([data-open-link])`,
  );
  await expect(task).toBeVisible();
  await expect(task).toContainText("Confirmar pedido");
  await task.click();
  await page.waitForURL(new RegExp(`/app/requests/${requestId}$`));
  await expect(page.locator("[data-customer-confirm]")).toBeVisible();
  await expect(
    page.locator('[data-request-turn="customer"]').first(),
  ).toContainText("Aguardando você");
  await confirmAsCustomer(page, requestId);

  // Confirmada: a pendência dele sumiu; a vez é da Wellmix.
  await page.goto("/app/tasks");
  await expect(
    page.locator(`[data-task-row] a[href="/app/requests/${requestId}"]`),
  ).toHaveCount(0);

  // Encomenda vira cotação na hora (dono, 22/11/2026): sem a Estratégia e
  // sem o "Enviar para cotação", a cotação já saiu para os fornecedores. A
  // vez é do fornecedor (responder a cotação); o filtro "Cliente" não a
  // mostra mais.
  await login(page, "admin@wellmix.com");
  await page.goto(`/app/requests/batch/${requestId}`);
  await expect(page.locator(`[data-batch-sent="${requestId}"]`)).toContainText(
    "Virou cotação sozinha",
  );
  await page.goto("/app/requests?vez=supplier");
  await expect(row.locator('[data-request-turn="supplier"]')).toBeVisible();
  await expect(row.locator('[data-request-next="quote_answer"]')).toBeVisible();
  await page.goto("/app/requests?vez=customer");
  await expect(row).toHaveCount(0);
  // Nenhuma pendência "Enviar para cotação" para ela.
  await page.goto("/app/tasks?type=new_request");
  await expect(
    page.locator(
      `[data-task-row] a[href="/app/requests/${requestId}"]:not([data-open-link])`,
    ),
  ).toHaveCount(0);
  // Não ficou esperando estratégia: a cotação já saiu.
  await page.goto("/app/purchase-strategy");
  await expect(page.locator('[data-strategy-tabs="waiting"]')).toBeVisible();
  await expect(page.locator(`[data-strategy-line="${requestId}"]`)).toHaveCount(
    0,
  );
});

test("Pedidos: a coluna e o filtro Com quem está seguem a mesma regra", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/orders");
  const filter = page.locator('[data-orders-filter="w"]');
  await expect(filter).toBeVisible();
  // As partes do filtro são as das linhas (pelo menos uma com a vez).
  const options = await filter.locator("option").allInnerTexts();
  expect(options[0]).toMatch(/Tod/);
  expect(options.length).toBeGreaterThan(1);
  // Escolher uma parte mostra só as linhas com ela.
  const value = await filter.locator("option").nth(1).getAttribute("value");
  await filter.selectOption(value!);
  await page.waitForURL(new RegExp(`[?&]w=${value}`));
  const cells = page.locator("[data-orders-turn]");
  await expect(cells.first()).toBeVisible();
  for (const v of await cells.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-orders-turn")),
  ))
    expect(v).toBe(value);
});

/**
 * Um cliente novo, sem nenhum login, recebe uma venda da Wellmix (o
 * administrador logado). Os contatos levam o prefixo dado: o do comprador
 * é `buyer@<prefixo>.com`.
 */
async function saleForNewCustomer(page: Page, name: string, prefix: string) {
  const tag = Date.now().toString(36);
  const customerName = `${name} ${tag}`;
  await page.goto("/app/customers/new");
  await page.fill('input[name="name"]', customerName);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/customers\/[^/?#]+\/edit(#access)?$/);
  const customerId = new URL(page.url()).pathname.split("/").at(-2)!;

  await page.goto("/app/requests/new");
  const picker = page.locator(
    '[data-request-customer] [data-party-picker="customer"]',
  );
  await picker.locator("[data-party-picker-input]").fill(tag);
  await picker.locator(`[data-party-picker-option="${customerId}"]`).click();
  await expect(
    page.locator("[data-request-people] [data-request-access-all]"),
  ).toHaveAttribute("data-request-access-all", "0");
  await fillOrderTerms(page);
  const item = page.locator('[data-request-item="0"]');
  const product = item.locator('[data-product-picker="catalog"]');
  await product.locator("[data-product-picker-input]").fill("boneca");
  await product.locator('[data-product-picker-option="prod-boneca"]').click();
  await expect(item.locator('[role="status"]').first()).toBeVisible();
  await item
    .locator("[data-rounds-generator] [data-generate-total]")
    .fill("100");
  await fillCustomerContacts(page, `${prefix}-${tag}`);
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  const requestId = await createdRequestId(page);
  return {
    requestId,
    customerId,
    customerName,
    buyer: `buyer@${prefix}-${tag}.com`,
  };
}

test("cliente sem login: o administrador cria o login pelo balão Quem pode agir e o cliente confirma", async ({
  page,
}) => {
  // Resolver pelo balão (dono, 20/11/2026; docs/ORDER_LEVEL_LISTS.md,
  // seção 10): um cliente novo, sem nenhum login, recebe uma venda.
  await login(page, "admin@wellmix.com");
  const { requestId, customerName, buyer } = await saleForNewCustomer(
    page,
    "Loja Balão",
    "balao",
  );

  // Lista: ninguém pode confirmar; o balão traz o formulário curto.
  await page.goto("/app/requests?situ=open");
  const row = page.locator(`[data-request-row="${requestId}"]`);
  const who = row.locator('[data-request-responsible="login"]');
  await expect(who).toHaveText("Responsável não definido");
  await who.click();
  const tip = page.locator('[data-info-tip][role="dialog"]');
  await expect(tip).toBeVisible();
  await expect(
    tip.locator('[data-request-responsible-missing="login"]'),
  ).toBeVisible();
  const form = tip.locator('[data-request-fix="customer_login"]');
  await expect(form).toContainText(`Criar o login de ${customerName}`);
  // Já sugeridos: o e-mail do comprador (contatos da encomenda), o nome do
  // cliente e uma senha provisória.
  const loginInput = form.locator("[data-request-fix-login]");
  await expect(loginInput).toHaveValue(buyer);
  await expect(form.locator("[data-request-fix-name]")).toHaveValue(
    customerName,
  );
  const password = await form
    .locator("[data-request-fix-password-input]")
    .inputValue();
  expect(password.length).toBeGreaterThanOrEqual(8);
  await form.locator("[data-request-fix-submit]").click();

  // Criado: o login e a senha para passar ao cliente.
  const done = tip.locator("[data-request-fix-done]");
  await expect(done).toBeVisible();
  await expect(done.locator("[data-request-fix-login-created]")).toHaveText(
    buyer,
  );
  await expect(done.locator("[data-request-fix-password]")).toHaveText(
    password,
  );
  // Fechar e abrir de novo não perde a resposta.
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();
  await who.click();
  await expect(done).toBeVisible();
  await done.locator("[data-request-fix-refresh]").click();
  // A encomenda passou a ter quem confirma: o login novo do cliente.
  await expect(
    row.locator('[data-request-next="confirm"] [data-request-responsible]'),
  ).toHaveText(`${customerName} · Cliente`);

  // O cliente entra com a senha provisória (a troca é oferecida) e
  // confirma pelas Pendências.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/e-mail|email|邮箱/i).fill(buyer);
  await page.getByLabel(/senha|password|密码/i).fill(password);
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await page.waitForURL(/\/app/);
  await expect(page.locator('[data-password-change="first"]')).toBeVisible();
  await page
    .locator("[data-password-skip]")
    .getByRole("button", { name: "Continuar sem trocar a senha" })
    .click();
  await page.goto("/app/tasks?type=customer_confirm");
  await expect(
    page.locator(
      `[data-task-row][data-task-group="customer_confirm"] a[href="/app/requests/${requestId}"]:not([data-open-link])`,
    ),
  ).toContainText("Confirmar pedido");
});

test("Pendências: Login do cliente a definir com o mesmo formulário do balão", async ({
  page,
}) => {
  // O mesmo formulário nas Pendências (dono, 20/11/2026;
  // docs/ORDER_LEVEL_LISTS.md, seção 10).
  await login(page, "admin@wellmix.com");
  const { customerId, customerName, buyer } = await saleForNewCustomer(
    page,
    "Loja Pendência",
    "pendencia",
  );
  await page.goto("/app/tasks?type=customer_login");
  const row = page.locator(
    '[data-task-row][data-task-group="customer_login"]',
    { has: page.locator(`a[href="/app/parties/${customerId}#access"]`) },
  );
  await expect(row).toHaveCount(1);
  await row
    .locator('[data-task-fix="customer_login"] [data-task-fix-open]')
    .click();
  const tip = page.locator('[data-info-tip][role="dialog"]');
  await expect(tip).toBeVisible();
  const form = tip.locator('[data-request-fix="customer_login"]');
  await expect(form).toContainText(`Criar o login de ${customerName}`);
  await expect(form.locator("[data-request-fix-login]")).toHaveValue(buyer);
  await form.locator("[data-request-fix-submit]").click();
  const done = tip.locator("[data-request-fix-done]");
  await expect(done.locator("[data-request-fix-login-created]")).toHaveText(
    buyer,
  );
  // Atualizada a tela, a pendência sumiu (a encomenda tem quem confirma).
  await done.locator("[data-request-fix-refresh]").click();
  await expect(row).toHaveCount(0);
});

test("tela baixa (iPad em janela menor): o balão cabe na tela e o formulário inteiro é alcançável", async ({
  page,
}) => {
  // Dono, 20/11/2026: no iPad o balão passava do fim da tela e o formulário
  // não aparecia inteiro.
  await login(page, "admin@wellmix.com");
  const { requestId, buyer } = await saleForNewCustomer(
    page,
    "Loja Tela Baixa",
    "telabaixa",
  );
  await page.setViewportSize({ width: 1024, height: 560 });
  await page.goto("/app/requests?situ=open");
  const who = page
    .locator(`[data-request-row="${requestId}"]`)
    .locator('[data-request-responsible="login"]');
  await who.scrollIntoViewIfNeeded();
  await who.click();
  const tip = page.locator('[data-info-tip][role="dialog"]');
  await expect(tip).toBeVisible();
  // O balão inteiro dentro da tela (ele rola por dentro).
  const box = (await tip.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(560 + 1);
  // O botão do fim do formulário aparece rolando o balão, e cria o login.
  const submit = tip.locator("[data-request-fix-submit]");
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  await submit.click();
  await expect(
    tip.locator("[data-request-fix-done] [data-request-fix-login-created]"),
  ).toHaveText(buyer);
});

test("encomenda aberta pelo cliente: vira cotação na hora, sem a Estratégia de compra", async ({
  page,
}) => {
  // Dono, 22/11/2026: a encomenda aberta pelo cliente vira cotação na hora,
  // como a venda confirmada; ninguém escolhe a estratégia nem envia.
  await login(page, "admin@wellmix.com");
  await setAutoQuote(page, true);
  const requestId = await customerEncomenda(page);
  await login(page, "admin@wellmix.com");
  // Sem a pendência "Enviar para cotação" e sem o envio no selo.
  await page.goto("/app/tasks?type=new_request");
  await expect(
    page.locator(
      `[data-task-row] a[href="/app/requests/${requestId}"]:not([data-open-link])`,
    ),
  ).toHaveCount(0);
  await page.goto(`/app/requests/batch/${requestId}`);
  await expect(page.locator(`[data-batch-sent="${requestId}"]`)).toContainText(
    "Virou cotação sozinha",
  );
  // A vez é do fornecedor: responder a cotação.
  await page.goto("/app/requests?situ=open");
  const row = page.locator(`[data-request-row="${requestId}"]`);
  await expect(row.locator('[data-request-turn="supplier"]')).toBeVisible();
  await expect(row.locator('[data-request-next="quote_answer"]')).toBeVisible();
  await expect(row.locator("[data-request-quick]")).toHaveCount(0);
  // Não fica esperando estratégia.
  await page.goto("/app/purchase-strategy");
  await expect(page.locator(`[data-strategy-line="${requestId}"]`)).toHaveCount(
    0,
  );
});
