import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { orderFromRequest } from "./helpers/order";

/*
 * Cotação na confirmação do cliente e lembrete da confirmação (dono,
 * 22/11/2026; docs/PURCHASE_DEMAND.md, "Cotação na confirmação do cliente",
 * e docs/ORDER_TERMS.md, "Lembrete da confirmação"):
 * - o cliente confirma a encomenda TS: ela entra sozinha na Estratégia (sem o
 *   "Enviar para cotação") e a cotação sai na hora para o fornecedor da
 *   última compra e todos os parceiros da família; quem não está apto fica
 *   de fora no resultado, com o motivo;
 * - a encomenda aberta pelo cliente também vira cotação na hora (um produto ou
 *   o lote inteiro numa cotação só), sem passar pela Estratégia;
 * - sem nenhum parceiro apto, a cotação nasce sem convite e o Comprador é
 *   avisado para gerar os logins; só o produto fora do catálogo fica na fila;
 * - desligada nas Configurações, a encomenda espera na Estratégia, como antes;
 * - enquanto o cliente não confirma: um lembrete por dia até o limite das
 *   Configurações; com o último, o vendedor é avisado uma vez.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { PARTY_EXTRA_DEFAULTS, LINE_EXTRA_DEFAULTS, PRODUCT_EXTRA_DEFAULTS } =
  await import("@/lib/db/schema");
const requests = await import("@/lib/services/requests");
const strategy = await import("@/lib/services/purchase-strategy");
const confirmation = await import("@/lib/services/customer-confirmation");
const reminders = await import("@/lib/services/confirm-reminders");
const productFamilies = await import("@/lib/services/product-families");
const { createPortalLogin } = await import("@/lib/services/portal-access");
const { confirmReminderStep, CONFIRM_REMINDER_GAP_MS } =
  await import("@/lib/confirm-reminders");
const { AUTO_ACTOR_ID } = await import("@/lib/purchase-demand");
const { setSetting } = await import("@/lib/settings");
const { countryKey } = await import("@/lib/order-terms");
type User = import("@/lib/db").User;
type Request = import("@/lib/db").Request;

let admin: User;
let seller: User;
let joao: User;
let traderParty: string;
let factoryParty: string;

const party = async (type: string, name: string) =>
  (
    await getStore().create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      type,
      name,
      country: "CN",
      email: null,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
    } as never)
  ).id;

/** Venda TS da Wellmix para o João (aguardando a confirmação dele). */
async function sale(
  products: string[],
  family = { key: "fm:UTILIDADES_DOMESTICAS", name: "UTILIDADES DOMESTICAS" },
): Promise<Request[]> {
  return requests.createRequestBatch(
    seller,
    {
      customerId: joao.partyId!,
      deadline: null,
      notes: null,
      requestedForUserId: joao.id,
      orderTerms: {
        operationType: "ts",
        carrierCaller: "wellmix",
        redispatchRequired: false,
        originCountry: countryKey("CN"),
        originCountryName: "China",
        productFamily: family.key,
        productFamilyName: family.name,
      } as never,
    },
    products.map((productId) => ({
      productId: productId.startsWith("fora:") ? null : productId,
      productName: productId,
      description: "Encomenda TS",
      specification: null,
      quantity: 600,
      unit: "un",
      sourcingDemand: false,
    })),
  );
}

const confirm = (r: Request) =>
  confirmation.confirmCustomerOrder(joao, r.id, {
    accept: true,
    cnpj: "",
    carrierName: "",
  });

const fresh = async (ids: string[]) =>
  getStore().list("requests", { filter: { id: ids } });

const notificationsTo = async (userId: string, subjectStart: string) =>
  (
    await getStore().list("notifications", {
      filter: { userId, channel: "inapp" },
    })
  ).filter((n) => n.subject.startsWith(subjectStart));

beforeAll(async () => {
  const { users } = await seedDemo();
  // A preparação (compra anterior) não vira cotação; os testes ligam abaixo.
  await setSetting("autoQuoteOrders", false);
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  seller = by("vendas@wellmix.com");
  joao = by("joao@lojista.com");
  // A Trading marcou a família e tem login (apta); a Fábrica marcou a
  // família e não tem login (fica de fora).
  traderParty = await party("trading", "Trading Ningbo");
  factoryParty = await party("factory", "Fábrica Yiwu");
  await createPortalLogin(admin, {
    partyId: traderParty,
    email: "cotacao@trading-ningbo.com",
    name: "Trading Ningbo",
    role: "supplier",
    locale: "en",
    password: "SenhaTeste123",
  });
  await productFamilies.setPartyFamilies(admin, traderParty, ["20000000"]);
  await productFamilies.setPartyFamilies(admin, factoryParty, ["20000000"]);
  // Compra anterior das panelas com o fornecedor A (a "última compra").
  const previous = await requests.createRequest(joao, {
    customerId: joao.partyId!,
    productId: "prod-panela",
    productName: "prod-panela",
    description: "Compra anterior",
    quantity: 2000,
    unit: "un",
  });
  await orderFromRequest(admin, previous, {
    supplierId: "fornecedor-a",
    price: 3.5,
    currency: "USD",
  });
  await getStore().update("requests", previous.id, { status: "ORDERED" });
  await setSetting("autoQuoteOrders", true);
});

