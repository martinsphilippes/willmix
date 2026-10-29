import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Fase G: auditoria só para admin e diretorias, com filtros; painéis por área
 * só para a Wellmix, com os números das fases anteriores.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const av = await import("@/lib/services/audit-view");
const dash = await import("@/lib/services/dashboards");
const pr = await import("@/lib/services/production");
const team = await import("@/lib/services/team");
const { audit } = await import("@/lib/services/audit");
const { setSetting } = await import("@/lib/settings");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let operator: User;
let director: User;
let joao: User;
let supplierA: User;
let order: Order;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  operator = by("operador@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  director = await getStore().create("users", {
    email: "dir@wellmix.com",
    name: "Diretora",
    role: "operator",
    partyId: null,
    locale: "pt",
    passwordHash: null,
    active: true,
    importerId: null,
  });
  await team.setTeamMember(admin, director.id, {
    jobLevel: null,
    managerUserId: null,
    division: null,
    functions: ["executive_director"],
  });
  director = (await getStore().get("users", director.id))!;
  await setSetting("approvalsEnabled", false);
  const req = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: "Jarra painel",
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

describe("auditoria", () => {
  it("só admin e diretorias", () => {
    expect(av.canSeeAudit(admin)).toBe(true);
    expect(av.canSeeAudit(director)).toBe(true);
    expect(av.canSeeAudit(operator)).toBe(false);
    expect(av.canSeeAudit(joao)).toBe(false);
  });

  it("filtra por pedido, módulo, pessoa e texto", async () => {
    await audit(operator, "production.plan", "order", order.id, "ETD teste X");
    await expect(av.searchAudit(operator, {})).rejects.toThrow();
    const byOrder = await av.searchAudit(admin, { orderNumber: order.number });
    expect(byOrder.total).toBeGreaterThan(0);
    expect(
      byOrder.rows.every(
        (e) => e.entityId === order.id || e.entityId === order.requestId,
      ),
    ).toBe(true);
    const byModule = await av.searchAudit(admin, { module: "production" });
    expect(byModule.rows.every((e) => e.action.startsWith("production"))).toBe(
      true,
    );
    const byUser = await av.searchAudit(admin, {
      userId: operator.id,
      text: "etd teste",
    });
    expect(byUser.total).toBe(1);
    expect(av.auditLink(byUser.rows[0])).toBe(`/app/orders/${order.id}`);
    const none = await av.searchAudit(admin, { orderNumber: 999999 });
    expect(none.total).toBe(0);
  });
});

describe("painéis por área", () => {
  it("só a Wellmix; todas as áreas calculam", async () => {
    await expect(dash.areaPanel(supplierA, "purchasing")).rejects.toThrow();
    for (const area of dash.DASHBOARD_AREAS) {
      const panel = await dash.areaPanel(operator, area);
      expect(panel.metrics.length).toBeGreaterThan(0);
    }
  });

  it("produção: atraso informado e follow vencido aparecem", async () => {
    await pr.savePlan(admin, order.id, {
      productionStartAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
      etd: "2026-12-01T12:00:00.000Z",
    });
    await pr.recordFollowup(admin, order.id, {
      day: 5,
      status: "delayed",
      note: "Falta resina",
    });
    const panel = await dash.areaPanel(operator, "production");
    const metric = (k: string) => panel.metrics.find((m) => m.key === k)!;
    expect(metric("delayed").value).toBe(1);
    expect(metric("followupsDue").value).toBe(1);
    expect(panel.attention.some((a) => a.id === order.id)).toBe(true);
  });
});
