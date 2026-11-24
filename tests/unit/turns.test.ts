import { describe, expect, it } from "vitest";
import {
  TURN_PARTIES,
  partyOfRole,
  turnCounts,
  turnFilterOf,
  turnNameKey,
  turnTone,
  turnWaitingKey,
  turnWithKey,
} from "@/lib/turn";
import {
  inSituation,
  nextStepText,
  nextStepWaiting,
  nextStepWho,
  requestNextStep,
  type PurchaseProgress,
} from "@/lib/services/request-list";
import { translator } from "@/i18n";
import { ROLES } from "@/lib/db/schema";

/*
 * De quem é a vez (dono, 18/11/2026; docs/TURNS.md): a mesma regra dá a
 * situação ("Aguardando cliente"), o Próximo passo e o filtro "Com quem
 * está", do pedido do cliente até o pedido de compra.
 */

const t = translator("pt");
const base = {
  display: "REQUESTED" as never,
  order: null,
  today: "2026-11-18",
};
const step = (input: Partial<Parameters<typeof requestNextStep>[0]>) =>
  requestNextStep({ ...base, status: "REQUESTED", ...input });

/** A compra da encomenda com a estratégia aprovada pela cotação. */
const quote = (
  q: NonNullable<PurchaseProgress["quote"]>,
  supplierRequests: PurchaseProgress["supplierRequests"] = [],
): PurchaseProgress => ({
  decision: { status: "approved", choice: "quote", orderId: null },
  quote: q,
  supplierRequests,
});

describe("quem pode estar com a vez", () => {
  it("todo papel vira uma parte; a equipe Wellmix é uma só; a Trading à parte", () => {
    for (const role of ROLES) expect(partyOfRole(role), role).not.toBeNull();
    expect(partyOfRole("admin")).toBe("wellmix");
    expect(partyOfRole("operator")).toBe("wellmix");
    expect(partyOfRole("supplier")).toBe("supplier");
    expect(partyOfRole("supplier", { trading: true })).toBe("trading");
    expect(partyOfRole("customer", { trading: true })).toBe("customer");
    expect(partyOfRole(null)).toBeNull();
  });

  it("cada parte tem situação, complemento e nome nos três idiomas", () => {
    for (const locale of ["pt", "en", "zh"] as const) {
      const tr = translator(locale);
      for (const p of TURN_PARTIES)
        for (const key of [turnWaitingKey(p), turnWithKey(p), turnNameKey(p)])
          expect(tr(key), `${locale} ${key}`).not.toBe(key);
      expect(tr("turn.waiting.you")).not.toBe("turn.waiting.you");
    }
    expect(t(turnWaitingKey("customer"))).toBe("Aguardando cliente");
    expect(t(turnWaitingKey("supplier"))).toBe("Aguardando fornecedor");
    expect(t(turnWaitingKey("wellmix"))).toBe("Aguardando Wellmix");
    expect(turnTone("wellmix")).toBe("brand");
    expect(turnTone("unassigned")).toBe("danger");
  });

  it("filtro pelo endereço e contagem na ordem das partes", () => {
    expect(turnFilterOf("customer")).toBe("customer");
    expect(turnFilterOf("hacker")).toBeNull();
    expect(turnFilterOf(undefined)).toBeNull();
    expect(
      turnCounts(["supplier", "wellmix", null, "wellmix", "customer"]),
    ).toEqual([
      { party: "wellmix", count: 2 },
      { party: "customer", count: 1 },
      { party: "supplier", count: 1 },
    ]);
  });
});

