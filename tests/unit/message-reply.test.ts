import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Responder a uma mensagem marcada: a resposta guarda a mensagem citada,
 * sempre do mesmo assunto. A citação aparece com quem escreveu e o começo do
 * texto (no idioma de quem lê, quando há tradução) ou o anexo. Marcar uma
 * mensagem de outra conversa é recusado e nada é gravado; um dado adulterado
 * nunca mostra a citação de outro assunto.
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
const { chatSendAction, chatSendFileAction } =
  await import("@/app/app/actions/chat");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let joaoTopic: string;
let joaoConversation: string;
let supplierTopic: string;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  joao = by("joao@lojista.com");
  const [own] = await msg.listConversationsFor(joao);
  joaoConversation = own.id;
  joaoTopic = (await msg.getConversationView(joao, own.id))!.topic.id;
  const opened = await msg.openTopic(admin, { partyId: "fornecedor-a" });
  supplierTopic = opened.topicId;
});

const view = (user: User) =>
  msg.getConversationView(user, joaoConversation, joaoTopic, {
    locale: "pt",
  });

describe("responder a uma mensagem marcada", () => {
  it("a resposta mostra a citação: quem escreveu e o começo do texto", async () => {
    const original = await msg.postMessage(
      joao,
      joaoTopic,
      "Qual o prazo de entrega da jarra?",
    );
    const answer = await msg.postMessage(admin, joaoTopic, "30 dias.", null, {
      replyToMessageId: original.id,
    });
    expect(answer.replyToMessageId).toBe(original.id);

    const seenByJoao = (await view(joao))!.messages.find(
      (m) => m.id === answer.id,
    )!;
    expect(seenByJoao.replyTo).toEqual({
      id: original.id,
      authorName: joao.name,
      authorSide: "external",
      mine: true,
      text: "Qual o prazo de entrega da jarra?",
      attachment: null,
    });
    const seenByAdmin = (await view(admin))!.messages.find(
      (m) => m.id === answer.id,
    )!;
    expect(seenByAdmin.replyTo?.mine).toBe(false);
    // Mensagem comum: sem citação.
    expect(
      (await view(joao))!.messages.find((m) => m.id === original.id)!.replyTo,
    ).toBeNull();
  });

  it("citação de foto: sem texto, com o anexo; texto no idioma de quem lê", async () => {
    const photo = await msg.postMessage(
      joao,
      joaoTopic,
      "",
      new File([new Uint8Array([1, 2, 3])], "amostra.jpg", {
        type: "image/jpeg",
      }),
    );
    const reply = await msg.postMessage(admin, joaoTopic, "Recebida", null, {
      replyToMessageId: photo.id,
    });
    const quote = (await view(admin))!.messages.find(
      (m) => m.id === reply.id,
    )!.replyTo!;
    expect(quote.text).toBeNull();
    expect(quote.attachment).toEqual({
      name: "amostra.jpg",
      isImage: true,
      isVideo: false,
    });

    // Mensagem do cliente escrita em inglês e já traduzida: a Wellmix vê a
    // citação em português.
    const english = await msg.postMessage(joao, joaoTopic, "Hello there");
    await getStore().update("messages", english.id, {
      translation: {
        status: "done",
        lang: "en",
        texts: { pt: "Olá", zh: "你好" },
        by: "api",
        at: new Date().toISOString(),
      },
    });
    const r2 = await msg.postMessage(admin, joaoTopic, "Oi!", null, {
      replyToMessageId: english.id,
    });
    expect(
      (await view(admin))!.messages.find((m) => m.id === r2.id)!.replyTo?.text,
    ).toBe("Olá");
  });

  it("mensagem de outra conversa não pode ser marcada: recusado e nada gravado", async () => {
    const elsewhere = await msg.postMessage(
      admin,
      supplierTopic,
      "Mensagem só do fornecedor",
    );
    const messages = (await getStore().list("messages")).length;
    const documents = (await getStore().list("documents")).length;
    await expect(
      msg.postMessage(joao, joaoTopic, "Respondendo", null, {
        replyToMessageId: elsewhere.id,
      }),
    ).rejects.toThrow("reply_not_found");
    // Nem o anexo sobe.
    await expect(
      msg.postMessage(
        joao,
        joaoTopic,
        "",
        new File([new Uint8Array([1])], "x.pdf", { type: "application/pdf" }),
        { replyToMessageId: elsewhere.id },
      ),
    ).rejects.toThrow("reply_not_found");
    await expect(
      msg.postMessage(joao, joaoTopic, "Respondendo", null, {
        replyToMessageId: "nao-existe",
      }),
    ).rejects.toThrow("reply_not_found");
    expect((await getStore().list("messages")).length).toBe(messages);
    expect((await getStore().list("documents")).length).toBe(documents);
  });

  it("dado adulterado apontando para outra conversa: a citação não aparece", async () => {
    const secret = await msg.postMessage(
      admin,
      supplierTopic,
      "Preço confidencial do fornecedor",
    );
    const forged = await getStore().create("messages", {
      conversationId: joaoConversation,
      topicId: joaoTopic,
      authorUserId: joao.id,
      authorSide: "external",
      body: "Olha isto",
      attachmentDocumentId: null,
      replyToMessageId: secret.id,
    });
    const shown = (await view(joao))!.messages.find((m) => m.id === forged.id)!;
    expect(shown.replyTo).toBeNull();
    expect(JSON.stringify(await view(joao))).not.toContain(
      "Preço confidencial",
    );
  });

  it("citação de mensagem antiga (fora das últimas 200 da tela) aparece", async () => {
    const old = await msg.postMessage(joao, joaoTopic, "Mensagem bem antiga");
    await new Promise((r) => setTimeout(r, 5));
    for (let i = 0; i < 205; i++)
      await getStore().create("messages", {
        conversationId: joaoConversation,
        topicId: joaoTopic,
        authorUserId: admin.id,
        authorSide: "wellmix",
        body: `enchimento ${i}`,
        attachmentDocumentId: null,
      });
    const reply = await msg.postMessage(
      admin,
      joaoTopic,
      "Sobre aquilo",
      null,
      {
        replyToMessageId: old.id,
      },
    );
    const v = (await view(admin))!;
    expect(v.messages.some((m) => m.id === old.id)).toBe(false);
    expect(v.messages.find((m) => m.id === reply.id)!.replyTo?.text).toBe(
      "Mensagem bem antiga",
    );
  });

  it("esquema ainda sem a coluna: a resposta vai como mensagem comum (nada se perde)", async () => {
    const original = await msg.postMessage(joao, joaoTopic, "Pergunta");
    const store = getStore();
    const create = store.create.bind(store);
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (table === "messages" && "replyToMessageId" in data)
          throw new Error(
            'Invalid document structure: Unknown attribute: "replyToMessageId"',
          );
        return create(table, data);
      });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const sent = await msg.postMessage(admin, joaoTopic, "Resposta", null, {
        replyToMessageId: original.id,
      });
      expect(sent.body).toBe("Resposta");
      expect(sent.replyToMessageId ?? null).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("responder pelo painel lateral e com arquivo", () => {
  it("texto: a ação leva a mensagem marcada; de outra conversa é recusada", async () => {
    const original = await msg.postMessage(joao, joaoTopic, "Pode confirmar?");
    h.current = admin;
    expect(await chatSendAction(joaoTopic, "Confirmado", original.id)).toEqual({
      ok: true,
      data: undefined,
    });
    const last = (await view(admin))!.messages.at(-1)!;
    expect(last.body).toBe("Confirmado");
    expect(last.replyTo?.id).toBe(original.id);

    const elsewhere = await msg.postMessage(admin, supplierTopic, "Outro");
    h.current = joao;
    expect(await chatSendAction(joaoTopic, "Oi", elsewhere.id)).toEqual({
      ok: false,
      error: "reply_not_found",
    });
    expect(await chatSendAction(joaoTopic, "Oi", "../x")).toEqual({
      ok: false,
      error: "invalid_input",
    });
  });

  it("arquivo: a mensagem marcada vai com o arquivo", async () => {
    const original = await msg.postMessage(admin, joaoTopic, "Mande a foto");
    h.current = joao;
    const form = new FormData();
    form.set("topicId", joaoTopic);
    form.set("replyToMessageId", original.id);
    form.set(
      "file",
      new File([new Uint8Array([1, 2])], "foto.png", { type: "image/png" }),
    );
    const res = await chatSendFileAction(form);
    if (!res.ok) throw new Error(res.error);
    const shown = (await view(joao))!.messages.find(
      (m) => m.id === res.data.id,
    )!;
    expect(shown.replyTo?.id).toBe(original.id);
    expect(shown.attachment?.isImage).toBe(true);
  });
});
