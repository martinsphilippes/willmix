import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * RFQ em espera (docs/RFQ_STANDBY.md): com `rfqEnabled` desligado (o padrão),
 * a solicitação que nasce do Booking vai sozinha para o fornecedor do
 * produto, um só, que a recebe como "Booking para analisar"; a tela não deixa
 * mandar a vários nem a um segundo fornecedor. Com a RFQ ligada, tudo volta a
 * ser como antes (a solicitação espera a abertura da RFQ).
 */
withTempStore();

const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { translator } = await import("@/i18n");
const booking = await import("@/lib/services/booking");
const requests = await import("@/lib/services/requests");
const { ensureBookingForProduct } =
  await import("@/lib/services/booking-intake");
const { saveProductSheet } = await import("@/lib/services/product-sheet");
const { getSettings, setSetting } = await import("@/lib/settings");
const { pendingTasksFor: listTasks } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;

const t = translator("pt");
let admin: User;
let supplierA: User;
let lineId: string;
let seq = 0;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  lineId = (await getStore().list("product_lines", { orderBy: "name" }))[0].id;
});

/** Linha do Booking aprovada, de um produto do fornecedor dado. */
async function row(supplierId: string | null) {
  seq++;
  const product = await getStore().create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId,
    name: `Vaso ${seq}`,
    sku: null,
    specification: null,
    supplierId,
    active: true,
    source: "import",
  } as never);
  await saveProductSheet(admin, product.id, {
    factoryItemCode: `V-${seq}`,
    price: 4,
    currency: "USD",
    moq: 120,
    masterCartonQty: 12,
    netWeightPcKg: 0.2,
    cbmPerCarton: 0.02,
  });
  const { booking: created } = await ensureBookingForProduct(admin, {
    productId: product.id,
    importBatchId: "lote-rfq",
    sourceFileName: "feira.xlsx",
    sourceRows: String(seq),
    sourceOrder: seq,
  });
  await getStore().update("bookings", created.id, { status: "approved" });
  return { bookingId: created.id, product };
}

const inapp = (partyId: string) =>
  getStore()
    .list("notifications", { filter: { channel: "inapp" } })
    .then((rows) => rows.filter((n) => n.partyId === partyId));

describe("RFQ em espera", () => {
  it("vem desligada por padrão", async () => {
    expect((await getSettings()).rfqEnabled).toBe(false);
  });

  it("Booking → solicitação: vai sozinha para o fornecedor do produto, que recebe um aviso só", async () => {
    const a = await row(supplierA.partyId);
    const b = await row(supplierA.partyId);
    const before = (await inapp(supplierA.partyId!)).length;
    const created = await booking.generateRequestFromBooking(
      admin,
      { ids: [a.bookingId, b.bookingId] },
      t,
    );
    expect(created).toHaveLength(2);
    for (const request of created) {
      const fresh = await getStore().get("requests", request.id);
      expect(fresh?.status).toBe("RFQ_OPEN");
      const quotes = await getStore().list("quotes", {
        filter: { requestId: request.id },
      });
      expect(quotes.map((q) => [q.supplierId, q.status])).toEqual([
        [supplierA.partyId, "invited"],
      ]);
    }
    // Um aviso só, com os dois produtos, como "Booking para analisar".
    const notices = (await inapp(supplierA.partyId!)).slice(before);
    expect(notices).toHaveLength(1);
    // O fornecedor da demonstração lê em chinês: "待分析的 Booking".
    expect(notices[0].subject).toContain("Booking");
    expect(notices[0].subject).toContain("2");
    // A linha do Booking já espera o fornecedor (não pede para abrir RFQ).
    const rows = (await booking.listBookingRows(admin, {})).rows;
    expect(rows.find((r) => r.id === a.bookingId)?.next?.step).toBe(
      "wait_supplier",
    );
    // Para o fornecedor, a pendência é analisar o Booking dele.
    const tasks = await listTasks(supplierA);
    expect(
      tasks.some(
        (task) => task.title === `Analisar o Booking: ${a.product.name}`,
      ),
    ).toBe(true);
  });

  it("produto sem fornecedor fica esperando na solicitação (enviar ao fornecedor)", async () => {
    const lone = await row(null);
    const [request] = await booking.generateRequestFromBooking(
      admin,
      { ids: [lone.bookingId] },
      t,
    );
    expect((await getStore().get("requests", request.id))?.status).toBe(
      "REQUESTED",
    );
    const tasks = await listTasks(admin);
    expect(
      tasks.some(
        (task) => task.title === `Enviar ao fornecedor: ${lone.product.name}`,
      ),
    ).toBe(true);
  });

  it("a tela recusa vários fornecedores e um segundo fornecedor depois do envio", async () => {
    const a = await row(supplierA.partyId);
    const [request] = await booking.generateRequestFromBooking(
      admin,
      { ids: [a.bookingId] },
      t,
    );
    const refusal = async (ids: string[]) => {
      try {
        await requests.assertRfqStandby([request.id], ids);
      } catch (error) {
        return (error as Error).message;
      }
      return "ok";
    };
    expect(await refusal(["fornecedor-a", "fornecedor-b"])).toBe(
      "rfq_standby_one",
    );
    expect(await refusal(["fornecedor-b"])).toBe("rfq_standby_sent");
    expect(await refusal(["fornecedor-a"])).toBe("ok");
  });

  it("com a RFQ ligada, o Booking não envia sozinho e a tela aceita vários", async () => {
    await setSetting("rfqEnabled", true);
    try {
      const a = await row(supplierA.partyId);
      const [request] = await booking.generateRequestFromBooking(
        admin,
        { ids: [a.bookingId] },
        t,
      );
      expect((await getStore().get("requests", request.id))?.status).toBe(
        "REQUESTED",
      );
      expect(
        await getStore().list("quotes", { filter: { requestId: request.id } }),
      ).toHaveLength(0);
      await requests.assertRfqStandby(
        [request.id],
        ["fornecedor-a", "fornecedor-b"],
      );
      const tasks = await listTasks(admin);
      expect(
        tasks.some((task) => task.title === `Abrir RFQ: ${a.product.name}`),
      ).toBe(true);
    } finally {
      await setSetting("rfqEnabled", false);
    }
  });
});
