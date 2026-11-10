import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Sincronização portal → Sankhya (fase 3): pendências por data, inclusão e
 * vínculo de parceiro e produto, itens do pedido ligado, adaptador do pedido
 * e "já está na TOP" no faturamento das regras.
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
const sync = await import("@/lib/integrations/sankhya-sync");
const st = await import("@/lib/integrations/sankhya-settings");
const sk = await import("@/lib/integrations/sankhya-client");
const engine = await import("@/lib/services/process-engine");
const { getSankhyaAdapter } = await import("@/lib/integrations/sankhya");
type User = import("@/lib/db").User;

let admin: User;
afterEach(() => vi.unstubAllGlobals());

interface Call {
  service: string;
  body: Record<string, unknown>;
}

/** Sankhya falso: guarda as chamadas e responde por serviço. */
function fakeSankhya(handler: (c: Call) => unknown) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", (async (
    input: RequestInfo | URL,
    init: RequestInit = {},
  ) => {
    if (String(input).endsWith("/authenticate"))
      return new Response(
        JSON.stringify({ access_token: "t", expires_in: 300 }),
      );
    const body = JSON.parse(String(init.body));
    const call = {
      service: body.serviceName as string,
      body: body.requestBody,
    };
    calls.push(call);
    return new Response(
      JSON.stringify({ status: "1", responseBody: handler(call) ?? {} }),
    );
  }) as typeof fetch);
  return calls;
}

const entities = (rows: Record<string, unknown>[]) => ({
  entities: {
    total: String(rows.length),
    hasMoreResult: "false",
    offsetPage: "0",
    metadata: {
      fields: {
        field: Object.keys(rows[0] ?? { X: 1 }).map((name) => ({ name })),
      },
    },
    entity: rows.map((r) =>
      Object.fromEntries(
        Object.values(r).map((v, i) => [`f${i}`, { $: String(v) }]),
      ),
    ),
  },
});

const criteriaValue = (c: Call) =>
  ((c.body.dataSet as { criteria?: { parameter?: Array<{ $: string }> } })
    .criteria?.parameter ?? [])[0]?.$;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  await st.saveSankhyaCredentials(
    {
      environment: "production",
      clientId: "c",
      clientSecret: "s",
      xToken: "x",
    },
    "admin",
  );
});

async function enable(on = true) {
  const erp = await st.getSankhyaErpSettings();
  await st.saveSankhyaErpSettings(
    {
      ...erp,
      ordersEnabled: on,
      syncSince: erp.syncSince ?? new Date().toISOString(),
    },
    admin.id,
  );
  sk.resetSankhyaTokenCache();
}

describe("pendências", () => {
  it("nova depois do início = incluir; alterada depois da sincronização = alterar; da carga não volta", () => {
    const since = "2026-11-10T12:00:00.000Z";
    const row = (
      createdAt: string,
      updatedAt: string,
      code: string | null,
      syncedAt: string | null = null,
    ) => ({
      createdAt,
      updatedAt,
      sankhyaCode: code,
      sankhyaSyncedAt: syncedAt,
    });
    expect(
      sync.pendingKind(
        row("2026-11-10T13:00:00Z", "2026-11-10T13:00:00Z", null),
        since,
      ),
    ).toBe("create");
    expect(
      sync.pendingKind(
        row("2026-11-01T00:00:00Z", "2026-11-11T00:00:00Z", null),
        since,
      ),
    ).toBeNull();
    expect(
      sync.pendingKind(
        row(
          "2026-11-01T00:00:00Z",
          "2026-11-11T00:00:00Z",
          "50",
          "2026-11-10T12:30:00Z",
        ),
        since,
      ),
    ).toBe("update");
    expect(
      sync.pendingKind(
        row(
          "2026-11-01T00:00:00Z",
          "2026-11-10T12:10:00Z",
          "50",
          "2026-11-10T12:30:00Z",
        ),
        since,
      ),
    ).toBeNull();
    // Antes de ligar a execução, nada é pendente.
    expect(
      sync.pendingKind(
        row("2026-11-10T13:00:00Z", "2026-11-10T13:00:00Z", null),
        null,
      ),
    ).toBeNull();
  });

  it("campos do parceiro e do produto para o Sankhya", () => {
    const erp = {
      ...st.DEFAULT_SANKHYA_ERP,
      partnerDefaults: { CODCID: 0 },
      productDefaults: { USOPROD: "R" },
    };
    const party = {
      name: "Ningbo",
      taxId: "12.345.678/0001-90",
      email: "a@b.c",
      phone: null,
      active: true,
      type: "supplier",
    } as never;
    expect(sync.partnerValues(party, erp, "create")).toMatchObject({
      CODCID: 0,
      NOMEPARC: "Ningbo",
      RAZAOSOCIAL: "Ningbo",
      TIPPESSOA: "J",
      CGC_CPF: "12345678000190",
      FORNECEDOR: "S",
      ATIVO: "S",
    });
    expect(sync.partnerValues(party, erp, "update")).not.toHaveProperty(
      "CODCID",
    );
    const product = {
      name: "Caneca",
      sku: "WX1",
      ean: "789",
      ncm: "6912.00.00",
      heightCm: 8.2,
      widthCm: null,
      lengthCm: null,
      grossWeightKg: 0.3,
      netWeightKg: null,
      active: true,
    } as never;
    expect(
      sync.productValues(
        product,
        { sankhyaCode: "160201001" } as never,
        erp,
        "create",
      ),
    ).toMatchObject({
      USOPROD: "R",
      DESCRPROD: "Caneca",
      REFFORN: "WX1",
      REFERENCIA: "789",
      NCM: "69120000",
      CODVOL: "UN",
      CODGRUPOPROD: "160201001",
      ALTURA: 0.082,
    });
  });
});

