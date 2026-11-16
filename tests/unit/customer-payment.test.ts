import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Forma de pagamento do cliente no pedido (dono, 15/11/2026;
 * docs/CUSTOMER_PAYMENT.md): formas configuráveis (parcelas, alçada, juros
 * depois da entrega), a escolha no pedido com o vendedor, a aprovação de
 * quem responde, as parcelas pelos eventos do pedido, os boletos lidos do
 * Sankhya (TGFFIN) e o aviso de "gerar o boleto" uma vez por parcela.
 */
withTempStore();
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { REQUEST_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
const { orderFromRequest } = await import("./helpers/order");
const cp = await import("@/lib/customer-payment");
const svc = await import("@/lib/services/customer-payment");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

const CUSTOMER = "cliente-joao";
let admin: User;
let operator: User;
let joao: User;

async function newOrder(sell: number | null = 10_000): Promise<Order> {
  const request = await getStore().create("requests", {
    ...REQUEST_EXTRA_DEFAULTS,
    customerId: CUSTOMER,
    createdByUserId: admin.id,
    productId: null,
    productName: "Jarra de vidro",
    description: "Jarra 1,5 L",
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    status: "ORDERED",
    orderId: null,
    sellPrice: null,
    sellCurrency: null,
    downPaymentAmount: null,
    notes: null,
    origin: "manual",
    requestedForUserId: joao.id,
  } as never);
  return orderFromRequest(admin, request, {
    sellPrice: sell,
    sellCurrency: "BRL",
  });
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
});

describe("a conta das parcelas", () => {
  it("a forma precisa somar 100%; alçada precisa de quem aprova", () => {
    const ok = {
      installments: [
        { percent: 10, event: "order" as const, days: 0 },
        { percent: 90, event: "shipment" as const, days: 0 },
      ],
      monthlyInterestPercent: null,
      requiresApproval: false,
      approverUserId: null,
    };
    expect(cp.planProblem(ok)).toBeNull();
    expect(
      cp.planProblem({
        ...ok,
        installments: [
          { percent: 10, event: "order", days: 0 },
          { percent: 80, event: "shipment", days: 0 },
        ],
      }),
    ).toBe("plan_total");
    expect(cp.planProblem({ ...ok, requiresApproval: true })).toBe(
      "plan_approver",
    );
    expect(cp.planProblem({ ...ok, monthlyInterestPercent: 30 })).toBe(
      "plan_interest",
    );
  });

  it("juros compostos ao mês só nas parcelas depois da entrega", () => {
    // 1.000 a 2% ao mês por 60 dias = 1.000 × 1,02² = 1.040,40.
    expect(cp.withInterest(1000, 2, 60)).toBe(1040.4);
    expect(cp.withInterest(1000, 2, 0)).toBe(1000);
    const rows = cp.customerSchedule({
      installments: [
        { percent: 20, event: "order", days: 0 },
        { percent: 0, event: "shipment", days: 0 },
        { percent: 50, event: "cargo_presence", days: 0 },
        { percent: 30, event: "delivery", days: 60 },
      ],
      monthlyInterestPercent: 2,
      sellTotal: 10_000,
      events: {
        order: "2026-11-01",
        shipment: "2026-12-01",
        cargo_presence: null,
        delivery: "2027-02-01",
      },
      charges: [
        {
          index: 1,
          source: "sankhya",
          nufin: "1",
          dueDate: "2026-11-05",
          amount: 2000,
          nossoNumero: "9",
          barcode: "0019...",
          documentId: null,
          status: "paid",
          paidAt: "2026-11-04",
          updatedAt: "2026-11-04",
        },
      ],
      today: "2027-02-10",
    });
    expect(rows.map((r) => r.state)).toEqual([
      "paid",
      "no_charge",
      "waiting_event",
      "to_issue",
    ]);
    expect(rows[3]).toMatchObject({
      base: 3000,
      amount: 3121.2,
      interest: 121.2,
      dueDate: "2027-04-02",
    });
    expect(rows[2].amount).toBe(5000);
  });

  it("títulos do Sankhya vão para as parcelas com valor, na ordem", () => {
    const charges = cp.chargesFromTitles(
      [
        { percent: 20, event: "order", days: 0 },
        { percent: 0, event: "shipment", days: 0 },
        { percent: 80, event: "cargo_presence", days: 0 },
      ],
      [
        {
          nufin: "10",
          dueDate: "2026-11-10",
          amount: 2000,
          nossoNumero: null,
          barcode: null,
          documentId: null,
          status: "open",
          paidAt: null,
        },
        {
          nufin: "11",
          dueDate: "2027-01-10",
          amount: 8000,
          nossoNumero: null,
          barcode: null,
          documentId: null,
          status: "open",
          paidAt: null,
        },
      ],
      "2026-11-15T00:00:00Z",
    );
    expect(charges.map((c) => [c.index, c.nufin])).toEqual([
      [1, "10"],
      [3, "11"],
    ]);
  });
});

