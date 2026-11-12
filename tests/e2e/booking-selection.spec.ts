import { expect, test, type Page } from "@playwright/test";
import { xlsxBytes } from "../unit/xlsx-fixture";

/*
 * Seleção de itens, abas Itens e Seleção (docs/SUPPLIER_REQUESTS.md): o
 * rascunho aparece (sem poder abrir a solicitação), os filtros de status,
 * fornecedor e período (calendário de intervalo) mudam a lista, a cesta
 * marca todos os da tela e "Agrupar" leva para a comparação; a aba Seleção
 * sugere o bloco dos itens parecidos de vários fornecedores.
 */

const PASSWORD = "wellmix123";
const TAG = `SEL${Date.now().toString(36).toUpperCase()}`;

const HEADER = [
  "DATE",
  "LOCAL",
  "SUPPLIER NAME",
  "SKU/FACTORY ITEM CODE",
  "DESCRIPTION",
  "FOB/EXW",
  "CONI US $/RMB",
  "PRICE",
  "QTY/BOX",
  "QTY/INNER",
  "N.W./PC",
  "G.W./PC",
  "CBM",
  "SIZE(CM) LENGTH",
  "SIZE(CM) WIDTH",
  "SIZE(CM) HEIGHT",
  "CAPACITY(ML)",
  "PACKAGE",
  "MATERIAL",
  "MOQ",
  "PURCHASE QTY IN PCS",
];