describe("destinatários da cotação automática", () => {
  it("a última compra primeiro, cada um uma vez só e só os tipos que cotam", () => {
    const checks = new Map([
      ["a", { type: "supplier" as const }],
      ["b", { type: "trading" as const }],
      ["gp", { type: "gp" as const }],
    ]);
    expect(
      strategy.autoQuoteRecipients(
        ["a", null, "a"],
        ["b", "a", "gp", "x"],
        checks,
      ),
    ).toEqual(["a", "b"]);
  });
});

describe("cliente confirma: a cotação sai sozinha", () => {
  it("entra na Estratégia sem o Enviar para cotação e convida a última compra e a família", async () => {
    const store = getStore();
    const lot = await sale(["prod-panela", "prod-jarra"]);
    const ids = lot.map((r) => r.id);
    await confirm(lot[0]);

    const after = await fresh(ids);
    for (const r of after) {
      expect(r.strategySentAt).toBeTruthy();
      expect(r.strategySentByUserId).toBe(AUTO_ACTOR_ID);
      expect(r.status).toBe("RFQ_OPEN");
      expect(strategy.awaitingStrategySend(r)).toBe(false);
    }
    const decisionId = after[0].purchaseDecisionId!;
    expect(after.every((r) => r.purchaseDecisionId === decisionId)).toBe(true);
    const decision = (await store.get("purchase_decisions", decisionId))!;
    expect(decision).toMatchObject({
      choice: "quote",
      status: "approved",
      chosenByUserId: AUTO_ACTOR_ID,
      note: strategy.AUTO_QUOTE_NOTE,
    });
    // Uma cotação para a solicitação inteira, aberta pelo portal.
    const quote = (await store.get("purchase_quotes", decision.quoteId!))!;
    expect(quote.openedByUserId).toBe(AUTO_ACTOR_ID);
    expect(quote.items.map((i) => i.productId).sort()).toEqual([
      "prod-jarra",
      "prod-panela",
    ]);
    // O envio: o fornecedor da última compra primeiro; a Trading recebe; a
    // Fábrica (sem login) fica de fora com o motivo.
    const send = (await store.get(
      "purchase_strategy_sends",
      decision.sendId!,
    ))!;
    expect(send.createdByUserId).toBe(AUTO_ACTOR_ID);
    const [line] = send.lines;
    expect(line.recipientIds[0]).toBe("fornecedor-a");
    expect(line.recipientIds).toEqual(
      expect.arrayContaining([traderParty, factoryParty]),
    );
    const status = (id: string) =>
      line.recipients.find((r) => r.partyId === id);
    expect(status("fornecedor-a")?.status).toBe("sent");
    expect(status(traderParty)?.status).toBe("sent");
    expect(status(factoryParty)).toMatchObject({
      status: "blocked",
      reasons: ["no_login"],
    });
    const invited = await store.list("purchase_quote_responses", {
      filter: { quoteId: quote.id },
    });
    expect(invited.map((r) => r.supplierId)).toEqual(
      expect.arrayContaining(["fornecedor-a", traderParty]),
    );
    expect(invited.map((r) => r.supplierId)).not.toContain(factoryParty);
    // A auditoria fica sem login (a tela mostra "Sistema").
    const log = await store.list("audit_log", {
      filter: { action: "purchase_strategy.send", entityId: send.id },
    });
    expect(log).toHaveLength(1);
    expect(log[0].userId).toBeNull();
    expect(log[0].summary).toContain("automático");
    // O Comprador fica sabendo, com o link do resultado; a Fábrica de fora
    // deixa a pendência "Tentar de novo" sem dono (de quem escolhe).
    const notices = (
      await store.list("notifications", { filter: { channel: "inapp" } })
    ).filter((n) => n.link === `/app/purchase-strategy/sends/${send.id}`);
    expect(notices.length).toBeGreaterThan(0);
    expect(notices[0].subject).toContain("aberta sozinha");
    const drafts = await strategy.strategyTaskDrafts([]);
    const retry = drafts.find(
      (d) =>
        d.kind === "purchase_strategy_send" &&
        d.link === `/app/purchase-strategy/sends/${send.id}`,
    );
    expect(retry?.ownerUserId).toBeNull();
  });

  it("sem nenhum parceiro apto: a cotação nasce sem convite e o Comprador é avisado para gerar os logins", async () => {
    const store = getStore();
    // Família Decoração com um fornecedor sem login.
    const lonely = await party("supplier", "Fornecedor sem login");
    await store.create("product_lines", {
      ...LINE_EXTRA_DEFAULTS,
      id: "linha-decoracao",
      name: "Decoração",
      manualDocumentId: null,
      requirements: [],
      active: true,
      familyCode: "40000000",
    } as never);
    await store.create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      id: "prod-vaso",
      lineId: "linha-decoracao",
      name: "Vaso de cerâmica",
      sku: "DEC-001",
      specification: null,
      active: true,
      source: "manual",
      supplierId: lonely,
      cbm: null,
    } as never);
    const [r] = await sale(["prod-vaso"], {
      key: "fm:DECORACAO",
      name: "DECORACAO",
    });
    await confirm(r);
    const [after] = await fresh([r.id]);
    // Já é cotação (dono, 22/11/2026): não fica esperando na Estratégia.
    expect(after.status).toBe("RFQ_OPEN");
    expect(after.purchaseDecisionId).toBeTruthy();
    expect(strategy.inStrategyQueue(after)).toBe(false);
    const decision = (await store.get(
      "purchase_decisions",
      after.purchaseDecisionId!,
    ))!;
    const quote = (await store.get("purchase_quotes", decision.quoteId!))!;
    expect(
      await store.list("purchase_quote_responses", {
        filter: { quoteId: quote.id },
      }),
    ).toEqual([]);
    // Quem ficou de fora aparece no resultado, com o motivo.
    const send = (await store.get(
      "purchase_strategy_sends",
      decision.sendId!,
    ))!;
    expect(send.lines[0].recipients).toEqual([
      expect.objectContaining({
        partyId: lonely,
        status: "blocked",
        reasons: ["no_login"],
      }),
    ]);
    // Um aviso só, com o motivo e o caminho (não o "sem resposta" genérico).
    const inbox = await store.list("notifications", {
      filter: { channel: "inapp" },
    });
    const notices = inbox.filter((n) =>
      n.subject.startsWith(`Consulta nº ${quote.number} aberta sem convite`),
    );
    expect(notices.length).toBeGreaterThan(0);
    expect(notices[0].body).toContain("Gere os logins");
    expect(notices[0].link).toBe(`/app/purchase-strategy/sends/${send.id}`);
    expect(
      inbox.filter(
        (n) =>
          n.subject === `Consulta de compra nº ${quote.number} sem resposta`,
      ),
    ).toEqual([]);
    expect(quote.emptyNotifiedAt).toBeTruthy();
  });

  it("entrada na fila já gravada por outro caminho: a cotação sai do mesmo jeito", async () => {
    const store = getStore();
    const [r] = await sale(["prod-panela"]);
    // Confirmada e já na fila (como a entrada direta faria), sem estratégia.
    const at = new Date().toISOString();
    const queuedAlready = await store.update("requests", r.id, {
      status: "REQUESTED",
      strategySentAt: at,
      strategySentByUserId: admin.id,
    });
    const [outcome] = await strategy.autoQuoteConfirmed([queuedAlready]);
    expect(outcome.state).toBe("sent");
    const [after] = await fresh([r.id]);
    // A entrada que já existia fica como estava.
    expect(after.strategySentAt).toBe(at);
    expect(after.strategySentByUserId).toBe(admin.id);
    expect(after.status).toBe("RFQ_OPEN");
    expect(after.purchaseDecisionId).toBeTruthy();
    // Chamada de novo, não abre outra cotação.
    expect(await strategy.autoQuoteConfirmed([after])).toEqual([]);
  });

  it("produto fora do catálogo: só entra na fila, sem cotação e sem aviso duplicado", async () => {
    const store = getStore();
    const [r] = await sale(["fora:Produto novo"]);
    await confirm(r);
    const [after] = await fresh([r.id]);
    // Entrada direta na fila (sem o Enviar para cotação), sem estratégia.
    expect(after.status).toBe("REQUESTED");
    expect(after.strategySentAt).toBeTruthy();
    expect(after.purchaseDecisionId ?? null).toBeNull();
    expect(strategy.awaitingStrategySend(after)).toBe(false);
    expect(strategy.inStrategyQueue(after)).toBe(true);
    // Um aviso só a quem escolhe a estratégia (o da entrada na fila).
    const notices = (
      await store.list("notifications", { filter: { channel: "inapp" } })
    ).filter(
      (n) =>
        n.body.includes(`nº ${after.number} `) ||
        n.subject.includes(`nº ${after.number} confirmada`),
    );
    expect(
      notices.some((n) =>
        n.subject.includes("confirmado(s) pelo cliente na Estratégia"),
      ),
    ).toBe(true);
    expect(notices.some((n) => n.subject.includes("aberta sozinha"))).toBe(
      false,
    );
  });

  it("cotação que saiu sozinha: sem o aviso da fila (um aviso só ao Comprador)", async () => {
    const store = getStore();
    const [r] = await sale(["prod-jarra"]);
    await confirm(r);
    const [after] = await fresh([r.id]);
    expect(after.status).toBe("RFQ_OPEN");
    const queueNotices = (
      await store.list("notifications", { filter: { channel: "inapp" } })
    ).filter(
      (n) =>
        n.subject.includes("confirmado(s) pelo cliente na Estratégia") &&
        n.body.includes(`nº ${after.number} `),
    );
    expect(queueNotices).toEqual([]);
  });
});

