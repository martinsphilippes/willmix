import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Campo de cliente com busca (src/components/party-picker.tsx): com a carga
 * do Sankhya são ~26 mil clientes, que não cabem numa lista de seleção. A
 * busca começa com 2 letras e o id escolhido vai no mesmo campo de antes.
 */
test("filtro de cliente do Marketing: busca pelo nome e filtra pelo escolhido", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/marketing");
  const picker = page.locator('[data-party-picker="customer"]').first();
  const field = picker.locator("[data-party-picker-input]");
  await expect(field).toBeVisible();

  // Uma letra só: pede mais.
  await field.fill("l");
  await expect(picker.locator("[data-party-picker-hint]")).toBeVisible();

  // Sem caixa: "LOJA" acha "Loja do João Ltda".
  await field.fill("LOJA");
  const option = picker.locator("[data-party-picker-option]").filter({
    hasText: "Loja do João",
  });
  await expect(option).toBeVisible();
  await option.click();
  await expect(field).toHaveValue("Loja do João Ltda");

  await page.getByRole("button", { name: /filtrar/i }).click();
  await page.waitForURL(/customerId=/);
  // O filtro volta preenchido com o nome do cliente.
  await expect(
    page
      .locator('[data-party-picker="customer"] [data-party-picker-input]')
      .first(),
  ).toHaveValue("Loja do João Ltda");
});
