import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Prioridade Agora: snapshot da compra, inspeção cega com comparação
 * comprado × inspecionado, fila de revisão, container e importação.
 */
const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequest, openRfq, answerQuote, selectQuote, confirmDownPayment } =
  await import("@/lib/services/requests");
const { submitRequirement, decideRequirement, loadOrderProgress } =
  await import("@/lib/workflow/engine");
const { getSnapshotForOrder } = await import("@/lib/services/snapshots");
const { compareWithSnapshot, summarizeResult, latestInspectionResult } =
  await import("@/lib/services/inspection");
const { listOpenReviews } = await import("@/lib/services/reviews");
const { createContainer, addContainerItem, loadContainer } =
  await import("@/lib/services/containers");
const { suggestMapping, normalizeRow, parseNumber } =
  await import("@/lib/services/import-batches");
type User = import("@/lib/db").User;

withTempStore();

let admin: User;
let customer: User;
let supplierA: User;
let orderId: string;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  customer = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  const store = getStore();
  // Ficha completa no produto: é o que o snapshot congela.
  await store.update("products", "prod-panela", {
    ...PRODUCT_EXTRA_DEFAULTS,
    supplierId: "fornecedor-a",
    material: "Alumínio",
    color: "Preto",
    netWeightKg: 2.4,
    grossWeightKg: 2.9,
    lengthCm: 30,
    widthCm: 30,
    heightCm: 20,
    masterBoxQty: 4,
    boxLengthCm: 62,
    boxWidthCm: 32,
    boxHeightCm: 42,
    cbm: null,
    price: 9.5,
    currency: "USD",
  });
  const request = await createRequest(customer, {
    customerId: "cliente-joao",
    productId: "prod-panela",
    productName: "Jogo de panelas antiaderentes 5 pçs",
    description: "Panelas",
    specification: null,
    quantity: 400,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await openRfq(admin, request.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  await answerQuote(supplierA, quote.id, {
    price: 9.5,
    currency: "USD",
    leadTimeDays: 30,
    conditions: "FOB Shenzhen",
  });
  await selectQuote(admin, quote.id, {
    sellPrice: 40000,
    sellCurrency: "BRL",
    downPaymentAmount: 12000,
  });
  const order = await confirmDownPayment(admin, request.id);
  orderId = order.id;
});

describe("snapshot da compra", () => {
  it("congela ficha, preço e quantidade no pedido", async () => {
    const snapshot = await getSnapshotForOrder(orderId);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.material).toBe("Alumínio");
    expect(snapshot!.netWeightKg).toBe(2.4);
    expect(snapshot!.unitPrice).toBe(9.5);
    expect(snapshot!.quantity).toBe(400);
    // CBM da caixa master derivado das dimensões da caixa (62×32×42 cm).
    expect(snapshot!.cbm).toBeCloseTo(0.0833, 3);
    // Mudar o cadastro depois não altera o snapshot.
    await getStore().update("products", "prod-panela", { material: "Inox" });
    expect((await getSnapshotForOrder(orderId))!.material).toBe("Alumínio");
  });
});

