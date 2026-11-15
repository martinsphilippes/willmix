import { describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Fase 5e (docs/MILESTONES.md): as leituras que ainda olhavam a etapa passam
 * a olhar os marcos. Onde o pedido está (`milestoneReached`, no lugar das
 * listas de situações antigas), prazo e trava pelos marcos (Control Tower) e
 * a trava da inspeção na linha do marco (`setMilestoneBlock`).
 */
withTempStore();

const {
  downPaymentStateOf,
  shipmentStepsOpen,
  compactMilestones,
  milestoneBlockedOf,
  milestoneDueOf,
  milestoneReached,
} = await import("@/lib/milestones");
const { blockedMilestones, setMilestoneBlock, milestoneBlockOf } =
  await import("@/lib/services/order-milestones");
const { getStore } = await import("@/lib/db");

describe("onde o pedido está pelos marcos", () => {
  const open = { status: "PREPARATION" };
  it("algum marco do ponto pedido em diante começou", () => {
    const rows = [
      { key: "new-order", status: "done" },
      { key: "pre-production", status: "active" },
    ];
    expect(milestoneReached(open, rows, "pre-production")).toBe(true);
    expect(milestoneReached(open, rows, "inspection")).toBe(false);
    // Visões calculadas: "aguardando" e "não se aplica" não contam.
    expect(
      milestoneReached(
        open,
        [
          { key: "inspection", state: "waiting" },
          { key: "samples", state: "na" },
        ],
        "inspection",
      ),
    ).toBe(false);
    expect(
      milestoneReached(
        open,
        [{ key: "samples", status: "blocked" }],
        "samples",
      ),
    ).toBe(true);
  });
  it("encerrado chegou a tudo; cancelado a nada; sem marcos, pela situação antiga", () => {
    expect(milestoneReached({ status: "CLOSED" }, [], "delivery")).toBe(true);
    expect(
      milestoneReached(
        { status: "CANCELLED" },
        [{ key: "delivery", status: "done" }],
        "new-order",
      ),
    ).toBe(false);
    expect(
      milestoneReached({ status: "INSPECTION" }, [], "pre-production"),
    ).toBe(true);
    expect(milestoneReached({ status: "INSPECTION" }, null, "samples")).toBe(
      false,
    );
    expect(milestoneReached({ status: "SHIPPING" }, [], "samples")).toBe(true);
  });
});

describe("prazo e trava pelos marcos (Control Tower)", () => {
  it("o prazo mais próximo dos marcos em andamento; trava pelo marco", () => {
    const m = compactMilestones(
      [
        {
          key: "art",
          block: "order",
          state: "active",
          waitingFor: null,
          total: 1,
          done: 0,
          percent: 0,
          subtasks: [],
          dueAt: "2026-11-20T00:00:00.000Z",
        },
        {
          key: "certification",
          block: "order",
          state: "active",
          waitingFor: null,
          total: 1,
          done: 0,
          percent: 0,
          subtasks: [],
          dueAt: "2026-11-18T00:00:00.000Z",
        },
      ],
      new Set(["art"]),
    );
    expect(m.find((x) => x.k === "art")?.b).toBe(1);
    expect(m.find((x) => x.k === "certification")?.b).toBeUndefined();
    expect(milestoneDueOf(m)).toBe("2026-11-18T00:00:00.000Z");
    expect(milestoneBlockedOf(m)).toBe(true);
    // Sem resumo: as linhas gravadas.
    expect(
      milestoneDueOf(null, [
        { status: "done", dueAt: "2026-11-01T00:00:00.000Z" },
        { status: "blocked", dueAt: "2026-11-19T00:00:00.000Z" },
      ]),
    ).toBe("2026-11-19T00:00:00.000Z");
    expect(milestoneBlockedOf(null, [{ status: "active" }])).toBe(false);
    // Sem nada: quem chama decide.
    expect(milestoneDueOf(null, null)).toBeUndefined();
    expect(milestoneBlockedOf(undefined, [])).toBeUndefined();
  });
});

describe("trava da inspeção na linha do marco", () => {
  it("trava com o motivo, destrava, e a sincronização lê a linha", async () => {
    const store = getStore();
    const orderId = "pedido-5e";
    await setMilestoneBlock(orderId, "inspection", "Peso divergente");
    expect(await milestoneBlockOf(orderId, "inspection")).toBe(
      "Peso divergente",
    );
    const rows = await store.list("order_milestones", { filter: { orderId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "blocked",
      startedAt: expect.any(String),
    });
    expect(blockedMilestones(rows)).toEqual(
      new Map([["inspection", "Peso divergente"]]),
    );
    await setMilestoneBlock(orderId, "inspection", null);
    expect(await milestoneBlockOf(orderId, "inspection")).toBeUndefined();
    expect(
      (await store.list("order_milestones", { filter: { orderId } }))[0],
    ).toMatchObject({ status: "active", blockReason: null });
  });
});

describe("passos do embarque e da origem (dono, 15/11/2026)", () => {
  const purchase = { status: "INSPECTION", flow: "supplier_request" };
  const contractDone = [
    { key: "contract", status: "done" },
    { key: "down-payment", status: "active" },
  ];
  it("contrato assinado e confirmado e, sem conta corrente, o sinal pago", () => {
    // Contrato ainda aberto: não abrem, nem com o sinal resolvido.
    expect(
      shipmentStepsOpen(
        purchase,
        [{ key: "contract", status: "active" }],
        "done",
      ),
    ).toBe(false);
    // Contrato concluído, sinal ainda por pagar (sem conta corrente): não.
    expect(shipmentStepsOpen(purchase, contractDone, "pending")).toBe(false);
    // Sinal pago, ou conta corrente (o item conclui sozinho): abrem, sem
    // esperar a aprovação da Diretoria de compras.
    expect(shipmentStepsOpen(purchase, contractDone, "done")).toBe(true);
    // Pedido clássico: só o contrato.
    expect(
      shipmentStepsOpen({ status: "INSPECTION" }, contractDone, "pending"),
    ).toBe(true);
    // Encerrado ou cancelado: não.
    expect(
      shipmentStepsOpen(
        { ...purchase, status: "CLOSED" },
        contractDone,
        "done",
      ),
    ).toBe(false);
    // Sem marcos gravados: pela situação antiga (Inspeção em diante).
    expect(shipmentStepsOpen(purchase, [], "pending")).toBe(true);
    expect(
      shipmentStepsOpen({ ...purchase, status: "PACKAGING" }, null, "done"),
    ).toBe(false);
  });
  it("estado do sinal pelo item down_payment", () => {
    expect(downPaymentStateOf([])).toBe("absent");
    expect(
      downPaymentStateOf([{ key: "down_payment", status: "pending" }]),
    ).toBe("pending");
    expect(downPaymentStateOf([{ key: "down_payment", status: "done" }])).toBe(
      "done",
    );
  });
});
