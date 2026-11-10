import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Booking (docs/BOOKING.md), serviço: quem abre a tela, o que cada um vê e
 * pode mover, a reserva (cliente e quantidade com o pedido mínimo), mudança
 * em várias linhas (tudo ou nada), a análise do Superplan (só quem o abre),
 * o "Gerar solicitação" e a vitrine do cliente.
 */
withTempStore();

const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { translator } = await import("@/i18n");
const booking = await import("@/lib/services/booking");
const { bookingCanRequest } = await import("@/lib/booking");
const { ensureBookingForProduct } =
  await import("@/lib/services/booking-intake");
const { hiddenBookingProductIds, isHiddenByBooking } =
  await import("@/lib/services/booking-visibility");
const { saveProductSheet } = await import("@/lib/services/product-sheet");
type User = import("@/lib/db").User;
type Booking = import("@/lib/db").Booking;
type BookingStatus = import("@/lib/db").BookingStatus;

const t = translator("pt");
let admin: User;
let buyer: User;
let onlyBooking: User;
let noScreen: User;
let joao: User;
let lineId: string;
let seq = 0;

async function operator(patch: Partial<User>): Promise<User> {
  const rest: Partial<User> = { ...admin };
  delete rest.id;
  delete rest.createdAt;
  delete rest.updatedAt;
  return getStore().create("users", {
    ...(rest as Omit<User, "id" | "createdAt" | "updatedAt">),
    role: "operator",
    functions: [],
    screens: null,
    ...patch,
  });
}

/** Produto com ficha mestre (como a importação da ficha técnica deixa). */
async function product(
  sheet: Parameters<typeof saveProductSheet>[2] = {},
  patch: Record<string, unknown> = {},
) {
  seq++;
  const created = await getStore().create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId,
    name: `Porta-retrato ${seq}`,
    sku: null,
    specification: null,
    active: true,
    source: "import",
    ...patch,
  } as never);
  await saveProductSheet(admin, created.id, {
    factoryItemCode: `E4-${seq}`,
    price: 4,
    currency: "RMB",
    moq: 120,
    masterCartonQty: 12,
    netWeightPcKg: 0.225,
    cbmPerCarton: 0.0183,
    colorAssortment: "BLACK / WHITE / GREY",
    ...sheet,
  });
  return created;
}

/** Linha do Booking do produto, já na etapa pedida. */
async function row(
  status: BookingStatus = "new",
  patch: Partial<Booking> = {},
  sheet: Parameters<typeof saveProductSheet>[2] = {},
) {
  const p = await product(sheet);
  const { booking: created } = await ensureBookingForProduct(admin, {
    productId: p.id,
    importBatchId: "lote-1",
    sourceFileName: "feira.xls",
    sourceRows: `${seq}-${seq + 2}`,
    sourceOrder: seq,
  });
  const saved =
    status === "new" && !Object.keys(patch).length
      ? created
      : await getStore().update("bookings", created.id, { status, ...patch });
  return { booking: saved, product: p };
}

const fresh = (id: string) =>
  getStore().get("bookings", id) as Promise<Booking>;
const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "ok";
};

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  buyer = await operator({
    email: "comprador@wellmix.com",
    name: "Comprador",
    functions: ["buyer"],
  });
  onlyBooking = await operator({
    email: "so-booking@wellmix.com",
    name: "Só Booking",
    screens: ["booking"],
  });
  noScreen = await operator({
    email: "financeiro@wellmix.com",
    name: "Financeiro",
    functions: ["finance"],
  });
  lineId = (await getStore().list("product_lines", { limit: 1 }))[0].id;
});

describe("quem abre o Booking", () => {
  it("cliente e operador sem a tela não leem nem gravam", async () => {
    const { booking: b } = await row();
    for (const who of [joao, noScreen]) {
      expect(await code(() => booking.listBookingRows(who))).toBe("forbidden");
      expect(await code(() => booking.getBookingDetail(who, b.id))).toBe(
        "forbidden",
      );
      expect(
        await code(() => booking.saveBookingRow(who, b.id, { note: "x" })),
      ).toBe("forbidden");
      expect(
        await code(() =>
          booking.moveBookings(who, { ids: [b.id], status: "analysis" }),
        ),
      ).toBe("forbidden");
      expect(await code(() => booking.analyzeBookings(who, [b.id]))).toBe(
        "forbidden",
      );
      expect(
        await code(() =>
          booking.generateRequestFromBooking(who, { ids: [b.id] }, t),
        ),
      ).toBe("forbidden");
    }
    expect((await fresh(b.id)).note).toBeNull();
  });

  it("a linha traz os dados da ficha, com os três pesos cada um no seu lugar", async () => {
    const { booking: b, product: p } = await row(
      "new",
      {},
      {
        averagePrice: 3.2,
      },
    );
    const data = await booking.listBookingRows(buyer);
    const line = data.rows.find((r) => r.id === b.id)!;
    expect(line.productId).toBe(p.id);
    expect(line.name).toBe(p.name);
    expect(line.code).toMatch(/^E4-/);
    expect(line.price).toBe(4);
    expect(line.currency).toBe("RMB");
    expect(line.moq).toBe(120);
    expect(line.masterQty).toBe(12);
    // Peso líquido da ficha; bruto vazio continua vazio (nunca o líquido).
    expect(line.netWeightKg).toBe(0.225);
    expect(line.grossWeightKg).toBeNull();
    // Peso estimado: líquido + folga da embalagem (8% por padrão).
    expect(data.allowancePct).toBe(8);
    expect(line.estimatedWeightKg).toBe(0.243);
    expect(line.weightEstimated).toBe(true);
    expect(line.averageUsd).toBe(3.2);
    expect(line.cbm).toBe(0.0183);
    expect(line.colors).toBe("BLACK / WHITE / GREY");
    expect(line.sourceFileName).toBe("feira.xls");
    expect(line.ownerUserId).toBe(admin.id);
    expect(line.productMissing).toBe(false);
  });

  it("peso bruto informado na ficha vale como está (sem estimativa)", async () => {
    const { booking: b } = await row("new", {}, { grossWeightPcKg: 0.3 });
    const line = (await booking.listBookingRows(buyer)).rows.find(
      (r) => r.id === b.id,
    )!;
    expect(line.grossWeightKg).toBe(0.3);
    expect(line.estimatedWeightKg).toBe(0.3);
    expect(line.weightEstimated).toBe(false);
  });

  it("a análise do Superplan só sai do servidor para quem abre o Superplan", async () => {
    const { booking: b } = await row("analysis", {
      analysis: {
        at: "2026-11-09T12:00:00.000Z",
        byUserId: "x",
        businessType: "UD",
        salePriceBrl: 55.21,
        usesMinimum: true,
        costBrl: 30.67,
        minimumBrl: 55.21,
        profitPct: 16,
        targetPct: 22,
        verdict: "below",
        targetPriceBrl: 62.89,
        missing: [],
      },
    });
    const forBuyer = await booking.listBookingRows(buyer);
    expect(forBuyer.canApprove).toBe(false);
    expect(forBuyer.rows.find((r) => r.id === b.id)!.analysis).toBeNull();
    expect((await booking.getBookingDetail(buyer, b.id))!.row.analysis).toBe(
      null,
    );
    const forAdmin = await booking.listBookingRows(admin);
    expect(forAdmin.canApprove).toBe(true);
    expect(forAdmin.rows.find((r) => r.id === b.id)!.analysis?.verdict).toBe(
      "below",
    );
  });
});

