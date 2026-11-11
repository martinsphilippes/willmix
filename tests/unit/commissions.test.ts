import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Comissões de ponta a ponta no serviço (docs/COMMISSIONS.md): acordo padrão
 * por linha e exceção individual com bônus; apuração única por pedido,
 * acordo e beneficiário (repetida e concorrente); liberação, aprovação,
 * liquidação parcial; nova versão pela vigência; cancelamento com estorno
 * ligado ao original; conflito bloqueia a ativação; só o administrador.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/commissions");
const { PARTY_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type Component = import("@/lib/commission").CommissionComponent;

let admin: User;
let operator: User;
let supplier: User;
let order: Order;
let carrierId: string;
let lineA: string;
let lineB: string;

const comp = (patch: Partial<Component>): Component => ({
  id: "",
  name: "Regra",
  kind: "percent",
  base: "items",
  rate: null,
  amount: null,
  lineIds: [],
  tiers: null,
  tierMode: "progressive",
  accumulate: false,
  successEvent: null,
  floor: null,
  cap: null,
  ...patch,
});

const input = (
  patch: Partial<import("@/lib/services/commissions").AgreementInput>,
) => ({
  name: "Acordo",
  category: "comissao",
  priority: 0,
  beneficiary: "",
  beneficiaryType: "",
  customers: [],
  suppliers: [],
  lineIds: [],
  validFrom: null,
  validTo: null,
  currency: "BRL",
  generateOn: "order_created",
  releaseOn: "delivered",
  releaseMode: "proportional",
  dueDays: 30,
  components: [],
  notes: null,
  ...patch,
});

const entries = async () =>
  (
    await getStore().list("commission_entries", {
      filter: { orderId: order.id },
    })
  ).sort((a, b) => a.key.localeCompare(b.key));
const totalOf = async () =>
  Math.round(
    (await entries())
      .filter((e) => e.status !== "reversed")
      .reduce((s, e) => s + e.amount, 0) * 100,
  ) / 100;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
  const store = getStore();
  const lines = await store.list("product_lines");
  [lineA, lineB] = [lines[0].id, lines[1].id];
  const products = await store.list("products");
  const pA = products.find((p) => p.lineId === lineA)!;
  const pB = products.find((p) => p.lineId === lineB)!;
  const carrier = await store.create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "carrier",
    name: "Transportes Comissão X",
    country: "BR",
    email: null,
    phone: null,
    taxId: null,
    notes: null,
    active: true,
  });
  carrierId = carrier.id;
  // Um pedido em R$ com dois itens: R$ 10.000 na linha A e R$ 5.000 na linha B.
  const parties = await store.list("parties");
  order = await store.create("orders", {
    number: 9001,
    requestId: "sem-solicitacao",
    customerId: parties.find((p) => p.type === "customer")!.id,
    supplierId: parties.find((p) => p.type === "supplier")!.id,
    lineId: lineA,
    status: "PREPARATION",
    currentStageId: null,
    fobTotal: 9000,
    fobCurrency: "BRL",
    sellPrice: 15000,
    sellCurrency: "BRL",
    erpSyncStatus: "pending",
    erpNumber: null,
    agencyId: null,
    brokerId: null,
    shippingLineId: null,
    carrierId,
    closedAt: null,
    notes: null,
    operationMode: null,
    requestedByUserId: null,
  } as never);
  await store.create("order_items", {
    orderId: order.id,
    productId: pA.id,
    name: "Jarra",
    quantity: 1000,
    unit: "un",
    unitPrice: 10,
  });
  await store.create("order_items", {
    orderId: order.id,
    productId: pB.id,
    name: "Caixa",
    quantity: 500,
    unit: "un",
    unitPrice: 10,
  });
});

