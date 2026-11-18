import { expect, test } from "@playwright/test";
import { createTeamLogin, login } from "./helpers";

/*
 * Carteira e atendimento (dono, 18/11/2026; docs/TRADE_COMERCIAL.md): o
 * administrador monta o grupo econômico à mão e escolhe o responsável; o
 * cliente entra na carteira como "Nunca atendido" e vira pendência do
 * responsável; quem atendeu registra o atendimento e manda o link; o cliente
 * confirma sem login; só então os dias zeram ("Em dia").
 */

/** Marca única por execução. */
const TAG = `CRT${Date.now().toString(36).toUpperCase()}`;

test("Carteira: grupo, pendência, atendimento e confirmação do cliente sem login", async ({
  page,
  browser,
}) => {
  // 1. O administrador cria um login de Vendas, o grupo com ele como
  // responsável e inclui o cliente.
  await login(page, "admin@wellmix.com");
  const email = `vendas.${TAG.toLowerCase()}@wellmix.com`;
  const seller = `Vendas ${TAG}`;
  await createTeamLogin(page, seller, email, ["sales"]);
  await page.goto("/app/portfolio/groups");
  const create = page.locator("[data-portfolio-group-new]");
  await create.locator('input[name="name"]').fill(`Grupo ${TAG}`);
  await create
    .locator('select[name="ownerUserId"]')
    .selectOption({ label: seller });
  await create.getByRole("button", { name: "Criar grupo" }).click();
  await page.waitForURL(/\/app\/portfolio\/groups\/[^/?]+\?created=1/);
  const find = page.locator("[data-portfolio-group-find]");
  await find.locator('input[name="find"]').fill("Loja do João");
  await find.getByRole("button", { name: "Buscar" }).click();
  await page
    .locator(
      '[data-portfolio-group-candidate="cliente-joao"] [data-portfolio-group-add]',
    )
    .click();
  await page.waitForURL(/\?added=1/);
  await expect(
    page.locator('[data-portfolio-group-customer="cliente-joao"]'),
  ).toBeVisible();

  // 2. O responsável vê o cliente como "Nunca atendido" e a pendência.
  await login(page, email);
  await page.goto("/app/portfolio");
  await expect(
    page.locator('[data-portfolio-row="cliente-joao"] [data-portfolio-status]'),
  ).toHaveAttribute("data-portfolio-status", "never");
  await page.goto("/app/tasks");
  await expect(page.locator("main")).toContainText("Atender Loja do João");

  // 3. Registra a visita: ainda não vale (falta o cliente confirmar).
  await page.goto("/app/portfolio/cliente-joao");
  const register = page.locator("[data-portfolio-register]");
  await register
    .locator('textarea[name="summary"]')
    .fill(`Visita ${TAG}: mostrei o catálogo novo`);
  await register
    .getByRole("button", { name: "Registrar atendimento", exact: true })
    .click();
  await page.waitForURL(/\?registered=/);
  await expect(page.locator("[data-portfolio-standing]")).toHaveAttribute(
    "data-portfolio-standing",
    "never",
  );
  const linkInput = page.locator("[data-attendance-link]").first();
  await expect(linkInput).toHaveValue(/^https?:\/\/.+\/atendimento\/[^/]+$/);
  const link = await linkInput.inputValue();

  // 4. O cliente abre o link sem login e confirma.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto(link);
  await expect(pub.locator("[data-attendance-public]")).toHaveAttribute(
    "data-attendance-public",
    "open",
  );
  await expect(pub.locator("main")).toContainText(`Visita ${TAG}`);
  // Só o primeiro nome de quem atendeu.
  await expect(pub.locator("main")).toContainText("Vendas, da Wellmix");
  await expect(pub.locator("main")).not.toContainText(seller);
  await pub.locator('input[name="name"]').fill("João da Loja");
  await pub.locator("[data-attendance-confirm]").click();
  await expect(pub.locator("[data-attendance-public-done]")).toHaveAttribute(
    "data-attendance-public-done",
    "confirmed",
  );
  // Uso único: aberto de novo, só a situação.
  await pub.goto(link);
  await expect(pub.locator("[data-attendance-public]")).toHaveAttribute(
    "data-attendance-public",
    "confirmed",
  );
  await expect(pub.locator('input[name="name"]')).toHaveCount(0);
  await visitor.close();

  // 5. Confirmado pelos dois lados: em dia, sem a pendência.
  await page.goto("/app/portfolio");
  await expect(
    page.locator('[data-portfolio-row="cliente-joao"] [data-portfolio-status]'),
  ).toHaveAttribute("data-portfolio-status", "ok");
  await page.goto("/app/portfolio/cliente-joao");
  await expect(
    page.locator('[data-attendance-status="confirmed"]').first(),
  ).toContainText("João da Loja");
  await page.goto("/app/tasks");
  await expect(page.locator("main")).not.toContainText("Atender Loja do João");
});