describe("etapas", () => {
  it("comprador move o que não mexe na vitrine; aprovar é de quem analisa", async () => {
    const { booking: b } = await row();
    await booking.saveBookingRow(buyer, b.id, { status: "analysis" });
    expect((await fresh(b.id)).status).toBe("analysis");
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, b.id, { status: "approved" }),
      ),
    ).toBe("booking_approver_required");
    expect((await fresh(b.id)).status).toBe("analysis");
    await booking.saveBookingRow(admin, b.id, { status: "approved" });
    const approved = await fresh(b.id);
    expect(approved.status).toBe("approved");
    expect(approved.statusChangedByUserId).toBe(admin.id);
    // Tirar da vitrine (descartar um aprovado) também é de quem analisa.
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, b.id, { status: "discarded" }),
      ),
    ).toBe("booking_approver_required");
    const detail = await booking.getBookingDetail(buyer, b.id);
    expect(detail!.moveOptions).toEqual(["approved", "offered", "reserved"]);
    expect(detail!.history.map((h) => h.action)).toContain("booking.move");
  });

  it("'Virou solicitação' nunca à mão", async () => {
    const { booking: b } = await row("approved");
    expect(
      await code(() =>
        booking.saveBookingRow(admin, b.id, { status: "requested" }),
      ),
    ).toBe("booking_request_only");
  });

  it("oferecido sem cliente vira compra para o estoque; reservado pede quantidade no pedido mínimo", async () => {
    // A coluna Cliente saiu da tela: linha sem cliente é do estoque Wellmix.
    const { booking: stocked } = await row("approved");
    await booking.saveBookingRow(buyer, stocked.id, { status: "offered" });
    const stockId = (await fresh(stocked.id)).customerId;
    expect(stockId).toBeTruthy();
    expect((await getStore().get("parties", stockId!))?.type).toBe("customer");
    const { booking: b } = await row("approved");
    await booking.saveBookingRow(buyer, b.id, {
      status: "offered",
      customerId: joao.partyId,
    });
    expect((await fresh(b.id)).customerId).toBe(joao.partyId);
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, b.id, { status: "reserved" }),
      ),
    ).toBe("booking_qty_required");
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, b.id, {
          status: "reserved",
          reservedQty: 60,
        }),
      ),
    ).toBe("booking_qty_below_moq");
    await booking.saveBookingRow(buyer, b.id, {
      status: "reserved",
      reservedQty: 240,
    });
    const saved = await fresh(b.id);
    expect([saved.status, saved.reservedQty]).toEqual(["reserved", 240]);
    // Tirar o cliente de uma linha reservada: ela passa para o estoque.
    await booking.saveBookingRow(buyer, b.id, { customerId: null });
    expect((await fresh(b.id)).customerId).toBe(stockId);
  });

  it("cliente precisa ser empresa cliente ativa; responsável, login ativo da Wellmix", async () => {
    const { booking: b } = await row("approved");
    const supplier = (
      await getStore().list("parties", { filter: { type: "supplier" } })
    )[0];
    for (const bad of [supplier.id, "nao-existe"])
      expect(
        await code(() =>
          booking.saveBookingRow(buyer, b.id, { customerId: bad }),
        ),
      ).toBe("booking_customer_invalid");
    for (const bad of [joao.id, "nao-existe"])
      expect(
        await code(() =>
          booking.saveBookingRow(buyer, b.id, { ownerUserId: bad }),
        ),
      ).toBe("booking_owner_invalid");
    await booking.saveBookingRow(buyer, b.id, { ownerUserId: buyer.id });
    expect((await fresh(b.id)).ownerUserId).toBe(buyer.id);
  });

  it("observação com mais de 500 caracteres é recusada", async () => {
    const { booking: b } = await row();
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, b.id, { note: "x".repeat(501) }),
      ),
    ).toBe("booking_note_too_long");
    await booking.saveBookingRow(buyer, b.id, { note: "  ver amostra  " });
    expect((await fresh(b.id)).note).toBe("ver amostra");
  });
});

