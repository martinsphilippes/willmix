import { describe, expect, it } from "vitest";
import { orderProgress } from "@/lib/flow-progress";
import type { Stage } from "@/lib/db/schema";

/* Completude e atraso do pedido por bloco (docs/FLOW_MENU.md, "Visão do
   pedido entre os blocos"). */
type S = Parameters<typeof orderProgress>[0][number];
const stage = (
  key: Stage["key"],
  sequence: number,
  status: Stage["status"],
  extra: Partial<S> = {},
): S => ({
  id: key,
  key,
  sequence,
  status,
  percent: 0,
  dueAt: null,
  startedAt: null,
  completedAt: null,
  ...extra,
});

const now = new Date("2026-11-14T12:00:00Z");

describe("completude do pedido por bloco", () => {
  it("média das etapas no bloco e no geral; pagamento ao fornecedor fora", () => {
    const p = orderProgress(
      [
        stage("ORDER_CREATED", 1, "done"),
        stage("PREPARATION", 2, "done"),
        stage("SUPPLIER_PAYMENT", 3, "pending"),
        stage("PACKAGING", 4, "active", { percent: 40 }),
        stage("INSPECTION", 5, "pending"),
        stage("SHIPPING", 6, "pending"),
        stage("CUSTOMS", 7, "pending"),
        stage("TRANSPORT", 8, "pending"),
        stage("DELIVERED", 9, "pending"),
        stage("CLOSED", 10, "pending"),
      ],
      now,
    );
    const order = p.blocks.find((b) => b.block === "order")!;
    expect(order.percent).toBe(80); // (100 + 100 + 40) / 3
    expect(order.state).toBe("active");
    expect(order.stages.map((s) => s.key)).toEqual([
      "ORDER_CREATED",
      "PREPARATION",
      "PACKAGING",
    ]);
    expect(p.blocks.find((b) => b.block === "production")!.percent).toBe(0);
    expect(p.overall).toBe(27); // 240 / 9
    expect(p.current).toBe("order");
  });

  it("atraso agora e etapa concluída depois do prazo", () => {
    const p = orderProgress(
      [
        stage("INSPECTION", 1, "done", {
          dueAt: "2026-11-01T00:00:00Z",
          completedAt: "2026-11-04T00:00:00Z",
        }),
        stage("SHIPPING", 2, "active", {
          percent: 50,
          dueAt: "2026-11-10T12:00:00Z",
          startedAt: "2026-11-04T00:00:00Z",
        }),
        stage("CUSTOMS", 3, "cancelled"),
      ],
      now,
    );
    const prod = p.blocks.find((b) => b.block === "production")!;
    expect(prod.lateDays).toBe(4);
    expect(prod.doneLate).toBe(1);
    expect(prod.stages[0].doneLateDays).toBe(3);
    expect(prod.percent).toBe(75);
    expect(p.lateDays).toBe(4);
    expect(p.current).toBe("production");
    // Etapa cancelada não conta.
    expect(p.blocks.find((b) => b.block === "delivery")!.stages).toEqual([]);
  });

  it("pedido concluído: tudo 100%, bloco atual é a Entrega", () => {
    const p = orderProgress(
      [stage("DELIVERED", 1, "done"), stage("CLOSED", 2, "done")],
      now,
    );
    expect(p.overall).toBe(100);
    expect(p.current).toBe("delivery");
    expect(p.blocks.find((b) => b.block === "delivery")!.state).toBe("done");
  });
});
