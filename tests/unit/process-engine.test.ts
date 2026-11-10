import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Regras de processo (Configurações → Processos): status do portal → estoque
 * e Sankhya. Simulação com a execução desligada, uma vez por evento, entrada
 * de estoque, inclusão/faturamento/cancelamento da nota com um Sankhya falso
 * e o faturamento do pedido.
 */
withTempStore();

const {
  getStore,
  ORDER_EXTRA_DEFAULTS,
  PARTY_EXTRA_DEFAULTS,
  PRODUCT_EXTRA_DEFAULTS,
  REQUEST_EXTRA_DEFAULTS,
} = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const rules = await import("@/lib/process-rules");
const engine = await import("@/lib/services/process-engine");
const st = await import("@/lib/integrations/sankhya-settings");
const sk = await import("@/lib/integrations/sankhya-client");
const { registerOrderInvoice } = await import("@/lib/services/order-invoicing");
type User = import("@/lib/db").User;

let admin: User;
afterEach(() => vi.unstubAllGlobals());

async function fixture() {
  const store = getStore();
  const [line] = await store.list("product_lines", { limit: 1 });
  const [customer] = await store.list("parties", {
    filter: { type: "customer" },
    limit: 1,
  });
  const supplier = await store.create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "supplier",
    name: "Ningbo Ceramics",
    country: "CN",
    email: null,
    phone: null,
    taxId: null,
    notes: null,
    active: true,
    sankhyaCode: "11",
  });
  const product = await store.create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId: line.id,
    name: "Caneca",
    sku: "WX7588",
    specification: null,
    active: true,
    sankhyaCode: "50",
  });
  const request = await store.create("requests", {
    ...REQUEST_EXTRA_DEFAULTS,
    customerId: customer.id,
    createdByUserId: admin.id,
    productId: product.id,
    productName: "Caneca",
    description: "",
    specification: null,
    quantity: 1000,
    unit: "UN",
    deadline: null,
    status: "ORDERED",
    selectedQuoteId: null,
    orderId: null,
    sellPrice: null,
    sellCurrency: null,
    downPaymentAmount: null,
    notes: null,
  });
  const order = await store.create("orders", {
    ...ORDER_EXTRA_DEFAULTS,
    number: await store.nextNumber("order_number"),
    requestId: request.id,
    customerId: customer.id,
    supplierId: supplier.id,
    lineId: line.id,
    status: "ORDER_CREATED",
    currentStageId: null,
    fobTotal: 1000,
    fobCurrency: "USD",
    sellPrice: null,
    sellCurrency: null,
    erpSyncStatus: "pending",
    erpNumber: null,
    agencyId: null,
    brokerId: null,
    shippingLineId: null,
    carrierId: null,
    closedAt: null,
    notes: null,
  });
  await store.create("order_items", {
    orderId: order.id,
    productId: product.id,
    name: "Caneca",
    quantity: 1000,
    unit: "UN",
    unitPrice: 1,
  });
  return { request, order, product };
}

