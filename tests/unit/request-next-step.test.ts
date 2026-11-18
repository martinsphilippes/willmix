import { describe, expect, it } from "vitest";
import {
  nextStepText,
  nextStepWho,
  requestNextStep,
} from "@/lib/services/request-list";
import { translator } from "@/i18n";

const t = translator("pt");
describe("próximo passo da solicitação", () => {
  const base = {
    display: "ORDERED" as never,
    order: null,
    today: "2026-11-08",
  };
  it("pedido: etapa atual, quem responde e atraso; cancelado não tem passo", () => {
    const n = requestNextStep({
      ...base,
      status: "ORDERED",
      display: "ORDERED" as never,
      order: {
        status: "PREPARATION",
        responsibleRole: "supplier",
        dueAt: "2026-11-01T00:00:00.000Z",
      },
    });
    expect(n).toMatchObject({
      key: "order",
      who: "supplier",
      stage: "PREPARATION",
      late: true,
    });
    // Fase 4d: o marco da etapa atual (Preparação → 1. Pedido novo).
    expect(nextStepText(t, n)).toBe("Pedido em 1. Pedido novo");
    // De quem é a vez (docs/TURNS.md): o mesmo texto em todas as telas.
    expect(nextStepWho(t, n)).toBe("com o fornecedor");
    expect(
      requestNextStep({
        ...base,
        status: "ORDERED",
        display: "ORDER_CANCELLED" as never,
      }),
    ).toMatchObject({ key: "none", who: null });
    expect(
      nextStepText(
        t,
        requestNextStep({
          ...base,
          status: "ORDERED",
          display: "ORDERED" as never,
          order: { status: "CLOSED", responsibleRole: null, dueAt: null },
        }),
      ),
    ).toBe("Pedido encerrado");
  });

  it("fornecedor do tipo Trading: a vez aparece como Trading", () => {
    const n = requestNextStep({
      ...base,
      status: "ORDERED",
      display: "ORDERED" as never,
      order: {
        status: "INSPECTION",
        responsibleRole: "supplier",
        dueAt: null,
        trading: true,
      },
    });
    expect(n.who).toBe("trading");
    expect(nextStepWho(t, n)).toBe("com a Trading");
  });
});