describe("várias linhas de uma vez", () => {
  it("tudo ou nada: uma linha recusada não deixa as outras pela metade", async () => {
    const a = await row("approved");
    const b = await row("approved");
    let refusal: unknown;
    try {
      await booking.moveBookings(buyer, {
        ids: [a.booking.id, b.booking.id],
        status: "reserved",
        customer: joao.partyId!,
        quantities: { [a.booking.id]: 240 },
      });
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(booking.BookingRefusal);
    expect(
      (refusal as InstanceType<typeof booking.BookingRefusal>).message,
    ).toBe("booking_qty_required");
    expect(
      (refusal as InstanceType<typeof booking.BookingRefusal>).bookingId,
    ).toBe(b.booking.id);
    expect((await fresh(a.booking.id)).status).toBe("approved");
    expect((await fresh(a.booking.id)).customerId).toBeNull();

    const moved = await booking.moveBookings(buyer, {
      ids: [a.booking.id, b.booking.id],
      status: "reserved",
      customer: joao.partyId!,
      quantities: { [a.booking.id]: 240, [b.booking.id]: 120 },
    });
    expect(moved).toBe(2);
    expect((await fresh(b.booking.id)).reservedQty).toBe(120);
  });

  it("cliente e quantidades sem mover; '-' tira o cliente; responsável em lote", async () => {
    const a = await row("approved");
    const b = await row("approved");
    const ids = [a.booking.id, b.booking.id];
    expect(
      await booking.assignBookings(buyer, {
        ids,
        customer: joao.partyId!,
        quantities: { [a.booking.id]: 360 },
      }),
    ).toBe(2);
    expect((await fresh(a.booking.id)).reservedQty).toBe(360);
    expect((await fresh(b.booking.id)).customerId).toBe(joao.partyId);
    expect((await fresh(b.booking.id)).status).toBe("approved");
    // Nada muda: zero linhas gravadas.
    expect(
      await booking.assignBookings(buyer, { ids, customer: joao.partyId! }),
    ).toBe(0);
    await booking.assignBookings(buyer, { ids: [b.booking.id], customer: "-" });
    expect((await fresh(b.booking.id)).customerId).toBeNull();
    expect(await booking.setBookingsOwner(buyer, ids, buyer.id)).toBe(2);
    expect((await fresh(a.booking.id)).ownerUserId).toBe(buyer.id);
    expect(
      await code(() => booking.setBookingsOwner(buyer, ids, joao.id)),
    ).toBe("booking_owner_invalid");
  });

  it("nenhuma linha marcada, linha que não existe e linhas demais", async () => {
    expect(
      await code(() =>
        booking.moveBookings(buyer, { ids: [], status: "analysis" }),
      ),
    ).toBe("booking_none_selected");
    expect(
      await code(() =>
        booking.moveBookings(buyer, {
          ids: ["nao-existe"],
          status: "analysis",
        }),
      ),
    ).toBe("booking_not_found");
    expect(
      await code(() =>
        booking.moveBookings(buyer, {
          ids: Array.from({ length: 101 }, (_, i) => `id-${i}`),
          status: "analysis",
        }),
      ),
    ).toBe("booking_too_many");
  });
});

describe("análise do Superplan", () => {
  const snapshot = {
    businessType: "UD",
    salePriceBrl: 55.21,
    usesMinimum: true,
    costBrl: 30.67,
    minimumBrl: 55.21,
    profitPct: 16,
    targetPct: 22,
    verdict: "below" as const,
    targetPriceBrl: 62.89,
    missing: [],
  };

  it("só quem abre o Superplan grava; a linha nova vai para Em análise", async () => {
    const { booking: b } = await row();
    expect(
      await code(() => booking.saveBookingAnalysis(buyer, b.id, snapshot)),
    ).toBe("booking_analysis_forbidden");
    expect(await code(() => booking.analyzeBookings(buyer, [b.id]))).toBe(
      "booking_analysis_forbidden",
    );
    expect((await fresh(b.id)).analysis ?? null).toBeNull();
    await booking.saveBookingAnalysis(admin, b.id, snapshot);
    const saved = await fresh(b.id);
    expect(saved.status).toBe("analysis");
    expect(saved.analysis?.byUserId).toBe(admin.id);
    expect(saved.analysis?.salePriceBrl).toBe(55.21);
  });

  it("gravar de novo não tira a linha da etapa em que está", async () => {
    const { booking: b } = await row("approved");
    await booking.saveBookingAnalysis(admin, b.id, snapshot);
    expect((await fresh(b.id)).status).toBe("approved");
  });

  it("'Analisar no Superplan' em várias linhas: retrato com os valores padrão", async () => {
    const a = await row();
    const b = await row("analysis");
    const gone = await row();
    await getStore().update("products", gone.product.id, { active: false });
    const result = await booking.analyzeBookings(admin, [
      a.booking.id,
      b.booking.id,
      gone.booking.id,
    ]);
    // Sem câmbio do dia não há custo: a conta "sem II/IPI" não conta essas.
    expect(result).toEqual({ analyzed: 2, skipped: 1, kept: 0, noRates: 0 });
    const first = await fresh(a.booking.id);
    expect(first.status).toBe("analysis");
    expect(first.analysis?.businessType).toBeTruthy();
    expect(first.analysis?.targetPct).toBeGreaterThan(0);
    // Só o peso líquido na ficha: a conta usou o bruto estimado e diz isso.
    expect(first.analysis?.inputs?.grossEstimated).toBe(true);
    expect((await fresh(gone.booking.id)).analysis ?? null).toBeNull();
  });
});

describe("gerar solicitação", () => {
  it("as linhas marcadas viram um lote do cliente, com a quantidade reservada ou o mínimo", async () => {
    const a = await row("reserved", {
      customerId: joao.partyId,
      reservedQty: 240,
    });
    const b = await row("approved");
    const created = await booking.generateRequestFromBooking(
      buyer,
      { ids: [a.booking.id, b.booking.id], customer: joao.partyId! },
      t,
    );
    expect(created).toHaveLength(2);
    expect(created.map((r) => r.quantity)).toEqual([240, 120]);
    expect(created.every((r) => r.customerId === joao.partyId)).toBe(true);
    expect(created[0].groupId).toBeTruthy();
    expect(created[1].groupId).toBe(created[0].groupId);
    expect(created[0].productId).toBe(a.product.id);
    expect((created[0].specification ?? "").toLowerCase()).toContain("black");
    const first = await fresh(a.booking.id);
    const second = await fresh(b.booking.id);
    expect(first.status).toBe("requested");
    expect(first.requestId).toBe(created[0].id);
    expect(first.requestGroupId).toBe(created[0].groupId);
    expect(first.requestNumber).toBe(created[0].number ?? null);
    expect([second.status, second.customerId, second.reservedQty]).toEqual([
      "requested",
      joao.partyId,
      120,
    ]);
    // De novo: a linha já virou solicitação (nada é criado em dobro).
    const before = (await getStore().list("requests")).length;
    expect(
      await code(() =>
        booking.generateRequestFromBooking(
          buyer,
          { ids: [a.booking.id], customer: joao.partyId! },
          t,
        ),
      ),
    ).toBe("booking_not_requestable");
    expect((await getStore().list("requests")).length).toBe(before);
    // Cliente e quantidade agora são os da solicitação.
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, a.booking.id, { reservedQty: 480 }),
      ),
    ).toBe("booking_locked");
  });

  it("uma linha só: a solicitação comum (sem lote), com a quantidade digitada", async () => {
    const a = await row("offered", { customerId: joao.partyId });
    const created = await booking.generateRequestFromBooking(
      buyer,
      { ids: [a.booking.id], quantities: { [a.booking.id]: 360 } },
      t,
    );
    expect(created).toHaveLength(1);
    expect(created[0].groupId ?? null).toBeNull();
    expect(created[0].quantity).toBe(360);
    expect((await fresh(a.booking.id)).reservedQty).toBe(360);
  });

  it("quem aprova gera a solicitação direto de Novo e Em análise (um toque); quem não aprova, não; Descartado nunca", async () => {
    const fromAnalysis = await row("analysis");
    const fromNew = await row("new");
    const discarded = await row("discarded");
    // O comprador (não abre o Superplan) continua precisando da aprovação.
    expect(
      await code(() =>
        booking.generateRequestFromBooking(
          buyer,
          { ids: [fromAnalysis.booking.id], customer: joao.partyId! },
          t,
        ),
      ),
    ).toBe("booking_not_requestable");
    expect(
      await code(() =>
        booking.generateRequestFromBooking(
          admin,
          { ids: [discarded.booking.id], customer: joao.partyId! },
          t,
        ),
      ),
    ).toBe("booking_not_requestable");
    // O administrador: marcou, escolheu o cliente, gerou.
    const created = await booking.generateRequestFromBooking(
      admin,
      {
        ids: [fromAnalysis.booking.id, fromNew.booking.id],
        customer: joao.partyId!,
      },
      t,
    );
    expect(created).toHaveLength(2);
    for (const line of [fromAnalysis, fromNew]) {
      const now = await fresh(line.booking.id);
      expect([now.status, now.customerId, !!now.requestId]).toEqual([
        "requested",
        joao.partyId,
        true,
      ]);
    }
    // A auditoria diz que a aprovação foi junto.
    const [log] = await getStore().list("audit_log", {
      filter: { entityId: fromAnalysis.booking.id, action: "booking.request" },
    });
    expect(log.summary).toContain("aprovado junto");
    expect(bookingCanRequest("analysis", true)).toBe(true);
    expect(bookingCanRequest("analysis", false)).toBe(false);
    expect(bookingCanRequest("requested", true)).toBe(false);
  });

  it("a linha que virou solicitação mostra o próximo passo e acompanha a solicitação; quem não abre Solicitações não recebe o link", async () => {
    const line = await row("approved");
    const [request] = await booking.generateRequestFromBooking(
      admin,
      { ids: [line.booking.id], customer: joao.partyId! },
      t,
    );
    const nextOf = async (user: User) =>
      (await booking.listBookingRows(user)).rows.find(
        (r) => r.id === line.booking.id,
      )!.next;
    expect(await nextOf(admin)).toEqual({
      step: "open_rfq",
      href: `/app/requests/${request.id}`,
      target: "request",
      answered: 0,
      total: 0,
    });
    // RFQ aberta: esperando o fornecedor, com o botão direto na cotação.
    const { openRfq } = await import("@/lib/services/requests");
    const [supplier] = await getStore().list("parties", {
      filter: { type: "supplier", active: true },
      limit: 1,
    });
    const [quote] = await openRfq(admin, request.id, [supplier.id]);
    expect(await nextOf(admin)).toEqual({
      step: "wait_supplier",
      href: `/app/quotes/${quote.id}`,
      target: "quote",
      answered: 0,
      total: 1,
    });
    // O fornecedor salvou um rascunho (prazo guardado) e não enviou: a linha
    // diz isso, em vez de "esperando".
    await getStore().update("quotes", quote.id, { leadTimeDays: 30 });
    expect(await nextOf(admin)).toMatchObject({
      step: "supplier_draft",
      href: `/app/quotes/${quote.id}`,
    });
    // Cotação enviada: a linha muda e o botão leva à confirmação.
    const { answerQuote } = await import("@/lib/services/requests");
    await answerQuote(admin, quote.id, {
      price: 4,
      currency: "USD",
      leadTimeDays: 30,
    });
    expect(await nextOf(admin)).toEqual({
      step: "choose_quote",
      href: `/app/requests/${request.id}#quotes-compare`,
      target: "confirm",
      answered: 1,
      total: 1,
    });
    // Linha que não virou solicitação não tem próximo passo.
    const other = await row("approved");
    expect(
      (await booking.listBookingRows(admin)).rows.find(
        (r) => r.id === other.booking.id,
      )!.next,
    ).toBeNull();
    // Só Booking (sem a tela Solicitações): sem link para lá.
    expect(await nextOf(onlyBooking)).toBeNull();
  });

  it("depois do pedido, a linha acompanha o documento do pedido: Wellmix assina, fornecedor assina, assinado", async () => {
    const { setSetting } = await import("@/lib/settings");
    await setSetting("approvalsEnabled", false);
    const line = await row("approved");
    const [request] = await booking.generateRequestFromBooking(
      admin,
      { ids: [line.booking.id], customer: joao.partyId! },
      t,
    );
    const nextOf = async () =>
      (await booking.listBookingRows(admin)).rows.find(
        (r) => r.id === line.booking.id,
      )!.next;
    const r = await import("@/lib/services/requests");
    const [quote] = await r.openRfq(admin, request.id, ["fornecedor-a"]);
    await r.answerQuote(admin, quote.id, {
      price: 3.6,
      currency: "USD",
      leadTimeDays: 45,
    });
    await r.selectQuote(admin, quote.id, {
      sellPrice: 10_000,
      sellCurrency: "BRL",
      downPaymentAmount: 3000,
    });
    expect((await nextOf())?.step).toBe("wait_down_payment");
    const order = await r.confirmDownPayment(admin, request.id);
    // Pedido criado: o lugar da troca do documento, com a Wellmix primeiro.
    expect(await nextOf()).toMatchObject({
      step: "sign_wellmix",
      href: `/app/orders/${order.id}`,
      target: "order",
    });
    const { signOrderAs } = await import("./setup");
    await signOrderAs(admin, order.id);
    expect((await nextOf())?.step).toBe("sign_supplier");
    // "Pedido criado" concluído: a Preparação abre e o fornecedor assina.
    const { submitRequirement } = await import("@/lib/workflow/engine");
    const [confirmed] = await getStore().list("requirements", {
      filter: { orderId: order.id, key: "order_confirmed" },
    });
    await submitRequirement(admin, confirmed.id, { value: "confirmed" });
    const supplier = (await getStore().list("users")).find(
      (u) => u.role === "supplier" && u.partyId === "fornecedor-a",
    )!;
    await signOrderAs(supplier, order.id);
    expect((await nextOf())?.step).toBe("signed");
  });

  it("recusas: etapa, cliente de outra linha, sem cliente, quantidade e produto", async () => {
    const before = (await getStore().list("requests")).length;
    const other = await getStore().create("parties", {
      ...(await getStore().get("parties", joao.partyId!))!,
      id: undefined,
      name: "Outro Cliente",
    } as never);
    const fresh1 = await row("new");
    const ok = await row("approved");
    const forOther = await row("reserved", {
      customerId: other.id,
      reservedQty: 120,
    });
    const noMoq = await row("approved", {}, { moq: null });
    await getStore().update("products", noMoq.product.id, { moq: null });
    const gone = await row("approved");
    await getStore().update("products", gone.product.id, { active: false });
    const ask = (ids: string[], extra: Record<string, unknown> = {}) =>
      code(() =>
        booking.generateRequestFromBooking(
          buyer,
          { ids, customer: joao.partyId!, ...extra },
          t,
        ),
      );
    expect(await ask([ok.booking.id, fresh1.booking.id])).toBe(
      "booking_not_requestable",
    );
    expect(await ask([ok.booking.id, forOther.booking.id])).toBe(
      "booking_customer_mismatch",
    );
    // Sem cliente na barra, linha de um cliente e linha sem cliente (que é
    // do estoque) não vão na mesma solicitação.
    expect(
      await ask([ok.booking.id, forOther.booking.id], { customer: "" }),
    ).toBe("booking_customer_mismatch");
    expect(await ask([ok.booking.id, noMoq.booking.id])).toBe(
      "booking_qty_missing",
    );
    expect(
      await ask([ok.booking.id], { quantities: { [ok.booking.id]: 60 } }),
    ).toBe("booking_qty_below_moq");
    expect(await ask([ok.booking.id, gone.booking.id])).toBe(
      "booking_product_missing",
    );
    expect(await ask([])).toBe("booking_none_selected");
    expect(await ask(Array.from({ length: 31 }, (_, i) => `id-${i}`))).toBe(
      "booking_request_too_many",
    );
    // Nada foi criado nem movido.
    expect((await getStore().list("requests")).length).toBe(before);
    expect((await fresh(ok.booking.id)).status).toBe("approved");
  });

  it("produto com variações pede a Nova solicitação (que escolhe a variação)", async () => {
    const a = await row("approved");
    const { upsertProductVariant } =
      await import("@/lib/services/product-variants");
    await upsertProductVariant(admin, a.product.id, { name: "Grande" });
    expect(
      await code(() =>
        booking.generateRequestFromBooking(
          buyer,
          { ids: [a.booking.id], customer: joao.partyId! },
          t,
        ),
      ),
    ).toBe("booking_variant_required");
  });

  it("sem a tela Solicitações não gera", async () => {
    const a = await row("approved");
    expect(
      await code(() =>
        booking.generateRequestFromBooking(
          onlyBooking,
          { ids: [a.booking.id], customer: joao.partyId! },
          t,
        ),
      ),
    ).toBe("forbidden");
    expect((await fresh(a.booking.id)).status).toBe("approved");
  });

  it("linha com solicitação em andamento não é reaberta à mão; excluir a solicitação é o caminho", async () => {
    const a = await row("approved");
    const [request] = await booking.generateRequestFromBooking(
      buyer,
      { ids: [a.booking.id], customer: joao.partyId! },
      t,
    );
    // Nem o comprador nem quem analisa: a solicitação ficaria viva e a linha
    // livre para gerar outra. A recusa é a mesma para os dois (o caminho é
    // excluir a solicitação).
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, a.booking.id, { status: "reserved" }),
      ),
    ).toBe("booking_request_alive");
    for (const status of ["reserved", "approved", "discarded"] as const) {
      expect(
        await code(() =>
          booking.saveBookingRow(admin, a.booking.id, { status }),
        ),
      ).toBe("booking_request_alive");
      expect(
        await code(() =>
          booking.moveBookings(admin, { ids: [a.booking.id], status }),
        ),
      ).toBe("booking_request_alive");
    }
    const still = await fresh(a.booking.id);
    expect([still.status, still.requestId]).toEqual(["requested", request.id]);
    // Solicitação cancelada por outro caminho (sem a exclusão): quem analisa
    // reabre, e a ligação sai.
    await getStore().update("requests", request.id, { status: "CANCELLED" });
    await booking.saveBookingRow(admin, a.booking.id, { status: "reserved" });
    const reopened = await fresh(a.booking.id);
    expect(reopened.status).toBe("reserved");
    expect([reopened.requestId, reopened.requestNumber]).toEqual([null, null]);
  });
});

