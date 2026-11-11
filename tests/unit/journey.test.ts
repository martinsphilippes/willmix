import { describe, expect, it } from "vitest";
import {
  JOURNEY_STEPS,
  journeyIndex,
  journeyPercent,
  type JourneyInput,
} from "@/lib/services/journey";
import { BOARD_CARDS } from "@/lib/services/tower-board";

/* Viagem do pedido: os passos e percentuais do Progresso de Pedidos. */

const NOW = new Date("2026-11-08T15:00:00Z");

const input = (over: Partial<JourneyInput> = {}): JourneyInput =>
  ({
    now: NOW,
    activeStages: [],
    stages: [],
    requirements: [],
    steps: [],
    reviews: [],
    ...over,
  }) as unknown as JourneyInput;

describe("passos e percentuais", () => {
  it("vai da solicitação nova (0%) ao encerrado (100%)", () => {
    expect(journeyPercent("reqNew")).toBe(0);
    expect(journeyPercent("ordCreated")).toBe(8);
    expect(journeyPercent("ordPrep")).toBe(17);
    expect(journeyPercent("ordContract")).toBe(25);
    expect(journeyPercent("ordInspection")).toBe(33);
    expect(journeyPercent("ordAtSea")).toBe(58);
    expect(journeyPercent("ordDelivered")).toBe(92);
    expect(journeyPercent("ordClosed")).toBe(100);
  });

  it("os passos do pedido são os quadrados da Control Tower (preparação e contrato têm um por origem)", () => {
    const keys = BOARD_CARDS.map((c) => c.key as string);
    const folded = ["ordCreated", "ordPrep", "ordContract", "ordClosed"];
    for (const step of JOURNEY_STEPS)
      if (step.startsWith("ord") && !folded.includes(step))
        expect(keys, step).toContain(step);
    expect(keys).toContain("ordPrepPortal");
    expect(keys).toContain("ordPrepSankhya");
    expect(keys).toContain("ordContractSankhya");
  });
});

describe("passo de cada pedido e solicitação", () => {
  const order = (id: string, status: string, cancelStageKey?: string) =>
    ({ id, status, cancelStageKey: cancelStageKey ?? null }) as never;

  it("encerrado no fim; cancelado mostra onde parou; inspeção com problema é o passo da inspeção", () => {
    const j = journeyIndex(
      input({
        activeStages: [{ orderId: "insp", status: "blocked" }],
        stages: [
          { id: "s-ship", orderId: "gone", key: "SHIPPING" },
          { id: "s-eta", orderId: "port", key: "SHIPPING" },
        ],
        requirements: [
          {
            orderId: "port",
            stageId: "s-eta",
            key: "eta",
            status: "done",
            value: "2026-11-05",
          },
        ],
        steps: [{ orderId: "gone", key: "booking", status: "validated" }],
      }),
    );
    expect(j.orderStep(order("done", "CLOSED"))).toBe("ordClosed");
    // Preparação, arte e certificação e o contrato são uma etapa cada (pedido de compra).
    expect(j.orderStep(order("prep", "PREPARATION"))).toBe("ordPrep");
    expect(j.orderStep(order("old", "SUPPLIER_PAYMENT"))).toBe("ordPrep");
    expect(j.orderStep(order("sign", "PACKAGING"))).toBe("ordContract");
    expect(j.orderStep(order("gone", "CANCELLED", "SHIPPING"))).toBe(
      "ordWaitingShip",
    );
    expect(j.orderStep(order("old", "CANCELLED"))).toBeNull();
    expect(j.orderStep(order("insp", "INSPECTION"))).toBe("ordInspection");
    expect(j.orderCard(order("insp", "INSPECTION"))).toBe("ordInspectionIssue");
    // Previsão de chegada (no Embarque) já passou: está no porto.
    expect(j.orderStep(order("port", "CUSTOMS"))).toBe("ordPort");
  });

  it("solicitação: o próximo passo da tela Solicitações; cancelada não tem passo", () => {
    const req = (id: string, status: string) => ({ id, status }) as never;
    const j = journeyIndex(input());
    expect(j.requestStep(req("new", "REQUESTED"))).toBe("reqNew");
    expect(j.requestStep(req("x", "CANCELLED"))).toBeNull();
  });
});
