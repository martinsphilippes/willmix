import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Embarque mais simples: data de embarque, previsão de chegada, navio e BL
 * são opcionais; "Embarque confirmado" conclui a etapa. Pedidos de antes
 * (com os três obrigatórios) passam para o mesmo modelo sozinhos.
 */
withTempStore();

const { getStore, ORDER_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createStagesForOrder, submitRequirement } =
  await import("@/lib/workflow/engine");
const { normalizeShipping } = await import("@/lib/services/shipping-stage");
const { paymentEventsFor } = await import("@/lib/supplier-terms");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let armador: User;
let operator: User;
let number = 9000;

beforeAll(async () => {
  const { users } = await seedDemo();
  armador = users.find((u) => u.email === "armador@maritima.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
});

/** Pedido com as etapas criadas e o Embarque aberto (as anteriores concluídas). */
async function orderAtShipping(shippingLineId: string | null = "armador") {
  const store = getStore();
  const order = (await store.create("orders", {
    ...ORDER_EXTRA_DEFAULTS,
    number: ++number,
    requestId: "req-x",
    customerId: "cliente-joao",
    supplierId: "fornecedor-a",
    lineId: null,
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
    shippingLineId,
    carrierId: null,
    closedAt: null,
    notes: null,
  } as never)) as Order;
  await createStagesForOrder(order);
  const stages = await store.list("stages", { filter: { orderId: order.id } });
  const shipping = stages.find((s) => s.key === "SHIPPING")!;
  for (const s of stages)
    await store.update("stages", s.id, {
      status:
        s.sequence < shipping.sequence
          ? "done"
          : s.id === shipping.id
            ? "active"
            : "pending",
    });
  await store.update("orders", order.id, {
    status: "SHIPPING",
    currentStageId: shipping.id,
  });
  return { order, shipping };
}

const reqsOf = (stageId: string) =>
  getStore().list("requirements", { filter: { stageId } });

describe("Embarque: dados opcionais, confirmar avança", () => {
  it("pedido novo: data, chegada, navio e BL opcionais; 'Embarque confirmado' obrigatório", async () => {
    const { shipping } = await orderAtShipping();
    const reqs = await reqsOf(shipping.id);
    expect(reqs.map((r) => [r.key, r.type, r.required, r.role])).toEqual([
      ["ship_date", "date", false, "shipping_line"],
      ["eta", "date", false, "shipping_line"],
      ["vessel", "text", false, "shipping_line"],
      ["bl", "file", false, "shipping_line"],
      ["shipped", "confirm", true, "shipping_line"],
    ]);
  });

  it("avança só com a confirmação, sem preencher nada; o pagamento usa o dia da conclusão", async () => {
    const store = getStore();
    const { order, shipping } = await orderAtShipping();
    const shipped = (await reqsOf(shipping.id)).find(
      (r) => r.key === "shipped",
    )!;
    await submitRequirement(armador, shipped.id, { value: "confirmed" });
    const done = (await store.get("stages", shipping.id))!;
    expect(done.status).toBe("done");
    expect((await store.get("orders", order.id))!.status).toBe("CUSTOMS");
    // Sem data de embarque, o marco do pagamento é o dia em que o embarque foi concluído.
    const events = paymentEventsFor(order, [done], await reqsOf(shipping.id));
    expect(events.shipped).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("com os dados preenchidos, as regras de data continuam", async () => {
    const { shipping } = await orderAtShipping();
    const reqs = await reqsOf(shipping.id);
    const shipDate = reqs.find((r) => r.key === "ship_date")!;
    const eta = reqs.find((r) => r.key === "eta")!;
    await expect(
      submitRequirement(armador, eta.id, { value: "2026-10-20" }),
    ).rejects.toThrow("ship_date_first");
    await submitRequirement(armador, shipDate.id, { value: "2026-10-15" });
    await expect(
      submitRequirement(armador, eta.id, { value: "2026-10-10" }),
    ).rejects.toThrow("eta_before_ship_date");
    await submitRequirement(armador, eta.id, { value: "2026-10-30" });
    // Preencher os opcionais não conclui a etapa: falta confirmar.
    expect((await getStore().get("stages", shipping.id))!.status).toBe(
      "active",
    );
  });

  it("pedido antigo: os três ficam opcionais e ganha 'Embarque confirmado' (uma vez só)", async () => {
    const store = getStore();
    const { order, shipping } = await orderAtShipping();
    // Como era antes: data, chegada e BL obrigatórios, sem a confirmação.
    for (const r of await reqsOf(shipping.id)) {
      if (r.key === "shipped") await store.remove("requirements", r.id);
      else if (["ship_date", "eta", "bl"].includes(r.key))
        await store.update("requirements", r.id, { required: true });
    }
    // A data de embarque já tinha sido enviada.
    const shipDate = (await reqsOf(shipping.id)).find(
      (r) => r.key === "ship_date",
    )!;
    await submitRequirement(armador, shipDate.id, { value: "2026-10-15" });

    expect(await normalizeShipping(order.id)).toBe(1);
    const after = await reqsOf(shipping.id);
    expect(
      after
        .filter((r) => ["ship_date", "eta", "bl"].includes(r.key))
        .every((r) => !r.required),
    ).toBe(true);
    const shipped = after.filter((r) => r.key === "shipped");
    expect(shipped).toHaveLength(1);
    expect(shipped[0]).toMatchObject({
      type: "confirm",
      required: true,
      role: "shipping_line",
      status: "pending",
    });
    // O que já foi enviado continua.
    expect(after.find((r) => r.key === "ship_date")?.value).toBe("2026-10-15");
    // A etapa segue aberta, esperando a confirmação.
    expect((await store.get("stages", shipping.id))!.status).toBe("active");
    // De novo: nada muda.
    expect(await normalizeShipping(order.id)).toBe(0);
    expect(
      (await reqsOf(shipping.id)).filter((r) => r.key === "shipped"),
    ).toHaveLength(1);
    const audits = await store.list("audit_log", {
      filter: { action: "stage.shipping_optional", entityId: shipping.id },
    });
    expect(audits).toHaveLength(1);
    // Confirmar conclui.
    await submitRequirement(armador, shipped[0].id, { value: "confirmed" });
    expect((await store.get("orders", order.id))!.status).toBe("CUSTOMS");
  });

  it("pedido antigo sem companhia: a Wellmix confirma; etapa concluída ou pedido cancelado não mudam", async () => {
    const store = getStore();
    const { order, shipping } = await orderAtShipping(null);
    for (const r of await reqsOf(shipping.id))
      if (r.key === "shipped") await store.remove("requirements", r.id);
    // O job diário pega todos os abertos.
    expect(await normalizeShipping()).toBeGreaterThanOrEqual(1);
    const shipped = (await reqsOf(shipping.id)).find(
      (r) => r.key === "shipped",
    )!;
    expect(shipped.role).toBe("operator");
    await submitRequirement(operator, shipped.id, { value: "confirmed" });
    expect((await store.get("orders", order.id))!.status).toBe("CUSTOMS");

    const closed = await orderAtShipping();
    for (const r of await reqsOf(closed.shipping.id))
      if (r.key === "shipped") await store.remove("requirements", r.id);
    await store.update("stages", closed.shipping.id, { status: "done" });
    const cancelled = await orderAtShipping();
    for (const r of await reqsOf(cancelled.shipping.id))
      if (r.key === "shipped") await store.remove("requirements", r.id);
    await store.update("orders", cancelled.order.id, { status: "CANCELLED" });
    expect(await normalizeShipping(closed.order.id)).toBe(0);
    expect(await normalizeShipping(cancelled.order.id)).toBe(0);
    expect(
      (await reqsOf(closed.shipping.id)).some((r) => r.key === "shipped"),
    ).toBe(false);
  });
});
