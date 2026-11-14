import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Tela "Produção" (pedido do dono, 13/11/2026): item do menu em Pedidos e
 * entrega, logo abaixo de Pedidos de compra e antes de Revisão; abre a tela
 * própria, com o item aceso no menu; aparece em Equipe e acessos → Telas e
 * links (marcada no padrão do comprador, desmarcada no do designer); sem a
 * tela, o endereço volta ao início com o aviso. O bloco "Produção" do pedido
 * não muda (E2E do caminho principal).
 */
test("Produção: menu, tela própria, Telas e links e acesso pelo endereço", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");

  // No menu, dentro de Pedidos e entrega: Pedidos de compra → Produção → Revisão.
  await page.goto("/app/orders");
  const delivery = page
    .locator('[data-nav-group="Pedidos e entrega"]')
    .filter({ visible: true })
    .first();
  const hrefs = await delivery
    .locator("[data-nav-link]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-nav-link")));
  const at = hrefs.indexOf("/app/production");
  expect(at).toBeGreaterThan(0);
  expect(hrefs[at - 1]).toBe("/app/orders");
  expect(hrefs[at + 1]).toBe("/app/reviews");

  // Clicar abre a tela própria, com o título e o item aceso.
  const item = delivery.locator('[data-nav-link="/app/production"]');
  await expect(item).toHaveText(/Produção/);
  await item.click();
  await page.waitForURL(/\/app\/production$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Produção");
  await expect(page.locator("[data-production-page]")).toBeVisible();
  await expect(
    page
      .locator('[data-nav-link="/app/production"]')
      .filter({ visible: true })
      .first(),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page
      .locator('[data-nav-link="/app/orders"]')
      .filter({ visible: true })
      .first(),
  ).not.toHaveAttribute("aria-current", "page");

  // Equipe e acessos → Telas e links: logo depois de Pedidos; o padrão do
  // comprador já marca, o do designer não.
  await page.goto("/app/team?tab=functions&fn=buyer&view=screens");
  const buyerBox = page.locator('input[name="screens"][value="production"]');
  await expect(buyerBox).toBeChecked();
  const values = await page
    .locator('[data-fn-screens] input[type="checkbox"]')
    .evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
  expect(values[values.indexOf("orders") + 1]).toBe("production");
  await expect(page.locator("label", { has: buyerBox }).first()).toContainText(
    "Produção",
  );
  await page.goto("/app/team?tab=functions&fn=designer&view=screens");
  await expect(
    page.locator('input[name="screens"][value="production"]'),
  ).not.toBeChecked();

  // Login sem a tela (o fornecedor): pelo endereço, volta ao início com o aviso.
  await login(page, "supplier.a@china.com");
  await page.goto("/app/production");
  await page.waitForURL(/\/app\?denied=production/);
  await expect(page.locator('[data-nav-link="/app/production"]')).toHaveCount(
    0,
  );
});
