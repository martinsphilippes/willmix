import { expect, test } from "@playwright/test";
import { createTeamLogin, login } from "./helpers";

/*
 * Plano de ação Trade (dono, 18/11/2026; docs/TRADE_COMERCIAL.md, PR 2): o
 * administrador cria a ação pelo grupo econômico, com responsável e prazo; o
 * responsável vê a pendência, avança a situação e conclui com a resposta;
 * concluída no prazo, ela aparece assim no plano e sai das Pendências.
 */

const TAG = `TPL${Date.now().toString(36).toUpperCase()}`;

test("Plano de ação Trade: criar pelo grupo, pendência do responsável e concluir com a resposta", async ({
  page,
}) => {
  // 1. O administrador: login de Vendas, grupo e a ação pelo grupo.
  await login(page, "admin@wellmix.com");
  const email = `trade.${TAG.toLowerCase()}@wellmix.com`;
  const seller = `Trade ${TAG}`;
  await createTeamLogin(page, seller, email, ["sales"]);
  await page.goto("/app/portfolio/groups");
  const create = page.locator("[data-portfolio-group-new]");
  await create.locator('input[name="name"]').fill(`Grupo ${TAG}`);
  await create.getByRole("button", { name: "Criar grupo" }).click();
  await page.waitForURL(/\/app\/portfolio\/groups\/[^/?]+\?created=1/);
  await page.locator("[data-trade-new-link]").click();
  await page.waitForURL(/\/app\/portfolio\/plan\?new=1&newGroup=/);
  const form = page.locator("[data-trade-new]");
  await expect(form.locator('select[name="groupId"]')).toHaveValue(/.+/);
  await form.locator('input[name="title"]').fill(`Proteger o líder ${TAG}`);
  await form
    .locator('textarea[name="description"]')
    .fill("Auditar exposição, estoque de loja e reposição");
  await form
    .locator('select[name="responsibleUserId"]')
    .selectOption({ label: seller });
  await form.locator("[data-trade-create]").click();
  await page.waitForURL(/\/app\/portfolio\/plan\/[^/?]+\?created=1/);
  const activityUrl = page.url().split("?")[0];
  await expect(page.locator("[data-trade-status]").first()).toHaveAttribute(
    "data-trade-status",
    "pending",
  );

  // 2. O responsável vê a pendência e conclui (sem resposta, o portal pede).
  await login(page, email);
  await page.goto("/app/tasks");
  await expect(page.locator("main")).toContainText(
    `Ação de trade: Proteger o líder ${TAG}`,
  );
  await page.goto(activityUrl);
  const status = page.locator("[data-trade-status-form]");
  await status.locator('select[name="status"]').selectOption("done");
  await status.locator("[data-trade-status-save]").click();
  await page.waitForURL(/error=trade_evidence_required/);
  await status
    .locator('textarea[name="notes"]')
    .fill("Exposição conferida nas lojas do grupo");
  await status.locator('select[name="status"]').selectOption("done");
  await status.locator("[data-trade-status-save]").click();
  await page.waitForURL(/\?status=1/);
  await expect(page.locator("[data-trade-status]").first()).toHaveAttribute(
    "data-trade-status",
    "done",
  );
  await expect(page.locator("main")).toContainText("No prazo");

  // 3. No plano: concluída; nas Pendências, não mais.
  await page.goto("/app/portfolio/plan?status=done");
  await expect(
    page.locator('[data-trade-row] [data-trade-status="done"]').first(),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText(`Proteger o líder ${TAG}`);
  await page.goto("/app/tasks");
  await expect(page.locator("main")).not.toContainText(
    `Ação de trade: Proteger o líder ${TAG}`,
  );
});
