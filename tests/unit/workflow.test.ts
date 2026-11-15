import { beforeAll, describe, expect, it } from "vitest";
import { groupItems, groupOf } from "./helpers/groups";
import {
  ORDER_DOCUMENT_KEYS,
  completeOrderDocument,
  withTempStore,
} from "./setup";

withTempStore();

const { getStore, DOCUMENT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const { completeMilestonesBefore } = await import("./helpers/milestones");
const { createRequest } = await import("@/lib/services/requests");
const { submitRequirement, decideRequirement, loadOrderProgress } =
  await import("@/lib/workflow/engine");
const { canViewOrder } = await import("@/lib/auth/permissions");
const { saveSheet } = await import("@/lib/services/purchase-sheet");
const { inspectionReport } = await import("@/lib/services/inspection-report");
type User = import("@/lib/db").User;

let users: Record<string, User> = {};

beforeAll(async () => {
  const seeded = await seedDemo();
  // O primeiro login de cada papel e empresa (o operador de compras, não o
  // de Vendas nem o da Diretoria de compras).
  users = Object.fromEntries(
    [...seeded.users]
      .reverse()
      .map((u) => [u.role + ":" + (u.partyId ?? ""), u]),
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
  // Fase 5g: o grupo de itens no lugar da etapa (helpers/groups.ts).
  const reqs = (await groupItems(orderId, stageKey)).filter(
    (r) => r.status === "pending" || r.status === "rejected",
  );
  for (const req of reqs) {
    if (!req.required || req.type === "approval") continue;
    // Documento do pedido: tem o caminho próprio (envio e assinaturas).
    if (ORDER_DOCUMENT_KEYS.includes(req.key)) continue;
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
      await submitRequirement(user, req.id, { value, signature: true });
    }
  }
  return groupOf(orderId, stageKey);
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

    const order = await orderFromRequest(operator, request, {
      price: 2.5,
      sellPrice: 25000,
    });
    expect(order.status).toBe("ORDER_CREATED");
    expect(order.erpSyncStatus).toBe("pending");
    expect(order.agencyId).toBe("agencia");

    // isolamento
    expect(canViewOrder(customer, order)).toBe(true);
    expect(canViewOrder(supplierA, order)).toBe(true);
    expect(canViewOrder(supplierB, order)).toBe(false);

    // fornecedor não pode confirmar pedido (etapa da Wellmix)
    const created = await groupOf(order.id, "ORDER_CREATED");
    const [confirm] = await groupItems(created.orderId, created.key).then((l) =>
      l.filter((r) =>
        ([] as string[]).concat("order_confirmed").includes(r.key),
      ),
    );
    await expect(
      submitRequirement(supplierA, confirm.id, { value: "ok" }),
    ).rejects.toThrow();

    await fillStage(operator, order.id, "ORDER_CREATED");
    expect((await store.get("orders", order.id))!.status).toBe("PREPARATION");

    // Peso declarado = peso líquido por peça da ficha de compra.
    await saveSheet(supplierA, order.id, { netWeightPcKg: 12 });
    await fillStage(supplierA, order.id, "PREPARATION");
    // A programação de compra é da Wellmix e vem antes de validar a ficha.
    await saveSheet(operator, order.id, {
      lots: [{ departureIntervalDays: 30, masterCartons: 10 }],
    } as never);
    // A Wellmix valida a ficha e o cadastro do produto (Fase B).
    const prep = await fillStage(operator, order.id, "PREPARATION");
    expect(prep.status).toBe("done");
    // Pagamento ao fornecedor fora do fluxo: a etapa conclui sozinha, sem
    // itens, e o pedido vai direto para a embalagem.
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");
    // Fase 5g: o pedido novo não tem item do pagamento antigo.
    expect(await groupItems(order.id, "SUPPLIER_PAYMENT")).toEqual([]);

    // embalagem: a agência faz e envia a arte; o fornecedor confere e aprova
    const agency = by("agency", "agencia");
    const pack = await groupOf(order.id, "PACKAGING");
    expect((await groupOf(pack.orderId, pack.key)).status).toBe("active");
    const [approval] = await groupItems(pack.orderId, pack.key).then((l) =>
      l.filter((r) => ([] as string[]).concat("art_approval").includes(r.key)),
    );
    const [art] = await groupItems(pack.orderId, pack.key).then((l) =>
      l.filter((r) => ([] as string[]).concat("art").includes(r.key)),
    );
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
    // Arte aprovada: a etapa ainda espera o documento do pedido (ordem nova:
    // selo na arte, "Enviar para assinatura", Wellmix e fornecedor assinam).
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");
    // Assinar pela Wellmix é das diretorias (padrão das funções, decisão do
    // dono de 13/11/2026): o operador de compras e planejamento não assina.
    const { can } = await import("@/lib/auth/function-access");
    expect(can(operator, "contract.sign")).toBe(false);
    await completeOrderDocument(by("admin"), order.id);
    expect((await store.get("orders", order.id))!.status).toBe("INSPECTION");

    // inspeção com peso divergente bloqueia
    await fillStage(supplierA, order.id, "INSPECTION", {
      weight_measured: "15",
    });
    const insp = await groupOf(order.id, "INSPECTION");
    expect((await groupOf(insp.orderId, insp.key)).status).toBe("blocked");
    const [review] = await groupItems(insp.orderId, insp.key).then((l) =>
      l.filter((r) =>
        ([] as string[]).concat("inspection_review").includes(r.key),
      ),
    );
    expect(review.status).toBe("pending");

    // reprovação pede nova medição: medida e foto na balança voltam ao fornecedor
    await decideRequirement(operator, review.id, "reject", "Pesar de novo");
    const reopened = await groupItems(insp.orderId, insp.key).then((l) =>
      l.filter((r) =>
        ([] as string[])
          .concat(["weight_measured", "photo_scale"])
          .includes(r.key),
      ),
    );
    expect(reopened.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect((await groupOf(insp.orderId, insp.key)).status).toBe("active");
    // nova medição ainda divergente bloqueia de novo e reabre a revisão
    await fillStage(supplierA, order.id, "INSPECTION", {
      weight_measured: "15",
    });
    expect((await groupOf(insp.orderId, insp.key)).status).toBe("blocked");
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
    // Fase 5e: a conclusão é a do marco Inspeção (a linha gravada).
    expect(report.milestone.status).toBe("done");

    // Fase 5d: o Embarque libera pelos marcos Booking e Carregamento (os
    // passos do embarque feitos).
    await expect(
      fillStage(by("shipping_line", "armador"), order.id, "SHIPPING"),
    ).rejects.toThrow("stage_not_active");
    await completeMilestonesBefore(order.id, "shipment", { stepsOnly: true });
    // Datas em ordem: chegada nunca antes do embarque (nos dois sentidos).
    {
      const armador = by("shipping_line", "armador");
      const shipping = await groupOf(order.id, "SHIPPING");
      const reqs = await groupItems(shipping.orderId, shipping.key);
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
    // Fase 5g: a situação gravada vem do marco atual; o Desembaraço segue
    // em andamento até os passos dele (presença de carga, canal, DI...).
    expect((await store.get("orders", order.id))!.status).toBe("CUSTOMS");
    // Fase 5d: transporte e entrega esperam os passos do desembaraço e a NF.
    await completeMilestonesBefore(order.id, "delivery", { stepsOnly: true });
    expect((await store.get("orders", order.id))!.status).toBe("TRANSPORT");
    // Entrega antes da chegada do navio: recusada.
    {
      const transport = await groupOf(order.id, "TRANSPORT");
      const delivery = (
        await groupItems(transport.orderId, transport.key)
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

    // Fase 5g: encerrado pelo último marco, com os itens obrigatórios feitos
    // e os 16 marcos concluídos (ou sem aplicação).
    const progress = (await loadOrderProgress(order.id))!;
    expect(
      progress.requirements
        .filter((r) => r.required)
        .every((r) => r.status === "done"),
    ).toBe(true);
    const { milestonesOf } = await import("@/lib/services/milestones");
    expect(
      (await milestonesOf(final)).every(
        (v) => v.state === "done" || v.state === "na",
      ),
    ).toBe(true);
    const audit = await store.list("audit_log");
    expect(audit.length).toBeGreaterThan(20);
  });
});