describe("encomenda aberta pelo cliente: vira cotação na hora", () => {
  it("um produto: a cotação sai ao criar, sem passar pela Estratégia", async () => {
    const store = getStore();
    const r = await requests.createRequest(joao, {
      customerId: joao.partyId!,
      productId: "prod-panela",
      productName: "prod-panela",
      description: "Encomenda do cliente",
      quantity: 900,
      unit: "un",
    });
    const [after] = await fresh([r.id]);
    expect(after.status).toBe("RFQ_OPEN");
    expect(strategy.inStrategyQueue(after)).toBe(false);
    const decision = (await store.get(
      "purchase_decisions",
      after.purchaseDecisionId!,
    ))!;
    expect(decision).toMatchObject({
      choice: "quote",
      chosenByUserId: AUTO_ACTOR_ID,
    });
    // A última compra (fornecedor A) e quem marcou a família (a Trading).
    const invited = await store.list("purchase_quote_responses", {
      filter: { quoteId: decision.quoteId! },
    });
    expect(invited.map((x) => x.supplierId)).toEqual(
      expect.arrayContaining(["fornecedor-a", traderParty]),
    );
  });

  it("lote com dois produtos: uma cotação só, com os dois", async () => {
    const store = getStore();
    const lot = await requests.createRequestBatch(
      joao,
      { customerId: joao.partyId!, deadline: null, notes: null },
      ["prod-panela", "prod-jarra"].map((productId) => ({
        productId,
        productName: productId,
        description: "Lote do cliente",
        specification: null,
        quantity: 600,
        unit: "un",
        sourcingDemand: false,
      })),
    );
    const after = await fresh(lot.map((r) => r.id));
    expect(after.every((r) => r.status === "RFQ_OPEN")).toBe(true);
    const decisionIds = new Set(after.map((r) => r.purchaseDecisionId));
    expect(decisionIds.size).toBe(1);
    const decision = (await store.get(
      "purchase_decisions",
      [...decisionIds][0]!,
    ))!;
    const quote = (await store.get("purchase_quotes", decision.quoteId!))!;
    expect(quote.items.map((i) => i.productId).sort()).toEqual([
      "prod-jarra",
      "prod-panela",
    ]);
  });

  it("desligada nas Configurações: a encomenda espera na Estratégia, como antes", async () => {
    await setSetting("autoQuoteOrders", false);
    try {
      const r = await requests.createRequest(joao, {
        customerId: joao.partyId!,
        productId: "prod-jarra",
        productName: "prod-jarra",
        description: "Encomenda com a chave desligada",
        quantity: 300,
        unit: "un",
      });
      const [after] = await fresh([r.id]);
      expect(after.status).toBe("REQUESTED");
      expect(after.purchaseDecisionId ?? null).toBeNull();
      expect(strategy.inStrategyQueue(after)).toBe(true);
    } finally {
      await setSetting("autoQuoteOrders", true);
    }
  });
});

