import { expect, test, type Locator, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Histórico de compras do cliente na Nova solicitação: seletor "Pedido |
 * Produto" no topo do card (dono, 15/11/2026; docs/PURCHASE_HISTORY.md seção
 * 11). O Sankhya não existe no E2E: a rota do portal responde com o que o
 * servidor devolveria (a soma por produto e por data é do servidor, testada
 * em tests/unit/sankhya-history-products.test.ts). Aqui, a tela: Pedido por
 * padrão, Produto sem abrir pedido, os totais e as datas, a volta para
 * Pedido com a expansão, "Carregar mais pedidos" e a troca de cliente.
 */
const LOUSA = "LOUSA MAGICA B-FLY SRT COR 16,5CM X 23CM";
const PISTOLA = "PISTOLA LANCA BOLHAS A FRICCAO PEIXE SRT COR";

const order = (nunota: number, date: string, items = 2) => ({
  nunota,
  numnota: null,
  date,
  company: 3,
  top: 3,
  topName: "PED VENDA - WMS",
  pending: false,
  status: "L",
  totalBrl: 561.86,
  items,
});
const q = (unit: string, quantity: number) => ({ unit, quantity });
const day = (date: string, ...quantities: ReturnType<typeof q>[]) => ({
  date,
  quantities,
});

/** O que a rota devolve, por cliente e pedido (o Sankhya de mentira). */
const JOAO = {
  // Dois pedidos no mesmo dia (15/09) e um em 01/08; mais um ao carregar mais.
  orders: [
    order(1490845, "2026-09-15", 5),
    order(1490844, "2026-09-15"),
    order(1480001, "2026-08-01"),
  ],
  more: [order(1470001, "2026-07-01", 1)],
  products: (shown: number) => ({
    state: "ok",
    orders: shown,
    from: shown > 3 ? "2026-07-01" : "2026-08-01",
    to: "2026-09-15",
    complete: true,
    products: [
      {
        key: "5000",
        code: 5000,
        name: "CAIXA MISTA",
        total: [q("CX", 2), q("UN", 10)],
        days: [day("2026-09-15", q("CX", 2)), day("2026-08-01", q("UN", 10))],
      },
      {
        key: "2391",
        code: 2391,
        name: LOUSA,
        total: [q("UN", shown > 3 ? 220 : 120)],
        days: [
          day("2026-09-15", q("UN", 84)),
          day("2026-08-01", q("UN", 36)),
          ...(shown > 3 ? [day("2026-07-01", q("UN", 100))] : []),
        ],
      },
      {
        key: "2930",
        code: 2930,
        name: PISTOLA,
        total: [q("UN", 36)],
        days: [day("2026-09-15", q("UN", 36))],
      },
    ],
  }),
};
const WELLMIX_SC = {
  orders: [order(2000001, "2026-10-10", 1)],
  products: {
    state: "ok",
    orders: 1,
    from: "2026-10-10",
    to: "2026-10-10",
    complete: true,
    products: [
      {
        key: "7777",
        code: 7777,
        name: "BONECA",
        total: [q("UN", 50)],
        days: [day("2026-10-10", q("UN", 50))],
      },
    ],
  },
};

/** Responde a rota do histórico pelo Sankhya e anota o que a tela pediu. */
async function fakeSankhyaRoute(page: Page) {
  const asked: string[] = [];
  await page.route("**/api/purchase-history/sankhya?**", async (route) => {
    const url = new URL(route.request().url());
    const customer = url.searchParams.get("customer");
    const view = url.searchParams.get("view");
    const shown = Number(url.searchParams.get("shown") ?? 0);
    const nunota = url.searchParams.get("nunota");
    asked.push(`${customer}|${view ?? (nunota ? "items" : "orders")}|${shown}`);
    let body: unknown;
    if (customer === "wellmix-sc")
      body =
        view === "products"
          ? WELLMIX_SC.products
          : { state: "ok", orders: WELLMIX_SC.orders, next: null };
    else if (view === "products") body = JOAO.products(shown || 3);
    else if (nunota)
      body = {
        state: "ok",
        items: [
          {
            sequence: 1,
            code: 2391,
            name: LOUSA,
            reference: "7899527105915",
            supplierReference: "WBY3557",
            ncm: "95030099",
            unit: "UN",
            quantity: 60,
            delivered: 0,
            pending: true,
            unitPriceBrl: 6.22,
            discountBrl: 273.69,
            unitNetBrl: 1.66,
            totalNetBrl: 99.51,
            container: null,
          },
        ],
      };
    else
      body =
        shown >= 3
          ? { state: "ok", orders: JOAO.more, next: null }
          : { state: "ok", orders: JOAO.orders, next: 3 };
    await route.fulfill({ json: body });
  });
  return asked;
}

async function choose(picker: Locator, text: string, value: string) {
  await picker.locator("[data-party-picker-input]").fill(text);
  const option = picker.locator(`[data-party-picker-option="${value}"]`);
  await expect(option).toBeVisible();
  await option.click();
}