describe("vitrine e entrada", () => {
  it("novo, em análise e descartado ficam escondidos; aprovado em diante aparece", async () => {
    const hidden = await row("new");
    const analysis = await row("analysis");
    const discarded = await row("discarded");
    const approved = await row("approved");
    const ids = await hiddenBookingProductIds();
    expect(ids.has(hidden.product.id)).toBe(true);
    expect(ids.has(analysis.product.id)).toBe(true);
    expect(ids.has(discarded.product.id)).toBe(true);
    expect(ids.has(approved.product.id)).toBe(false);
    expect(await isHiddenByBooking(hidden.product.id)).toBe(true);
    await booking.saveBookingRow(admin, hidden.booking.id, {
      status: "approved",
    });
    expect(await isHiddenByBooking(hidden.product.id)).toBe(false);
    // Produto sem linha no Booking nunca fica escondido.
    expect(await isHiddenByBooking("prod-panela")).toBe(false);
  });

  it("reimportar não duplica a linha nem muda a etapa", async () => {
    const a = await row("approved");
    const again = await ensureBookingForProduct(buyer, {
      productId: a.product.id,
      importBatchId: "lote-2",
      sourceFileName: "outra.xls",
      sourceRows: "9",
      sourceOrder: 9,
    });
    expect(again.created).toBe(false);
    expect(again.booking.id).toBe(a.booking.id);
    expect(again.booking.status).toBe("approved");
    expect(again.booking.sourceFileName).toBe("feira.xls");
    expect(
      await getStore().list("bookings", {
        filter: { productId: a.product.id },
      }),
    ).toHaveLength(1);
  });
});

describe("exclusão do produto e limpeza dos dados de venda", () => {
  it("excluir o produto de vez leva a linha do Booking junto", async () => {
    const a = await row("new");
    const { setProductsActive, purgeProducts } =
      await import("@/lib/services/product-delete");
    await setProductsActive(admin, [a.product.id], false);
    // Desativado (na lixeira): a linha fica, marcada fora do cadastro.
    const line = (await booking.listBookingRows(admin)).rows.find(
      (r) => r.id === a.booking.id,
    )!;
    expect(line.productMissing).toBe(true);
    const result = await purgeProducts(admin, [a.product.id]);
    expect(result.purged).toBe(1);
    expect(await getStore().get("bookings", a.booking.id)).toBeNull();
  });

  it("limpar as vendas de teste: a linha fica e volta para antes da solicitação", async () => {
    const reserved = await row("reserved", {
      customerId: joao.partyId,
      reservedQty: 240,
    });
    const approved = await row("approved");
    const untouched = await row("analysis");
    await booking.generateRequestFromBooking(
      buyer,
      {
        ids: [reserved.booking.id, approved.booking.id],
        customer: joao.partyId!,
        quantities: { [approved.booking.id]: 120 },
      },
      t,
    );
    expect((await fresh(reserved.booking.id)).status).toBe("requested");
    const { resetSalesData } = await import("@/lib/services/data-reset");
    await resetSalesData(admin, "APAGAR");
    const first = await fresh(reserved.booking.id);
    const second = await fresh(approved.booking.id);
    // As duas tinham cliente e quantidade (gravados ao gerar): voltam a Reservado.
    expect([first.status, first.requestId, first.requestNumber]).toEqual([
      "reserved",
      null,
      null,
    ]);
    expect([second.status, second.requestGroupId]).toEqual(["reserved", null]);
    expect((await fresh(untouched.booking.id)).status).toBe("analysis");
    expect(
      await getStore().get("products", reserved.product.id),
    ).not.toBeNull();
  });
});