/** Planilha de booking de um fornecedor do cadastro de demonstração, com um item. */
function sheet(supplier: string, code: string, description: string) {
  const row = [
    "2026.10.13",
    "Yiwu",
    supplier,
    code,
    description,
    "FOB",
    "USD",
    "1.25",
    "48",
    "12",
    "0.3",
    "0.35",
    "0.12",
    "10",
    "8",
    "20",
    "350",
    "color box",
    "glass",
    "1000",
    "3000",
  ];
  return {
    name: `booking-${code}.xlsx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(xlsxBytes([{ name: "BOOKING", cells: [HEADER, row] }])),
  };
}

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/e-mail|email|邮箱/i).fill(email);
  await page.getByLabel(/senha|password|密码/i).fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|sign in|登录/i }).click();
  await page.waitForURL(/\/app/);
}

/** Sobe a planilha e fecha o booking (fornecedor e data vêm dela). */
async function importAndClose(
  page: Page,
  file: ReturnType<typeof sheet>,
  supplierName: string,
) {
  await page.goto("/app/booking/import");
  await page
    .locator("[data-booking-import-form] input[type=file]")
    .setInputFiles(file);
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  // Fornecedor do cadastro (tem login): nenhum aviso de "sem acesso".
  await expect(page.locator("[data-supplier-no-login]")).toHaveCount(0);
  // Fornecedor com busca: digitar filtra a lista até sobrar o que se quer.
  const combo = page.locator(
    "[data-booking-lot-supplier] input[role=combobox]",
  );
  await expect(combo).toHaveValue(new RegExp(supplierName));
  await combo.click();
  await combo.fill(supplierName.toLowerCase().split(" ").slice(0, 2).join(" "));
  const options = page.locator("[data-booking-lot-supplier] [role=option]");
  await expect(options.first()).toContainText(supplierName);
  await combo.fill("zzz-nada-casa");
  await expect(options).toHaveCount(0);
  await combo.press("Escape");
  await expect(combo).toHaveValue(new RegExp(supplierName));
  // Trocar e voltar: cada escolha grava sozinha.
  await combo.click();
  await options.first().click();
  await expect(
    page.locator('[data-booking-lot-supplier] [data-booking-row-note="saved"]'),
  ).toBeVisible();
  await combo.click();
  await combo.fill(supplierName);
  await options.filter({ hasText: supplierName }).first().click();
  await expect(combo).toHaveValue(new RegExp(supplierName));
  await expect(
    page.locator('[data-booking-lot-supplier] [data-booking-row-note="saved"]'),
  ).toBeVisible();
  // NCM obrigatório (docs/BOOKING.md, "NCM do item"): sem produto parecido
  // no cadastro, o item fica com o despachante; a Wellmix preenche aqui.
  const ncmInputs = page.locator("input[data-booking-item-ncm]");
  for (let i = 0; i < (await ncmInputs.count()); i++) {
    const input = ncmInputs.nth(i);
    if (await input.inputValue()) continue;
    await input.fill("7013.37.00");
    await input.press("Enter");
    await expect(
      page.locator('[data-booking-row-note="saved"]').nth(i),
    ).toBeVisible();
  }
  await page.click("[data-booking-lot-close-submit]");
  await page.waitForURL(/[?&]closed=1/);
  await expect(page.locator("[data-booking-item-analysis]")).toHaveCount(1);
}

async function importDraft(page: Page, file: ReturnType<typeof sheet>) {
  await page.goto("/app/booking/import");
  await page
    .locator("[data-booking-import-form] input[type=file]")
    .setInputFiles(file);
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  // Sem NCM: "Estimar o NCM de novo" refaz a aproximação e avisa o resultado.
  // Com bookings de execuções anteriores (DATA_DIR reaproveitado), o item já
  // nasce com o NCM do parecido e o botão não aparece: aí todos têm NCM.
  const reclassify = page.locator("[data-booking-lot-ncm-reclassify]");
  if (await reclassify.count()) {
    await reclassify.locator("button[type=submit]").click();
    await page.waitForURL(/ncmMatched=\d+&ncmLeft=\d+/);
  } else {
    const ncm = page.locator("input[data-booking-item-ncm]");
    for (let i = 0; i < (await ncm.count()); i++)
      await expect(ncm.nth(i)).not.toHaveValue("");
  }
}

test("seleção: rascunho, filtros, período, cesta, agrupar e blocos", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await importAndClose(
    page,
    sheet("Shenzhen Supplier A", `${TAG}-A`, `Glass cup ${TAG} 350ml`),
    "Shenzhen Supplier A",
  );
  await importAndClose(
    page,
    sheet("Guangzhou Supplier B", `${TAG}-B`, `Glass cup ${TAG} with handle`),
    "Guangzhou Supplier B",
  );
  await importDraft(
    page,
    sheet("Guangzhou Supplier B", `${TAG}-C`, `Glass cup ${TAG} draft`),
  );

  // 1. Itens: o rascunho entra, sem poder ser o escolhido.
  const base = `/app/booking/selection?q=${TAG}`;
  await page.goto(base);
  const rows = page.locator("[data-selection-item]");
  await expect(rows).toHaveCount(3);
  const draftRow = rows.filter({ hasText: `${TAG}-C` });
  await expect(
    draftRow.locator('[data-selection-lot-status="draft"]'),
  ).toBeVisible();
  // Os fechados mostram o custo por peça do Superplan (R$), com a explicação.
  await expect(page.locator("[data-selection-cost-hint]")).toBeVisible();
  for (const code of [`${TAG}-A`, `${TAG}-B`])
    await expect(
      rows.filter({ hasText: code }).locator("[data-selection-cost]"),
    ).toContainText("R$");
  // A aba Itens só agrupa: sem escolher nem abrir solicitação.
  await expect(page.locator("[data-selection-choose]")).toHaveCount(0);
  await expect(page.locator("[data-selection-submit]")).toHaveCount(0);

  // 2. Filtro de status: sem o rascunho, sobram os dois fechados.
  await page.locator('[data-selection-filter-status="draft"]').uncheck();
  await expect(rows).toHaveCount(2);
  await page.goto(base);

  // 3. Fornecedor: só os do B (o fechado e o rascunho). O envio automático
  // dos filtros só liga com a página pronta: mexer antes não filtrava (era a
  // causa de este passo falhar de vez em quando).
  await page.locator("[data-auto-submit-ready]").waitFor({ state: "attached" });
  const supplierSelect = page.locator("[data-selection-filter-supplier]");
  const optionB = supplierSelect.locator("option", {
    hasText: "Guangzhou Supplier B",
  });
  await supplierSelect.selectOption(
    (await optionB.first().getAttribute("value"))!,
  );
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: `${TAG}-A` })).toHaveCount(0);

  // 4. Período: a data das planilhas é 13/10/2026.
  await page.goto(`${base}&from=2026-10-01&to=2026-10-31`);
  await expect(rows).toHaveCount(3);
  await page.goto(`${base}&from=2026-11-01&to=2026-11-30`);
  await expect(rows).toHaveCount(0);
  // Calendário: dois cliques marcam o intervalo e "Aplicar" filtra.
  await page.goto(`${base}&from=2026-10-01&to=2026-10-31`);
  await page.click("[data-date-range-toggle]");
  await page.click('[data-range-day="2026-10-10"]');
  await page.click('[data-range-day="2026-10-20"]');
  await page.click("[data-date-range-apply]");
  await page.waitForURL(/from=2026-10-10&to=2026-10-20/);
  await expect(rows).toHaveCount(3);

  // 5. Cesta: todos os da tela, agrupar e comparar.
  await page.goto(base);
  await page.locator("input[data-basket-all]").check();
  await expect(page.locator("[data-selection-basket]")).toHaveAttribute(
    "data-selection-basket",
    "3",
  );
  await page.click("[data-selection-group]");
  await page.waitForURL(/tab=selection&ids=/);
  await expect(page.locator("[data-selection-group-view]")).toHaveAttribute(
    "data-selection-group-view",
    "3",
  );
  // No grupo (aba Seleção) é que se escolhe; o item de rascunho não pode.
  await expect(
    page
      .locator("[data-selection-item]", { hasText: `${TAG}-C` })
      .locator("[data-selection-choose]"),
  ).toBeDisabled();
  await expect(page.locator("[data-selection-submit]")).toBeVisible();
  await expect(page.locator("[data-selection-item]")).toHaveCount(3);
  // Ao lado do bloco, os três prompts de IA com os padrões das Configurações.
  await expect(page.locator("[data-ai-prompt]")).toHaveCount(3);
  await expect(page.locator('[data-ai-prompt="product"]')).not.toHaveValue("");

  // 6. Seleção: o bloco sugerido junta os três copos de dois fornecedores.
  await page.goto(`${base}&tab=selection`);
  const block = page.locator("[data-selection-block]").first();
  await expect(block).toHaveAttribute("data-selection-block", "3");
  await expect(block).toContainText("2");
  await block.locator("[data-selection-block-open]").click();
  await page.waitForURL(/ids=/);
  await expect(page.locator("[data-selection-item]")).toHaveCount(3);
});
