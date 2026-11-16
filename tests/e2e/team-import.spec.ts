import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Importar equipe (Equipe → "Importar da planilha"; dono, 16/11/2026): a
 * planilha colada (Nome, Cargo, Área, Email) passa pela prévia sem gravar
 * nada; "Criar os logins" cria com a senha provisória igual para todos, o
 * cargo, a área e as funções sugeridas; o que não dá para afirmar fica "a
 * conferir". Na lista: o selo, o filtro "Ver só esses" e, em Editar acessos,
 * "Conferido" tira a marcação. O login novo entra com a senha provisória e o
 * portal pede a troca. Os nomes levam um sufixo do teste.
 */

const SHARED = "12345678";

test("Importar equipe: prévia, criar os logins, a conferir e primeiro acesso", async ({
  page,
  browser,
}) => {
  const tag = Date.now().toString(36);
  const T = tag.toUpperCase();
  const area = `Comercial ${T}`;
  const position = `Vendedora Sênior ${T}`;
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

  // Da lista da equipe para a importação.
  await page.goto("/app/team");
  await page.locator("[data-team-import-open]").click();
  await page.waitForURL(/\/app\/team\/import$/);

  const ana = `ana.${tag}@wellmix.com`;
  const caio = `caio.${tag}@wellmix.com`;
  await page
    .locator("[data-team-import-rows]")
    .fill(
      [
        "Nome\tCargo\tÁrea\tEmail",
        `Ana ${T}\t${position}\t${area}\t${ana}`,
        `Caio ${T}\tEstagiário ${T}\t${area}\t${caio}`,
      ].join("\n"),
    );

  // Prévia: nada gravado; o cargo desconhecido fica a conferir.
  await page.locator("[data-team-import-preview]").click();
  const row = (email: string) =>
    page.locator(`[data-team-import-row="${email}"]`);
  await expect(row(ana)).toHaveAttribute("data-team-import-status", "new");
  await expect(row(ana)).toContainText("Vendas");
  await expect(row(ana)).toContainText(area);
  await expect(row(ana).locator("[data-team-import-review]")).toHaveAttribute(
    "data-team-import-review",
    "0",
  );
  await expect(row(caio).locator("[data-team-import-review]")).toHaveAttribute(
    "data-team-import-review",
    "1",
  );
  await expect(row(caio)).toContainText("não cadastrado");

  // Sem a senha provisória, não cria.
  await expect(page.locator("[data-team-import-run]")).toBeDisabled();
  await page.locator("[data-team-import-password]").fill(SHARED);
  await page.locator("[data-team-import-run]").click();
  await expect(page.locator("[data-team-import-done]")).toHaveText(
    "Pronto: 2 login(s) criado(s) (1 com algo a conferir) e 0 login(s) que já existiam ligados ao cargo e à área.",
  );
  await expect(row(ana)).toHaveAttribute("data-team-import-status", "existing");

  // De novo: ninguém é criado outra vez.
  await page.locator("[data-team-import-run]").click();
  await expect(page.locator("[data-team-import-done]")).toHaveText(
    "Pronto: 0 login(s) criado(s) (0 com algo a conferir) e 0 login(s) que já existiam ligados ao cargo e à área.",
  );

  // Lista: cargo e área da Ana; o Caio com o selo "A conferir".
  await page.goto("/app/team");
  const member = (name: string) =>
    page.locator("[data-team-member]", { hasText: name });
  const anaId = (await member(`Ana ${T}`).getAttribute("data-team-member"))!;
  const caioId = (await member(`Caio ${T}`).getAttribute("data-team-member"))!;
  await expect(
    page.locator(`[data-team-member-position="${anaId}"]`),
  ).toHaveText(position);
  await expect(page.locator(`[data-team-member-area="${anaId}"]`)).toHaveText(
    area,
  );
  await expect(
    page.locator(`[data-team-member-review="${caioId}"]`),
  ).toBeVisible();
  await expect(
    page.locator(`[data-team-member-review="${anaId}"]`),
  ).toHaveCount(0);

  // "Ver só esses": só os a conferir.
  await page
    .locator("[data-team-review-filter]")
    .getByRole("link", { name: "Ver só esses" })
    .click();
  await page.waitForURL(/review=1/);
  await expect(member(`Caio ${T}`)).toBeVisible();
  await expect(member(`Ana ${T}`)).toHaveCount(0);

  // Editar acessos: o motivo e "Conferido" tira a marcação.
  await page.goto(`/app/team/${caioId}`);
  await expect(page.locator("[data-team-review-note]")).toContainText(
    `Cargo "Estagiário ${T}" não está cadastrado em Cargos`,
  );
  await page.locator("[data-team-review-done]").check();
  await page.locator("[data-team-save]").click();
  await expect(page.locator("[data-team-saved]")).toBeVisible();
  await page.goto("/app/team");
  await expect(
    page.locator(`[data-team-member-review="${caioId}"]`),
  ).toHaveCount(0);

  // O login novo entra com a senha provisória e o portal pede a troca.
  const other = await browser.newContext();
  const theirs = await other.newPage();
  await theirs.goto("/login");
  await theirs.getByLabel(/e-mail|email|邮箱/i).fill(ana);
  await theirs.getByLabel(/senha|password|密码/i).fill(SHARED);
  await theirs.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await expect(theirs.locator('[data-password-change="first"]')).toBeVisible();
  await other.close();
});
