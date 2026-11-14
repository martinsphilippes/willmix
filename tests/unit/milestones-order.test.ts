import { describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { towerScenario } from "./helpers/tower-fixture";

/* Marcos de um pedido de verdade (docs/MILESTONES.md): as subtarefas saem
   dos itens, dos passos do embarque, da produção e do recebimento. */
withTempStore();

const { milestonesOf } = await import("@/lib/services/milestones");

describe("marcos de um pedido criado pelo fluxo", () => {
  it("há marcos com subtarefas, um em andamento, e os seguintes aguardando", async () => {
    const scenario = await towerScenario(new Date());
    const views = await milestonesOf(scenario.orders.a);
    const applicable = views.filter((v) => v.state !== "na");
    expect(applicable.length).toBeGreaterThan(3);
    expect(views.some((v) => v.state === "active")).toBe(true);
    // Produção não libera antes do contrato (a ordem do mapa vale).
    const byKey = new Map(views.map((v) => [v.key, v]));
    expect(byKey.get("contract")!.state).not.toBe("done");
    expect(byKey.get("production")!.state).toBe("waiting");
    // Encerrado: tudo concluído ou não se aplica.
    const closed = await milestonesOf(scenario.orders.closed);
    expect(closed.every((v) => v.state !== "waiting")).toBe(true);
  });
});