describe("lembrete da confirmação: as regras", () => {
  const sentAt = "2026-11-20T12:00:00.000Z";
  const at = (hours: number) =>
    new Date(Date.parse(sentAt) + hours * 3_600_000);
  it("espera um dia, lembra até o limite e o último avisa o vendedor", () => {
    expect(
      confirmReminderStep({ sentAt, reminders: null, max: 3, now: at(19) }),
    ).toBe("wait");
    expect(
      confirmReminderStep({ sentAt, reminders: null, max: 3, now: at(21) }),
    ).toBe("remind");
    const one = {
      count: 1,
      lastAt: at(21).toISOString(),
      sellerNotifiedAt: null,
    };
    expect(
      confirmReminderStep({ sentAt, reminders: one, max: 3, now: at(30) }),
    ).toBe("wait");
    const two = {
      count: 2,
      lastAt: at(45).toISOString(),
      sellerNotifiedAt: null,
    };
    expect(
      confirmReminderStep({ sentAt, reminders: two, max: 3, now: at(69) }),
    ).toBe("remind_last");
    const three = { ...two, count: 3 };
    expect(
      confirmReminderStep({ sentAt, reminders: three, max: 3, now: at(200) }),
    ).toBe("done");
    // Desligado (0) ou o limite baixou depois: nada.
    expect(
      confirmReminderStep({ sentAt, reminders: null, max: 0, now: at(48) }),
    ).toBe("done");
    expect(
      confirmReminderStep({ sentAt, reminders: two, max: 1, now: at(200) }),
    ).toBe("done");
    expect(CONFIRM_REMINDER_GAP_MS).toBe(20 * 3_600_000);
  });
});