describe("formas e escolha no pedido", () => {
  it("sem nenhuma gravada, as duas formas de partida", async () => {
    const plans = await svc.listPaymentPlans();
    expect(plans.map((p) => p.name)).toEqual([
      "10% no pedido; 90% no embarque",
      "20% no pedido; 0% no embarque; 80% na Presença de Carga",
    ]);
    expect(plans.every((p) => cp.planPercent(p.installments) === 100)).toBe(
      true,
    );
  });

  it("só o administrador configura; a forma é conferida", async () => {
    const input = {
      name: "30% no pedido; 70% em 60 dias após a entrega",
      installments: [
        { percent: 30, event: "order" as const, days: 0 },
        { percent: 70, event: "delivery" as const, days: 60 },
      ],
      requiresApproval: true,
      approverUserId: operator.id,
      monthlyInterestPercent: 1.5,
      active: true,
      sortOrder: 3,
    };
    await expect(svc.savePaymentPlan(operator, null, input)).rejects.toThrow();
    await expect(
      svc.savePaymentPlan(admin, null, {
        ...input,
        installments: [{ percent: 30, event: "order", days: 0 }],
      }),
    ).rejects.toThrow("plan_total");
    const saved = await svc.savePaymentPlan(admin, null, input);
    expect(saved).toMatchObject({ requiresApproval: true, sortOrder: 3 });
  });

  it("forma sem alçada vale na hora; com alçada espera quem responde", async () => {
    const plans = await svc.listPaymentPlans();
    const simple = plans.find((p) => !p.requiresApproval)!;
    const gated = plans.find((p) => p.requiresApproval)!;

    const a = await newOrder();
    const chosen = await svc.chooseOrderPaymentPlan(admin, a.id, {
      planId: simple.id,
      sellerUserId: operator.id,
      saleNunota: "1519042",
    });
    expect(chosen.paymentPlanStatus).toBe("approved");
    expect(chosen.sellerUserId).toBe(operator.id);

    const b = await newOrder();
    const pending = await svc.chooseOrderPaymentPlan(admin, b.id, {
      planId: gated.id,
      sellerUserId: null,
      saleNunota: null,
    });
    expect(pending.paymentPlanStatus).toBe("pending");
    const asked = await getStore().list("notifications", {
      filter: { userId: operator.id },
    });
    expect(asked.some((n) => n.link?.includes(b.id))).toBe(true);
    // O cliente não vê a forma em aprovação; vê a aprovada.
    expect(await svc.customerPaymentView(joao, pending)).toBeNull();
    // Quem não responde não decide; quem responde aprova.
    const outsider = { ...operator, id: "outro" } as User;
    await expect(
      svc.decideOrderPaymentPlan(outsider, b.id, true, null),
    ).rejects.toThrow();
    const approved = await svc.decideOrderPaymentPlan(
      operator,
      b.id,
      true,
      "ok",
    );
    expect(approved.paymentPlanStatus).toBe("approved");
    const view = await svc.customerPaymentView(joao, approved);
    expect(view?.installments).toHaveLength(2);
    expect(view?.installments[0]).toMatchObject({
      percent: 30,
      amount: 3000,
      state: "to_issue",
    });
    // 70% em 60 dias depois da entrega, 1,5% ao mês: 7.000 × 1,015².
    expect(view?.installments[1].amount).toBe(7211.58);
    expect(view?.canChoose).toBe(false);
  });

  it("o cliente e o login de fora não escolhem a forma", async () => {
    const plans = await svc.listPaymentPlans();
    const a = await newOrder();
    await expect(
      svc.chooseOrderPaymentPlan(joao, a.id, {
        planId: plans[0].id,
        sellerUserId: null,
        saleNunota: null,
      }),
    ).rejects.toThrow();
  });
});

