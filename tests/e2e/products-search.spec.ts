import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Busca nas listas grandes (dono, 17/11/2026): o produto "Teste AGORA" não
 * aparecia no "Buscar na tabela", que só olhava os 50 produtos da página.
 * - Produtos: uma busca só, a da tela (catálogo inteiro), sem a busca e as
 *   páginas da tabela; o "+ Novo produto" abre a ficha do produto criado com
 *   o aviso; a ordem "Mais recentes primeiro" põe o produto novo no topo.
 * - Auditoria: com mais de uma página, a tabela fica sem a busca e as
 *   páginas dela (o filtro "Texto" vale para a auditoria inteira).
 * Desktop, iPad e celular.
 */

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "ipad", width: 820, height: 1180 },
  { name: "celular", width: 390, height: 844 },
] as const;

/**
 * "+ Novo produto" abre a ficha em branco (dono, 17/11/2026;
 * docs/NEW_PRODUCT.md); criado pelo administrador, o produto já nasce ativo.
 */
async function createProduct(page: Page, name: string): Promise<string> {
  await page.goto("/app/products");
  await page.locator("a[data-product-new]").click();
  await page.waitForURL(/\/app\/products\/new$/);
  const form = page.locator("[data-new-product-form]");
  await form.locator('input[name="name"]').fill(name);
  await form.locator('select[name="lineId"]').selectOption({ index: 1 });
  await page.locator("[data-new-product-submit]").click();
  await page.waitForURL(/\/app\/products\/[^/?]+\?created=1$/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

for (const viewport of VIEWPORTS) {
  test(`Produtos: criar abre a ficha; busca e ordem no catálogo inteiro (${viewport.name})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await login(page, "admin@wellmix.com");

    // Uma busca só: a da tela; a tabela sem a busca e as páginas dela.
    await page.goto("/app/products");
    await expect(page.locator("[data-product-search-input]")).toBeVisible();
    await expect(page.locator("[data-product-row]").first()).toBeAttached();
    await expect(page.locator("[data-table-search]")).toHaveCount(0);
    await expect(page.locator("[data-table-pager]")).toHaveCount(0);

    // Novo produto: abre a ficha dele, com o aviso "Produto criado".
    const name = `Teste AGORA ${viewport.name} ${Date.now().toString(36)}`;
    const id = await createProduct(page, name);
    await expect(page.locator("[data-product-created]")).toBeVisible();
    await expect(page.locator("[data-product-created]")).toContainText(
      /Produto criado/,
    );

    // Mais recentes primeiro: o produto novo no topo da lista inteira.
    await page.goto("/app/products");
    await expect(page.locator("[data-auto-submit-ready]")).toBeAttached();
    await page.locator("[data-product-order]").selectOption("recent");
    await page.waitForURL(/[?&]order=recent/);
    await expect(page.locator("[data-product-row]").first()).toHaveAttribute(
      "data-product-row",
      id,
    );
    await expect(page.locator("[data-product-order]")).toHaveValue("recent");
    // "Ordem" fica ao paginar e ao limpar a busca.
    const next = page.locator("[data-product-page-next]");
    if (await next.count())
      await expect(next).toHaveAttribute("href", /order=recent/);

    // A busca da tela acha o produto em qualquer página, sem acento nem caixa.
    const search = page.locator("[data-product-search-input]");
    await search.fill(name.toUpperCase());
    await search.press("Enter");
    await page.waitForURL(/[?&]q=/);
    await expect(page.locator("[data-product-row]")).toHaveCount(1);
    await expect(page.locator(`[data-product-row="${id}"]`)).toBeVisible();
    await expect(page.locator("[data-product-total]")).toContainText("1");

    // A página não passa da largura da tela.
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("Auditoria: com mais de uma página, sem a busca que só olhava a página", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  // Na rodada inteira do E2E a auditoria passa de 100 registros (o caminho
  // principal roda antes); rodando este arquivo sozinho, pode caber numa
  // página, e então a tabela segue com a busca de sempre.
  await page.goto("/app/audit");
  const pages = Number(
    await page.locator("[data-audit-pages]").getAttribute("data-audit-pages"),
  );
  const rows = await page.locator("[data-audit-row]").count();
  if (pages > 1) {
    // Várias páginas: só o filtro "Texto" e as páginas de baixo.
    await expect(page.locator("[data-table-search]")).toHaveCount(0);
    await expect(page.locator("[data-table-pager]")).toHaveCount(0);
    await expect(page.locator("[data-audit-row]")).toHaveCount(rows);
    expect(rows).toBe(100);
  } else if (rows >= 6) {
    // Uma página só: a tabela tem o resultado inteiro e segue com a busca.
    await expect(page.locator("[data-table-search]")).toHaveCount(1);
  }
});
