import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * O cadastro do produto acompanha a ficha: o pedido (a compra de verdade)
 * atualiza, e produto fora do catálogo vira cadastro com um clique, para a
 * próxima venda já vir preenchida.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const { orderFromRequest } = await import("./helpers/order");
const ps = await import("@/lib/services/purchase-sheet");
const pm = await import("@/lib/services/product-sheet");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

type SheetInput = Parameters<typeof ps.saveSheet>[2];

/**
 * Pedido do produto com o fornecedor indicado; a Wellmix grava a ficha da
 * compra (o cadastro aprende com ela).
 */
async function ordered(
  productId: string | null,
  name: string,
  supplierId: string,
  sheet: SheetInput,
) {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: name,
    description: `${name} para revenda`,
    // Acima de qualquer pedido mínimo do seed (500, 2000, 300).
    quantity: 2000,
    unit: "un",
  });
  const order = await orderFromRequest(admin, request, {
    supplierId,
    price: sheet.price ?? 2,
  });
  await ps.saveSheet(admin, order.id, sheet);
  return { request, order };
}

describe("cadastro do produto acompanha a ficha", () => {
  it("produto do catálogo: o pedido atualiza o cadastro", async () => {
    const store = getStore();
    const masterBefore = await pm.getProductSheet("prod-jarra");
    // Pedido fechado: a ficha da compra atualiza o cadastro (produto sem
    // fornecedor principal: a compra de verdade vale).
    const { order } = await ordered("prod-jarra", "Jarra", "fornecedor-a", {
      price: 2.5,
      currency: "USD",
      masterCartonQty: 24,
      netWeightPcKg: 0.4,
      packageType: "COLOR BOX",
    });
    const master = (await pm.getProductSheet("prod-jarra"))!;
    expect(master.packageType).toBe("COLOR BOX");
    expect(master.netWeightPcKg).toBe(0.4);
    expect((await store.get("products", "prod-jarra"))!.masterBoxQty).toBe(24);
    // Preço é do fornecedor (não é o principal): não vai para a ficha mestre.
    expect(master.price ?? null).toBe(masterBefore?.price ?? null);

    // A Wellmix ajusta a ficha da compra: o cadastro acompanha.
    await ps.saveSheet(admin, order.id, { packageType: "GIFT BOX" });
    expect((await pm.getProductSheet("prod-jarra"))!.packageType).toBe(
      "GIFT BOX",
    );
    // O fornecedor, na ficha do pedido, só completa o que falta.
    await ps.saveSheet(supplierA, order.id, { packageType: "PLAIN BOX" });
    expect((await pm.getProductSheet("prod-jarra"))!.packageType).toBe(
      "GIFT BOX",
    );
  });

  it("produto com fornecedor principal: compra com outro fornecedor não troca os dados do principal", async () => {
    const store = getStore();
    const { order } = await ordered("prod-panela", "Panela", "fornecedor-b", {
      price: 9,
      currency: "USD",
      material: "AÇO INOX",
    });
    await ps.saveSheet(admin, order.id, { material: "AÇO INOX 304" });
    const product = (await store.get("products", "prod-panela"))!;
    // O principal (fornecedor A) tinha material: continua o dele.
    expect(product.material).toBe("Alumínio com revestimento antiaderente");
    expect(product.price ?? null).not.toBe(9);
  });

  it("produto fora do catálogo: cadastra com a ficha do pedido e passa a ser o produto da solicitação", async () => {
    const store = getStore();
    const { request, order } = await ordered(
      null,
      "Copo térmico",
      "fornecedor-a",
      {
        price: 1.2,
        currency: "USD",
        masterCartonQty: 60,
        netWeightPcKg: 0.2,
        material: "AÇO INOX",
      },
    );
    await expect(
      pm.registerProductFromOrderSheet(joao, order.id, "linha-utilidades"),
    ).rejects.toThrow();
    await expect(
      pm.registerProductFromOrderSheet(admin, order.id, "nao-existe"),
    ).rejects.toThrow("invalid_line");

    const productId = await pm.registerProductFromOrderSheet(
      admin,
      order.id,
      "linha-utilidades",
    );
    const product = (await store.get("products", productId))!;
    expect(product).toMatchObject({
      name: "Copo térmico",
      lineId: "linha-utilidades",
      supplierId: "fornecedor-a",
      material: "AÇO INOX",
      masterBoxQty: 60,
    });
    expect((await store.get("requests", request.id))!.productId).toBe(
      productId,
    );
    const [item] = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    expect(item.productId).toBe(productId);
    // Fornecedor do pedido é o principal: preço também vai para a ficha mestre.
    expect((await pm.getProductSheet(productId))!.price).toBe(1.2);
    // De novo: o mesmo produto, sem duplicar.
    expect(
      await pm.registerProductFromOrderSheet(
        admin,
        order.id,
        "linha-utilidades",
      ),
    ).toBe(productId);
  });

  it("ficha mestre nasce com o que o produto já tem; o próximo pedido vem completo", async () => {
    expect(await pm.getProductSheet("prod-boneca")).toBeNull();
    await ordered("prod-boneca", "Boneca", "fornecedor-b", {
      price: 3.3,
      currency: "USD",
      packageType: "COLOR BOX",
    });
    // A ficha da compra trouxe só a embalagem nova: o resto do cadastro fica.
    expect(await pm.getProductSheet("prod-boneca")).toMatchObject({
      packageType: "COLOR BOX",
      masterCartonQty: 48,
      material: "PVC atóxico",
      netWeightPcKg: 0.28,
    });
    const nextRequest = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: "prod-boneca",
      productName: "Boneca",
      description: "Boneca para revenda",
      quantity: 2000,
      unit: "un",
    });
    const next = await orderFromRequest(admin, nextRequest, {
      supplierId: "fornecedor-a",
    });
    const view = (await ps.getSheetForUser(supplierA, next.id))!;
    expect(view.sheet).toMatchObject({
      packageType: "COLOR BOX",
      masterCartonQty: 48,
      material: "PVC atóxico",
    });
    // Preço do fornecedor principal (B) não vai para a ficha de A.
    expect(view.sheet.price ?? null).not.toBe(3.3);
  });

  it("salvar um campo na ficha de um pedido antigo não desfaz o cadastro mais novo", async () => {
    const store = getStore();
    const { order } = await ordered("prod-panela", "Panela", "fornecedor-a", {
      price: 9.1,
      currency: "USD",
    });
    expect((await store.get("products", "prod-panela"))!.price).toBe(9.1);
    // A Wellmix atualiza o cadastro depois da compra…
    await pm.saveProductSheet(admin, "prod-panela", { price: 8.2, moq: 2000 });
    const [entry] = await store.list("audit_log", {
      filter: { entity: "product", entityId: "prod-panela" },
      orderBy: "createdAt",
      direction: "desc",
      limit: 1,
    });
    expect(entry.before).toMatchObject({ price: 9.1, moq: 500 });
    expect(entry.after).toMatchObject({ price: 8.2, moq: 2000 });
    // …e depois salva só o NCM na ficha do pedido antigo.
    await ps.saveSheet(admin, order.id, { ncm: "7323.99.00" });
    const product = (await store.get("products", "prod-panela"))!;
    expect(product).toMatchObject({ price: 8.2, moq: 2000, ncm: "7323.99.00" });
  });

  it("cadastrar pela ficha duas vezes ao mesmo tempo não duplica o produto", async () => {
    const store = getStore();
    const { order } = await ordered(null, "Copo duplo", "fornecedor-a", {
      price: 1.1,
      currency: "USD",
    });
    const [a, b] = await Promise.all([
      pm.registerProductFromOrderSheet(admin, order.id, "linha-utilidades"),
      pm.registerProductFromOrderSheet(admin, order.id, "linha-utilidades"),
    ]);
    expect(a).toBe(b);
    const named = (await store.list("products")).filter(
      (p) => p.name === "Copo duplo",
    );
    expect(named).toHaveLength(1);
  });

  it("NCM da ficha só vai para o produto com 8 dígitos", async () => {
    const store = getStore();
    await pm.saveProductSheet(admin, "prod-piscina", { ncm: "95066900" });
    expect((await store.get("products", "prod-piscina"))!.ncm).toBe(
      "9506.69.00",
    );
    await pm.saveProductSheet(admin, "prod-piscina", { ncm: "9506.69.0012" });
    expect((await store.get("products", "prod-piscina"))!.ncm).toBe(
      "9506.69.00",
    );
  });

  it("tirar as cores Pantone da ficha mestre tira do produto (não voltam)", async () => {
    const store = getStore();
    const color = { code: "PANTONE 185 C", hex: "#E4002B" };
    await pm.saveProductSheet(admin, "prod-piscina", {
      colorPantones: [color],
    });
    expect(
      (await store.get("products", "prod-piscina"))!.colorPantones,
    ).toEqual([color]);
    await pm.saveProductSheet(admin, "prod-piscina", { colorPantones: [] });
    expect(
      (await store.get("products", "prod-piscina"))!.colorPantones ?? null,
    ).toBeNull();
    const input = await pm.masterSheetInput("prod-piscina");
    expect(input?.colorPantones ?? []).toEqual([]);
    // NCM apagado na mestre também sai do produto (não volta).
    await pm.saveProductSheet(admin, "prod-piscina", { ncm: "95066900" });
    await pm.saveProductSheet(admin, "prod-piscina", { ncm: null });
    expect(
      (await store.get("products", "prod-piscina"))!.ncm ?? null,
    ).toBeNull();
    expect((await pm.masterSheetInput("prod-piscina"))?.ncm ?? null).toBeNull();
  });
});
