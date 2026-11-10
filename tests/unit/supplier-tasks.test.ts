import { beforeAll, describe, expect, it } from "vitest";
import { reachSignature, signOrderAs, withTempStore } from "./setup";

/*
 * Pendências do fornecedor (pedido do dono, 10/11/2026): o filtro é a etapa
 * que chega na mão dele, do Booking ao embarque (`supplier.<etapa>`), a
 * assinatura do documento é uma etapa à parte, e cada pendência diz desde
 * quando está com ele e quando o produto foi carregado no sistema. Os outros
 * papéis continuam com os grupos de antes.
 */
withTempStore();

const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const {
  SUPPLIER_STEPS,
  filterTasks,
  pendingTasksFor,
  supplierGroup,
  supplierStepOfGroup,
  taskGroups,
} = await import("@/lib/services/tasks");
const { ensureBookingForProduct } =
  await import("@/lib/services/booking-intake");
const { translator } = await import("@/i18n");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  const { setSetting } = await import("@/lib/settings");
  await setSetting("approvalsEnabled", false);
});

async function request(name: string, productId: string | null = null) {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: name,
    description: name,
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
}

async function newOrder(name: string) {
  const store = getStore();
  const req = await request(name);
  await r.openRfq(admin, req.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: req.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 3.6,
    currency: "USD",
    leadTimeDays: 45,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 10_000,
    sellCurrency: "BRL",
    downPaymentAmount: 3000,
  });
  return r.confirmDownPayment(admin, req.id);
}

const mine = async () => pendingTasksFor(supplierA);

describe("pendências do fornecedor por etapa", () => {
  it("toda etapa do caminho tem nome e explicação nos três idiomas", () => {
    expect([...SUPPLIER_STEPS]).toEqual([
      "booking",
      "dieline",
      "sheet",
      "art",
      "sign",
      "inspection",
      "shipping",
    ]);
    for (const locale of ["pt", "en", "zh"] as const) {
      const t = translator(locale);
      for (const step of SUPPLIER_STEPS) {
        const name = `tasks.group.${supplierGroup(step)}`;
        const help = `supplierTasks.help.${step}`;
        expect(t(name as never), name).not.toBe(name);
        expect(t(help as never), help).not.toBe(help);
      }
    }
    expect(supplierStepOfGroup("supplier.sign")).toBe("sign");
    expect(supplierStepOfGroup("supplier.outra")).toBeNull();
    expect(supplierStepOfGroup("PACKAGING")).toBeNull();
  });

  it("produto do Booking enviado ao fornecedor: etapa Analisar o Booking, com a data em que chegou e a do carregamento", async () => {
    const store = getStore();
    const [line] = await store.list("product_lines", { limit: 1 });
    const product = await store.create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      lineId: line.id,
      name: "Porta-retrato do Booking",
      sku: null,
      specification: null,
      active: true,
      source: "import",
      supplierId: "fornecedor-a",
    } as never);
    const { booking } = await ensureBookingForProduct(admin, {
      productId: product.id,
      importBatchId: "lote-1",
      sourceFileName: "feira.xls",
      sourceRows: "2-4",
      sourceOrder: 1,
    });
    // (a solicitação nasce pelo cliente sem o produto: no Booking ele
    // ainda está escondido da vitrine; o vínculo é a linha do Booking.)
    const req = await request("Porta-retrato do Booking");
    await store.update("bookings", booking.id, {
      status: "requested",
      requestId: req.id,
    });
    // A linha do Booking foi carregada dias antes de ir ao fornecedor.
    const loaded = "2026-10-20T12:00:00.000Z";
    await store.update("bookings", booking.id, {
      createdAt: loaded,
    } as never);
    const [quote] = await r.openRfq(admin, req.id, ["fornecedor-a"]);
    const task = (await mine()).find(
      (t) => t.link === `/app/quotes/${quote.id}`,
    )!;
    expect(task.kind).toBe("quote");
    expect(task.group).toBe("supplier.booking");
    expect(task.supplierStep).toBe("booking");
    expect(task.sinceAt).toBe(quote.createdAt);
    const row = await store.get("bookings", booking.id);
    expect(task.loadedAt).toBe(row!.createdAt);
    // O filtro da etapa acha a pendência; o de outra etapa, não.
    const links = (group: string, all: Awaited<ReturnType<typeof mine>>) =>
      filterTasks(all, { group }).map((t) => t.link);
    const all = await mine();
    expect(links("supplier.booking", all)).toContain(task.link);
    expect(links("supplier.sign", all)).not.toContain(task.link);
    // A Wellmix continua com os grupos dela (nenhum "supplier.*").
    expect(
      (await pendingTasksFor(admin)).some((t) => supplierStepOfGroup(t.group)),
    ).toBe(false);
  });

  it("pedido: ficha de compra, aprovar a arte e assinar são etapas separadas, na ordem do caminho", async () => {
    const order = await newOrder("Pedido das etapas");
    const ofOrder = async () =>
      (await mine()).filter((t) => t.orderNumber === order.number);
    // Preparação aberta: a ficha de compra é dele.
    await reachSignature(admin, order.id, "packaging");
    // (a Wellmix concluiu a Preparação no lugar dele: nada de ficha pendente)
    expect((await ofOrder()).some((t) => t.group === "supplier.sheet")).toBe(
      false,
    );
    // Arte enviada e documento enviado para assinatura: a arte chega a ele;
    // a assinatura ainda espera a Wellmix.
    await reachSignature(admin, order.id);
    let tasks = await ofOrder();
    const art = tasks.find((t) => t.group === "supplier.art")!;
    expect(art.kind).toBe("requirement");
    expect(art.link).toBe(`/app/orders/${order.id}`);
    expect(tasks.some((t) => t.group === "supplier.sign")).toBe(false);
    // Está com ele desde que a arte foi enviada.
    const [artRow] = await getStore().list("requirements", {
      filter: { orderId: order.id, key: "art" },
    });
    expect(art.sinceAt).toBe(artRow.submittedAt);
    expect(art.loadedAt).toBeTruthy();
    // A Wellmix assina: a assinatura passa a ser dele, em linha própria,
    // levando direto ao documento.
    await signOrderAs(admin, order.id);
    tasks = await ofOrder();
    const sign = tasks.find((t) => t.group === "supplier.sign")!;
    expect(sign.link).toBe(`/app/orders/${order.id}/purchase-order`);
    expect(sign.detail).toContain("assinado pelo fornecedor");
    expect(tasks.find((t) => t.group === "supplier.art")!.detail).not.toContain(
      "assinado",
    );
    const [wellmixRow] = await getStore().list("requirements", {
      filter: { orderId: order.id, key: "order_signed_wellmix" },
    });
    expect(sign.sinceAt).toBe(wellmixRow.submittedAt);
    // Etapas na ordem do caminho (arte antes de assinar).
    const groups = taskGroups(tasks).map((g) => g.group);
    expect(groups.indexOf("supplier.art")).toBeLessThan(
      groups.indexOf("supplier.sign"),
    );
    // Assinou: a pendência da assinatura some.
    await signOrderAs(supplierA, order.id);
    expect((await ofOrder()).some((t) => t.group === "supplier.sign")).toBe(
      false,
    );
  });
});
