import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Sincronização das condições de pagamento com a VW_AD_TIPONEGOCIACAO_WELL
 * (dono, 21/11/2026): a tabela fica igual à view, o que sai deixa os pedidos
 * sem condição, e a view falhando não muda nada.
 */
withTempStore();

let viewRows: Record<string, unknown>[] = [];
let fail = false;
vi.mock("@/lib/integrations/sankhya-client", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/integrations/sankhya-client")
  >()),
  executeQuery: async () => {
    if (fail) throw new Error("gateway");
    return { columns: [], rows: viewRows };
  },
}));

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { syncPaymentConditions, savePaymentConditionRule } =
  await import("@/lib/services/payment-conditions");
type User = import("@/lib/db").User;

let admin: User;
let oldId: string;
let orderId: string;
beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  const store = getStore();
  for (const c of await store.list("payment_conditions"))
    await store.remove("payment_conditions", c.id);
  const old = await store.create("payment_conditions", {
    code: 199,
    name: "20% ANT-80% 150 DAYS AFTER SHIPPING",
    active: true,
    notes: null,
    source: "sankhya",
    updatedByUserId: null,
  });
  oldId = old.id;
  await store.create("payment_conditions", {
    code: 4,
    name: "AMOSTRA",
    active: true,
    notes: "fica",
    source: "sankhya",
    updatedByUserId: null,
  });
  // Pedido mínimo ligado à condição que vai sair (o banco em memória não
  // confere os campos obrigatórios).
  const order = await store.create("orders", {
    number: 9001,
    paymentConditionId: oldId,
  } as never);
  orderId = order.id;
});

describe("syncPaymentConditions", () => {
  it("view falhando ou vazia não muda nada", async () => {
    fail = true;
    await expect(syncPaymentConditions(admin)).rejects.toThrow("view_failed");
    fail = false;
    viewRows = [];
    await expect(syncPaymentConditions(admin)).rejects.toThrow("view_empty");
    expect(await getStore().list("payment_conditions")).toHaveLength(2);
  });

  it("troca a tabela pela view e limpa as ligações das que saem", async () => {
    viewRows = [
      { CODTIPVENDA: 4, DESCRTIPVENDA: "AMOSTRA", ATIVO: "S", SUBTIPOVENDA: 1 },
      { CODTIPVENDA: 12, DESCRTIPVENDA: "30/60/90 DIAS", ATIVO: "S", SUBTIPOVENDA: 3 },
      { CODTIPVENDA: 258, DESCRTIPVENDA: "10% SIN, 40% EMB, 50% REGISTRO", ATIVO: "S" },
      { CODTIPVENDA: 259, DESCRTIPVENDA: "20% SIN, 70% EMBQ", ATIVO: "S" },
    ];
    const r = await syncPaymentConditions(admin);
    expect(r).toMatchObject({
      created: 3,
      updated: 1,
      removed: 1,
      unlinked: 1,
      review: 1,
      missing: [],
    });
    const store = getStore();
    const all = await store.list("payment_conditions");
    expect(all.map((c) => c.code).sort((a, b) => a - b)).toEqual([4, 12, 258, 259]);
    const amostra = all.find((c) => c.code === 4)!;
    expect(amostra.notes).toBe("fica");
    expect(amostra.scheduleKind).toBe("time");
    expect(amostra.installments).toEqual([{ percent: 100, base: "invoice", days: 0 }]);
    expect(all.find((c) => c.code === 258)!.scheduleKind).toBe("event");
    expect(all.find((c) => c.code === 259)!.scheduleProblem).toBe("percent_sum");
    expect((await store.get("orders", orderId))!.paymentConditionId).toBeNull();
  });

  it("a regra do administrador corrige e sobrevive à próxima sincronização", async () => {
    const store = getStore();
    const c259 = (await store.list("payment_conditions")).find((c) => c.code === 259)!;
    const fixed = await savePaymentConditionRule(
      admin,
      c259.id,
      "20% SIN, 70% EMB, 10% ENTREGA",
    );
    expect(fixed.scheduleProblem).toBeNull();
    const r = await syncPaymentConditions(admin);
    expect(r.review).toBe(0);
    const again = await store.get("payment_conditions", c259.id);
    expect(again!.scheduleRule).toBe("20% SIN, 70% EMB, 10% ENTREGA");
    expect(again!.installments).toHaveLength(3);
  });
});
