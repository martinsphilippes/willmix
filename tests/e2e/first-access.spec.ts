import { expect, test } from "@playwright/test";
import { login, PASSWORD } from "./helpers";

/*
 * Primeiro acesso com senha provisória (pedido do dono, 14/11/2026): dá para
 * seguir sem trocar a senha. O cartão da troca oferece "Continuar sem trocar
 * a senha"; o portal abre na mesma tela, a troca não é mais exigida (nem ao
 * recarregar, nem ao entrar de novo, com a mesma senha) e continua
 * disponível em "Trocar senha".
 */
test("primeiro acesso: seguir sem trocar a senha provisória", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  const userLogin = `provisoria-${tag}@wellmix.com`;
  await login(page, "admin@wellmix.com");

  // Login novo da equipe com a troca no primeiro acesso (marcada de fábrica).
  await page.goto("/app/team?tab=team&new=1");
  const form = page.locator("[data-team-new-login]");
  await form.locator('input[name="name"]').fill(`Provisória ${tag}`);
  await form.locator('input[name="login"]').fill(userLogin);
  await form.locator('input[name="password"]').fill(PASSWORD);
  await expect(form.locator('input[name="mustChange"]')).toBeChecked();
  await form.getByRole("button", { name: "Criar login" }).click();
  await page.waitForURL(/\/app\/team\/[^/?]+\?created=/);

  // Entra: o portal pede a troca, mas deixa seguir sem trocar.
  await login(page, userLogin);
  const first = page.locator('[data-password-change="first"]');
  await expect(first).toBeVisible();
  const skip = page.locator("[data-password-skip]");
  await expect(skip).toContainText("Dá para trocar depois");
  const url = page.url();
  await skip
    .getByRole("button", { name: "Continuar sem trocar a senha" })
    .click();
  await expect(first).toHaveCount(0);
  expect(page.url()).toBe(url);

  // Não pede mais: nem ao recarregar, nem ao entrar de novo (mesma senha).
  await page.reload();
  await expect(first).toHaveCount(0);
  await login(page, userLogin);
  await expect(first).toHaveCount(0);

  // A troca continua em "Trocar senha".
  await page.goto("/app/password");
  await expect(page.locator('[data-password-change="own"]')).toBeVisible();
});