describe("acordos", () => {
  it("só o administrador; rascunho valida beneficiário, regras e datas", async () => {
    for (const who of [operator, supplier]) {
      await expect(svc.listAgreements(who)).rejects.toThrow();
      await expect(
        svc.saveAgreementDraft(
          who,
          null,
          input({ beneficiaryType: "carrier" }),
        ),
      ).rejects.toThrow();
      await expect(svc.listEntries(who)).rejects.toThrow();
    }
    await expect(
      svc.saveAgreementDraft(
        admin,
        null,
        input({ beneficiaryType: "carrier" }),
      ),
    ).rejects.toThrow("commission_components_required");
    await expect(
      svc.saveAgreementDraft(
        admin,
        null,
        input({ components: [comp({ name: "2%", rate: 2 })] }),
      ),
    ).rejects.toThrow("commission_beneficiary_required");
    await expect(
      svc.saveAgreementDraft(
        admin,
        null,
        input({
          beneficiary: "ninguém com esse nome",
          components: [comp({ name: "2%", rate: 2 })],
        }),
      ),
    ).rejects.toThrow("commission_party_unknown");
  });

  it("cenários 1 a 3: padrão por linha (400), exceção individual (500) e bônus por sucesso (750)", async () => {
    const store = getStore();
    const padrao = await svc.saveAgreementDraft(
      admin,
      null,
      input({
        name: "Padrão transportadores",
        beneficiaryType: "carrier",
        components: [
          comp({ name: "Linha A 2%", rate: 2, lineIds: [lineA] }),
          comp({ name: "Linha B 4%", rate: 4, lineIds: [lineB] }),
        ],
      }),
    );
    expect(padrao).toMatchObject({ status: "draft", version: 1 });
    // Rascunho não apura; a simulação com o rascunho mostra o que viria.
    expect(await svc.accrueOrder(admin, order.id)).toMatchObject({
      created: 0,
    });
    const op = await svc.buildOperation(order);
    const sim = await svc.simulate(admin, op, padrao.id);
    expect(sim.entries[0]).toMatchObject({
      beneficiaryPartyId: carrierId,
      amount: 400,
    });
    expect(await entries()).toHaveLength(0);

    await svc.activateAgreement(admin, padrao.id);
    expect(await svc.accrueOrder(admin, order.id)).toMatchObject({
      created: 1,
    });
    expect(await totalOf()).toBe(400);
    // Repetir o evento, e dois ao mesmo tempo: uma apuração só.
    await svc.accrueOrder(admin, order.id);
    await Promise.all([
      svc.accrueOrder(null, order.id),
      svc.accrueOrder(null, order.id),
    ]);
    expect(await entries()).toHaveLength(1);

    // Exceção negociada com o transportador: linha A a 3% e bônus de 250 na entrega.
    const excecao = await svc.saveAgreementDraft(
      admin,
      null,
      input({
        name: "Negociado Transportes X",
        beneficiary: "Transportes Comissão X",
        components: [
          comp({ name: "Linha A 3%", rate: 3, lineIds: [lineA] }),
          comp({
            name: "Bônus por entrega",
            kind: "fixed",
            amount: 250,
            accumulate: true,
            successEvent: "delivered",
          }),
        ],
      }),
    );
    expect(excecao.beneficiaryPartyId).toBe(carrierId);
    await svc.activateAgreement(admin, excecao.id);
    await svc.accrueOrder(admin, order.id);
    expect(await totalOf()).toBe(500);
    expect((await entries()).every((e) => e.status === "estimated")).toBe(true);

    // Entregue: o bônus entra (750) e tudo fica elegível.
    const stages = await store.list("stages", {
      filter: { orderId: order.id },
    });
    const delivered = stages.find((s) => s.key === "DELIVERED");
    if (delivered)
      await store.update("stages", delivered.id, {
        completedAt: new Date().toISOString(),
      });
    else
      await store.create("stages", {
        orderId: order.id,
        key: "DELIVERED",
        sequence: 9,
        status: "done",
        responsibleRole: "carrier",
        responsiblePartyId: null,
        dueAt: null,
        startedAt: null,
        completedAt: new Date().toISOString(),
        percent: 100,
        reminderSentAt: null,
        blockReason: null,
      } as never);
    await svc.accrueOrder(admin, order.id);
    expect(await totalOf()).toBe(750);
    const now = await entries();
    expect(now).toHaveLength(2);
    expect(now.every((e) => e.status === "eligible" && e.dueAt)).toBe(true);
    // A memória de cálculo guarda as linhas e o que foi substituído.
    const memory = now.find((e) => e.amount === 550)!.memory as {
      lines: unknown[];
      replaced: Array<{ reason: string }>;
    };
    expect(memory.lines).toHaveLength(2);
    expect(memory.replaced[0].reason).toBe("individual");
  });

  it("conflito: outro padrão igual não ativa", async () => {
    const twin = await svc.saveAgreementDraft(
      admin,
      null,
      input({
        name: "Outro padrão",
        beneficiaryType: "carrier",
        components: [comp({ name: "Linha A 5%", rate: 5, lineIds: [lineA] })],
      }),
    );
    expect((await svc.agreementConflicts(twin)).length).toBe(1);
    await expect(svc.activateAgreement(admin, twin.id)).rejects.toThrow(
      "commission_conflict",
    );
  });
});

