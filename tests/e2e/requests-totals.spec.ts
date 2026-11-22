import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Totais de Encomendas (dono, 18/11/2026; docs/ORDER_LEVEL_LISTS.md, seção
 * 5): Nº → Cliente → Produtos → Preço total → MOQ total (UN) → Peças total
 * (UN) → Caixas master total → Inner total (CX) → CBM total (m³) → Situação,
 * com "Total parcial" quando falta o dado de algum produto e "—" quando
 * nenhum tem. A página da encomenda e o CSV dão os mesmos números.
 *
 * O lote: a boneca (48 por caixa, 6 por inner, 0,1202 m³, mínimo 2.000) em
 * 3 × 15 caixas, a piscina (6 por caixa, sem inner, 0,12 m³, mínimo 300) em
 * 3 × 20 caixas (produto do catálogo com caixa: a tela pede caixas inteiras
 * por programação) e um copo fora do catálogo (sem nada) em 3 × 100 peças.
 *   Peças: 3 × 720 + 3 × 120 + 300 = 2.820.
 *   Caixas: 45 + 60 = 105, parcial (o copo).
 *   Inner: boneca 3 × 120 = 360, parcial (piscina e copo).
 *   CBM: 45 × 0,1202 + 60 × 0,12 = 5,409 + 7,2 = 12,609, parcial.
 *   MOQ: 2.000 + 300 = 2.300, parcial (o copo não tem mínimo).
 * O arredondamento das caixas por programação (caixa incompleta) está nos
 * testes unitários (tests/unit/request-totals.test.ts).
 */
const TAG = `TOT${Date.now().toString(36).toUpperCase()}`;

async function pickCatalog(
  page: Page,
  index: number,
  term: string,
  id: string,
) {
  const row = page.locator(`[data-request-item="${index}"]`);
  const picker = row.locator('[data-product-picker="catalog"]');
  await picker.locator("[data-product-picker-input]").fill(term);
  await picker.locator(`[data-product-picker-option="${id}"]`).click();
  await expect(row.locator('[role="status"]').first()).toBeVisible();
}

async function fillRounds(page: Page, index: number, quantities: number[]) {
  for (const [i, q] of quantities.entries())
    await page.fill(`input[name="p${index}.schedule.qty.${i + 1}"]`, String(q));
  await expect(page.locator(`input[name="p${index}.quantity"]`)).toHaveValue(
    String(quantities.reduce((a, b) => a + b, 0)),
  );
}

/** Produto com caixa no cadastro: a programação é digitada em caixas. */
async function fillCartons(
  page: Page,
  index: number,
  cartons: number[],
  perBox: number,
) {
  const row = page.locator(`[data-request-item="${index}"]`);
  for (const [i, n] of cartons.entries())
    await row.locator(`[data-schedule-cartons="${i + 1}"]`).fill(String(n));
  await expect(page.locator(`input[name="p${index}.quantity"]`)).toHaveValue(
    String(cartons.reduce((a, b) => a + b, 0) * perBox),
  );
}

async function sendMix(page: Page) {
  await page.goto("/app/requests/new");
  await pickCatalog(page, 0, "boneca", "prod-boneca");
  const planCount = page.locator("[data-order-plan-count]");
  await planCount.fill("3");
  await planCount.blur();
  await page.click('[data-order-plan-interval="30"]');
  await expect(
    page.locator('[data-request-item="0"] [data-schedule-item]'),
  ).toHaveCount(3);
  await fillCartons(page, 0, [15, 15, 15], 48);
  await page.click("[data-add-request-item]");
  await pickCatalog(page, 1, "piscina", "prod-piscina");
  await fillCartons(page, 1, [20, 20, 20], 6);
  await page.click("[data-add-request-item]");
  await page.check('[data-request-item="2"] input[name="p2.sourcingDemand"]');
  await page.fill('input[name="p2.productName"]', `Copo de vidro ${TAG}`);
  await page.fill('textarea[name="p2.description"]', "Copo de vidro 300 ml");
  await fillRounds(page, 2, [100, 100, 100]);
  await page.getByRole("button", { name: /enviar|send/i }).click();
  await page.waitForURL(/\/app\/requests\/batch\/[^?]+\?created=3$/);
  return new URL(page.url()).pathname;
}

const headerTitles = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-table-tools] thead th"), (th) =>
      (th.textContent ?? "").replace(/\s+/g, " ").trim(),
    ),
  );

