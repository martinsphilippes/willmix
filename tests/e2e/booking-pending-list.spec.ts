import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";
import { xlsxBytes } from "../unit/xlsx-fixture";

/*
 * Book: lista de pendências do fechamento (pedido do dono, 14/11/2026).
 * "Fechar e analisar" travado por campos obrigatórios vazios mostra os itens
 * incompletos (nome e código), cada um com os campos que faltam (os nomes da
 * tabela). Tocar num campo leva até ele: a linha aparece (mesmo na outra
 * página ou escondida pela busca), o campo recebe o foco e a célula fica
 * destacada. Gravar uma correção atualiza a lista; sem pendências, o aviso
 * manda fechar de novo, e o fechamento segue.
 */
const TAG = `PL${Date.now().toString(36).toUpperCase()}`;
const SUPPLIER = "Shenzhen Supplier A";
/** Mais de uma página da tabela (15 linhas por página). */
const ROWS = 16;

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

const code = (n: number) => `${TAG}-${String(n).padStart(2, "0")}`;

/** Linha da planilha; `blanks`: colunas que ficam vazias. */
function row(n: number, blanks: string[] = []) {
  const values: Record<string, string> = {
    DATE: "2026.10.13",
    LOCAL: "Yiwu",
    "SUPPLIER NAME": SUPPLIER,
    "SKU/FACTORY ITEM CODE": code(n),
    // Descrição que não casa com produto do cadastro: o NCM fica em aberto.
    DESCRIPTION: `Zqx widget ${TAG} ${n}`,
    "FOB/EXW": "FOB",
    "CONI US $/RMB": "USD",
    PRICE: "1.25",
    "QTY/BOX": "48",
    "QTY/INNER": "12",
    "N.W./PC": "0.3",
    "G.W./PC": "0.35",
    CBM: "0.12",
    "SIZE(CM) LENGTH": "10",
    "SIZE(CM) WIDTH": "8",
    "SIZE(CM) HEIGHT": "20",
    "CAPACITY(ML)": "350",
    PACKAGE: "color box",
    MATERIAL: "glass",
    MOQ: "1000",
    "PURCHASE QTY IN PCS": "3000",
  };
  for (const blank of blanks) values[blank] = "";
  return HEADER.map((h) => values[h]);
}

