import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Arquivo que o navegador já subiu direto ao armazenamento: o servidor só registra. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { registerUploadedDocument } = await import("@/lib/services/documents");
const { createUploadToken, SERVER_UPLOAD_BYTES } =
  await import("@/lib/services/uploads");
type User = import("@/lib/db").User;

let admin: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("envio direto ao armazenamento", () => {
  it("registra o documento a partir do arquivo já no armazenamento, uma vez só", async () => {
    const store = getStore();
    const stored = await store.putFile(
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      "arte.pdf",
      "application/pdf",
    );
    expect(await store.statFile(stored.key)).toMatchObject({
      name: "arte.pdf",
      mime: "application/pdf",
      size: 5,
    });
    const doc = await registerUploadedDocument(admin, stored.key, {
      type: "other",
    });
    expect(doc).toMatchObject({
      name: "arte.pdf",
      mime: "application/pdf",
      size: 5,
      storageKey: stored.key,
      uploadedByUserId: admin.id,
    });
    // O mesmo arquivo não vira dois documentos.
    await expect(
      registerUploadedDocument(admin, stored.key, { type: "other" }),
    ).rejects.toThrow("upload_missing");
    // Id que não existe no armazenamento.
    await expect(
      registerUploadedDocument(admin, "00000000-0000-4000-8000-000000000000", {
        type: "other",
      }),
    ).rejects.toThrow("upload_missing");
    // Download em fluxo devolve os mesmos bytes.
    const stream = await store.streamFile(stored.key);
    expect(stream?.size).toBe(5);
    const bytes = new Uint8Array(
      await new Response(stream!.body).arrayBuffer(),
    );
    expect(Array.from(bytes)).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });

  it("tipo não aceito é recusado e o arquivo apagado", async () => {
    const store = getStore();
    const stored = await store.putFile(
      new Uint8Array([1, 2, 3]),
      "virus.exe",
      "application/x-msdownload",
    );
    await expect(
      registerUploadedDocument(admin, stored.key, { type: "other" }),
    ).rejects.toThrow("mime");
    expect(await store.statFile(stored.key)).toBeNull();
  });

  it("sem Appwrite, o token diz que só há envio pelo servidor (4 MB)", async () => {
    expect(await createUploadToken(admin)).toEqual({
      mode: "server",
      maxBytes: SERVER_UPLOAD_BYTES,
    });
  });
});
