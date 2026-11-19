import { describe, expect, it } from "vitest";
import {
  isOverdue,
  responsibleKey,
  responsibleLine,
  responsibleOf,
  stepDue,
  stepOwner,
  stepPartners,
  type PeopleDirectory,
  type Person,
} from "@/lib/request-responsible";
import { kindGate } from "@/lib/task-owner";
import type { PurchaseProgress } from "@/lib/services/request-list";

/*
 * Quem age e até quando em cada passo da encomenda (dono, 19/11/2026;
 * docs/ORDER_LEVEL_LISTS.md, seção 6): a mesma porta das Pendências, o
 * prazo da pendência de cada passo e a 2ª linha da Próxima ação.
 */

const p = (id: string, name: string, login: string | null = null): Person => ({
  id,
  name,
  login,
});

/** Diretório de teste: a equipe pela porta, o cliente e os parceiros. */
function directory(over: Partial<PeopleDirectory> = {}): PeopleDirectory {
  return {
    team: (gate) =>
      "action" in gate && gate.action === "purchaseStrategy.choose"
        ? { people: [p("u1", "Philippe Martins")], functions: ["Comprador"] }
        : "action" in gate && gate.action === "supplierRequest.decide"
          ? {
              people: [p("u2", "Ana"), p("u3", "Beto"), p("u4", "Caio")],
              functions: ["Comprador"],
            }
          : { people: [], functions: [] },
    admins: () => [p("a1", "Administrador")],
    confirmers: (id) =>
      id === "r1" ? [p("c1", "Ana Costa", "ana@loja.com")] : [],
    customer: () => "FC DISTRIBUIDORA",
    partner: (id) =>
      id === "s1"
        ? { name: "Shenzhen ABC", people: [p("f1", "Li Wei")] }
        : id === "s2"
          ? { name: "Ningbo XYZ", people: [] }
          : { name: "Guangzhou B", people: [p("f2", "Wang"), p("f3", "Zhou")] },
    ...over,
  };
}

const labels = {
  undefined: "Responsável não definido",
  people: (n: number) => `${n} pessoas`,
  partners: (n: number) => `${n} parceiros`,
  party: (party: string) =>
    ({ customer: "Cliente", wellmix: "Wellmix", supplier: "Fornecedor" })[
      party
    ] ?? party,
};

const line = (r: ReturnType<typeof responsibleOf>) => {
  const l = responsibleLine(r!, labels as never);
  return l.where ? `${l.who} · ${l.where}` : l.who;
};

describe("de quem é cada passo", () => {
  it("as etapas da Wellmix usam a porta das Pendências (kindGate)", () => {
    expect(stepOwner("send")).toEqual({
      kind: "team",
      gate: kindGate("new_request"),
    });
    expect(stepOwner("new")).toEqual({
      kind: "team",
      gate: kindGate("new_request"),
      except: "purchaseStrategy.choose",
    });
    expect(stepOwner("strategy")).toEqual({
      kind: "team",
      gate: { action: "purchaseStrategy.choose" },
    });
    expect(stepOwner("quote_approve")).toEqual({
      kind: "team",
      gate: { action: "purchaseQuote.approve" },
    });
    expect(stepOwner("supplier_decide")).toEqual({
      kind: "team",
      gate: { action: "supplierRequest.decide" },
    });
    expect(stepOwner("confirm")).toEqual({ kind: "customer" });
    expect(stepOwner("supplier_answer")).toEqual({ kind: "partners" });
    expect(stepOwner("login")).toEqual({ kind: "missing", reason: "login" });
    expect(stepOwner("purchase_order")).toEqual({
      kind: "missing",
      reason: "flow",
    });
    expect(stepOwner("none")).toBeNull();
  });
});

describe("prazo da ação (o mesmo da pendência)", () => {
  const purchase: PurchaseProgress = {
    decision: { status: "approved", choice: "quote", orderId: null },
    quote: {
      status: "open",
      phase: "answering",
      invites: [
        { supplierId: "s1", dueAt: "2026-11-20T10:00:00Z" },
        { supplierId: "s2", dueAt: "2026-11-19T18:00:00Z" },
      ],
    },
    supplierRequests: [
      {
        status: "answered",
        negotiation: "wellmix",
        sampling: null,
        supplierId: "s1",
        negotiationDueAt: "2026-11-21T12:00:00Z",
        samplingDueAt: null,
      },
      {
        status: "approved",
        negotiation: null,
        sampling: "supplier",
        supplierId: "s3",
        negotiationDueAt: null,
        samplingDueAt: "2026-11-30T12:00:00Z",
      },
    ],
  };
  const request = { deadline: "2026-11-24" };

  it("cotação: o convite que vence antes; cada parceiro com o prazo dele", () => {
    expect(stepPartners("quote_answer", purchase)).toEqual([
      { supplierId: "s1", dueAt: "2026-11-20T10:00:00Z" },
      { supplierId: "s2", dueAt: "2026-11-19T18:00:00Z" },
    ]);
    expect(
      stepDue({ key: "quote_answer", who: "supplier" }, request, purchase),
    ).toEqual({ at: "2026-11-19T18:00:00Z", day: false });
  });

  it("negociação e amostragem: os SLA das pendências; o resto, o prazo da solicitação", () => {
    expect(
      stepDue({ key: "supplier_decide", who: "wellmix" }, request, purchase),
    ).toEqual({ at: "2026-11-21T12:00:00Z", day: false });
    expect(
      stepDue({ key: "sampling_send", who: "supplier" }, request, purchase),
    ).toEqual({ at: "2026-11-30T12:00:00Z", day: false });
    expect(stepDue({ key: "confirm", who: "customer" }, request, null)).toEqual(
      {
        at: "2026-11-24",
        day: true,
      },
    );
    expect(stepDue({ key: "strategy", who: "wellmix" }, request, null)).toEqual(
      {
        at: "2026-11-24",
        day: true,
      },
    );
    expect(
      stepDue(
        { key: "order", who: "supplier", dueAt: "2026-12-01T00:00:00Z" },
        request,
        null,
      ),
    ).toEqual({ at: "2026-12-01", day: true });
    expect(stepDue({ key: "none", who: null }, request, null)).toBeNull();
  });

  it("vencido: por dia, só no dia seguinte; por instante, na hora", () => {
    const now = new Date("2026-11-19T15:00:00Z");
    expect(isOverdue({ at: "2026-11-19", day: true }, now, "2026-11-19")).toBe(
      false,
    );
    expect(isOverdue({ at: "2026-11-18", day: true }, now, "2026-11-19")).toBe(
      true,
    );
    expect(
      isOverdue({ at: "2026-11-19T14:59:00Z", day: false }, now, "2026-11-19"),
    ).toBe(true);
    expect(isOverdue(null, now, "2026-11-19")).toBe(false);
  });
});

