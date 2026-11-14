import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Tela "Produção" (pedido do dono, 13/11/2026). Desde 14/11/2026 o menu tem
 * os blocos do mapa (docs/FLOW_MENU.md): Produção é um grupo logo abaixo de
 * Pedido, e a tela /app/production é o Overview do bloco (linha do tempo dos
 * passos e a tabela dos casos), aberta pelo item "Overview". Aparece em
 * Equipe e acessos → Telas e links (marcada no padrão do comprador,
 * desmarcada no do designer); sem a tela, o endereço volta ao início com o
 * aviso. O bloco "Produção" do pedido não muda (E2E do caminho principal).
 */
test("Produção: menu, Overview, Telas e links e acesso pelo endereço", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");

  // Grupo Produção logo abaixo do grupo Pedido; Mensagens e Notificações
  // saíram do menu (ficam no cabeçalho).
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
  expect(order.slice(0, 4)).toEqual([
    "/app",
    "/app/tasks",
    "Produto novo",
    "Pedido",
  ]);
  expect(order[order.indexOf("Pedido") + 1]).toBe("Produção");
  expect(order).not.toContain("/app/messages");
  expect(order).not.toContain("/app/notifications");
  await expect(
    sidebar.first().locator('[data-nav-link="/app/messages"]'),
  ).toHaveCount(0);

  // Abre o grupo e o Overview: a linha do tempo com os passos na ordem.
  await sidebar.first().locator('[data-nav-group="Produção"] button').click();
  const item = sidebar.first().locator('[data-nav-link="/app/production"]');
  await expect(item).toHaveText(/Overview/);
  await item.click();
  await page.waitForURL(/\/app\/production$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Produção");
  await expect(page.locator("[data-production-page]")).toBeVisible();
  await expect(page.locator("[data-flow-timeline-step]")).toHaveCount(9);
  await expect(
    page.locator("[data-flow-timeline-step]").first(),
  ).toHaveAttribute("data-flow-timeline-step", "pre-production");
  // Clicar num passo mostra os casos dele ao lado.
  await page.locator('[data-flow-timeline-step="inspection"]').click();
  await page.waitForURL(/step=inspection/);
  await expect(
    page.locator('[data-flow-timeline-step="inspection"]'),
  ).toHaveAttribute("aria-current", "step");
  // Só o Overview fica aceso no menu.
  const current = sidebar.first().locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("data-nav-link", "/app/production");

  // Tela do passo: título, volta ao Overview e os filtros de prazo.
  await page.goto("/app/flow/production/inspection");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Inspeção");
  await expect(page.locator("[data-flow-back]")).toBeVisible();
  await expect(page.locator("[data-flow-filter]")).toHaveCount(4);

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