describe("lembrete da confirmação: o job diário", () => {
  it("um por dia ao login do cliente, o último avisa o vendedor uma vez, e para", async () => {
    await setSetting("customerConfirmReminderMax", 2);
    const lot = await sale(["prod-panela", "prod-jarra"]);
    const n = lot[0].number;
    const base = Date.parse(lot[0].createdAt);
    const day = (d: number, h = 0) =>
      new Date(base + d * 86_400_000 + h * 3_600_000);
    const subject = `Lembrete: confirme o pedido nº ${n}`;

    // Menos de um dia: nada.
    await reminders.remindCustomerConfirmations(day(0, 10));
    expect(await notificationsTo(joao.id, subject)).toHaveLength(0);

    // 1º lembrete (um aviso só para o lote inteiro).
    await reminders.remindCustomerConfirmations(day(1));
    expect(await notificationsTo(joao.id, subject)).toHaveLength(1);
    const [first] = await fresh([lot[0].id]);
    expect(first.orderTerms?.confirmReminders).toMatchObject({
      count: 1,
      sellerNotifiedAt: null,
    });
    // O job rodou de novo no mesmo dia: não repete.
    await reminders.remindCustomerConfirmations(day(1, 2));
    expect(await notificationsTo(joao.id, subject)).toHaveLength(1);

    // 2º e último: o vendedor é avisado.
    await reminders.remindCustomerConfirmations(day(2));
    expect(await notificationsTo(joao.id, subject)).toHaveLength(2);
    const sellerNotice = await notificationsTo(
      seller.id,
      `Cliente ainda não confirmou: encomenda nº ${n}`,
    );
    expect(sellerNotice).toHaveLength(1);
    expect(sellerNotice[0].link).toBe(`/app/requests/${lot[0].id}`);
    for (const r of await fresh(lot.map((x) => x.id)))
      expect(r.orderTerms?.confirmReminders).toMatchObject({ count: 2 });

    // Acabou o limite: nada mais, nem para o vendedor.
    await reminders.remindCustomerConfirmations(day(5));
    expect(await notificationsTo(joao.id, subject)).toHaveLength(2);
    expect(
      await notificationsTo(
        seller.id,
        `Cliente ainda não confirmou: encomenda nº ${n}`,
      ),
    ).toHaveLength(1);

    // Confirmada, sai da lista do job.
    await confirm(lot[0]);
    const done = await reminders.remindCustomerConfirmations(day(9));
    expect(done.reminded).toBe(0);
  });

  it("sem login ativo do cliente a contagem não anda; 0 desliga", async () => {
    await setSetting("customerConfirmReminderMax", 3);
    const [r] = await sale(["prod-jarra"]);
    const later = new Date(Date.parse(r.createdAt) + 2 * 86_400_000);
    await getStore().update("users", joao.id, { active: false });
    try {
      await reminders.remindCustomerConfirmations(later);
      const [after] = await fresh([r.id]);
      expect(after.orderTerms?.confirmReminders ?? null).toBeNull();
    } finally {
      await getStore().update("users", joao.id, { active: true });
    }
    await setSetting("customerConfirmReminderMax", 0);
    const off = await reminders.remindCustomerConfirmations(later);
    expect(off).toEqual({ reminded: 0, sellers: 0 });
    await setSetting("customerConfirmReminderMax", 3);
  });
});
