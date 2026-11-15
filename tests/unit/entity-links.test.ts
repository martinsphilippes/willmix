import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Ligações entre book, seleção, produto e pedido (fase 4b,
 * docs/MILESTONES.md): de qualquer um deles chega-se aos outros pelos ids
 * que já existem (item do book → grupo → solicitação → produto → pedido).
 */
withTempStore();
const { getStore } = await import("@/lib/db");
const links = await import("@/lib/services/entity-links");
type User = import("@/lib/db").User;

const ids = {
  lot: "lot-1",
  otherLot: "lot-2",
  item: "item-1",
  item2: "item-2",
  rival: "item-3",
  product: "prod-1",
  request: "sr-1",
  request2: "sr-2",
  order: "order-1",
  group: "group-1",
  oldGroup: "group-0",
};

beforeAll(async () => {
  const store = getStore();
  const create = (table: string, row: Record<string, unknown>) =>
    store.create(table as never, row as never);
  await create("booking_lots", {
    id: ids.lot,
    number: 7,
    status: "closed",
    fileName: "fornecedor-a.xlsx",
    itemCount: 2,
  });
  await create("booking_lots", {
    id: ids.otherLot,
    number: 8,
    status: "closed",
    fileName: "fornecedor-b.xlsx",
    itemCount: 1,
  });
  await create("booking_items", {
    id: ids.item,
    lotId: ids.lot,
    position: 0,
    description: "Glass jar 350ml",
    productId: ids.product,
  });
  await create("booking_items", {
    id: ids.item2,
    lotId: ids.lot,
    position: 1,
    description: "Glass cup",
    productId: null,
  });
  await create("booking_items", {
    id: ids.rival,
    lotId: ids.otherLot,
    position: 0,
    description: "Jar rival",
    productId: null,
  });
  await create("products", {
    id: ids.product,
    name: "Pote de vidro 350 ml",
    sku: "PV-350",
    lineId: "line",
    active: true,
  });
  await create("supplier_requests", {
    id: ids.request,
    number: 3,
    status: "approved",
    supplierId: "sup",
    bookingItemId: ids.item,
    bookingLotId: ids.lot,
    alternativeItemIds: [ids.rival],
    quantity: 3000,
    unit: "pcs",
    productId: ids.product,
    orderId: ids.order,
    createdByUserId: "u",
  });
  await create("supplier_requests", {
    id: ids.request2,
    number: 4,
    status: "sent",
    supplierId: "sup",
    bookingItemId: ids.item2,
    bookingLotId: ids.lot,
    alternativeItemIds: [],
    quantity: 100,
    unit: "pcs",
    productId: null,
    orderId: null,
    createdByUserId: "u",
  });
  await create("selection_groups", {
    id: ids.group,
    status: "requested",
    itemIds: [ids.item, ids.rival],
    chosenItemId: ids.item,
    quantity: 3000,
    supplierRequestId: ids.request,
    createdByUserId: "u",
  });
  // Escolha trocada antes: não é ligação.
  await create("selection_groups", {
    id: ids.oldGroup,
    status: "replaced",
    itemIds: [ids.item],
    chosenItemId: ids.item,
    quantity: 10,
    supplierRequestId: null,
    createdByUserId: "u",
  });
  await create("orders", {
    id: ids.order,
    number: 41,
    status: "PREPARATION",
    flow: "supplier_request",
    customerId: "cust",
  });
  await create("order_items", {
    id: "oi-1",
    orderId: ids.order,
    productId: ids.product,
    quantity: 3000,
    unit: "pcs",
  });
});

describe("ligações entre book, seleção, produto e pedido", () => {
  it("do pedido: book, seleção, solicitação e produto", async () => {
    const l = await links.linksForOrder(ids.order);
    expect(l.lots.map((x) => x.number)).toEqual([7]);
    expect(l.items.map((x) => x.id)).toEqual([ids.item]);
    expect(l.selections.map((x) => x.id)).toEqual([ids.group]);
    expect(l.supplierRequests.map((x) => x.number)).toEqual([3]);
    expect(l.products.map((x) => x.name)).toEqual(["Pote de vidro 350 ml"]);
    expect(l.orders.map((x) => x.number)).toEqual([41]);
    expect(links.selectionHref(l.selections[0])).toBe(
      `/app/booking/selection?tab=selection&ids=${ids.item}%2C${ids.rival}`,
    );
  });

  it("do book: cada item com a solicitação, o produto e o pedido", async () => {
    const l = await links.linksForLot(ids.lot);
    expect(l.items.map((x) => x.id)).toEqual([ids.item, ids.item2]);
    const first = links.linksOfItem(l, ids.item);
    expect(first.supplierRequests.map((x) => x.id)).toEqual([ids.request]);
    expect(first.products.map((x) => x.id)).toEqual([ids.product]);
    expect(first.orders.map((x) => x.id)).toEqual([ids.order]);
    expect(first.selections.map((x) => x.id)).toEqual([ids.group]);
    const second = links.linksOfItem(l, ids.item2);
    expect(second.supplierRequests.map((x) => x.number)).toEqual([4]);
    expect(second.products).toEqual([]);
    expect(second.orders).toEqual([]);
    expect(second.selections).toEqual([]);
  });

  it("do produto: o book, a solicitação e o pedido", async () => {
    const l = await links.linksForProduct(ids.product);
    expect(l.lots.map((x) => x.id)).toEqual([ids.lot]);
    expect(l.supplierRequests.map((x) => x.id)).toEqual([ids.request]);
    expect(l.orders.map((x) => x.id)).toEqual([ids.order]);
  });

  it("da solicitação: o item, o book, o grupo e o pedido", async () => {
    const l = await links.linksForSupplierRequest(ids.request);
    expect(l?.lots.map((x) => x.id)).toEqual([ids.lot]);
    expect(l?.selections.map((x) => x.id)).toEqual([ids.group]);
    expect(l?.orders.map((x) => x.id)).toEqual([ids.order]);
    expect(await links.linksForSupplierRequest("nope")).toBeNull();
  });

  it("pedido sem book nem solicitação: só os produtos dos itens", async () => {
    const l = await links.linksForOrder("order-sem-origem");
    expect(l.lots).toEqual([]);
    expect(l.supplierRequests).toEqual([]);
  });

  it("só a Wellmix vê as ligações, e só das telas que abre", () => {
    const admin = { id: "a", role: "admin" } as User;
    const customer = { id: "c", role: "customer" } as User;
    expect(links.entityLinkAccess(admin)).toEqual({
      book: true,
      supplierRequests: true,
      products: true,
      orders: true,
    });
    expect(links.entityLinkAccess(customer)).toEqual({
      book: false,
      supplierRequests: false,
      products: false,
      orders: false,
    });
  });
});