async function setRules(
  changes: Partial<
    Record<string, Partial<import("@/lib/process-rules").ProcessRule>>
  >,
) {
  const current = await engine.getProcessRules();
  await engine.saveProcessRules(
    admin,
    current.map((r) => ({ ...r, ...(changes[r.event] ?? {}) })),
  );
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("regras", () => {
  it("um evento por status e a proposta da Wellmix (cotação → pre-order → pedido)", () => {
    const merged = rules.mergeRules(null);
    expect(merged.map((r) => r.event)).toEqual(rules.PROCESS_EVENTS);
    const by = Object.fromEntries(merged.map((r) => [r.event, r]));
    expect(by["request:WAITING_DOWN_PAYMENT"]).toMatchObject({
      sankhya: "create_note",
      top: 1002,
    });
    expect(by["request:ORDERED"]).toMatchObject({
      sankhya: "advance",
      top: 1100,
    });
    expect(by["order:signed"]).toMatchObject({ sankhya: "advance", top: 1101 });
    expect(by["order:cancelled"]).toMatchObject({ sankhya: "cancel_note" });
    expect(rules.ruleProblem(by["order:invoiced"])).toBe("top_missing");
    expect(merged.every((r) => r.stock === "none")).toBe(true);
  });

  it("acha o NUNOTA novo na resposta do faturamento", () => {
    expect(
      engine.newNunota(
        {
          notas: { nota: [{ NUNOTA: { $: "900" } }, { NUNOTA: { $: "901" } }] },
        },
        "900",
      ),
    ).toBe("901");
    expect(engine.newNunota({ nunota: 77 }, "1")).toBe("77");
    expect(engine.newNunota({}, "1")).toBeNull();
  });
});

describe("execução", () => {
  it("desligada: simula e registra uma vez só; estoque entra pela regra", async () => {
    const { order, product } = await fixture();
    await setRules({
      "stage:DELIVERED:done": { active: true, stock: "entry" },
    });
    await engine.emitProcessEvent(admin, "order:signed", { orderId: order.id });
    await engine.emitProcessEvent(admin, "order:signed", { orderId: order.id });
    await engine.emitProcessEvent(admin, "stage:DELIVERED:done", {
      orderId: order.id,
    });
    const events = await getStore().list("process_events", {
      filter: { orderId: order.id },
    });
    expect(events.map((e) => [e.event, e.status])).toEqual(
      expect.arrayContaining([
        ["order:signed", "simulated"],
        ["stage:DELIVERED:done", "done"],
      ]),
    );
    expect(events.filter((e) => e.event === "order:signed")).toHaveLength(1);
    expect(events.find((e) => e.event === "order:signed")?.detail).toContain(
      "faturar",
    );
    const moves = await getStore().list("stock_movements", {
      filter: { orderId: order.id },
    });
    expect(moves.map((m) => [m.productId, m.kind, m.quantity])).toEqual([
      [product.id, "process_in", 1000],
    ]);
    // Evento sem regra ativa: nada é registrado.
    await engine.emitProcessEvent(admin, "stage:PACKAGING:start", {
      orderId: order.id,
    });
    expect(
      (
        await getStore().list("process_events", {
          filter: { orderId: order.id },
        })
      ).some((e) => e.event === "stage:PACKAGING:start"),
    ).toBe(false);
  });

  it("ligada: inclui a nota (cotação), fatura (pre-order) e cancela no Sankhya", async () => {
    await st.saveSankhyaCredentials(
      {
        environment: "production",
        clientId: "c",
        clientSecret: "s",
        xToken: "x",
      },
      "admin",
    );
    await st.saveSankhyaErpSettings(
      { ...st.DEFAULT_SANKHYA_ERP, ordersEnabled: true },
      admin.id,
    );
    sk.resetSankhyaTokenCache();
    const calls: Array<{ service: string; body: unknown }> = [];
    vi.stubGlobal("fetch", (async (
      input: RequestInfo | URL,
      init: RequestInit = {},
    ) => {
      const url = String(input);
      if (url.endsWith("/authenticate"))
        return new Response(
          JSON.stringify({ access_token: "t", expires_in: 300 }),
        );
      const body = JSON.parse(String(init.body));
      calls.push({ service: body.serviceName, body: body.requestBody });
      const ok = (responseBody: unknown) =>
        new Response(JSON.stringify({ status: "1", responseBody }));
      if (body.serviceName === "DbExplorerSP.executeQuery")
        return ok({ fieldsMetadata: [{ name: "TIPMOV" }], rows: [["O"]] });
      if (body.serviceName === "CACSP.incluirNota")
        return ok({ pk: { NUNOTA: { $: "5001" } } });
      if (body.serviceName === "SelecaoDocumentoSP.faturar")
        return ok({ notas: { nota: [{ NUNOTA: { $: "5002" } }] } });
      return ok({});
    }) as typeof fetch);

    const { request, order } = await fixture();
    // Cotação no Sankhya com o fornecedor e o produto da carga (CODPARC 11, CODPROD 50).
    await engine.emitProcessEvent(admin, "request:WAITING_DOWN_PAYMENT", {
      orderId: order.id,
    });
    const included = calls.find((c) => c.service === "CACSP.incluirNota")!;
    const header = (
      included.body as { nota: { cabecalho: Record<string, { $?: string }> } }
    ).nota.cabecalho;
    expect(header.CODPARC.$).toBe("11");
    expect(header.CODTIPOPER.$).toBe("1002");
    expect(header.CODEMP.$).toBe("3");
    expect(header.CODNAT.$).toBe("203005");
    expect((await getStore().get("orders", order.id))?.sankhyaCode).toBe(
      "5001",
    );

    // Pedido criado: fatura a cotação para a pre-order (1100) e liga o novo NUNOTA.
    await engine.emitProcessEvent(admin, "request:ORDERED", {
      requestId: request.id,
      orderId: order.id,
    });
    const invoiced = calls.find(
      (c) => c.service === "SelecaoDocumentoSP.faturar",
    )!;
    expect(
      (invoiced.body as { notas: { codTipOper: number } }).notas.codTipOper,
    ).toBe(1100);
    const linked = await getStore().get("orders", order.id);
    expect(linked).toMatchObject({
      sankhyaCode: "5002",
      erpNumber: "5002",
      erpSyncStatus: "synced",
    });

    await engine.emitProcessEvent(admin, "order:cancelled", {
      orderId: order.id,
    });
    expect(calls.some((c) => c.service === "CACSP.cancelarNota")).toBe(true);
    const statuses = (
      await getStore().list("process_events", { filter: { orderId: order.id } })
    ).map((e) => e.status);
    expect(statuses.every((s) => s === "done")).toBe(true);
  });

  it("produto sem código do Sankhya: erro registrado, o fluxo segue", async () => {
    const { order, product } = await fixture();
    await getStore().update("products", product.id, { sankhyaCode: null });
    vi.stubGlobal("fetch", (async () => new Response("{}")) as typeof fetch);
    await engine.emitProcessEvent(admin, "request:WAITING_DOWN_PAYMENT", {
      orderId: order.id,
    });
    const [event] = await getStore().list("process_events", {
      filter: { orderId: order.id },
    });
    expect(event).toMatchObject({ status: "error" });
    expect(event.detail).toContain("sem código do Sankhya");
  });
});

describe("faturamento do pedido", () => {
  it("grava a data, dispara a regra e não deixa faturar duas vezes", async () => {
    await st.saveSankhyaErpSettings(
      { ...st.DEFAULT_SANKHYA_ERP, ordersEnabled: false },
      admin.id,
    );
    await setRules({ "order:invoiced": { top: 1201 } });
    const { order } = await fixture();
    await registerOrderInvoice(admin, order.id);
    expect((await getStore().get("orders", order.id))?.invoicedAt).toBeTruthy();
    const [event] = await getStore().list("process_events", {
      filter: { orderId: order.id, event: "order:invoiced" },
    });
    expect(event).toMatchObject({ status: "simulated", top: 1201 });
    await expect(registerOrderInvoice(admin, order.id)).rejects.toThrow(
      "already_invoiced",
    );
  });
});
