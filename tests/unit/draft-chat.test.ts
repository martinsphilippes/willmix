import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Conversa ligada ao rascunho (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md,
 * seção 8): quem salvou o rascunho conversa com um login do cliente dele num
 * assunto do rascunho ("Solicitação nº N (rascunho)"); no envio, o assunto
 * passa para a solicitação, com as mensagens. Só quem salvou abre pelo
 * rascunho; o login do cliente lê o assunto pela conversa privada.
 */
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const msg = await import("@/lib/services/messages");
const { saveRequestDraft } = await import("@/lib/services/request-drafts");
const { createRequestBatch } = await import("@/lib/services/requests");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let operador: User;
let supplier: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  joao = by("joao@lojista.com");
  operador = by("operador@wellmix.com");
  supplier = by("supplier.a@china.com");
});

/** Rascunho da tela TS para a Loja do João, com um copo. */
const draftForm = () => {
  const f = new FormData();
  f.append("customerId", joao.partyId!);
  f.append("p0.productName", "Copo");
  f.append("p0.description", "Copo");
  f.append("p0.sourcingDemand", "on");
  f.append("p0.quantity", "100");
  f.append("p0.unit", "un");
  return f;
};

describe("conversa ligada ao rascunho", () => {
  it("quem salvou conversa com o login do cliente, no assunto do rascunho", async () => {
    const draft = await saveRequestDraft(admin, draftForm(), null, "ts");
    const ctx = await msg.chatContext(admin, { draftId: draft.id });
    expect(ctx.kind).toBe("draft");
    expect(ctx.title).toBe(`Solicitação nº ${draft.number} (rascunho)`);
    expect(ctx.peers.map((p) => p.userId)).toContain(joao.id);
    expect(ctx.peers.every((p) => p.partyId === joao.partyId)).toBe(true);

    const opened = await msg.openTopic(admin, {
      draftId: draft.id,
      peerUserId: joao.id,
    });
    const topic = await getStore().get("conversation_topics", opened.topicId);
    expect(topic).toMatchObject({
      kind: "draft",
      draftId: draft.id,
      requestId: null,
      orderId: null,
      title: `#${draft.number} · Copo`,
    });
    // Abrir de novo: o mesmo assunto.
    const again = await msg.openTopic(admin, {
      draftId: draft.id,
      peerUserId: joao.id,
    });
    expect(again.topicId).toBe(opened.topicId);

    // A mensagem chega ao João, que lê o assunto do rascunho.
    await msg.postMessage(admin, opened.topicId, "Podemos fechar 100 copos?");
    const seen = await msg.topicThread(joao, opened.topicId, { locale: "pt" });
    expect(seen.messages.map((m) => m.body)).toContain(
      "Podemos fechar 100 copos?",
    );
    expect(seen.topic.kind).toBe("draft");
  });

  it("privacidade: outro login da Wellmix e o cliente não abrem pelo rascunho; login de outra empresa não entra", async () => {
    const draft = await saveRequestDraft(admin, draftForm(), null, "ts");
    await expect(
      msg.chatContext(operador, { draftId: draft.id }),
    ).rejects.toThrow();
    await expect(
      msg.openTopic(operador, { draftId: draft.id, peerUserId: joao.id }),
    ).rejects.toThrow();
    await expect(msg.chatContext(joao, { draftId: draft.id })).rejects.toThrow();
    await expect(msg.openTopic(joao, { draftId: draft.id })).rejects.toThrow();
    await expect(
      msg.openTopic(admin, { draftId: draft.id, peerUserId: supplier.id }),
    ).rejects.toThrow();
    // Nada foi criado com as tentativas.
    const topics = await getStore().list("conversation_topics", {
      filter: { draftId: draft.id },
    });
    expect(topics).toEqual([]);
  });

  it("no envio, o assunto passa para a solicitação, com as mensagens", async () => {
    const draft = await saveRequestDraft(admin, draftForm(), null, "ts");
    const opened = await msg.openTopic(admin, {
      draftId: draft.id,
      peerUserId: joao.id,
    });
    await msg.postMessage(admin, opened.topicId, "Rascunho pronto");
    const [request] = await createRequestBatch(
      admin,
      {
        customerId: joao.partyId!,
        deadline: null,
        notes: null,
        requestedForUserId: joao.id,
      },
      [
        {
          productId: null,
          productName: "Copo",
          description: "Copo",
          specification: null,
          quantity: 100,
          unit: "un",
          sourcingDemand: true,
        },
      ],
      { number: draft.number! },
    );
    expect(await msg.moveDraftTopics(draft.id, request)).toBe(1);
    const topic = await getStore().get("conversation_topics", opened.topicId);
    expect(topic).toMatchObject({
      kind: "request",
      requestId: request.id,
      draftId: draft.id,
      title: `#${request.number} · Copo`,
    });
    expect(request.number).toBe(draft.number);
    // Pela solicitação, o mesmo assunto (não nasce outro), com a mensagem.
    const byRequest = await msg.openTopic(admin, {
      requestId: request.id,
      peerUserId: joao.id,
    });
    expect(byRequest.topicId).toBe(opened.topicId);
    const seen = await msg.topicThread(joao, opened.topicId, { locale: "pt" });
    expect(seen.messages.map((m) => m.body)).toContain("Rascunho pronto");
    // De novo: nada mais a passar.
    expect(await msg.moveDraftTopics(draft.id, request)).toBe(0);
  });
});
