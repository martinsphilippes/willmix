import { describe, expect, it } from "vitest";
import { milestoneHomeStep } from "@/lib/milestones";
import {
  buildOrderFlow,
  orderFlowEntries,
  type OrderFlowInput,
} from "@/lib/services/flow-contribution";
import type { Order, Requirement } from "@/lib/db/schema";

/*
 * Pedido novo com o que falta no Cadastro (dono, 24/11/2026, opção 1; o
 * pedido #10000002): o item aberto num passo fora dos blocos do pedido (a
 * ficha mestre e a aprovação do cadastro, em Cadastros → Produtos) também
 * põe o pedido no passo do marco (Pedido > Pedidos, "Todos no passo"), para
 * ele não sumir do bloco. A pendência continua contada só no passo do item.
 */
const AT = "2026-11-24T19:53:47.660Z";
const order = {
  id: "o1",
  number: 10000002,
  status: "PREPARATION",
  flow: "supplier_request",
  supplierId: "s1",
  held: false,
  createdAt: AT,
  updatedAt: AT,
} as unknown as Order;
const req = (key: string, step: string) =>
  ({
    id: key,
    orderId: "o1",
    key,
    step,
    status: "pending",
    required: true,
    role: "operator",
    createdAt: AT,
    updatedAt: AT,
  }) as unknown as Requirement;
const milestone = (key: string, status = "active") => ({
  key,
  status,
  startedAt: AT,
  dueAt: null,
});
const input = (
  open: Requirement[],
  milestones: ReturnType<typeof milestone>[],
): OrderFlowInput =>
  ({
    order,
    openRequirements: open,
    importSteps: [],
    track: null,
    receiving: null,
    items: [],
    downPayment: null,
    sampleOrder: null,
    milestones,
    views: null,
  }) as unknown as OrderFlowInput;
const requirementSteps = (i: OrderFlowInput) =>
  orderFlowEntries(i)
    .filter((e) => e.item.kind === "requirement")
    .map((e) => e.step);

describe("o passo do marco no bloco dele", () => {
  it("Pedido novo em Pedidos; o Sinal (Financeiro) não tem", () => {
    expect(milestoneHomeStep("new-order")).toBe("order/orders");
    expect(milestoneHomeStep("art")).toBe("order/art");
    expect(milestoneHomeStep("down-payment")).toBeNull();
  });
});

describe("Pedido novo só com o cadastro aberto (dono, 24/11/2026)", () => {
  const open = [
    req("sheet_complete__i1", "registry/products"),
    req("approval_registration", "registry/products"),
  ];

  it("aparece em Pedido > Pedidos e continua em Cadastros → Produtos", () => {
    const steps = requirementSteps(input(open, [milestone("new-order")]));
    expect(steps.filter((s) => s === "registry/products")).toHaveLength(2);
    expect(steps.filter((s) => s === "order/orders")).toHaveLength(2);
    // A contribuição do resumo (os passos dos blocos do pedido): Pedidos,
    // desde o início do marco.
    const flow = buildOrderFlow(input(open, [milestone("new-order")]));
    expect(flow?.s["order/orders"]).toBe(AT);
    expect(flow && "registry/products" in flow.s).toBe(false);
  });

  it("item do próprio passo não duplica; marco fora de andamento não entra", () => {
    expect(
      requirementSteps(
        input([req("erp_number", "order/orders")], [milestone("new-order")]),
      ),
    ).toEqual(["order/orders"]);
    expect(
      requirementSteps(input(open, [milestone("new-order", "done")])),
    ).toEqual([]);
  });

  it("o Sinal continua só no Financeiro", () => {
    expect(
      requirementSteps(
        input(
          [req("down_payment", "finance/finance")],
          [milestone("down-payment")],
        ),
      ),
    ).toEqual(["finance/finance"]);
  });
});
