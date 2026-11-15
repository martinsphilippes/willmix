import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Forma de pagamento do cliente (dono, 15/11/2026; docs/CUSTOMER_PAYMENT.md):
 * as duas formas de partida em Configurações, a escolha no pedido com o
 * vendedor e as parcelas na seção "Pagamento do cliente".
 */
test("formas de pagamento: as de partida e a soma de 100% (a escolha no pedido está no caminho principal)", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/settings");
  await page.click("[data-settings-payment-plans]");
  await page.waitForURL(/\/app\/settings\/payment-plans/);
  await expect(page.locator("[data-payment-plan]")).toHaveCount(2);
  await expect(page.locator("main")).toContainText(
    "10% no pedido; 90% no embarque",
  );
  await expect(page.locator("main")).toContainText(
    "20% no pedido; 0% no embarque; 80% na Presença de Carga",
  );

  // Forma que não soma 100%: recusada com o motivo.
  const form = page.locator('[data-payment-plan-form="new"]');
  await form.locator('input[name="name"]').fill("Teste 50%");
  await form.locator('input[name="percent.1"]').fill("50");
  await form.getByRole("button", { name: /salvar|save/i }).click();
  await expect(page.locator("main")).toContainText(
    "As parcelas precisam somar 100%.",
  );
});
