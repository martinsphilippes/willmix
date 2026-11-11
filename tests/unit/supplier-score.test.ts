import { describe, expect, it } from "vitest";
import { gradeOf, scoreSupplier } from "@/lib/services/supplier-score";

const empty = {
  orders: [],
  tracks: [],
  inspections: [],
  receivings: [],
  artIssues: [],
  quotes: [],
  today: "2026-11-06",
};

describe("avaliação de fornecedores", () => {
  it("sem dados não há nota", () => {
    const s = scoreSupplier(empty);
    expect(s.score).toBeNull();
    expect(s.grade).toBeNull();
    // Só ter pedidos (arte sem problema) também não basta.
    const o = scoreSupplier({
      ...empty,
      orders: [{ id: "o1", status: "PACKAGING" }],
    });
    expect(o.score).toBeNull();
  });

  it("calcula cada critério e a média", () => {
    const s = scoreSupplier({
      orders: [
        { id: "o1", status: "DELIVERED" },
        { id: "o2", status: "PACKAGING" },
        { id: "x", status: "CANCELLED" },
      ],
      tracks: [
        { orderId: "o1", etdOriginal: "2026-09-01", etd: "2026-09-01" },
        { orderId: "o2", etdOriginal: "2026-10-01", etd: "2026-10-11" },
        { orderId: "x", etdOriginal: "2026-10-01", etd: "2026-12-01" },
      ],
      inspections: [
        { orderId: "o1", round: 1, result: "approved" },
        { orderId: "o1", round: 1, result: "approved" },
        { orderId: "o1", round: 1, result: "approved" },
        { orderId: "o1", round: 1, result: "rejected" },
        { orderId: "o1", round: 2, result: "approved" },
      ],
      receivings: [
        {
          orderId: "o1",
          closedAt: "2026-10-20T10:00:00.000Z",
          items: [
            {
              orderItemId: "i1",
              expected: 100,
              received: 98,
              damaged: 3,
              note: null,
            },
          ],
        },
        // Aberto: não conta.
        {
          orderId: "o2",
          closedAt: null,
          items: [
            {
              orderItemId: "i2",
              expected: 100,
              received: 0,
              damaged: 0,
              note: null,
            },
          ],
        },
      ],
      artIssues: [{ orderId: "o2" }],
      today: "2026-11-06",
      quotes: [
        // Convite de ontem, sem resposta: ainda no prazo, não conta.
        {
          createdAt: "2026-11-05T10:00:00.000Z",
          answeredAt: null,
        },
        {
          createdAt: "2026-08-01T10:00:00.000Z",
          answeredAt: "2026-08-03T10:00:00.000Z",
        },
        {
          createdAt: "2026-08-01T10:00:00.000Z",
          answeredAt: null,
        },
      ],
    });
    expect(s.orders).toBe(2);
    expect(s.onTime).toMatchObject({ n: 2, pct: 50, avgDelayDays: 5 });
    expect(s.inspection).toMatchObject({ n: 4, pct: 75 });
    expect(s.receiving).toMatchObject({ n: 100, pct: 95 });
    expect(s.art).toMatchObject({ n: 2, pct: 50 });
    expect(s.quotes).toMatchObject({ n: 2, pct: 50, avgDays: 2 });
    expect(s.score).toBe(64);
    expect(s.grade).toBe("C");
  });

  it("letras", () => {
    expect(gradeOf(90)).toBe("A");
    expect(gradeOf(89.9)).toBe("B");
    expect(gradeOf(75)).toBe("B");
    expect(gradeOf(60)).toBe("C");
    expect(gradeOf(59.9)).toBe("D");
  });
});
