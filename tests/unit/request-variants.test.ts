import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { variantSnapshot } from "@/lib/variants";

/*
 * Variações de produto na venda (fase 2): a solicitação exige a variação
 * (`variant_required` / `variant_invalid`), guarda a cópia dos valores, usa
 * o MOQ e a especificação dela e leva "Produto · Variação" no nome; o lote e
 * a recompra carregam a variação; a ficha de cotação nasce com os dados
 * físicos dela (preço e MOQ só para o fornecedor de referência); o pedido
 * copia variação e snapshot; a ficha adotada grava na variação e o produto
 * espelha a de referência. Produto sem variações: tudo como antes.
 */
withTempStore();

const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const pv = await import("@/lib/services/product-variants");
const qs = await import("@/lib/services/quote-sheet");
const ps = await import("@/lib/services/purchase-sheet");
const pm = await import("@/lib/services/product-sheet");
const vs = await import("@/lib/services/variant-sales");
const { getSnapshotForOrder } = await import("@/lib/services/snapshots");
const { parseRequestItems } = await import("@/app/app/actions/request-items");
type User = import("@/lib/db").User;
type ProductVariant = import("@/lib/db").ProductVariant;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;
let productId: string;
let a: ProductVariant;
let b: ProductVariant;
let otherVariant: ProductVariant;

const input = (
  variantId: string | null,
  quantity: number,
  extra: Partial<Parameters<typeof r.createRequest>[1]> = {},
) => ({
  customerId: "cliente-joao",
  productId,
  variantId,
  productName: "Porta-retrato",
  description: "Porta-retrato para revenda",
  specification: null,
  quantity,
  unit: "un",
  ...extra,
});

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
  const store = getStore();
  const product = await store.create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId: "linha-utilidades",
    name: "Porta-retrato",
    sku: null,
    specification: null,
    active: true,
    source: "manual",
    supplierId: "fornecedor-a",
    moq: 100,
    category: "Decoração",
  });
  productId = product.id;
  a = (
    await pv.upsertProductVariant(admin, productId, {
      name: "STONE MARBLE A4",
      factoryItemCode: "1",
      price: 4,
      currency: "USD",
      moq: 2400,
      masterBoxQty: 12,
      innerBoxQty: 12,
      netWeightKg: 0.225,
      grossWeightKg: 0.3,
      cbm: 0.0183,
      lengthCm: 33.5,
      widthCm: 24.8,
      heightCm: 1.53,
      colorAssortment: "White / Gray",
      material: "PS+PVC",
      sortOrder: 0,
    })
  ).variant;
  b = (
    await pv.upsertProductVariant(admin, productId, {
      name: "WD STRIBY VERT 8X10",
      factoryItemCode: "MY-059A",
      price: 3.15,
      currency: "USD",
      moq: 1200,
      masterBoxQty: 24,
      innerBoxQty: 6,
      netWeightKg: 0.186,
      grossWeightKg: 0.25,
      cbm: 0.0267,
      lengthCm: 27.2,
      widthCm: 22.2,
      heightCm: 1.4,
      colorAssortment: "Bege / Carvalho",
      material: "MDF",
      packageType: "Shrink + OPP",
      sortOrder: 1,
    })
  ).variant;
  // Produto e ficha mestre espelham a de referência (B, a mais barata).
  await pv.syncProductFromVariants(productId, admin);
  const other = await store.create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId: "linha-utilidades",
    name: "Outro produto",
    sku: null,
    specification: null,
    active: true,
    source: "manual",
  });
  otherVariant = (
    await pv.upsertProductVariant(admin, other.id, { name: "Única", price: 1 })
  ).variant;
});

