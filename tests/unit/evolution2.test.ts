import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Segunda Onda: NCM com validação humana, gate de conformidade, pós-venda,
 * recompra/nova proposta, sourcing sob demanda, histórico e oportunidades.
 */
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const {
  createRequest,
  openRfq,
  answerQuote,
  selectQuote,
  confirmDownPayment,
  createFollowUpRequest,
} = await import("@/lib/services/requests");
const { submitRequirement, decideRequirement, loadOrderProgress } =
  await import("@/lib/workflow/engine");
const {
  suggestNcm,
  suggestTaxCandidates,
  validateTaxClassification,
  rejectTaxClassification,
  listTaxClassifications,
} = await import("@/lib/services/taxes");
const { checkProductCompliance, addCertification } =
  await import("@/lib/services/compliance");
const { listOpenReviews } = await import("@/lib/services/reviews");
const { getAfterSales, answerAfterSales } =
  await import("@/lib/services/after-sales");
const { loadCommercialHistory } = await import("@/lib/services/history");
const { tierOpportunity, containerFillOpportunities } =
  await import("@/lib/services/opportunities");
const { createContainer, addContainerItem } =
  await import("@/lib/services/containers");
const { promoteSourcingItem } = await import("@/lib/services/sourcing");
const { pendingTasksFor } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

withTempStore();

let admin: User;
let customer: User;
let supplierC: User;
let broker: User;

