import { expect, test } from "@playwright/test";
import { login, setManualFx } from "./helpers";

/*
 * Trocar a moeda converte o valor (dono, 21/11/2026, com o vídeo da ficha do
 * produto): no quadro "Fornecedor e negociação", US$ 1,0194 vira o valor em
 * Real pelo câmbio do dia do portal (`/api/fx`), na hora, com o aviso
 * "Convertido de US$ 1,0194 · câmbio…" e o "Manter", que volta ao número de
 * antes na moeda nova. O que vai ao servidor é o valor convertido.
 */
test("ficha do produto: trocar a moeda converte o preço, com o aviso e o Manter", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  // Câmbio garantido mesmo sem rede (o do dia, quando há, continua valendo).
  await setManualFx(page);
  const fx = (await (await page.request.get("/api/fx")).json()) as {
    rates: Record<string, number>;
  };
  const usd = fx.rates.USD;
  const rmb = fx.rates.RMB;
  expect(usd).toBeGreaterThan(0);
  expect(rmb).toBeGreaterThan(0);
  const pt = (n: number) =>
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(n);
  const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

  await page.goto("/app/products/new");
  const form = page.locator("[data-new-product-form]");
  const currency = form.locator('select[name="currency"]');
  const price = form.locator('[data-money="price"]');
  const sent = form.locator('input[type="hidden"][name="price"]');

  // Moeda escolhida antes do valor: nada a converter.
  await currency.selectOption("USD");
  await price.fill("1,0194");
  await price.blur();
  await expect(price).toHaveValue("1,0194");
  await expect(form.locator("[data-fx-note]")).toHaveCount(0);

  // Dólar → Real: converte na hora.
  await currency.selectOption("BRL");
  const brl = round4(1.0194 * usd);
  await expect(price).toHaveValue(pt(brl));
  await expect(sent).toHaveValue(brl.toFixed(4));
  const note = form.locator("[data-fx-note]");
  await expect(note).toContainText("Convertido de US$ 1,0194");
  await expect(note.locator("[data-fx-keep]")).toHaveText("Manter R$ 1,0194");

  // "Manter": o número de antes, na moeda nova.
  await note.locator("[data-fx-keep]").click();
  await expect(price).toHaveValue("1,0194");
  await expect(sent).toHaveValue("1.0194");
  await expect(currency).toHaveValue("BRL");
  await expect(form.locator("[data-fx-note]")).toHaveCount(0);

  // Real → Yuan pelo mesmo câmbio; digitar tira o aviso.
  await currency.selectOption("CNY");
  await expect(price).toHaveValue(pt(round4(1.0194 / rmb)));
  await expect(form.locator("[data-fx-note]")).toContainText(
    "Convertido de R$ 1,0194",
  );
  await price.fill("2");
  await expect(form.locator("[data-fx-note]")).toHaveCount(0);
});
