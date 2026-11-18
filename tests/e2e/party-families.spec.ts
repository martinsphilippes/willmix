import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Grupo de produto (família) no cadastro do parceiro (dono, 18/11/2026;
 * docs/PARTNER_FAMILIES.md), no lugar das "Linhas atendidas": Fornecedor,
 * Trading, Supplier e Factory. Busca por nome ou código, várias famílias,
 * as selecionadas à vista, gravadas e recarregadas, cada parceiro com as
 * suas. Famílias da demonstração: 20000000 UTILIDADES DOMESTICAS, 10000000
 * e 110000000 BRINQUEDOS (mesmo nome, códigos diferentes), 40000000
 * DECORACAO.
 */

const tag = Date.now().toString(36);

/** Cadastra um parceiro do tipo e devolve o endereço da ficha dele. */
async function newPartner(page: Page, type: string, name: string) {
  await page.goto(`/app/parties/new?type=${type}`);
  await expect(page.locator("[data-party-type]")).toHaveValue(type);
  await page.fill('input[name="name"]', name);
  await page.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/parties\/[^/?]+$/);
  return new URL(page.url()).pathname;
}

/** Marca as famílias, grava e confere que voltam marcadas. */
async function chooseFamilies(page: Page, codes: string[]) {
  const section = page.locator("[data-party-families]");
  await expect(section).toBeVisible();
  // O título é o do quadro (#families), acima do texto de apoio.
  await expect(page.locator("#families")).toContainText(
    "Grupo de produto (família)",
  );
  await expect(section).toContainText(
    "Selecione os grupos de produto (famílias) atendidos por este parceiro.",
  );
  for (const code of codes)
    await section.locator(`[data-party-family="${code}"]`).check();
  await expect(
    section.locator("[data-party-families-selected]"),
  ).toHaveAttribute("data-party-families-selected", String(codes.length));
  await section.locator("[data-party-families-save]").click();
  await page.waitForURL(/[?&]families=saved/);
  await expect(page.locator("[data-party-families-saved]")).toBeVisible();
  await page.reload();
  const again = page.locator("[data-party-families]");
  await expect(again).toHaveAttribute(
    "data-party-families",
    String(codes.length),
  );
  for (const code of codes) {
    await expect(again.locator(`[data-party-family="${code}"]`)).toBeChecked();
    await expect(
      again.locator(`[data-party-family-chip="${code}"]`),
    ).toBeVisible();
  }
}

test("Fornecedor: a seção substitui as Linhas atendidas; busca por nome e código; grava e recarrega", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/suppliers/fornecedor-a?tab=info");
  // A seção antiga saiu.
  await expect(page.locator("[data-supplier-lines]")).toHaveCount(0);
  const section = page.locator("[data-party-families]");
  const search = section.locator("[data-party-families-search]");
  // Pelo nome (sem acento e caixa): os dois BRINQUEDOS, cada um com o código.
  await search.fill("brinq");
  await expect(
    section.locator('[data-party-family-option="10000000"]'),
  ).toBeVisible();
  await expect(
    section.locator('[data-party-family-option="110000000"]'),
  ).toBeVisible();
  await expect(
    section.locator('[data-party-family-option="110000000"]'),
  ).toContainText("110000000");
  await expect(
    section.locator('[data-party-family-option="20000000"]'),
  ).toBeHidden();
  // Pelo código.
  await search.fill("11000");
  await expect(
    section.locator('[data-party-family-option="10000000"]'),
  ).toBeHidden();
  await expect(
    section.locator('[data-party-family-option="110000000"]'),
  ).toBeVisible();
  await search.fill("nada-assim");
  await expect(section.locator("[data-party-families-no-match]")).toBeVisible();
  await search.fill("");
  await chooseFamilies(page, ["10000000", "20000000"]);
});

for (const [type, codes] of [
  ["trading", ["110000000", "40000000"]],
  ["supplier_partner", ["10000000"]],
  ["factory", ["20000000", "10000000", "110000000"]],
] as const)
  test(`${type}: seleciona várias famílias, grava e recarrega; cada parceiro com as suas`, async ({
    page,
  }) => {
    await login(page, "admin@wellmix.com");
    const first = await newPartner(page, type, `Família ${type} A ${tag}`);
    const second = await newPartner(page, type, `Família ${type} B ${tag}`);
    await page.goto(first);
    await chooseFamilies(page, [...codes]);
    // O outro parceiro do mesmo tipo continua sem nenhuma.
    await page.goto(second);
    const other = page.locator("[data-party-families]");
    await expect(other).toHaveAttribute("data-party-families", "0");
    for (const code of codes)
      await expect(
        other.locator(`[data-party-family="${code}"]`),
      ).not.toBeChecked();
  });

test("quem não é da equipe não vê a seção", async ({ page }) => {
  await login(page, "supplier.a@china.com");
  await page.goto("/app/suppliers/fornecedor-a?tab=info");
  await expect(page.locator("[data-party-families]")).toHaveCount(0);
});