async function orderFor(
  productId: string,
  quantity: number,
  supplierId: string,
  supplier: User,
): Promise<Order> {
  const store = getStore();
  const product = await store.get("products", productId);
  const request = await createRequest(customer, {
    customerId: "cliente-joao",
    productId,
    productName: product!.name,
    description: "Teste",
    specification: null,
    quantity,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await openRfq(admin, request.id, [supplierId]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  await answerQuote(supplier, quote.id, {
    price: 10,
    currency: "USD",
    leadTimeDays: 20,
    conditions: null,
  });
  await selectQuote(admin, quote.id, {
    sellPrice: quantity * 60,
    sellCurrency: "BRL",
    downPaymentAmount: 1000,
  });
  return confirmDownPayment(admin, request.id);
}

/** Preenche tudo até encerrar o pedido (Wellmix pode preencher qualquer requisito). */
async function completeOrder(orderId: string) {
  const store = getStore();
  for (let guard = 0; guard < 80; guard++) {
    const progress = (await loadOrderProgress(orderId))!;
    if (progress.order.status === "CLOSED") return;
    const stage = progress.stages.find(
      (s) => s.status === "active" || s.status === "blocked",
    );
    if (!stage) return;
    const pending = progress.requirements.filter(
      (r) => r.stageId === stage.id && r.status !== "done" && r.required,
    );
    if (pending.length === 0) return;
    for (const r of pending) {
      if (r.type === "approval")
        await decideRequirement(admin, r.id, "approve");
      else if (r.type === "file" || r.type === "photo") {
        const doc = await store.create("documents", {
          orderId,
          requestId: null,
          requirementId: r.id,
          type: "photo",
          name: "x.png",
          mime: "image/png",
          size: 1,
          storageKey: "k",
          version: 1,
          previousDocumentId: null,
          uploadedByUserId: admin.id,
          visibility: "all",
          productId: null,
          sourcingItemId: null,
        });
        await submitRequirement(admin, r.id, { documentId: doc.id });
      } else if (r.type === "number")
        await submitRequirement(admin, r.id, { value: "3" });
      else if (r.type === "date")
        await submitRequirement(admin, r.id, { value: "2026-11-01" });
      else await submitRequirement(admin, r.id, { value: "ok" });
    }
  }
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  customer = users.find((u) => u.email === "joao@lojista.com")!;
  supplierC = users.find((u) => u.email === "supplier.c@china.com")!;
  broker = users.find((u) => u.email === "despachante@comex.com")!;
});

describe("NCM com validação humana", () => {
  it("sugere por palavra-chave e só a validada vai para o produto", async () => {
    const store = getStore();
    const jarra = (await store.get("products", "prod-jarra"))!;
    expect(suggestNcm(jarra)[0].ncm).toBe("7013.37");
    const created = await suggestTaxCandidates(admin, "prod-jarra");
    expect(created.length).toBeGreaterThan(0);
    expect(created[0].status).toBe("suggested");
    expect((await store.get("products", "prod-jarra"))!.ncm).toBeNull();
    // Despachante valida.
    await validateTaxClassification(broker, created[0].id);
    expect((await store.get("products", "prod-jarra"))!.ncm).toBe("7013.37");
    // Rejeitar a validada limpa o produto.
    await rejectTaxClassification(admin, created[0].id, "Reclassificar");
    expect((await store.get("products", "prod-jarra"))!.ncm).toBeNull();
    expect((await listTaxClassifications("prod-jarra"))[0].status).toBe(
      "rejected",
    );
    // Fornecedor não valida.
    await expect(
      validateTaxClassification(supplierC, created[0].id),
    ).rejects.toThrow();
  });
});

describe("certificações e gate de conformidade", () => {
  it("linha exige Inmetro: boneca (válido) passa, piscina (sem) entra em revisão e exige conferência", async () => {
    const boneca = await checkProductCompliance("prod-boneca");
    expect(boneca.required).toEqual(["Inmetro"]);
    expect(boneca.missing).toEqual([]);
    const piscina = await checkProductCompliance("prod-piscina");
    expect(piscina.missing).toEqual(["Inmetro"]);

    const order = await orderFor(
      "prod-piscina",
      300,
      "fornecedor-c",
      supplierC,
    );
    const open = await listOpenReviews(order.id);
    expect(open.map((r) => r.rule)).toContain(
      "compliance.missingCertification",
    );
    const progress = (await loadOrderProgress(order.id))!;
    const check = progress.requirements.find(
      (r) => r.key === "compliance_check",
    );
    expect(check?.required).toBe(true);
    expect(check?.status).toBe("pending");

    // Registrar a certificação válida resolve o item e conclui a conferência sozinha.
    await addCertification(admin, "product", "prod-piscina", {
      kind: "Inmetro",
      number: "INMETRO-2026-9",
      validUntil: new Date(Date.now() + 200 * 86400000).toISOString(),
    });
    expect(await listOpenReviews(order.id)).toHaveLength(0);
    const after = (await loadOrderProgress(order.id))!;
    expect(
      after.requirements.find((r) => r.key === "compliance_check")?.status,
    ).toBe("done");
  });
});

describe("pós-venda, recompra e histórico", () => {
  it("entrega abre o pós-venda; cliente responde; recompra reaproveita a solicitação", async () => {
    const order = await orderFor("prod-jarra", 100, "fornecedor-c", supplierC);
    expect(await getAfterSales(order.id)).toBeNull();
    await completeOrder(order.id);
    expect((await getStore().get("orders", order.id))!.status).toBe("CLOSED");
    const after = await getAfterSales(order.id);
    expect(after?.status).toBe("open");
    // Aparece nas pendências do cliente.
    expect(
      (await pendingTasksFor(customer)).some((t) => t.kind === "after_sales"),
    ).toBe(true);
    await answerAfterSales(customer, after!.id, {
      rating: 4,
      problems: "Caixa amassada",
      repurchaseInterest: "yes",
    });
    expect((await getAfterSales(order.id))!.status).toBe("answered");

    const follow = await createFollowUpRequest(customer, order.id, {
      quantity: 150,
      origin: "replenishment",
    });
    expect(follow.origin).toBe("replenishment");
    expect(follow.sourceOrderId).toBe(order.id);
    expect(follow.productId).toBe("prod-jarra");
    expect(follow.quantity).toBe(150);

    const history = await loadCommercialHistory(admin);
    const jarra = history.find((h) => h.productId === "prod-jarra")!;
    expect(jarra.purchases).toBeGreaterThanOrEqual(1);
    expect(jarra.lastQuantity).toBe(100);
    expect(jarra.replenishments).toBe(1);
    expect(jarra.repurchaseInterest).toBe("yes");
    expect(jarra.lastFobUnit).toBe(10);
    // Cliente não vê o custo FOB.
    const mine = await loadCommercialHistory(customer);
    expect(mine.every((h) => h.lastFobUnit === null)).toBe(true);
  });
});

describe("sourcing sob demanda", () => {
  it("solicitação sem produto vira item de sourcing e a promoção liga o produto de volta", async () => {
    const store = getStore();
    const request = await createRequest(customer, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Amortecedor dianteiro Onix 2020",
      description: "Par de amortecedores",
      specification: null,
      quantity: 200,
      unit: "un",
      deadline: null,
      notes: null,
      origin: "sourcing_demand",
    });
    const [item] = await store.list("sourcing_items", {
      filter: { requestId: request.id },
    });
    expect(item?.status).toBe("draft");
    expect(
      (await pendingTasksFor(admin)).some((t) => t.kind === "sourcing_demand"),
    ).toBe(true);
    const product = await promoteSourcingItem(admin, item.id, {
      lineId: "linha-utilidades",
    });
    expect((await store.get("requests", request.id))!.productId).toBe(
      product.id,
    );
  });
});

describe("análise de oportunidade (determinística)", () => {
  it("faixa de preço: mostra custo marginal de comprar até a próxima faixa", () => {
    const opp = tierOpportunity(
      [
        { minQty: 500, price: 9.5 },
        { minQty: 1000, price: 8.9 },
        { minQty: 2000, price: 8.2 },
      ],
      800,
    )!;
    expect(opp.currentUnitPrice).toBe(9.5);
    expect(opp.currentTotal).toBe(7600);
    expect(opp.nextTier.minQty).toBe(1000);
    expect(opp.nextTotal).toBe(8900);
    expect(opp.extraQuantity).toBe(200);
    expect(opp.marginalUnitCost).toBe(6.5);
    expect(opp.unitSavingPercent).toBe(6.3);
    expect(tierOpportunity([{ minQty: 500, price: 9.5 }], 800)).toBeNull();
  });

  it("container: quantas caixas do produto do cliente ainda cabem", async () => {
    const container = await createContainer(admin, {
      code: "OPP1",
      type: "20GP",
    });
    await addContainerItem(admin, container.id, {
      productId: "prod-panela",
      name: "Panelas",
      quantity: 40,
      unitsPerBox: 4,
      cbmPerBox: 0.0833,
    });
    await getStore().update("containers", container.id, {
      customerId: "cliente-joao",
    });
    const opps = await containerFillOpportunities(admin);
    const mine = opps.find((o) => o.containerId === container.id)!;
    expect(mine.remainingCbm).toBeCloseTo(28 - 0.833, 2);
    // Só produtos que o cliente já comprou: a jarra não tem CBM; a piscina (60×40×50 cm, 6 un) tem.
    expect(mine.suggestions.some((s) => s.productId === "prod-panela")).toBe(
      false,
    );
    const piscina = mine.suggestions.find(
      (s) => s.productId === "prod-piscina",
    )!;
    expect(piscina.cbmPerBox).toBe(0.12);
    expect(piscina.boxes).toBe(Math.floor((28 - 0.833) / 0.12));
    expect(piscina.units).toBe(piscina.boxes * 6);
  });
});