describe("aprovação, liquidação e ajustes", () => {
  it("4. aprova, liquida em parte (saldo fica) e depois o resto", async () => {
    const view = await svc.listEntries(admin);
    const big = view.find((v) => v.entry.amount === 550)!;
    const small = view.find((v) => v.entry.amount === 200)!;
    // Pagar antes de aprovar recusa.
    await expect(
      svc.settleEntries(admin, {
        allocations: [{ entryId: big.entry.id, amount: 100 }],
        paidAt: "2026-11-11",
        reference: null,
        note: null,
      }),
    ).rejects.toThrow("commission_entry_not_approved");
    await svc.approveEntries(admin, [big.entry.id, small.entry.id]);
    await expect(svc.approveEntries(admin, [big.entry.id])).rejects.toThrow(
      "commission_entry_not_eligible",
    );
    // Mais que o saldo recusa.
    await expect(
      svc.settleEntries(admin, {
        allocations: [{ entryId: big.entry.id, amount: 551 }],
        paidAt: "2026-11-11",
        reference: null,
        note: null,
      }),
    ).rejects.toThrow("commission_amount_over");
    const payment = await svc.settleEntries(admin, {
      allocations: [
        { entryId: big.entry.id, amount: 300 },
        { entryId: small.entry.id, amount: 200 },
      ],
      paidAt: "2026-11-11",
      reference: "PIX 123",
      note: null,
    });
    expect(payment).toMatchObject({ amount: 500, currency: "BRL" });
    const after = await svc.listEntries(admin);
    expect(after.find((v) => v.entry.id === big.entry.id)).toMatchObject({
      payable: 250,
      entry: { status: "partially_paid", paidAmount: 300 },
    });
    expect(after.find((v) => v.entry.id === small.entry.id)!.entry.status).toBe(
      "paid",
    );
    await svc.settleEntries(admin, {
      allocations: [{ entryId: big.entry.id, amount: 250 }],
      paidAt: "2026-11-12",
      reference: null,
      note: null,
    });
    expect((await entries()).every((e) => e.status === "paid")).toBe(true);
    expect((await svc.listPayments(admin)).map((p) => p.amount)).toEqual([
      250, 500,
    ]);
  });

  it("5. nova versão vale pela vigência e o cancelamento estorna sem apagar o que foi pago", async () => {
    const store = getStore();
    const padrao = (await svc.listAgreements(admin)).find(
      (a) => a.name === "Padrão transportadores",
    )!;
    // Versão 2 só a partir de 2099: o pedido de hoje continua na versão 1.
    const draft = await svc.newAgreementVersion(admin, padrao.id);
    expect(draft).toMatchObject({ version: 2, status: "draft" });
    const v2 = await svc.saveAgreementDraft(admin, draft.id, {
      ...input({
        name: "Padrão transportadores",
        beneficiaryType: "carrier",
        validFrom: "2099-01-01",
        components: [comp({ name: "Tudo 10%", rate: 10 })],
      }),
    });
    await svc.activateAgreement(admin, v2.id);
    const v1 = await store.get("commission_agreements", padrao.id);
    expect(v1).toMatchObject({ status: "active", validTo: "2098-12-31" });
    expect(await svc.accrueOrder(admin, order.id)).toMatchObject({
      created: 0,
      adjusted: 0,
    });

    // Pedido cancelado: os pagos ganham um estorno ligado ao original.
    await store.update("orders", order.id, { status: "CANCELLED" });
    const r = await svc.accrueOrder(admin, order.id);
    expect(r.adjusted).toBe(2);
    const all = await entries();
    const originals = all.filter((e) => e.kind === "accrual");
    const reversals = all.filter((e) => e.kind === "adjustment");
    expect(originals.every((e) => e.status === "paid")).toBe(true);
    expect(reversals.map((e) => e.amount).sort((a, b) => a - b)).toEqual([
      -550, -200,
    ]);
    expect(
      reversals.every((e) => originals.some((o) => o.id === e.originalEntryId)),
    ).toBe(true);
    // O total devido zera; os pagamentos antigos continuam registrados.
    expect(await totalOf()).toBe(0);
    expect(await svc.listPayments(admin)).toHaveLength(2);
    // Reapurar de novo não duplica o estorno.
    expect((await svc.accrueOrder(admin, order.id)).adjusted).toBe(0);
  });

  it("confirmação manual exige justificativa e fica na auditoria", async () => {
    await expect(svc.confirmManualEvent(admin, order.id, "ok")).rejects.toThrow(
      "commission_reason_required",
    );
    await expect(
      svc.confirmManualEvent(operator, order.id, "Laudo aprovado por e-mail"),
    ).rejects.toThrow();
    await svc.confirmManualEvent(admin, order.id, "Laudo aprovado por e-mail");
    const audits = await getStore().list("audit_log", {
      filter: { action: "commission.manual_event" },
    });
    expect(audits).toHaveLength(1);
  });
});
