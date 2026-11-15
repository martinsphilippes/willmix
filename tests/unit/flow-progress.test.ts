import { describe, expect, it } from "vitest";
import {
  BOOK_PERCENT,
  bookStep,
  lateDaysSince,
  orderProgress,
  overallOf,
  requestInNegotiation,
  requestPercent,
} from "@/lib/flow-progress";
import type { MilestoneKey } from "@/lib/milestones";

/* Completude e atraso do pedido por bloco (docs/FLOW_MENU.md, "Visão do
   pedido entre os blocos"). Fase 5g: pelos 16 marcos (a situação de cada
   um e as datas gravadas), não pelas etapas. */
const view = (
  k: MilestoneKey,
  s: "done" | "active" | "waiting" | "na",
  d = 0,
  t = 1,
) => ({ k, s, d, t });
const row = (
  key: MilestoneKey,
  status: string,
  extra: { dueAt?: string; startedAt?: string; completedAt?: string } = {},
) => ({ key, status, ...extra });

const now = new Date("2026-11-14T12:00:00Z");

describe("completude do pedido por bloco", () => {
  it("média dos marcos que se aplicam no bloco e no geral", () => {
    const p = orderProgress(
      [
        view("new-order", "done", 2, 2),
        view("certification", "na", 0, 0),
        view("art-material", "na", 0, 0),
        view("art", "done", 2, 2),
        view("contract", "active", 2, 5),
        view("down-payment", "waiting"),
        view("pre-production", "waiting"),
        view("inspection", "waiting"),
        view("samples", "na", 0, 0),
        view("production", "waiting"),
        view("booking", "waiting"),
        view("loading", "waiting"),
        view("shipment", "waiting"),
        view("customs", "waiting"),
        view("invoice-transport", "waiting"),
        view("delivery", "waiting"),
      ],
      [],
      now,
    );
    const order = p.blocks.find((b) => b.block === "order")!;
    expect(order.percent).toBe(60); // (100 + 100 + 40 + 0) / 4
    expect(order.state).toBe("active");
    expect(order.milestones.map((s) => s.key)).toEqual([
      "new-order",
      "art",
      "contract",
      "down-payment",
    ]);
    expect(p.blocks.find((b) => b.block === "production")!.percent).toBe(0);
    expect(p.overall).toBe(18); // 240 / 13
    expect(p.current).toBe("order");
  });

  it("atraso agora e marco concluído depois do prazo (prazos gravados)", () => {
    const p = orderProgress(
      [
        view("inspection", "done"),
        view("shipment", "active", 1, 2),
        view("customs", "na", 0, 0),
      ],
      [
        row("inspection", "done", {
          dueAt: "2026-11-01T00:00:00Z",
          completedAt: "2026-11-04T00:00:00Z",
        }),
        row("shipment", "active", {
          dueAt: "2026-11-10T12:00:00Z",
          startedAt: "2026-11-04T00:00:00Z",
        }),
      ],
      now,
    );
    const prod = p.blocks.find((b) => b.block === "production")!;
    expect(prod.lateDays).toBe(4);
    expect(prod.doneLate).toBe(1);
    expect(prod.milestones[0].doneLateDays).toBe(3);
    expect(prod.percent).toBe(75);
    expect(prod.startedAt).toBe("2026-11-04T00:00:00Z");
    expect(p.lateDays).toBe(4);
    expect(p.current).toBe("production");
    // Marco que não se aplica não conta.
    expect(p.blocks.find((b) => b.block === "delivery")!.milestones).toEqual(
      [],
    );
  });

  it("pedido concluído: tudo 100%, bloco atual é a Entrega", () => {
    const p = orderProgress(
      [view("invoice-transport", "done"), view("delivery", "done")],
      [],
      now,
    );
    expect(p.overall).toBe(100);
    expect(p.current).toBe("delivery");
    expect(p.blocks.find((b) => b.block === "delivery")!.state).toBe("done");
  });

  it("sem a situação, as linhas gravadas decidem (sem linha: não começou)", () => {
    const p = orderProgress(null, [row("new-order", "done")], now);
    const order = p.blocks.find((b) => b.block === "order")!;
    expect(order.milestones[0]).toMatchObject({
      key: "new-order",
      state: "done",
      percent: 100,
    });
    expect(order.milestones[1]).toMatchObject({ state: "pending", percent: 0 });
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
