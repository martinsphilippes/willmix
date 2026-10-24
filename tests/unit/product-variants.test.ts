import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { PNG_1X1 } from "./xlsx-fixture";
import {
  referenceVariant,
  sortVariants,
  variantKey,
  variantSnapshot,
} from "@/lib/variants";

/*
 * Variações de produto (fase 1): chave e referência (regras puras), upsert
 * pela chave, edição, desativar, foto, e o espelho da variação de referência
 * nas colunas do produto e na ficha mestre. Só a Wellmix grava. A foto de uma
 * variação é visível ao cliente como as outras do catálogo, sem o teto de 8.
 */
withTempStore();

const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/product-variants");
const { getProductSheet } = await import("@/lib/services/product-sheet");
const { addPhotos } = await import("@/lib/services/sourcing");
const { canAccessDocument } = await import("@/lib/services/documents");
type User = import("@/lib/db").User;
type ProductVariant = import("@/lib/db").ProductVariant;

let admin: User;
let joao: User;
let productId: string;

const png = (name: string) =>
  new File([new Uint8Array(PNG_1X1)], name, { type: "image/png" });

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  const store = getStore();
  const line = (await store.list("product_lines", { orderBy: "name" }))[0];
  const product = await store.create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId: line.id,
    name: "Porta-retrato variações",
    sku: null,
    specification: null,
    active: true,
    source: "manual",
  });
  productId = product.id;
});

const v = (
  partial: Partial<ProductVariant> & { id: string },
): ProductVariant => ({
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  productId: "p",
  name: partial.id,
  key: partial.id,
  sortOrder: null,
  active: true,
  factoryItemCode: null,
  sizeText: null,
  price: null,
  currency: null,
  moq: null,
  masterBoxQty: null,
  innerBoxQty: null,
  netWeightKg: null,
  grossWeightKg: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  cbm: null,
  colorAssortment: null,
  material: null,
  packageType: null,
  capacityMl: null,
  notes: null,
  photoDocumentId: null,
  importBatchId: null,
  ...partial,
});

describe("regras puras", () => {
  it("chave normalizada: código + nome, minúsculas, sem acentos nem espaços repetidos, até 80", () => {
    expect(variantKey({ factoryItemCode: " MY-059A ", name: "WD  STRIBY Vért 8X10 / 20X25" })).toBe(
      "my-059a|wd striby vert 8x10 / 20x25",
    );
    expect(variantKey({ name: "Grécie 4x6" })).toBe("|grecie 4x6");
    expect(variantKey({ factoryItemCode: "x".repeat(50), name: "y".repeat(50) })).toHaveLength(80);
  });

  it("referência: menor preço entre as ativas; empate pela ordem; sem preço, a primeira ativa", () => {
    const a = v({ id: "a", price: 4, sortOrder: 0 });
    const b = v({ id: "b", price: 3.15, sortOrder: 1 });
    const c = v({ id: "c", price: 3.15, sortOrder: 2 });
    const off = v({ id: "off", price: 1, sortOrder: 3, active: false });
    expect(referenceVariant([a, b, c, off])?.id).toBe("b");
    expect(referenceVariant([c, b, a])?.id).toBe("b");
    expect(referenceVariant([v({ id: "n1" }), v({ id: "n2", price: 0 })])?.id).toBe("n1");
    expect(referenceVariant([off])).toBeNull();
    expect(referenceVariant([])).toBeNull();
    expect(sortVariants([c, v({ id: "z" }), a]).map((x) => x.id)).toEqual(["a", "c", "z"]);
  });

  it("snapshot: só os valores que viajam para solicitação e pedido", () => {
    const snap = variantSnapshot(
      v({ id: "s", name: "GRECIE", factoryItemCode: "G1", price: 2, currency: "USD", moq: 500, notes: "x", sizeText: "4X6" }),
    );
    expect(snap).toEqual({
      id: "s", name: "GRECIE", factoryItemCode: "G1", price: 2, currency: "USD", moq: 500,
      masterBoxQty: null, innerBoxQty: null, netWeightKg: null, grossWeightKg: null,
      lengthCm: null, widthCm: null, heightCm: null, cbm: null, colorAssortment: null, material: null, packageType: null,
    });
    expect("notes" in snap).toBe(false);
  });
});