describe("quem age (2ª linha da Próxima ação)", () => {
  const request = { id: "r1", customerId: "c" };
  const dir = directory();

  it("cliente: o login que confirma; sem login, responsável não definido (cadastro)", () => {
    const r = responsibleOf(
      { key: "confirm", who: "customer" },
      request,
      null,
      dir,
    );
    expect(line(r)).toBe("Ana Costa · Cliente");
    expect(r?.people[0].login).toBe("ana@loja.com");
    const none = responsibleOf(
      { key: "confirm", who: "customer" },
      { id: "r2", customerId: "c" },
      null,
      dir,
    );
    expect(none?.missing).toBe("login");
    expect(line(none)).toBe("Responsável não definido");
  });

  it("Wellmix: uma pessoa pelo nome, uma função com várias pela equipe, ninguém com a função sinaliza o cadastro", () => {
    const one = responsibleOf(
      { key: "strategy", who: "wellmix" },
      request,
      null,
      dir,
    );
    expect(line(one)).toBe("Philippe Martins · Wellmix");
    expect(one?.admins.map((a) => a.name)).toEqual(["Administrador"]);
    const team = responsibleOf(
      { key: "supplier_decide", who: "wellmix" },
      request,
      null,
      dir,
    );
    expect(line(team)).toBe("Comprador (3) · Wellmix");
    const nobody = responsibleOf(
      { key: "quote_approve", who: "wellmix" },
      request,
      null,
      dir,
    );
    expect(nobody?.missing).toBe("function");
    expect(responsibleLine(nobody!, labels as never)).toMatchObject({
      who: "Responsável não definido",
      warn: true,
    });
    // O Analista não entra: só a porta da etapa decide.
    const flow = responsibleOf(
      { key: "purchase_order", who: "wellmix" },
      request,
      null,
      dir,
    );
    expect(flow?.missing).toBe("flow");
  });

  it("fornecedor: um parceiro pelo login ou pela empresa; vários, a quantidade; sem login, o aviso", () => {
    const answering = (ids: string[]): PurchaseProgress => ({
      decision: { status: "approved", choice: "quote", orderId: null },
      quote: {
        status: "open",
        phase: "answering",
        invites: ids.map((id) => ({
          supplierId: id,
          dueAt: "2026-11-20T10:00:00Z",
        })),
      },
      supplierRequests: [],
    });
    const step = { key: "quote_answer" as const, who: "supplier" as const };
    expect(line(responsibleOf(step, request, answering(["s1"]), dir))).toBe(
      "Li Wei · Fornecedor",
    );
    expect(line(responsibleOf(step, request, answering(["s3"]), dir))).toBe(
      "Guangzhou B · Fornecedor",
    );
    const noLogin = responsibleOf(step, request, answering(["s2"]), dir);
    expect(noLogin?.missing).toBe("partner_login");
    expect(responsibleLine(noLogin!, labels as never)).toMatchObject({
      who: "Ningbo XYZ",
      warn: true,
    });
    const many = responsibleOf(
      step,
      request,
      answering(["s1", "s2", "s3"]),
      dir,
    );
    expect(line(many)).toBe("3 parceiros · Fornecedor");
    expect(many?.partners.map((x) => x.name)).toEqual([
      "Shenzhen ABC",
      "Ningbo XYZ",
      "Guangzhou B",
    ]);
  });

  it("passos iguais com os mesmos responsáveis têm a mesma chave (ações paralelas juntas)", () => {
    const a = responsibleOf(
      { key: "confirm", who: "customer" },
      request,
      null,
      dir,
    );
    const b = responsibleOf(
      { key: "confirm", who: "customer" },
      request,
      null,
      dir,
    );
    const c = responsibleOf(
      { key: "strategy", who: "wellmix" },
      request,
      null,
      dir,
    );
    expect(responsibleKey(a)).toBe(responsibleKey(b));
    expect(responsibleKey(a)).not.toBe(responsibleKey(c));
  });
});
