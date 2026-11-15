import { describe, expect, it } from "vitest";
import {
  MILESTONES,
  activeMilestones,
  compactMilestones,
  currentMilestone,
  milestoneNumber,
  milestoneOfFacts,
  milestoneOfStatus,
  milestoneTitle,
  orderMilestoneText,
  type MilestoneKey,
  type MilestoneState,
  milestoneOfImportKey,
  milestoneOfRequirement,
  milestoneOfStep,
  orderMilestones,
  type Subtask,
} from "@/lib/milestones";
import { FLOW_STEPS, stepId } from "@/lib/flow";
import { pt, en, zh } from "@/i18n/modules/milestones";

/* Marcos do pedido (docs/MILESTONES.md): 16 marcos na ordem do mapa, com
   as dependências; a situação sai das subtarefas. */
const s = (step: string, done: boolean, key = step): Subtask => ({
  step,
  key,
  done,
});
const byKey = (subtasks: Subtask[]) =>
  new Map(orderMilestones(subtasks).map((v) => [v.key, v]));

describe("marcos do pedido", () => {
  it("16 marcos; todo passo dos blocos Pedido, Produção e Entrega cai num marco", () => {
    expect(MILESTONES).toHaveLength(16);
    for (const step of FLOW_STEPS) {
      if (!["order", "production", "delivery"].includes(step.block)) continue;
      if (step.key === "review") continue; // Revisão: fila da Wellmix, fora do pedido.
      expect(milestoneOfStep(stepId(step)), stepId(step)).not.toBeNull();
    }
    // Dependências só para trás, na ordem do mapa.
    const order = MILESTONES.map((m) => m.key);
    for (const m of MILESTONES)
      for (const d of m.deps)
        expect(order.indexOf(d), `${m.key} ← ${d}`).toBeLessThan(
          order.indexOf(m.key),
        );
  });

  it("arte aguarda o material; contrato aguarda arte e cadastro", () => {
    const v = byKey([
      s("order/art-material", false, "die_cut"),
      s("order/art", false, "art"),
      s("registry/products", true, "ncm_validated"),
      s("order/contract", false, "order_signed_wellmix"),
    ]);
    expect(v.get("art-material")!.state).toBe("active");
    expect(v.get("art")!.state).toBe("waiting");
    expect(v.get("art")!.waitingFor).toBe("art-material");
    expect(v.get("new-order")!.state).toBe("done");
    expect(v.get("contract")!.state).toBe("waiting");
    expect(v.get("contract")!.waitingFor).toBe("art");
    // Sem subtarefa: não se aplica (e não segura os seguintes).
    expect(v.get("certification")!.state).toBe("na");
  });

  it("com o material e a arte feitos, o contrato fica liberado", () => {
    const v = byKey([
      s("order/art-material", true),
      s("order/art", true),
      s("registry/products", true),
      s("order/contract", false),
      s("order/contract", true, "sample_order"),
    ]);
    expect(v.get("contract")!.state).toBe("active");
    expect(v.get("contract")!.percent).toBe(50);
    expect(v.get("down-payment")!.state).toBe("na");
  });

  it("marco que não se aplica é transparente; encerrado conclui tudo", () => {
    const v = byKey([
      s("order/contract", false),
      s("production/production", false),
    ]);
    // Sem sinal nem pré-produção: a produção espera o contrato.
    expect(v.get("production")!.state).toBe("waiting");
    expect(v.get("production")!.waitingFor).toBe("contract");
    const closed = new Map(
      orderMilestones([s("order/contract", false)], "CLOSED").map((x) => [
        x.key,
        x,
      ]),
    );
    expect(closed.get("contract")!.state).toBe("done");
    expect(
      orderMilestones([s("order/contract", false)], "CANCELLED").every(
        (x) => x.state === "na",
      ),
    ).toBe(true);
  });

  it("textos em pt, en e zh com as mesmas chaves e um para cada marco", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort());
    expect(Object.keys(zh).sort()).toEqual(Object.keys(pt).sort());
    for (const m of MILESTONES)
      expect(pt[`milestone.${m.key}` as keyof typeof pt]).toBeTruthy();
  });
});

/* Fase 3 (tela do pedido): cada item e cada passo do embarque cai no marco
   do passo do menu dele; o item sem passo nos marcos, pela etapa. */
