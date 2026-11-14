import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Histórico de compras do cliente na Nova solicitação (dono, 14/11/2026;
 * docs/PURCHASE_HISTORY.md): os pedidos do cliente, do mais recente para o
 * mais antigo, 10 por vez; a programação de compra uma vez só (o pai, com os
 * filhos no detalhe); cada dado com a origem (gravado no pedido ou "Ficha
 * atual"); as permissões de sempre (login do cliente só os dele; a folha do
 * fornecedor só para a Wellmix; venda só para quem vê venda).
 */
withTempStore();
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { ORDER_EXTRA_DEFAULTS, REQUEST_EXTRA_DEFAULTS } =
  await import("@/lib/db/schema");
const { orderFromRequest } = await import("./helpers/order");
const ph = await import("@/lib/services/purchase-history");
const { translator } = await import("@/i18n");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

const CUSTOMER = "cliente-joao";
let admin: User;
let joao: User;
/** Outro login do mesmo cliente: não vê os pedidos do João. */
let maria: User;
let supplier: User;

async function request(over: Record<string, unknown> = {}) {
  return getStore().create("requests", {
    ...REQUEST_EXTRA_DEFAULTS,
    customerId: CUSTOMER,
    createdByUserId: admin.id,
    productId: null,
    productName: "Jarra de vidro",
    description: "Jarra 1,5 L com tampa",
    specification: "Vidro borossilicato",
    quantity: 1200,
    unit: "un",
    deadline: null,
    status: "ORDERED",
    orderId: null,
    sellPrice: null,
    sellCurrency: null,
    downPaymentAmount: null,
    notes: null,
    origin: "manual",
    requestedForUserId: joao.id,
    ...over,
  } as never);
}

/** Pedido do fluxo de sempre (a solicitação descreve o produto). */
async function classic(over: Record<string, unknown> = {}, sell = 6000) {
  const r = await request(over);
  return orderFromRequest(admin, r, { sellPrice: sell, sellCurrency: "BRL" });
}

/** Pedido "cru" (carga do Sankhya, programação, cancelado…). */
async function bare(over: Partial<Order> & Record<string, unknown> = {}) {
  const r = await request({
    description: "Importado do Sankhya: NUNOTA 1, TOP 1",
    specification: null,
  });
  return getStore().create("orders", {
    ...ORDER_EXTRA_DEFAULTS,
    number: await getStore().nextNumber("order_number"),
    requestId: r.id,
    customerId: CUSTOMER,
    supplierId: "fornecedor-a",
    lineId: null,
    status: "DELIVERED",
    currentStageId: null,
    fobTotal: 500,
    fobCurrency: "USD",
    sellPrice: null,
    sellCurrency: null,
    erpSyncStatus: "pending",
    erpNumber: null,
    agencyId: null,
    brokerId: null,
    shippingLineId: null,
    carrierId: null,
    closedAt: null,
    notes: null,
    requestedByUserId: joao.id,
    ...over,
  } as never);
}

async function item(orderId: string, over: Record<string, unknown> = {}) {
  return getStore().create("order_items", {
    orderId,
    productId: null,
    name: "Pote hermético",
    quantity: 100,
    unit: "UN",
    unitPrice: 1.5,
    ...over,
  } as never);
}

const page = (user: User, before: number | null = null) =>
  ph.loadPurchaseHistory(user, CUSTOMER, before);

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
  maria = await getStore().create("users", {
    email: "maria@lojista.com",
    name: "Maria Cliente",
    role: "customer",
    partyId: CUSTOMER,
    locale: "pt",
    passwordHash: null,
    active: true,
    importerId: null,
    functions: [],
  } as never);
});

describe("cliente sem histórico", () => {
  it("nada para mostrar, sem erro", async () => {
    expect(await page(admin)).toEqual({ purchases: [], next: null });
  });
});