test("Encomendas: totais na lista, na página da encomenda e no CSV", async ({
  page,
}) => {
  await login(page, "joao@lojista.com");
  const path = await sendMix(page);

  // Página da encomenda, pelo cliente: os totais, sem MOQ nem preço.
  const box = (key: string) =>
    page.locator(`[data-batch-total="${key}"] [data-request-total]`);
  await expect(page.locator("[data-batch-total]")).toHaveCount(4);
  await expect(box("pieces")).toHaveText("2.820");
  await expect(box("boxes")).toContainText("105");
  await expect(box("boxes")).toContainText("Total parcial");

  // A lista da Wellmix: as colunas novas, na ordem pedida.
  await login(page, "admin@wellmix.com");
  await page.goto("/app/requests");
  const titles = await headerTitles(page);
  // Tabela padrão no nível do pedido (dono, 22/11/2026;
  // docs/ORDER_TABLES.md), na ordem do dono. Peças, Master, Inner,
  // Cont./prog., Analista e MOQ saíram da lista (seguem na página e no CSV).
  const order = [
    "Nº do pedido",
    "Data negociação",
    "Tipo de venda",
    "Prazo pgto.",
    "Forma pgto.",
    "Faturamento",
    "VIP",
    "Grupo econômico",
    "Cliente nº",
    "Cliente nome",
    "Status",
    "Situação",
    "Prazo resposta",
    "Itens",
    "Entregas",
    "Total CBM (m³)",
    "Valor total",
    "Fornecedor",
  ].map((title) => titles.findIndex((t) => t === title));
  expect(order.every((i) => i >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  for (const gone of ["Peças", "Master", "Inner", "Cont./prog.", "Analista"])
    expect(titles.some((t) => t.startsWith(gone))).toBe(false);
  expect(titles.some((t) => t.startsWith("MOQ"))).toBe(false);

  const row = page.locator(`[data-batch-row]:has(a[href="${path}"])`);
  await expect(row).toHaveCount(1);
  const total = (key: string) => row.locator(`[data-request-total="${key}"]`);
  // Peças, caixas e inner saíram da lista; ficam na página do pedido.
  for (const gone of ["pieces", "boxes", "inner"])
    await expect(total(gone)).toHaveCount(0);
  await expect(total("cbm")).toContainText("12,609");
  await expect(total("cbm")).toHaveAttribute("data-total-value", "12.609");
  await expect(total("moq")).toHaveCount(0);
  // Sem previsão de venda gravada (o cliente lançou pela tela dele): "—".
  await expect(total("price")).toHaveText("—");
  await expect(total("price")).toHaveAttribute("data-total-empty", "");
  // Ordenação numérica: o texto de ordem é o número com ponto.
  await expect(row.locator('td[data-sort="12.609000"]')).toHaveCount(1);

  // A página da encomenda dá os mesmos números, produto a produto.
  await row.locator("a[data-request-open]").click();
  await page.waitForURL(new RegExp(`${path}$`));
  await expect(page.locator("[data-batch-total]")).toHaveCount(6);
  await expect(box("pieces")).toHaveText("2.820");
  await expect(box("boxes")).toHaveAttribute("data-total-value", "105");
  await expect(box("inner")).toHaveAttribute("data-total-value", "360");
  await expect(box("cbm")).toHaveAttribute("data-total-value", "12.609");
  await expect(box("moq")).toHaveAttribute("data-total-value", "2300");
  const item = (name: RegExp) =>
    page.locator("[data-batch-item]").filter({ hasText: name });
  const doll = item(/Boneca/);
  await expect(doll.locator("[data-batch-per-box]")).toHaveText("48");
  await expect(doll.locator("[data-batch-pieces]")).toHaveText("2.160");
  await expect(doll.locator("[data-batch-boxes]")).toHaveText("45");
  // Peças por inner (a tabela padrão de itens mostra a inner, não as caixas).
  await expect(doll.locator("[data-batch-per-inner]")).not.toHaveText("—");
  await expect(doll.locator("[data-batch-cbm]")).toHaveText("5,409");
  // MOQ saiu da tabela de itens (segue no total e na ficha do produto).
  await expect(doll.locator("[data-batch-moq]")).toHaveCount(0);
  const pool = item(/Piscina/);
  await expect(pool.locator("[data-batch-boxes]")).toHaveText("60");
  await expect(pool.locator("[data-batch-per-inner]")).toHaveText("—");
  const cup = item(new RegExp(TAG));
  await expect(cup.locator("[data-batch-boxes]")).toHaveText("—");
  await expect(cup.locator("[data-batch-cbm]")).toHaveText("—");

  // CSV: as colunas no fim, com os valores de cada produto (vírgula decimal).
  const csv = await (await page.request.get("/app/requests/export")).text();
  const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
  expect(lines[0]).toMatch(
    /;Marco;Peças \(UN\);Caixas master;Inner \(CX\);CBM \(m³\);MOQ \(UN\);Preço previsto \(R\$\)$/,
  );
  expect(lines.some((l) => l.includes(TAG) && l.endsWith(";300;;;;;"))).toBe(
    true,
  );
  expect(lines.some((l) => l.endsWith(";2160;45;360;5,409;2000;"))).toBe(true);
  expect(lines.some((l) => l.endsWith(";360;60;;7,2;300;"))).toBe(true);

  // O cliente na lista dele: sem Preço total e sem MOQ total.
  await login(page, "joao@lojista.com");
  await page.goto("/app/requests");
  const own = await headerTitles(page);
  expect(own.some((t) => t.startsWith("Valor"))).toBe(false);
  expect(own.some((t) => t.startsWith("MOQ"))).toBe(false);
  // Quem é de fora não vê as colunas internas (cliente, VIP, grupo,
  // fornecedor, situação do passo).
  for (const hidden of ["VIP", "Grupo econômico", "Cliente", "Fornecedor"])
    expect(own.some((t) => t.startsWith(hidden))).toBe(false);
  expect(own).toContain("Status");
  expect(own).toContain("Entregas");
  const ownRow = page.locator(`tr:has(a[href="${path}"])`).first();
  await expect(ownRow.locator('[data-request-total="cbm"]')).toContainText(
    "12,609",
  );

  // iPad (deitado e em pé): a página não rola de lado; só a tabela.
  for (const size of [
    { width: 1180, height: 820 },
    { width: 820, height: 1180 },
  ]) {
    await login(page, "admin@wellmix.com");
    await page.setViewportSize(size);
    await page.goto("/app/requests");
    await expect(
      page.locator(`[data-batch-row]:has(a[href="${path}"])`),
    ).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