describe("serviço", () => {
  it("upsert pela chave: cria, depois atualiza a mesma variação; textos cortados no tamanho da coluna", async () => {
    const first = await svc.upsertProductVariant(admin, productId, {
      name: "STONE MARBLE A4",
      factoryItemCode: "1",
      price: 4,
      currency: "USD",
      moq: 2400,
      masterBoxQty: 12,
      innerBoxQty: 12,
      netWeightKg: 0.225,
      cbm: 0.0183,
      lengthCm: 33.5,
      widthCm: 24.8,
      heightCm: 1.53,
      colorAssortment: "White / Gray / bege",
      material: "PS+PVC",
      packageType: "Shrink + OPP + sticker",
      sortOrder: 0,
    });
    expect(first.created).toBe(true);
    expect(first.variant).toMatchObject({ productId, key: "1|stone marble a4", active: true, sortOrder: 0, price: 4 });
    const second = await svc.upsertProductVariant(admin, productId, {
      name: "WD STRIBY VERT 8X10 / 20X25",
      factoryItemCode: "MY-059A",
      price: 3.15,
      currency: "RMB",
      moq: 2400,
      masterBoxQty: 24,
      netWeightKg: 0.186,
      cbm: 0.0267,
      lengthCm: 27.2,
      widthCm: 22.2,
      heightCm: 1.4,
      colorAssortment: "BEGE / CARVALHO / MARROM",
      material: "x".repeat(300),
    });
    expect(second.created).toBe(true);
    // RMB vira CNY (convenção do produto); material cortado em 200; ordem no fim.
    expect(second.variant).toMatchObject({ currency: "CNY", sortOrder: 1 });
    expect(second.variant.material).toHaveLength(200);
    // Mesma chave (código + nome, sem caixa nem espaços repetidos): atualiza, não duplica.
    const again = await svc.upsertProductVariant(admin, productId, {
      name: "stone  marble a4",
      factoryItemCode: "1",
      price: 4.5,
    });
    expect(again.created).toBe(false);
    expect(again.variant.id).toBe(first.variant.id);
    // Campo ausente não mexe; o nome gravado é o do último upsert.
    expect(again.variant).toMatchObject({ price: 4.5, moq: 2400, masterBoxQty: 12, name: "stone marble a4" });
    const list = await svc.listProductVariants(productId);
    expect(list.map((x) => x.id)).toEqual([first.variant.id, second.variant.id]);
    expect((await svc.variantsByProduct([productId])).get(productId)?.length).toBe(2);
    expect(await svc.getProductVariant(second.variant.id)).toMatchObject({ factoryItemCode: "MY-059A" });
  });

  it("sync: colunas do produto e ficha mestre espelham a variação de referência (menor preço)", async () => {
    await svc.syncProductFromVariants(productId, admin);
    const store = getStore();
    const product = (await store.get("products", productId))!;
    expect(product).toMatchObject({
      price: 3.15, currency: "CNY", moq: 2400, masterBoxQty: 24, netWeightKg: 0.186, cbm: 0.0267,
      lengthCm: 27.2, widthCm: 22.2, heightCm: 1.4, supplierSku: "MY-059A",
    });
    expect(product.color).toBe("BEGE / CARVALHO / MARROM");
    expect(product.material).toHaveLength(120);
    const sheet = (await getProductSheet(productId))!;
    expect(sheet).toMatchObject({ price: 3.15, currency: "RMB", moq: 2400, masterCartonQty: 24, cbmPerCarton: 0.0267, factoryItemCode: "MY-059A" });
    // Variação sem o campo não apaga o que a ficha já tinha (innerQty veio da primeira).
    expect(product.innerBoxQty).toBeNull();
  });

  it("desativar tira da lista e troca a referência; reativar volta", async () => {
    const store = getStore();
    const [a, b] = await svc.listProductVariants(productId);
    await svc.setProductVariantActive(admin, b.id, false);
    expect((await svc.listProductVariants(productId)).map((x) => x.id)).toEqual([a.id]);
    expect((await svc.listProductVariants(productId, { includeInactive: true })).map((x) => x.id)).toEqual([a.id, b.id]);
    expect((await svc.variantsByProduct([productId])).get(productId)?.map((x) => x.id)).toEqual([a.id]);
    await svc.syncProductFromVariants(productId, admin);
    expect((await store.get("products", productId))!).toMatchObject({ price: 4.5, currency: "USD", masterBoxQty: 12, innerBoxQty: 12, supplierSku: "1", lengthCm: 33.5 });
    await svc.setProductVariantActive(admin, b.id, true);
    expect((await svc.listProductVariants(productId)).length).toBe(2);
    // Produto sem variação ativa: o sync não mexe em nada.
    const other = await store.create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      lineId: (await store.get("products", productId))!.lineId,
      name: "Sem variação",
      sku: null,
      specification: null,
      active: true,
      source: "manual",
      price: 9,
    });
    await svc.syncProductFromVariants(other.id, admin);
    expect((await store.get("products", other.id))!.price).toBe(9);
    expect(await getProductSheet(other.id)).toBeNull();
  });

  it("editar: nome/código novos mudam a chave; chave de outra variação é recusada; nome vazio também", async () => {
    const [a, b] = await svc.listProductVariants(productId);
    const edited = await svc.updateProductVariant(admin, a.id, { name: "STONE MARBLE A4", sizeText: "A4", moq: 3000 });
    expect(edited).toMatchObject({ key: "1|stone marble a4", sizeText: "A4", moq: 3000, price: 4.5 });
    await expect(
      svc.updateProductVariant(admin, a.id, { name: b.name, factoryItemCode: b.factoryItemCode }),
    ).rejects.toThrow("variant_duplicate");
    await expect(svc.updateProductVariant(admin, a.id, { name: "   " })).rejects.toThrow("variant_name_required");
    await expect(svc.updateProductVariant(admin, "nao-existe", { name: "x" })).rejects.toThrow("variant_not_found");
    await expect(svc.upsertProductVariant(admin, "nao-existe", { name: "x" })).rejects.toThrow("product_not_found");
  });

  it("só a Wellmix cria, edita, desativa ou troca a foto", async () => {
    const [a] = await svc.listProductVariants(productId);
    await expect(svc.upsertProductVariant(joao, productId, { name: "Nova" })).rejects.toThrow("forbidden");
    await expect(svc.updateProductVariant(joao, a.id, { name: "Nova" })).rejects.toThrow("forbidden");
    await expect(svc.setProductVariantActive(joao, a.id, false)).rejects.toThrow("forbidden");
    await expect(svc.setProductVariantPhoto(joao, a.id, null)).rejects.toThrow("forbidden");
  });

  it("foto da variação: gravada com variantId e visível ao cliente, mesmo além das 8 da vitrine", async () => {
    const store = getStore();
    const [a, b] = await svc.listProductVariants(productId);
    const [photoA] = await addPhotos(admin, { productId, variantId: a.id }, [png("a.png")], "supplier");
    expect(photoA.variantId).toBe(a.id);
    expect(photoA.isPrimary).toBe(true);
    await svc.setProductVariantPhoto(admin, a.id, photoA.documentId);
    expect((await svc.getProductVariant(a.id))!.photoDocumentId).toBe(photoA.documentId);
    // Foto sem variação continua sem a coluna.
    const [plain] = await addPhotos(admin, { productId }, [png("p.png")], "other");
    expect(plain.variantId ?? null).toBeNull();
    // Mais 8 fotos do fornecedor: a da variação B (também do fornecedor, mais
    // nova) fica fora das 8 da vitrine, que vão por tipo e data.
    for (let i = 0; i < 8; i++) await addPhotos(admin, { productId }, [png(`o${i}.png`)], "supplier");
    const [photoB] = await addPhotos(admin, { productId, variantId: b.id }, [png("b.png")], "supplier");
    const { catalogShowcasePhotos } = await import("@/lib/services/documents");
    const shown = (await catalogShowcasePhotos([productId])).get(productId)!;
    expect(shown).toHaveLength(8);
    expect(shown.some((p) => p.documentId === photoB.documentId)).toBe(false);
    const docB = (await store.get("documents", photoB.documentId))!;
    expect(await canAccessDocument(joao, docB)).toBe(true);
    // Tipos escondidos continuam fechados; produto inativo também.
    const [card] = await addPhotos(admin, { productId }, [png("card.png")], "business_card");
    expect(await canAccessDocument(joao, (await store.get("documents", card.documentId))!)).toBe(false);
    await store.update("products", productId, { active: false });
    try {
      expect(await canAccessDocument(joao, docB)).toBe(false);
    } finally {
      await store.update("products", productId, { active: true });
    }
  });
});
