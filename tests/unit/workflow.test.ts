import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

withTempStore();

const { getStore, DOCUMENT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequest, openRfq, answerQuote, selectQuote, confirmDownPayment } =
  await import("@/lib/services/requests");
const { submitRequirement, decideRequirement, loadOrderProgress } =
  await import("@/lib/workflow/engine");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { canViewOrder } = await import("@/lib/auth/permissions");
const { saveSheet } = await import("@/lib/services/purchase-sheet");
const { inspectionReport } = await import("@/lib/services/inspection-report");
type User = import("@/lib/db").User;

let users: Record<string, User> = {};

beforeAll(async () => {
  const seeded = await seedDemo();
  users = Object.fromEntries(
    seeded.users.map((u) => [u.role + ":" + (u.partyId ?? ""), u]),
  );
});

const by = (role: string, party = "") => users[`${role}:${party}`];

async function fillStage(
  user: User,
  orderId: string,
  stageKey: string,
  values: Record<string, string> = {},
) {
  const store = getStore();
  const [stage] = await store.list("stages", {
    filter: { orderId, key: stageKey as never },
  });
  const reqs = await store.list("requirements", {
    filter: { stageId: stage.id, status: ["pending", "rejected"] },
  });
  for (const req of reqs) {
    if (!req.required || req.type === "approval") continue;
    // Cada um preenche o que é seu (a Wellmix preenche tudo).
    if (
      user.role !== "admin" &&
      user.role !== "operator" &&
      req.role !== user.role
    )
      continue;
    if (req.type === "file" || req.type === "photo") {
      const doc = await store.create("documents", {
        ...DOCUMENT_EXTRA_DEFAULTS,
        orderId,
        requestId: null,
        requirementId: req.id,
        type: "photo",
        name: `${req.key}.png`,
        mime: "image/png",
        size: 10,
        storageKey: "x",
        version: 1,
        previousDocumentId: null,
        uploadedByUserId: user.id,
        visibility: "all",
      });
      await submitRequirement(user, req.id, { documentId: doc.id });
    } else {
      const value =
        values[req.key] ??
        (req.type === "number"
          ? "10"
          : req.type === "date"
            ? "2026-10-01"
            : "ok");
      await submitRequirement(user, req.id, { value });
    }
  }
  return (await store.get("stages", stage.id))!;
}

