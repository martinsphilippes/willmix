import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * "Conversar com a empresa" na solicitação (dono, 14/11/2026): o chat abre
 * numa caixa flutuante no canto inferior direito da própria tela, já na
 * conversa da empresa sobre esta solicitação. O endereço e a rolagem não
 * mudam; com a caixa aberta, o botão só a traz para frente (o que foi
 * digitado fica). A página Mensagens continua com a conversa.
 */
test("solicitação: Conversar com a empresa abre o chat na caixa flutuante", async ({
  page,
}) => {
  const tag = `CHAT${Date.now().toString(36).toUpperCase()}`;
  // O cliente pede um produto novo (busca por fornecedor).
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests/new");
  await page.check('[data-request-item="0"] input[name="p0.sourcingDemand"]');
  await page.fill('input[name="p0.productName"]', `Pote ${tag}`);
  await page.fill('textarea[name="p0.description"]', `Pote de vidro ${tag}`);
  await page.fill('input[name="p0.quantity"]', "500");
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await page.waitForURL(/\/app\/requests\/(?!new|batch)[^/?]+/);
  const requestPath = new URL(page.url()).pathname;

  // A Wellmix abre a solicitação e conversa com a empresa sem sair dela.
  await login(page, "admin@wellmix.com");
  await page.goto(requestPath);
  const button = page.locator("[data-chat-floating-open]");
  await expect(button).toHaveText(/Conversar com a empresa/);
  // Tela rolada: o clique vai direto no botão (o Playwright não rola a
  // tela antes), para conferir que abrir a caixa não mexe na rolagem.
  await page.evaluate(() => window.scrollTo(0, 200));
  const scrollBefore = await page.evaluate(() => window.scrollY);
  expect(scrollBefore).toBeGreaterThan(0);
  const urlBefore = page.url();
  const press = () =>
    button.evaluate((el) => (el as HTMLButtonElement).click());
  await press();
  const box = page.locator("[data-chat-floating]");
  await expect(box).toBeVisible();
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
  expect(page.url()).toBe(urlBefore);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  // No canto inferior direito da tela.
  const rect = (await box.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(rect.x + rect.width).toBeGreaterThan(viewport.width - 40);
  expect(rect.y + rect.height).toBeGreaterThan(viewport.height - 40);
  // Já na conversa desta solicitação: o histórico e o campo para enviar.
  await expect(box.locator("[data-chat-context]")).toContainText(tag);
  const field = box.locator("[data-chat-composer] textarea");
  await expect(field).toBeEnabled();
  await field.fill(`Bom dia! Sobre o pote ${tag}`);
  await field.press("Enter");
  await expect(
    box.locator("[data-chat-message]", { hasText: `pote ${tag}` }),
  ).toHaveCount(1);
  // Aberta de novo na mesma conversa: só vem para frente, com o rascunho.
  await field.fill("rascunho da próxima");
  await press();
  await expect(page.locator("[data-chat-floating]")).toHaveCount(1);
  await expect(box).toHaveAttribute("data-chat-raised", "1");
  await expect(field).toHaveValue("rascunho da próxima");
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  // A tela de baixo continua usável e fechar não muda nada nela.
  await box.locator("[data-chat-close]").click();
  await expect(box).toHaveCount(0);
  expect(page.url()).toBe(urlBefore);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

  // A página Mensagens continua com a conversa (o link da caixa leva até ela).
  await button.click();
  await expect(box.locator("[data-chat-open-full]")).toBeVisible();
  await box.locator("[data-chat-open-full]").click();
  await page.waitForURL(/\/app\/messages\?c=/);
  // A caixa fecha: a conversa segue na página.
  await expect(page.locator("[data-chat-floating]")).toHaveCount(0);
  await expect(
    page.locator("p", { hasText: `Bom dia! Sobre o pote ${tag}` }),
  ).toBeVisible();

  // Celular: a caixa ocupa a largura da tela, com o campo de mensagem à vista.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(requestPath);
  await page.locator("[data-chat-floating-open]").click();
  const phoneBox = page.locator("[data-chat-floating]");
  await expect(phoneBox).toBeVisible();
  const phone = (await phoneBox.boundingBox())!;
  expect(phone.x).toBeGreaterThanOrEqual(0);
  expect(phone.x + phone.width).toBeLessThanOrEqual(390);
  expect(phone.y + phone.height).toBeLessThanOrEqual(844);
  await expect(
    phoneBox.locator("[data-chat-composer] textarea"),
  ).toBeInViewport();
});
