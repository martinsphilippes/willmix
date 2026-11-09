import { describe, expect, it } from "vitest";
import {
  DEFAULT_REQUEST_STEP_DAYS,
  requestStages,
  requestStepDays,
  type RequestStagesInput,
} from "@/lib/request-stages";

/*
 * Etapas da solicitação (antes de virar pedido): em que etapa está, quem
 * responde, prazo em dias úteis e quando terminou. A faca corre ao lado,
 * depois da escolha do fornecedor.
 */

const NOW = new Date("2026-11-11T15:00:00Z"); // quarta-feira, 11/11 (Brasília)

const base = (over: Partial<RequestStagesInput> = {}): RequestStagesInput => ({
  status: "REQUESTED",
  createdAt: "2026-11-09T13:00:00.000Z", // segunda
  quotes: [],
  approval: null,
  selectedAt: null,
  dieline: null,
  proposalApprovedAt: null,
  downConfirmedAt: null,
  days: DEFAULT_REQUEST_STEP_DAYS,
  now: NOW,
  ...over,
});

const states = (input: RequestStagesInput) =>
  Object.fromEntries(requestStages(input).map((r) => [r.key, r.state]));
const row = (input: RequestStagesInput, key: string) =>
  requestStages(input).find((r) => r.key === key)!;

const quote = (createdAt: string, answeredAt: string | null = null) => ({
  createdAt,
  answeredAt,
  status: (answeredAt ? "answered" : "invited") as "answered" | "invited",
});

