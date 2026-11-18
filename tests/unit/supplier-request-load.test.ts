import { describe, expect, it } from "vitest";
import type { SupplierRequest } from "@/lib/db/schema";
import {
  requestContainersPerRound,
  requestRounds,
} from "@/app/app/supplier-requests/_components/request-load";

/*
 * Lista de Solicitações ao fornecedor no nível da solicitação (dono,
 * 18/11/2026): # programações e containers por programação somando os
 * produtos, sem inventar quando falta a caixa master ou o CBM.
 */
type Line = Pick<SupplierRequest, "id" | "item" | "quantity" | "schedule">;
const line = (
  id: string,
  quantity: number,
  item: Partial<SupplierRequest["item"]>,
  perRound?: number[],
): Line =>
  ({
    id,
    quantity,
    item: item as SupplierRequest["item"],
    schedule: perRound
      ? ({
          intervalDays: 30,
          firstDate: "2026-12-01",
          items: perRound.map((q) => ({ quantity: q, expectedAt: "" })),
        } as unknown as SupplierRequest["schedule"])
      : null,
  }) as Line;

describe("lista de solicitações ao fornecedor: carga por programação", () => {
  it("conta as programações pelo produto com mais rodadas", () => {
    expect(requestRounds([line("a", 10, {})])).toBe(1);
    expect(
      requestRounds([line("a", 10, {}, [5, 5]), line("b", 9, {}, [3, 3, 3])]),
    ).toBe(3);
  });

  it("enche os containers com os produtos de cada programação", () => {
    // 100 caixas de 0,5 m³ por rodada = 50 m³ → 1 container de 68 m³;
    // o outro produto, 40 caixas de 0,5 m³ = 20 m³ → passa para o 2º.
    const a = line(
      "a",
      2000,
      { masterCartonQty: 10, cbmPerCarton: 0.5 },
      [1000, 1000],
    );
    const b = line(
      "b",
      400,
      { masterCartonQty: 10, cbmPerCarton: 0.5 },
      [400, 0],
    );
    expect(requestContainersPerRound([a, b], 68)).toEqual({ min: 1, max: 2 });
  });

  it("sem caixa master ou CBM de algum produto: sem número", () => {
    const a = line("a", 100, { masterCartonQty: 10, cbmPerCarton: 0.5 });
    const b = line("b", 100, { masterCartonQty: null, cbmPerCarton: 0.5 });
    expect(requestContainersPerRound([a, b], 68)).toBeNull();
    expect(requestContainersPerRound([a], null)).toBeNull();
  });
});
