import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Agência de arte por linha de produto (dono, 13/11/2026): o pedido herda a
 * agência da linha; ao salvar a agência na linha, os pedidos abertos dela sem
 * agência a recebem.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const la = await import("@/lib/services/line-agency");
const { assignDefaultPartners } = await import("@/lib/services/requests");

let lineId: string;
let agencyId: string;

/** Pedido mínimo da linha (o memory store aceita as colunas que faltam). */
const makeOrder = (over: Record<string, unknown>) =>
  getStore().create("orders", {
    number: Math.floor(Math.random() * 1e6),
    requestId: "req-x",
    customerId: "cliente-joao",
    supplierId: "fornecedor-a",
    status: "PACKAGING",
    currentStageId: null,
    agencyId: null,
    brokerId: null,
    ocpId: null,
    ...over,
  } as never);

beforeAll(async () => {
  await seedDemo();
  const store = getStore();
  const [line] = await store.list("product_lines");
  lineId = line.id;
  const agency = await store.create("parties", {
    type: "agency",
    name: "Agência da Linha",
    active: true,
  } as never);
  agencyId = agency.id;
});

describe("agência da linha", () => {
  it("sem agência na linha: nada muda", async () => {
    expect(await la.lineAgencyOf(lineId)).toBeNull();
    expect(await la.applyLineAgency(lineId)).toBe(0);
  });

  it("pedidos abertos da linha sem agência a recebem; os outros ficam como estão", async () => {
    const store = getStore();
    const open = await makeOrder({ lineId });
    const other = await makeOrder({ lineId, agencyId: "outra-agencia" });
    const closed = await makeOrder({ lineId, status: "CLOSED" });
    await store.update("product_lines", lineId, { agencyId });
    expect(await la.lineAgencyOf(lineId)).toBe(agencyId);
    expect(await la.applyLineAgency(lineId)).toBeGreaterThanOrEqual(1);
    expect((await store.get("orders", open.id))!.agencyId).toBe(agencyId);
    expect((await store.get("orders", other.id))!.agencyId).toBe(
      "outra-agencia",
    );
    expect((await store.get("orders", closed.id))!.agencyId).toBeNull();
  });

  it("pedido novo herda a agência da linha antes da regra da única agência ativa", async () => {
    const store = getStore();
    const order = await makeOrder({ lineId, status: "ORDER_CREATED" });
    await assignDefaultPartners(order);
    expect((await store.get("orders", order.id))!.agencyId).toBe(agencyId);
  });

  it("agência inativa não vale", async () => {
    await getStore().update("parties", agencyId, { active: false });
    expect(await la.lineAgencyOf(lineId)).toBeNull();
    await getStore().update("parties", agencyId, { active: true });
  });
});
