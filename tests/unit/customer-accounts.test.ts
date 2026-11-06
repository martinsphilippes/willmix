import { describe, expect, it } from "vitest";
import {
  accountTotals,
  orderRow,
  sumTotals,
} from "@/lib/services/customer-accounts";
import type { OrderFinance } from "@/lib/services/finance";
import type { Payment } from "@/lib/db";

const fin = (
  status: string,
  sell: number,
  received: number,
  currency = "BRL",
): OrderFinance =>
  ({
    order: {
      id: `o-${status}-${sell}`,
      number: 1,
      createdAt: "2026-10-01",
      status,
    },
    productName: "Jarra",
    sellCurrency: currency,
    sell,
    received,
    receivable: sell - received,
  }) as unknown as OrderFinance;

const pay = (over: Partial<Payment>): Payment =>
  ({
    direction: "customer_in",
    orderId: null,
    requestId: "r1",
    amount: 100,
    currency: "BRL",
    status: "confirmed",
    ...over,
  }) as Payment;

const supp = (status: string, fob: number, paid: number): OrderFinance =>
  ({
    order: { id: `s-${status}`, number: 2, createdAt: "2026-10-02", status },
    productName: "Jarra",
    sellCurrency: "BRL",
    sell: 99999,
    received: 0,
    receivable: 99999,
    fobCurrency: "USD",
    fob,
    paid,
    payable: fob - paid,
  }) as unknown as OrderFinance;

describe("conta do fornecedor", () => {
  it("FOB, embarcado, antecipado, a pagar e pago (em dólar)", () => {
    const rows = [
      supp("CUSTOMS", 1000, 1000), // embarcado e pago
      supp("PACKAGING", 500, 150), // antes do embarque: 150 antecipado
    ].map((f) => orderRow(f, "supplier"));
    expect(rows[0].delivery).toBe("delivered");
    expect(rows[0].receipt).toBe("paid");
    expect(rows[1].delivery).toBe("in_progress");
    const t = accountTotals(rows);
    expect(t.contract).toEqual({ USD: 1500 });
    expect(t.delivered).toEqual({ USD: 1000 });
    expect(t.prepaid).toEqual({ USD: 150 });
    expect(t.receivable).toEqual({ USD: 350 });
    expect(t.received).toEqual({ USD: 1150 });
  });
});

describe("conta do cliente", () => {
  it("contrato, entregue, antecipado, a receber e recebido", () => {
    const rows = [
      fin("DELIVERED", 1000, 600), // entregue, falta 400
      fin("SHIPPING", 500, 200), // em andamento: 200 antecipado
      fin("CANCELLED", 300, 50), // fora do contrato; o recebido conta
    ].map((f) => orderRow(f));
    const t = accountTotals(rows, [
      pay({ amount: 100 }), // sinal da solicitação: antecipado e recebido
      pay({ amount: 999, status: "pending" }), // não confirmado: fora
      pay({ amount: 999, orderId: "o1" }), // de pedido: já está no pedido
    ]);
    expect(t.contract).toEqual({ BRL: 1500 });
    expect(t.delivered).toEqual({ BRL: 1000 });
    expect(t.prepaid).toEqual({ BRL: 300 });
    expect(t.receivable).toEqual({ BRL: 700 });
    expect(t.received).toEqual({ BRL: 950 });
  });

  it("situação do recebimento e da entrega", () => {
    expect(orderRow(fin("CLOSED", 100, 100)).receipt).toBe("paid");
    expect(orderRow(fin("CLOSED", 100, 100)).delivery).toBe("delivered");
    expect(orderRow(fin("PACKAGING", 100, 30)).receipt).toBe("partial");
    expect(orderRow(fin("PACKAGING", 100, 0)).receipt).toBe("open");
    expect(orderRow(fin("PACKAGING", 100, 0)).delivery).toBe("in_progress");
    expect(orderRow(fin("CANCELLED", 100, 0)).receipt).toBe("cancelled");
  });

  it("moedas não se misturam", () => {
    const a = accountTotals([orderRow(fin("SHIPPING", 100, 0, "USD"))]);
    const b = accountTotals([orderRow(fin("SHIPPING", 200, 0, "BRL"))]);
    expect(sumTotals([a, b]).contract).toEqual({ USD: 100, BRL: 200 });
  });
});
