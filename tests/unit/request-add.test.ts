import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Wellmix acrescenta produtos a uma solicitação antes de virar pedido: entram
 * no mesmo lote, com o mesmo número, cliente e solicitante; cada um vira o
 * próprio pedido depois. Cliente não acrescenta; solicitação que virou pedido
 * ou cancelada não aceita.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

const item = (name: string) => ({
  productId: null,
  productName: name,
  description: name,
  specification: null,
  quantity: 500,
  unit: "un",
  sourcingDemand: false,
});

async function base(name: string) {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: name,
    description: name,
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
}

describe("adicionar produtos à solicitação", () => {
  it("solicitação sozinha vira lote; o novo produto tem o mesmo número, cliente e solicitante", async () => {
    const first = await base("Vaso grande");
    await r.openRfq(admin, first.id, ["fornecedor-a"]);
    const { groupId, created } = await r.addProductsToRequest(admin, first.id, [
      item("Vaso pequeno"),
      item("Prato"),
    ]);
    expect(created).toHaveLength(2);
    const store = getStore();
    const updated = (await store.get("requests", first.id))!;
    expect(updated.groupId).toBe(groupId);
    expect(updated.status).toBe("RFQ_OPEN");
    for (const c of created) {
      expect(c).toMatchObject({
        groupId,
        number: first.number,
        customerId: first.customerId,
        requestedForUserId: joao.id,
        status: "REQUESTED",
      });
    }
    // Acrescentar de novo reaproveita o mesmo lote.
    const again = await r.addProductsToRequest(admin, created[0].id, [
      item("Copo"),
    ]);
    expect(again.groupId).toBe(groupId);
    expect((await store.list("requests", { filter: { groupId } })).length).toBe(
      4,
    );
  });

  it("cliente não acrescenta; cancelada não aceita", async () => {
    const req = await base("Jarra");
    await expect(
      r.addProductsToRequest(joao, req.id, [item("Tampa")]),
    ).rejects.toThrow();
    expect(r.canAddProducts(joao, req)).toBe(false);
    await getStore().update("requests", req.id, { status: "CANCELLED" });
    const cancelled = (await getStore().get("requests", req.id))!;
    expect(r.canAddProducts(admin, cancelled)).toBe(false);
    await expect(
      r.addProductsToRequest(admin, req.id, [item("Tampa")]),
    ).rejects.toThrow("invalid_status");
  });
});
