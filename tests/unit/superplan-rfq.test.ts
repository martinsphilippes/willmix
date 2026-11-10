import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Do Superplan à faca e à RFQ (docs/SUPERPLAN.md, seção 12): com a
 * viabilidade feita, o administrador abre a solicitação e a RFQ só com o
 * fornecedor ganho, já com o preço da simulação. O fornecedor envia faca,
 * MOQ, prazo e foto em alta; a escolha (proposta ou aprovação) espera os
 * quatro. A solicitação comum não muda.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const sp = await import("@/lib/services/superplan-rfq");
const { superplanMissing } = await import("@/lib/superplan-rfq");
const r = await import("@/lib/services/requests");
const pb = await import("@/lib/services/packaging-brief");
const { submitForApproval } = await import("@/lib/services/approvals");
const { requestStages, DEFAULT_REQUEST_STEP_DAYS } =
  await import("@/lib/request-stages");
const { DEFAULT_SUPERPLAN, DEFAULT_EXPENSES, businessTypeOf } =
  await import("@/lib/superplan");
type User = import("@/lib/db").User;
type Input = import("@/lib/superplan").SuperplanInput;

let admin: User;
let supplierA: User;
let supplierB: User;

const UD = businessTypeOf(DEFAULT_SUPERPLAN, "WELLMIX - UD - CHINA - MERCADO");

/**
 * O exemplo da planilha (jarra a 24,90 RMB): amarelo, lucro de 16%. Os
 * parâmetros do sistema mandados aqui são de mentira de propósito: o
 * servidor usa os dele.
 */
function simulation(patch: Partial<Input> = {}): Input {
  return {
    unitPrice: 24.9,
    currency: "RMB",
    pcsPerCarton: 12,
    netWeightPcKg: null,
    grossWeightPcKg: 1.13,
    cbmPerCarton: 0.069,
    containerCbm: 67.5,
    containerMaxKg: 28000,
    iiPct: 20,
    ipiPct: 5,
    freightUsd: 3492,
    roadFreightBrl: 1500,
    deliveryFreightBrl: 0,
    officialRate: 5.15,
    futureRate: 5.4,
    rmbPerUsd: 6.75,
    tradingCommissionPct: 0,
    chinaChargesRmb: 0,
    expenses: DEFAULT_EXPENSES,
    markup: UD.markup,
    commissionPct: UD.commissionPct,
    adminExpensesPct: UD.adminExpensesPct,
    targetProfitPct: UD.targetProfitPct,
    wdPct: UD.wdPct,
    insurancePct: 0,
    pisImportPct: 0,
    cofinsImportPct: 0,
    icmsImportPct: 0,
    freightFxPct: 0,
    afrmmPct: 0,
    afrmmFixedBrl: 0,
    grossEstimatePct: DEFAULT_SUPERPLAN.grossEstimatePct,
    priceFactors: DEFAULT_SUPERPLAN.priceFactors,
    saleTaxes: { icmsPct: 0, pisPct: 0, cofinsPct: 0, irPct: 0, csllPct: 0 },
    salePrice: null,
    ...patch,
  };
}

const meta = { businessType: UD.name, container: "40HC" };

const pdf = () =>
  new File([new Uint8Array([37, 80, 68, 70, 45, 49])], "faca.pdf", {
    type: "application/pdf",
  });
const jpg = () =>
  new File([new Uint8Array([255, 216, 255, 224, 0, 16])], "hd.jpg", {
    type: "image/jpeg",
  });

async function open() {
  return sp.openSuperplanRfq(admin, {
    productId: "prod-panela",
    supplierId: "fornecedor-a",
    customerId: null,
    quantity: 11736,
    input: simulation(),
    ...meta,
  });
}

const select = (quoteId: string) =>
  r.selectQuote(admin, quoteId, { sellPrice: 1000, sellCurrency: "BRL" });

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.role === "admin")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
});

describe("o que falta dos quatro itens", () => {
  it("lista na ordem da tela; vazio com tudo", () => {
    expect(
      superplanMissing({
        dieline: false,
        moq: null,
        leadTimeDays: 0,
        hd: false,
      }),
    ).toEqual(["dieline", "moq", "leadTime", "hd"]);
    expect(
      superplanMissing({ dieline: true, moq: 500, leadTimeDays: 30, hd: true }),
    ).toEqual([]);
  });
});