describe("achados da revisão", () => {
  const snapshot = {
    businessType: "UD",
    salePriceBrl: 55.21,
    usesMinimum: true,
    costBrl: 30.67,
    minimumBrl: 55.21,
    profitPct: 16,
    targetPct: 22,
    verdict: "below" as const,
    targetPriceBrl: 62.89,
    missing: [],
  };

  it("a auditoria da análise não leva custo, preço nem lucro (a tela Auditoria é de quem não abre o Superplan)", async () => {
    const { booking: b } = await row();
    await booking.saveBookingAnalysis(admin, b.id, snapshot);
    await booking.saveBookingAnalysis(admin, b.id, {
      ...snapshot,
      verdict: "viable",
    });
    const entries = await getStore().list("audit_log", {
      filter: { entity: "booking", entityId: b.id },
    });
    const analysis = entries.filter((e) => e.action === "booking.analysis");
    expect(analysis).toHaveLength(2);
    for (const entry of analysis) {
      const text = JSON.stringify([entry.before, entry.after, entry.summary]);
      for (const secret of [
        "costBrl",
        "minimumBrl",
        "salePriceBrl",
        "profitPct",
        "targetPriceBrl",
        "30.67",
        "55.21",
        "62.89",
      ])
        expect(text).not.toContain(secret);
    }
    // Nem o sinal: a coluna do sinal também é só de quem abre o Superplan.
    const all = JSON.stringify(analysis.map((e) => [e.before, e.after]));
    for (const secret of ["verdict", "viable", "below"])
      expect(all).not.toContain(secret);
    expect(all).toContain("analyzedAt");
  });

  it("oferecer ou reservar para um cliente que deixou de estar ativo é recusado, com a linha", async () => {
    const gone = await getStore().create("parties", {
      ...(await getStore().get("parties", joao.partyId!))!,
      id: undefined,
      name: "Cliente Que Saiu",
    } as never);
    const a = await row("approved", { customerId: gone.id, reservedQty: 240 });
    await getStore().update("parties", gone.id, { active: false });
    for (const status of ["offered", "reserved"] as const) {
      let refusal: unknown;
      try {
        await booking.moveBookings(buyer, { ids: [a.booking.id], status });
      } catch (error) {
        refusal = error;
      }
      expect(refusal).toBeInstanceOf(booking.BookingRefusal);
      const r = refusal as InstanceType<typeof booking.BookingRefusal>;
      expect([r.message, r.bookingId]).toEqual([
        "booking_customer_invalid",
        a.booking.id,
      ]);
      expect(
        await code(() =>
          booking.saveBookingRow(buyer, a.booking.id, { status }),
        ),
      ).toBe("booking_customer_invalid");
    }
    expect((await fresh(a.booking.id)).status).toBe("approved");
    // Outras mudanças na linha continuam possíveis (observação, responsável).
    await booking.saveBookingRow(buyer, a.booking.id, { note: "ver cliente" });
    expect((await fresh(a.booking.id)).note).toBe("ver cliente");
  });

  it("duas chamadas juntas para a mesma linha: só uma gera a solicitação", async () => {
    const a = await row("approved");
    const before = (await getStore().list("requests")).length;
    const results = await Promise.allSettled([
      booking.generateRequestFromBooking(
        buyer,
        { ids: [a.booking.id], customer: joao.partyId! },
        t,
      ),
      booking.generateRequestFromBooking(
        buyer,
        { ids: [a.booking.id], customer: joao.partyId! },
        t,
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r) => r.status === "rejected") as
      PromiseRejectedResult | undefined;
    expect((refused?.reason as Error).message).toBe("booking_not_requestable");
    const live = (await getStore().list("requests")).filter(
      (r) => r.productId === a.product.id && r.status !== "CANCELLED",
    );
    expect(live).toHaveLength(1);
    expect((await getStore().list("requests")).length).toBe(before + 1);
    const saved = await fresh(a.booking.id);
    expect([saved.status, saved.requestId]).toEqual(["requested", live[0].id]);
  });

  it("falha ao gravar o número da solicitação na linha não desfaz nada: a ligação já existe", async () => {
    const a = await row("approved");
    const store = getStore();
    const original = store.update.bind(store);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(store, "update")
      .mockImplementation(async (table, id, patch) => {
        if (table === "bookings" && "requestNumber" in (patch as object)) {
          // Só o fecho (número e lote) falha; tomar a linha passa.
          if (!("status" in (patch as object))) throw new Error("store down");
        }
        return original(table, id, patch as never);
      });
    let created: Awaited<ReturnType<typeof booking.generateRequestFromBooking>>;
    try {
      created = await booking.generateRequestFromBooking(
        buyer,
        { ids: [a.booking.id], customer: joao.partyId! },
        t,
      );
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
    expect(created).toHaveLength(1);
    const linked = await fresh(a.booking.id);
    expect([linked.status, linked.requestId, linked.requestNumber]).toEqual([
      "requested",
      created[0].id,
      null,
    ]);
    // A tela conhece a solicitação mesmo sem o número.
    const shown = (await booking.listBookingRows(buyer)).rows.find(
      (r) => r.id === a.booking.id,
    )!;
    expect([shown.requestId, shown.requestState]).toEqual([
      created[0].id,
      null,
    ]);
    expect(
      await code(() =>
        booking.generateRequestFromBooking(
          buyer,
          { ids: [a.booking.id], customer: joao.partyId! },
          t,
        ),
      ),
    ).toBe("booking_not_requestable");
    expect(
      (await getStore().list("requests")).filter(
        (r) => r.productId === a.product.id,
      ),
    ).toHaveLength(1);
  });

  it("a criação da solicitação falhou: as linhas voltam para onde estavam", async () => {
    const a = await row("reserved", {
      customerId: joao.partyId,
      reservedQty: 240,
    });
    const requests = await import("@/lib/services/requests");
    const spy = vi
      .spyOn(requests, "createRequestBatch")
      .mockRejectedValue(new Error("schema_outdated"));
    try {
      expect(
        await code(() =>
          booking.generateRequestFromBooking(buyer, { ids: [a.booking.id] }, t),
        ),
      ).toBe("schema_outdated");
    } finally {
      spy.mockRestore();
    }
    const back = await fresh(a.booking.id);
    expect([back.status, back.requestId, back.reservedQty]).toEqual([
      "reserved",
      null,
      240,
    ]);
    expect(back.statusChangedByUserId).toBe(a.booking.statusChangedByUserId);
  });

  it("excluir a solicitação gerada solta a linha (volta para Reservado, sem a ligação)", async () => {
    const a = await row("approved");
    const [request] = await booking.generateRequestFromBooking(
      buyer,
      {
        ids: [a.booking.id],
        customer: joao.partyId!,
        quantities: { [a.booking.id]: 240 },
      },
      t,
    );
    const { deleteRequests } = await import("@/lib/services/requests");
    expect((await deleteRequests(buyer, [request.id])).deleted).toBe(1);
    const back = await fresh(a.booking.id);
    expect([
      back.status,
      back.requestId,
      back.requestNumber,
      back.customerId,
      back.reservedQty,
    ]).toEqual(["reserved", null, null, joao.partyId, 240]);
    // O comprador consegue corrigir e gerar de novo, sem o administrador.
    await booking.saveBookingRow(buyer, a.booking.id, { reservedQty: 360 });
    const again = await booking.generateRequestFromBooking(
      buyer,
      { ids: [a.booking.id] },
      t,
    );
    expect(again[0].quantity).toBe(360);
    const detail = await booking.getBookingDetail(buyer, a.booking.id);
    expect(detail!.history.map((h) => h.action)).toContain("booking.release");
  });
});

describe("achados da revisão (segunda leva)", () => {
  const snapshot = {
    businessType: "ENCOMENDA",
    salePriceBrl: 9.9,
    usesMinimum: false,
    costBrl: 5,
    minimumBrl: 9,
    profitPct: 21.5,
    targetPct: 22,
    verdict: "below" as const,
    targetPriceBrl: 10,
    missing: [],
  };

  it("uma linha só: a solicitação que nasceu pela metade é cancelada, e tentar de novo não cria duas", async () => {
    const a = await row("approved");
    const store = getStore();
    const original = store.create.bind(store);
    let failed = false;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        // A solicitação já foi gravada; o aviso seguinte falha.
        if (!failed && table === "notifications") {
          failed = true;
          throw new Error("notifications down");
        }
        return original(table, data as never);
      });
    let first = "ok";
    try {
      first = await code(() =>
        booking.generateRequestFromBooking(
          buyer,
          { ids: [a.booking.id], customer: joao.partyId! },
          t,
        ),
      );
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
    expect(failed).toBe(true);
    expect(first).not.toBe("ok");
    const back = await fresh(a.booking.id);
    expect([back.status, back.requestId]).toEqual(["approved", null]);
    const ofProduct = async () =>
      (await store.list("requests")).filter(
        (r) => r.productId === a.product.id,
      );
    // O que tinha nascido foi cancelado: nada vivo ficou para trás.
    expect((await ofProduct()).filter((r) => r.status !== "CANCELLED")).toEqual(
      [],
    );
    await booking.generateRequestFromBooking(
      buyer,
      { ids: [a.booking.id], customer: joao.partyId! },
      t,
    );
    expect(
      (await ofProduct()).filter((r) => r.status !== "CANCELLED"),
    ).toHaveLength(1);
  });

  it("linha tomada cuja solicitação não nasceu: ninguém mexe nos 2 primeiros minutos; depois, quem tem a tela a devolve", async () => {
    const a = await row("approved");
    const now = Date.now();
    // Recém-tomada: o "Gerar solicitação" ainda pode estar criando.
    await getStore().update("bookings", a.booking.id, {
      status: "requested",
      statusChangedAt: new Date(now - 30_000).toISOString(),
      requestId: "solicitacao-que-ainda-nao-existe",
    });
    for (const who of [buyer, admin]) {
      expect(
        await code(() =>
          booking.saveBookingRow(who, a.booking.id, { status: "approved" }),
        ),
      ).toBe("booking_request_pending");
      const detail = (await booking.getBookingDetail(who, a.booking.id))!;
      expect([detail.link, detail.moveOptions]).toEqual([
        "pending",
        ["requested"],
      ]);
      // Sem link para uma solicitação que não existe.
      expect([detail.row.requestId, detail.row.requestState]).toEqual([
        null,
        "pending",
      ]);
    }
    // Cliente e quantidade também ficam travados enquanto cria.
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, a.booking.id, { reservedQty: 480 }),
      ),
    ).toBe("booking_locked");
    // Parada há mais de 2 minutos: a criação caiu no meio.
    await getStore().update("bookings", a.booking.id, {
      statusChangedAt: new Date(now - 5 * 60_000).toISOString(),
    });
    const detail = (await booking.getBookingDetail(buyer, a.booking.id))!;
    expect(detail.link).toBe("missing");
    expect(detail.row.requestState).toBe("missing");
    expect(detail.moveOptions).toEqual([
      "approved",
      "offered",
      "reserved",
      "requested",
    ]);
    // Não vira "descartado" nem "novo" por quem não analisa.
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, a.booking.id, { status: "new" }),
      ),
    ).toBe("booking_reopen_forbidden");
    await booking.saveBookingRow(buyer, a.booking.id, { status: "approved" });
    const back = await fresh(a.booking.id);
    expect([back.status, back.requestId]).toEqual(["approved", null]);
  });

  it("análise em várias linhas não substitui a simulação gravada à mão", async () => {
    const manual = await row("analysis");
    const plain = await row("new");
    await booking.saveBookingAnalysis(admin, manual.booking.id, snapshot);
    const saved = await fresh(manual.booking.id);
    expect(saved.analysis?.manual).toBe(true);
    const result = await booking.analyzeBookings(admin, [
      manual.booking.id,
      plain.booking.id,
    ]);
    expect(result).toMatchObject({ analyzed: 1, kept: 1, skipped: 0 });
    const after = await fresh(manual.booking.id);
    expect(after.analysis).toEqual(saved.analysis);
    expect(after.analysis?.businessType).toBe("ENCOMENDA");
    expect((await fresh(plain.booking.id)).analysis?.manual ?? false).toBe(
      false,
    );
    // Gravar de novo à mão continua substituindo (é a mesma pessoa refazendo).
    await booking.saveBookingAnalysis(admin, manual.booking.id, {
      ...snapshot,
      salePriceBrl: 12,
    });
    expect((await fresh(manual.booking.id)).analysis?.salePriceBrl).toBe(12);
  });

  it("gerar solicitação sem cliente: vai para o estoque Wellmix; clientes diferentes apontam a que destoa", async () => {
    const none = await row("approved");
    const none2 = await row("approved");
    const withJoao = await row("offered", { customerId: joao.partyId });
    const other = await getStore().create("parties", {
      ...(await getStore().get("parties", joao.partyId!))!,
      id: undefined,
      name: "Cliente B",
    } as never);
    const withOther = await row("offered", { customerId: other.id });
    const refusal = async (ids: string[]) => {
      try {
        await booking.generateRequestFromBooking(buyer, { ids }, t);
      } catch (error) {
        const r = error as InstanceType<typeof booking.BookingRefusal>;
        return [r.message, r.bookingId];
      }
      return ["ok", null];
    };
    // Linha de um cliente junto com linha sem cliente (estoque): destoa.
    expect(await refusal([withJoao.booking.id, none2.booking.id])).toEqual([
      "booking_customer_mismatch",
      withJoao.booking.id,
    ]);
    // Só linhas sem cliente: a solicitação nasce para o estoque da Wellmix.
    expect(await refusal([none.booking.id])).toEqual(["ok", null]);
    const born = await getStore().get(
      "requests",
      (await getStore().get("bookings", none.booking.id))!.requestId!,
    );
    const { STOCK_PARTY_ID } = await import("@/lib/services/purchase-flow");
    expect(born?.customerId).toBe(STOCK_PARTY_ID);
    expect(await refusal([withJoao.booking.id, withOther.booking.id])).toEqual([
      "booking_customer_mismatch",
      withOther.booking.id,
    ]);
  });

  it("a linha e a análise leem os mesmos números do produto: preço e moeda da mesma fonte (cadastro; sem preço nele, ficha mestre)", async () => {
    const shown = async (id: string) => {
      const line = (await booking.listBookingRows(admin)).rows.find(
        (r) => r.id === id,
      )!;
      return [line.price, line.currency, line.masterQty, line.cbm];
    };
    const used = async (id: string) => {
      await booking.analyzeBookings(admin, [id]);
      const inputs = (await fresh(id)).analysis!.inputs!;
      return [
        inputs.unitPrice,
        inputs.currency,
        inputs.pcsPerCarton,
        inputs.cbmPerCarton,
      ];
    };
    // O cadastro foi gravado depois da ficha (importação de produtos ou
    // sourcing, que não espelham na ficha mestre): vale o cadastro.
    const a = await row(
      "new",
      {},
      { price: 3.1, currency: "USD", masterCartonQty: 24, cbmPerCarton: 0.05 },
    );
    await getStore().update("products", a.product.id, {
      price: 2.35,
      currency: "USD",
      masterBoxQty: 48,
      cbm: 0.09,
    });
    expect(await shown(a.booking.id)).toEqual([2.35, "USD", 48, 0.09]);
    expect(await used(a.booking.id)).toEqual(await shown(a.booking.id));

    // Ficha com preço e sem moeda; o cadastro foi reprecificado em dólar: o
    // preço do cadastro vai com a moeda DELE (nunca 24,90 em dólar).
    const b = await row("new", {}, { price: 24.9, currency: null });
    await getStore().update("products", b.product.id, {
      price: 3.7,
      currency: "USD",
    });
    expect((await shown(b.booking.id)).slice(0, 2)).toEqual([3.7, "USD"]);
    expect((await used(b.booking.id)).slice(0, 2)).toEqual([3.7, "USD"]);

    // Ficha com moeda RMB e sem preço; cadastro com 3,70 USD: 3,70 USD.
    const c = await row("new", {}, { price: null, currency: "RMB" });
    await getStore().update("products", c.product.id, {
      price: 3.7,
      currency: "USD",
    });
    expect((await shown(c.booking.id)).slice(0, 2)).toEqual([3.7, "USD"]);
    expect((await used(c.booking.id)).slice(0, 2)).toEqual([3.7, "USD"]);

    // Cadastro sem preço: o preço e a moeda da ficha mestre, juntos.
    const d = await row("new", {}, { price: 12, currency: "RMB" });
    await getStore().update("products", d.product.id, {
      price: null,
      currency: "USD",
    });
    expect((await shown(d.booking.id)).slice(0, 2)).toEqual([12, "RMB"]);
    expect((await used(d.booking.id)).slice(0, 2)).toEqual([12, "RMB"]);

    // Zero numa fonte não esconde o valor da outra.
    const e = await row(
      "new",
      {},
      { price: 5, currency: "USD", masterCartonQty: 12, cbmPerCarton: 0.069 },
    );
    await getStore().update("products", e.product.id, {
      price: 0,
      masterBoxQty: 0,
      cbm: 0,
    });
    expect(await shown(e.booking.id)).toEqual([5, "USD", 12, 0.069]);
    expect(await used(e.booking.id)).toEqual(await shown(e.booking.id));

    // Produto ainda sem preço: a moeda marcada é a do cadastro, como a tela
    // do Superplan sempre trouxe (nunca troca sozinha para RMB).
    const g = await row("new", {}, { price: null, currency: null });
    await getStore().update("products", g.product.id, {
      price: null,
      currency: "USD",
    });
    expect((await shown(g.booking.id)).slice(0, 2)).toEqual([null, "USD"]);
    const { superplanPrefillsFor } =
      await import("@/lib/services/superplan-analysis");
    const prefill = (await superplanPrefillsFor([g.product.id])).get(
      g.product.id,
    )!;
    expect([prefill.unitPrice, prefill.currency]).toEqual([null, "USD"]);
  });

  it("preço em outra moeda (EUR): a análise diz que falta o preço em RMB ou US$, não o preço", async () => {
    const a = await row("new", {}, { price: 10, currency: "EUR" });
    await booking.analyzeBookings(admin, [a.booking.id]);
    const analysis = (await fresh(a.booking.id)).analysis!;
    expect(analysis.verdict).toBeNull();
    expect(analysis.missing).toContain("currency");
    expect(analysis.missing).not.toContain("price");
    expect(t("superplan.missing.currency")).toContain("RMB");
  });
});