/** Texto de cada data do produto, na ordem da tela. */
const daysOf = (product: Locator) =>
  product.locator("[data-sankhya-product-day]").evaluateAll((rows) =>
    // A data e a quantidade, cada uma num lado da linha.
    rows.map((r) =>
      [...r.children].map((c) => (c.textContent ?? "").trim()).join(" "),
    ),
  );

test("histórico do cliente: seletor Pedido | Produto, totais por data e troca de cliente", async ({
  page,
}) => {
  const asked = await fakeSankhyaRoute(page);
  await login(page, "admin@wellmix.com");
  await page.goto("/app/requests/new");
  const history = page.locator("[data-sankhya-history]");
  const picker = page.locator(
    '[data-request-customer] [data-party-picker="customer"]',
  );
  await choose(picker, "loja", "cliente-joao");

  // Pedido por padrão: a lista de sempre, com a expansão.
  const orderButton = history.locator(
    '[data-sankhya-history-view-button="orders"]',
  );
  const productButton = history.locator(
    '[data-sankhya-history-view-button="products"]',
  );
  await expect(orderButton).toHaveAttribute("aria-pressed", "true");
  await expect(productButton).toHaveAttribute("aria-pressed", "false");
  await expect(history.locator("[data-sankhya-history-order]")).toHaveCount(3);
  await expect(history.locator("[data-sankhya-products]")).toHaveCount(0);

  // Produto direto pelo seletor, sem abrir pedido: os 3 pedidos da lista.
  await productButton.click();
  await expect(productButton).toHaveAttribute("aria-pressed", "true");
  await expect(history.locator("[data-sankhya-history-order]")).toHaveCount(0);
  await expect(history.locator("[data-sankhya-products-period]")).toHaveText(
    "Período consultado: 01/08/2026 a 15/09/2026 (3 pedido(s))",
  );
  const lousa = history.locator('[data-sankhya-product="2391"]');
  await expect(lousa).toContainText(LOUSA);
  await expect(lousa).toContainText("Código no Sankhya: 2391");
  await expect(lousa.locator("[data-sankhya-product-total]")).toHaveText(
    "Total 120 UN",
  );
  // Da data mais recente para a mais antiga; 15/09 já soma os dois pedidos.
  expect(await daysOf(lousa)).toEqual(["15/09/2026 84 UN", "01/08/2026 36 UN"]);
  // Nome à esquerda e o total à direita, na mesma linha.
  const name = await lousa.locator("p").first().boundingBox();
  const total = await lousa
    .locator("[data-sankhya-product-total]")
    .boundingBox();
  const box = await lousa.boundingBox();
  expect(name && total && box).toBeTruthy();
  expect(Math.abs(name!.y - total!.y)).toBeLessThan(4);
  expect(total!.x).toBeGreaterThan(name!.x);
  expect(box!.x + box!.width - (total!.x + total!.width)).toBeLessThan(16);
  // Unidades do Sankhya: CX e UN não se somam.
  await expect(
    history.locator(
      '[data-sankhya-product="5000"] [data-sankhya-product-total]',
    ),
  ).toHaveText("Total 2 CX · 10 UN");
  expect(asked.filter((a) => a.endsWith("|products|3"))).toHaveLength(1);

  // De volta a Pedido: a lista e a expansão do pedido continuam.
  await orderButton.click();
  const first = history.locator('[data-sankhya-history-order="1490845"]');
  await first.locator("button").first().click();
  await expect(first.locator("[data-purchase-history-item]")).toContainText(
    LOUSA,
  );
  // Produto de novo: a mesma leitura, sem consultar outra vez.
  await productButton.click();
  await expect(lousa.locator("[data-sankhya-product-total]")).toHaveText(
    "Total 120 UN",
  );
  expect(asked.filter((a) => a.includes("|products|"))).toHaveLength(1);

  // Carregar mais pedidos: o período e os totais crescem juntos.
  await history.locator("[data-sankhya-products-more]").click();
  await expect(history.locator("[data-sankhya-products-period]")).toHaveText(
    "Período consultado: 01/07/2026 a 15/09/2026 (4 pedido(s))",
  );
  await expect(lousa.locator("[data-sankhya-product-total]")).toHaveText(
    "Total 220 UN",
  );
  expect(await daysOf(lousa)).toEqual([
    "15/09/2026 84 UN",
    "01/08/2026 36 UN",
    "01/07/2026 100 UN",
  ]);
  expect(asked).toContain("cliente-joao|products|4");

  // Outro cliente: a visão Produto fica e mostra o histórico dele.
  await choose(picker, "wellmix", "wellmix-sc");
  await expect(productButton).toHaveAttribute("aria-pressed", "true");
  const boneca = history.locator('[data-sankhya-product="7777"]');
  await expect(boneca.locator("[data-sankhya-product-total]")).toHaveText(
    "Total 50 UN",
  );
  expect(await daysOf(boneca)).toEqual(["10/10/2026 50 UN"]);
  await expect(history.locator('[data-sankhya-product="2391"]')).toHaveCount(0);
  // E a visão Pedido também é a do cliente novo.
  await orderButton.click();
  await expect(history.locator("[data-sankhya-history-order]")).toHaveCount(1);
  await expect(
    history.locator('[data-sankhya-history-order="2000001"]'),
  ).toBeVisible();
});