describe("regras puras", () => {
  it("nome da solicitação: Produto · Variação; nome digitado fica e ganha a variação; cortado em 160", () => {
    expect(vs.requestProductName("", "Porta-retrato", "A4")).toBe("Porta-retrato · A4");
    expect(vs.requestProductName("porta-retrato", "Porta-retrato", "A4")).toBe("Porta-retrato · A4");
    expect(vs.requestProductName("Meu quadro", "Porta-retrato", "A4")).toBe("Meu quadro · A4");
    expect(vs.requestProductName("Meu quadro a4", "Porta-retrato", "A4")).toBe("Meu quadro a4");
    expect(vs.requestProductName("", "x".repeat(170), "A4")).toHaveLength(160);
  });

  it("ficha a partir da variação: físicos para qualquer fornecedor; comerciais à parte", () => {
    const snap = variantSnapshot(b);
    expect(vs.masterInputFromVariant(snap)).toEqual({
      masterCartonQty: 24,
      innerQty: 6,
      netWeightPcKg: 0.186,
      grossWeightPcKg: 0.25,
      cbmPerCarton: 0.0267,
      colorAssortment: "Bege / Carvalho",
      material: "MDF",
      packageType: "Shrink + OPP",
    });
    expect(vs.commercialInputFromVariant(snap)).toEqual({
      price: 3.15,
      currency: "USD",
      moq: 1200,
      factoryItemCode: "MY-059A",
    });
    expect(vs.commercialInputFromVariant({ ...snap, currency: "CNY" }).currency).toBe("RMB");
    expect(vs.requestVariantLabel({ variant: snap })).toBe("WD STRIBY VERT 8X10");
    expect(vs.requestVariantLabel({ variant: null })).toBeNull();
    expect(
      vs.variantSnapshotSummary(
        snap,
        { price: "Preço", moq: "MOQ", box: "Caixa", cbm: "CBM" },
        "pt-BR",
      ),
    ).toMatch(/^Preço: US\$\s?3,15 · MOQ: 1\.200 · Caixa: 24 \/ 6 · CBM: 0,0267$/);
  });

  it("a variação sai da ficha para o produto; comerciais só quando pedido", () => {
    const sheet = { price: 9, currency: "RMB" as const, moq: 50, masterCartonQty: 36, ncm: "3924.90.00" };
    expect(vs.variantInputFromSheet(sheet, { commercial: true })).toEqual({
      price: 9,
      currency: "CNY",
      moq: 50,
      masterBoxQty: 36,
    });
    expect(vs.variantInputFromSheet(sheet, { commercial: false })).toEqual({ masterBoxQty: 36 });
    expect(vs.sheetWithoutVariantFields(sheet)).toEqual({ ncm: "3924.90.00" });
  });
});

describe("solicitação com variação", () => {
  it("produto com variações exige a variação; de outro produto ou desativada é recusada", async () => {
    await expect(r.createRequest(joao, input(null, 2400))).rejects.toThrow("variant_required");
    await expect(r.createRequest(joao, input(otherVariant.id, 2400))).rejects.toThrow("variant_invalid");
    await expect(r.createRequest(admin, input("nao-existe", 2400))).rejects.toThrow("variant_invalid");
    await pv.setProductVariantActive(admin, a.id, false);
    await expect(r.createRequest(joao, input(a.id, 2400))).rejects.toThrow("variant_invalid");
    await pv.setProductVariantActive(admin, a.id, true);
    // Nada foi criado.
    expect(await getStore().list("requests", { filter: { productId } })).toHaveLength(0);
  });

  it("o mínimo é o da variação (vence a ficha mestre e o cadastro)", async () => {
    expect(await r.productMoq(productId, a.id)).toBe(2400);
    expect(await r.productMoq(productId, b.id)).toBe(1200);
    // Sem variação: a ficha mestre espelha a de referência (B).
    expect(await r.productMoq(productId)).toBe(1200);
    await expect(r.createRequest(joao, input(a.id, 1500))).rejects.toThrow("below_moq");
    await expect(r.createRequest(admin, input(a.id, 2399))).rejects.toThrow("below_moq");
    // Em caixas não se compara.
    await expect(r.createRequest(joao, input(a.id, 10, { unit: "cx" }))).resolves.toBeTruthy();
  });

  it("válida: variação, cópia dos valores, nome 'Produto · Variação' e especificação da variação", async () => {
    const request = await r.createRequest(joao, input(b.id, 1200));
    expect(request.variantId).toBe(b.id);
    expect(request.variant).toEqual(variantSnapshot((await pv.getProductVariant(b.id))!));
    expect(request.productName).toBe("Porta-retrato · WD STRIBY VERT 8X10");
    expect(request.specification).toContain("Material: MDF");
    expect(request.specification).toContain("Cor: Bege / Carvalho");
    expect(request.specification).toContain("Caixa master: 24 peças");
    expect(request.specification).toContain("0,0267 m³");
    expect(request.specification).toContain("27,2 × 22,2 × 1,4 cm");
    // Nome digitado pelo cliente fica, com a variação; especificação escrita fica.
    const custom = await r.createRequest(joao, input(b.id, 1200, {
      productName: "Quadro da sala",
      specification: "Com vidro",
    }));
    expect(custom.productName).toBe("Quadro da sala · WD STRIBY VERT 8X10");
    expect(custom.specification).toBe("Com vidro");
  });

  it("lote: cada linha leva a própria variação; linha sem variação derruba o lote", async () => {
    const form = new FormData();
    form.set("p0.productId", productId);
    form.set("p0.variantId", a.id);
    form.set("p0.description", "A");
    form.set("p0.quantity", "2400");
    form.set("p1.productId", productId);
    form.set("p1.description", "B");
    form.set("p1.quantity", "1200");
    const rows = parseRequestItems(form);
    expect(rows.map((x) => x.variantId)).toEqual([a.id, null]);
    const base = { customerId: "cliente-joao", deadline: null, notes: null, requestedForUserId: joao.id };
    const item = (variantId: string | null, quantity: number) => ({
      productId,
      variantId,
      productName: "Porta-retrato",
      description: "x",
      specification: null,
      quantity,
      unit: "un",
      sourcingDemand: false,
    });
    const created = await r.createRequestBatch(joao, base, [item(a.id, 2400), item(b.id, 1200)]);
    expect(created.map((x) => x.variantId)).toEqual([a.id, b.id]);
    expect(created.map((x) => x.productName)).toEqual([
      "Porta-retrato · STONE MARBLE A4",
      "Porta-retrato · WD STRIBY VERT 8X10",
    ]);
    expect(created[0].groupId).toBe(created[1].groupId);
    const before = (await getStore().list("requests")).length;
    await expect(
      r.createRequestBatch(joao, base, [item(a.id, 2400), item(null, 1200)]),
    ).rejects.toThrow("variant_required");
    const after = await getStore().list("requests");
    expect(after.slice(before).every((x) => x.status === "CANCELLED")).toBe(true);
  });

  it("produto sem variações: nada muda (e variação nele é recusada)", async () => {
    const plain = await r.createRequest(joao, input(null, 10, { productId: "prod-jarra", productName: "Jarra" }));
    expect(plain.variantId ?? null).toBeNull();
    expect(plain.variant ?? null).toBeNull();
    expect(plain.productName).toBe("Jarra");
    await expect(
      r.createRequest(joao, input(b.id, 10, { productId: "prod-jarra", productName: "Jarra" })),
    ).rejects.toThrow("variant_invalid");
    // Fora do catálogo: a variação é ignorada.
    const free = await r.createRequest(joao, input(b.id, 10, { productId: null, productName: "Livre" }));
    expect(free.variantId ?? null).toBeNull();
  });
});

