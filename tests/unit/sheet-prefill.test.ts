import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Ficha da Preparação já vem preenchida: na recompra, do último pedido do
 * mesmo produto com o mesmo fornecedor.
 */
withTempStore();

const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const ps = await import("@/lib/services/purchase-sheet");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierB: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
});

const sheet = {
  supplierName: "Guangzhou Supplier B",
  incoterm: "FOB" as const,
  currency: "USD" as const,
  price: 3.2,
  moq: 500,
  masterCartonQty: 24,
  netWeightPcKg: 0.3,
  grossWeightPcKg: 0.4,
  cbmPerCarton: 0.08,
  heightCm: 30,
  widthCm: 40,
  lengthCm: 50,
  packageType: "COLOR BOX",
  colorAssortment: "SORTIDO",
  material: "PVC",
  productionStartAt: "2026-11-01T00:00:00.000Z",
};

/** Primeira compra da boneca com o fornecedor B, com a ficha preenchida. */
async function firstOrderWithSheet() {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-boneca",
    productName: "Boneca articulada 30 cm",
    description: "Boneca",
    specification: null,
    quantity: 3000,
    unit: "un",
    deadline: null,
  });
  const order = await orderFromRequest(admin, request, {
    supplierId: "fornecedor-b",
    price: 3.2,
    sellPrice: 50000,
  });
  await ps.saveSheet(supplierB, order.id, sheet);
  return order;
}

describe("ficha da Preparação", () => {
  it("recompra: usa a ficha do último pedido do produto", async () => {
    await firstOrderWithSheet();
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: "prod-boneca",
      productName: "Boneca articulada 30 cm",
      description: "Recompra",
      specification: null,
      quantity: 2000,
      unit: "un",
      deadline: null,
    });
    const order = await orderFromRequest(admin, request, {
      supplierId: "fornecedor-b",
      price: 3.1,
      sellPrice: 20000,
    });
    const view = (await ps.getSheetForUser(supplierB, order.id))!;
    // Recompra com o mesmo fornecedor: a ficha dele vale (a mestre só
    // completa o que ela não tem).
    expect(view.prefillSource).toBe("previous");
    expect(view.sheet).toMatchObject({ material: "PVC", masterCartonQty: 24 });
    // Data e programação são deste pedido.
    expect(view.sheet.productionStartAt ?? null).toBeNull();
  });
});
