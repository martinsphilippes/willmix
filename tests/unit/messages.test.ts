import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Mensagens (chat interno; dono, 18/11/2026; docs/CHAT_IDENTITY.md): cada
 * conversa é privada entre dois logins, a pessoa da Wellmix e a de fora. Só
 * os dois leem, escrevem e são avisados; o administrador lê todas sem
 * escrever; a conversa antiga da empresa é só leitura. Assuntos de
 * solicitação/pedido só com quem vê. Aviso só no sino, um por assunto até ler.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequest } = await import("@/lib/services/requests");
const { orderFromRequest } = await import("./helpers/order");
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

describe("conversa privada entre dois logins", () => {
  let conversationId: string;
  let generalId: string;

  it("quem é de fora começa sem conversa; a Wellmix abre com o login e escreve", async () => {
    expect(await msg.listConversationsFor(joao)).toEqual([]);
    // Lista curta de quem é de fora sem ninguém ainda: os administradores.
    const contacts = await msg.externalContactsFor(joao);
    expect(contacts.map((c) => c.userId)).toContain(admin.id);
    // Privacidade: sem conversa, o login da pessoa da Wellmix não aparece.
    expect(contacts.every((c) => c.login === null)).toBe(true);

    const opened = await msg.openTopic(admin, { peerUserId: joao.id });
    conversationId = opened.conversationId;
    generalId = opened.topicId;
    const conv = (await getStore().get("conversations", conversationId))!;
    expect(conv.wellmixUserId).toBe(admin.id);
    expect(conv.externalUserId).toBe(joao.id);
    expect(conv.partyId).toBe(joao.partyId);
    // Abrir de novo devolve a mesma conversa.
    expect(
      (await msg.openTopic(admin, { peerUserId: joao.id })).conversationId,
    ).toBe(conversationId);

    await msg.postMessage(admin, generalId, "  Olá, João!  ");
    const [row] = await msg.listConversationsFor(joao);
    expect(row.id).toBe(conversationId);
    expect(row.mode).toBe("pair");
    expect(row.readOnly).toBe(false);
    expect(row.name).toBe("Ana Admin");
    expect(row.peer).toMatchObject({
      login: "admin@wellmix.com",
      side: "wellmix",
    });
    expect(row.unread).toBe(1);
    expect(await msg.unreadCountFor(joao)).toBe(1);
    expect(await msg.unreadCountFor(admin)).toBe(0);
  });

  it("identificação: enviando como, destinatário e para quem foi cada mensagem", async () => {
    const view = (await msg.getConversationView(joao, conversationId))!;
    expect(view.identity).toMatchObject({
      mode: "pair",
      canWrite: true,
      readOnly: null,
      me: { userId: joao.id, login: "joao@lojista.com", side: "external" },
      peer: { userId: admin.id, login: "admin@wellmix.com", side: "wellmix" },
    });
    expect(view.identity.me.org).toBe("Loja do João Ltda");
    const [m] = view.messages;
    expect(m.body).toBe("Olá, João!");
    expect(m.author).toMatchObject({
      name: "Ana Admin",
      login: "admin@wellmix.com",
    });
    expect(m.recipients?.map((r) => r.login)).toEqual(["joao@lojista.com"]);
    expect(m.mine).toBe(false);
    await msg.markTopicRead(joao, generalId);
    await msg.postMessage(joao, generalId, "Oi, Ana.");
    const seen = (await msg.getConversationView(admin, conversationId))!;
    expect(seen.identity.peer?.login).toBe("joao@lojista.com");
    expect(seen.messages.at(-1)!.recipients?.map((r) => r.userId)).toEqual([
      admin.id,
    ]);
  });

  it("outro login da mesma empresa não vê nem escreve na conversa", async () => {
    expect(
      (await msg.listConversationsFor(maria)).some(
        (c) => c.id === conversationId,
      ),
    ).toBe(false);
    await expect(
      msg.getConversationView(maria, conversationId),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      msg.postMessage(maria, generalId, "posso?"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      msg.openTopic(maria, { conversationId }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      msg.getConversationView(supplierA, conversationId),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("outra pessoa da Wellmix não lê; tem a própria conversa com o mesmo login", async () => {
    await expect(
      msg.getConversationView(operator, conversationId),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      msg.postMessage(operator, generalId, "oi"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const own = await msg.openTopic(operator, { peerUserId: joao.id });
    expect(own.conversationId).not.toBe(conversationId);
    expect(
      (await msg.listConversationsFor(operator)).map((c) => c.id),
    ).not.toContain(conversationId);
    // João tem as duas, cada uma com a sua pessoa.
    await msg.postMessage(operator, own.topicId, "Sou o Otávio.");
    const names = (await msg.listConversationsFor(joao)).map((c) => c.name);
    expect(names.sort()).toEqual(["Ana Admin", "Otávio Operador"]);
  });

  it("administrador lê a conversa dos outros sem escrever e sem acumular não lidas", async () => {
    const other = await msg.openTopic(operator, { peerUserId: joao.id });
    const view = (await msg.getConversationView(admin, other.conversationId))!;
    expect(view.identity.readOnly).toBe("observer");
    expect(view.identity.canWrite).toBe(false);
    expect(view.identity.members.map((p) => p.userId)).toEqual([
      operator.id,
      joao.id,
    ]);
    expect(view.conversation.unread).toBe(0);
    await expect(
      msg.postMessage(admin, other.topicId, "intromissão"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const row = (await msg.listConversationsFor(admin)).find(
      (c) => c.id === other.conversationId,
    )!;
    expect(row.readOnly).toBe(true);
    expect(row.name).toBe("Otávio Operador ↔ João Cliente");
  });

  it("o aviso vai só para a outra pessoa da conversa", async () => {
    const other = await msg.openTopic(operator, { peerUserId: joao.id });
    const link = msg.topicHref(other.conversationId, other.topicId);
    await msg.postMessage(joao, other.topicId, "Otávio, uma dúvida.");
    const toOperator = (await inapp(operator.id)).filter(
      (n) => n.link === link,
    );
    const toAdmin = (await inapp(admin.id)).filter((n) => n.link === link);
    expect(toOperator).toHaveLength(1);
    expect(toOperator[0].subject).toBe(
      "Nova mensagem de João Cliente (Loja do João Ltda)",
    );
    expect(toAdmin).toHaveLength(0);
    expect(await msg.unreadCountFor(operator)).toBe(1);
  });

  it("a conversa mudou antes do envio: recusa em vez de mandar para outro", async () => {
    const other = await msg.openTopic(operator, { peerUserId: joao.id });
    await expect(
      msg.postMessage(joao, generalId, "para a Ana", null, {
        conversationId: other.conversationId,
      }),
    ).rejects.toThrow("conversation_changed");
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

describe("empresa com vários logins, nomes iguais e login desativado", () => {
  let dupA: User;
  let dupB: User;

  beforeAll(async () => {
    const store = getStore();
    const party = await store.create("parties", {
      ...(await store.get("parties", "transportador"))!,
      id: "transp-dupla",
      name: "Transportes Dupla",
    });
    const base = {
      role: "carrier" as const,
      partyId: party.id,
      locale: "pt" as const,
      passwordHash: null,
      active: true,
      importerId: null,
    };
    dupA = await store.create("users", {
      ...base,
      email: "carlos.a@dupla.com",
      name: "Carlos Souza",
    });
    dupB = await store.create("users", {
      ...base,
      email: "carlos.b@dupla.com",
      name: "Carlos Souza",
    });
  });

  it("empresa com dois logins: escolher a pessoa; com um só, abre direto", async () => {
    await expect(
      msg.openTopic(operator, { partyId: "transp-dupla" }),
    ).rejects.toThrow("choose_login");
    const sea = await msg.openTopic(operator, { partyId: armador.partyId });
    const conv = (await getStore().get("conversations", sea.conversationId))!;
    expect(conv.externalUserId).toBe(armador.id);
    // Escolhida uma pessoa, a empresa abre na conversa com ela.
    const withB = await msg.openTopic(operator, { peerUserId: dupB.id });
    expect(
      (await msg.openTopic(operator, { partyId: "transp-dupla" }))
        .conversationId,
    ).toBe(withB.conversationId);
  });

  it("nomes iguais se distinguem pelo login na busca e no cabeçalho", async () => {
    const found = await msg.searchChatTargets(admin, "carlos");
    expect(
      found.filter((f) => f.name === "Carlos Souza").map((f) => f.login),
    ).toEqual(
      expect.arrayContaining(["carlos.a@dupla.com", "carlos.b@dupla.com"]),
    );
    expect(found.find((f) => f.login === "carlos.a@dupla.com")).toMatchObject({
      id: `user:${dupA.id}`,
      org: "Transportes Dupla",
    });
    // Busca pelo nome da empresa traz os logins dela.
    const byCompany = await msg.searchChatTargets(admin, "dupla");
    expect(byCompany.map((f) => f.id)).toEqual(
      expect.arrayContaining([`user:${dupA.id}`, `user:${dupB.id}`]),
    );
    const a = await msg.openTopic(admin, { peerUserId: dupA.id });
    const view = (await msg.getConversationView(admin, a.conversationId))!;
    expect(view.identity.peer?.login).toBe("carlos.a@dupla.com");
  });

  it("login desativado: a conversa fica só leitura e o envio é recusado", async () => {
    const a = await msg.openTopic(admin, { peerUserId: dupA.id });
    await msg.postMessage(admin, a.topicId, "Antes de sair");
    await getStore().update("users", dupA.id, { active: false });
    try {
      const view = (await msg.getConversationView(admin, a.conversationId))!;
      expect(view.identity.readOnly).toBe("peer_inactive");
      expect(view.identity.peer?.active).toBe(false);
      // O histórico continua com o nome e o login de quem recebeu.
      expect(view.messages[0].recipients?.[0].login).toBe("carlos.a@dupla.com");
      await expect(
        msg.postMessage(admin, a.topicId, "Ainda aí?"),
      ).rejects.toThrow("peer_inactive");
      await expect(
        msg.openTopic(operator, { peerUserId: dupA.id }),
      ).rejects.toThrow("peer_inactive");
    } finally {
      await getStore().update("users", dupA.id, { active: true });
    }
  });
});

describe("conversa antiga da empresa (antes de 18/11/2026)", () => {
  it("continua visível só para leitura, com o destinatário não identificado", async () => {
    const store = getStore();
    const legacy = await store.create("conversations", {
      partyId: legal.partyId ?? null,
      userId: legal.partyId ? null : legal.id,
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: "antiga",
      status: "open",
    });
    const topic = await store.create("conversation_topics", {
      conversationId: legacy.id,
      kind: "general",
      requestId: null,
      orderId: null,
      title: null,
      lastMessageAt: new Date().toISOString(),
    });
    await store.create("messages", {
      conversationId: legacy.id,
      topicId: topic.id,
      authorUserId: operator.id,
      authorSide: "wellmix",
      body: "Mensagem antiga",
      attachmentDocumentId: null,
    });
    const row = (await msg.listConversationsFor(legal)).find(
      (c) => c.id === legacy.id,
    )!;
    expect(row).toMatchObject({ mode: "legacy", readOnly: true });
    const view = (await msg.getConversationView(legal, legacy.id))!;
    expect(view.identity.readOnly).toBe("legacy");
    expect(view.messages[0].recipients).toBeNull();
    expect(view.messages[0].author.login).toBe("operador@wellmix.com");
    // A Wellmix também lê; ninguém escreve.
    expect(await msg.getConversationView(operator, legacy.id)).not.toBeNull();
    await expect(msg.postMessage(legal, topic.id, "oi")).rejects.toThrow(
      "read_only",
    );
    await expect(msg.postMessage(operator, topic.id, "oi")).rejects.toThrow(
      "read_only",
    );
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
    // Responsável da solicitação: o operador.
    await getStore().update("requests", requestId, {
      ownerUserId: operator.id,
    });
  });

  it("quem é de fora fala com o responsável; a Wellmix só com quem vê", async () => {
    const mine = await msg.openTopic(joao, { requestId });
    const conv = (await getStore().get("conversations", mine.conversationId))!;
    expect(conv.wellmixUserId).toBe(operator.id);
    expect(conv.externalUserId).toBe(joao.id);
    expect((await msg.openTopic(joao, { requestId })).topicId).toBe(
      mine.topicId,
    );
    // Contexto do painel: o responsável primeiro.
    const ctx = await msg.chatContext(joao, { requestId });
    expect(ctx.defaultPeerId).toBe(operator.id);
    expect(ctx.peers[0].userId).toBe(operator.id);
    // Fornecedor e parceiro de fora: não veem a solicitação.
    await expect(
      msg.openTopic(supplierB, { requestId }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(msg.openTopic(armador, { requestId })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    // Wellmix: o operador com o João cai no mesmo assunto; login que não vê
    // a solicitação (Maria, da mesma loja), não.
    expect(
      (await msg.openTopic(operator, { requestId, peerUserId: joao.id }))
        .topicId,
    ).toBe(mine.topicId);
    await expect(
      msg.openTopic(admin, { requestId, peerUserId: maria.id }),
    ).rejects.toThrow("not_participant");
    await expect(
      msg.openTopic(admin, { requestId, peerUserId: supplierB.id }),
    ).rejects.toThrow("not_participant");
    // De fora não escolhe qualquer pessoa da Wellmix.
    const stranger = (
      await getStore().list("users", {
        filter: { email: "vendas@wellmix.com" },
      })
    )[0];
    await expect(
      msg.openTopic(joao, { requestId, peerUserId: stranger.id }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("avisos no sino", () => {
  it("só in-app e no máximo um não lido por assunto até ler", async () => {
    const supplierC = (
      await getStore().list("users", {
        filter: { partyId: "fornecedor-c" },
      })
    )[0];
    const { conversationId, topicId } = await msg.openTopic(admin, {
      peerUserId: supplierC.id,
    });
    const before = (await inapp(supplierC.id)).length;
    await msg.postMessage(admin, topicId, "Primeira");
    await msg.postMessage(admin, topicId, "Segunda");
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
    // O texto vai no idioma de quem recebe (Wang Fang usa zh), com o nome.
    expect(notices.at(-1)!.subject).toBe("来自 Ana Admin（Wellmix）的新消息");
  });

  it("perfil sem a tela Mensagens não recebe o aviso da mensagem", async () => {
    const access = await import("@/lib/services/partner-access");
    const { ROLE_SCREENS } = await import("@/lib/auth/screens");
    const supplierC = (
      await getStore().list("users", {
        filter: { partyId: "fornecedor-c" },
      })
    )[0];
    const { topicId } = await msg.openTopic(admin, {
      peerUserId: supplierC.id,
    });
    // Nada pendente no assunto: a próxima mensagem geraria um aviso novo.
    await msg.markTopicRead(supplierC, topicId);
    const before = (await inapp(supplierC.id)).length;
    await access.saveProfileScreens(admin, "role:supplier", {
      screens: ROLE_SCREENS.supplier.filter((s) => s !== "messages"),
      menuHidden: [],
    });
    try {
      await msg.postMessage(admin, topicId, "Sem a tela Mensagens");
      expect(await inapp(supplierC.id)).toHaveLength(before);
    } finally {
      await access.resetProfileScreens(admin, "role:supplier");
    }
    // Com o perfil de volta ao padrão, o aviso chega.
    await msg.postMessage(admin, topicId, "Com a tela de volta");
    expect(await inapp(supplierC.id)).toHaveLength(before + 1);
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
    await getStore().update("requests", request.id, {
      ownerUserId: admin.id,
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
    // Compra para estoque com o fornecedor A.
    const pf = await import("@/lib/services/stock-party");
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
    await orderFromRequest(admin, req, {
      supplierId: supplierA.partyId!,
      price: 3,
      sellPrice: 5_000,
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
    // A empresa tem um login que vê o pedido: a conversa é com ele.
    const conv = (await getStore().get(
      "conversations",
      opened.conversationId,
    ))!;
    expect(conv.externalUserId).toBe(supplierOfOrder.id);
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
    const own = await msg.listConversationsFor(supplierOfOrder);
    expect(own.map((c) => c.id)).toContain(mine.conversationId);
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
        peerUserId: otherSupplier.id,
      }),
    ).rejects.toThrow("not_participant");
    // Só com a empresa de fora do pedido: ninguém dela pode conversar.
    await expect(
      msg.openTopic(admin, {
        orderItemId: itemId,
        partyId: otherSupplier.partyId,
      }),
    ).rejects.toThrow("no_login");
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

  it("contexto do painel: Wellmix vê os logins e os itens; o fornecedor só fala com a Wellmix", async () => {
    const ctx = await msg.chatContext(admin, { orderId });
    expect(ctx.kind).toBe("order");
    expect(ctx.own).toBe(false);
    expect(ctx.me.login).toBe("admin@wellmix.com");
    expect(
      ctx.participants.some((p) => p.partyId === supplierOfOrder.partyId),
    ).toBe(true);
    // Cada login com quem dá para conversar, com o e-mail e a empresa.
    const peer = ctx.peers.find((p) => p.userId === supplierOfOrder.id)!;
    expect(peer).toMatchObject({
      login: supplierOfOrder.email,
      partyId: supplierOfOrder.partyId,
    });
    expect(peer.conversationId).toBeTruthy();
    expect(ctx.peers.some((p) => p.userId === otherSupplier.id)).toBe(false);
    expect(ctx.items.map((i) => i.id)).toContain(itemId);
    const mine = await msg.chatContext(supplierOfOrder, { orderId });
    expect(mine.own).toBe(true);
    expect(mine.participants).toEqual([]);
    expect(mine.peers.every((p) => p.side === "wellmix")).toBe(true);
    expect(mine.defaultPeerId).toBe(mine.peers[0]?.userId);
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
    const item = await msg.openTopic(supplierA, { orderItemId: i1.id });
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
  });
});