describe("boletos e avisos", () => {
  const config = {
    baseUrl: "https://api.sankhya.com.br",
    clientId: "c",
    clientSecret: "s",
    xToken: "x",
  };

  it("busca os títulos do pedido de venda no Sankhya e liga às parcelas", async () => {
    const plans = await svc.listPaymentPlans();
    const plan = plans.find((p) => p.name.startsWith("20%"))!;
    const order = await newOrder();
    await svc.chooseOrderPaymentPlan(admin, order.id, {
      planId: plan.id,
      sellerUserId: operator.id,
      saleNunota: "1519042",
    });
    const sqls: string[] = [];
    const fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      if (String(input).endsWith("/authenticate"))
        return new Response(
          JSON.stringify({ access_token: "t", expires_in: 300 }),
        );
      sqls.push(JSON.parse(String(init.body)).requestBody.sql);
      return new Response(
        JSON.stringify({
          status: "1",
          responseBody: {
            fieldsMetadata: [
              "NUFIN",
              "DTVENC",
              "VLRDESDOB",
              "NOSSONUM",
              "LINHADIGITAVEL",
              "DHBAIXA",
            ].map((name) => ({ name })),
            rows: [
              [
                "501",
                "20112026 00:00:00",
                2000,
                "123",
                "00190.000",
                "19112026",
              ],
              ["502", "10012027 00:00:00", 8000, "124", "00190.111", null],
            ],
          },
        }),
      );
    }) as typeof globalThis.fetch;
    // Só o financeiro (o administrador aqui) busca.
    await expect(
      svc.syncSankhyaCharges(operator, order.id, { config, fetch }),
    ).rejects.toThrow();
    const result = await svc.syncSankhyaCharges(admin, order.id, {
      config,
      fetch,
    });
    expect(result.titles).toBe(2);
    expect(sqls[0]).toBe(
      "SELECT * FROM TGFFIN WHERE NUNOTA = 1519042 AND RECDESP = 1 ORDER BY DTVENC, DESDOBRAMENTO",
    );
    const saved = (await getStore().get("orders", order.id))!;
    expect(
      saved.customerCharges?.map((c) => [c.index, c.nufin, c.status]),
    ).toEqual([
      [1, "501", "paid"],
      [3, "502", "open"],
    ]);
    const view = await svc.customerPaymentView(joao, saved);
    expect(view?.installments.map((r) => r.state)).toEqual([
      "paid",
      "no_charge",
      "issued",
    ]);
    // Cobrar: o vendedor avisa o cliente da parcela em aberto.
    await svc.chargeCustomer(operator, order.id, 3);
    const toCustomer = await getStore().list("notifications", {
      filter: { userId: joao.id },
    });
    expect(toCustomer.some((n) => n.link?.includes(order.id))).toBe(true);
    await expect(svc.chargeCustomer(operator, order.id, 1)).rejects.toThrow(
      "charge_unavailable",
    );
  });

  it("parcela no momento sem boleto: avisa o financeiro uma vez", async () => {
    const plans = await svc.listPaymentPlans();
    const plan = plans.find((p) => p.name.startsWith("10%"))!;
    const order = await newOrder();
    await svc.chooseOrderPaymentPlan(admin, order.id, {
      planId: plan.id,
      sellerUserId: operator.id,
      saleNunota: null,
    });
    const before = (
      await getStore().list("notifications", { filter: { userId: admin.id } })
    ).filter((n) => n.link?.includes(order.id)).length;
    expect(await svc.notifyChargesToIssue()).toBeGreaterThan(0);
    const after = (
      await getStore().list("notifications", { filter: { userId: admin.id } })
    ).filter((n) => n.link?.includes(order.id)).length;
    expect(after).toBeGreaterThan(before);
    const again = (await getStore().get("orders", order.id))!;
    expect(Object.keys(again.chargeNotices ?? {})).toEqual(["1"]);
    // Rodar de novo não repete o aviso desta parcela.
    await svc.notifyChargesToIssue();
    const third = (
      await getStore().list("notifications", { filter: { userId: admin.id } })
    ).filter((n) => n.link?.includes(order.id)).length;
    expect(third).toBe(after);
  });

  it("com boleto registrado, a forma não muda", async () => {
    const plans = await svc.listPaymentPlans();
    const order = await newOrder();
    await svc.chooseOrderPaymentPlan(admin, order.id, {
      planId: plans[0].id,
      sellerUserId: null,
      saleNunota: null,
    });
    await svc.saveManualCharge(admin, order.id, 1, {
      dueDate: "2026-11-30",
      amount: 1000,
      nossoNumero: null,
      barcode: "23790.000",
      documentId: null,
      paid: false,
    });
    await expect(
      svc.chooseOrderPaymentPlan(admin, order.id, {
        planId: plans[1].id,
        sellerUserId: null,
        saleNunota: null,
      }),
    ).rejects.toThrow("plan_has_charges");
  });
});

