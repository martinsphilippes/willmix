import { describe, expect, it } from "vitest";
import {
  earliestDeadline,
  groupRequestRows,
  statusCounts,
} from "@/lib/services/request-groups";

/* Lista de solicitações: produtos do mesmo lote viram uma linha só. */
describe("lista agrupada por lote", () => {
  const row = (
    id: string,
    groupId: string | null,
    deadline: string | null = null,
  ) => ({
    id,
    groupId,
    deadline,
  });

  it("junta o lote na posição do primeiro item e mantém a ordem", () => {
    const entries = groupRequestRows([
      row("a", null),
      row("b", "g1"),
      row("c", "g2"),
      row("d", "g1"),
      row("e", null),
    ]);
    expect(
      entries.map((e) =>
        e.kind === "single"
          ? e.row.id
          : `${e.groupId}:${e.rows.map((r) => r.id).join("+")}`,
      ),
    ).toEqual(["a", "g1:b+d", "c", "e"]);
  });

  it("lote com um item só nesta lista vira linha comum", () => {
    const entries = groupRequestRows([row("x", "g9"), row("y", null)]);
    expect(entries.every((e) => e.kind === "single")).toBe(true);
  });

  it("prazo mais próximo e situações com contagem", () => {
    expect(
      earliestDeadline([
        row("a", "g", "2026-10-22"),
        row("b", "g", null),
        row("c", "g", "2026-10-20"),
      ]),
    ).toBe("2026-10-20");
    expect(earliestDeadline([row("a", "g")])).toBe(null);
    expect(statusCounts(["REQUESTED", "RFQ_OPEN", "REQUESTED"])).toEqual([
      { status: "REQUESTED", count: 2 },
      { status: "RFQ_OPEN", count: 1 },
    ]);
  });
});