describe("ajustes da segunda revisão", () => {
  it("solicitação pela metade: só a que nasceu nesta chamada é cancelada; a que já existia para o mesmo cliente e produto fica", async () => {
    const a = await row("approved");
    const store = getStore();
    const { createRequestBatch } = await import("@/lib/services/requests");
    // Pedida agora há pouco, por outro caminho (Nova solicitação), pelo mesmo login.
    const [older] = await createRequestBatch(
      buyer,
      {
        customerId: joao.partyId!,
        deadline: null,
        notes: null,
        requestedForUserId: null,
      },
      [
        {
          productId: a.product.id,
          productName: a.product.name,
          description: a.product.name,
          specification: null,
          quantity: 240,
          unit: "un",
          sourcingDemand: false,
        },
      ],
    );
    const original = store.create.bind(store);
    let failed = false;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (!failed && table === "notifications") {
          failed = true;
          throw new Error("notifications down");
        }
        return original(table, data as never);
      });
    try {
      await code(() =>
        booking.generateRequestFromBooking(
          buyer,
          { ids: [a.booking.id], customer: joao.partyId! },
          t,
        ),
      );
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
    expect(failed).toBe(true);
    const ofProduct = (await store.list("requests")).filter(
      (r) => r.productId === a.product.id,
    );
    expect(ofProduct).toHaveLength(2);
    // A antiga continua viva; a que nasceu pela metade foi cancelada.
    expect(ofProduct.find((r) => r.id === older.id)!.status).not.toBe(
      "CANCELLED",
    );
    expect(ofProduct.find((r) => r.id !== older.id)!.status).toBe("CANCELLED");
    expect((await fresh(a.booking.id)).status).toBe("approved");
  });

  it("trocar responsável e analisar gravam também o cliente da barra e as quantidades, tudo ou nada", async () => {
    const a = await row("approved");
    const b = await row("approved");
    await booking.setBookingsOwner(buyer, [a.booking.id], buyer.id, {
      customer: joao.partyId!,
      quantities: { [a.booking.id]: 480 },
    });
    const first = await fresh(a.booking.id);
    expect([first.ownerUserId, first.customerId, first.reservedQty]).toEqual([
      buyer.id,
      joao.partyId,
      480,
    ]);
    // Uma quantidade abaixo do mínimo recusa tudo: nem o responsável muda.
    expect(
      await code(() =>
        booking.setBookingsOwner(buyer, [a.booking.id, b.booking.id], null, {
          quantities: { [b.booking.id]: 1 },
        }),
      ),
    ).toBe("booking_qty_below_moq");
    expect((await fresh(a.booking.id)).ownerUserId).toBe(buyer.id);
    expect((await fresh(b.booking.id)).reservedQty).toBeNull();

    // Analisar: quem não abre o Superplan é recusado antes de qualquer gravação.
    expect(
      await code(() =>
        booking.analyzeBookings(buyer, [b.booking.id], {
          customer: joao.partyId!,
          quantities: { [b.booking.id]: 600 },
        }),
      ),
    ).toBe("booking_analysis_forbidden");
    const untouched = await fresh(b.booking.id);
    expect([untouched.customerId, untouched.reservedQty]).toEqual([null, null]);
    // Quem analisa: cliente e quantidade gravados e a análise feita.
    const result = await booking.analyzeBookings(admin, [b.booking.id], {
      customer: joao.partyId!,
      quantities: { [b.booking.id]: 600 },
    });
    expect(result.analyzed).toBe(1);
    const second = await fresh(b.booking.id);
    expect([second.customerId, second.reservedQty]).toEqual([
      joao.partyId,
      600,
    ]);
    expect(second.analysis?.byUserId).toBe(admin.id);
  });
});

