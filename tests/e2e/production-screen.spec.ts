import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Tela "Produção" (pedido do dono, 13/11/2026): item do primeiro nível do
 * menu, logo abaixo do grupo Pedidos e entrega (dono, 14/11/2026: saiu de
 * dentro do grupo e aparece uma vez só), com ícone como os outros itens
 * principais; abre a tela própria, com o item aceso no menu; aparece em
 * Equipe e acessos → Telas e links (marcada no padrão do comprador,
 * desmarcada no do designer); sem a tela, o endereço volta ao início com o
 * aviso. O bloco "Produção" do pedido não muda (E2E do caminho principal).
 */
test("Produção: menu, tela própria, Telas e links e acesso pelo endereço", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");

  // No primeiro nível do menu, logo abaixo do grupo Pedidos e entrega.
  await page.goto("/app/orders");
  const sidebar = page.locator("[data-sidebar-nav]").filter({ visible: true });
  const order = await sidebar
    .first()
    .evaluate((nav) =>
      Array.from(nav.children).map(
        (el) =>
          el
            .querySelector("[data-nav-group]")
            ?.getAttribute("data-nav-group") ??
          el.getAttribute("data-nav-link"),
      ),
    );
  const at = order.indexOf("/app/production");
  expect(at).toBeGreaterThan(0);
  expect(order[at - 1]).toBe("Pedidos e entrega");
  // Uma vez só: não está mais dentro de Pedidos e entrega.
  const delivery = page
    .locator('[data-nav-group="Pedidos e entrega"]')
    .filter({ visible: true })
    .first();
  await expect(
    delivery.locator('[data-nav-link="/app/production"]'),
  ).toHaveCount(0);
  await expect(
    sidebar.first().locator('[data-nav-link="/app/production"]'),
  ).toHaveCount(1);

  // Com ícone, como os outros itens principais; clicar abre a tela própria,
  // com o título e o item aceso.
  const item = sidebar.first().locator('[data-nav-link="/app/production"]');
  await expect(item.locator("svg")).toHaveCount(1);
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
  // Só Produção fica acesa no menu (Pedidos e entrega não abre nela).
  const current = sidebar.first().locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("data-nav-link", "/app/production");

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
