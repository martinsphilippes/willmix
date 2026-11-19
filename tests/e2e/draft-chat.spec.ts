import { expect, test, type Page } from "@playwright/test";
import {
  chooseCustomerLogin,
  createdRequestId,
  fillCustomerContacts,
  fillOrderTerms,
  login,
} from "./helpers";

/*
 * Conversa ligada ao rascunho (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md,
 * seção 8): em Encomendas, a linha do rascunho tem o ícone de mensagem, como
 * as enviadas. Ele abre a conversa de quem salvou o rascunho com o login do
 * cliente, no assunto "Solicitação nº N (rascunho)". O cliente lê em
 * Mensagens. No envio, o assunto passa para a solicitação, com as mensagens.
 */
const TAG = `DCH${Date.now().toString(36).toUpperCase()}`;

/** Rascunho completo para o João (pronto para enviar depois). */
async function draftForJoao(page: Page): Promise<string> {
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
  await page.locator("[data-request-draft-save]").click();
  await page.waitForURL(/[?&]draftSaved=1/);
  return new URL(page.url()).searchParams.get("draft")!;
}

/** O painel aberto: com vários logins do cliente, escolhe o do João. */
async function talkToJoao(page: Page) {
  const drawer = page.locator("[data-chat-drawer]");
  await expect(drawer).toBeVisible();
  const field = drawer.locator("[data-chat-composer] textarea");
  if (!(await field.isVisible().catch(() => false))) {
    const choose = drawer.locator("[data-chat-choose]");
    if (await choose.count()) await choose.click();
    await drawer
      .locator("[data-chat-peer]", { hasText: "joao@lojista.com" })
      .first()
      .click();
  }
  await expect(field).toBeEnabled();
  return { drawer, field };
}

test("Encomendas: a conversa do rascunho com o cliente, que passa para a solicitação no envio", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  const draftId = await draftForJoao(page);

  // A linha do rascunho: o ícone de mensagem ao lado do abrir.
  await page.goto("/app/requests?situ=draft");
  const row = page.locator(`[data-request-list-draft="${draftId}"]`);
  const number = (await row.locator("[data-request-number]").textContent())!
    .trim();
  const icon = row.locator(`[data-chat-open="draft:${draftId}"]`);
  await expect(icon).toBeVisible();
  await expect(icon).toHaveAttribute("aria-label", /rascunho/);
  await icon.click();
  const { drawer, field } = await talkToJoao(page);
  await expect(drawer.locator("[data-chat-context]")).toContainText(
    `Solicitação nº ${number} (rascunho)`,
  );
  await field.fill(`Rascunho ${TAG}: fechamos 100 caixas?`);
  await field.press("Enter");
  await expect(
    drawer.locator("[data-chat-message]", { hasText: TAG }),
  ).toHaveCount(1);
  const full = await drawer
    .locator("[data-chat-open-full]")
    .getAttribute("href");
  expect(full).toMatch(/\/app\/messages\?c=.+&t=.+/);

  // Também nos detalhes do rascunho, na linha do produto.
  await page.goto(`/app/requests/batch/${draftId}`);
  await expect(
    page.locator(`[data-batch-item] [data-chat-open="draft:${draftId}"]`),
  ).toHaveCount(1);

  // O João lê em Mensagens, no assunto do rascunho.
  await login(page, "joao@lojista.com");
  await page.goto(full!);
  await expect(
    page.locator("p", { hasText: `Rascunho ${TAG}` }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText(`#${number} (rascunho)`);

  // O envio: o assunto passa para a solicitação, com a mensagem.
  await login(page, "admin@wellmix.com");
  await page.goto(`/app/requests/batch/${draftId}`);
  await page.locator("[data-draft-resume]").click();
  await page.waitForURL(new RegExp(`/app/requests/new\\?draft=${draftId}`));
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  const requestId = await createdRequestId(page, { open: false });
  await page
    .locator(`[data-batch-item="${requestId}"] [data-chat-open]`)
    .click();
  const sent = await talkToJoao(page);
  await expect(sent.drawer.locator("[data-chat-context]")).toContainText(
    `Solicitação nº ${number}`,
  );
  await expect(
    sent.drawer.locator("[data-chat-message]", { hasText: TAG }),
  ).toHaveCount(1);
});
