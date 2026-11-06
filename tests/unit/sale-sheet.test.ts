import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/db";
import { buildSaleLines, saleTotals } from "@/lib/services/sale-sheet";

const product = {
  id: "p1",
  name: "Jarra",
  sku: "UTL-001",
  supplierSku: "F-9",
  specification: "1,5 L",
  color: "Transparente",
  masterBoxQty: 12,
  cbm: 0.05,
  grossWeightKg: 0.5,
  primaryPhotoDocumentId: "doc-1",
} as unknown as Product;

describe("pedido de venda em lista", () => {
  it("uma linha por produto, com caixas, volume, peso, preço e entregue", () => {
    const lines = buildSaleLines({
      orders: [
        {
          id: "o2",
          number: 2,
          status: "DELIVERED",
          sellPrice: 1000,
          sellCurrency: "BRL",
          fobCurrency: "USD",
          notes: null,
        },
        {
          id: "o1",
          number: 1,
          status: "PACKAGING",
          sellPrice: null,
          sellCurrency: null,
          fobCurrency: "USD",
          notes: "urgente",
        },
      ],
      items: [
        {
          orderId: "o1",
          productId: null,
          name: "Avulso",
          quantity: 5,
          unit: "un",
          variant: null,
          unitPrice: 2,
        },
        {
          orderId: "o2",
          productId: "p1",
          name: "Jarra",
          quantity: 100,
          unit: "un",
          variant: null,
          unitPrice: 2,
        },
      ],
      products: [product],
      requests: [
        { orderId: "o2", specification: null, notes: "caixa de cores" },
      ],
      photos: [],
    });
    expect(lines.map((l) => l.orderNumber)).toEqual([1, 2]);
    const jarra = lines[1];
    expect(jarra).toMatchObject({
      boxes: 9,
      cbm: 0.45,
      weightKg: 50,
      unitPrice: 10,
      amount: 1000,
      delivered: 100,
      sku: "UTL-001",
      supplierSku: "F-9",
      photoDocumentId: "doc-1",
      notes: "caixa de cores",
    });
    expect(lines[0]).toMatchObject({
      amount: null,
      delivered: 0,
      notes: "urgente",
    });
    const totals = saleTotals(lines);
    expect(totals.quantity).toBe(105);
    expect(totals.delivered).toBe(100);
    expect(totals.amounts.get("BRL")).toBe(1000);
  });

  it("variação manda na caixa, no volume e no código do item", () => {
    const [l] = buildSaleLines({
      orders: [
        {
          id: "o",
          number: 7,
          status: "CANCELLED",
          sellPrice: 50,
          sellCurrency: "USD",
          fobCurrency: "USD",
          notes: null,
        },
      ],
      items: [
        {
          orderId: "o",
          productId: "p1",
          name: "Jarra",
          quantity: 10,
          unit: "un",
          unitPrice: 2,
          variant: {
            id: "v",
            name: "2 L",
            factoryItemCode: "F-9-2",
            price: null,
            currency: null,
            moq: null,
            masterBoxQty: 4,
            innerBoxQty: null,
            netWeightKg: null,
            grossWeightKg: 1,
            lengthCm: null,
            widthCm: null,
            heightCm: null,
            cbm: 0.1,
            colorAssortment: null,
          } as never,
        },
      ],
      products: [product],
      requests: [],
      photos: [],
    });
    expect(l).toMatchObject({
      variantName: "2 L",
      supplierSku: "F-9-2",
      boxes: 3,
      cbm: 0.3,
      weightKg: 10,
      delivered: 0,
    });
    // Pedido cancelado não soma no valor.
    expect(saleTotals([l]).amounts.size).toBe(0);
  });

  it("fornecedor: preço FOB do item e embarcado conta como entregue", () => {
    const [l] = buildSaleLines({
      orders: [
        {
          id: "o",
          number: 3,
          status: "CUSTOMS",
          sellPrice: 9000,
          sellCurrency: "BRL",
          fobCurrency: "USD",
          notes: null,
        },
      ],
      items: [
        {
          orderId: "o",
          productId: "p1",
          name: "Jarra",
          quantity: 100,
          unit: "un",
          variant: null,
          unitPrice: 1.5,
        },
      ],
      products: [product],
      requests: [],
      photos: [],
      side: "supplier",
    });
    expect(l).toMatchObject({
      unitPrice: 1.5,
      amount: 150,
      currency: "USD",
      delivered: 100,
    });
  });
});
