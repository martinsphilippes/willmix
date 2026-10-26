import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Anexos do chat: o arquivo só abre para quem vê o assunto (empresa da
 * conversa e Wellmix); outra empresa nunca. A limpeza dos dados de teste
 * apaga mensagens, assuntos, conversas e anexos.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const msg = await import("@/lib/services/messages");
const { canAccessDocument } = await import("@/lib/services/documents");
const { resetSalesData } = await import("@/lib/services/data-reset");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
});

const pdf = () =>
  new File([new Uint8Array([37, 80, 68, 70, 45])], "proposta.pdf", {
    type: "application/pdf",
  });

describe("anexo no chat", () => {
  let documentId: string;
  let topicId: string;

  it("cliente envia só o arquivo: vira mensagem com o nome do arquivo", async () => {
    const [own] = await msg.listConversationsFor(joao);
    const view = (await msg.getConversationView(joao, own.id))!;
    topicId = view.topic.id;
    const m = await msg.postMessage(joao, topicId, "   ", pdf());
    expect(m.attachmentDocumentId).toBeTruthy();
    documentId = m.attachmentDocumentId!;
    expect(m.body).toBe("📎 proposta.pdf");
    const doc = (await getStore().get("documents", documentId))!;
    expect(doc.conversationTopicId).toBe(topicId);
    expect(doc.orderId).toBeNull();
    expect(doc.requestId).toBeNull();

    const seen = (await msg.getConversationView(admin, own.id, topicId))!;
    const last = seen.messages.at(-1)!;
    expect(last.attachment).toEqual({
      id: documentId,
      name: "proposta.pdf",
      isImage: false,
    });
  });

  it("texto com anexo: o texto fica e o arquivo vai junto", async () => {
    const m = await msg.postMessage(joao, topicId, "Segue o catálogo", pdf());
    expect(m.body).toBe("Segue o catálogo");
    expect(m.attachmentDocumentId).toBeTruthy();
  });

  it("sem texto e sem arquivo: recusado", async () => {
    await expect(msg.postMessage(joao, topicId, "  ", null)).rejects.toThrow(
      "message_empty",
    );
  });

  it("acesso ao arquivo: a empresa e a Wellmix abrem; outra empresa não", async () => {
    const doc = (await getStore().get("documents", documentId))!;
    expect(await canAccessDocument(joao, doc)).toBe(true);
    expect(await canAccessDocument(admin, doc)).toBe(true);
    expect(await canAccessDocument(supplierA, doc)).toBe(false);
  });

  it("outra empresa não anexa na conversa do cliente (nada é gravado)", async () => {
    const before = (await getStore().list("documents")).length;
    await expect(
      msg.postMessage(supplierA, topicId, "oi", pdf()),
    ).rejects.toThrow();
    expect((await getStore().list("documents")).length).toBe(before);
  });

  it("limpeza dos dados de teste apaga mensagens, conversas e anexos", async () => {
    const result = await resetSalesData(admin, "APAGAR");
    expect(result.finished).toBe(true);
    expect(result.remove.messages).toBeGreaterThanOrEqual(2);
    const store = getStore();
    expect(await store.list("messages")).toHaveLength(0);
    expect(await store.list("conversation_topics")).toHaveLength(0);
    expect(await store.list("conversations")).toHaveLength(0);
    expect(await store.list("message_reads")).toHaveLength(0);
    expect(await store.get("documents", documentId)).toBeNull();
  });
});
