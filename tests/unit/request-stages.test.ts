import { describe, expect, it } from "vitest";
import {
  DEFAULT_REQUEST_STEP_DAYS,
  requestStages,
  type RequestStagesInput,
} from "@/lib/request-stages";

/*
 * Etapas da solicitação (antes de virar pedido): em que etapa está, quem
 * responde, prazo em dias úteis e quando terminou. As etapas da RFQ e da
 * cotação saíram em 11/11/2026.
 */

const NOW = new Date("2026-11-11T15:00:00Z"); // quarta-feira, 11/11 (Brasília)

const base = (over: Partial<RequestStagesInput> = {}): RequestStagesInput =>
  ({
    status: "REQUESTED",
    createdAt: "2026-11-09T13:00:00.000Z", // segunda
    // Campos da cotação (saem com a RFQ): vazios.
    quotes: [],
    approval: null,
    selectedAt: null,
    dieline: null,
    proposalApprovedAt: null,
    downConfirmedAt: null,
    days: DEFAULT_REQUEST_STEP_DAYS,
    now: NOW,
    ...over,
  }) as RequestStagesInput;

const row = (input: RequestStagesInput, key: string) =>
  requestStages(input).find((r) => r.key === key)!;

describe("etapas da solicitação", () => {
  it("solicitação nova: a Wellmix responde em 1 dia útil (atrasada depois)", () => {
    const fresh = row(base(), "new");
    expect(fresh.state).toBe("active");
    expect(fresh.who).toBe("wellmix");
    expect(fresh.dueAt).toBe("2026-11-10");
    expect(fresh.late).toBe(true);
  });

  it("cancelada: nada fica atrasado", () => {
    const input = base({ status: "CANCELLED" });
    expect(requestStages(input).some((r) => r.late)).toBe(false);
  });
});