describe("encomenda: a ação e quem está com a vez", () => {
  it("venda aguardando o cliente: Confirmar pedido, com o cliente; em aberto", () => {
    const n = step({
      status: "AWAITING_CUSTOMER",
      display: "AWAITING_CUSTOMER" as never,
    });
    expect(n).toEqual({ key: "confirm", who: "customer" });
    expect(nextStepText(t, n)).toBe("Confirmar pedido");
    expect(nextStepWho(t, n)).toBe("com o cliente");
    expect(nextStepWaiting(t, n)).toBe("Aguardando cliente");
    // Em aberto e atrasada como qualquer encomenda que ainda depende de ação.
    const r = { status: "AWAITING_CUSTOMER" as const, deadline: "2026-11-10" };
    expect(inSituation(r, "AWAITING_CUSTOMER", "open", base.today)).toBe(true);
    expect(inSituation(r, "AWAITING_CUSTOMER", "late", base.today)).toBe(true);
  });

  it("ninguém pode confirmar: falta o responsável (vai ao administrador)", () => {
    const n = step({
      status: "AWAITING_CUSTOMER",
      display: "AWAITING_CUSTOMER" as never,
      customerLogin: false,
    });
    expect(n).toEqual({ key: "login", who: "unassigned" });
    expect(nextStepWaiting(t, n)).toBe("Sem responsável definido");
  });

  it("confirmada: enviar para cotação e, depois, a estratégia, com a Wellmix", () => {
    expect(step({ strategy: "send" })).toEqual({ key: "send", who: "wellmix" });
    expect(step({ strategy: "queue" })).toEqual({
      key: "strategy",
      who: "wellmix",
    });
    expect(step({})).toEqual({ key: "new", who: "wellmix" });
  });

  it("pedido direto: aprovar a estratégia e gerar o pedido de compra", () => {
    const direct = (status: "pending" | "approved", orderId: string | null) =>
      step({
        purchase: {
          decision: { status, choice: "last_supplier", orderId },
          quote: null,
          supplierRequests: [],
        },
      });
    expect(direct("pending", null)).toEqual({
      key: "strategy_approve",
      who: "wellmix",
    });
    expect(direct("approved", null)).toEqual({
      key: "strategy_order",
      who: "wellmix",
    });
  });

  it("estratégia recusada: volta para a fila (a estratégia é da Wellmix de novo)", () => {
    expect(
      step({
        strategy: "queue",
        purchase: {
          decision: { status: "rejected", choice: "quote", orderId: null },
          quote: null,
          supplierRequests: [],
        },
      }),
    ).toEqual({ key: "strategy", who: "wellmix" });
  });

  it("cotação: no prazo é do fornecedor; depois a Wellmix escolhe, decide ou aprova", () => {
    expect(
      step({ purchase: quote({ status: "open", phase: "answering" }) }),
    ).toEqual({ key: "quote_answer", who: "supplier" });
    expect(
      step({ purchase: quote({ status: "open", phase: "choose" }) }),
    ).toEqual({ key: "quote_choose", who: "wellmix" });
    expect(
      step({ purchase: quote({ status: "open", phase: "empty" }) }),
    ).toEqual({ key: "quote_empty", who: "wellmix" });
    expect(
      step({ purchase: quote({ status: "chosen", phase: "choose" }) }),
    ).toEqual({ key: "quote_approve", who: "wellmix" });
  });

  it("vencedora aprovada: negociação (com a contraproposta), amostragem e pedido", () => {
    const approved = { status: "approved" as const, phase: "choose" as const };
    const sr = (
      status: "open" | "answered" | "approved",
      negotiation: "supplier" | "wellmix" | null,
      sampling: "supplier" | "wellmix" | null = null,
    ) => ({ status, negotiation, sampling });
    const at = (list: PurchaseProgress["supplierRequests"]) =>
      step({ status: "SUPPLIER_SELECTED", purchase: quote(approved, list) });
    expect(at([sr("answered", "wellmix")])).toEqual({
      key: "supplier_decide",
      who: "wellmix",
    });
    // Devolução: a contraproposta da Wellmix volta a vez para o fornecedor.
    expect(at([sr("answered", "supplier")])).toEqual({
      key: "supplier_answer",
      who: "supplier",
    });
    expect(at([sr("approved", null, "supplier")])).toEqual({
      key: "sampling_send",
      who: "supplier",
    });
    expect(at([sr("approved", null, "wellmix")])).toEqual({
      key: "sampling_validate",
      who: "wellmix",
    });
    expect(at([sr("approved", null)])).toEqual({
      key: "purchase_order",
      who: "wellmix",
    });
    // Ações simultâneas: a primeira que espera alguém de fora vem antes.
    expect(at([sr("approved", null), sr("open", "supplier")])).toEqual({
      key: "supplier_answer",
      who: "supplier",
    });
  });

  it("o passo leva à solicitação ao fornecedor com a vez (dono, 24/11/2026)", () => {
    const approved = { status: "approved" as const, phase: "choose" as const };
    const at = (list: PurchaseProgress["supplierRequests"]) =>
      step({ status: "SUPPLIER_SELECTED", purchase: quote(approved, list) });
    // Duas solicitações: a que tem a vez é a do link (não a primeira).
    expect(
      at([
        { id: "sr-a", status: "approved", negotiation: null, sampling: null },
        {
          id: "sr-b",
          status: "approved",
          negotiation: null,
          sampling: "wellmix",
        },
      ]),
    ).toEqual({
      key: "sampling_validate",
      who: "wellmix",
      supplierRequestId: "sr-b",
    });
    expect(
      at([
        {
          id: "sr-c",
          status: "answered",
          negotiation: "wellmix",
          sampling: null,
        },
      ]),
    ).toEqual({
      key: "supplier_decide",
      who: "wellmix",
      supplierRequestId: "sr-c",
    });
    // O pedido de compra não é de uma solicitação só: sem o link.
    expect(
      at([
        { id: "sr-d", status: "approved", negotiation: null, sampling: null },
      ]),
    ).toEqual({ key: "purchase_order", who: "wellmix" });
  });

  it("todo próximo passo tem texto nos três idiomas", () => {
    const keys = [
      "new",
      "send",
      "strategy",
      "confirm",
      "login",
      "strategy_approve",
      "strategy_order",
      "quote_answer",
      "quote_choose",
      "quote_empty",
      "quote_approve",
      "supplier_answer",
      "supplier_decide",
      "sampling_send",
      "sampling_validate",
      "purchase_order",
    ] as const;
    for (const locale of ["pt", "en", "zh"] as const) {
      const tr = translator(locale);
      for (const key of keys)
        expect(
          nextStepText(tr, { key, who: "wellmix" }),
          `${locale} ${key}`,
        ).not.toBe(`reqList.next.${key}`);
    }
  });
});