describe("cliente com vários pedidos", () => {
  let numbers: number[] = [];
  beforeAll(async () => {
    for (let i = 0; i < 12; i++) numbers.push((await classic()).number);
    // Outro cliente e um cancelado: fora do histórico.
    await bare({ customerId: "wellmix-sc" });
    await bare({ status: "CANCELLED" });
    numbers = numbers.sort((a, b) => b - a);
  });

  it("10 por vez, do mais recente para o mais antigo, e o resto em Carregar mais", async () => {
    const first = await page(admin);
    expect(first.purchases.map((p) => p.number)).toEqual(numbers.slice(0, 10));
    expect(first.next).toBe(numbers[9]);
    const second = await page(admin, first.next);
    expect(second.purchases.map((p) => p.number)).toEqual(numbers.slice(10));
    expect(second.next).toBeNull();
  });

  it("lê só a janela do topo, não todos os pedidos do cliente", async () => {
    // Um cliente tem ~15,7 mil pedidos em produção: a página lê o que a tela
    // já mostra, a página e um a mais, em ordem do número (maior primeiro).
    const spy = vi.spyOn(getStore(), "listColumns");
    try {
      const first = await page(admin);
      const window = () =>
        spy.mock.calls.filter(([table]) => table === "orders")[0]?.[2];
      expect(window()).toMatchObject({
        filter: { customerId: CUSTOMER, parentOrderId: null },
        orderBy: "number",
        direction: "desc",
        limit: 11,
      });
      spy.mockClear();
      const second = await ph.loadPurchaseHistory(
        admin,
        CUSTOMER,
        first.next,
        undefined,
        first.purchases.length,
      );
      expect(window()).toMatchObject({ limit: 21 });
      // Com a janela dita pela tela, o mesmo resultado.
      expect(second.purchases.map((p) => p.number)).toEqual(numbers.slice(10));
      expect(second.next).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("pedido de um produto: venda do pedido, unitário e subtotal; descrição da solicitação", async () => {
    const [p] = (await page(admin)).purchases;
    expect(p.total).toEqual({ amount: 6000, currency: "BRL" });
    expect(p.items).toHaveLength(1);
    const [i] = p.items;
    expect(i.quantity).toBe(1200);
    expect(i.unitSale).toEqual({ amount: 5, currency: "BRL" });
    expect(i.subtotalSale).toEqual({ amount: 6000, currency: "BRL" });
    expect(i.description).toEqual({
      value: "Jarra 1,5 L com tampa",
      current: false,
    });
    expect(i.specification?.value).toBe("Vidro borossilicato");
    // Sem ficha nem produto: caixa, medidas e cubagem não existem.
    expect(i.sheet).toMatchObject({
      sku: null,
      perBox: null,
      boxes: null,
      productDims: null,
      boxDims: null,
      cbmPerBox: null,
      cbmTotal: null,
    });
    expect(i.sheet?.pieces).toEqual({ value: 1200, current: false });
  });
});

describe("ficha de compra, ficha atual e campos antigos", () => {
  let withSheet: Order;
  let withProduct: Order;
  let multi: Order;
  let old: Order;
  beforeAll(async () => {
    const product = await getStore().create("products", {
      lineId: "linha-utilidades",
      name: "Jarra de vidro 1,5 L",
      sku: "JAR-15",
      specification: "Ficha: vidro 4 mm",
      active: true,
      supplierSku: "SUP-15",
      masterBoxQty: 24,
      lengthCm: 12,
      widthCm: 12,
      heightCm: 25,
      boxLengthCm: 50,
      boxWidthCm: 40,
      boxHeightCm: 30,
      cbm: null,
      material: "Vidro",
      ncm: "7013.37.00",
      ean: "7890000000001",
      netWeightKg: 0.8,
    } as never);
    // Com a ficha de compra do pedido: ela vale antes da ficha atual.
    withSheet = await classic({ productId: product.id });
    await getStore().create("purchase_sheets", {
      orderId: withSheet.id,
      productId: product.id,
      factoryItemCode: "F-778",
      masterCartonQty: 12,
      cbmPerCarton: 0.05,
      lengthCm: 45,
      widthCm: 35,
      heightCm: 32,
      material: "Vidro temperado",
    } as never);
    // Só com o produto: a ficha atual, marcada.
    withProduct = await classic({ productId: product.id });
    // Dois produtos: a venda é do pedido, não do item.
    multi = await classic({}, 9000);
    await item(multi.id, { name: "Tampa avulsa", quantity: 300 });
    // Pedido antigo, sem venda, sem produto, unidade em caixas.
    old = await bare({ status: "CLOSED" });
    await item(old.id, {
      name: "Caixa organizadora",
      quantity: 40,
      unit: "CX",
    });
  });
  const find = async (o: Order) => {
    let before: number | null = null;
    for (let i = 0; i < 5; i++) {
      const p = await page(admin, before);
      const hit = p.purchases.find((x) => x.orderId === o.id);
      if (hit) return hit;
      before = p.next;
      if (before === null) break;
    }
    throw new Error("pedido fora do histórico");
  };

  it("ficha de compra do pedido antes da ficha atual", async () => {
    const [i] = (await find(withSheet)).items;
    expect(i.sheet).toMatchObject({
      sku: { value: "JAR-15", current: true },
      factoryCode: { value: "F-778", current: false },
      pieces: { value: 1200, current: false },
      perBox: { value: 12, current: false },
      boxes: { value: 100, current: false },
      productDims: {
        value: { length: 12, width: 12, height: 25 },
        current: true,
      },
      boxDims: { value: { length: 45, width: 35, height: 32 }, current: false },
      cbmPerBox: { value: 0.05, current: false },
      cbmTotal: { value: 5, current: false },
    });
    const tech = Object.fromEntries(
      i.sheet!.technical.map((x) => [x.key, x.fact]),
    );
    expect(tech.material).toEqual({ value: "Vidro temperado", current: false });
    expect(tech.ncm).toEqual({ value: "7013.37.00", current: true });
    expect(tech.ean).toEqual({ value: "7890000000001", current: true });
    // A descrição da solicitação continua a do pedido.
    expect(i.description?.current).toBe(false);
  });

  it("sem ficha de compra: a ficha atual, marcada, e a conta com ela", async () => {
    const [i] = (await find(withProduct)).items;
    expect(i.sheet).toMatchObject({
      perBox: { value: 24, current: true },
      boxes: { value: 50, current: true },
      boxDims: { value: { length: 50, width: 40, height: 30 }, current: true },
      cbmPerBox: { value: 0.06, current: true },
      cbmTotal: { value: 3, current: true },
      factoryCode: { value: "SUP-15", current: true },
    });
  });

  it("dois produtos: total do pedido, sem unitário nem subtotal por item", async () => {
    const p = await find(multi);
    expect(p.total).toEqual({ amount: 9000, currency: "BRL" });
    expect(p.items).toHaveLength(2);
    for (const i of p.items) {
      expect(i.unitSale).toBeNull();
      expect(i.subtotalSale).toBeNull();
      // A descrição da solicitação é de um produto só.
      expect(i.description).toBeNull();
    }
  });

  it("pedido antigo incompleto: o que falta fica nulo (— na tela)", async () => {
    const p = await find(old);
    expect(p.total).toBeNull();
    const [i] = p.items;
    expect(i.unit).toBe("CX");
    expect(i.sheet).toMatchObject({
      pieces: null,
      perBox: null,
      boxes: { value: 40, current: false },
    });
    const view = ph.purchaseHistoryView(
      { purchases: [p], next: null },
      translator("pt"),
    );
    const lines = Object.fromEntries(
      view.purchases[0].items[0].lines.map((l) => [l.key, l]),
    );
    expect(view.purchases[0].total).toBe("—");
    expect(lines.pieces.value).toBe("—");
    expect(lines.boxes.value).toBe("40 caixas");
    expect(lines.cbmTotal.value).toBe("—");
    expect(lines.unitSale.value).toBe("—");
  });
});

describe("medida zero é não preenchida", () => {
  it("peso, medida, cubagem e peças por caixa zerados ficam em branco (— na tela)", () => {
    // A carga do Sankhya grava 0 no campo vazio da ficha do produto.
    const sheet = ph.itemSheet({
      quantity: 100,
      unit: "UN",
      product: {
        sku: "X-1",
        masterBoxQty: 0,
        lengthCm: 0,
        widthCm: 12,
        heightCm: 25,
        boxLengthCm: 0,
        boxWidthCm: 0,
        boxHeightCm: 0,
        cbm: 0,
        netWeightKg: 0,
        grossWeightKg: 0,
        innerBoxQty: 0,
      } as never,
    });
    expect(sheet.perBox).toBeNull();
    expect(sheet.boxes).toBeNull();
    expect(sheet.boxDims).toBeNull();
    expect(sheet.cbmPerBox).toBeNull();
    expect(sheet.cbmTotal).toBeNull();
    expect(sheet.productDims).toEqual({
      value: { length: null, width: 12, height: 25 },
      current: true,
    });
    const keys = sheet.technical.map((x) => x.key);
    expect(keys).not.toContain("netWeight");
    expect(keys).not.toContain("grossWeight");
    expect(keys).not.toContain("innerQty");
  });
});

describe("carga do Sankhya: a data do pedido lá", () => {
  it("vem do fim da etapa Pedido criado; sem ela, a data fica em branco", async () => {
    const dated = await bare({ sankhyaCode: "91001" });
    await item(dated.id, { sankhyaRefs: { CODPROD: 4455, NUNOTA: 91001 } });
    await getStore().create("stages", {
      orderId: dated.id,
      key: "ORDER_CREATED",
      sequence: 1,
      status: "done",
      responsibleRole: "operator",
      responsiblePartyId: null,
      dueAt: null,
      startedAt: new Date().toISOString(),
      completedAt: "2023-05-10T12:00:00.000Z",
      percent: 100,
      reminderSentAt: null,
      blockReason: null,
    } as never);
    const undated = await bare({
      sankhyaCode: "91002",
      status: "ORDER_CREATED",
    });
    await item(undated.id);
    const p = await page(admin);
    const a = p.purchases.find((x) => x.orderId === dated.id)!;
    const b = p.purchases.find((x) => x.orderId === undated.id)!;
    expect(a).toMatchObject({
      imported: true,
      date: "2023-05-10T12:00:00.000Z",
    });
    expect(b).toMatchObject({ imported: true, date: null });
    // A nota da carga não é a descrição do produto.
    expect(a.items[0].description).toBeNull();
    expect(a.items[0].sheet?.erpCode).toEqual({
      value: "4455",
      current: false,
    });
    const view = ph.purchaseHistoryView(p, translator("pt"));
    const va = view.purchases.find((x) => x.id === dated.id)!;
    const vb = view.purchases.find((x) => x.id === undated.id)!;
    expect(va.date).toBe("10/05/2023");
    expect(vb.date).toBe("—");
    expect(vb.dateHint).toMatch(/não gravada/);
  });
});

describe("programação de compra: o pai é a compra, os filhos no detalhe", () => {
  it("o filho não aparece como compra à parte; a rodada prevista também aparece", async () => {
    // Como a programação grava (services/purchase-rounds.ts): pai e filhos
    // no fluxo da solicitação ao fornecedor.
    const parent = await bare({
      status: "ORDER_CREATED",
      flow: "supplier_request",
    });
    await item(parent.id, { name: "Jarra programada", quantity: 6000 });
    // O filho não leva quem pediu (services/purchase-rounds.ts): o login do
    // cliente não o abre.
    const child = await bare({
      status: "PREPARATION",
      flow: "supplier_request",
      parentOrderId: parent.id,
      roundIndex: 1,
      requestedByUserId: null,
    });
    await item(child.id, { name: "Jarra programada", quantity: 3000 });
    await getStore().update("orders", parent.id, {
      purchaseRounds: [
        {
          index: 1,
          expectedAt: "2026-12-01",
          items: [{ productId: "p", quantity: 3000 }],
          orderId: child.id,
          createdAt: new Date().toISOString(),
        },
        {
          index: 2,
          expectedAt: "2027-01-15",
          items: [{ productId: "p", quantity: 3000 }],
          orderId: null,
          createdAt: null,
        },
      ],
    } as never);
    const all: number[] = [];
    let before: number | null = null;
    let found: Awaited<ReturnType<typeof page>>["purchases"][number] | null =
      null;
    do {
      const p = await page(admin, before);
      all.push(...p.purchases.map((x) => x.number));
      found ??= p.purchases.find((x) => x.orderId === parent.id) ?? null;
      before = p.next;
    } while (before !== null);
    expect(all).not.toContain(child.number);
    expect(found?.items[0].quantity).toBe(6000);
    // O texto da solicitação de apoio não é a descrição do produto.
    expect(found?.items[0].description).toBeNull();
    expect(found?.rounds).toHaveLength(2);
    expect(found?.rounds[0]).toMatchObject({
      index: 1,
      pieces: 3000,
      order: { id: child.id, number: child.number },
    });
    expect(found?.rounds[1]).toMatchObject({ index: 2, order: null });
    const view = ph.purchaseHistoryView(
      { purchases: [found!], next: null },
      translator("pt"),
    );
    expect(view.purchases[0].rounds[0].label).toContain(`#${child.number}`);
    expect(view.purchases[0].rounds[1].label).toMatch(
      /Rodada 2 · prevista para 15\/01\/2027, ainda sem pedido/,
    );
    // O login do cliente vê a compra (o pai) e a rodada criada, sem o número
    // do filho, que ele não abre.
    let mine: typeof found = null;
    before = null;
    do {
      const p = await page(joao, before);
      expect(p.purchases.map((x) => x.number)).not.toContain(child.number);
      mine ??= p.purchases.find((x) => x.orderId === parent.id) ?? null;
      before = p.next;
    } while (before !== null);
    expect(mine?.rounds[0]).toMatchObject({ created: true, order: null });
    const theirs = ph.purchaseHistoryView(
      { purchases: [mine!], next: null },
      translator("pt"),
    );
    expect(theirs.purchases[0].rounds[0].label).toMatch(
      /Rodada 1 · prevista para 01\/12\/2026, pedido criado/,
    );
    expect(theirs.purchases[0].rounds[0].label).not.toContain(
      `#${child.number}`,
    );
    expect(theirs.purchases[0].rounds[0].orderId).toBeNull();
  });
});

describe("permissões", () => {
  it("o login do cliente vê só os pedidos dele, sem a folha do fornecedor, com a venda", async () => {
    const hidden = await classic({ requestedForUserId: maria.id });
    const mine = await page(joao);
    expect(mine.purchases.some((p) => p.orderId === hidden.id)).toBe(false);
    expect(mine.purchases.length).toBeGreaterThan(0);
    for (const p of mine.purchases)
      for (const i of p.items) expect(i.sheet).toBeNull();
    expect(mine.purchases.some((p) => p.total !== null)).toBe(true);
    const hers = await page(maria);
    expect(hers.purchases.map((p) => p.orderId)).toEqual([hidden.id]);
    // A Wellmix vê todos.
    let before: number | null = null;
    const seen: string[] = [];
    do {
      const p = await page(admin, before);
      seen.push(...p.purchases.map((x) => x.orderId));
      before = p.next;
    } while (before !== null);
    expect(seen).toContain(hidden.id);
  });

  it("cliente de outra empresa e fornecedor não leem nada", async () => {
    expect(await ph.loadPurchaseHistory(joao, "wellmix-sc")).toEqual({
      purchases: [],
      next: null,
    });
    expect(await page(supplier)).toEqual({ purchases: [], next: null });
  });

  it("o custo do fornecedor (FOB) não sai em nenhum valor", async () => {
    const p = await page(admin);
    const json = JSON.stringify(p);
    expect(json).not.toContain("fobTotal");
    expect(json).not.toContain("unitPrice");
  });
});
