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

/**
 * Busca pelo nome (sem acento e sem caixa) e pelo código: os dois BRINQUEDOS
 * aparecem, cada um com o seu código; nada encontrado mostra o aviso.
 */
async function checkSearch(page: Page) {
  const section = page.locator("[data-party-families]");
  const search = section.locator("[data-party-families-search]");
  const option = (code: string) =>
    section.locator(`[data-party-family-option="${code}"]`);
  await search.fill("brinq");
  await expect(option("10000000")).toBeVisible();
  await expect(option("110000000")).toBeVisible();
  await expect(option("110000000")).toContainText("110000000");
  await expect(option("20000000")).toBeHidden();
  await search.fill("Doméstica");
  await expect(option("20000000")).toBeVisible();
  await expect(option("10000000")).toBeHidden();
  await search.fill("11000");
  await expect(option("10000000")).toBeHidden();
  await expect(option("110000000")).toBeVisible();
  await search.fill("nada-assim");
  await expect(section.locator("[data-party-families-no-match]")).toBeVisible();
  await search.fill("");
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

test("Fornecedor: a seção substitui as Linhas atendidas; busca por nome e código; grava e recarrega; cada um com as suas", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/suppliers/fornecedor-a?tab=info");
  // A seção antiga saiu.
  await expect(page.locator("[data-supplier-lines]")).toHaveCount(0);
  await checkSearch(page);
  await chooseFamilies(page, ["10000000", "20000000"]);
  // Outro Fornecedor começa sem nenhuma. Gravado pela ficha de parceiros,
  // volta para ela, e a tela própria do Fornecedor mostra a mesma seleção.
  const other = await newPartner(page, "supplier", `Família supplier B ${tag}`);
  await page.goto(other);
  await expect(page.locator("[data-party-families]")).toHaveAttribute(
    "data-party-families",
    "0",
  );
  await chooseFamilies(page, ["110000000"]);
  expect(new URL(page.url()).pathname).toBe(other);
  await page.goto(`/app/suppliers/${other.split("/").pop()}?tab=info`);
  await expect(page.locator("[data-party-families]")).toHaveAttribute(
    "data-party-families",
    "1",
  );
  // O primeiro continua com as dele.
  await page.goto("/app/suppliers/fornecedor-a?tab=info");
  await expect(page.locator("[data-party-families]")).toHaveAttribute(
    "data-party-families",
    "2",
  );
});

// Os parceiros criados aqui entram na cotação de compra das famílias que
// marcam (é a regra). Por isso ficam fora de UTILIDADES (20000000): a
// cotação de utilidades do purchase-quote.spec conta os convidados, e os
// testes dividem o mesmo banco.
for (const [type, codes] of [
  ["trading", ["110000000", "40000000"]],
  ["supplier_partner", ["10000000", "40000000"]],
  ["factory", ["10000000", "110000000", "40000000"]],
] as const)
  test(`${type}: busca por nome e código, seleciona várias famílias, grava e recarrega; cada parceiro com as suas`, async ({
    page,
  }) => {
    await login(page, "admin@wellmix.com");
    const first = await newPartner(page, type, `Família ${type} A ${tag}`);
    const second = await newPartner(page, type, `Família ${type} B ${tag}`);
    await page.goto(first);
    await checkSearch(page);
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
