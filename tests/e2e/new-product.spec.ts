import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Novo produto (dono, 17/11/2026; docs/NEW_PRODUCT.md): o quadro curto da
 * lista saiu; "+ Novo produto" abre a ficha do produto em branco. Criado, o
 * produto fica inativo e vai para as Pendências do administrador (o
 * operador da demonstração não tem superior no "Responde a"), que recusa
 * com o motivo ou aprova; recusado, quem cadastrou corrige e reenvia.
 */
test("novo produto: ficha em branco, aprovação nas Pendências, recusa e reenvio", async ({
  page,
}) => {
  const name = `Garrafa térmica E2E ${Date.now()}`;
  await login(page, "operador@wellmix.com");
  await page.goto("/app/products");
  // O quadro curto não existe mais: o botão leva à ficha em branco.
  await expect(page.locator("details[data-product-new]")).toHaveCount(0);
  await page.locator("a[data-product-new]").click();
  await page.waitForURL(/\/app\/products\/new$/);
  const form = page.locator("[data-new-product-form]");
  // Os quatro quadros da ficha, já abertos para preencher.
  for (const fold of ["product", "supplier", "packaging", "notes"])
    await expect(
      form.locator(`details[data-fold-card="${fold}"]`),
    ).toHaveAttribute("open", "");
  await expect(form.locator("[data-new-product-status]")).toBeVisible();
  await expect(page.locator("[data-new-product-approver]")).toBeVisible();
  await form.locator('input[name="name"]').fill(name);
  await form.locator('input[name="sku"]').fill("GT-E2E-500");
  await form.locator('select[name="lineId"]').selectOption({ index: 1 });
  await form.locator('input[name="material"]').fill("Inox");
  await form.locator('input[name="masterBoxQty"]').fill("24");
  // Fornecedor pela busca (o cadastro tem milhares).
  const supplier = form.locator('[data-party-picker="supplier"]');
  await supplier.locator("[data-party-picker-input]").fill("shenzhen");
  await supplier.locator('[data-party-picker-option="fornecedor-a"]').click();
  await page.locator("[data-new-product-submit]").click();
  await page.waitForURL(/\/app\/products\/[^/?]+\?created=1/);
  const productPath = new URL(page.url()).pathname;
  await expect(page.locator("[data-product-created]")).toBeVisible();
  await expect(page.locator('[data-product-approval="pending"]')).toBeVisible();
  await expect(
    page.locator('[data-product-approval-badge="pending"]'),
  ).toBeVisible();
  // A caixa "Produto ativo" fica travada até a aprovação; o resto da ficha
  // (fotos, medições...) já está na tela.
  await expect(page.locator("[data-product-active-locked]")).toBeAttached();
  await expect(page.locator('input[name="material"]').first()).toHaveValue(
    "Inox",
  );
  // Quem cadastrou não decide o próprio produto.
  await expect(page.locator("[data-product-approve]")).toHaveCount(0);
  // Na lista: fora dos ativos, em "Aguardando aprovação".
  await page.goto("/app/products");
  await page.locator("[data-products-show-approval]").click();
  await page.waitForURL(/view=approval/);
  await expect(
    page.locator(`[data-product-row] a[href="${productPath}"]`).first(),
  ).toBeVisible();

  // O administrador recebe a pendência e recusa com o motivo.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/tasks?type=product_approve");
  const task = page.locator(
    `[data-task-row] a[href="${productPath}#approval"]`,
  );
  await expect(task.first()).toBeVisible();
  await task.first().click();
  await page.waitForURL(new RegExp(`${productPath}#approval`));
  await page
    .locator("[data-product-reject-note]")
    .fill("Falta a foto da caixa master");
  await page.locator("[data-product-reject]").click();
  await page.waitForURL(/approval=rejected/);
  await expect(
    page.locator('[data-product-approval="rejected"]'),
  ).toBeVisible();
  await expect(page.locator("[data-product-approval-note]")).toContainText(
    "Falta a foto da caixa master",
  );

  // Quem cadastrou vê o motivo, corrige e reenvia.
  await login(page, "operador@wellmix.com");
  await page.goto(productPath);
  await expect(page.locator("[data-product-approval-note]")).toContainText(
    "Falta a foto da caixa master",
  );
  await page.locator("[data-product-resubmit]").click();
  await page.waitForURL(/approval=resubmitted/);
  await expect(page.locator('[data-product-approval="pending"]')).toBeVisible();

  // O administrador aprova: o produto fica ativo e volta à lista principal.
  await login(page, "admin@wellmix.com");
  await page.goto(productPath);
  await page.locator("[data-product-approve]").click();
  await page.waitForURL(/approval=approved/);
  await expect(
    page.locator('[data-product-approval-done="approved"]'),
  ).toBeVisible();
  await expect(page.locator("[data-product-approval]")).toHaveCount(0);
  await expect(
    page.locator('#product-form input[type="checkbox"][name="active"]'),
  ).toBeChecked();
  await page.goto(`/app/products?q=${encodeURIComponent(name)}`);
  await expect(
    page.locator(`[data-product-row] a[href="${productPath}"]`).first(),
  ).toBeVisible();
  // Sem pendência de aprovação dele.
  await page.goto("/app/tasks?type=product_approve");
  await expect(
    page.locator(`[data-task-row] a[href="${productPath}#approval"]`),
  ).toHaveCount(0);
});
