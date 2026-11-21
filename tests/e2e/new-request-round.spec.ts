import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  chooseCustomerLogin,
  createdRequestId,
  editOrderTerms,
  fillCustomerContacts,
  fillOrderTerms,
  login,
} from "./helpers";

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
  await expect(summary).toContainText("CHINA - Porto não informado › Brinquedos");
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
  // Qual preço está na tela (dono, 20/11/2026): o do formato, com frete.
  await expect(
    forecast.locator("[data-price-forecast-price-label]"),
  ).toHaveText("Preço WD - com frete");
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
  // "Exportar JSON" no canto do modal: a resposta da API para o Sankhya.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("[data-price-forecast-audit-export]:visible").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^cotacao-prod-boneca-.*\.json$/,
  );
  const exported = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(exported.function).toBe("FN_AD_ENC_COTACAO_V2_WELL");
  expect(exported.inputs).toEqual({ CODPROD: 1001, VIP: 5 });
  expect(exported.outputs.PRECO_WD_COM_FRETE_REFERENCIA).toBe(11.43);
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

test("Busca por palavras fora de ordem, Enter não envia e a encomenda reaberta para editar", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/new-request/ts");
  await chooseCustomer(page, "loja", "cliente-joao");
  await chooseCustomerLogin(page, "joao@lojista.com");
  await fillOrderTerms(page, { format: "wd", caller: "customer" });

  // Palavras fora de ordem e sem acento acham o produto (dono, 19/11/2026).
  const row = page.locator('[data-request-item="0"]');
  const product = row.locator('[data-product-picker="catalog"]');
  await product
    .locator("[data-product-picker-input]")
    .fill("articulada boneca");
  await product.locator('[data-product-picker-option="prod-boneca"]').click();
  await row
    .locator("[data-rounds-generator] [data-generate-total]")
    .fill("100");
  await fillCustomerContacts(page, "loja-joao");

  // Enter num campo e espaço no botão Enviar não mandam a solicitação.
  await page.locator('input[name="deadline"]').press("Enter");
  const sendButton = page.getByRole("button", { name: /^(Enviar|Send)$/ });
  await sendButton.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  expect(new URL(page.url()).pathname).toBe("/app/new-request/ts");

  // Só o clique envia.
  await sendButton.click();
  const firstId = await createdRequestId(page, { open: false });
  const title = await page.getByRole("heading", { level: 1 }).textContent();

  // Aguardando o cliente: "Editar a encomenda" reabre a tela com os dados.
  await page.locator("[data-request-edit]").click();
  await page.waitForURL(/\/app\/new-request\/ts\?draft=/);
  await expect(page.locator("[data-request-editing]")).toContainText(
    "Editando a encomenda",
  );
  await expect(
    page.locator(
      '[data-request-item="0"] [data-product-picker="catalog"] [data-product-picker-input]',
    ),
  ).toHaveValue(/Boneca/);
  await expect(page.locator("[data-order-terms-collapsed]")).toBeVisible();

  // Enviada de novo: a mesma encomenda (mesmo número e id), no lugar.
  await page.getByRole("button", { name: /^(Enviar|Send)$/ }).click();
  expect(await createdRequestId(page, { open: false })).toBe(firstId);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title!);
});