describe("fluxo completo: solicitação → entrega", () => {
  it("atravessa todas as etapas com avanço automático", async () => {
    const store = getStore();
    const customer = by("customer", "cliente-joao");
    const operator = by("operator");
    const supplierA = by("supplier", "fornecedor-a");
    const supplierB = by("supplier", "fornecedor-b");

    const request = await createRequest(customer, {
      customerId: "cliente-joao",
      productId: "prod-jarra",
      productName: "Jarra de vidro 1,5 L",
      description: "Jarra com tampa",
      quantity: 1000,
      unit: "un",
    });
    expect(request.status).toBe("REQUESTED");

    await openRfq(operator, request.id, ["fornecedor-a", "fornecedor-b"]);
    expect(
      (await pendingTasksFor(supplierA)).some((t) => t.kind === "quote"),
    ).toBe(true);

    const [quoteA] = await store.list("quotes", {
      filter: { requestId: request.id, supplierId: "fornecedor-a" },
    });
    const [quoteB] = await store.list("quotes", {
      filter: { requestId: request.id, supplierId: "fornecedor-b" },
    });
    await answerQuote(supplierA, quoteA.id, {
      price: 2.5,
      currency: "USD",
      leadTimeDays: 30,
    });
    await answerQuote(supplierB, quoteB.id, {
      price: 2.8,
      currency: "USD",
      leadTimeDays: 25,
    });
    // fornecedor B não responde a cotação de A
    await expect(
      answerQuote(supplierB, quoteA.id, {
        price: 1,
        currency: "USD",
        leadTimeDays: 1,
      }),
    ).rejects.toThrow();

    await selectQuote(operator, quoteA.id, {
      sellPrice: 25000,
      sellCurrency: "BRL",
    });
    const updated = (await store.get("requests", request.id))!;
    expect(updated.status).toBe("WAITING_DOWN_PAYMENT");
    expect(updated.downPaymentAmount).toBe(7500);

    const order = await confirmDownPayment(operator, request.id);
    expect(order.status).toBe("ORDER_CREATED");
    expect(order.erpSyncStatus).toBe("pending");
    expect(order.agencyId).toBe("agencia");

    // isolamento
    expect(canViewOrder(customer, order)).toBe(true);
    expect(canViewOrder(supplierA, order)).toBe(true);
    expect(canViewOrder(supplierB, order)).toBe(false);

    // fornecedor não pode confirmar pedido (etapa da Wellmix)
    const [created] = await store.list("stages", {
      filter: { orderId: order.id, key: "ORDER_CREATED" },
    });
    const [confirm] = await store.list("requirements", {
      filter: { stageId: created.id, key: "order_confirmed" },
    });
    await expect(
      submitRequirement(supplierA, confirm.id, { value: "ok" }),
    ).rejects.toThrow();

    await fillStage(operator, order.id, "ORDER_CREATED");
    expect((await store.get("orders", order.id))!.status).toBe("PREPARATION");

    // Peso declarado = peso líquido por peça da ficha de compra.
    await saveSheet(supplierA, order.id, { netWeightPcKg: 12 });
    await fillStage(supplierA, order.id, "PREPARATION");
    // A Wellmix valida a ficha e o cadastro do produto (Fase B).
    const prep = await fillStage(operator, order.id, "PREPARATION");
    expect(prep.status).toBe("done");
    // Pagamento ao fornecedor fora do fluxo: a etapa conclui sozinha, sem
    // itens, e o pedido vai direto para a embalagem.
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");
    const [payStage] = await store.list("stages", {
      filter: { orderId: order.id, key: "SUPPLIER_PAYMENT" },
    });
    expect((await store.get("stages", payStage.id))!.status).toBe("done");
    expect(
      await store.list("requirements", { filter: { stageId: payStage.id } }),
    ).toEqual([]);

    // embalagem: a agência faz e envia a arte; o fornecedor confere e aprova
    const agency = by("agency", "agencia");
    const [pack] = await store.list("stages", {
      filter: { orderId: order.id, key: "PACKAGING" },
    });
    expect((await store.get("stages", pack.id))!.status).toBe("active");
    const [approval] = await store.list("requirements", {
      filter: { stageId: pack.id, key: "art_approval" },
    });
    const [art] = await store.list("requirements", {
      filter: { stageId: pack.id, key: "art" },
    });
    expect(art.role).toBe("agency");
    expect(approval.role).toBe("supplier");
    // Nada a aprovar antes de a arte chegar; o fornecedor não envia a arte.
    await expect(
      decideRequirement(supplierA, approval.id, "approve"),
    ).rejects.toThrow("art_missing");
    await expect(
      submitRequirement(supplierA, art.id, { documentId: "x" }),
    ).rejects.toThrow();
    await fillStage(agency, order.id, "PACKAGING");
    await decideRequirement(supplierA, approval.id, "reject", "Logo errado");
    expect((await store.get("requirements", art.id))!.status).toBe("rejected");
    await fillStage(agency, order.id, "PACKAGING");
    await decideRequirement(supplierA, approval.id, "approve");
    expect((await store.get("orders", order.id))!.status).toBe("INSPECTION");

    // inspeção com peso divergente bloqueia
    await fillStage(supplierA, order.id, "INSPECTION", {
      weight_measured: "15",
    });
    const [insp] = await store.list("stages", {
      filter: { orderId: order.id, key: "INSPECTION" },
    });
    expect((await store.get("stages", insp.id))!.status).toBe("blocked");
    const [review] = await store.list("requirements", {
      filter: { stageId: insp.id, key: "inspection_review" },
    });
    expect(review.status).toBe("pending");

    // reprovação pede nova medição: medida e foto na balança voltam ao fornecedor
    await decideRequirement(operator, review.id, "reject", "Pesar de novo");
    const reopened = await store.list("requirements", {
      filter: { stageId: insp.id, key: ["weight_measured", "photo_scale"] },
    });
    expect(reopened.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect((await store.get("stages", insp.id))!.status).toBe("active");
    // nova medição ainda divergente bloqueia de novo e reabre a revisão
    await fillStage(supplierA, order.id, "INSPECTION", {
      weight_measured: "15",
    });
    expect((await store.get("stages", insp.id))!.status).toBe("blocked");
    expect((await store.get("requirements", review.id))!.status).toBe(
      "pending",
    );
    await decideRequirement(operator, review.id, "reject");
    // nova medição dentro da tolerância libera e conclui sozinha
    await fillStage(supplierA, order.id, "INSPECTION", {
      weight_measured: "12.1",
    });
    expect((await store.get("requirements", review.id))!.status).toBe("done");
    expect((await store.get("orders", order.id))!.status).toBe("SHIPPING");

    // relatório da inspeção conta o que aconteceu
    const report = (await inspectionReport(order.id))!;
    expect(report.outcome).toBe("approved");
    const weight = report.rows.find((r) => r.attribute === "netWeightKg")!;
    expect(weight.comparison).toMatchObject({
      expected: 12,
      found: 12.1,
      ok: true,
    });
    expect(report.photos.length).toBeGreaterThanOrEqual(3);
    expect(report.reviews.length).toBeGreaterThan(0);
    expect(report.reviews.every((r) => r.status !== "open")).toBe(true);
    const actions = report.timeline.map((e) => e.action);
    expect(actions).toContain("inspection.divergence");
    expect(actions).toContain("inspection.remeasure_requested");
    expect(actions).toContain("stage.complete");

    // Datas em ordem: chegada nunca antes do embarque (nos dois sentidos).
    {
      const armador = by("shipping_line", "armador");
      const [shipping] = await store.list("stages", {
        filter: { orderId: order.id, key: "SHIPPING" as never },
      });
      const reqs = await store.list("requirements", {
        filter: { stageId: shipping.id },
      });
      const shipDate = reqs.find((r) => r.key === "ship_date")!;
      const eta = reqs.find((r) => r.key === "eta")!;
      // A chegada só depois do embarque informado (para ser conferida com ele).
      await expect(
        submitRequirement(armador, eta.id, { value: "2026-10-20" }),
      ).rejects.toThrow("ship_date_first");
      // Pedido de antes da regra: chegada (10/10) já enviada sem o embarque.
      // O embarque real (13/10) vale e a chegada volta a ser pedida.
      await store.update("requirements", eta.id, {
        status: "done",
        value: "2026-10-10",
      });
      await submitRequirement(armador, shipDate.id, { value: "2026-10-13" });
      const reopened = (await store.get("requirements", eta.id))!;
      expect(reopened.status).toBe("pending");
      expect(reopened.value).toBeNull();
      expect(reopened.note).toMatch(/Refazer/);
      await expect(
        submitRequirement(armador, eta.id, { value: "2026-10-05" }),
      ).rejects.toThrow("eta_before_ship_date");
      await expect(
        submitRequirement(armador, eta.id, { value: "13/10/2026" }),
      ).rejects.toThrow("date_invalid");
      await submitRequirement(armador, eta.id, { value: "2026-10-20" });
      await expect(
        submitRequirement(armador, shipDate.id, { value: "2026-10-25" }),
      ).rejects.toThrow("ship_date_after_eta");
    }
    await fillStage(by("shipping_line", "armador"), order.id, "SHIPPING");
    expect((await store.get("orders", order.id))!.status).toBe("CUSTOMS");
    await fillStage(by("broker", "despachante"), order.id, "CUSTOMS");
    expect((await store.get("orders", order.id))!.status).toBe("TRANSPORT");
    // Entrega antes da chegada do navio: recusada.
    {
      const [transport] = await store.list("stages", {
        filter: { orderId: order.id, key: "TRANSPORT" as never },
      });
      const delivery = (
        await store.list("requirements", { filter: { stageId: transport.id } })
      ).find((r) => r.key === "eta")!;
      await expect(
        submitRequirement(by("carrier", "transportador"), delivery.id, {
          value: "2026-10-15",
        }),
      ).rejects.toThrow("delivery_before_eta");
    }
    await fillStage(by("carrier", "transportador"), order.id, "TRANSPORT", {
      plate: "ABC1D23",
      eta: "2026-11-01",
    });
    expect((await store.get("orders", order.id))!.status).toBe("DELIVERED");
    await fillStage(customer, order.id, "DELIVERED");

    const final = (await store.get("orders", order.id))!;
    expect(final.status).toBe("CLOSED");
    expect(final.closedAt).not.toBeNull();

    const progress = (await loadOrderProgress(order.id))!;
    expect(progress.stages.every((s) => s.status === "done")).toBe(true);
    const audit = await store.list("audit_log");
    expect(audit.length).toBeGreaterThan(20);
  });
});
