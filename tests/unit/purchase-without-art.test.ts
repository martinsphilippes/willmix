import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Decisão do dono (15/11/2026, docs/MILESTONES.md "Pedido de compra sem
 * arte"): a arte esperar o Material de arte inteiro vale só para o pedido de
 * produto novo (do Book). O pedido de compra da reposição ou da encomenda
 * ("Não tem arte") repete a arte já aprovada: não nascem os itens dos marcos
 * Material de arte e Arte, e o Contrato espera só Pedido novo e Certificação.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const purchase = await import("@/lib/services/purchase-order");
const { milestonesOf } = await import("@/lib/services/milestones");
const { baseKeyOf, LANE_KEYS } = await import("@/lib/purchase-lanes");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

const ART_BASES = [
  LANE_KEYS.dieCut,
  LANE_KEYS.hdPhoto,
  LANE_KEYS.moq,
  LANE_KEYS.leadTime,
  LANE_KEYS.art,
  LANE_KEYS.artReview,
  LANE_KEYS.artFinal,
] as string[];

async function directOrder(demandIds: string[]) {
  return purchase.createDirectPurchaseOrder(admin, {
    supplierId: "fornecedor-a",
    currency: "USD",
    incoterm: "FOB",
    leadTimeDays: 45,
    lines: [{ productId: "prod-panela", quantity: 1000, unitPrice: 3.5 }],
    demandIds,
    summary: "teste",
  });
}

const stateOf = (views: { key: string; state: string }[], key: string) =>
  views.find((v) => v.key === key)?.state;

describe("pedido de compra sem arte (reposição e encomenda)", () => {
  it("com demanda ligada: sem itens de Material de arte e Arte; Contrato espera só Pedido novo e Certificação", async () => {
    const demand = await requests.createRequest(joao, {
      customerId: "cliente-joao",
      productId: "prod-panela",
      productName: "prod-panela",
      description: "Encomenda",
      quantity: 1000,
      unit: "un",
    });
    const order = await directOrder([demand.id]);
    const reqs = await getStore().list("requirements", {
      filter: { orderId: order.id },
    });
    expect(reqs.some((r) => ART_BASES.includes(baseKeyOf(r.key)))).toBe(false);
    expect(reqs.some((r) => r.key === "approval_art_material")).toBe(false);
    // O cadastro continua.
    expect(reqs.some((r) => baseKeyOf(r.key) === LANE_KEYS.ncmValidated)).toBe(
      true,
    );
    const views = await milestonesOf(order);
    expect(stateOf(views, "art-material")).toBe("na");
    expect(stateOf(views, "art")).toBe("na");
    const contract = views.find((v) => v.key === "contract")!;
    expect(contract.state).toBe("waiting");
    expect(["new-order", "certification"]).toContain(contract.waitingFor);
  });

  it("do Book (sem demanda): a arte espera o Material de arte inteiro", async () => {
    const order = await directOrder([]);
    const reqs = await getStore().list("requirements", {
      filter: { orderId: order.id },
    });
    expect(reqs.some((r) => baseKeyOf(r.key) === LANE_KEYS.dieCut)).toBe(true);
    expect(reqs.some((r) => baseKeyOf(r.key) === LANE_KEYS.art)).toBe(true);
    expect(reqs.some((r) => r.key === "approval_art_material")).toBe(true);
    const views = await milestonesOf(order);
    expect(stateOf(views, "art-material")).toBe("active");
    const art = views.find((v) => v.key === "art")!;
    expect(art.state).toBe("waiting");
    expect(art.waitingFor).toBe("art-material");
  });
});
