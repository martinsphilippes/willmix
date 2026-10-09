import { beforeAll, describe, expect, it } from "vitest";
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
