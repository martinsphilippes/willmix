import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Produção (Fase C): ETD com motivo e aviso na mudança, follow 5/15/25 dias,
 * inspeção agendada (trade precisa da fábrica) e inspeção por SKU com volta
 * ao fornecedor quando reprovado.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const pr = await import("@/lib/services/production");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { setSetting } = await import("@/lib/settings");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
/** Operador de demonstração: comprador e planner (recebe os alertas de ETD). */
let planner: User;
let joao: User;
let supplierA: User;
let supplierB: User;
let order: Order;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  planner = users.find((u) => u.email === "operador@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find(
    (u) => u.role === "supplier" && u.partyId !== supplierA.partyId,
  )!;
  await setSetting("approvalsEnabled", false);
  const req = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: "Jarra produção",
    description: "Jarra",
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, req.id, ["fornecedor-a"]);
  const [quote] = await getStore().list("quotes", {
    filter: { requestId: req.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 10_000,
    sellCurrency: "BRL",
  });
  order = await r.confirmDownPayment(admin, req.id);
});

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

describe("produção do pedido", () => {
  it("só a Wellmix e o fornecedor do pedido mexem", async () => {
    await expect(
      pr.savePlan(joao, order.id, { mode: "factory" }),
    ).rejects.toThrow();
    if (supplierB)
      await expect(
        pr.savePlan(supplierB, order.id, { mode: "factory" }),
      ).rejects.toThrow();
  });

  it("ETD: o primeiro sem motivo; mudar exige motivo, guarda o histórico e avisa a Wellmix", async () => {
    await pr.savePlan(supplierA, order.id, {
      mode: "factory",
      productionStartAt: daysAgo(16),
      etd: "2026-12-01T12:00:00.000Z",
    });
    await expect(
      pr.savePlan(supplierA, order.id, { etd: "2026-12-20T12:00:00.000Z" }),
    ).rejects.toThrow("etd_reason_required");
    // O alerta de ETD vai a quem tem a função planner/comprador (o operador de
    // demonstração), não mais aos admins por falta de alguém com a função.
    const before = await getStore().list("notifications", {
      filter: { userId: planner.id },
    });
    await pr.savePlan(supplierA, order.id, {
      etd: "2026-12-20T12:00:00.000Z",
      etdReason: "Falta de matéria-prima",
    });
    const track = (await pr.getTrack(order.id))!;
    expect(track.etd?.slice(0, 10)).toBe("2026-12-20");
    expect(track.etdOriginal?.slice(0, 10)).toBe("2026-12-01");
    expect(track.etdHistory).toHaveLength(2);
    const after = await getStore().list("notifications", {
      filter: { userId: planner.id },
    });
    expect(after.length).toBeGreaterThan(before.length);
  });

  it("follow: 5 e 15 dias vencidos viram pendência da Wellmix; atraso pede observação", async () => {
    const track = (await pr.getTrack(order.id))!;
    expect(pr.followupsDue(track).map((f) => f.day)).toEqual([5, 15]);
    const tasks = await pendingTasksFor(admin);
    expect(
      tasks.filter(
        (t) => t.kind === "production_follow" && t.link.includes(order.id),
      ),
    ).toHaveLength(2);
    await expect(
      pr.recordFollowup(supplierA, order.id, {
        day: 5,
        status: "on_track",
        note: null,
      }),
    ).rejects.toThrow();
    await expect(
      pr.recordFollowup(admin, order.id, {
        day: 15,
        status: "delayed",
        note: null,
      }),
    ).rejects.toThrow("note_required");
    await pr.recordFollowup(admin, order.id, {
      day: 5,
      status: "on_track",
      note: null,
    });
    await pr.recordFollowup(admin, order.id, {
      day: 15,
      status: "delayed",
      note: "Molde quebrou",
    });
    await expect(
      pr.recordFollowup(admin, order.id, {
        day: 5,
        status: "on_track",
        note: null,
      }),
    ).rejects.toThrow("followup_done");
    expect(pr.followupsDue((await pr.getTrack(order.id))!)).toEqual([]);
  });

  it("inspeção agendada: trade precisa do endereço da fábrica", async () => {
    await pr.savePlan(admin, order.id, { mode: "trade" });
    await expect(
      pr.scheduleInspection(admin, order.id, {
        at: "2026-11-25T12:00:00.000Z",
        note: null,
      }),
    ).rejects.toThrow("factory_required");
    await pr.savePlan(admin, order.id, {
      factoryName: "Ningbo Plastics",
      factoryAddress: "Ningbo, Zhejiang",
    });
    await pr.scheduleInspection(admin, order.id, {
      at: "2026-11-25T12:00:00.000Z",
      note: "Inspetor Li",
    });
    expect(
      (await pr.getTrack(order.id))!.inspectionScheduledAt?.slice(0, 10),
    ).toBe("2026-11-25");
  });

  it("SKU reprovado volta ao fornecedor; corrigido, a Wellmix inspeciona de novo", async () => {
    const [item] = await getStore().list("order_items", {
      filter: { orderId: order.id },
    });
    await expect(
      pr.inspectSku(admin, order.id, {
        orderItemId: item.id,
        result: "rejected",
        note: null,
      }),
    ).rejects.toThrow("note_required");
    const rejected = await pr.inspectSku(admin, order.id, {
      orderItemId: item.id,
      result: "rejected",
      note: "Cor fora do Pantone",
    });
    // Sem a correção, não há nova rodada.
    await expect(
      pr.inspectSku(admin, order.id, {
        orderItemId: item.id,
        result: "approved",
        note: null,
      }),
    ).rejects.toThrow("waiting_supplier");
    expect(
      (await pendingTasksFor(supplierA)).some(
        (t) => t.kind === "sku_fix" && t.link.includes(order.id),
      ),
    ).toBe(true);
    await pr.respondSku(supplierA, rejected.id, "Nova tinta aplicada");
    expect(
      (await pendingTasksFor(admin)).some(
        (t) => t.kind === "sku_inspection" && t.link.includes(order.id),
      ),
    ).toBe(true);
    const approved = await pr.inspectSku(admin, order.id, {
      orderItemId: item.id,
      result: "approved",
      note: null,
    });
    expect(approved.round).toBe(2);
    const view = await pr.productionView(order);
    expect(view.allApproved).toBe(true);
    await expect(
      pr.inspectSku(admin, order.id, {
        orderItemId: item.id,
        result: "rejected",
        note: "x",
      }),
    ).rejects.toThrow("already_approved");
  });
});
