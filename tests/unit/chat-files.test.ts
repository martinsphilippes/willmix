import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Fotos e arquivos no chat (painel lateral e tela de Mensagens): cada arquivo
 * vira uma mensagem, o texto vai junto com o primeiro, e só quem vê o assunto
 * envia e abre. O chat aceita Word, vídeo e GIF; os documentos do processo
 * continuam só com os tipos de antes. Ao abrir, o arquivo fica isolado: SVG
 * sempre baixa e nada do arquivo roda como o portal.
 */
const h = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.current,
}));

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const msg = await import("@/lib/services/messages");
const { uploadDocument } = await import("@/lib/services/documents");
const { chatSendFileAction } = await import("@/app/app/actions/chat");
const { GET } = await import("@/app/api/files/[id]/route");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;
let topicId: string;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  const [own] = await msg.listConversationsFor(joao);
  topicId = (await msg.getConversationView(joao, own.id))!.topic.id;
});

const fileOf = (name: string, type: string, bytes = [1, 2, 3, 4, 5]) =>
  new File([new Uint8Array(bytes)], name, { type });

const formWith = (fields: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

async function send(user: User, fields: Record<string, string | File>) {
  h.current = user;
  return chatSendFileAction(formWith(fields));
}

/** Id da mensagem criada pelo envio (falha no envio: erro no teste). */
const sentId = (res: Awaited<ReturnType<typeof send>>) => {
  if (!res.ok) throw new Error(`envio recusado: ${res.error}`);
  return res.data.id;
};

describe("envio de fotos e arquivos pelo chat", () => {
  it("foto com texto: vira mensagem com a foto e o texto; a conversa mostra a miniatura", async () => {
    const res = await send(joao, {
      topicId,
      body: "  Foto da amostra  ",
      file: fileOf("amostra.jpg", "image/jpeg"),
    });
    const m = (await getStore().get("messages", sentId(res)))!;
    expect(m.body).toBe("Foto da amostra");
    const doc = (await getStore().get("documents", m.attachmentDocumentId!))!;
    expect(doc.conversationTopicId).toBe(topicId);
    const view = (await msg.getConversationView(
      admin,
      m.conversationId,
      topicId,
    ))!;
    expect(view.messages.find((x) => x.id === m.id)?.attachment).toEqual({
      id: doc.id,
      name: "amostra.jpg",
      isImage: true,
      isVideo: false,
      size: 5,
    });
  });

  it("vários arquivos: um por mensagem, sem texto vira o nome do arquivo", async () => {
    const ids: string[] = [];
    for (const name of ["a.png", "b.png"])
      ids.push(
        sentId(await send(joao, { topicId, file: fileOf(name, "image/png") })),
      );
    const bodies = await Promise.all(
      ids.map(async (id) => (await getStore().get("messages", id))?.body),
    );
    expect(bodies).toEqual(["📎 a.png", "📎 b.png"]);
  });

  it("chat aceita Word, vídeo, GIF e o .zip do Windows; TIFF aparece como arquivo (não miniatura)", async () => {
    let tiff = "";
    for (const [name, type] of [
      [
        "contrato.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      ["amostra.mp4", "video/mp4"],
      ["amostra.mov", "video/quicktime"],
      ["giro.gif", "image/gif"],
      ["artes.zip", "application/x-zip-compressed"],
      ["scan.tif", "image/tiff"],
    ])
      tiff = sentId(await send(joao, { topicId, file: fileOf(name, type) }));
    const [own] = await msg.listConversationsFor(joao);
    const view = (await msg.getConversationView(joao, own.id, topicId))!;
    expect(view.messages.find((x) => x.id === tiff)?.attachment?.isImage).toBe(
      false,
    );
  });

  it("os documentos do processo continuam sem Word e vídeo", async () => {
    const request = (await getStore().list("requests"))[0];
    await expect(
      uploadDocument(admin, fileOf("contrato.docx", "application/msword"), {
        type: "attachment",
        requestId: request?.id ?? null,
      }),
    ).rejects.toThrow("mime");
    await expect(
      uploadDocument(admin, fileOf("amostra.mp4", "video/mp4"), {
        type: "attachment",
      }),
    ).rejects.toThrow("mime");
  });

  it("recusas com o motivo: tipo não aceito, arquivo vazio, sem arquivo", async () => {
    const before = (await getStore().list("documents")).length;
    expect(
      await send(joao, {
        topicId,
        file: fileOf("pagina.html", "text/html"),
      }),
    ).toEqual({ ok: false, error: "mime" });
    expect(
      await send(joao, {
        topicId,
        file: fileOf("vazio.pdf", "application/pdf", []),
      }),
    ).toEqual({ ok: false, error: "empty" });
    expect(await send(joao, { topicId, body: "só texto" })).toEqual({
      ok: false,
      error: "upload_missing",
    });
    expect((await getStore().list("documents")).length).toBe(before);
  });

  it("outra empresa não envia na conversa do cliente (nada é gravado)", async () => {
    const docs = (await getStore().list("documents")).length;
    const messages = (await getStore().list("messages")).length;
    const res = await send(supplierA, {
      topicId,
      body: "oi",
      file: fileOf("x.png", "image/png"),
    });
    expect(res.ok).toBe(false);
    expect((await getStore().list("documents")).length).toBe(docs);
    expect((await getStore().list("messages")).length).toBe(messages);
  });
});

describe("abrir o arquivo (/api/files)", () => {
  async function open(user: User, docId: string) {
    h.current = user;
    return GET(new Request(`http://localhost/api/files/${docId}`), {
      params: Promise.resolve({ id: docId }),
    } as never);
  }

  async function attach(name: string, type: string) {
    const m = await msg.postMessage(joao, topicId, "", fileOf(name, type));
    return m.attachmentDocumentId!;
  }

  it("SVG sempre baixa e abre isolado; a foto abre na aba, também isolada", async () => {
    const svg = await open(joao, await attach("arte.svg", "image/svg+xml"));
    expect(svg.status).toBe(200);
    expect(svg.headers.get("Content-Disposition")).toMatch(/^attachment;/);
    expect(svg.headers.get("Content-Security-Policy")).toMatch(/sandbox/);
    expect(svg.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const photo = await open(admin, await attach("foto.png", "image/png"));
    expect(photo.headers.get("Content-Disposition")).toMatch(/^inline;/);
    expect(photo.headers.get("Content-Security-Policy")).toMatch(/sandbox/);
  });

  it("PDF abre na aba (o leitor do navegador não funciona isolado)", async () => {
    const pdf = await open(
      joao,
      await attach("proposta.pdf", "application/pdf"),
    );
    expect(pdf.headers.get("Content-Disposition")).toMatch(/^inline;/);
    expect(pdf.headers.get("Content-Security-Policy")).toBeNull();
    expect(pdf.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("quem não vê o assunto não abre (404) e sem login é 401", async () => {
    const id = await attach("segredo.pdf", "application/pdf");
    expect((await open(supplierA, id)).status).toBe(404);
    h.current = null;
    const anon = await GET(new Request(`http://localhost/api/files/${id}`), {
      params: Promise.resolve({ id }),
    } as never);
    expect(anon.status).toBe(401);
  });
});

describe("vídeo na conversa", () => {
  async function get(user: User, docId: string, range?: string) {
    h.current = user;
    return GET(
      new Request(`http://localhost/api/files/${docId}`, {
        headers: range ? { Range: range } : {},
      }),
      { params: Promise.resolve({ id: docId }) } as never,
    );
  }

  it("MP4 e MOV tocam na conversa; 3GP aparece como arquivo", async () => {
    const bytes = Array.from({ length: 100 }, (_, i) => i);
    const mp4 = await msg.postMessage(
      joao,
      topicId,
      "",
      fileOf("amostra.mp4", "video/mp4", bytes),
    );
    const old = await msg.postMessage(
      joao,
      topicId,
      "",
      fileOf("antigo.3gp", "video/3gpp", bytes),
    );
    const [own] = await msg.listConversationsFor(joao);
    const view = (await msg.getConversationView(joao, own.id, topicId))!;
    expect(
      view.messages.find((m) => m.id === mp4.id)?.attachment?.isVideo,
    ).toBe(true);
    expect(
      view.messages.find((m) => m.id === old.id)?.attachment?.isVideo,
    ).toBe(false);

    // O Safari pede pedaços: 206 com o pedaço exato.
    const id = mp4.attachmentDocumentId!;
    const probe = await get(admin, id, "bytes=0-1");
    expect(probe.status).toBe(206);
    expect(probe.headers.get("Content-Range")).toBe("bytes 0-1/100");
    expect(probe.headers.get("Content-Length")).toBe("2");
    expect([...new Uint8Array(await probe.arrayBuffer())]).toEqual([0, 1]);
    const rest = await get(admin, id, "bytes=90-");
    expect(rest.status).toBe(206);
    expect(rest.headers.get("Content-Range")).toBe("bytes 90-99/100");
    expect([...new Uint8Array(await rest.arrayBuffer())]).toEqual([
      90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
    ]);
    // Fora do arquivo: 416. Sem pedido: o arquivo inteiro, avisando que aceita pedaços.
    const out = await get(admin, id, "bytes=500-");
    expect(out.status).toBe(416);
    expect(out.headers.get("Content-Range")).toBe("bytes */100");
    const whole = await get(admin, id);
    expect(whole.status).toBe(200);
    expect(whole.headers.get("Accept-Ranges")).toBe("bytes");
    expect((await whole.arrayBuffer()).byteLength).toBe(100);
    // Quem não vê o assunto continua sem acesso, com ou sem pedaço.
    expect((await get(supplierA, id, "bytes=0-1")).status).toBe(404);
  });
});