describe("etapas da solicitação", () => {
  it("solicitação nova: a Wellmix abre a RFQ em 1 dia útil (atrasada depois)", () => {
    const input = base();
    expect(states(input)).toMatchObject({
      new: "active",
      rfq: "pending",
      approval: "pending",
      dieline: "skipped",
      proposal: "pending",
      down: "pending",
    });
    const fresh = row(input, "new");
    expect(fresh.who).toBe("wellmix");
    expect(fresh.dueAt).toBe("2026-11-10");
    expect(fresh.late).toBe(true);
  });

  it("RFQ aberta: prazo de 3 dias úteis para os fornecedores; cotações chegando ficam em 'recebidas'", () => {
    const opened = "2026-11-10T12:00:00.000Z"; // terça
    const rfq = base({
      status: "RFQ_OPEN",
      quotes: [quote(opened), quote(opened)],
    });
    expect(states(rfq)).toMatchObject({
      new: "done",
      rfq: "active",
      quotes: "pending",
    });
    expect(row(rfq, "new").doneAt).toBe(opened);
    expect(row(rfq, "rfq").dueAt).toBe("2026-11-13");
    expect(row(rfq, "rfq").answered).toEqual({ done: 0, total: 2 });

    // 1 de 2 respondeu, ainda no prazo: espera a outra (comparação aguarda).
    const partial = base({
      status: "QUOTATION_RECEIVED",
      quotes: [quote(opened, "2026-11-11T10:00:00.000Z"), quote(opened)],
    });
    expect(states(partial)).toMatchObject({
      rfq: "done",
      quotes: "active",
      compare: "pending",
    });
    expect(row(partial, "quotes").answered).toEqual({ done: 1, total: 2 });

    // Todas responderam: comparação em andamento, prazo de 1 dia útil.
    const all = base({
      status: "QUOTATION_RECEIVED",
      quotes: [
        quote(opened, "2026-11-10T18:00:00.000Z"),
        quote(opened, "2026-11-11T10:00:00.000Z"),
      ],
    });
    expect(states(all)).toMatchObject({
      quotes: "done",
      compare: "active",
      priced: "pending",
    });
    expect(row(all, "quotes").doneAt).toBe("2026-11-11T10:00:00.000Z");
    expect(row(all, "compare").dueAt).toBe("2026-11-12");
  });

  it("prazo da RFQ vencido com uma cotação: segue para a comparação", () => {
    const opened = "2026-11-02T12:00:00.000Z";
    const input = base({
      status: "QUOTATION_RECEIVED",
      quotes: [quote(opened, "2026-11-03T12:00:00.000Z"), quote(opened)],
    });
    expect(states(input)).toMatchObject({
      quotes: "done",
      compare: "active",
    });
  });

  it("escolha com aprovação: valor calculado na escolha, aprovação com o nível da vez", () => {
    const opened = "2026-11-02T12:00:00.000Z";
    const input = base({
      status: "QUOTATION_RECEIVED",
      quotes: [quote(opened, "2026-11-03T12:00:00.000Z")],
      approval: {
        status: "pending",
        createdAt: "2026-11-10T12:00:00.000Z",
        decidedAt: null,
        levels: ["planner", "purchasing_director"],
        currentLevel: "purchasing_director",
      },
    });
    expect(states(input)).toMatchObject({
      compare: "done",
      priced: "done",
      approval: "active",
      proposal: "pending",
    });
    const approval = row(input, "approval");
    expect(approval.level).toBe("purchasing_director");
    // Um dia útil por nível: 2 níveis a partir de terça → quinta.
    expect(approval.dueAt).toBe("2026-11-12");
    expect(row(input, "priced").doneAt).toBe("2026-11-10T12:00:00.000Z");
  });

  it("aprovação reprovada devolve a escolha ao comprador", () => {
    const input = base({
      status: "QUOTATION_RECEIVED",
      quotes: [quote("2026-11-02T12:00:00.000Z", "2026-11-03T12:00:00.000Z")],
      approval: {
        status: "rejected",
        createdAt: "2026-11-10T12:00:00.000Z",
        decidedAt: "2026-11-10T15:00:00.000Z",
        levels: ["planner"],
        currentLevel: null,
      },
    });
    expect(states(input)).toMatchObject({
      compare: "active",
      approval: "pending",
    });
  });

  it("proposta enviada: o cliente aprova em 2 dias úteis; a faca corre ao lado", () => {
    const input = base({
      status: "WAITING_DOWN_PAYMENT",
      quotes: [quote("2026-11-02T12:00:00.000Z", "2026-11-03T12:00:00.000Z")],
      approval: {
        status: "approved",
        createdAt: "2026-11-05T12:00:00.000Z",
        decidedAt: "2026-11-06T12:00:00.000Z",
        levels: ["planner"],
        currentLevel: null,
      },
      selectedAt: "2026-11-06T12:00:00.000Z", // sexta
      dieline: { dueAt: "2026-11-20", doneAt: null },
    });
    expect(states(input)).toMatchObject({
      approval: "done",
      dieline: "active",
      proposal: "active",
      down: "pending",
    });
    const proposal = row(input, "proposal");
    expect(proposal.who).toBe("customer");
    expect(proposal.dueAt).toBe("2026-11-10"); // sexta + 2 dias úteis
    expect(proposal.late).toBe(true);
    expect(row(input, "dieline").who).toBe("supplier");
    expect(row(input, "dieline").late).toBe(false);

    // Cliente aprovou: agora é o sinal.
    const approved = base({
      ...input,
      proposalApprovedAt: "2026-11-09T12:00:00.000Z",
    });
    expect(states(approved)).toMatchObject({
      proposal: "done",
      down: "active",
    });
    expect(row(approved, "proposal").doneAt).toBe("2026-11-09T12:00:00.000Z");
  });

  it("sem aprovação do pré-custo (desligada): a etapa não se aplica", () => {
    const input = base({
      status: "WAITING_DOWN_PAYMENT",
      quotes: [quote("2026-11-02T12:00:00.000Z", "2026-11-03T12:00:00.000Z")],
      selectedAt: "2026-11-10T12:00:00.000Z",
    });
    expect(states(input)).toMatchObject({
      compare: "done",
      approval: "skipped",
      proposal: "active",
    });
    expect(row(input, "approval").dueAt).toBeNull();
  });

  it("sinal confirmado: tudo concluído (o sinal também conta como aprovação da proposta)", () => {
    const input = base({
      status: "ORDERED",
      quotes: [quote("2026-11-02T12:00:00.000Z", "2026-11-03T12:00:00.000Z")],
      selectedAt: "2026-11-04T12:00:00.000Z",
      downConfirmedAt: "2026-11-05T12:00:00.000Z",
      dieline: { dueAt: null, doneAt: "2026-11-05T09:00:00.000Z" },
    });
    const all = requestStages(input);
    expect(all.filter((r) => r.state === "active")).toHaveLength(0);
    expect(states(input)).toMatchObject({
      proposal: "done",
      down: "done",
      dieline: "done",
      approval: "skipped",
    });
    expect(row(input, "proposal").doneAt).toBe("2026-11-05T12:00:00.000Z");
  });

  it("cancelada: a etapa em que parou fica cancelada", () => {
    const input = base({
      status: "CANCELLED",
      quotes: [quote("2026-11-02T12:00:00.000Z")],
    });
    expect(states(input)).toMatchObject({
      new: "done",
      rfq: "cancelled",
      quotes: "pending",
    });
    expect(requestStages(input).some((r) => r.late)).toBe(false);
  });

  it("prazos das Configurações: padrões no que faltar ou vier errado", () => {
    expect(requestStepDays(null)).toEqual(DEFAULT_REQUEST_STEP_DAYS);
    expect(requestStepDays({ rfq: 5, compare: "x", proposal: -1 })).toEqual({
      ...DEFAULT_REQUEST_STEP_DAYS,
      rfq: 5,
    });
    const slow = row(
      base({
        status: "RFQ_OPEN",
        quotes: [quote("2026-11-10T12:00:00.000Z")],
        days: requestStepDays({ rfq: 5 }),
      }),
      "rfq",
    );
    expect(slow.dueAt).toBe("2026-11-17");
  });
});
