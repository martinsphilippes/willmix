import { expect, test, type Page } from "@playwright/test";
import {
  chooseCustomerLogin,
  confirmAsCustomer,
  createdRequestId,
  fillCustomerContacts,
  fillOrderTerms,
  login,
} from "./helpers";

/*
 * De quem é a vez (dono, 18/11/2026; docs/TURNS.md): a venda pela Wellmix
 * aguardando o cliente aparece em "Em aberto" com a situação "Aguardando
 * cliente" e o Próximo passo "Confirmar pedido"; o cliente recebe a ação nas
 * Pendências dele; confirmada, a pendência dele some e a vez volta para a
 * Wellmix ("Enviar para cotação"), com o filtro "Com quem está" coerente.
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

test("venda aguardando o cliente: Em aberto e com o cliente; ele confirma pelas Pendências e a vez volta à Wellmix", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
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

  // A Wellmix: "Aguardando Wellmix" e "Enviar para cotação", nas Pendências
  // de quem envia; o filtro "Cliente" não a mostra mais.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/requests?vez=wellmix");
  await expect(row.locator('[data-request-turn="wellmix"]')).toContainText(
    "Aguardando Wellmix",
  );
  await expect(row.locator('[data-request-next="send"]')).toContainText(
    "Enviar para cotação",
  );
  await page.goto("/app/requests?vez=customer");
  await expect(row).toHaveCount(0);
  // A pendência "Enviar para cotação" de quem envia (a lista pagina: com
  // muitas pendências, a linha pode estar em outra página).
  await page.goto("/app/tasks?type=new_request");
  await expect(
    page
      .locator(
        `[data-task-row] a[href="/app/requests/${requestId}"]:not([data-open-link])`,
      )
      .first(),
  ).toContainText("Enviar para cotação");
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
