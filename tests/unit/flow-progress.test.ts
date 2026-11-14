import { describe, expect, it } from "vitest";
import {
  BOOK_PERCENT,
  bookStep,
  heldStepOf,
  lateDaysSince,
  orderProgress,
  overallOf,
  requestInNegotiation,
  requestPercent,
} from "@/lib/flow-progress";
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

describe("Produto novo: books e solicitações", () => {
  it("book: passo e completude pela situação", () => {
    expect(bookStep("preparing")).toBe("books");
    expect(bookStep("draft")).toBe("books");
    expect(bookStep("closed")).toBe("selection");
    expect(bookStep("in_progress")).toBe("selection");
    expect(bookStep("done")).toBeNull();
    expect(bookStep("cancelled")).toBeNull();
    expect(BOOK_PERCENT.draft).toBe(25);
    expect(BOOK_PERCENT.done).toBe(100);
    expect(BOOK_PERCENT.cancelled).toBeNull();
  });

  it("solicitação: completude e Negociações até a amostra aprovada", () => {
    const r = (
      status: "open" | "answered" | "approved" | "declined" | "cancelled",
      sampling?: "pending" | "submitted" | "approved" | "rejected",
    ) => ({
      status,
      createdAt: "2026-11-14T00:00:00Z",
      sampling: sampling ? { status: sampling } : null,
    });
    expect(requestPercent(r("open"))).toBe(25);
    expect(requestPercent(r("answered"))).toBe(50);
    expect(requestPercent(r("approved"))).toBe(70);
    expect(requestPercent(r("approved", "submitted"))).toBe(85);
    expect(requestPercent(r("approved", "approved"))).toBe(100);
    expect(requestPercent(r("declined"))).toBeNull();
    expect(requestInNegotiation(r("approved", "rejected"))).toBe(true);
    expect(requestInNegotiation(r("approved", "approved"))).toBe(false);
    expect(requestInNegotiation(r("cancelled"))).toBe(false);
  });

  it("atraso em dias (o que passou do prazo já conta 1) e o geral com pedido", () => {
    expect(lateDaysSince("2026-11-14T11:30:00Z", now)).toBe(1);
    expect(lateDaysSince("2026-11-12T12:00:00Z", now)).toBe(2);
    expect(lateDaysSince("2026-11-15T00:00:00Z", now)).toBe(0);
    expect(lateDaysSince(null, now)).toBe(0);
    expect(overallOf(70, 0, 0)).toBe(70);
    expect(overallOf(100, 1, 20)).toBe(40); // (100 + 3 × 20) / 4
  });
});

describe("histórico em espera: passo pela situação", () => {
  it("cada situação cai num passo dos blocos; encerrado e cancelado, fora", () => {
    expect(heldStepOf("ORDER_CREATED")).toBe("order/orders");
    expect(heldStepOf("PACKAGING")).toBe("order/art");
    expect(heldStepOf("SHIPPING")).toBe("production/shipment");
    expect(heldStepOf("CUSTOMS")).toBe("delivery/cargo-presence");
    expect(heldStepOf("TRANSPORT")).toBe("delivery/logistics");
    expect(heldStepOf("CLOSED")).toBeNull();
    expect(heldStepOf("CANCELLED")).toBeNull();
  });
});
