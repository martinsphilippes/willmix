import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Respostas do dono (15/11/2026, docs/MILESTONES.md "Pedido de compra sem
 * arte"): a arte esperar o Material de arte inteiro vale só para o pedido de
 * produto novo (do Book). Na reposição e na encomenda (`orders.demandIds`):
 * - sem certificado novo (a linha não exige, ou a certificação válida cobre
 *   o período do pedido): nenhuma arte, nem a arte com o selo; Material de
 *   arte e Arte "não se aplica";
 * - com certificado novo: o marco Arte tem só a arte final, e a arte com o
 *   selo segue a certificação.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const purchase = await import("@/lib/services/purchase-order");
const { milestonesOf } = await import("@/lib/services/milestones");
const { baseKeyOf, LANE_KEYS } = await import("@/lib/purchase-lanes");
const { ordersWithoutSealArt } = await import("@/lib/services/import-flow");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

const ART_MATERIAL = [
  LANE_KEYS.dieCut,
  LANE_KEYS.hdPhoto,
  LANE_KEYS.moq,
  LANE_KEYS.leadTime,
] as string[];
const ART_ONLY = [LANE_KEYS.art, LANE_KEYS.artReview] as string[];

async function directOrder(productId: string, demandIds: string[]) {
  return purchase.createDirectPurchaseOrder(admin, {
    supplierId: "fornecedor-a",
    currency: "USD",
    incoterm: "FOB",
    leadTimeDays: 45,
    lines: [{ productId, quantity: 1000, unitPrice: 3.5 }],
    demandIds,
    summary: "teste",
  });
}

async function demandOrder(productId: string) {
  const demand = await requests.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: productId,
    description: "Encomenda",
    quantity: 5000,
    unit: "un",
  });
  return directOrder(productId, [demand.id]);
}

const view = (views: { key: string }[], key: string) =>
  views.find((v) => v.key === key) as Awaited<
    ReturnType<typeof milestonesOf>
  >[number];

const bases = async (orderId: string) =>
  (await getStore().list("requirements", { filter: { orderId } })).map((r) =>
    baseKeyOf(r.key),
  );

describe("reposição e encomenda sem certificado novo: nenhuma arte", () => {
  it("linha sem certificação: Material de arte e Arte não se aplicam; o Contrato espera Pedido novo", async () => {
    const order = await demandOrder("prod-panela");
    const keys = await bases(order.id);
    expect(keys.some((k) => ART_MATERIAL.includes(k))).toBe(false);
    expect(keys.some((k) => ART_ONLY.includes(k))).toBe(false);
    expect(keys).not.toContain(LANE_KEYS.artFinal);
    expect(keys).not.toContain("approval_art_material");
    expect(keys).toContain(LANE_KEYS.ncmValidated);
    const views = await milestonesOf(order);
    expect(view(views, "art-material").state).toBe("na");
    expect(view(views, "art").state).toBe("na");
    expect(view(views, "contract").state).toBe("waiting");
    expect(["new-order", "certification"]).toContain(
      view(views, "contract").waitingFor,
    );
  });

  it("linha com certificação e certificado válido pelo período: sem arte final e sem a arte com o selo", async () => {
    const order = await demandOrder("prod-boneca");
    const keys = await bases(order.id);
    expect(keys).toContain(LANE_KEYS.certificate);
    expect(keys).not.toContain(LANE_KEYS.artFinal);
    expect(keys.some((k) => ART_ONLY.includes(k))).toBe(false);
    const views = await milestonesOf(order);
    expect(view(views, "art").state).toBe("na");
    expect(view(views, "art-material").state).toBe("na");
    expect(
      view(views, "certification").subtasks.map((s) => s.key),
    ).not.toContain("cert_seal_art");
    expect((await ordersWithoutSealArt([order])).has(order.id)).toBe(true);
  });
});

describe("reposição e encomenda com certificado novo: só a arte final", () => {
  it("linha com certificação sem certificado válido: o marco Arte tem só a arte final; a arte com o selo segue a certificação", async () => {
    const order = await demandOrder("prod-piscina");
    const keys = await bases(order.id);
    expect(keys).toContain(LANE_KEYS.certificate);
    expect(keys).toContain(LANE_KEYS.artFinal);
    expect(keys.some((k) => ART_ONLY.includes(k))).toBe(false);
    expect(keys.some((k) => ART_MATERIAL.includes(k))).toBe(false);
    const views = await milestonesOf(order);
    expect(view(views, "art-material").state).toBe("na");
    expect(view(views, "art").subtasks.map((s) => baseKeyOf(s.key))).toEqual([
      LANE_KEYS.artFinal,
    ]);
    // A arte final não espera faca nem validação (não existem no pedido).
    expect(view(views, "art").state).toBe("active");
    expect(view(views, "certification").subtasks.map((s) => s.key)).toContain(
      "cert_seal_art",
    );
    expect((await ordersWithoutSealArt([order])).has(order.id)).toBe(false);
  });
});

describe("pedido do Book (sem demanda)", () => {
  it("a arte espera o Material de arte inteiro", async () => {
    const order = await directOrder("prod-panela", []);
    const keys = await bases(order.id);
    expect(keys).toContain(LANE_KEYS.dieCut);
    expect(keys).toContain(LANE_KEYS.art);
    expect(keys).toContain("approval_art_material");
    const views = await milestonesOf(order);
    expect(view(views, "art-material").state).toBe("active");
    expect(view(views, "art").state).toBe("waiting");
    expect(view(views, "art").waitingFor).toBe("art-material");
  });
});