describe("parcela em aberto trava o pedido (dono, 15/11/2026)", () => {
  it("vencida sem pagamento trava; o administrador destrava e ela não trava de novo", async () => {
    const plans = await svc.listPaymentPlans();
    const plan = plans.find((p) => p.name.startsWith("10%"))!;
    const order = await newOrder();
    // "10% no pedido" vence no dia em que a forma vale: trava na hora.
    await svc.chooseOrderPaymentPlan(admin, order.id, {
      planId: plan.id,
      sellerUserId: operator.id,
      saleNunota: null,
    });
    let saved = (await getStore().get("orders", order.id))!;
    expect(saved.pausedAt).toBeTruthy();
    expect(saved.pauseReason).toBe("payment_open");
    // Só o administrador destrava.
    const { resumeOrder } = await import("@/lib/services/delivery");
    await expect(resumeOrder(operator, order.id, null)).rejects.toThrow();
    await resumeOrder(admin, order.id, "cliente pagou por fora");
    saved = (await getStore().get("orders", order.id))!;
    expect(saved.pausedAt).toBeNull();
    expect(saved.customerPaymentPlan?.releases?.["1"]?.byUserId).toBe(admin.id);
    // A parcela liberada não trava de novo (o job roda todo dia).
    expect(await svc.applyPaymentHold(saved, null)).toBe("none");
    await svc.notifyChargesToIssue();
    expect((await getStore().get("orders", order.id))!.pausedAt).toBeNull();
  });

  it("o pagamento entra: a trava sai sozinha", async () => {
    const plans = await svc.listPaymentPlans();
    const plan = plans.find((p) => p.name.startsWith("10%"))!;
    const order = await newOrder();
    await svc.chooseOrderPaymentPlan(admin, order.id, {
      planId: plan.id,
      sellerUserId: null,
      saleNunota: null,
    });
    expect((await getStore().get("orders", order.id))!.pauseReason).toBe(
      "payment_open",
    );
    await svc.saveManualCharge(admin, order.id, 1, {
      dueDate: null,
      amount: 1000,
      nossoNumero: null,
      barcode: null,
      documentId: null,
      paid: true,
    });
    const saved = (await getStore().get("orders", order.id))!;
    expect(saved.pausedAt).toBeNull();
    expect(saved.pauseReason).toBeNull();
  });

  it("pedido pausado por outro motivo (canal) fica como está", async () => {
    const plans = await svc.listPaymentPlans();
    const order = await newOrder();
    await getStore().update("orders", order.id, {
      pausedAt: "2026-11-01T00:00:00Z",
      pauseReason: "channel_red",
    });
    await svc.chooseOrderPaymentPlan(admin, order.id, {
      planId: plans.find((p) => p.name.startsWith("10%"))!.id,
      sellerUserId: null,
      saleNunota: null,
    });
    expect((await getStore().get("orders", order.id))!.pauseReason).toBe(
      "channel_red",
    );
  });
});

