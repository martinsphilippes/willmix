import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Aguardando e-mail (Equipe; dono, 17/11/2026): quem vem da planilha sem
 * e-mail fica guardado com o cargo e a área; no painel "Aguardando e-mail" o
 * administrador põe o e-mail e a senha provisória e o login nasce com o cargo
 * e a área; quem não vai ter login sai da lista. Os nomes levam um sufixo do
 * teste (o banco do E2E é o mesmo entre rodadas).
 */

const SHARED = "12345678";

test("Aguardando e-mail: da planilha sem e-mail ao login criado pelo painel", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  const T = tag.toUpperCase();
  const area = `Showroom ${T}`;
  const position = `Vendedora Jr ${T}`;
  const bia = `Bia ${T}`;
  const caio = `Caio ${T}`;
  await login(page, "admin@wellmix.com");

  // Área e cargo do teste.
  await page.goto("/app/team?tab=areas");
  await page.locator("[data-area-bulk-names]").fill(area);
  await page.locator("[data-area-bulk-submit]").click();
  await expect(page.locator("[data-area-bulk-done]")).toBeVisible();
  await page.goto("/app/team?tab=positions");
  await page.locator("[data-position-bulk-names]").fill(`${position}\t${area}`);
  await page.locator("[data-position-bulk-submit]").click();
  await expect(page.locator("[data-position-bulk-done]")).toBeVisible();

  // Planilha com duas pessoas sem e-mail.
  await page.goto("/app/team/import");
  await page
    .locator("[data-team-import-rows]")
    .fill(
      [
        "Nome;Cargo;Area;E-mail",
        `${bia};${position};${area} Recife;Não localizado`,
        `${caio};${position};${area};`,
      ].join("\n"),
    );
  await page.locator("[data-team-import-preview]").click();
  const group = page.locator("[data-team-import-pending]");
  await expect(group).toContainText("Aguardando e-mail (2)");
  await expect(
    group.locator(`[data-team-import-pending-row="${bia}"]`),
  ).toContainText(`${position} · ${area}`);
  await page.locator("[data-team-import-password]").fill(SHARED);
  await page.locator("[data-team-import-run]").click();
  await expect(page.locator("[data-team-import-pending-done]")).toHaveText(
    "2 pessoa(s) sem e-mail ficaram em “Aguardando e-mail” na Equipe.",
  );

  // Na Equipe: o atalho abre o painel com as duas.
  await page.goto("/app/team");
  await page.locator("[data-team-pending-open]").click();
  await page.waitForURL(/panel=pending/);
  const panel = page.locator('[data-team-panel="pending"]');
  const card = (name: string) =>
    panel.locator(`[data-team-pending-name="${name}"]`);
  await expect(card(bia)).toContainText(`${position} · ${area}`);
  await expect(card(bia)).toContainText("Funções sugeridas: Vendas");

  // E-mail e senha: o login nasce com o cargo e a área.
  const email = `bia.${tag}@wellmix.com`;
  await card(bia).locator("[data-team-pending-login]").fill(email);
  await card(bia).locator("[data-team-pending-password]").fill(SHARED);
  await card(bia).locator("[data-team-pending-create]").click();
  await page.waitForURL(/saved=pending_created/);
  await expect(panel.locator("[data-team-pending-saved]")).toContainText(
    `Login criado para ${bia}.`,
  );
  await expect(card(bia)).toHaveCount(0);

  // Quem não vai ter login sai da lista (o registro fica).
  page.once("dialog", (dialog) => dialog.accept());
  await card(caio).locator("[data-team-pending-remove]").click();
  await page.waitForURL(/saved=pending_removed/);
  await expect(card(caio)).toHaveCount(0);

  // A Bia na lista da equipe, com o cargo e a área.
  await page.goto("/app/team");
  const member = page.locator("[data-team-member]", { hasText: bia });
  await expect(member).toContainText(position);
  await expect(member).toContainText(area);
});
