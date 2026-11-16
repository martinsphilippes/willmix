import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Áreas (Equipe Acessos e Parceiros → Áreas; dono, 16/11/2026): a lista do
 * dono colada no cadastro em massa entra só com as que faltam; as que já
 * existiam ficam como estão, com a grafia cadastrada ("Processos/Projetos"
 * vale por "Processos Projetos"; "Operações e Processos" é outra). A pessoa
 * recebe a área em Editar acessos e a lista mostra a coluna "Área".
 * Desativada, a área sai das escolhas e continua em quem já está nela. Os
 * nomes levam um sufixo do teste (o banco do E2E é o mesmo entre rodadas).
 */

const OWNER_LIST = [
  "Marketing",
  "Showroom",
  "Financeiro",
  "Comercial",
  "Contabil Fiscal",
  "Tecnologia da Informação",
  "Compras",
  "Comex",
  "Recursos Humanos",
  "Presidência",
  "Operações e Processos",
  "Processos Projetos",
];

test("Áreas: cadastro em massa só das que faltam, área da pessoa e desativar", async ({
  page,
}) => {
  const tag = Date.now().toString(36).toUpperCase();
  const named = (name: string) => `${name} ${tag}`;
  const row = (name: string) => page.locator(`[data-area-name="${name}"]`);
  await login(page, "admin@wellmix.com");

  // A seção Áreas, logo depois da Equipe.
  await page.goto("/app/team");
  await page.locator('[data-team-area-nav] [data-team-tab="areas"]').click();
  await page.waitForURL(/\/app\/team\?tab=areas$/);
  await expect(
    page.locator('[data-team-area-nav] [aria-current="page"]'),
  ).toHaveText("Áreas");

  // Duas já cadastradas antes, uma com a grafia "Processos/Projetos".
  const createOne = async (name: string) => {
    const form = page.locator("[data-area-new]");
    await form.locator('input[name="name"]').fill(name);
    await form.getByRole("button", { name: "Criar área" }).click();
    await page.waitForURL(/saved=area_created/);
    await expect(row(name)).toBeVisible();
  };
  await createOne(named("Comex"));
  await createOne(`Processos/Projetos ${tag}`);
  // A mesma com outra grafia é recusada, com o motivo.
  const form = page.locator("[data-area-new]");
  await form.locator('input[name="name"]').fill(`COMEX ${tag.toLowerCase()}`);
  await form.getByRole("button", { name: "Criar área" }).click();
  await page.waitForURL(/error=area_exists/);
  // (O anúncio de rota do Next também é role=alert: só o aviso com o motivo.)
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Já existe uma área com esse nome" }),
  ).toBeVisible();

  // Cadastro em massa da lista do dono.
  await page
    .locator("[data-area-bulk-names]")
    .fill(OWNER_LIST.map(named).join("\n"));
  await page.locator("[data-area-bulk-submit]").click();
  await expect(page.locator("[data-area-bulk-done]")).toHaveText(
    "Pronto: 10 criada(s) e 2 já cadastrada(s).",
  );
  const missing = OWNER_LIST.filter(
    (n) => n !== "Comex" && n !== "Processos Projetos",
  ).map(named);
  expect(
    await page.locator('[data-area-bulk-item="created"]').allInnerTexts(),
  ).toEqual(missing);
  expect(
    await page.locator('[data-area-bulk-item="existing"]').allInnerTexts(),
  ).toEqual([
    named("Comex"),
    `${named("Processos Projetos")} (cadastrada como “Processos/Projetos ${tag}”)`,
  ]);

  // A lista: as 12 representadas, "Processos/Projetos" com a grafia de antes.
  for (const name of [...missing, named("Comex"), `Processos/Projetos ${tag}`])
    await expect(row(name)).toHaveAttribute("data-area-active", "1");
  await expect(row(named("Processos Projetos"))).toHaveCount(0);
  await expect(row(named("Operações e Processos"))).toHaveCount(1);

  // Na Auditoria, cada área criada pelo cadastro em massa.
  await page.goto(
    `/app/audit?module=team&q=${encodeURIComponent(named("Marketing"))}`,
  );
  await expect(
    page.locator('[data-audit-row="team.area_create"]'),
  ).toContainText(`Área criada: ${named("Marketing")} (cadastro em massa)`);

  // A área da pessoa em Editar acessos e na coluna "Área" da lista.
  await page.goto("/app/team");
  const otavioId = (await page
    .locator("[data-team-member]", { hasText: "Otávio Operador" })
    .getAttribute("data-team-member"))!;
  const setArea = async (label: string | null) => {
    await page.goto(`/app/team/${otavioId}`);
    const select = page.locator("[data-team-area]");
    if (label) await select.selectOption({ label });
    else await select.selectOption("");
    await page.locator("[data-team-save]").click();
    await expect(page.locator("[data-team-saved]")).toBeVisible();
  };
  await setArea(named("Comex"));
  await page.goto("/app/team");
  await expect(
    page.locator(`[data-team-member-area="${otavioId}"]`),
  ).toHaveText(named("Comex"));
  await page.goto("/app/team?tab=areas");
  await expect(row(named("Comex"))).toContainText("1 pessoa");

  // Desativada: sai das escolhas e continua em quem já está nela.
  await row(named("Comex")).locator("[data-area-toggle]").click();
  await page.waitForURL(/saved=area_deactivated/);
  await expect(row(named("Comex"))).toHaveAttribute("data-area-active", "0");
  await expect(row(named("Comex"))).toContainText("Desativada");
  await page.goto(`/app/team/${otavioId}`);
  await expect(page.locator("[data-team-area] option:checked")).toHaveText(
    `${named("Comex")} (desativada)`,
  );
  await page.goto("/app/team?tab=team&new=1");
  const newArea = page.locator("[data-team-new-area]");
  await expect(
    newArea.locator("option", { hasText: named("Marketing") }),
  ).toHaveCount(1);
  await expect(
    newArea.locator("option", { hasText: named("Comex") }),
  ).toHaveCount(0);

  // Reativada; o Otávio volta a ficar sem área, como nos dados de demonstração.
  await page.goto("/app/team?tab=areas");
  await row(named("Comex")).locator("[data-area-toggle]").click();
  await page.waitForURL(/saved=area_activated/);
  await expect(row(named("Comex"))).toHaveAttribute("data-area-active", "1");
  await setArea(null);
  await page.goto("/app/team");
  await expect(
    page.locator(`[data-team-member-area="${otavioId}"]`),
  ).toHaveText("—");
});
