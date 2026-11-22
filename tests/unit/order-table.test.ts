import { describe, expect, it } from "vitest";
import {
  INTERNAL_ORDER_COLUMNS,
  ORDER_COLUMNS,
  ORDER_ITEM_COLUMNS,
  orderTermsCells,
} from "@/lib/order-table";

/* Tabelas padrão (dono, 22/11/2026; docs/ORDER_TABLES.md): a ordem das
   colunas e as condições do pedido lidas da solicitação, sem inventar o que
   o portal não tem. */
describe("tabela padrão de pedidos", () => {
  it("as colunas, na ordem do dono", () => {
    expect([...ORDER_COLUMNS]).toEqual([
      "number",
      "negotiationDate",
      "saleType",
      "paymentTerm",
      "paymentMethod",
      "billing",
      "vip",
      "group",
      "customerCode",
      "customerName",
      "status",
      "step",
      "sla",
      "items",
      "deliveries",
      "cbm",
      "value",
      "supplier",
    ]);
    expect([...ORDER_ITEM_COLUMNS].slice(0, 7)).toEqual([
      "sequence",
      "photo",
      "step",
      "status",
      "sla",
      "code",
      "description",
    ]);
    // Quem é de fora não vê cliente, VIP, valor nem fornecedor.
    for (const key of ["customerName", "vip", "value", "supplier"] as const)
      expect(INTERNAL_ORDER_COLUMNS).toContain(key);
  });

  it("condições do pedido: tipo de venda, parcelas, faturamento e VIP", () => {
    const terms = {
      operationType: "ts",
      saleFormat: "wellmix",
      wellmixTier: "mega",
      paymentPlan: {
        planId: "p1",
        name: "30/60/90",
        installments: [
          { percent: 34, event: "delivery", days: 30 },
          { percent: 33, event: "delivery", days: 60 },
          { percent: 33, event: "delivery", days: 90 },
        ],
        monthlyInterestPercent: null,
        requiresApproval: false,
      },
    } as never;
    expect(
      orderTermsCells({ orderTerms: terms, origin: "manual" }, false),
    ).toEqual({
      saleType: "trading",
      installments: 3,
      paymentName: "30/60/90",
      billing: "wellmix",
      vip: "mega",
    });
    // WD não tem nível; sem forma de pagamento, sem parcelas.
    expect(
      orderTermsCells(
        {
          orderTerms: {
            operationType: "ts",
            saleFormat: "wd",
            wellmixTier: "mega",
          } as never,
          origin: "manual",
        },
        false,
      ),
    ).toMatchObject({ billing: "wd", vip: null, installments: null });
    // Estoque da Wellmix e reposição: Wellmix STK, sem condições de venda.
    expect(
      orderTermsCells({ orderTerms: null, origin: "manual" }, true),
    ).toEqual({
      saleType: "stock",
      installments: null,
      paymentName: null,
      billing: null,
      vip: null,
    });
    expect(
      orderTermsCells({ orderTerms: null, origin: "replenishment" }, false)
        .saleType,
    ).toBe("stock");
    // Solicitação antiga, sem condições: nada inventado.
    expect(
      orderTermsCells({ orderTerms: null, origin: "manual" }, false).saleType,
    ).toBeNull();
  });
});
