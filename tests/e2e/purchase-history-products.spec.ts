import { expect, test, type Locator, type Page } from "@playwright/test";
import { login } from "./helpers";

/*
 * Histórico de compras do cliente na Nova solicitação: seletor "Pedido |
 * Produto" no topo do card e, na aba Produto, "Ordenar" (Mais un., Menos
 * un., Maior valor, Menor valor) com as unidades e o valor total de cada
 * produto, um embaixo do outro (dono, 15/11/2026; docs/PURCHASE_HISTORY.md
 * seção 11). O Sankhya não existe no E2E: a rota do portal responde com o
 * que o servidor devolveria (a soma por produto, data e valor é do
 * servidor, testada em tests/unit/sankhya-history-products.test.ts). Aqui, a
 * tela: as visões, as quatro ordens (por unidades é diferente de por valor,
 * e o produto sem valor fica no fim), "Carregar mais pedidos", a troca de
 * cliente, o login sem valores e a coluna estreita do iPad e do celular.
 */
const LOUSA = "LOUSA MAGICA B-FLY SRT COR 16,5CM X 23CM";
const PISTOLA = "PISTOLA LANCA BOLHAS A FRICCAO PEIXE SRT COR";
const APITO = "APITO PLASTICO SORTIDO (SEM PRECO NO SANKHYA)";

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

/**
 * Produtos dos pedidos do João. Por unidades: lousa (120), apito (50),
 * pistola (36), caixa (2 CX + 10 UN). Por valor: pistola (450), caixa (420),
 * lousa (199,20); o apito vem sem valor do Sankhya.
 */