describe("envio", () => {
  it("parceiro novo: procura, inclui e grava o CODPARC; já existente lá: só vincula", async () => {
    await enable();
    const store = getStore();
    const party = await store.create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      type: "supplier",
      name: "Fornecedor Novo",
      country: "CN",
      email: null,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
    });
    let created = false;
    const calls = fakeSankhya((c) => {
      if (c.service === "CRUDServiceProvider.loadRecords")
        return entities(created ? [{ CODPARC: 777 }] : []);
      if (c.service === "DatasetSP.save") {
        created = true;
        return { result: [] };
      }
    });
    await sync.runSankhyaSync(admin);
    const saved = await store.get("parties", party.id);
    expect(saved?.sankhyaCode).toBe("777");
    const save = calls.find((c) => c.service === "DatasetSP.save")!;
    expect(save.body.entityName).toBe("Parceiro");
    expect(save.body.fields).toEqual(
      expect.arrayContaining(["NOMEPARC", "FORNECEDOR"]),
    );
    expect(criteriaValue(calls[0])).toBe("Fornecedor Novo");
    // Sincronizado: não é mais pendente.
    expect(
      (await sync.listPendingSync()).parties.some((p) => p.row.id === party.id),
    ).toBe(false);

    // Produto que já existe no Sankhya pelo REFFORN: vincula sem incluir.
    const [line] = await store.list("product_lines", { limit: 1 });
    await store.update("product_lines", line.id, { sankhyaCode: "160201001" });
    const product = await store.create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      lineId: line.id,
      name: "Caneca nova",
      sku: "WX9999",
      specification: null,
      active: true,
    });
    const calls2 = fakeSankhya((c) =>
      c.service === "CRUDServiceProvider.loadRecords"
        ? entities([{ CODPROD: 9999 }])
        : { result: [] },
    );
    await sync.syncSoon(admin, "product", product.id);
    expect((await store.get("products", product.id))?.sankhyaCode).toBe("9999");
    const update = calls2.find((c) => c.service === "DatasetSP.save")!;
    expect(update.body.records).toEqual([
      expect.objectContaining({ pk: { CODPROD: "9999" } }),
    ]);
  });

  it("produto de linha sem grupo do Sankhya: erro registrado, nada incluído", async () => {
    await enable();
    const store = getStore();
    const line = await store.create("product_lines", {
      name: "Linha sem grupo",
      manualDocumentId: null,
      requirements: [],
      active: true,
      requiredCertifications: null,
      prompts: null,
    });
    const product = await store.create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      lineId: line.id,
      name: "Sem grupo",
      sku: "WX0001",
      specification: null,
      active: true,
    });
    const calls = fakeSankhya((c) =>
      c.service === "CRUDServiceProvider.loadRecords" ? entities([]) : {},
    );
    await sync.syncSoon(admin, "product", product.id);
    expect(calls.some((c) => c.service === "DatasetSP.save")).toBe(false);
    const [event] = await store.list("process_events", {
      filter: { entityId: product.id },
    });
    expect(event).toMatchObject({
      status: "error",
      event: "sync:product:create",
    });
    expect(event.detail).toContain("CODGRUPOPROD");
  });

  it("desligada: nada é enviado", async () => {
    await enable(false);
    const calls = fakeSankhya(() => ({}));
    expect(await sync.runSankhyaSync(admin)).toMatchObject({ enabled: false });
    expect(calls).toHaveLength(0);
  });
});