test("Produto repetido abre a linha que já tem; a aba Análise mostra o produto aberto", async ({
  page,
}) => {
  // O histórico do Sankhya (aqui simulado): sem pedidos na lista e a
  // análise do produto aberto.
  const analysis: string[] = [];
  await page.route("**/api/purchase-history/sankhya?**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("view") === "analysis") {
      analysis.push(url.searchParams.get("product") ?? "");
      return route.fulfill({
        json: {
          state: "ok",
          product: {
            id: "prod-boneca",
            name: "Boneca articulada 30 cm",
            code: 501,
          },
          companies: 3,
          purchases: [],
          years: [
            {
              year: "2026",
              quantity: 600,
              purchases: 2,
              months: [
                { month: "2026-01", quantity: 300, purchases: 1 },
                { month: "2026-04", quantity: 300, purchases: 1 },
              ],
            },
          ],
          estimate: {
            monthly: 100,
            slope: 0,
            intervalMonths: 3,
            used: 1,
            last: { date: "2026-04-01", quantity: 300 },
            runOut: "2026-07-01",
            suggestedDate: "2026-03-01",
            late: true,
            suggestedQuantity: 300,
            months: [{ month: "2026-11", quantity: 100 }],
            years: [{ year: "2026", quantity: 100 }],
          },
          mixedUnits: false,
          money: false,
        },
      });
    }
    return route.fulfill({ json: { state: "ok", orders: [], next: null } });
  });
  await login(page, "admin@wellmix.com");
  await page.goto("/app/new-request/ts");
  await chooseCustomer(page, "loja", "cliente-joao");
  await fillOrderTerms(page);
  const pick = async (index: number) => {
    const product = page.locator(
      `[data-request-item="${index}"] [data-product-picker="catalog"]`,
    );
    await product.locator("[data-product-picker-input]").fill("boneca");
    await product.locator('[data-product-picker-option="prod-boneca"]').click();
  };
  await pick(0);
  // "+ Adicionar outro produto": a linha 1 abre, a 0 recolhe.
  await page.locator("[data-add-request-item]").click();
  await expect(page.locator('[data-request-item="1"]')).toBeVisible();
  await expect(page.locator('[data-request-item="0"]')).toBeHidden();
  // A mesma boneca na linha nova: ela sai e a linha 0 abre para editar.
  await pick(1);
  await expect(page.locator('[data-request-item="1"]')).toHaveCount(0);
  await expect(page.locator('[data-request-item="0"]')).toBeVisible();
  await expect(
    page.locator('[data-request-item="0"] [data-request-item-duplicate]'),
  ).toBeVisible();

  // Aba Análise: o produto aberto, com o grupo, os anos (que abrem nos
  // meses) e a estimativa com a sugestão.
  const history = page.locator("[data-sankhya-history]");
  await history
    .locator('[data-sankhya-history-view-button="analysis"]')
    .click();
  const panel = history.locator('[data-purchase-analysis="ready"]');
  await expect(panel).toContainText("Boneca articulada 30 cm");
  await expect(panel.locator("[data-purchase-analysis-group]")).toContainText(
    "3 empresas",
  );
  expect(analysis.at(-1)).toBe("prod-boneca");
  await expect(panel.locator("[data-purchase-analysis-month]")).toHaveCount(0);
  await panel.locator('[data-purchase-analysis-year-toggle="2026"]').click();
  await expect(panel.locator("[data-purchase-analysis-month]")).toHaveCount(2);
  // Expandir tudo / Recolher tudo (dono, 20/11/2026).
  await expect(
    panel.locator('[data-purchase-analysis-expand-all="collapse"]'),
  ).toBeVisible();
  await panel.locator("[data-purchase-analysis-expand-all]").click();
  await expect(panel.locator("[data-purchase-analysis-month]")).toHaveCount(0);
  await panel.locator("[data-purchase-analysis-expand-all]").click();
  await expect(panel.locator("[data-purchase-analysis-month]")).toHaveCount(2);
  await expect(
    panel.locator("[data-purchase-analysis-suggestion]"),
  ).toContainText("300 peças");
  // "Usar a recomendação": as 300 peças vão para a linha aberta, em caixas
  // inteiras de 48 (7 caixas = 336), na entrega única do pedido.
  await panel.locator("[data-purchase-analysis-use]").click();
  await expect(panel.locator("[data-purchase-analysis-applied]")).toContainText(
    "336 peças",
  );
  await expect(page.locator('input[name="p0.quantity"]')).toHaveValue("336");
  await panel.locator('[data-purchase-analysis-by="year"]').click();
  await expect(
    panel.locator('[data-purchase-analysis-forecast="2026"]'),
  ).toBeVisible();
});
