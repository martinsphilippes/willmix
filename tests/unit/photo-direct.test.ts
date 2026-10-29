import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Fotos que o navegador sobe direto ao armazenamento (lote acima do teto da
 * requisição na Vercel): a ação recebe só os ids e registra as fotos.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { addPhotos } = await import("@/lib/services/sourcing");
const { uploadedPhotoKeys } = await import("@/app/app/actions/helpers");
type User = import("@/lib/db").User;

let admin: User;
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("fotos enviadas direto ao armazenamento", () => {
  it("ids viram fotos do produto; misturam com arquivos do formulário", async () => {
    const store = getStore();
    const a = await store.putFile(jpeg, "a.jpg", "image/jpeg");
    const b = await store.putFile(jpeg, "b.jpg", "image/jpeg");
    const file = new File([jpeg], "c.jpg", { type: "image/jpeg" });
    const added = await addPhotos(
      admin,
      { productId: "prod-panela" },
      [a.key, b.key, file],
      "weight_scale",
    );
    expect(added).toHaveLength(3);
    expect(added.every((p) => p.kind === "weight_scale")).toBe(true);
    // O mesmo id não vale duas vezes.
    await expect(
      addPhotos(admin, { productId: "prod-panela" }, [a.key], "angle"),
    ).rejects.toThrow("upload_missing");
  });

  it("linha da foto recusada (ex.: tipo ainda não publicado no esquema): arquivo e documento não ficam órfãos", async () => {
    const store = getStore();
    const docsBefore = (await store.list("documents")).length;
    const original = store.create.bind(store);
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (table === "product_photos")
          throw new Error("Invalid document structure: kind");
        return original(table, data as never);
      });
    try {
      await expect(
        addPhotos(
          admin,
          { productId: "prod-panela" },
          [new File([jpeg], "a.jpg", { type: "image/jpeg" })],
          "supplier",
        ),
      ).rejects.toThrow("Invalid document structure");
    } finally {
      spy.mockRestore();
    }
    expect((await store.list("documents")).length).toBe(docsBefore);
  });

  it("só a primeira original/comercial toma o lugar da foto do fornecedor; escolhida à mão, ela fica", async () => {
    const store = getStore();
    const img = (name: string) =>
      new File([jpeg], name, { type: "image/jpeg" });
    const [product] = await store.list("products", {
      limit: 1,
      filter: { primaryPhotoDocumentId: null },
    });
    const [supplier] = await addPhotos(
      admin,
      { productId: product.id },
      [img("f.jpg")],
      "supplier",
    );
    expect(supplier.isPrimary).toBe(true);
    const [first] = await addPhotos(
      admin,
      { productId: product.id },
      [img("o.jpg")],
      "original",
    );
    expect(first.isPrimary).toBe(true);
    expect((await store.get("product_photos", supplier.id))!.isPrimary).toBe(
      false,
    );
    // Alguém volta a escolher a foto do fornecedor como principal.
    await store.update("product_photos", first.id, { isPrimary: false });
    await store.update("product_photos", supplier.id, { isPrimary: true });
    await store.update("products", product.id, {
      primaryPhotoDocumentId: supplier.documentId,
    });
    const [second] = await addPhotos(
      admin,
      { productId: product.id },
      [img("c.jpg")],
      "commercial",
    );
    expect(second.isPrimary).toBe(false);
    expect((await store.get("product_photos", supplier.id))!.isPrimary).toBe(
      true,
    );
    expect(
      (await store.get("products", product.id))!.primaryPhotoDocumentId,
    ).toBe(supplier.documentId);
  });

  it("foto do fornecedor rebaixada que também é de um item de sourcing: o ponteiro do item acompanha", async () => {
    const store = getStore();
    const img = (name: string) =>
      new File([jpeg], name, { type: "image/jpeg" });
    const [item] = await store.list("sourcing_items", { limit: 1 });
    const [product] = await store.list("products", {
      limit: 1,
      filter: { primaryPhotoDocumentId: null },
    });
    const [supplier] = await addPhotos(
      admin,
      { sourcingItemId: item.id },
      [img("s.jpg")],
      "supplier",
    );
    expect(
      (await store.get("sourcing_items", item.id))!.primaryPhotoDocumentId,
    ).toBe(supplier.documentId);
    // Item promovido a produto: a mesma foto passa a ser do produto também.
    await store.update("product_photos", supplier.id, {
      productId: product.id,
    });
    await store.update("products", product.id, {
      primaryPhotoDocumentId: supplier.documentId,
    });
    const [original] = await addPhotos(
      admin,
      { productId: product.id },
      [img("o.jpg")],
      "original",
    );
    expect(original.isPrimary).toBe(true);
    expect(
      (await store.get("products", product.id))!.primaryPhotoDocumentId,
    ).toBe(original.documentId);
    expect(
      (await store.get("sourcing_items", item.id))!.primaryPhotoDocumentId,
    ).toBe(original.documentId);
  });

  it("arquivo que não é imagem é recusado e apagado", async () => {
    const store = getStore();
    const pdf = await store.putFile(
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      "x.pdf",
      "application/pdf",
    );
    await expect(
      addPhotos(admin, { productId: "prod-panela" }, [pdf.key], "angle"),
    ).rejects.toThrow("mime");
    expect(await store.statFile(pdf.key)).toBeNull();
  });

  it("só ids no formato do armazenamento, no máximo 12", () => {
    const form = new FormData();
    form.append("uploadedPhotoId", "abc123");
    form.append("uploadedPhotoId", "../../etc/passwd");
    form.append("uploadedPhotoId", "..");
    form.append("uploadedPhotoId", ".hidden");
    form.append("uploadedPhotoId", "x".repeat(65));
    for (let i = 0; i < 20; i++) form.append("uploadedPhotoId", `id${i}`);
    const keys = uploadedPhotoKeys(form);
    expect(keys[0]).toBe("abc123");
    expect(keys).not.toContain("../../etc/passwd");
    expect(keys).not.toContain("..");
    expect(keys).not.toContain(".hidden");
    expect(keys).toHaveLength(12);
  });
});