async function linkedOrder(nunota: string | null) {
  const store = getStore();
  const [line] = await store.list("product_lines", { limit: 1 });
  const [customer] = await store.list("parties", {
    filter: { type: "customer" },
    limit: 1,
  });
  const supplier = await store.create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "supplier",
    name: `Fornecedor ${Math.random()}`,
    country: "CN",
    email: null,
    phone: null,
    taxId: null,
    notes: null,
    active: true,
    sankhyaCode: "11",
    sankhyaSyncedAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const products = [];
  for (const code of ["50", "51"])
    products.push(
      await store.create("products", {
        ...PRODUCT_EXTRA_DEFAULTS,
        lineId: line.id,
        name: `Produto ${code}`,
        sku: `WX${code}`,
        specification: null,
        active: true,
        sankhyaCode: code,
        sankhyaSyncedAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    );
  const request = await store.create("requests", {
    ...REQUEST_EXTRA_DEFAULTS,
    customerId: customer.id,
    createdByUserId: admin.id,
    productId: products[0].id,
    productName: "Produto 50",
    description: "",
    specification: null,
    quantity: 100,
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
    status: "PREPARATION",
    currentStageId: null,
    fobTotal: 100,
    fobCurrency: "USD",
    sellPrice: null,
    sellCurrency: null,
    erpSyncStatus: nunota ? "synced" : "pending",
    erpNumber: nunota,
    sankhyaCode: nunota,
    sankhyaSyncedAt: new Date(Date.now() - 500).toISOString(),
    agencyId: null,
    brokerId: null,
    shippingLineId: null,
    carrierId: null,
    closedAt: null,
    notes: null,
  });
  for (const [i, p] of products.entries())
    await store.create("order_items", {
      orderId: order.id,
      productId: p.id,
      name: p.name,
      quantity: i === 0 ? 120 : 10,
      unit: "UN",
      unitPrice: 2,
    });
  return { order, request };
}

describe("pedido", () => {
  it("itens alterados no portal vão para a nota (quantidade diferente e item novo)", async () => {
    await enable();
    const { order } = await linkedOrder("8001");
    const calls = fakeSankhya((c) =>
      c.service === "CRUDServiceProvider.loadRecords"
        ? entities([{ SEQUENCIA: 1, CODPROD: 50, QTDNEG: 100, VLRUNIT: 2 }])
        : {},
    );
    const pending = await sync.listPendingSync();
    expect(pending.orders.map((o) => o.id)).toContain(order.id);
    await sync.syncOrderItems(admin, order, await st.getSankhyaErpSettings());
    const upsert = calls.find(
      (c) => c.service === "CACSP.incluirAlterarItemNota",
    )!;
    const items = (
      upsert.body as {
        nota: { itens: { item: Array<Record<string, { $?: string }>> } };
      }
    ).nota.itens.item;
    expect(items.map((i) => [i.SEQUENCIA?.$, i.CODPROD.$, i.QTDNEG.$])).toEqual(
      [
        ["1", "50", "120"],
        [undefined, "51", "10"],
      ],
    );
    expect(
      (await sync.listPendingSync()).orders.map((o) => o.id),
    ).not.toContain(order.id);
  });

  it("adaptador: com a execução ligada inclui o pedido; nota já ligada devolve o número", async () => {
    await enable();
    const { order } = await linkedOrder(null);
    fakeSankhya((c) => {
      if (c.service === "DbExplorerSP.executeQuery")
        return { fieldsMetadata: [{ name: "TIPMOV" }], rows: [["O"]] };
      if (c.service === "CACSP.incluirNota")
        return { pk: { NUNOTA: { $: "8100" } } };
    });
    expect(await getSankhyaAdapter().createOrder(order, [])).toEqual({
      status: "synced",
      erpNumber: "8100",
    });
    const linked = await getStore().get("orders", order.id);
    expect(linked?.sankhyaCode).toBe("8100");
    expect(await getSankhyaAdapter().createOrder(linked!, [])).toEqual({
      status: "synced",
      erpNumber: "8100",
    });

    // Regra "assinado → faturar para 1101": a nota já está na 1101, não fatura de novo.
    const calls = fakeSankhya((c) =>
      c.service === "DbExplorerSP.executeQuery"
        ? { fieldsMetadata: [{ name: "CODTIPOPER" }], rows: [[1101]] }
        : {},
    );
    await engine.emitProcessEvent(admin, "order:signed", { orderId: order.id });
    expect(calls.some((c) => c.service === "SelecaoDocumentoSP.faturar")).toBe(
      false,
    );
    const [event] = await getStore().list("process_events", {
      filter: { orderId: order.id, event: "order:signed" },
    });
    expect(event.detail).toContain("já está na TOP 1101");

    // Desligada: volta ao número manual.
    await enable(false);
    const { order: other } = await linkedOrder(null);
    expect(await getSankhyaAdapter().createOrder(other, [])).toEqual({
      status: "pending",
    });
  });
});
