import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Cargos (Equipe Acessos e Parceiros → Cargos; dono, 16/11/2026): a lista
 * colada da planilha (com a linha de título e a área depois da tabulação)
 * entra com a área de cada cargo; a área desconhecida fica de fora. Em
 * Editar acessos, escolhido o cargo, a área vem junto e fica travada; a lista
 * da equipe mostra o cargo e a área. Trocar a área do cargo leva a pessoa
 * junto. O campo de Analista a Diretor passou a se chamar Nível. Os nomes
 * levam um sufixo do teste (o banco do E2E é o mesmo entre rodadas).
 */

test("Cargos: cadastro em massa com a área, cargo da pessoa e área que acompanha", async ({
  page,
}) => {
  const tag = Date.now().toString(36).toUpperCase();
  const named = (name: string) => `${name} ${tag}`;
  const finance = named("Financeiro");
  const tax = named("Contabil Fiscal");
  await login(page, "admin@wellmix.com");

  // As áreas do teste.
  await page.goto("/app/team?tab=areas");
  await page.locator("[data-area-bulk-names]").fill(`${finance}\n${tax}`);
  await page.locator("[data-area-bulk-submit]").click();
  await expect(page.locator("[data-area-bulk-done]")).toHaveText(
    "Pronto: 2 criada(s) e 0 já cadastrada(s).",
  );

  // A seção Cargos, logo depois de Áreas.
  await page
    .locator('[data-team-area-nav] [data-team-tab="positions"]')
    .click();
  await page.waitForURL(/\/app\/team\?tab=positions$/);
  await expect(
    page.locator('[data-team-area-nav] [aria-current="page"]'),
  ).toHaveText("Cargos");

  // Colado da planilha: título, área depois da tabulação, área desconhecida.
  const analyst = named("Analista Financeiro Jr");
  const assistant = named("Assistente Fiscal");
  const apprentice = named("Jovem Aprendiz");
  await page
    .locator("[data-position-bulk-names]")
    .fill(
      [
        "CARGO\tAREA",
        `${analyst}\t${finance}`,
        `${assistant}\t${tax}`,
        apprentice,
        `${named("Analista de Dados")}\tDados ${tag}`,
      ].join("\n"),
    );
  await page.locator("[data-position-bulk-submit]").click();
  await expect(page.locator("[data-position-bulk-done]")).toHaveText(
    "Pronto: 3 cargo(s) criado(s) e 0 já cadastrado(s).",
  );
  expect(
    await page.locator('[data-position-bulk-item="created"]').allInnerTexts(),
  ).toEqual([
    `${analyst} → ${finance}`,
    `${assistant} → ${tax}`,
    `${apprentice} → Sem área`,
  ]);
  expect(
    await page
      .locator('[data-position-bulk-item="unknownArea"]')
      .allInnerTexts(),
  ).toEqual([`${named("Analista de Dados")} (área “Dados ${tag}”)`]);
  expect(
    await page.locator('[data-position-bulk-item="header"]').allInnerTexts(),
  ).toEqual(["CARGO AREA"]);

  // A lista: a área de cada cargo na própria linha.
  const row = (name: string) => page.locator(`[data-position-name="${name}"]`);
  const areaSelect = (name: string) =>
    row(name).locator("[data-position-area-select]");
  await expect(areaSelect(analyst).locator("option:checked")).toHaveText(
    finance,
  );
  await expect(areaSelect(apprentice).locator("option:checked")).toHaveText(
    "Sem área",
  );

  // Editar acessos: escolhido o cargo, a área vem junto e fica travada.
  await page.goto("/app/team");
  const otavioId = (await page
    .locator("[data-team-member]", { hasText: "Otávio Operador" })
    .getAttribute("data-team-member"))!;
  await page.goto(`/app/team/${otavioId}`);
  await expect(page.getByText("Nível", { exact: true })).toBeVisible();
  await page.locator("[data-team-position]").selectOption({ label: analyst });
  const area = page.locator("[data-team-area]");
  await expect(area).toBeDisabled();
  await expect(area.locator("option:checked")).toHaveText(finance);
  await page.locator("[data-team-save]").click();
  await expect(page.locator("[data-team-saved]")).toBeVisible();
  await page.goto("/app/team");
  await expect(
    page.locator(`[data-team-member-position="${otavioId}"]`),
  ).toHaveText(analyst);
  await expect(
    page.locator(`[data-team-member-area="${otavioId}"]`),
  ).toHaveText(finance);

  // Trocar a área do cargo leva a pessoa junto.
  await page.goto("/app/team?tab=positions");
  await areaSelect(analyst).selectOption({ label: tax });
  await row(analyst).locator("[data-position-area-save]").click();
  await page.waitForURL(/saved=position_area/);
  await expect(page.locator("[data-position-moved]")).toHaveText(
    "1 pessoa(s) com este cargo passaram para a nova área.",
  );
  await page.goto("/app/team");
  await expect(
    page.locator(`[data-team-member-area="${otavioId}"]`),
  ).toHaveText(tax);

  // O Otávio volta a ficar sem cargo e sem área, como nos dados de demonstração.
  await page.goto(`/app/team/${otavioId}`);
  await page.locator("[data-team-position]").selectOption("");
  await expect(page.locator("[data-team-area]")).toBeEnabled();
  await page.locator("[data-team-area]").selectOption("");
  await page.locator("[data-team-save]").click();
  await expect(page.locator("[data-team-saved]")).toBeVisible();
  await page.goto("/app/team");
  await expect(
    page.locator(`[data-team-member-position="${otavioId}"]`),
  ).toHaveText("—");
  await expect(
    page.locator(`[data-team-member-area="${otavioId}"]`),
  ).toHaveText("—");
});
