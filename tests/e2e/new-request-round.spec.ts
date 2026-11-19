import { expect, test, type Page } from "@playwright/test";
import { editOrderTerms, fillOrderTerms, login } from "./helpers";

/*
 * Nova solicitação TS (rodada do dono de 19/11/2026): só produtos da base;
 * "Código - Nome" abaixo da busca; a miniatura da foto em cada opção da
 * busca; a descrição do produto escolhido à direita, só leitura; o modal
 * "Ver o cálculo" da previsão de preço; os campos do "Gerar as entregas
 * programadas" na largura toda; as condições do pedido recolhidas num
 * resumo quando completas e a programação de entregas pelo "Confirmar".
 */

async function chooseCustomer(page: Page, text: string, id: string) {
  const picker = page.locator(
    '[data-request-customer] [data-party-picker="customer"]',
  );
  await picker.locator("[data-party-picker-input]").fill(text);
  await picker.locator(`[data-party-picker-option="${id}"]`).click();
}

test("Nova solicitação TS: produto da base, descrição, cálculo da previsão e blocos recolhidos", async ({
  page,
}) => {
  // A previsão é do Sankhya (aqui simulada), com a memória de cálculo.
  await page.route("**/api/price-forecast?**", (route) =>
    route.fulfill({
      json: {
        mode: "api",
        kind: "forecast",
        salePrice: null,
        tablePrice: null,
        wholesalePrice: null,
        retailPrice: null,
        targetPrice: null,
        cost: 5,
        profitPercent: 20,
        goalPercent: 18,
        status: "PRONTA",
        productPrice: 9.2,
        freightUnit: 0.8,
        withFreight: 10,
        wdBase: null,
        wdPercent: null,
        wdPrice: null,
        wdWithFreight: 11.43,
        goalReached: true,
        audit: {
          fn: "FN_AD_ENC_COTACAO_V2_WELL",
          inputs: [
            ["CODPROD", 1001],
            ["VIP", 5],
          ],
          outputs: [
            ["CUSTO_BASE_VENDA", 5],
            ["PRECO_WD_COM_FRETE_REFERENCIA", 11.43],
          ],
        },
      },
    }),
  );
  await login(page, "admin@wellmix.com");
  await page.goto("/app/new-request/ts");
  await chooseCustomer(page, "loja", "cliente-joao");

  // Condições do pedido: completas, recolhem num resumo de uma linha.
  const terms = page.locator("[data-order-terms]");
  await fillOrderTerms(page);
  const summary = terms.locator("[data-order-terms-collapsed]");
  await expect(summary).toBeVisible();
  await expect(summary.locator("th")).toContainText([
    "Operação",
    "Formato",
    "Re-despacho",
    "Transportador",
    "Origem e grupo",
    "Pagamento",
    "Valor total",
  ]);
  await expect(summary).toContainText("CHINA › Brinquedos");
  await expect(terms.locator("[data-order-terms-body]")).toBeHidden();
  await editOrderTerms(page);
  await expect(summary).toHaveCount(0);
  await terms.locator('[data-order-terms-toggle="collapse"]').click();
  await expect(summary).toBeVisible();

  // Só produtos da base: sem o "Produto ainda não está no catálogo".
  const row = page.locator('[data-request-item="0"]');
  await expect(row.locator('input[name$="sourcingDemand"]')).toHaveCount(0);
  await expect(row).not.toContainText("ainda não está no catálogo");

  // Busca: cada opção com a miniatura da foto (ou o quadro vazio).
  const product = row.locator('[data-product-picker="catalog"]');
  await product.locator("[data-product-picker-input]").fill("boneca");
  const option = product.locator('[data-product-picker-option="prod-boneca"]');
  await expect(
    option.locator("[data-hover-zoom], [data-hover-zoom-empty]"),
  ).toHaveCount(1);
  await option.click();

  // "Código - Nome do produto" abaixo da busca e a descrição à direita.
  await expect(row.locator("[data-request-product-summary]")).toHaveText(
    "BRQ-001 - Boneca articulada 30 cm",
  );
  const description = row.locator("[data-request-product-description]");
  await expect(description).toContainText("Boneca articulada 30 cm");
  await expect(description.locator("input, textarea")).toHaveCount(0);
  const pickerBox = (await product.boundingBox())!;
  const descriptionBox = (await description.boundingBox())!;
  expect(descriptionBox.x).toBeGreaterThan(pickerBox.x + pickerBox.width);
  expect(Math.abs(descriptionBox.y - pickerBox.y)).toBeLessThan(40);

  // "Gerar as entregas programadas": os campos fecham a largura do cartão.
  const fields = row.locator("[data-generate-fields]");
  await expect(fields).toHaveAttribute("data-generate-fill", "true");
  const box = (await fields.boundingBox())!;
  const rights = await fields
    .locator(":scope > label:visible, :scope > div:visible")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
  expect(Math.max(...rights)).toBeGreaterThan(box.x + box.width - 2);

  // Previsão de preço: "Ver o cálculo" abre o modal com o que foi enviado e
  // o que voltou, com o que é cada parâmetro; o preço da tela destacado.
  const forecast = row.locator("[data-price-forecast]").first();
  await expect(
    forecast.locator('[data-price-forecast-line="price"]'),
  ).toHaveText(/11,43/);
  await forecast.locator("[data-price-forecast-audit-open]").click();
  const audit = page.locator("[data-price-forecast-audit]");
  await expect(audit).toBeVisible();
  await expect(
    audit.locator('[data-price-forecast-audit-input="CODPROD"]'),
  ).toContainText("Código do produto no Sankhya");
  await expect(
    audit.locator(
      '[data-price-forecast-audit-output="PRECO_WD_COM_FRETE_REFERENCIA"]',
    ),
  ).toContainText("Na tela");
  await page.keyboard.press("Escape");
  await expect(audit).toBeHidden();

  // Programação de entregas: "Confirmar" recolhe num resumo; Editar abre.
  const plan = page.locator("[data-order-plan]");
  await plan.locator("[data-order-plan-count]").fill("3");
  await plan.locator("[data-order-plan-count]").blur();
  await plan.locator("[data-order-plan-confirm]").click();
  const planSummary = plan.locator("[data-order-plan-summary]");
  await expect(planSummary).toBeVisible();
  await expect(planSummary).toContainText("Entregas");
  await expect(planSummary.locator("td").first()).toHaveText("3");
  await expect(plan.locator("[data-order-plan-body]")).toBeHidden();
  await plan.locator("[data-order-plan-edit]").click();
  await expect(plan.locator("[data-order-plan-body]")).toBeVisible();
});
