import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Cadastro de produtos: excluir (desativar) e restaurar vários de uma vez. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setProductsActive } = await import("@/lib/services/product-delete");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

describe("excluir produtos em lote", () => {
  it("desativa os selecionados, registra na auditoria e restaura", async () => {
    const store = getStore();
    const products = (
      await store.list("products", { filter: { active: true } })
    ).slice(0, 2);
    const ids = products.map((p) => p.id);
    const result = await setProductsActive(
      admin,
      [...ids, ids[0], "nao-existe"],
      false,
    );
    expect(result.changed).toBe(2);
    for (const id of ids)
      expect((await store.get("products", id))!.active).toBe(false);
    const log = await store.list("audit_log", {
      filter: { action: "product.delete" },
    });
    expect(log.map((l) => l.entityId).sort()).toEqual([...ids].sort());
    // De novo: nada muda.
    expect((await setProductsActive(admin, ids, false)).changed).toBe(0);
    // Restaurar.
    expect((await setProductsActive(admin, ids, true)).changed).toBe(2);
    for (const id of ids)
      expect((await store.get("products", id))!.active).toBe(true);
  });

  it("cliente não exclui produto", async () => {
    const [p] = await getStore().list("products", { limit: 1 });
    await expect(setProductsActive(joao, [p.id], false)).rejects.toThrow();
    expect((await getStore().get("products", p.id))!.active).toBe(true);
  });
});

describe("excluir definitivamente", () => {
  it("apaga o produto excluído sem histórico (com variações, ficha, fotos) e mantém o que tem histórico", async () => {
    const store = getStore();
    const { purgeProducts } = await import("@/lib/services/product-delete");
    const { upsertProductVariant } =
      await import("@/lib/services/product-variants");
    const { addPhotos } = await import("@/lib/services/sourcing");
    const [line] = await store.list("product_lines", { limit: 1 });
    const fresh = await store.create("products", {
      ...(await store.list("products", { limit: 1 }))[0],
      id: undefined,
      name: "Produto para apagar",
      sku: null,
      lineId: line.id,
      active: true,
      primaryPhotoDocumentId: null,
    } as never);
    await upsertProductVariant(admin, fresh.id, { name: "A4" });
    const [photo] = await addPhotos(
      admin,
      { productId: fresh.id },
      [
        new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "a.jpg", {
          type: "image/jpeg",
        }),
      ],
      "other",
    );
    // Produto com histórico: tem item de pedido.
    const used = (await store.list("products", { filter: { active: true } }))[0]
      .id;
    await store.create("order_items", {
      orderId: "pedido-teste",
      productId: used,
      name: "x",
      quantity: 1,
      unit: "un",
      unitPrice: null,
    } as never);
    await setProductsActive(admin, [fresh.id, used], false);
    // Ativo não sai de vez; operador não pode.
    const operator = (
      await store.list("users", { filter: { role: "operator" }, limit: 1 })
    )[0];
    await expect(purgeProducts(operator, [fresh.id])).rejects.toThrow();
    const result = await purgeProducts(admin, [fresh.id, used]);
    expect(result).toMatchObject({ purged: 1, blocked: 1 });
    expect(await store.get("products", fresh.id)).toBeNull();
    expect(
      await store.list("product_variants", { filter: { productId: fresh.id } }),
    ).toEqual([]);
    expect(await store.get("product_photos", photo.id)).toBeNull();
    expect(await store.get("documents", photo.documentId)).toBeNull();
    expect(await store.get("products", used)).not.toBeNull();
    const log = await store.list("audit_log", {
      filter: { action: "product.purge" },
    });
    expect(log.map((l) => l.entityId)).toEqual([fresh.id]);
    await setProductsActive(admin, [used], true);
  });
});