describe("Superplan → faca e RFQ com o fornecedor ganho", () => {
  it("abre a solicitação, a RFQ só com ele (preço da simulação) e a faca", async () => {
    const { request, quote } = await open();
    expect(request.origin).toBe("superplan");
    expect(request.customerId).toBe("wellmix-estoque");
    expect(request.quantity).toBe(11736);
    expect(request.notes).toContain("Superplan");
    expect(request.notes).toContain("amarelo");
    const quotes = await getStore().list("quotes", {
      filter: { requestId: request.id },
    });
    expect(quotes).toHaveLength(1);
    expect(quote.supplierId).toBe("fornecedor-a");
    expect(quote.status).toBe("invited");
    expect(quote.price).toBe(24.9);
    expect(quote.currency).toBe("CNY");
    // MOQ e prazo só valem confirmados; a tela sugere o MOQ do cadastro.
    expect(quote.moq ?? null).toBeNull();
    const view = (await sp.superplanQuoteView(supplierA, quote.id))!;
    expect(view.suggested.moq).toBe(500);
    expect(view.missing).toEqual(["dieline", "moq", "leadTime", "hd"]);
    const brief = (await pb.briefForRequest(request.id))!;
    expect(brief.requiredKeys).toContain("dieline");
    // O fornecedor ganho já é o da faca, antes da escolha.
    expect(await pb.briefSupplierId(brief)).toBe("fornecedor-a");
    const notes = await getStore().list("notifications", {
      filter: { userId: supplierA.id, channel: "inapp" },
    });
    expect(
      notes.some((n) => n.link === `/app/quotes/${quote.id}#superplan`),
    ).toBe(true);
    const audits = await getStore().list("audit_log", {
      filter: { action: "superplan.rfq_open", entityId: request.id },
    });
    expect(audits).toHaveLength(1);
  });

  it("só o administrador abre; com prejuízo ou conta incompleta, não", async () => {
    const buyer = { ...admin, id: "x", role: "operator" } as User;
    await expect(
      sp.openSuperplanRfq(buyer, {
        productId: "prod-panela",
        supplierId: "fornecedor-a",
        customerId: null,
        quantity: 100,
        input: simulation(),
        ...meta,
      }),
    ).rejects.toThrow();
    await expect(
      sp.openSuperplanRfq(admin, {
        productId: "prod-panela",
        supplierId: "fornecedor-a",
        customerId: null,
        quantity: 1000,
        input: simulation({ markup: 0.5 }),
        ...meta,
      }),
    ).rejects.toThrow("not_viable");
    await expect(
      sp.openSuperplanRfq(admin, {
        productId: "prod-panela",
        supplierId: "fornecedor-a",
        customerId: null,
        quantity: 1000,
        input: simulation({ unitPrice: null }),
        ...meta,
      }),
    ).rejects.toThrow("simulation_incomplete");
  });

  it("a proposta e a aprovação esperam os quatro itens", async () => {
    const { request, quote } = await open();
    // Mesmo respondida pela ficha comum, sem os quatro itens não segue.
    await getStore().update("quotes", quote.id, { status: "answered" });
    await expect(select(quote.id)).rejects.toThrow("superplan_items_missing");
    await expect(
      submitForApproval(admin, quote.id, {
        sellPrice: 1000,
        sellCurrency: "BRL",
      }),
    ).rejects.toThrow("superplan_items_missing");
    const after = await getStore().get("requests", request.id);
    expect(after!.selectedQuoteId).toBeNull();
  });

  it("o fornecedor ganho envia aos poucos; com os quatro a cotação fica respondida", async () => {
    const { request, quote } = await open();
    // Outro fornecedor não vê nem envia.
    expect(await sp.superplanQuoteView(supplierB, quote.id)).toBeNull();
    await expect(
      sp.sendSuperplanItems(supplierB, quote.id, {
        moq: 100,
        leadTimeDays: 10,
        dieline: null,
        hdPhotos: [],
      }),
    ).rejects.toThrow();

    let res = await sp.sendSuperplanItems(supplierA, quote.id, {
      moq: null,
      leadTimeDays: null,
      dieline: pdf(),
      hdPhotos: [],
    });
    expect(res.missing).toEqual(["moq", "leadTime", "hd"]);
    res = await sp.sendSuperplanItems(supplierA, quote.id, {
      moq: null,
      leadTimeDays: null,
      dieline: null,
      hdPhotos: [jpg()],
    });
    expect(res.missing).toEqual(["moq", "leadTime"]);
    expect((await getStore().get("quotes", quote.id))!.status).toBe("invited");
    // MOQ corrigido (500 → 800) e prazo: completa.
    res = await sp.sendSuperplanItems(supplierA, quote.id, {
      moq: 800,
      leadTimeDays: 35,
      dieline: null,
      hdPhotos: [],
    });
    expect(res.missing).toEqual([]);
    const done = (await getStore().get("quotes", quote.id))!;
    expect(done).toMatchObject({
      status: "answered",
      moq: 800,
      leadTimeDays: 35,
    });
    expect(done.answeredAt).toBeTruthy();
    expect((await getStore().get("requests", request.id))!.status).toBe(
      "QUOTATION_RECEIVED",
    );
    // A Wellmix é avisada, com o que mudou.
    const audits = await getStore().list("audit_log", {
      filter: { action: "superplan.items", entityId: quote.id },
    });
    expect(audits.some((a) => a.summary.includes("MOQ 500 → 800"))).toBe(true);
    // Agora a escolha segue (estoque: o pedido nasce na hora).
    await select(quote.id);
    const chosen = (await getStore().get("requests", request.id))!;
    expect(chosen.selectedQuoteId).toBe(quote.id);
  });

  it("etapas: a faca vem logo depois da solicitação nova e começa com a RFQ", () => {
    const now = new Date("2026-11-10T15:00:00Z");
    const rows = requestStages({
      status: "RFQ_OPEN",
      createdAt: "2026-11-10T12:00:00.000Z",
      quotes: [
        {
          createdAt: "2026-11-10T12:00:00.000Z",
          answeredAt: null,
          status: "invited",
        },
      ],
      approval: null,
      selectedAt: null,
      dieline: { dueAt: null, doneAt: null },
      superplan: true,
      proposalApprovedAt: null,
      downConfirmedAt: null,
      days: DEFAULT_REQUEST_STEP_DAYS,
      now,
    });
    expect(rows.map((row) => row.key).slice(0, 3)).toEqual([
      "new",
      "dieline",
      "rfq",
    ]);
    expect(rows[1]).toMatchObject({ state: "active", superplan: true });
  });
});

describe("a solicitação comum não muda", () => {
  it("antes da escolha ninguém é o fornecedor da faca", async () => {
    const request = await r.createRequest(admin, {
      customerId: "cliente-joao",
      productId: "prod-jarra",
      productName: "Jarra",
      description: "Comum",
      specification: null,
      quantity: 500,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const brief = (await pb.briefForRequest(request.id))!;
    expect(await pb.briefSupplierId(brief)).toBeNull();
  });
});