describe("comparação comprado × inspecionado", () => {
  const snapshot = {
    netWeightKg: 2.4,
    grossWeightKg: 2.9,
    lengthCm: 30,
    widthCm: 30,
    heightCm: 20,
    masterBoxQty: 4,
    material: "Alumínio",
    color: "Preto",
    cbm: 0.0833,
  } as never;
  const tol = { weight: 3, cbm: 5, dimension: 5, quantity: 0 };

  it("aprova dentro da tolerância e ignora o que não foi medido", () => {
    const comparisons = compareWithSnapshot(
      snapshot,
      [
        { key: "weight_measured", status: "done", value: "2.45" },
        { key: "length_measured", status: "done", value: "31" },
        { key: "material_found", status: "done", value: " alumínio " },
        { key: "color_found", status: "pending", value: null },
      ],
      tol,
    );
    expect(comparisons.map((c) => c.attribute)).toEqual([
      "netWeightKg",
      "lengthCm",
      "material",
    ]);
    expect(comparisons.every((c) => c.ok)).toBe(true);
    expect(summarizeResult(comparisons)).toBe("APPROVED");
  });

  it("marca divergência acima da tolerância e material diferente", () => {
    const comparisons = compareWithSnapshot(
      snapshot,
      [
        { key: "weight_measured", status: "done", value: "2.0" },
        { key: "master_box_measured", status: "done", value: "5" },
        { key: "material_found", status: "done", value: "Ferro" },
      ],
      tol,
    );
    expect(comparisons.filter((c) => !c.ok).map((c) => c.attribute)).toEqual([
      "netWeightKg",
      "masterBoxQty",
      "material",
    ]);
    expect(summarizeResult(comparisons)).toBe("DIVERGENT");
    expect(summarizeResult([])).toBe("REVIEW_REQUIRED");
  });

  it("no pedido: divergência bloqueia, abre revisão e a aprovação da Wellmix libera", async () => {
    const store = getStore();
    // Avança até a inspeção preenchendo tudo que vier antes.
    for (let guard = 0; guard < 40; guard++) {
      const progress = (await loadOrderProgress(orderId))!;
      const stage = progress.stages.find(
        (s) => s.status === "active" || s.status === "blocked",
      )!;
      if (stage.key === "INSPECTION") break;
      const pending = progress.requirements.filter(
        (r) => r.stageId === stage.id && r.status !== "done" && r.required,
      );
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
          await submitRequirement(admin, r.id, {
            value: r.key === "weight" ? "2.4" : "1",
          });
        else if (r.type === "date")
          await submitRequirement(admin, r.id, { value: "2026-10-01" });
        else await submitRequirement(admin, r.id, { value: "ok" });
      }
    }
    let progress = (await loadOrderProgress(orderId))!;
    const inspection = progress.stages.find((s) => s.key === "INSPECTION")!;
    expect(inspection.status).toBe("active");
    const req = (key: string) =>
      progress.requirements.find(
        (r) => r.stageId === inspection.id && r.key === key,
      )!;
    expect(req("material_found")).toBeDefined();

    // Inspetor informa material diferente: bloqueia com item de revisão.
    await submitRequirement(supplierA, req("material_found").id, {
      value: "Ferro fundido",
    });
    progress = (await loadOrderProgress(orderId))!;
    expect(progress.stages.find((s) => s.key === "INSPECTION")!.status).toBe(
      "blocked",
    );
    const open = await listOpenReviews(orderId);
    expect(open.map((r) => r.rule)).toContain("inspection.material");
    const result = await latestInspectionResult(orderId);
    expect(result!.result).toBe("DIVERGENT");

    // Peso dentro da tolerância não abre item novo.
    await submitRequirement(supplierA, req("weight_measured").id, {
      value: "2.42",
    });
    expect((await listOpenReviews(orderId)).map((r) => r.rule)).not.toContain(
      "inspection.netWeightKg",
    );

    // Wellmix aprova a revisão: itens resolvidos, etapa liberada; um único requisito de revisão.
    progress = (await loadOrderProgress(orderId))!;
    const reviews = progress.requirements.filter(
      (r) => r.stageId === inspection.id && r.key === "inspection_review",
    );
    expect(reviews).toHaveLength(1);
    await decideRequirement(
      admin,
      reviews[0].id,
      "approve",
      "Aceito o material.",
    );
    expect(await listOpenReviews(orderId)).toHaveLength(0);
    progress = (await loadOrderProgress(orderId))!;
    expect(
      progress.stages.find((s) => s.key === "INSPECTION")!.status,
    ).not.toBe("blocked");
  });
});

describe("container", () => {
  it("usa a capacidade do tipo, deriva caixas do produto e respeita a regra de cliente", async () => {
    const container = await createContainer(admin, {
      code: "MSKU123",
      type: "40HC",
    });
    expect(container.capacityCbm).toBe(68);
    const [item] = await getStore().list("order_items", {
      filter: { orderId },
    });
    const added = await addContainerItem(admin, container.id, {
      orderId,
      orderItemId: item.id,
      quantity: 400,
    });
    expect(added.unitsPerBox).toBe(4);
    expect(added.boxCount).toBe(100);
    expect(added.cbmPerBox).toBeCloseTo(0.0833, 3);
    const view = (await loadContainer(container.id))!;
    expect(view.container.customerId).toBe("cliente-joao");
    expect(view.usage.totalCbm).toBeCloseTo(8.33, 1);
    expect(view.split.soldPercent).toBe(100);
    // Estoque próprio no mesmo container: parte disponível.
    await addContainerItem(admin, container.id, {
      productId: "prod-jarra",
      name: "Jarra",
      quantity: 100,
      unitsPerBox: 10,
      cbmPerBox: 0.05,
    });
    const after = (await loadContainer(container.id))!;
    expect(after.split.availableCbm).toBeCloseTo(0.5, 3);
    expect(after.split.soldPercent).toBeLessThan(100);
  });
});

describe("importação: mapeamento e normalização", () => {
  it("sugere campos por cabeçalhos em chinês e normaliza números e moeda", () => {
    const headers = [
      "产品名称",
      "供应商",
      "单价",
      "起订量",
      "材质",
      "外箱装量",
      "净重(kg)",
      "长(cm)",
      "备注",
    ];
    const mapping = suggestMapping(headers, "products");
    expect(mapping["产品名称"]).toBe("name");
    expect(mapping["供应商"]).toBe("supplier");
    expect(mapping["单价"]).toBe("price");
    expect(mapping["起订量"]).toBe("moq");
    expect(mapping["材质"]).toBe("material");
    expect(mapping["外箱装量"]).toBe("masterBoxQty");
    expect(mapping["净重(kg)"]).toBe("netWeightKg");
    expect(mapping["长(cm)"]).toBe("lengthCm");
    expect(mapping["备注"]).toBe("notes");
    const row = normalizeRow(
      { 产品名称: "Caneca", 单价: "¥12,50", 起订量: "1.000", 材质: "Cerâmica" },
      mapping,
      "products",
    );
    expect(row.fields.price).toBe(12.5);
    expect(row.fields.currency).toBe("CNY");
    expect(row.fields.moq).toBe(1000);
    expect(row.problems).toEqual([]);
    expect(parseNumber("US$ 2.35")).toBe(2.35);
    expect(normalizeRow({ 单价: "x" }, mapping, "products").problems).toContain(
      "missing:name",
    );
  });
});
