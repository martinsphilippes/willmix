import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Configurações → Sankhya → Pedidos do Sankhya (ensaio), só o administrador
 * (21/11/2026; docs/SANKHYA_INTEGRACAO.md, seção 9, etapa 3). No modo memória
 * o ensaio não foi montado: a aba abre com o aviso de como montar.
 */
test("ensaio dos pedidos do Sankhya: aba do administrador, vazia sem o ensaio", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/settings/sankhya?tab=orders");
  await expect(
    page.locator('[data-settings-tab="orders"][aria-current="page"]'),
  ).toBeVisible();
  await expect(page.getByText(/ensaio ainda não foi montado/i)).toBeVisible();

  await login(page, "operador@wellmix.com");
  await page.goto("/app/settings/sankhya?tab=orders");
  // Sem ser administrador, a aba não abre (página não encontrada ou sem acesso).
  await expect(page.locator('[data-settings-tab="orders"]')).toHaveCount(0);
});