function sheet() {
  const rows = Array.from({ length: ROWS }, (_, i) => {
    const n = i + 1;
    // Item 2: dois campos vazios; item 16 (na segunda página): um.
    if (n === 2) return row(n, ["PRICE", "N.W./PC"]);
    if (n === ROWS) return row(n, ["MATERIAL"]);
    return row(n);
  });
  return {
    name: `booking-${TAG}.xlsx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(
      xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }]),
    ),
  };
}

/** Id de cada item pelo código (as linhas da outra página estão escondidas, mas na tela). */
async function itemIds(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries(
      Array.from(document.querySelectorAll("tr[data-booking-item]")).map(
        (tr) => [
          (
            tr.querySelector(
              '[data-booking-item-field$=":factoryItemCode"]',
            ) as HTMLInputElement | null
          )?.value ?? "",
          tr.getAttribute("data-booking-item") ?? "",
        ],
      ),
    ),
  );
}

const fieldOf = (page: Page, id: string, field: string) =>
  page.locator(
    field === "ncm"
      ? `[data-booking-item-ncm="${id}"]`
      : `[data-booking-item-field="${id}:${field}"]`,
  );

test("Book: a lista de pendências do fechamento leva a cada campo e se atualiza", async ({
  page,
}) => {
  await login(page, "admin@wellmix.com");
  await page.goto("/app/booking/import");
  await page
    .locator("[data-booking-import-form] input[type=file]")
    .setInputFiles(sheet());
  await page.click("[data-booking-import-submit]");
  await page.waitForURL(/\/app\/booking\/lots\/[^/?]+\?created=1/);
  await expect(page.locator("tr[data-booking-item]")).toHaveCount(ROWS);
  const ids = await itemIds(page);
  const id2 = ids[code(2)];
  const id16 = ids[code(ROWS)];
  expect(id2 && id16).toBeTruthy();

  // Fechar trava: a lista mostra os itens incompletos, com a mesma contagem
  // do "Falta para fechar" (todos sem NCM; o 2 e o 16 com mais campos).
  await page.click("[data-booking-lot-close-submit]");
  await page.waitForURL(/error=booking_items_incomplete/);
  const list = page.locator("[data-booking-pending-list]");
  await expect(list).toBeVisible();
  await expect(list.locator("[data-booking-pending-item]")).toHaveCount(ROWS);
  await expect(page.locator("[data-booking-lot-incomplete]")).toHaveAttribute(
    "data-booking-lot-incomplete",
    String(ROWS),
  );
  await expect(page.getByText(`itens incompletos (${ROWS})`)).toBeVisible();

  // Item identificado pela descrição e pelo código; todos os campos que
  // faltam nele, com os nomes da tabela.
  const item2 = list.locator(`[data-booking-pending-item="${id2}"]`);
  await expect(item2).toContainText(`Zqx widget ${TAG} 2 · ${code(2)}`);
  await expect(item2.locator("[data-booking-pending-field]")).toHaveText([
    "Preço",
    "Peso líq./pç (kg)",
    "NCM",
  ]);
  const link = (id: string, field: string) =>
    list.locator(`[data-booking-pending-field="${id}:${field}"]`);

  // Cada link leva ao campo certo: foco e célula destacada.
  for (const field of ["price", "netWeightPcKg", "ncm"]) {
    await link(id2, field).click();
    const target = fieldOf(page, id2, field);
    await expect(target).toBeFocused();
    await expect(target.locator("xpath=ancestor::td[1]")).toHaveAttribute(
      "data-booking-field-target",
      "",
    );
  }

  // Item na outra página da tabela: a tabela vai até ele.
  const row16 = page.locator(`tr[data-booking-item="${id16}"]`);
  await expect(row16).toBeHidden();
  await link(id16, "material").click();
  await expect(row16).toBeVisible();
  await expect(fieldOf(page, id16, "material")).toBeFocused();
  // Gravar a correção atualiza a lista (o NCM continua faltando).
  await page.keyboard.type("glass");
  await page.keyboard.press("Enter");
  await expect(link(id16, "material")).toHaveCount(0);
  await expect(link(id16, "ncm")).toHaveCount(1);
  await expect(page.locator("[data-booking-lot-incomplete]")).toHaveAttribute(
    "data-booking-lot-incomplete",
    String(ROWS),
  );

  // Item escondido pela busca da tabela: a busca é limpa e o campo abre.
  const search = page.locator("[data-table-search]").first();
  await search.fill(code(5));
  await expect(page.locator(`tr[data-booking-item="${id2}"]`)).toBeHidden();
  await link(id2, "price").click();
  await expect(search).toHaveValue("");
  await expect(fieldOf(page, id2, "price")).toBeFocused();
  await page.keyboard.type("1,25");
  await page.keyboard.press("Enter");
  await expect(link(id2, "price")).toHaveCount(0);
  await link(id2, "netWeightPcKg").click();
  await expect(fieldOf(page, id2, "netWeightPcKg")).toBeFocused();
  await page.keyboard.type("0,3");
  await page.keyboard.press("Enter");
  await expect(link(id2, "netWeightPcKg")).toHaveCount(0);

  // O NCM de cada item, sempre pelo link da lista.
  for (const id of Object.values(ids)) {
    await link(id, "ncm").click();
    await expect(fieldOf(page, id, "ncm")).toBeFocused();
    await page.keyboard.type("7013.37.00");
    await page.keyboard.press("Enter");
    await expect(link(id, "ncm")).toHaveCount(0);
  }

  // Sem pendências: o aviso manda fechar de novo, e o fechamento segue.
  await expect(list).toHaveCount(0);
  await expect(
    page.locator("[data-booking-lot-incomplete-done]"),
  ).toBeVisible();
  await page.click("[data-booking-lot-close-submit]");
  await page.waitForURL(/[?&]closed=1/);
});
