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

  it("oferecido pede cliente; reservado pede quantidade no pedido mínimo", async () => {
    const { booking: b } = await row("approved");
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, b.id, { status: "offered" }),
      ),
    ).toBe("booking_customer_required");
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
    // Tirar o cliente de uma linha reservada: recusa.
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, b.id, { customerId: null }),
      ),
    ).toBe("booking_customer_required");
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
    expect(result).toEqual({ analyzed: 2, skipped: 1, kept: 0, noRates: 2 });
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
    expect(await ask([ok.booking.id], { customer: "" })).toBe(
      "booking_request_customer",
    );
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
    // livre para gerar outra.
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, a.booking.id, { status: "reserved" }),
      ),
    ).toBe("booking_approver_required");
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

  it("falha ao ligar a linha à solicitação não deixa gerar de novo (a linha já está tomada)", async () => {
    const a = await row("approved");
    const store = getStore();
    const original = store.update.bind(store);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(store, "update")
      .mockImplementation(async (table, id, patch) => {
        if (
          table === "bookings" &&
          (patch as { requestId?: string | null }).requestId
        )
          throw new Error("store down");
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
    expect((await fresh(a.booking.id)).status).toBe("requested");
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

  it("linha tomada sem solicitação ligada: depois de 2 minutos quem tem a tela a devolve; antes disso, não", async () => {
    const a = await row("approved");
    const now = Date.now();
    // Recém-tomada (pode ser uma chamada ainda em andamento).
    await getStore().update("bookings", a.booking.id, {
      status: "requested",
      statusChangedAt: new Date(now - 30_000).toISOString(),
      requestId: null,
    });
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, a.booking.id, { status: "approved" }),
      ),
    ).toBe("booking_approver_required");
    expect(
      (await booking.getBookingDetail(buyer, a.booking.id))!.moveOptions,
    ).toEqual(["requested"]);
    // Parada há mais de 2 minutos: a criação caiu no meio.
    await getStore().update("bookings", a.booking.id, {
      statusChangedAt: new Date(now - 5 * 60_000).toISOString(),
    });
    const detail = await booking.getBookingDetail(buyer, a.booking.id);
    expect(detail!.moveOptions).toEqual(
      expect.arrayContaining(["approved", "offered", "reserved"]),
    );
    // Não vira "descartado" nem "novo" por quem não analisa.
    expect(
      await code(() =>
        booking.saveBookingRow(buyer, a.booking.id, { status: "new" }),
      ),
    ).toBe("booking_approver_required");
    await booking.saveBookingRow(buyer, a.booking.id, { status: "approved" });
    expect((await fresh(a.booking.id)).status).toBe("approved");
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

  it("gerar solicitação sem cliente: recusa própria, com a linha; clientes diferentes apontam a que destoa", async () => {
    const none = await row("approved");
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
    expect(await refusal([none.booking.id])).toEqual([
      "booking_request_customer",
      none.booking.id,
    ]);
    expect(await refusal([withJoao.booking.id, none.booking.id])).toEqual([
      "booking_request_customer",
      none.booking.id,
    ]);
    expect(await refusal([withJoao.booking.id, withOther.booking.id])).toEqual([
      "booking_customer_mismatch",
      withOther.booking.id,
    ]);
  });

  it("a linha e a análise leem os mesmos números do produto (ficha mestre primeiro)", async () => {
    // Colunas do cadastro diferentes da ficha mestre (ex.: planilha genérica
    // reimportada depois de a ficha ser corrigida).
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
    const line = (await booking.listBookingRows(admin)).rows.find(
      (r) => r.id === a.booking.id,
    )!;
    expect([line.price, line.currency, line.masterQty, line.cbm]).toEqual([
      3.1,
      "USD",
      24,
      0.05,
    ]);
    await booking.analyzeBookings(admin, [a.booking.id]);
    const used = (await fresh(a.booking.id)).analysis!.inputs!;
    expect([
      used.unitPrice,
      used.currency,
      used.pcsPerCarton,
      used.cbmPerCarton,
    ]).toEqual([line.price, line.currency, line.masterQty, line.cbm]);
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
