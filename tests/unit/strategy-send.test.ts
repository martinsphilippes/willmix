import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { orderFromRequest } from "./helpers/order";

/*
 * Estratégia de Compra por produto (dono, 18/11/2026; docs/PURCHASE_DEMAND.md,
 * "Estratégia de Compra por produto"):
 * - Encomendas → "Enviar para cotação": só então a encomenda entra na fila;
 *   a reposição entra sozinha (D1).
 * - Por produto: cotar com o fornecedor da última compra, cotar com outros
 *   parceiros (Fornecedor, Trading, Supplier, Factory) ou o pedido direto.
 *   Cotar não passa pela aprovação (D2); o pedido direto continua passando.
 * - Quem tem pendência (sem login, inativo, tipo que não cota, tela fechada)
 *   fica de fora e aparece no resultado; "Tentar de novo" convida depois de
 *   regularizar, sem duplicar quem já recebeu.
 * - Trading responde, mas ainda não vence (D4). O parceiro vê a
 *   especificação e a programação, nunca o cliente (D6).
 * - A tela própria nasce aberta para quem abre as cotações (ninguém perde).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { PARTY_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
const requests = await import("@/lib/services/requests");
const strategy = await import("@/lib/services/purchase-strategy");
const quotes = await import("@/lib/services/purchase-quote");
const families = await import("@/lib/services/partner-families");
const origin = await import("@/lib/services/product-origin");
const { checkRecipients } = await import("@/lib/services/purchase-recipients");
const { recipientVerdict } = await import("@/lib/purchase-recipients");
const { createPortalLogin } = await import("@/lib/services/portal-access");
const { screensFor } = await import("@/lib/auth/screens");
const { resolveFunctions } = await import("@/lib/auth/function-access");
const { translator } = await import("@/i18n");
type User = import("@/lib/db").User;
type Request = import("@/lib/db").Request;

const t = translator("pt");
let admin: User;
let buyer: User;
let joao: User;
let supplierA: User;
let trader: User;
let traderParty: string;
let factoryParty: string;
let gpParty: string;

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

/** Encomenda do João (criada e, se `send`, enviada para cotação). */
async function encomenda(
  productId: string,
  extra: Partial<import("@/lib/services/requests").CreateRequestInput> = {},
  send = true,
): Promise<Request> {
  const r = await requests.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: productId,
    description: "Encomenda",
    quantity: 1200,
    unit: "un",
    ...extra,
  });
  if (!send) return r;
  const { sent } = await strategy.sendToStrategy(admin, [r.id]);
  return sent[0];
}

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  buyer = by("operador@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  traderParty = await party("trading", "Trading Ningbo");
  factoryParty = await party("factory", "Fábrica Yiwu");
  gpParty = await party("gp", "GP Shenzhen");
  trader = await createPortalLogin(admin, {
    partyId: traderParty,
    email: "cotacao@trading-ningbo.com",
    name: "Trading Ningbo",
    role: "supplier",
    locale: "en",
    password: "SenhaTeste123",
  });
  // Compra anterior das panelas: fornecedor A (a "última compra").
  const previous = await requests.createRequest(joao, {
    customerId: "cliente-joao",
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
});

describe("Enviar para cotação (Encomendas)", () => {
  it("a encomenda só entra na fila depois de enviada; enviar de novo não muda nada", async () => {
    const d = await encomenda("prod-jarra", {}, false);
    expect(strategy.awaitingStrategySend(d)).toBe(true);
    expect(strategy.inStrategyQueue(d)).toBe(false);
    expect((await strategy.waitingDemands()).map((r) => r.id)).not.toContain(
      d.id,
    );
    await expect(
      strategy.chooseStrategy(buyer, {
        demandIds: [d.id],
        choice: "quote",
        note: null,
      }),
    ).rejects.toThrow("strategy_demand_not_sent");

    const first = await strategy.sendToStrategy(buyer, [d.id, d.id]);
    expect(first.sent.map((r) => r.id)).toEqual([d.id]);
    expect(first.sent[0].strategySentByUserId).toBe(buyer.id);
    expect((await strategy.waitingDemands()).map((r) => r.id)).toContain(d.id);
    const again = await strategy.sendToStrategy(buyer, [d.id]);
    expect(again).toMatchObject({ sent: [], skipped: 1 });
    const audit = await getStore().list("audit_log", {
      filter: { entityId: d.id, action: "purchase_strategy.send_request" },
    });
    expect(audit).toHaveLength(1);
  });

  it("a reposição entra sozinha", async () => {
    const { openReplenishment } =
      await import("@/lib/services/purchase-demand");
    const r = await openReplenishment(admin, {
      productId: "prod-jarra",
      quantity: 300,
      desiredAt: null,
      notes: null,
    });
    expect(strategy.inStrategyQueue(r)).toBe(true);
    expect(strategy.awaitingStrategySend(r)).toBe(false);
  });

  it("a encomenda ainda não enviada vira a pendência “Enviar para cotação”, também para o Comprador", async () => {
    const d = await encomenda("prod-boneca", { quantity: 2000 }, false);
    const { pendingTasksFor } = await import("@/lib/services/tasks");
    const mine = (await pendingTasksFor(buyer)).filter(
      (x) => x.link === `/app/requests/${d.id}`,
    );
    expect(mine[0]).toMatchObject({
      kind: "new_request",
      title: "Enviar para cotação: prod-boneca",
    });
    expect(t(mine[0].text!.title, mine[0].text!.values)).toBe(
      "Enviar para cotação: prod-boneca",
    );
  });
});

describe("quem recebe a cotação", () => {
  it("regras: tipo, cadastro, tipo ativo, login e tela Cotação", () => {
    const base = {
      type: "supplier",
      active: true,
      typeActive: true,
      logins: 1,
      quotesScreen: true,
      loginsWithEmail: 1,
    };
    expect(recipientVerdict(base)).toEqual({
      issues: [],
      warnings: [],
      ok: true,
    });
    expect(recipientVerdict({ ...base, type: "gp" }).issues).toEqual([
      "not_quote_type",
    ]);
    expect(recipientVerdict({ ...base, logins: 0 }).issues).toEqual([
      "no_login",
    ]);
    expect(recipientVerdict({ ...base, quotesScreen: false }).issues).toEqual([
      "no_quotes_screen",
    ]);
    expect(recipientVerdict({ ...base, loginsWithEmail: 0 })).toMatchObject({
      ok: true,
      warnings: ["no_email"],
    });
  });

  it("Fornecedor e Trading aptos (a Trading não vence); sem login, inativo e GP ficam de fora", async () => {
    await getStore().update("parties", "fornecedor-b", { active: false });
    const checks = await checkRecipients(
      ["fornecedor-a", "fornecedor-b", traderParty, factoryParty, gpParty],
      t,
    );
    expect(checks.get("fornecedor-a")).toMatchObject({
      ok: true,
      canWin: true,
      logins: 1,
    });
    expect(checks.get(traderParty)).toMatchObject({
      ok: true,
      canWin: false,
      type: "trading",
    });
    expect(checks.get(factoryParty)!.issues).toEqual(["no_login"]);
    expect(checks.get("fornecedor-b")!.issues).toContain("inactive");
    expect(checks.get(gpParty)!.issues).toContain("not_quote_type");
    await getStore().update("parties", "fornecedor-b", { active: true });
  });

  it("tipo desativado e a tela Cotação fechada no perfil do tipo também são sinalizados", async () => {
    const store = getStore();
    const type = await store.create("partner_types", {
      key: "trading",
      builtin: "trading",
      name: "Trading",
      nameEn: null,
      nameZh: null,
      description: null,
      active: false,
      loginClass: null,
      createdByUserId: null,
      updatedByUserId: null,
    } as never);
    expect(
      (await checkRecipients([traderParty], t)).get(traderParty)!.issues,
    ).toContain("type_inactive");
    await store.update("partner_types", type.id, { active: true });
    const config = await store.create("settings", {
      key: "partnerAccess",
      value: {
        "type:trading": {
          screens: ["home", "tasks", "booking"],
          menuHidden: [],
          sources: {},
          extrasDecided: true,
        },
      },
    } as never);
    expect(
      (await checkRecipients([traderParty], t)).get(traderParty)!.issues,
    ).toEqual(["no_quotes_screen"]);
    await store.remove("settings", config.id);
    expect((await checkRecipients([traderParty], t)).get(traderParty)!.ok).toBe(
      true,
    );
  });
});

describe("famílias atendidas", () => {
  it("só os tipos que cotam; troca a lista inteira e fica na Auditoria", async () => {
    origin.resetOriginIndex();
    const fam = (await origin.familiesOfProducts(["prod-panela"])).get(
      "prod-panela",
    )!;
    expect(fam.key).toMatch(/^(fm|ln):/);
    await expect(
      families.setPartnerFamilies(admin, gpParty, [fam.key]),
    ).rejects.toThrow("family_type_not_allowed");
    await families.setPartnerFamilies(admin, traderParty, [fam.key]);
    expect((await families.partnersByFamily([fam.key])).get(fam.key)).toEqual([
      traderParty,
    ]);
    await families.setPartnerFamilies(admin, traderParty, []);
    expect(
      (await families.partnersByFamily([fam.key])).get(fam.key),
    ).toBeUndefined();
    await families.setPartnerFamilies(admin, traderParty, [fam.key]);
    const audit = await getStore().list("audit_log", {
      filter: { entityId: traderParty, action: "partner.families" },
    });
    expect(audit).toHaveLength(3);
  });

  it("a fila mostra os vinculados à família e sugere quem já forneceu (sem vínculo)", async () => {
    const d = await encomenda("prod-panela");
    const board = await strategy.strategyBoard(t);
    const line = board.lines.find((l) => l.demand.id === d.id)!;
    expect(line.linkedIds).toContain(traderParty);
    expect(line.last?.supplierId).toBe("fornecedor-a");
    // A última compra entra como sugestão (o vínculo dela não foi marcado).
    expect(line.suggestedIds).toContain("fornecedor-a");
    expect(line.suggestedIds).not.toContain(traderParty);
    expect(board.checks.get(traderParty)?.ok).toBe(true);
  });
});

describe("envio da Estratégia de Compra", () => {
  it("cotar com o fornecedor da última compra: sem aprovação, só ele recebe, com especificação e programação e sem o cliente", async () => {
    const d = await encomenda("prod-panela", {
      specification: "Tampa de vidro temperado",
      desiredAt: "2027-03-10T12:00:00.000Z",
      schedule: {
        intervalDays: 30,
        firstDate: "2027-03-10",
        items: [
          { index: 1, quantity: 600, expectedAt: "2027-03-10" },
          { index: 2, quantity: 600, expectedAt: "2027-04-09" },
        ],
      },
    });
    const send = await strategy.sendStrategy(
      buyer,
      {
        lines: [{ demandId: d.id, choice: "quote_last", recipientIds: [] }],
        note: null,
      },
      t,
    );
    expect(send.status).toBe("ok");
    const [line] = send.lines;
    expect(line.recipients).toEqual([
      expect.objectContaining({
        partyId: "fornecedor-a",
        status: "sent",
        logins: 1,
      }),
    ]);
    const decision = (await getStore().get(
      "purchase_decisions",
      line.decisionId!,
    ))!;
    expect(decision).toMatchObject({
      choice: "quote_last",
      status: "approved",
      approvedByUserId: null,
      recipientIds: ["fornecedor-a"],
      sendId: send.id,
    });
    expect((await getStore().get("requests", d.id))!.status).toBe("RFQ_OPEN");
    const responses = await getStore().list("purchase_quote_responses", {
      filter: { quoteId: line.quoteId! },
    });
    expect(responses.map((r) => r.supplierId)).toEqual(["fornecedor-a"]);
    // O que o fornecedor vê: itens com especificação e programação, sem o cliente.
    const view = (await quotes.supplierQuoteView(supplierA, line.quoteId!))!;
    expect(view.quote.items[0]).toMatchObject({
      specification: "Tampa de vidro temperado",
      desiredAt: "2027-03-10T12:00:00.000Z",
    });
    expect(view.quote.items[0].schedule?.items).toHaveLength(2);
    expect(JSON.stringify(view)).not.toContain("cliente-joao");
  });

  it("cotar com outros: quem tem pendência fica de fora; “Tentar de novo” convida depois de regularizar, sem duplicar", async () => {
    const d = await encomenda("prod-jarra");
    const send = await strategy.sendStrategy(
      buyer,
      {
        lines: [
          {
            demandId: d.id,
            choice: "quote",
            recipientIds: ["fornecedor-a", traderParty, factoryParty],
          },
        ],
        note: "Cotar a jarra",
      },
      t,
    );
    expect(send.status).toBe("failures");
    expect(strategy.pendingRecipients(send)).toBe(1);
    const status = (id: string, s = send) =>
      s.lines[0].recipients.find((r) => r.partyId === id);
    expect(status(traderParty)).toMatchObject({ status: "sent", logins: 1 });
    expect(status(factoryParty)).toMatchObject({
      status: "blocked",
      reasons: ["no_login"],
    });
    // Pendência para regularizar e tentar de novo.
    const drafts = await strategy.strategyTaskDrafts([]);
    expect(
      drafts.find(
        (x) =>
          x.kind === "purchase_strategy_send" &&
          x.link === `/app/purchase-strategy/sends/${send.id}`,
      ),
    ).toBeTruthy();

    // Sem regularizar: continua de fora.
    const still = await strategy.retryStrategySend(buyer, send.id, t);
    expect(still.sentNow).toBe(0);

    // Com o login criado: recebe; quem já tinha recebido não recebe de novo.
    await createPortalLogin(admin, {
      partyId: factoryParty,
      email: "vendas@fabrica-yiwu.com",
      name: "Fábrica Yiwu",
      role: "supplier",
      locale: "zh",
      password: "SenhaTeste123",
    });
    const retried = await strategy.retryStrategySend(buyer, send.id, t);
    expect(retried.sentNow).toBe(1);
    expect(retried.send.status).toBe("ok");
    expect(status(factoryParty, retried.send)?.status).toBe("sent");
    const responses = await getStore().list("purchase_quote_responses", {
      filter: { quoteId: send.lines[0].quoteId! },
    });
    expect(responses.map((r) => r.supplierId).sort()).toEqual(
      ["fornecedor-a", factoryParty, traderParty].sort(),
    );
    await expect(strategy.retryStrategySend(buyer, send.id, t)).rejects.toThrow(
      "strategy_nothing_to_retry",
    );

    // Convidar de novo pela cotação não duplica (índice único cotação × parceiro).
    const quote = (await getStore().get(
      "purchase_quotes",
      send.lines[0].quoteId!,
    ))!;
    expect(
      (await quotes.inviteRecipient(quote, traderParty, new Date())).status,
    ).toBe("already");

    // D4: a Trading responde, aparece no comparativo, mas não vence.
    const answer = {
      decline: false,
      prices: [{ productId: "prod-jarra", unitPrice: 2.1 }],
      currency: "USD",
      incoterm: "FOB",
      leadTimeDays: 35,
      port: "Ningbo",
      moq: 500,
      note: null,
    };
    await quotes.answerQuote(trader, quote.id, answer);
    await quotes.answerQuote(supplierA, quote.id, {
      ...answer,
      prices: [{ productId: "prod-jarra", unitPrice: 2.4 }],
    });
    const late = new Date(Date.now() + 49 * 3_600_000);
    const all = await getStore().list("purchase_quote_responses", {
      filter: { quoteId: quote.id },
    });
    const byParty = (id: string) => all.find((r) => r.supplierId === id)!;
    await expect(
      quotes.chooseWinner(buyer, quote.id, byParty(traderParty).id, null, late),
    ).rejects.toThrow("quote_winner_not_supplier");
    const chosen = await quotes.chooseWinner(
      buyer,
      quote.id,
      byParty("fornecedor-a").id,
      null,
      late,
    );
    expect(chosen.status).toBe("chosen");
  });

  it("cotação encerrada: quem ficou de fora não tem mais o que tentar, e a pendência sai", async () => {
    const d = await encomenda("prod-jarra");
    const lonely = await party("factory", "Fábrica sem login");
    const send = await strategy.sendStrategy(
      buyer,
      {
        lines: [
          {
            demandId: d.id,
            choice: "quote",
            recipientIds: ["fornecedor-a", lonely],
          },
        ],
        note: null,
      },
      t,
    );
    expect(strategy.pendingRecipients(send)).toBe(1);
    // A cotação anda (a vencedora foi escolhida) antes de alguém regularizar.
    await getStore().update("purchase_quotes", send.lines[0].quoteId!, {
      status: "chosen",
    });
    const pending = async () =>
      (await strategy.strategyTaskDrafts([])).some(
        (x) =>
          x.kind === "purchase_strategy_send" &&
          x.link === `/app/purchase-strategy/sends/${send.id}`,
      );
    expect(await pending()).toBe(false);
    const done = await strategy.retryStrategySend(buyer, send.id, t);
    expect(done.sentNow).toBe(0);
    expect(done.send.status).toBe("ok");
    expect(strategy.pendingRecipients(done.send)).toBe(0);
    expect(strategy.closedRecipients(done.send)).toBe(1);
    await expect(strategy.retryStrategySend(buyer, send.id, t)).rejects.toThrow(
      "strategy_nothing_to_retry",
    );
  });

  it("pedido direto: vai para a aprovação da Diretoria de compras, como antes", async () => {
    const d = await encomenda("prod-panela");
    const send = await strategy.sendStrategy(
      buyer,
      {
        lines: [{ demandId: d.id, choice: "last_supplier", recipientIds: [] }],
        note: null,
      },
      t,
    );
    expect(send.status).toBe("ok");
    const decision = (await getStore().get(
      "purchase_decisions",
      send.lines[0].decisionId!,
    ))!;
    expect(decision).toMatchObject({
      choice: "last_supplier",
      status: "pending",
      quoteId: null,
    });
    expect(send.lines[0].recipients).toEqual([]);
  });

  it("recusa o que não pode: vazio, repetido, sem apto, tipo que não cota, não enviada", async () => {
    const send = (
      lines: Parameters<typeof strategy.sendStrategy>[1]["lines"],
    ) => strategy.sendStrategy(buyer, { lines, note: null }, t);
    await expect(send([])).rejects.toThrow("strategy_send_empty");
    const d = await encomenda("prod-jarra");
    await expect(
      send([
        { demandId: d.id, choice: "quote", recipientIds: ["fornecedor-a"] },
        { demandId: d.id, choice: "quote", recipientIds: ["fornecedor-a"] },
      ]),
    ).rejects.toThrow("strategy_line_duplicated");
    await expect(
      send([{ demandId: d.id, choice: "quote", recipientIds: [] }]),
    ).rejects.toThrow("strategy_send_recipients");
    await expect(
      send([{ demandId: d.id, choice: "quote", recipientIds: [gpParty] }]),
    ).rejects.toThrow("strategy_recipient_type");
    const noLogin = await party("supplier_partner", "Supplier sem login");
    await expect(
      send([{ demandId: d.id, choice: "quote", recipientIds: [noLogin] }]),
    ).rejects.toThrow("strategy_send_no_ok_recipient");
    await expect(
      send([{ demandId: d.id, choice: "quote_last", recipientIds: [] }]),
    ).rejects.toThrow("strategy_no_last_purchase");
    const unsent = await encomenda("prod-jarra", {}, false);
    await expect(
      send([
        {
          demandId: unsent.id,
          choice: "quote",
          recipientIds: ["fornecedor-a"],
        },
      ]),
    ).rejects.toThrow("strategy_demand_not_sent");
    // Nada foi gravado: a demanda continua na fila.
    expect(
      strategy.inStrategyQueue((await getStore().get("requests", d.id))!),
    ).toBe(true);
  });
});

describe("tela própria da Estratégia de Compra (ninguém perde acesso)", () => {
  const op = (extra: Partial<User>) =>
    ({ role: "operator", functions: [], ...extra }) as User;

  it("o padrão das funções: quem abre as cotações abre a Estratégia", () => {
    expect(
      screensFor(op({ functions: ["buyer"] })).has("purchaseStrategy"),
    ).toBe(true);
    expect(
      screensFor(op({ functions: ["purchasing_director"] })).has(
        "purchaseStrategy",
      ),
    ).toBe(true);
    expect(
      screensFor(op({ functions: ["sales"] })).has("purchaseStrategy"),
    ).toBe(false);
  });

  it("lista antiga e exceções do Personalizado seguem a tela de cotações", () => {
    expect(
      screensFor(op({ screens: ["quotes"] })).has("purchaseStrategy"),
    ).toBe(true);
    expect(
      screensFor(op({ screens: ["orders"] })).has("purchaseStrategy"),
    ).toBe(false);
    const added = op({
      functions: ["sales"],
      screenExceptions: { added: ["quotes"], removed: [] },
    });
    expect(screensFor(added).has("purchaseStrategy")).toBe(true);
    const removed = op({
      functions: ["buyer"],
      screenExceptions: { added: [], removed: ["quotes"] },
    });
    expect(screensFor(removed).has("purchaseStrategy")).toBe(false);
    const own = op({
      functions: ["buyer"],
      screenExceptions: { added: [], removed: ["purchaseStrategy"] },
    });
    expect(screensFor(own).has("quotes")).toBe(true);
    expect(screensFor(own).has("purchaseStrategy")).toBe(false);
  });

  it("função gravada antes da tela nova: segue o que ela tem em cotações", () => {
    const before = ["home", "tasks", "requests", "orders"];
    const defs = resolveFunctions({
      functions: [
        // O administrador tirou as cotações do Comprador: a Estratégia também sai.
        { key: "buyer", screens: before, knownScreens: [...before, "quotes"] },
        // E deu as cotações a Vendas: a Estratégia vem junto.
        {
          key: "sales",
          screens: [...before, "quotes"],
          knownScreens: [...before, "quotes"],
        },
        {
          key: "fn_compras",
          name: "Compras",
          screens: ["quotes"],
          knownScreens: ["quotes"],
        },
      ],
    });
    const of = (key: string) => defs.find((d) => d.key === key)!.screens;
    expect(of("buyer")).not.toContain("purchaseStrategy");
    expect(of("sales")).toContain("purchaseStrategy");
    expect(of("fn_compras")).toContain("purchaseStrategy");
    // Gravada já com a tela nova: vale o que foi marcado.
    const after = resolveFunctions({
      functions: [
        {
          key: "sales",
          screens: [...before, "quotes"],
          knownScreens: [...before, "quotes", "purchaseStrategy"],
        },
      ],
    });
    expect(after.find((d) => d.key === "sales")!.screens).not.toContain(
      "purchaseStrategy",
    );
  });
});
