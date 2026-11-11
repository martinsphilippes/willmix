import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * "Informar câmbio" na linha da tela Financeiro: salva o câmbio do banco do
 * pagamento e volta para a mesma linha (?row=…&fx=saved#fx-…); erro volta para
 * a linha com o código; sem `back=finance`, segue voltando ao pedido. Só o
 * administrador informa.
 */
const h = vi.hoisted(() => ({
  current: null as unknown,
  redirects: [] as string[],
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirects.push(to);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.current,
}));

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const sp = await import("@/lib/services/supplier-payment");
const { loadFinance } = await import("@/lib/services/finance");
const { setSupplierPaymentFxAction } =
  await import("@/app/app/actions/supplier-terms");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let operator: User;
let order: Order;

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const last = () => h.redirects.at(-1);

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  const joao = users.find((u) => u.email === "joao@lojista.com")!;
  // Pedido de verdade: solicitação → pedido com sinal.
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Câmbio informado pela tela Financeiro",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
  });
  order = await orderFromRequest(admin, request, {
    price: 10,
    sellPrice: 9000,
    downPaymentAmount: 2700,
  });
});

describe("informar câmbio pela tela Financeiro", () => {
  it("salva, volta para a linha e o pedido deixa de pedir o câmbio", async () => {
    const payment = await sp.registerSupplierPayment(admin, order.id, {
      method: "manual",
      amount: 100,
      currency: "USD",
    });
    expect(payment.fxRate).toBeNull();
    const before = (await loadFinance()).rows.find(
      (r) => r.order.id === order.id,
    )!;
    expect(before.missingFx.map((p) => p.id)).toContain(payment.id);

    // Operador não informa câmbio (financeiro é do administrador).
    h.current = operator;
    await setSupplierPaymentFxAction(
      form({
        orderId: order.id,
        paymentId: payment.id,
        fxRate: "5,21",
        back: "finance",
      }),
    );
    expect(last()).toBe(
      `/app/finance?row=${order.id}&error=forbidden#fx-${order.id}`,
    );
    expect((await getStore().get("payments", payment.id))!.fxRate).toBeNull();

    // Câmbio vazio: volta para a linha com o erro.
    h.current = admin;
    await setSupplierPaymentFxAction(
      form({
        orderId: order.id,
        paymentId: payment.id,
        fxRate: "",
        back: "finance",
      }),
    );
    expect(last()).toBe(
      `/app/finance?row=${order.id}&error=invalid_fx#fx-${order.id}`,
    );

    // Vírgula decimal, como se digita no Brasil.
    await setSupplierPaymentFxAction(
      form({
        orderId: order.id,
        paymentId: payment.id,
        fxRate: "5,21",
        back: "finance",
      }),
    );
    expect(last()).toBe(`/app/finance?row=${order.id}&fx=saved#fx-${order.id}`);
    expect((await getStore().get("payments", payment.id))!.fxRate).toBe(5.21);
    const after = (await loadFinance()).rows.find(
      (r) => r.order.id === order.id,
    )!;
    expect(after.missingFx.map((p) => p.id)).not.toContain(payment.id);
  });

  it("sem back=finance (tela do pedido) segue voltando aos pagamentos", async () => {
    const payment = await sp.registerSupplierPayment(admin, order.id, {
      method: "manual",
      amount: 50,
      currency: "USD",
    });
    h.current = admin;
    await setSupplierPaymentFxAction(
      form({ orderId: order.id, paymentId: payment.id, fxRate: "5.3" }),
    );
    expect(last()).toBe(`/app/orders/${order.id}?fx=saved#payments`);
    // Outro valor em `back` não vira endereço: volta ao pedido.
    await setSupplierPaymentFxAction(
      form({
        orderId: order.id,
        paymentId: payment.id,
        fxRate: "5.31",
        back: "https://example.com/",
      }),
    );
    expect(last()).toBe(`/app/orders/${order.id}?fx=saved#payments`);
  });
});