describe("solicitação ligada antes de nascer (terceira revisão)", () => {
  const taken = async () => {
    const a = await row("approved");
    const [request] = await booking.generateRequestFromBooking(
      buyer,
      { ids: [a.booking.id], customer: joao.partyId! },
      t,
    );
    return { ...a, request };
  };

  it("a linha é tomada já com o id da solicitação, o cliente e a quantidade, antes de a solicitação existir", async () => {
    const a = await row("approved");
    const store = getStore();
    const original = store.create.bind(store);
    const seen: Array<Record<string, unknown>> = [];
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (table === "requests") {
          const now = await fresh(a.booking.id);
          seen.push({
            status: now.status,
            requestId: now.requestId,
            customerId: now.customerId,
            reservedQty: now.reservedQty,
            id: (data as { id?: string }).id,
          });
        }
        return original(table, data as never);
      });
    let created: Awaited<ReturnType<typeof booking.generateRequestFromBooking>>;
    try {
      created = await booking.generateRequestFromBooking(
        buyer,
        {
          ids: [a.booking.id],
          customer: joao.partyId!,
          quantities: { [a.booking.id]: 480 },
        },
        t,
      );
    } finally {
      spy.mockRestore();
    }
    expect(seen).toEqual([
      {
        status: "requested",
        requestId: created[0].id,
        customerId: joao.partyId,
        reservedQty: 480,
        id: created[0].id,
      },
    ]);
    const saved = await fresh(a.booking.id);
    expect([saved.requestId, saved.requestNumber]).toEqual([
      created[0].id,
      created[0].number ?? null,
    ]);
  });

  it("criação que falha: só a solicitação desta chamada é cancelada (pelo id) e a linha volta inteira", async () => {
    const a = await row("offered", {
      customerId: joao.partyId,
      reservedQty: 360,
    });
    const store = getStore();
    const { createRequestBatch } = await import("@/lib/services/requests");
    const item = {
      productId: a.product.id,
      productName: a.product.name,
      description: a.product.name,
      specification: null,
      quantity: 240,
      unit: "un",
      sourcingDemand: false,
    };
    const base = {
      customerId: joao.partyId!,
      deadline: null,
      notes: null,
      requestedForUserId: null,
    };
    const [older] = await createRequestBatch(buyer, base, [item]);
    const original = store.create.bind(store);
    let failed = false;
    let other: string | null = null;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (!failed && table === "notifications") {
          failed = true;
          // No mesmo instante, o mesmo login cria outra solicitação do
          // mesmo cliente e produto por outra tela.
          spy.mockRestore();
          other = (await createRequestBatch(buyer, base, [item]))[0].id;
          throw new Error("notifications down");
        }
        return original(table, data as never);
      });
    try {
      expect(
        await code(() =>
          booking.generateRequestFromBooking(
            buyer,
            { ids: [a.booking.id], quantities: { [a.booking.id]: 600 } },
            t,
          ),
        ),
      ).toBe("notifications down");
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
    const ofProduct = (await store.list("requests")).filter(
      (r) => r.productId === a.product.id,
    );
    expect(ofProduct).toHaveLength(3);
    const status = (id: string) => ofProduct.find((r) => r.id === id)!.status;
    // As duas que não nasceram desta chamada continuam vivas.
    expect([status(older.id), status(other!)]).toEqual([
      "REQUESTED",
      "REQUESTED",
    ]);
    expect(
      ofProduct.filter((r) => r.status === "CANCELLED").map((r) => r.id),
    ).toHaveLength(1);
    // A linha volta como estava: etapa, cliente, quantidade e sem ligação.
    const back = await fresh(a.booking.id);
    expect([
      back.status,
      back.customerId,
      back.reservedQty,
      back.requestId,
    ]).toEqual(["offered", joao.partyId, 360, null]);
  });

  it("linha devolvida enquanto a solicitação era criada: a solicitação desta chamada é cancelada no fecho", async () => {
    const a = await row("approved");
    const b = await row("approved");
    const store = getStore();
    const original = store.create.bind(store);
    let returned = false;
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        const made = await original(table, data as never);
        // Chamada longa: depois de a 1ª solicitação nascer, alguém devolve a
        // linha da 2ª (a espera de 2 minutos já tinha passado para ela).
        if (!returned && table === "requests") {
          returned = true;
          await store.update("bookings", b.booking.id, {
            status: "approved",
            requestId: null,
          });
        }
        return made;
      });
    let created: Awaited<ReturnType<typeof booking.generateRequestFromBooking>>;
    try {
      created = await booking.generateRequestFromBooking(
        buyer,
        { ids: [a.booking.id, b.booking.id], customer: joao.partyId! },
        t,
      );
    } finally {
      spy.mockRestore();
    }
    // Só a solicitação da linha que continuou tomada fica.
    expect(created.map((r) => r.productId)).toEqual([a.product.id]);
    const live = (await store.list("requests")).filter(
      (r) =>
        [a.product.id, b.product.id].includes(r.productId ?? "") &&
        r.status !== "CANCELLED",
    );
    expect(live.map((r) => r.productId)).toEqual([a.product.id]);
    const rowB = await fresh(b.booking.id);
    expect([rowB.status, rowB.requestId]).toEqual(["approved", null]);
    // A linha devolvida gera de novo, e fica uma solicitação viva só.
    await booking.generateRequestFromBooking(
      buyer,
      { ids: [b.booking.id], customer: joao.partyId! },
      t,
    );
    expect(
      (await store.list("requests")).filter(
        (r) => r.productId === b.product.id && r.status !== "CANCELLED",
      ),
    ).toHaveLength(1);
  });

  it("solicitação que virou pedido: quem analisa reabre a linha; antes disso ninguém; o comprador nunca", async () => {
    const a = await taken();
    const store = getStore();
    // Em andamento, em qualquer situação antes do pedido: ninguém reabre.
    for (const status of ["RFQ_OPEN", "WAITING_DOWN_PAYMENT"] as const) {
      await store.update("requests", a.request.id, { status });
      for (const who of [buyer, admin])
        expect(
          await code(() =>
            booking.saveBookingRow(who, a.booking.id, { status: "approved" }),
          ),
        ).toBe("booking_request_alive");
    }
    // Virou pedido (não dá mais para excluir a solicitação).
    await store.update("requests", a.request.id, { status: "ORDERED" });
    const forBuyer = (await booking.getBookingDetail(buyer, a.booking.id))!;
    expect([forBuyer.link, forBuyer.moveOptions]).toEqual([
      "closed",
      ["requested"],
    ]);
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, a.booking.id, { status: "approved" }),
      ),
    ).toBe("booking_reopen_forbidden");
    // Cliente e quantidade continuam os da solicitação.
    expect(
      await code(() =>
        booking.saveBookingRow(admin, a.booking.id, { reservedQty: 999 }),
      ),
    ).toBe("booking_locked");
    const forAdmin = (await booking.getBookingDetail(admin, a.booking.id))!;
    expect(forAdmin.link).toBe("closed");
    expect(forAdmin.moveOptions).toEqual(
      expect.arrayContaining(["approved", "offered", "reserved"]),
    );
    // A linha continua com o link do pedido até ser reaberta.
    expect(forAdmin.row.requestId).toBe(a.request.id);
    await booking.moveBookings(admin, {
      ids: [a.booking.id],
      status: "approved",
    });
    const reopened = await fresh(a.booking.id);
    expect([reopened.status, reopened.requestId]).toEqual(["approved", null]);
    // O pedido não é tocado.
    expect((await store.get("requests", a.request.id))!.status).toBe("ORDERED");
  });

  it("as situações em que a solicitação ainda pode ser excluída são as mesmas nas duas listas", async () => {
    const { DELETABLE_REQUEST_STATUSES } =
      await import("@/lib/services/requests");
    const { BOOKING_OPEN_REQUEST } = await import("@/lib/booking");
    expect([...BOOKING_OPEN_REQUEST].sort()).toEqual(
      [...DELETABLE_REQUEST_STATUSES].sort(),
    );
  });

  it("excluir a solicitação solta a linha, mesmo sem o número gravado na linha", async () => {
    const a = await taken();
    await getStore().update("bookings", a.booking.id, {
      requestNumber: null,
      requestGroupId: null,
    });
    const { deleteRequests } = await import("@/lib/services/requests");
    await deleteRequests(admin, [a.request.id]);
    const back = await fresh(a.booking.id);
    expect(back.requestId).toBeNull();
    expect(["approved", "reserved"]).toContain(back.status);
  });

  it("'sem II/IPI' só conta a linha que teve custo calculado", async () => {
    const { setSetting } = await import("@/lib/settings");
    const withCost = await row("new");
    // Sem preço: "falta dado", nenhum custo.
    const noPrice = await row("new", {}, { price: null });
    await setSetting("fxManualRates", { USD: 5.15, RMB: 0.72, EUR: null });
    try {
      const result = await booking.analyzeBookings(admin, [
        withCost.booking.id,
        noPrice.booking.id,
      ]);
      expect(result).toMatchObject({ analyzed: 2, noRates: 1 });
      const first = (await fresh(withCost.booking.id)).analysis!;
      expect(first.costBrl).toBeGreaterThan(0);
      expect(first.inputs?.ncmFound).toBe(false);
      expect((await fresh(noPrice.booking.id)).analysis!.costBrl ?? null).toBe(
        null,
      );
    } finally {
      await setSetting("fxManualRates", { USD: null, RMB: null, EUR: null });
    }
  });
});