describe("programação do pedido: produto sem quantidade numa data", () => {
  it("0 ou em branco vale na Nova solicitação; o total precisa ser maior que zero", async () => {
    const { parseRequestSchedule } =
      await import("@/lib/workflow/request-schedule");
    const form = (qty: string[]) => {
      const f = new FormData();
      f.set("p0.schedule.count", String(qty.length));
      f.set("p0.schedule.intervalDays", "45");
      f.set("p0.schedule.firstDate", "2027-03-15");
      qty.forEach((q, i) => f.set(`p0.schedule.qty.${i + 1}`, q));
      return f;
    };
    const s = parseRequestSchedule(form(["100", "0", ""]), "p0.", undefined, {
      allowZero: true,
    });
    expect(s?.items.map((i) => i.quantity)).toEqual([100, 0, 0]);
    expect(() =>
      parseRequestSchedule(form(["0", ""]), "p0.", undefined, {
        allowZero: true,
      }),
    ).toThrow("invalid_input");
    // Fora da Nova solicitação (Seleção, solicitação ao fornecedor): como antes.
    expect(() => parseRequestSchedule(form(["100", "0"]), "p0.")).toThrow(
      "invalid_input",
    );
  });
});

describe("busca diária dos boletos (dono, 15/11/2026)", () => {
  const config = {
    baseUrl: "https://api.sankhya.com.br",
    clientId: "c",
    clientSecret: "s",
    xToken: "x",
  };
  const fakeTitles = (paid: boolean) =>
    (async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/authenticate"))
        return new Response(
          JSON.stringify({ access_token: "t", expires_in: 300 }),
        );
      return new Response(
        JSON.stringify({
          status: "1",
          responseBody: {
            fieldsMetadata: ["NUFIN", "DTVENC", "VLRDESDOB", "DHBAIXA"].map(
              (name) => ({ name }),
            ),
            rows: [["901", "15112026", 1000, paid ? "15112026" : null]],
          },
        }),
      );
    }) as typeof globalThis.fetch;

  it("o título pago no Sankhya destrava o pedido sem ninguém clicar", async () => {
    const plans = await svc.listPaymentPlans();
    const order = await newOrder();
    await svc.chooseOrderPaymentPlan(admin, order.id, {
      planId: plans.find((p) => p.name.startsWith("10%"))!.id,
      sellerUserId: null,
      saleNunota: "1520001",
    });
    expect((await getStore().get("orders", order.id))!.pauseReason).toBe(
      "payment_open",
    );
    // Boleto emitido e ainda em aberto: o pedido segue travado.
    await svc.syncAllSankhyaCharges({ config, fetch: fakeTitles(false) });
    let saved = (await getStore().get("orders", order.id))!;
    expect(saved.customerCharges?.[0]).toMatchObject({
      nufin: "901",
      status: "open",
    });
    expect(saved.pauseReason).toBe("payment_open");
    // Baixa no Sankhya: a busca diária grava o pagamento e destrava.
    const result = await svc.syncAllSankhyaCharges({
      config,
      fetch: fakeTitles(true),
    });
    expect(result.skipped).toBeNull();
    saved = (await getStore().get("orders", order.id))!;
    expect(saved.customerCharges?.[0].status).toBe("paid");
    expect(saved.pausedAt).toBeNull();
  });

  it("sem o Sankhya configurado, não faz nada", async () => {
    expect(await svc.syncAllSankhyaCharges({ config: null })).toMatchObject({
      skipped: "sankhya_not_configured",
    });
  });
});

describe("dia do evento no fuso de Brasília (16/11/2026)", () => {
  it("forma aprovada às 22h30 de Brasília vence no mesmo dia de Brasília, não no dia UTC", async () => {
    const at = (iso: string) =>
      svc.paymentEventDates(
        { id: "sem-pedido", createdAt: "2026-11-15T12:00:00.000Z" } as never,
        {
          status: "approved",
          chosenAt: iso,
          decidedAt: iso,
        } as never,
      );
    // 22h30 em Brasília = 01h30 UTC do dia seguinte: o dia é 15/11.
    expect((await at("2026-11-16T01:30:00.000Z")).order).toBe("2026-11-15");
    // 12h em Brasília: o mesmo dia nos dois fusos.
    expect((await at("2026-11-15T15:00:00.000Z")).order).toBe("2026-11-15");
    // Depois da meia-noite de Brasília: já é 16/11.
    expect((await at("2026-11-16T03:30:00.000Z")).order).toBe("2026-11-16");
  });
});
