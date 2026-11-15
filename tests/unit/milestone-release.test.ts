import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Fase 5d (docs/MILESTONES.md): o motor anda pelos 16 marcos. O item libera
 * quando o marco dele não está aguardando (dependências do mapa concluídas
 * pelas obrigatórias), não mais pela etapa em andamento; as regras de etapa
 * antiga ficam sem efeito até o administrador trocar cada uma para o marco;
 * a carga do Sankhya avança pelos marcos, em espera e sem avisos.
 */
const h = vi.hoisted(() => ({
  current: null as unknown,
  redirects: [] as string[],
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirects.push(to);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.current,
}));

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const ms = await import("@/lib/milestones");
const rel = await import("@/lib/milestone-release");
const rules = await import("@/lib/process-rules");
const { saveProcessRules, getProcessRules } =
  await import("@/lib/services/process-engine");
const { rewriteStageRuleAction } = await import("@/app/app/actions/processes");
const { milestoneTransitions } =
  await import("@/lib/services/order-milestones");
type User = import("@/lib/db").User;
type Subtask = import("@/lib/milestones").Subtask;
type ProcessRule = import("@/lib/process-rules").ProcessRule;

let admin: User;
let operator: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
});

const sub = (step: string, key: string, done = false, optional = false) =>
  ({ step, key, done, ...(optional ? { optional } : {}) }) as Subtask;

/** Pedido de compra recém-criado: cada frente com um item aberto. */
const fresh: Subtask[] = [
  sub("registry/products", "ncm_validated"),
  sub("order/certification", "certificate"),
  sub("order/art-material", "die_cut"),
  sub("order/art", "art"),
  sub("order/contract", "sample_order"),
  sub("finance/finance", "down_payment"),
];

const item = (milestoneKey: string, extra: object = {}) => ({
  key: "x",
  required: true,
  milestoneKey,
  ...extra,
});
const order = { status: "PREPARATION" as const, purchaseRounds: null };

describe("liberação pelos marcos (regra pura)", () => {
  it("certificação e material de arte abrem em paralelo desde a criação; arte e contrato esperam", () => {
    const views = ms.orderMilestones(fresh, "PREPARATION");
    const state = Object.fromEntries(views.map((v) => [v.key, v.state]));
    expect(state).toMatchObject({
      "new-order": "active",
      certification: "active",
      "art-material": "active",
      art: "waiting",
      contract: "waiting",
      "down-payment": "waiting",
    });
    // A etapa "pendente" não segura mais: vale o marco.
    const release = rel.releaseOf(views);
    for (const k of ["new-order", "certification", "art-material"])
      expect(rel.requirementReleased(order, item(k), release)).toBe(true);
    for (const k of ["art", "contract", "down-payment"])
      expect(rel.requirementReleased(order, item(k), release)).toBe(false);
  });

  it("arte depois do material de arte; contrato com pedido novo, certificação e arte", () => {
    const done = (keys: string[]) =>
      fresh.map((s) => (keys.includes(s.key) ? { ...s, done: true } : s));
    const after = (keys: string[]) =>
      Object.fromEntries(
        ms
          .orderMilestones(done(keys), "PREPARATION")
          .map((v) => [v.key, v.state]),
      );
    expect(after(["die_cut"])).toMatchObject({
      art: "active",
      contract: "waiting",
    });
    // Falta a certificação: o contrato ainda espera.
    expect(after(["die_cut", "art", "ncm_validated"])).toMatchObject({
      contract: "waiting",
    });
    expect(
      after(["die_cut", "art", "ncm_validated", "certificate"]),
    ).toMatchObject({ contract: "active", "down-payment": "waiting" });
  });

  it("o opcional não segura o marco seguinte (nem a conclusão)", () => {
    const views = ms.orderMilestones(
      [
        sub("order/orders", "order_confirmed", true),
        sub("order/orders", "erp_number", false, true),
        sub("order/contract", "order_sign_send"),
      ],
      "PREPARATION",
    );
    const by = new Map(views.map((v) => [v.key, v]));
    expect(by.get("new-order")).toMatchObject({ state: "done", done: 1 });
    expect(by.get("contract")!.state).toBe("active");
  });

  it("pai da programação de compra: só os marcos 1 a 4", () => {
    const views = ms.orderMilestones(
      fresh.map((s) => ({ ...s, done: s.key !== "sample_order" })),
      "PREPARATION",
    );
    const release = rel.releaseOf(views);
    const parent = { status: "PREPARATION", purchaseRounds: [{}] } as never;
    expect(rel.requirementReleased(order, item("contract"), release)).toBe(
      true,
    );
    expect(rel.requirementReleased(parent, item("contract"), release)).toBe(
      false,
    );
    expect(
      rel.requirementReleased(
        parent,
        item("art", { status: "rejected" }),
        release,
      ),
    ).toBe(true);
  });

  it("obrigatório feito só se refaz enquanto o marco seguinte não começou; cancelado e encerrado não", () => {
    const views = ms.orderMilestones(
      fresh.map((s) =>
        ["die_cut", "ncm_validated", "certificate", "art"].includes(s.key)
          ? { ...s, done: true }
          : s,
      ),
      "PREPARATION",
    );
    const release = rel.releaseOf(views);
    // O Contrato começou: a arte feita não se refaz (só reprovada).
    expect(
      rel.requirementReleased(order, item("art", { status: "done" }), release),
    ).toBe(false);
    expect(
      rel.requirementReleased(
        order,
        item("art", { status: "rejected" }),
        release,
      ),
    ).toBe(true);
    for (const status of ["CLOSED", "CANCELLED"] as const)
      expect(
        rel.requirementReleased(
          { status, purchaseRounds: null },
          item("contract"),
          release,
        ),
      ).toBe(false);
  });

  it("transições: começa sem linha aberta; conclui uma vez, sem contar o encerramento", () => {
    const views = ms.orderMilestones(
      [
        sub("order/orders", "order_confirmed", true),
        sub("order/contract", "order_sign_send"),
      ],
      "PREPARATION",
    );
    expect(milestoneTransitions(views, [])).toMatchObject({
      started: ["contract"],
      done: ["new-order"],
    });
    expect(
      milestoneTransitions(views, [
        { key: "new-order", status: "done" },
        { key: "contract", status: "active" },
      ]),
    ).toMatchObject({ started: [], done: [] });
    // Encerrado com subtarefa obrigatória aberta: concluído só pela situação.
    const closed = ms.orderMilestones(
      [sub("delivery/delivery", "receipt_confirmed")],
      "CLOSED",
    );
    expect(milestoneTransitions(closed, [])).toMatchObject({
      done: [],
      closed: ["delivery"],
    });
  });
});