describe("gerar solicitação: corridas e falhas (releitura própria)", () => {
  it("duas chamadas passam juntas pela tomada: no fecho, a que perdeu a linha cancela a própria solicitação e sobra uma só", async () => {
    const a = await row("approved");
    const store = getStore();
    const update = store.update.bind(store);
    const create = store.create.bind(store);
    let bAtClaim!: () => void;
    const bReachedClaim = new Promise<void>((r) => (bAtClaim = r));
    let letBClaim!: () => void;
    const bMayClaim = new Promise<void>((r) => (letBClaim = r));
    let bDidClaim!: () => void;
    const bClaimed = new Promise<void>((r) => (bDidClaim = r));
    let firstRequest = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const updateSpy = vi
      .spyOn(store, "update")
      .mockImplementation(async (table, id, patch) => {
        const p = patch as { status?: string; statusChangedByUserId?: string };
        // A chamada B (admin) já conferiu a linha e para logo antes de tomá-la.
        if (
          table === "bookings" &&
          p.status === "requested" &&
          p.statusChangedByUserId === admin.id
        ) {
          bAtClaim();
          await bMayClaim;
          const saved = await update(table, id, patch as never);
          bDidClaim();
          return saved;
        }
        return update(table, id, patch as never);
      });
    const createSpy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        // A chamada A (comprador) tomou a linha, releu e começa a criar: só
        // então B grava a tomada dela por cima.
        if (table === "requests" && firstRequest) {
          firstRequest = false;
          letBClaim();
          await bClaimed;
        }
        return create(table, data as never);
      });
    let results: PromiseSettledResult<unknown>[];
    try {
      const callB = booking.generateRequestFromBooking(
        admin,
        { ids: [a.booking.id], customer: joao.partyId! },
        t,
      );
      await bReachedClaim;
      const callA = booking.generateRequestFromBooking(
        buyer,
        { ids: [a.booking.id], customer: joao.partyId! },
        t,
      );
      results = await Promise.allSettled([callA, callB]);
    } finally {
      updateSpy.mockRestore();
      createSpy.mockRestore();
      log.mockRestore();
    }
    // A perdeu a linha: recusa, e a solicitação que ela criou foi cancelada.
    expect(results[0].status).toBe("rejected");
    expect(
      ((results[0] as PromiseRejectedResult).reason as Error).message,
    ).toBe("booking_not_requestable");
    expect(results[1].status).toBe("fulfilled");
    const ofProduct = (await store.list("requests")).filter(
      (r) => r.productId === a.product.id,
    );
    expect(ofProduct).toHaveLength(2);
    const live = ofProduct.filter((r) => r.status !== "CANCELLED");
    expect(live).toHaveLength(1);
    expect(live[0].createdByUserId).toBe(admin.id);
    // A linha ficou com a solicitação que sobrou.
    const saved = await fresh(a.booking.id);
    expect([saved.status, saved.requestId]).toEqual(["requested", live[0].id]);
  });

  it("criação falha e nem dá para devolver a linha: ela não fica presa (a solicitação foi cancelada e quem tem a tela devolve a linha)", async () => {
    const a = await row("approved");
    const store = getStore();
    const update = store.update.bind(store);
    const create = store.create.bind(store);
    let down = false;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const createSpy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (table === "notifications") {
          // A solicitação já foi gravada; daqui em diante o banco cai.
          down = true;
          throw new Error("store down");
        }
        return create(table, data as never);
      });
    const updateSpy = vi
      .spyOn(store, "update")
      .mockImplementation(async (table, id, patch) => {
        // Com o banco fora, a linha não volta (a solicitação ainda é cancelada).
        if (down && table === "bookings") throw new Error("store down");
        return update(table, id, patch as never);
      });
    try {
      expect(
        await code(() =>
          booking.generateRequestFromBooking(
            buyer,
            { ids: [a.booking.id], customer: joao.partyId! },
            t,
          ),
        ),
      ).toBe("store down");
    } finally {
      createSpy.mockRestore();
      updateSpy.mockRestore();
      log.mockRestore();
    }
    // A linha ficou tomada, apontando para uma solicitação cancelada.
    const stuck = await fresh(a.booking.id);
    expect(stuck.status).toBe("requested");
    expect(stuck.requestId).toBeTruthy();
    const request = (await store.get("requests", stuck.requestId!))!;
    expect(request.status).toBe("CANCELLED");
    // Cancelada = não existe mais: quem tem a tela (sem precisar de quem
    // analisa) devolve a linha na hora.
    const detail = (await booking.getBookingDetail(buyer, a.booking.id))!;
    expect(detail.link).toBe("missing");
    expect(detail.row.requestState).toBe("missing");
    expect(detail.moveOptions).toEqual([
      "approved",
      "offered",
      "reserved",
      "requested",
    ]);
    await booking.saveBookingRow(buyer, a.booking.id, { status: "approved" });
    const back = await fresh(a.booking.id);
    expect([back.status, back.requestId]).toEqual(["approved", null]);
    // E gera de novo, com uma solicitação viva só.
    await booking.generateRequestFromBooking(
      buyer,
      { ids: [a.booking.id], customer: joao.partyId! },
      t,
    );
    expect(
      (await store.list("requests")).filter(
        (r) => r.productId === a.product.id && r.status !== "CANCELLED",
      ),
    ).toHaveLength(1);
  });
});

describe("quarta revisão: gravação que não passa por cima", () => {
  it("linha que virou solicitação enquanto a ação em várias linhas rodava é recusada, não sobrescrita", async () => {
    const a = await row("approved");
    const b = await row("approved");
    const store = getStore();
    const update = store.update.bind(store);
    let done = false;
    const spy = vi
      .spyOn(store, "update")
      .mockImplementation(async (table, id, patch) => {
        // Logo antes da 1ª gravação da ação, outro login gera a solicitação de b.
        if (!done && table === "bookings" && id === a.booking.id) {
          done = true;
          spy.mockRestore();
          await booking.generateRequestFromBooking(
            admin,
            { ids: [b.booking.id], customer: joao.partyId! },
            t,
          );
        }
        return update(table, id, patch as never);
      });
    let refused = "";
    try {
      refused = await code(() =>
        booking.moveBookings(buyer, {
          ids: [a.booking.id, b.booking.id],
          status: "offered",
          customer: joao.partyId!,
        }),
      );
    } finally {
      spy.mockRestore();
    }
    expect(refused).toBe("booking_changed");
    const rowB = await fresh(b.booking.id);
    expect(rowB.status).toBe("requested");
    expect(rowB.requestId).toBeTruthy();
    expect(
      (await store.list("requests")).filter(
        (r) => r.productId === b.product.id && r.status !== "CANCELLED",
      ),
    ).toHaveLength(1);
    for (const lang of ["pt", "en", "zh"] as const)
      expect(translator(lang)("booking.error.booking_changed")).not.toBe(
        "booking.error.booking_changed",
      );
  });

  it("gerar solicitação confere cada linha logo antes de tomá-la; falha na releitura devolve as linhas", async () => {
    const a = await row("approved");
    const b = await row("approved");
    const store = getStore();
    const get = store.get.bind(store);
    let discarded = false;
    const spy = vi.spyOn(store, "get").mockImplementation(async (table, id) => {
      // Entre a conferência geral e a tomada de b, quem analisa descarta b.
      if (!discarded && table === "bookings" && id === b.booking.id) {
        discarded = true;
        await store.update("bookings", b.booking.id, { status: "discarded" });
      }
      return get(table, id as never) as never;
    });
    try {
      expect(
        await code(() =>
          booking.generateRequestFromBooking(
            buyer,
            { ids: [a.booking.id, b.booking.id], customer: joao.partyId! },
            t,
          ),
        ),
      ).toBe("booking_not_requestable");
    } finally {
      spy.mockRestore();
    }
    expect((await fresh(b.booking.id)).status).toBe("discarded");
    const rowA = await fresh(a.booking.id);
    expect([rowA.status, rowA.requestId, rowA.customerId]).toEqual([
      "approved",
      null,
      null,
    ]);
  });

  it("pesos: os do cadastro primeiro, cada um do seu campo; zero não esconde o da ficha", async () => {
    const a = await row(
      "new",
      {},
      { netWeightPcKg: 1.4, grossWeightPcKg: 1.5 },
    );
    await getStore().update("products", a.product.id, {
      netWeightKg: 2.8,
      grossWeightKg: 3,
    });
    const shown = async (id: string) => {
      const line = (await booking.listBookingRows(admin)).rows.find(
        (r) => r.id === id,
      )!;
      return [line.netWeightKg, line.grossWeightKg];
    };
    expect(await shown(a.booking.id)).toEqual([2.8, 3]);
    await getStore().update("products", a.product.id, {
      netWeightKg: 0,
      grossWeightKg: null,
    });
    expect(await shown(a.booking.id)).toEqual([1.4, 1.5]);
  });
});
