import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Entrega (docs/DELIVERY.md; dono, 14/11/2026): canal cinza ou vermelho pausa
 * o pedido e alerta os administradores; só o admin retoma. Porto de chegada
 * decide a transportadora padrão (Itapoá → West Log; demais → Edual). A NF
 * da mercadoria nacionalizada (DANFE) é do financeiro.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const f = await import("@/lib/services/import-flow");
const d = await import("@/lib/services/delivery");
const team = await import("@/lib/services/team");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let operator: User;
let finance: User;
let comex: User;
let order: Order;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  operator = by("operador@wellmix.com");
  comex = by("comex@assessoria.com");
  const joao = by("joao@lojista.com");
  finance = await getStore().create("users", {
    email: "fin.entrega@wellmix.com",
    name: "Fê Financeiro",
    role: "operator",
    partyId: null,
    locale: "pt",
    passwordHash: null,
    active: true,
    importerId: null,
  });
  await team.setTeamMember(admin, finance.id, {
    jobLevel: null,
    managerUserId: null,
    division: null,
    functions: ["finance"],
  });
  finance = (await getStore().get("users", finance.id))!;
  const req = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: "Jarra entrega",
    description: "Jarra",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
  });
  order = await orderFromRequest(admin, req, { sellPrice: 1000 });
  order = await getStore().update("orders", order.id, {
    status: "CUSTOMS",
    comexId: comex.partyId,
  });
});

describe("entrega", () => {
  it("canal vermelho pausa o pedido, alerta os administradores e só o admin retoma", async () => {
    const store = getStore();
    await f.submitStep(comex, order.id, "channel", { value: "red" });
    let fresh = (await store.get("orders", order.id))!;
    expect(fresh.pausedAt).toBeTruthy();
    expect(fresh.pauseReason).toBe("channel_red");
    const alerts = await store.list("notifications", {
      filter: { userId: admin.id, channel: "inapp" },
    });
    expect(
      alerts.some(
        (n) => n.kind === "alert" && n.link === `/app/orders/${order.id}`,
      ),
    ).toBe(true);
    // Pausado: nada anda.
    await expect(
      f.submitStep(comex, order.id, "ce_mercante", { value: "CE-1" }),
    ).rejects.toThrow("order_paused");
    await expect(d.resumeOrder(operator, order.id, null)).rejects.toThrow();
    await d.resumeOrder(admin, order.id, "Liberado pela Receita");
    fresh = (await store.get("orders", order.id))!;
    expect(fresh.pausedAt).toBeNull();
    await f.submitStep(comex, order.id, "ce_mercante", { value: "CE-1" });
  });

  it("porto de chegada decide a transportadora padrão de Configurações", async () => {
    const store = getStore();
    const west = await store.create("parties", {
      type: "carrier",
      name: "West Log Transportes",
      active: true,
    } as never);
    await store.create("parties", {
      type: "carrier",
      name: "Edual",
      active: true,
    } as never);
    await d.setArrivalPort(admin, order.id, "IOA");
    let fresh = (await store.get("orders", order.id))!;
    let view = await d.deliveryView(fresh);
    expect(view.carrierName).toBe("West Log");
    expect(view.carrier?.id).toBe(west.id);
    expect(view.hired).toBe(false);
    await d.setArrivalPort(admin, order.id, "ITJ");
    fresh = (await store.get("orders", order.id))!;
    view = await d.deliveryView(fresh);
    expect(view.carrier?.name).toBe("Edual");
    await store.update("orders", order.id, { carrierId: view.carrier!.id });
    fresh = (await store.get("orders", order.id))!;
    expect((await d.deliveryView(fresh)).hired).toBe(true);
  });

  it("a NF da mercadoria nacionalizada (DANFE) é do financeiro", async () => {
    const steps = await f.importFlowView(finance, order);
    const danfe = steps.find((s) => s.template.key === "danfe")!;
    expect(danfe.template.actor).toBe("finance");
    expect(f.actsAs(operator, order, "finance")).toBe(false);
    expect(f.actsAs(finance, order, "finance")).toBe(true);
  });

  it("qualidade no CD: conclui a conferência; sem divergência armazena, com divergência pede observação", async () => {
    const store = getStore();
    const rec = await import("@/lib/services/receiving");
    await store.update("orders", order.id, { status: "DELIVERED" });
    // Sem ninguém com a ação, a Wellmix conclui; com a função Qualidade, só ela.
    expect(await rec.canDoQuality(operator)).toBe(true);
    let quality = await store.create("users", {
      email: "qualidade@wellmix.com",
      name: "Quézia Qualidade",
      role: "operator",
      partyId: null,
      locale: "pt",
      passwordHash: null,
      active: true,
      importerId: null,
    });
    await team.setTeamMember(admin, quality.id, {
      jobLevel: null,
      managerUserId: null,
      division: null,
      functions: ["quality"],
    });
    quality = (await store.get("users", quality.id))!;
    expect(await rec.canDoQuality(quality)).toBe(true);
    expect(await rec.canDoQuality(operator)).toBe(false);
    await rec.saveUnloading(admin, order.id, {
      sealNumber: "L-1",
      sealIntact: "yes",
      checklist: ["seal_matches", "container_ok"],
    });
    expect((await rec.qualityTasks(quality)).map((o) => o.id)).toContain(
      order.id,
    );
    await expect(rec.concludeQuality(quality, order.id, null)).rejects.toThrow(
      "quality_counts_required",
    );
    const [item] = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    await rec.saveCounts(admin, order.id, [
      { orderItemId: item.id, received: 98, damaged: 0, note: null },
    ]);
    await expect(rec.concludeQuality(quality, order.id, null)).rejects.toThrow(
      "quality_note_required",
    );
    await rec.saveCounts(admin, order.id, [
      { orderItemId: item.id, received: item.quantity, damaged: 0, note: null },
    ]);
    await expect(
      rec.concludeQuality(operator, order.id, null),
    ).rejects.toThrow();
    await rec.concludeQuality(quality, order.id, null);
    const row = (await rec.getReceiving(order.id))!;
    expect(row).toMatchObject({ qualityResult: "ok" });
    expect(row.storedAt).toBeTruthy();
    expect((await rec.qualityTasks(quality)).map((o) => o.id)).not.toContain(
      order.id,
    );
  });
});