describe("regras de etapa antiga", () => {
  it("de-para etapa → marco (começa/conclui)", () => {
    expect(rules.stageRuleMilestoneEvent("stage:SHIPPING:done")).toBe(
      "milestone:shipment:done",
    );
    expect(rules.stageRuleMilestoneEvent("stage:PREPARATION:start")).toBe(
      "milestone:new-order:start",
    );
    expect(rules.stageRuleMilestoneEvent("stage:PACKAGING:done")).toBe(
      "milestone:contract:done",
    );
    expect(rules.stageRuleMilestoneEvent("stage:CLOSED:done")).toBe(
      "milestone:delivery:done",
    );
    expect(rules.stageRuleMilestoneEvent("order:signed")).toBeNull();
  });

  it("troca uma regra só, nunca por cima de uma de marco que faz alguma coisa", () => {
    const merged = rules.mergeRules([
      {
        event: "stage:SHIPPING:done",
        active: true,
        stock: "entry",
        sankhya: "advance",
        top: 1107,
        note: "Embarcado",
      },
    ]);
    const out = rules.rewriteStageRule(merged, "stage:SHIPPING:done");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const by = new Map(out.rules.map((r) => [r.event, r]));
    expect(by.get("milestone:shipment:done")).toMatchObject({
      active: true,
      stock: "entry",
      sankhya: "advance",
      top: 1107,
      note: "Embarcado",
    });
    expect(rules.ruleDoesSomething(by.get("stage:SHIPPING:done")!)).toBe(false);
    // As outras regras ficam como estavam.
    expect(out.rules).toHaveLength(merged.length);
    expect(by.get("order:signed")).toEqual(
      merged.find((r) => r.event === "order:signed"),
    );
    // De novo: a de etapa já não faz nada.
    expect(rules.rewriteStageRule(out.rules, "stage:SHIPPING:done")).toEqual({
      ok: false,
      error: "not_stage_rule",
    });
    // O marco já tem regra ativa: recusa.
    const taken = rules.mergeRules([
      ...out.rules,
      {
        event: "stage:CUSTOMS:done",
        active: true,
        stock: "none",
        sankhya: "advance",
        top: 1109,
        note: null,
      },
      {
        event: "milestone:customs:done",
        active: true,
        stock: "none",
        sankhya: "advance",
        top: 1201,
        note: null,
      },
    ] as ProcessRule[]);
    expect(rules.rewriteStageRule(taken, "stage:CUSTOMS:done")).toEqual({
      ok: false,
      error: "target_in_use",
    });
  });

  it('ação "Trocar para o marco": só o administrador, com a regra gravada', async () => {
    await saveProcessRules(admin, [
      {
        event: "stage:INSPECTION:start",
        active: true,
        stock: "none",
        sankhya: "advance",
        top: 1105,
        note: "Inspeção",
      },
    ]);
    const form = new FormData();
    form.set("legacyEvent", "stage:INSPECTION:start");
    h.current = operator;
    await expect(rewriteStageRuleAction(form)).rejects.toThrow();
    expect(
      (await getProcessRules()).find(
        (r) => r.event === "stage:INSPECTION:start",
      )!.active,
    ).toBe(true);
    h.current = admin;
    await rewriteStageRuleAction(form);
    const after = await getProcessRules();
    expect(
      after.find((r) => r.event === "milestone:inspection:start"),
    ).toMatchObject({ active: true, sankhya: "advance", top: 1105 });
    expect(
      rules.ruleDoesSomething(
        after.find((r) => r.event === "stage:INSPECTION:start")!,
      ),
    ).toBe(false);
    expect(h.redirects.at(-1)).toContain("rewritten=");
    // Evento fora das etapas: recusado pelo zod.
    const bad = new FormData();
    bad.set("legacyEvent", "order:signed");
    await rewriteStageRuleAction(bad);
    expect(h.redirects.at(-1)).toContain("error=invalid_input");
    const audit = await getStore().list("audit_log", {
      filter: { action: "process.rule.rewrite" },
    });
    expect(audit).toHaveLength(1);
  });
});