describe("marco de um item ou passo", () => {
  it("itens do pedido pelo passo do menu", () => {
    expect(milestoneOfRequirement("PREPARATION", "die_cut__item1")).toBe(
      "art-material",
    );
    expect(milestoneOfRequirement("PREPARATION", "art__item1")).toBe("art");
    expect(milestoneOfRequirement("PACKAGING", "order_signed_wellmix")).toBe(
      "contract",
    );
    expect(milestoneOfRequirement("PACKAGING", "down_payment")).toBe(
      "down-payment",
    );
    expect(milestoneOfRequirement("INSPECTION", "weight_measured")).toBe(
      "inspection",
    );
    expect(milestoneOfRequirement("SHIPPING", "vessel")).toBe("shipment");
    expect(milestoneOfRequirement("TRANSPORT", "delivered")).toBe("delivery");
  });
  it("item sem passo nos marcos: pela etapa", () => {
    expect(milestoneOfRequirement("CLOSED", "whatever")).toBe("delivery");
  });
  it("passos do embarque, da certificação e das amostras", () => {
    expect(milestoneOfImportKey("booking")).toBe("booking");
    expect(milestoneOfImportKey("cert_memorial")).toBe("certification");
    expect(milestoneOfImportKey("container_loaded")).toBe("loading");
    expect(milestoneOfImportKey("channel")).toBe("customs");
    expect(milestoneOfImportKey("danfe")).toBe("invoice-transport");
    expect(milestoneOfImportKey("unknown_step")).toBeNull();
  });
});

/* Fase 4a (docs/MILESTONES.md, "Telas que leem os marcos"): o marco atual
   das listas e o formato curto do resumo. */
describe("marco atual do pedido", () => {
  const view = (key: MilestoneKey, state: MilestoneState) => ({ key, state });

  it("primeiro em andamento na ordem do dono; marcos em paralelo", () => {
    const views = [
      view("art-material", "active"),
      view("certification", "active"),
      view("new-order", "done"),
      view("contract", "waiting"),
    ];
    expect(currentMilestone(views)).toBe("certification");
    expect(activeMilestones(views)).toEqual(["certification", "art-material"]);
  });

  it("sem andamento, o primeiro aguardando; tudo feito, a entrega; cancelado, nulo", () => {
    expect(
      currentMilestone([view("shipment", "waiting"), view("art", "waiting")]),
    ).toBe("art");
    expect(
      currentMilestone([view("new-order", "done"), view("samples", "na")]),
    ).toBe("delivery");
    expect(currentMilestone([view("new-order", "na")], "CLOSED")).toBe(
      "delivery",
    );
    expect(currentMilestone([view("new-order", "na")])).toBeNull();
    expect(
      currentMilestone([view("new-order", "active")], "CANCELLED"),
    ).toBeNull();
    // Pelo cálculo de verdade: pedido sem nada feito começa no Pedido novo.
    const fresh = orderMilestones([
      s("order/orders", false, "sankhya"),
      s("order/art", false, "art"),
    ]);
    expect(currentMilestone(fresh)).toBe("new-order");
  });

  it("situação antiga vira marco; número de 1 a 16", () => {
    expect(milestoneOfStatus("ORDER_CREATED")).toBe("new-order");
    expect(milestoneOfStatus("PREPARATION")).toBe("new-order");
    expect(milestoneOfStatus("PACKAGING")).toBe("contract");
    expect(milestoneOfStatus("SUPPLIER_PAYMENT")).toBe("down-payment");
    expect(milestoneOfStatus("SHIPPING")).toBe("shipment");
    expect(milestoneOfStatus("TRANSPORT")).toBe("invoice-transport");
    expect(milestoneOfStatus("CLOSED")).toBe("delivery");
    expect(milestoneOfStatus("CANCELLED")).toBeNull();
    expect(milestoneOfStatus(null)).toBeNull();
    expect(milestoneNumber("new-order")).toBe(1);
    expect(milestoneNumber("delivery")).toBe(16);
    expect(milestoneTitle((k) => k, "art")).toBe("4. milestone.art");
  });

  it("pelo resumo (facts.m); resumo antigo sem m, pela situação", () => {
    const views = orderMilestones([
      s("order/orders", true, "sankhya"),
      s("order/art-material", false, "die_cut"),
    ]);
    const m = compactMilestones(views);
    expect(m.find((x) => x.k === "art-material")).toEqual({
      k: "art-material",
      s: "active",
      d: 0,
      t: 1,
    });
    expect(milestoneOfFacts(m, "PREPARATION")).toBe("art-material");
    expect(milestoneOfFacts(undefined, "SHIPPING")).toBe("shipment");
    expect(milestoneOfFacts(m, "CANCELLED")).toBeNull();
    expect(orderMilestoneText((k) => k, "CANCELLED")).toBe("stage.CANCELLED");
    expect(orderMilestoneText((k) => k, "CUSTOMS")).toBe(
      "14. milestone.customs",
    );
  });

  it("textos novos nas três línguas", () => {
    for (const key of ["milestone.current", "milestone.owner.title"] as const)
      for (const dict of [pt, en, zh]) expect(dict[key]).toBeTruthy();
  });
});
