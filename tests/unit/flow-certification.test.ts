import { beforeAll, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Pedido → Certificação (dono, 14/11/2026; docs/FLOW_MENU.md): a tela do
 * passo é só a lista, sem os cartões por pedido embaixo; cada produto do
 * pedido tem a sua linha (o certificado é de cada produto), os contadores
 * contam as mesmas linhas, e o "Resolver" abre o detalhe do pedido no passo
 * já no produto da linha, com o envio do arquivo para quem pode enviar.
 */
withTempStore();
const { approveSample } = await import("./helpers/sampling");

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
const svc = await import("@/lib/services/supplier-requests");
const product = await import("@/lib/services/supplier-request-product");
const po = await import("@/lib/services/purchase-order");
const flowSvc = await import("@/lib/services/flow");
const flow = await import("@/lib/flow");
const { translator } = await import("@/i18n");
const { FlowOrderInStep } = await import("@/components/flow-order-step");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

const CERT = flow.findStep("order", "certification")!;
const ART = flow.findStep("order", "art")!;
const ART_MATERIAL = flow.findStep("order", "art-material")!;

let admin: User;
let supplierA: User;
/** Fornecedor de outra empresa (não é o do pedido). */
let supplierB: User;
let ocp: User;

const HEADER = [
  "SUPPLIER NAME",
  "DATE",
  "SKU",
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
const row = (sku: string) => [
  "Shenzhen Supplier A",
  "2026.10.13",
  sku,
  `Glass jar ${sku}`,
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

/** Pedido de compra com dois produtos de uma linha que exige o Inmetro. */
async function certifiedOrder(codes: [string, string]): Promise<Order> {
  const store = getStore();
  const lot = await lots.createBookingLotFromSheet(
    admin,
    new File(
      [
        xlsxBytes([
          { name: "BOOKING", cells: [HEADER, row(codes[0]), row(codes[1])] },
        ]),
      ],
      "cert.xlsx",
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ),
  );
  const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
  const items = await store.list("booking_items", {
    filter: { lotId: lot.id },
  });
  await setBookingItemsNcm(
    admin,
    items.map((i) => i.id),
    "7013.37.00",
  );
  await lots.closeBookingLot(admin, lot.id, null);
  const requests = [];
  for (const [i, item] of items.entries()) {
    const request = await svc.openSupplierRequest(admin, {
      itemId: item.id,
      alternativeIds: [],
      quantity: null,
      needs: null,
      searchQuery: null,
    });
    await svc.answerSupplierRequest(supplierA, request.id, {
      canDo: "yes",
      price: 1.1 + i,
      currency: "USD",
      moq: 1000,
      leadTimeDays: 30,
      note: null,
    });
    await svc.decideSupplierRequest(admin, request.id, "approved", null);
    await approveSample(admin, request.id);
    await product.createProductFromRequest(admin, request.id, {
      name: `Produto Cert ${i + 1}`,
      lineId: "linha-brinquedos",
      itemIds: [item.id],
    });
    requests.push(request);
  }
  return po.createPurchaseOrder(
    admin,
    requests.map((r) => ({ requestId: r.id, quantity: null })),
  );
}

const html = async (
  user: User,
  orderId: string,
  focus: string | null,
): Promise<string> => {
  const view = await FlowOrderInStep({
    user,
    step: CERT,
    orderId,
    t: translator("pt"),
    focus,
    notices: {
      import: null,
      production: null,
      receiving: null,
      artwork: null,
      freight: null,
      freightN: 0,
    },
  });
  return view ? renderToStaticMarkup(createElement("div", null, view)) : "";
};

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
  ocp = users.find((u) => u.email === "ocp@certifica.com")!;
});

describe("regra pura da Certificação por produto", () => {
  const task = (keys: string[], extra: Record<string, unknown> = {}) => ({
    kind: "requirement",
    stageKey: "PREPARATION",
    link: "/app/orders/o1",
    orderId: "o1",
    overdue: false,
    items: keys.map((key) => ({ key, label: key })),
    ...extra,
  });

  it("uma linha por produto só na Certificação", () => {
    const both = task(["certificate__i1", "certificate__i2", "art__i1"]);
    const rows = flow.splitByProduct(CERT, both);
    expect(rows.map((r) => r.items!.map((i) => i.key))).toEqual([
      ["certificate__i1"],
      ["certificate__i2"],
    ]);
    // Cada linha segue com os dados da pendência (pedido, prazo, etapa).
    expect(rows.every((r) => r.orderId === "o1")).toBe(true);
    // Um produto só: a própria pendência.
    const one = task(["certificate__i1", "art__i1"]);
    expect(flow.splitByProduct(CERT, one)).toEqual([one]);
    // Os outros passos não mudam (a arte de dois produtos é uma linha).
    const art = task(["art__i1", "art__i2"]);
    expect(flow.splitByProduct(ART, art)).toEqual([art]);
    // Pendência sem item de etapa (embarque, certificação do pedido): igual.
    const memorial = { kind: "cert_step", stepKey: "cert_memorial" };
    expect(flow.splitByProduct(CERT, memorial)).toEqual([memorial]);
    // Item do pedido inteiro (chave sem produto) fica numa linha própria.
    expect(
      flow
        .splitByProduct(CERT, task(["certificate", "certificate__i1"]))
        .map((r) => r.items!.map((i) => i.key)),
    ).toEqual([["certificate"], ["certificate__i1"]]);
  });

  it("os contadores contam as mesmas linhas da tela do passo", () => {
    const tasks = [
      task(["certificate__i1", "certificate__i2", "art__i1"], {
        overdue: true,
      }),
      task(["certificate__i3"]),
    ];
    const counts = flow.countByStep(tasks);
    expect(counts.get("order/certification")).toEqual({
      count: 3,
      overdue: 2,
    });
    expect(flow.casesInStep(CERT, tasks)).toHaveLength(3);
    // A arte da mesma pendência conta uma vez, como antes.
    expect(counts.get("order/art")).toEqual({ count: 1, overdue: 1 });
    expect(flow.casesInStep(ART, tasks)).toHaveLength(1);
  });

  it("Resolver: o produto da linha no detalhe do pedido no passo", () => {
    const [a, b] = flow.splitByProduct(
      CERT,
      task(["certificate__i1", "certificate__i2"]),
    );
    expect(flow.caseHref(CERT, a)).toBe(
      "/app/flow/order/certification/o1?item=i1",
    );
    expect(flow.caseHref(CERT, b)).toBe(
      "/app/flow/order/certification/o1?item=i2",
    );
    expect(flow.productOfCase(CERT, a)).toBe("i1");
    // Dois produtos juntos (não acontece na tela): sem produto no link.
    expect(
      flow.productOfCase(CERT, task(["certificate__i1", "certificate__i2"])),
    ).toBeNull();
    // Item do pedido inteiro: o pedido no passo, sem produto.
    expect(flow.caseHref(CERT, task(["certificate"]))).toBe(
      "/app/flow/order/certification/o1",
    );
    // Passo da certificação do pedido (memorial, selo): no quadro dele.
    expect(
      flow.caseHref(CERT, {
        kind: "cert_step",
        orderId: "o1",
        link: "/app/orders/o1#certification-step-cert_memorial",
      }),
    ).toBe("/app/flow/order/certification/o1#certification-step-cert_memorial");
    expect(
      flow.caseHref(CERT, {
        kind: "cert_step",
        orderId: "o1",
        link: "/app/orders/o1#order-partners",
      }),
    ).toBe("/app/flow/order/certification/o1");
    // Os outros passos não mudam.
    expect(flow.caseHref(ART, task(["art__i1"]))).toBe(
      "/app/flow/order/art/o1",
    );
    expect(
      flow.caseHref(flow.findStep("production", "cargo-docs")!, {
        kind: "import_step",
        orderId: "o1",
        link: "/app/orders/o1#import-flow",
      }),
    ).toBe("/app/flow/production/cargo-docs/o1");
    expect(flow.orderInStepHref(CERT, "o1")).toBe(
      "/app/flow/order/certification/o1",
    );
  });

  it("só a Certificação perde os cartões de baixo da lista", () => {
    expect(flow.isListOnlyStep(CERT)).toBe(true);
    for (const step of flow.FLOW_STEPS.filter((s) => s !== CERT))
      expect(flow.isListOnlyStep(step)).toBe(false);
    expect(flow.isPerProductStep(CERT)).toBe(true);
    expect(flow.isPerProductStep(ART)).toBe(false);
  });

  it("depois do envio, volta ao mesmo produto (e só a endereço do passo)", async () => {
    const { flowReturnTo } = await import("@/app/app/actions/helpers");
    const form = (v: string) => {
      const f = new FormData();
      f.set("returnTo", v);
      return f;
    };
    expect(
      flowReturnTo(form("/app/flow/order/certification/o-1?item=i_2-x")),
    ).toBe("/app/flow/order/certification/o-1?item=i_2-x");
    for (const bad of [
      "/app/flow/order/certification?item=i1",
      "/app/flow/order/certification/o1?item=",
      "/app/flow/order/certification/o1?item=../x",
      "/app/flow/order/certification/o1?item=i1&x=1",
      "/app/flow/order/certification/o1?x=i1",
      "/app/flow/order/certification/o1?item=i1#x",
      "https://evil.example/app/flow/order/certification/o1?item=i1",
    ])
      expect(flowReturnTo(form(bad))).toBeNull();
  });
});

describe("pedido com dois produtos na Certificação", () => {
  let order: Order;
  let itemIds: string[];

  beforeAll(async () => {
    order = await certifiedOrder(["FC-1", "FC-2"]);
    itemIds = (
      await getStore().list("order_items", { filter: { orderId: order.id } })
    )
      .map((i) => i.id)
      .sort();
  });

  it("cada produto em uma linha, com o Resolver no produto certo", async () => {
    expect(itemIds).toHaveLength(2);
    const rows = (await flowSvc.flowCasesOf(ocp, CERT)).filter(
      (r) => r.orderId === order.id,
    );
    expect(rows.map((r) => flow.productOfCase(CERT, r)).sort()).toEqual(
      itemIds,
    );
    for (const r of rows) {
      const item = flow.productOfCase(CERT, r)!;
      expect(flow.itemsInStep(CERT, r).map((i) => i.key)).toEqual([
        `certificate__${item}`,
      ]);
      expect(flow.caseHref(CERT, r)).toBe(
        `/app/flow/order/certification/${order.id}?item=${item}`,
      );
    }
    // A Wellmix: a mesma pendência da Preparação vira duas linhas aqui e
    // segue uma linha só no Die Cut (os outros passos não mudam).
    const mine = (await flowSvc.flowCasesOf(admin, CERT)).filter(
      (r) => r.orderId === order.id,
    );
    expect(mine.map((r) => flow.productOfCase(CERT, r)).sort()).toEqual(
      itemIds,
    );
    const dieCut = (await flowSvc.flowCasesOf(admin, ART_MATERIAL)).filter(
      (r) => r.orderId === order.id,
    );
    expect(dieCut).toHaveLength(1);
    expect(
      new Set(
        flow
          .itemsInStep(ART_MATERIAL, dieCut[0])
          .map((i) => i.key.split("__")[1]),
      ),
    ).toEqual(new Set(itemIds));
    expect(flow.caseHref(ART_MATERIAL, dieCut[0])).toBe(
      `/app/orders/${order.id}/die-cut`,
    );
  });

  it("menu, aba e Overview contam as mesmas linhas", async () => {
    const all = await flowSvc.flowCasesOf(ocp, CERT);
    expect(all.filter((r) => r.orderId === order.id)).toHaveLength(2);
    expect(
      (await flowSvc.flowCountsFor(ocp)).get("order/certification"),
    ).toEqual({
      count: all.length,
      overdue: all.filter((r) => r.overdue).length,
    });
    const summary = (await flowSvc.flowBlockSummary(ocp, "order")).find(
      (s) => s.step.key === "certification",
    )!;
    expect(summary.count).toBe(all.length);
    expect(summary.tasks).toHaveLength(all.length);
  });

  it("o Resolver abre só o produto da linha, com o envio do arquivo", async () => {
    const reqs = await getStore().list("requirements", {
      filter: { orderId: order.id },
    });
    const certOf = (item: string) =>
      reqs.find((r) => r.key === `certificate__${item}`)!;
    for (const [item, other] of [
      [itemIds[0], itemIds[1]],
      [itemIds[1], itemIds[0]],
    ]) {
      const page = await html(ocp, order.id, item);
      expect(page).toContain("data-flow-order-focus");
      expect(page).toContain(`data-flow-order-item="${item}"`);
      expect(page).not.toContain(`data-flow-order-item="${other}"`);
      // O envio do arquivo do certificado deste produto, e só dele.
      expect(page).toContain(`value="${certOf(item).id}"`);
      expect(page).not.toContain(`value="${certOf(other).id}"`);
      expect(page).toMatch(/type="file"/);
      // Volta ao mesmo produto depois do envio.
      expect(page).toContain(
        `value="/app/flow/order/certification/${order.id}?item=${item}"`,
      );
      // "Ver tudo do pedido neste passo".
      expect(page).toContain(
        `href="/app/flow/order/certification/${order.id}"`,
      );
    }
    // Sem produto: tudo do passo (os dois).
    const whole = await html(ocp, order.id, null);
    for (const item of itemIds)
      expect(whole).toContain(`data-flow-order-item="${item}"`);
    expect(whole).not.toContain("data-flow-order-focus");
    // Produto que não é deste pedido: o aviso e tudo do passo.
    const stray = await html(ocp, order.id, "outro-item");
    expect(stray).toContain(
      translator("pt")("flow.order.focus.missing").replace(/"/g, "&quot;"),
    );
    for (const item of itemIds)
      expect(stray).toContain(`data-flow-order-item="${item}"`);
    // Outra empresa não abre o pedido, nem com o link do produto.
    expect(await html(supplierB, order.id, itemIds[0])).toBe("");
  });
});