describe("cotação, pedido, adoção e recompra", () => {
  let orderId: string;

  it("ficha de cotação nasce com os dados físicos da variação; preço, MOQ e código só para o fornecedor de referência", async () => {
    const store = getStore();
    // FOB/EXW na ficha mestre: vai só para o fornecedor de referência.
    await pm.saveProductSheet(admin, productId, { incoterm: "EXW" });
    const request = await r.createRequest(joao, input(b.id, 1200));
    await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
    const quotes = await store.list("quotes", { filter: { requestId: request.id } });
    const qa = quotes.find((q) => q.supplierId === "fornecedor-a")!;
    const qb = quotes.find((q) => q.supplierId === "fornecedor-b")!;
    const viewA = (await qs.getQuoteSheetForUser(supplierA, qa.id))!;
    expect(viewA.sheet).toMatchObject({
      masterCartonQty: 24,
      innerQty: 6,
      netWeightPcKg: 0.186,
      grossWeightPcKg: 0.25,
      cbmPerCarton: 0.0267,
      colorAssortment: "Bege / Carvalho",
      material: "MDF",
      packageType: "Shrink + OPP",
      price: 3.15,
      currency: "USD",
      moq: 1200,
      factoryItemCode: "MY-059A",
      incoterm: "EXW",
    });
    const viewB = (await qs.getQuoteSheetForUser(supplierB, qb.id))!;
    expect(viewB.sheet).toMatchObject({
      masterCartonQty: 24,
      innerQty: 6,
      cbmPerCarton: 0.0267,
      material: "MDF",
      packageType: "Shrink + OPP",
    });
    expect(viewB.sheet.price ?? null).toBeNull();
    expect(viewB.sheet.moq ?? null).toBeNull();
    expect(viewB.sheet.incoterm ?? null).toBeNull();
    expect(viewB.sheet.factoryItemCode ?? null).not.toBe("MY-059A");

    // A (referência) responde com a ficha: preço e caixa diferentes da variação.
    await qs.saveQuoteSheet(supplierA, qa.id, {
      price: 3.4,
      currency: "USD",
      masterCartonQty: 36,
      packageType: "GIFT BOX",
    });
    await r.answerQuote(supplierA, qa.id, { price: 3.4, currency: "USD", leadTimeDays: 30 });
    await r.selectQuote(admin, qa.id, { sellPrice: 9000, sellCurrency: "BRL" });
    const order = await r.confirmDownPayment(admin, request.id);
    orderId = order.id;

    // O item e o snapshot de compra levam a variação.
    const [item] = await store.list("order_items", { filter: { orderId: order.id } });
    expect(item.variantId).toBe(b.id);
    expect(item.variant).toEqual(request.variant);
    expect(item.name).toBe("Porta-retrato · WD STRIBY VERT 8X10");
    const snapshot = (await getSnapshotForOrder(order.id))!;
    expect(snapshot).toMatchObject({
      variantId: b.id,
      unitPrice: 3.4,
      moq: 1200,
      masterBoxQty: 24,
      innerBoxQty: 6,
      netWeightKg: 0.186,
      lengthCm: 27.2,
      widthCm: 22.2,
      heightCm: 1.4,
      cbm: 0.0267,
      color: "Bege / Carvalho",
      material: "MDF",
      supplierSku: "MY-059A",
    });

    // Adoção: a ficha do pedido grava na VARIAÇÃO (fornecedor de referência:
    // preço também); a outra variação não muda; o produto espelha a referência.
    const bNow = (await pv.getProductVariant(b.id))!;
    expect(bNow).toMatchObject({ price: 3.4, masterBoxQty: 36, packageType: "GIFT BOX", moq: 1200 });
    expect(await pv.getProductVariant(a.id)).toMatchObject({ price: 4, masterBoxQty: 12 });
    const product = (await store.get("products", productId))!;
    expect(product).toMatchObject({ price: 3.4, masterBoxQty: 36 });
    expect((await pm.getProductSheet(productId))!.packageType).toBe("GIFT BOX");
  });

  it("ficha do pedido salva pela Wellmix atualiza a variação; o fornecedor só completa; 'atualizar o cadastro' também vai à variação", async () => {
    const store = getStore();
    await ps.saveSheet(admin, orderId, { netWeightPcKg: 0.2 });
    expect((await pv.getProductVariant(b.id))!.netWeightKg).toBe(0.2);
    expect((await store.get("products", productId))!.netWeightKg).toBe(0.2);
    // Fornecedor: não troca o que a variação já tem.
    await ps.saveSheet(supplierA, orderId, { grossWeightPcKg: 0.9, innerQty: 8 });
    expect((await pv.getProductVariant(b.id))!).toMatchObject({ grossWeightKg: 0.25, innerBoxQty: 6 });
    expect((await store.get("products", productId))!.grossWeightKg).toBe(0.25);
    // "Atualizar o cadastro com esta ficha" (Wellmix): a variação recebe a ficha do pedido.
    await pm.adoptSheetIntoProduct(admin, orderId);
    expect((await pv.getProductVariant(b.id))!).toMatchObject({ grossWeightKg: 0.9, innerBoxQty: 8 });
    expect((await store.get("products", productId))!).toMatchObject({ grossWeightKg: 0.9, innerBoxQty: 8 });
  });

  it("recompra leva a mesma variação (cópia refeita com os valores de hoje) e respeita o mínimo dela", async () => {
    await expect(
      r.createFollowUpRequest(joao, orderId, { quantity: 100, origin: "replenishment" }),
    ).rejects.toThrow("below_moq");
    const again = await r.createFollowUpRequest(joao, orderId, { quantity: 1200, origin: "replenishment" });
    expect(again.variantId).toBe(b.id);
    expect(again.variant).toMatchObject({ id: b.id, price: 3.4, masterBoxQty: 36 });
    expect(again.productName).toBe("Porta-retrato · WD STRIBY VERT 8X10");
  });

  it("compra com outro fornecedor: a variação só completa o que falta, sem preço nem MOQ", async () => {
    const store = getStore();
    const request = await r.createRequest(joao, input(a.id, 2400));
    await r.openRfq(admin, request.id, ["fornecedor-b"]);
    const [qb] = await store.list("quotes", { filter: { requestId: request.id } });
    await qs.saveQuoteSheet(supplierB, qb.id, {
      price: 9,
      currency: "USD",
      moq: 50,
      masterCartonQty: 99,
      material: "PLASTIC B",
      packageType: "BOX B",
    });
    await r.answerQuote(supplierB, qb.id, { price: 9, currency: "USD", leadTimeDays: 30 });
    await r.selectQuote(admin, qb.id, { sellPrice: 30000, sellCurrency: "BRL" });
    await r.confirmDownPayment(admin, request.id);
    const aNow = (await pv.getProductVariant(a.id))!;
    // Preço, MOQ, caixa e material de A ficam; a embalagem (em branco) é completada.
    expect(aNow).toMatchObject({ price: 4, moq: 2400, masterBoxQty: 12, material: "PS+PVC", packageType: "BOX B" });
    // A referência continua B: o produto não muda por esta compra.
    expect((await store.get("products", productId))!).toMatchObject({ price: 3.4, masterBoxQty: 36 });
  });
});
