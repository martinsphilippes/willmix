import { describe, expect, it } from "vitest";
import { translator } from "@/i18n";
import { elsewhereOf, openSummary } from "@/lib/flow-open-summary";
import type { FlowEntityItem } from "@/lib/services/flow";

/*
 * "Todos no passo" com a linha fina (dono, 24/11/2026): o que está aberto
 * numa linha só, com o passo de origem uma vez, os itens sem o nome do
 * produto e os produtos à parte, para o "ver mais".
 */
const t = translator("pt");
const req = (key: string, step: string, label: string): FlowEntityItem =>
  ({
    kind: "requirement",
    requirement: { key, step, label, status: "pending", role: "operator" },
  }) as unknown as FlowEntityItem;
const product = "VARAL DE ROUPAS DOBRAVEL FERRO 3 ANDARES";
const registry = [
  req("ncm_validated__i1", "registry/products", `NCM validado · ${product}`),
  req(
    "sheet_complete__i1",
    "registry/products",
    `Ficha mestre completa · ${product}`,
  ),
  req(
    "approval_registration",
    "registry/products",
    "Cadastro e fiscal aprovados pelo GP",
  ),
];

describe("o aberto do pedido numa linha", () => {
  it("o passo de origem uma vez, os itens sem o produto e o produto à parte", () => {
    const summary = openSummary(registry, t, "order/orders");
    expect(summary.text).toBe(
      "Cadastros → Produtos: NCM validado, Ficha mestre completa, Cadastro e fiscal aprovados pelo GP",
    );
    expect(summary.products).toEqual([product]);
    expect(elsewhereOf(registry[0], "order/orders")).toBe("registry/products");
    expect(elsewhereOf(registry[0], "registry/products")).toBeNull();
  });

  it("os itens do próprio passo vêm primeiro; o repetido vira ×2", () => {
    const own = [
      req("die_cut__a", "order/art-material", "Faca (die cut) · Copo A"),
      req("die_cut__b", "order/art-material", "Faca (die cut) · Copo B"),
    ];
    const summary = openSummary([registry[1], ...own], t, "order/art-material");
    expect(summary.text).toBe(
      "Faca (die cut) ×2; Cadastros → Produtos: Ficha mestre completa",
    );
    expect(summary.products).toEqual([product, "Copo A", "Copo B"]);
  });
});