const joaoProducts = (shown: number, money = true) => ({
  state: "ok",
  orders: shown,
  from: shown > 3 ? "2026-07-01" : "2026-08-01",
  to: "2026-09-15",
  complete: true,
  money,
  products: [
    {
      key: "5000",
      code: 5000,
      name: "CAIXA MISTA",
      total: [q("CX", 2), q("UN", 10)],
      value: money ? 420 : null,
      days: [day("2026-09-15", q("CX", 2)), day("2026-08-01", q("UN", 10))],
    },
    {
      key: "2391",
      code: 2391,
      name: LOUSA,
      total: [q("UN", shown > 3 ? 220 : 120)],
      value: money ? (shown > 3 ? 365.2 : 199.2) : null,
      days: [
        // 60 + 24: dois pedidos no mesmo dia.
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
      value: money ? 450 : null,
      days: [day("2026-09-15", q("UN", 36))],
    },
    {
      key: "6000",
      code: 6000,
      name: APITO,
      total: [q("UN", 50)],
      value: null,
      days: [day("2026-08-01", q("UN", 50))],
    },
  ],
});

const JOAO = {
  // Dois pedidos no mesmo dia (15/09) e um em 01/08; mais um ao carregar mais.
  orders: [
    order(1490845, "2026-09-15", 5),
    order(1490844, "2026-09-15"),
    order(1480001, "2026-08-01"),
  ],
  more: [order(1470001, "2026-07-01", 1)],
};
const WELLMIX_SC = {
  orders: [order(2000001, "2026-10-10", 1)],
  products: {
    state: "ok",
    orders: 1,
    from: "2026-10-10",
    to: "2026-10-10",
    complete: true,
    money: true,
    products: [
      {
        key: "7777",
        code: 7777,
        name: "BONECA",
        total: [q("UN", 50)],
        value: 1250,
        days: [day("2026-10-10", q("UN", 50))],
      },
    ],
  },
};

/** Responde a rota do histórico pelo Sankhya e anota o que a tela pediu. */
async function fakeSankhyaRoute(page: Page, money = true) {
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
    else if (view === "products") body = joaoProducts(shown || 3, money);
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

/** Os produtos na ordem da tela (código no Sankhya). */
const orderOf = (history: Locator) =>
  history
    .locator("[data-sankhya-product]")
    .evaluateAll((items) =>
      items.map((i) => i.getAttribute("data-sankhya-product")),
    );

/** Abre a Nova solicitação, escolhe o João e vai para a aba Produto. */
async function openProducts(page: Page) {
  await page.goto("/app/requests/new");
  const history = page.locator("[data-sankhya-history]");
  const picker = page.locator(
    '[data-request-customer] [data-party-picker="customer"]',
  );
  await choose(picker, "loja", "cliente-joao");
  await expect(history.locator("[data-sankhya-history-order]")).toHaveCount(3);
  await history
    .locator('[data-sankhya-history-view-button="products"]')
    .click();
  await expect(history.locator("[data-sankhya-product]")).toHaveCount(4);
  return { history, picker };
}

test("histórico do cliente: Pedido | Produto, Ordenar, unidades e valor", async ({
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
  await expect(history.locator("[data-sankhya-history-order]")).toHaveCount(3);
  await expect(history.locator("[data-sankhya-products]")).toHaveCount(0);

  // Produto direto pelo seletor, sem abrir pedido: os 3 pedidos da lista.
  await productButton.click();
  await expect(productButton).toHaveAttribute("aria-pressed", "true");
  await expect(history.locator("[data-sankhya-history-order]")).toHaveCount(0);
  await expect(history.locator("[data-sankhya-products-period]")).toHaveText(
    "Período consultado: 01/08/2026 a 15/09/2026 (3 pedido(s))",
  );

  // Ordenar: no alto, à direita, acima da lista; "Mais un." por padrão.
  const sort = history.locator("[data-sankhya-products-sort]");
  await expect(sort).toHaveValue("units_desc");
  expect(
    await sort
      .locator("option")
      .evaluateAll((o) => o.map((x) => (x.textContent ?? "").trim())),
  ).toEqual(["Mais un.", "Menos un.", "Maior valor", "Menor valor"]);
  const sortBox = (await sort.boundingBox())!;
  const firstBox = (await history
    .locator("[data-sankhya-product]")
    .first()
    .boundingBox())!;
  expect(sortBox.y + sortBox.height).toBeLessThanOrEqual(firstBox.y);
  // Na mesma linha do "Período consultado" (o alto dos dois alinhado).
  const periodBox = (await history
    .locator("[data-sankhya-products-period]")
    .boundingBox())!;
  const labelBox = (await history
    .locator("[data-sankhya-products-sort-label]")
    .boundingBox())!;
  expect(Math.abs(labelBox.y - periodBox.y)).toBeLessThan(4);
  expect(labelBox.x).toBeGreaterThan(periodBox.x);
  expect(
    firstBox.x + firstBox.width - (sortBox.x + sortBox.width),
  ).toBeLessThan(4);

  // Unidades e valor do período, um embaixo do outro, à direita.
  const lousa = history.locator('[data-sankhya-product="2391"]');
  await expect(lousa.locator("[data-sankhya-product-total]")).toHaveText(
    "120 UN",
  );
  await expect(lousa.locator("[data-sankhya-product-value]")).toHaveText(
    "R$ 199,20",
  );
  await expect(
    history.locator(
      '[data-sankhya-product="5000"] [data-sankhya-product-total]',
    ),
  ).toHaveText("2 CX · 10 UN");
  await expect(
    history.locator(
      '[data-sankhya-product="6000"] [data-sankhya-product-value]',
    ),
  ).toHaveText("—");
  const name = (await lousa.locator("p").first().boundingBox())!;
  const units = (await lousa
    .locator("[data-sankhya-product-total]")
    .boundingBox())!;
  const value = (await lousa
    .locator("[data-sankhya-product-value]")
    .boundingBox())!;
  const box = (await lousa.boundingBox())!;
  expect(Math.abs(name.y - units.y)).toBeLessThan(4);
  expect(value.y).toBeGreaterThanOrEqual(units.y + units.height - 1);
  expect(box.x + box.width - (units.x + units.width)).toBeLessThan(16);
  expect(box.x + box.width - (value.x + value.width)).toBeLessThan(16);
  // Datas da mais recente para a mais antiga; 15/09 soma os dois pedidos.
  expect(await daysOf(lousa)).toEqual(["15/09/2026 84 UN", "01/08/2026 36 UN"]);

  // As quatro ordens: por unidades é diferente de por valor; o apito, sem
  // valor, fica no fim das duas ordens por valor.
  expect(await orderOf(history)).toEqual(["2391", "6000", "2930", "5000"]);
  await sort.selectOption("units_asc");
  expect(await orderOf(history)).toEqual(["5000", "2930", "6000", "2391"]);
  await sort.selectOption("value_desc");
  expect(await orderOf(history)).toEqual(["2930", "5000", "2391", "6000"]);
  await sort.selectOption("value_asc");
  expect(await orderOf(history)).toEqual(["2391", "5000", "2930", "6000"]);
  // As datas de cada produto não mudam com a ordem.
  expect(await daysOf(lousa)).toEqual(["15/09/2026 84 UN", "01/08/2026 36 UN"]);
  expect(asked.filter((a) => a.endsWith("|products|3"))).toHaveLength(1);

  // De volta a Pedido: a lista e a expansão do pedido continuam.
  await orderButton.click();
  const first = history.locator('[data-sankhya-history-order="1490845"]');
  await first.locator("button").first().click();
  await expect(first.locator("[data-purchase-history-item]")).toContainText(
    LOUSA,
  );
  // Produto de novo: a mesma leitura e a mesma ordem.
  await productButton.click();
  await expect(sort).toHaveValue("value_asc");
  expect(await orderOf(history)).toEqual(["2391", "5000", "2930", "6000"]);
  expect(asked.filter((a) => a.includes("|products|"))).toHaveLength(1);

  // Carregar mais pedidos: o período, as unidades e o valor crescem juntos.
  await history.locator("[data-sankhya-products-more]").click();
  await expect(history.locator("[data-sankhya-products-period]")).toHaveText(
    "Período consultado: 01/07/2026 a 15/09/2026 (4 pedido(s))",
  );
  await expect(lousa.locator("[data-sankhya-product-total]")).toHaveText(
    "220 UN",
  );
  await expect(lousa.locator("[data-sankhya-product-value]")).toHaveText(
    "R$ 365,20",
  );
  expect(await daysOf(lousa)).toEqual([
    "15/09/2026 84 UN",
    "01/08/2026 36 UN",
    "01/07/2026 100 UN",
  ]);
  expect(asked).toContain("cliente-joao|products|4");

  // Outro cliente: a aba e a ordem ficam, o conteúdo é o do cliente novo.
  await choose(picker, "wellmix", "wellmix-sc");
  await expect(productButton).toHaveAttribute("aria-pressed", "true");
  const boneca = history.locator('[data-sankhya-product="7777"]');
  await expect(boneca.locator("[data-sankhya-product-total]")).toHaveText(
    "50 UN",
  );
  await expect(boneca.locator("[data-sankhya-product-value]")).toHaveText(
    "R$ 1.250,00",
  );
  expect(await daysOf(boneca)).toEqual(["10/10/2026 50 UN"]);
  await expect(history.locator('[data-sankhya-product="2391"]')).toHaveCount(0);
  await orderButton.click();
  await expect(history.locator("[data-sankhya-history-order]")).toHaveCount(1);
});

test("aba Produto legível na coluna estreita: iPad em pé e deitado e celular", async ({
  page,
}) => {
  await fakeSankhyaRoute(page);
  await login(page, "admin@wellmix.com");
  for (const size of [
    { name: "iPad em pé", width: 820, height: 1180 },
    { name: "iPad deitado", width: 1180, height: 820 },
    { name: "celular", width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const { history } = await openProducts(page);
    await history
      .locator("[data-sankhya-products-sort]")
      .selectOption("value_desc");
    const layout = await history.evaluate((card) => {
      const inside = (el: Element, box: DOMRect) => {
        const r = el.getBoundingClientRect();
        return r.left >= box.left - 1 && r.right <= box.right + 1;
      };
      const cardBox = card.getBoundingClientRect();
      const sort = card.querySelector("[data-sankhya-products-sort]")!;
      const label = card
        .querySelector("[data-sankhya-products-sort-label]")!
        .getBoundingClientRect();
      const period = card
        .querySelector("[data-sankhya-products-period]")!
        .getBoundingClientRect();
      const products = [...card.querySelectorAll("[data-sankhya-product]")];
      return {
        // Nada passa da tela nem do card; os totais e o seletor inteiros.
        pageScroll: document.documentElement.scrollWidth <= window.innerWidth,
        sortInside: inside(sort, cardBox),
        // Ao lado do período, no canto superior direito.
        sortBesidePeriod:
          Math.abs(label.top - period.top) < 4 && label.left > period.left,
        sortReadable:
          (sort as HTMLSelectElement).scrollWidth <=
          (sort as HTMLSelectElement).clientWidth + 1,
        totalsInside: products.every((p) => {
          const box = p.getBoundingClientRect();
          return [
            ...p.querySelectorAll(
              "[data-sankhya-product-total], [data-sankhya-product-value]",
            ),
          ].every((t) => inside(t, box) && t.scrollWidth <= t.clientWidth + 1);
        }),
        firstValue: products[0]
          .querySelector("[data-sankhya-product-value]")
          // O espaço depois de "R$" é o que não quebra a linha.
          ?.textContent?.replace(/\s+/g, " ")
          .trim(),
      };
    });
    expect(layout, size.name).toEqual({
      pageScroll: true,
      sortInside: true,
      sortBesidePeriod: true,
      sortReadable: true,
      totalsInside: true,
      firstValue: "R$ 450,00",
    });
  }
});

test('sem "Ver valores e margem": só as ordens por unidades e o valor com "—"', async ({
  page,
}) => {
  await fakeSankhyaRoute(page, false);
  await login(page, "operador@wellmix.com");
  const { history } = await openProducts(page);
  const sort = history.locator("[data-sankhya-products-sort]");
  expect(
    await sort
      .locator("option")
      .evaluateAll((o) => o.map((x) => (x.textContent ?? "").trim())),
  ).toEqual(["Mais un.", "Menos un."]);
  await expect(
    history.locator("[data-sankhya-product-value]").first(),
  ).toHaveText("—");
  expect(await orderOf(history)).toEqual(["2391", "6000", "2930", "5000"]);
});
