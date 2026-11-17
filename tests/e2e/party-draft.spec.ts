import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Rascunho do Novo parceiro no banco, por login (dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md, D11): o formulário guarda sozinho o que foi
 * digitado; ao voltar, o rascunho aparece com "Descartar rascunho"; salvar o
 * cadastro apaga o rascunho.
 */
test("Novo parceiro: o rascunho guardado volta, descarta e some ao salvar", async ({
  page,
}) => {
  const tag = Date.now().toString(36).toUpperCase();
  await login(page, "admin@wellmix.com");
  await page.goto("/app/parties/new");
  const form = page.locator("form:has([data-party-type])");
  await expect(form).toHaveAttribute("data-draft-autosave-ready", "");
  await form.locator('input[name="name"]').fill(`Rascunho ${tag}`);
  await expect(form.locator('[data-draft-saved="1"]')).toBeVisible();

  // Voltou depois (recarregou): o que foi digitado está lá, com o aviso.
  await page.reload();
  await expect(page.locator("[data-party-draft-restored]")).toBeVisible();
  await expect(form.locator('input[name="name"]')).toHaveValue(
    `Rascunho ${tag}`,
  );

  // Descartar: o formulário volta vazio.
  await page.locator("[data-party-draft-discard]").click();
  await expect(page.locator("[data-party-draft-restored]")).toHaveCount(0);
  await expect(form.locator('input[name="name"]')).toHaveValue("");

  // Digitado de novo e salvo: o rascunho some.
  await expect(form).toHaveAttribute("data-draft-autosave-ready", "");
  await form.locator('input[name="name"]').fill(`Salvo ${tag}`);
  await expect(form.locator('[data-draft-saved="1"]')).toBeVisible();
  await form.locator("[data-party-type]").selectOption({ index: 1 });
  await form.getByRole("button", { name: "Salvar" }).first().click();
  await page.waitForURL(/\/app\/(parties|customers)\/[^/?#]+(\/edit)?#access$/);
  await page.goto("/app/parties/new");
  await expect(page.locator("[data-party-draft-restored]")).toHaveCount(0);
});
