import { describe, expect, it } from "vitest";
import { applyFunctionDraft, functionImpact } from "@/lib/access-impact";
import { resolveFunctions } from "@/lib/auth/function-access";
import { functionScreenMarksOf } from "./access-impact-helpers";

/*
 * Prévia de impacto antes de salvar uma função (docs/EQUIPE_ACESSOS.md, R1 e
 * etapa 5b): quem é afetado e o que cada um ganha ou perde, sem gravar nada,
 * com as mesmas regras das requisições (várias funções, ajuste individual e o
 * administrador que nunca muda).
 */

const defs = resolveFunctions(null);
const buyer = defs.find((d) => d.key === "buyer")!;
const marks = functionScreenMarksOf(buyer);
const team = [
  { id: "a", name: "Ana", role: "operator", functions: ["buyer"] },
  { id: "b", name: "Beto", role: "operator", functions: ["buyer", "designer"] },
  {
    id: "c",
    name: "Caio",
    role: "operator",
    functions: ["buyer"],
    screenExceptions: { added: ["finance"], removed: [] },
  },
  { id: "d", name: "Dani", role: "operator", functions: ["planner"] },
  { id: "e", name: "Eva", role: "admin", functions: ["buyer"] },
] as never[];

describe("prévia de impacto de uma função", () => {
  it("o rascunho troca só a função escolhida, como o salvar", () => {
    const next = applyFunctionDraft(defs, "buyer", {
      screens: [...marks, "finance"],
      actions: buyer.actions,
    });
    expect(next.find((d) => d.key === "buyer")!.screens).toContain("finance");
    expect(next.find((d) => d.key === "planner")).toEqual(
      defs.find((d) => d.key === "planner"),
    );
  });

  it("sem mudança: ninguém aparece", () => {
    const impact = functionImpact(team, defs, "buyer", {
      screens: marks,
      actions: buyer.actions,
    });
    // Quem tem a função (o administrador não conta: abre tudo).
    expect(impact.holders).toBe(3);
    expect(impact.rows).toEqual([]);
  });

  it("dar uma tela: ganha quem tem a função e ainda não abria", () => {
    const impact = functionImpact(team, defs, "buyer", {
      screens: [...marks, "finance"],
      actions: buyer.actions,
    });
    // Caio já abria pelo ajuste individual; Dani não tem a função; Eva é admin.
    expect(impact.rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(impact.rows[0]).toMatchObject({
      gainedScreens: ["finance"],
      lostScreens: [],
    });
  });

  it("tirar uma tela: perde só quem não tem outra função que a libera", () => {
    const impact = functionImpact(team, defs, "buyer", {
      screens: marks.filter((s) => s !== "orders"),
      actions: buyer.actions,
    });
    const ids = impact.rows.map((r) => r.id);
    // Beto continua com Pedidos pela função Designer.
    expect(ids).toContain("a");
    expect(ids).not.toContain("b");
    expect(impact.rows.find((r) => r.id === "a")!.lostScreens).toEqual([
      "orders",
    ]);
  });

  it("ações: ganha e perde pela função", () => {
    const impact = functionImpact(team, defs, "buyer", {
      screens: marks,
      actions: [...buyer.actions, "art.design"],
    });
    // Beto já faz artes pela função Designer.
    expect(impact.rows.map((r) => r.id)).toEqual(["a", "c"]);
    expect(impact.rows[0].gainedActions).toEqual(["art.design"]);
  });
});
