import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Mensagens (chat interno): uma conversa por empresa, vista por todos os
 * logins dela e por toda a Wellmix; outra empresa nunca vê. Assuntos de
 * solicitação/pedido só com a empresa participante. Aviso só no sino, um por
 * assunto até ler.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequest, openRfq } = await import("@/lib/services/requests");
const { ForbiddenError } = await import("@/lib/auth/permissions");
const msg = await import("@/lib/services/messages");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let joao: User;
let maria: User;
let supplierA: User;
let supplierB: User;
let armador: User;
let legal: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  operator = by("operador@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  supplierB = by("supplier.b@china.com");
  armador = by("armador@maritima.com");
  legal = by("juridico@wellmix.com");
  // Segundo login da mesma empresa do João.
  maria = await getStore().create("users", {
    email: "maria@lojista.com",
    name: "Maria Cliente",
    role: "customer",
    partyId: joao.partyId,
    locale: "en",
    passwordHash: null,
    active: true,
    importerId: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const inapp = (userId: string) =>
  getStore().list("notifications", { filter: { userId, channel: "inapp" } });

describe("conversa por empresa", () => {
  let conversationId: string;
  let generalId: string;

  it("cliente escreve no Geral: a conversa nasce para a empresa e a Wellmix vê com 1 não lida", async () => {
    const [own] = await msg.listConversationsFor(joao);
    expect(own.partyId).toBe(joao.partyId);
    expect(own.unread).toBe(0);
    conversationId = own.id;
    const view = (await msg.getConversationView(joao, own.id))!;
    expect(view.topic.kind).toBe("general");
    generalId = view.topic.id;

    await msg.postMessage(joao, generalId, "  Olá, Wellmix!  ");

    const list = await msg.listConversationsFor(admin);
    const row = list.find((c) => c.id === conversationId)!;
    expect(row.name).toBe("Loja do João Ltda");
    expect(row.type).toBe("customer");
    expect(row.unread).toBe(1);
    expect(row.lastMessagePreview).toBe("Olá, Wellmix!");
    expect(await msg.unreadCountFor(admin)).toBe(1);
    // Quem escreveu não tem nada a ler.
    expect(await msg.unreadCountFor(joao)).toBe(0);
    const thread = (await msg.getConversationView(admin, conversationId))!;
    expect(thread.messages.map((m) => [m.body, m.authorSide])).toEqual([
      ["Olá, Wellmix!", "external"],
    ]);
  });

  it("Wellmix responde: o não lido do cliente sobe; ler zera", async () => {
    await msg.markTopicRead(admin, generalId);
    expect(await msg.unreadCountFor(admin)).toBe(0);
    await msg.postMessage(admin, generalId, "Olá, João. Como ajudamos?");
    expect(await msg.unreadCountFor(joao)).toBe(1);
    const [own] = await msg.listConversationsFor(joao);
    expect(own.unread).toBe(1);
    const view = (await msg.getConversationView(joao, conversationId))!;
    expect(view.topic.unread).toBe(1);
    expect(view.messages.at(-1)).toMatchObject({
      authorSide: "wellmix",
      authorName: "Ana Admin",
      mine: false,
    });
    await msg.markTopicRead(joao, generalId);
    expect(await msg.unreadCountFor(joao)).toBe(0);
  });

  it("outro login da mesma empresa vê e responde a mesma conversa", async () => {
    const [own] = await msg.listConversationsFor(maria);
    expect(own.id).toBe(conversationId);
    // Maria ainda não leu: as duas mensagens (do João e da Wellmix) contam.
    expect(own.unread).toBe(2);
    await msg.postMessage(maria, generalId, "Sou a Maria, da mesma loja.");
    const view = (await msg.getConversationView(joao, conversationId))!;
    expect(view.messages).toHaveLength(3);
    expect(
      (
        await getStore().list("conversations", {
          filter: { partyId: joao.partyId },
        })
      ).length,
    ).toBe(1);
  });

  it("fornecedor não lê nem escreve na conversa do cliente", async () => {
    await expect(
      msg.getConversationView(supplierA, conversationId),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      msg.postMessage(supplierA, generalId, "oi"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      msg.markTopicRead(supplierA, generalId),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      msg.openTopic(supplierA, { conversationId }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    // A lista dele só tem a conversa da própria empresa.
    const list = await msg.listConversationsFor(supplierA);
    expect(list.map((c) => c.partyId)).toEqual([supplierA.partyId]);
    expect(list.some((c) => c.id === conversationId)).toBe(false);
  });

  it("login sem empresa (jurídico) tem conversa própria e a Wellmix a abre", async () => {
    const [own] = await msg.listConversationsFor(legal);
    expect(own.partyId).toBeNull();
    expect(own.userId).toBe(legal.id);
    const opened = await msg.openTopic(admin, { userId: legal.id });
    expect(opened.conversationId).toBe(own.id);
    // Wellmix abre conversa com qualquer empresa (aqui, a companhia marítima).
    const sea = await msg.openTopic(admin, { partyId: armador.partyId });
    const [armadorOwn] = await msg.listConversationsFor(armador);
    expect(armadorOwn.id).toBe(sea.conversationId);
  });

  it("texto vazio ou com mais de 4.000 caracteres é recusado", async () => {
    await expect(msg.postMessage(joao, generalId, "   ")).rejects.toThrow(
      "message_empty",
    );
    await expect(
      msg.postMessage(joao, generalId, "x".repeat(4001)),
    ).rejects.toThrow("message_too_long");
    const ok = await msg.postMessage(joao, generalId, "x".repeat(4000));
    expect(ok.body).toHaveLength(4000);
  });
});

describe("assunto de solicitação", () => {
  let requestId: string;

  beforeAll(async () => {
    const request = await createRequest(joao, {
      customerId: joao.partyId!,
      productName: "Jarra de vidro 1,5 L",
      description: "Jarra para o chat",
      quantity: 1000,
      unit: "un",
    });
    requestId = request.id;
    await openRfq(admin, request.id, ["fornecedor-a"]);
  });

  it("só a empresa participante (ou a Wellmix) abre o assunto", async () => {
    // O cliente solicitante abre na conversa da própria empresa.
    const mine = await msg.openTopic(joao, { requestId });
    const [own] = await msg.listConversationsFor(joao);
    expect(mine.conversationId).toBe(own.id);
    // Abrir de novo devolve o mesmo assunto.
    expect((await msg.openTopic(joao, { requestId })).topicId).toBe(
      mine.topicId,
    );
    // Fornecedor convidado (tem cotação) abre na conversa da empresa dele.
    const quoted = await msg.openTopic(supplierA, { requestId });
    expect(quoted.conversationId).not.toBe(mine.conversationId);
    // Fornecedor não convidado e parceiro de fora: não veem a solicitação.
    await expect(
      msg.openTopic(supplierB, { requestId }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(msg.openTopic(armador, { requestId })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    // Wellmix: com o cliente (padrão) ou um fornecedor convidado; empresa
    // que não participa, não.
    expect((await msg.openTopic(admin, { requestId })).topicId).toBe(
      mine.topicId,
    );
    await expect(
      msg.openTopic(admin, { requestId, partyId: supplierB.partyId }),
    ).rejects.toThrow("not_participant");
    // Outro login da mesma empresa não vê a solicitação do João: o assunto
    // não aparece para ele e não abre.
    const mariaView = (await msg.getConversationView(maria, own.id))!;
    expect(mariaView.topics.some((t) => t.id === mine.topicId)).toBe(false);
    await expect(
      msg.getConversationView(maria, own.id, mine.topicId),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      msg.postMessage(maria, mine.topicId, "posso ver?"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const joaoView = (await msg.getConversationView(joao, own.id))!;
    expect(joaoView.topics.map((t) => t.kind)).toEqual(["general", "request"]);
  });
});

describe("avisos no sino", () => {
  it("só in-app e no máximo um não lido por assunto até ler", async () => {
    const { conversationId, topicId } = await msg.openTopic(admin, {
      partyId: "fornecedor-c",
    });
    const supplierC = (
      await getStore().list("users", {
        filter: { partyId: "fornecedor-c" },
      })
    )[0];
    const before = (await inapp(supplierC.id)).length;
    await msg.postMessage(admin, topicId, "Primeira");
    await msg.postMessage(operator, topicId, "Segunda");
    let notices = (await inapp(supplierC.id)).slice(before);
    expect(notices).toHaveLength(1);
    expect(notices[0].link).toBe(msg.topicHref(conversationId, topicId));
    expect(notices[0].readAt).toBeNull();
    // Nada de e-mail nem WhatsApp.
    const other = await getStore().list("notifications", {
      filter: {
        userId: supplierC.id,
        channel: ["email", "whatsapp"],
        link: notices[0].link,
      },
    });
    expect(other).toHaveLength(0);
    expect(await msg.unreadCountFor(supplierC)).toBe(2);

    // Ler o assunto marca o aviso; a próxima mensagem gera um novo.
    await msg.markTopicRead(supplierC, topicId);
    notices = (await inapp(supplierC.id)).slice(before);
    expect(notices.every((n) => n.readAt)).toBe(true);
    await msg.postMessage(admin, topicId, "Terceira");
    notices = (await inapp(supplierC.id)).slice(before);
    expect(notices).toHaveLength(2);
    expect(notices.filter((n) => !n.readAt)).toHaveLength(1);

    // Resposta da empresa avisa a Wellmix (uma vez), não o próprio autor.
    const adminBefore = (await inapp(admin.id)).filter(
      (n) => n.link === notices[0].link,
    ).length;
    await msg.postMessage(supplierC, topicId, "Recebido");
    await msg.postMessage(supplierC, topicId, "Mais uma");
    const adminNotices = (await inapp(admin.id)).filter(
      (n) => n.link === notices[0].link,
    );
    expect(adminNotices.length - adminBefore).toBe(1);
    expect(adminNotices.at(-1)!.subject).toBe(
      "Nova mensagem de Ningbo Supplier C",
    );
    // O texto vai no idioma de quem recebe (Wang Fang usa zh).
    expect(notices.at(-1)!.subject).toBe("Wellmix 发来新消息");
  });
});

describe("esquema ainda não publicado", () => {
  it("lista e contador voltam vazios quando a tabela não existe", async () => {
    const missing = Object.assign(
      new Error(
        "Table with the requested ID 'conversations' could not be found.",
      ),
      { type: "table_not_found" },
    );
    vi.spyOn(getStore(), "list").mockRejectedValue(missing);
    vi.spyOn(getStore(), "get").mockRejectedValue(missing);
    expect(await msg.listConversationsFor(admin)).toEqual([]);
    expect(await msg.listConversationsFor(joao)).toEqual([]);
    expect(await msg.unreadCountFor(admin)).toBe(0);
    expect(await msg.getConversationView(admin, "qualquer")).toBeNull();
  });
});

describe("abrir a conversa no assunto certo", () => {
  it("sem assunto escolhido, abre onde está a mensagem nova (não o Geral vazio)", async () => {
    const request = await createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Copo assunto",
      description: "Copo",
      specification: null,
      quantity: 100,
      unit: "un",
      deadline: null,
      notes: null,
    });
    const { conversationId, topicId } = await msg.openTopic(joao, {
      requestId: request.id,
    });
    await msg.postMessage(joao, topicId, "qual é o preço por kg?");
    // Wellmix abre a conversa pela lista (sem escolher assunto).
    const view = await msg.getConversationView(admin, conversationId);
    expect(view!.topic.id).toBe(topicId);
    expect(view!.messages.some((m) => m.body.includes("preço por kg"))).toBe(
      true,
    );
    // Escolhendo o Geral, continua indo para o Geral.
    const general = view!.topics.find((t) => t.kind === "general")!;
    const chosen = await msg.getConversationView(
      admin,
      conversationId,
      general.id,
    );
    expect(chosen!.topic.id).toBe(general.id);
  });
});

/*
 * Assunto por item: a conversa desce até o produto do pedido. Mesmas regras
 * do pedido (empresa participante; quem é de fora só o que vê); o item tem
 * de ser do pedido. O painel lateral usa chatContext (com quem e os itens).
 */
describe("assunto por item do pedido", () => {
  let orderId: string;
  let itemId: string;
  let supplierOfOrder: User;
  let otherSupplier: User;

  beforeAll(async () => {
    // Compra para estoque: escolhido o fornecedor, o pedido nasce na hora.
    const { setSetting } = await import("@/lib/settings");
    await setSetting("approvalsEnabled", false);
    const pf = await import("@/lib/services/purchase-flow");
    const r = await import("@/lib/services/requests");
    await pf.ensureStockParty(admin);
    const req = await r.createRequest(operator, {
      customerId: pf.STOCK_PARTY_ID,
      productId: null,
      productName: "Panela para estoque (chat)",
      description: "Panela",
      specification: null,
      quantity: 500,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await r.openRfq(admin, req.id, [supplierA.partyId!]);
    const [quote] = await getStore().list("quotes", {
      filter: { requestId: req.id },
    });
    await r.answerQuote(supplierA, quote.id, {
      price: 3,
      currency: "USD",
      leadTimeDays: 10,
      conditions: null,
    });
    await r.selectQuote(admin, quote.id, {
      sellPrice: 5_000,
      sellCurrency: "BRL",
    });
    const [order] = await getStore().list("orders", {
      filter: { requestId: req.id },
    });
    orderId = order.id;
    const [item] = await getStore().list("order_items", {
      filter: { orderId },
    });
    itemId = item.id;
    supplierOfOrder = supplierA;
    otherSupplier = supplierB;
  });

  it("Wellmix abre o assunto do item com o fornecedor; abrir de novo devolve o mesmo", async () => {
    const opened = await msg.openTopic(admin, {
      orderId,
      orderItemId: itemId,
      partyId: supplierOfOrder.partyId,
    });
    const topic = (await getStore().get(
      "conversation_topics",
      opened.topicId,
    ))!;
    expect(topic.kind).toBe("item");
    expect(topic.orderId).toBe(orderId);
    expect(topic.orderItemId).toBe(itemId);
    expect(topic.title).toMatch(/^#\d+ · Panela para estoque/);
    const again = await msg.openTopic(admin, {
      orderItemId: itemId,
      partyId: supplierOfOrder.partyId,
    });
    expect(again.topicId).toBe(opened.topicId);
    // O assunto do pedido inteiro é outro.
    const whole = await msg.openTopic(admin, {
      orderId,
      partyId: supplierOfOrder.partyId,
    });
    expect(whole.topicId).not.toBe(opened.topicId);
  });

  it("o fornecedor do pedido abre o item na conversa dele; fornecedor de fora, não", async () => {
    const mine = await msg.openTopic(supplierOfOrder, { orderItemId: itemId });
    const [own] = await msg.listConversationsFor(supplierOfOrder);
    expect(mine.conversationId).toBe(own.id);
    await msg.postMessage(
      supplierOfOrder,
      mine.topicId,
      "a tampa muda de cor?",
    );
    const thread = await msg.topicThread(admin, mine.topicId);
    expect(thread.topic.kind).toBe("item");
    expect(thread.messages.some((m) => m.body.includes("tampa"))).toBe(true);
    await expect(
      msg.openTopic(otherSupplier, { orderItemId: itemId }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      msg.openTopic(admin, {
        orderItemId: itemId,
        partyId: otherSupplier.partyId,
      }),
    ).rejects.toThrow("not_participant");
  });

  it("item de outro pedido é recusado", async () => {
    await expect(
      msg.openTopic(admin, {
        orderId: "pedido-que-nao-e-este",
        orderItemId: itemId,
        partyId: supplierOfOrder.partyId,
      }),
    ).rejects.toThrow("item_not_in_order");
  });

  it("contexto do painel: Wellmix vê as empresas e os itens; o fornecedor só fala com a Wellmix", async () => {
    const ctx = await msg.chatContext(admin, { orderId });
    expect(ctx.kind).toBe("order");
    expect(ctx.own).toBe(false);
    expect(
      ctx.participants.some((p) => p.partyId === supplierOfOrder.partyId),
    ).toBe(true);
    expect(ctx.items.map((i) => i.id)).toContain(itemId);
    const mine = await msg.chatContext(supplierOfOrder, { orderId });
    expect(mine.own).toBe(true);
    expect(mine.participants).toEqual([]);
    expect(mine.items.map((i) => i.id)).toContain(itemId);
    await expect(
      msg.chatContext(otherSupplier, { orderId }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("árvore de assuntos", () => {
  it("Geral, pedido com os produtos embaixo e solicitação com o produto", async () => {
    const { translator } = await import("@/i18n");
    const t = translator("pt");
    const store = getStore();
    // Pedido com dois itens: só o primeiro tem conversa.
    const order = await store.create("orders", {
      number: 901,
      customerId: joao.partyId!,
      supplierId: supplierA.partyId!,
      status: "PREPARATION",
    } as never);
    const [i1] = await Promise.all([
      store.create("order_items", {
        orderId: order.id,
        productId: "prod-jarra",
        name: "Jarra de vidro",
        quantity: 10,
        unit: "un",
        unitPrice: null,
      } as never),
      store.create("order_items", {
        orderId: order.id,
        productId: null,
        name: "Copo de vidro",
        quantity: 5,
        unit: "un",
        unitPrice: null,
      } as never),
    ]);
    const request = await createRequest(joao, {
      customerId: joao.partyId!,
      productName: "Jarra de vidro 1,5 L",
      description: "Jarra da árvore",
      quantity: 1000,
      unit: "un",
    });
    await openRfq(admin, request.id, ["fornecedor-a"]);
    const item = await msg.openTopic(supplierA, { orderItemId: i1.id });
    const req = await msg.openTopic(supplierA, { requestId: request.id });
    const view = (await msg.getConversationView(
      supplierA,
      item.conversationId,
    ))!;
    const tree = await msg.topicTree(t, view.topics);
    expect(tree[0].kind).toBe("general");
    const orderNode = tree.find(
      (n) => n.kind === "order" && n.orderId === order.id,
    )!;
    expect(orderNode.label).toContain("#901");
    // Pedido sem conversa própria ainda: abre ao tocar.
    expect(orderNode.topic).toBeNull();
    expect(orderNode.children.map((c) => c.label)).toEqual([
      "Jarra de vidro",
      "Copo de vidro",
    ]);
    expect(orderNode.children[0].topic?.id).toBe(item.topicId);
    expect(orderNode.children[1].topic).toBeNull();
    expect(orderNode.children[1].orderItemId).toBeTruthy();
    const reqNode = tree.find((n) => n.topic?.id === req.topicId)!;
    expect(reqNode.kind).toBe("request");
    expect(reqNode.sub).toBe("Jarra de vidro 1,5 L");
  });
});
