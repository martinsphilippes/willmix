import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/*
 * Cadastro rápido de cliente pelo "+" ao lado do campo Cliente da Nova
 * solicitação (dono, 21/11/2026; docs/ORDER_TERMS.md, seção 11.25): na
 * própria tela, sem ir a Cadastros. Quem lança a solicitação cadastra (Vendas
 * também); o cliente fica escolhido no pedido; CNPJ repetido não cria outro
 * e oferece o que existe. No teste não há rede (modo memória): a consulta da
 * Receita não responde e os dados se digitam.
 */

/** CNPJ válido a partir dos 12 primeiros dígitos. */
function cnpj(base: string): string {
  const d = base.split("").map(Number);
  const digit = (weights: number[]) => {
    const r = weights.reduce((a, w, i) => a + w * d[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  d.push(digit([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  d.push(digit([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  return d.join("");
}
const masked = (d: string) =>
  `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;

test("Nova solicitação: o + cadastra o cliente na própria tela e o deixa escolhido; CNPJ repetido usa o existente", async ({
  page,
}) => {
  // Um CNPJ por rodada (o mesmo servidor pode rodar o teste de novo).
  const doc = cnpj(`${String(Date.now()).slice(-8)}0001`);
  const name = `Mercado Rápido ${doc.slice(4, 8)}`;

  await login(page, "vendas@wellmix.com");
  await page.goto("/app/requests/new");
  const field = page.locator("[data-request-customer]");
  await field.locator("[data-quick-customer-open]").click();
  const dialog = page.locator("[data-quick-customer]");
  await expect(dialog).toBeVisible();

  // CNPJ inválido: avisa e não deixa salvar.
  await dialog.locator("[data-quick-customer-cnpj]").fill("11222333000180");
  await expect(
    dialog.locator('[data-quick-customer-status="invalid"]'),
  ).toBeVisible();
  await expect(dialog.locator("[data-quick-customer-save]")).toBeDisabled();

  // CNPJ válido: sem a Receita no teste, os dados se digitam.
  await dialog.locator("[data-quick-customer-cnpj]").fill(doc);
  await expect(
    dialog.locator('[data-quick-customer-status="manual"]'),
  ).toBeVisible();
  await expect(dialog.locator("[data-quick-customer-cnpj]")).toHaveValue(
    masked(doc),
  );
  await dialog.locator('[data-quick-customer-field="name"]').fill(name);
  await dialog.locator('[data-quick-customer-field="city"]').fill("Campinas");
  await dialog.locator('[data-quick-customer-field="state"]').fill("SP");
  await dialog.locator("[data-quick-customer-save]").click();
  await expect(dialog).toBeHidden();

  // Escolhido no pedido, na mesma tela.
  await expect(page).toHaveURL(/\/app\/requests\/new$/);
  await expect(field.locator("[data-party-picker-input]")).toHaveValue(name);
  await expect(field.locator("[data-quick-customer-done]")).toContainText(name);
  await expect(field.locator("[data-request-customer-summary]")).toContainText(
    name,
  );
  const id = await field.locator('input[name="customerId"]').inputValue();
  expect(id).not.toBe("");

  // O mesmo CNPJ de novo: não cria outro; oferece o cliente que existe.
  await field.locator("[data-quick-customer-open]").click();
  await expect(dialog).toBeVisible();
  await dialog.locator("[data-quick-customer-cnpj]").fill(masked(doc));
  const existing = dialog.locator(`[data-quick-customer-existing="${id}"]`);
  await expect(existing).toContainText(name);
  await expect(dialog.locator("[data-quick-customer-save]")).toHaveCount(0);
  await existing.locator("[data-quick-customer-use-existing]").click();
  await expect(dialog).toBeHidden();
  await expect(field.locator('input[name="customerId"]')).toHaveValue(id);
  // Usar o existente não diz "cadastrado".
  await expect(field.locator("[data-quick-customer-done]")).toHaveCount(0);

  // A busca do campo Cliente já acha o cliente novo pelo CNPJ.
  await field.locator("[data-party-picker-input]").fill(doc.slice(0, 8));
  await expect(
    page.locator(`[data-party-picker-option="${id}"]`).first(),
  ).toBeVisible();
});
