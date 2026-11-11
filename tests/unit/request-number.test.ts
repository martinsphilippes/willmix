import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/* Número da solicitação desde o envio (o lote divide um só). */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequestBatch, createRequest } =
  await import("@/lib/services/requests");
type User = import("@/lib/db").User;

let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

const BASE = { customerId: "cliente-joao", deadline: null, notes: null };

const item = (name: string) => ({
  productId: null,
  productName: name,
  description: `Descrição ${name}`,
  specification: null,
  quantity: 10,
  unit: "un",
  sourcingDemand: false,
});

describe("número da solicitação", () => {
  it("o lote inteiro divide um número; a próxima solicitação ganha o seguinte", async () => {
    const created = await createRequestBatch(joao, BASE, [
      item("Número A"),
      item("Número B"),
      item("Número C"),
    ]);
    expect(created).toHaveLength(3);
    const [n] = new Set(created.map((r) => r.number));
    expect(n).toBeGreaterThan(0);
    expect(new Set(created.map((r) => r.number)).size).toBe(1);

    const single = await createRequest(joao, {
      customerId: "cliente-joao",
      productName: "Número avulso",
      description: "Avulso",
      quantity: 1,
      unit: "un",
    });
    expect(single.number).toBe(n! + 1);
  });

  it("esquema sem a coluna (não publicado): a solicitação nasce sem número", async () => {
    const store = getStore();
    const original = store.create.bind(store);
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (table === "requests" && "number" in (data as object))
          throw new Error(
            'Invalid document structure: Unknown attribute: "number"',
          );
        return original(table, data as never);
      });
    try {
      const request = await createRequest(joao, {
        customerId: "cliente-joao",
        productName: "Sem coluna",
        description: "Esquema antigo",
        quantity: 1,
        unit: "un",
      });
      expect(request.id).toBeTruthy();
      expect(request.number ?? null).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("outro erro do banco não é engolido pelo fallback", async () => {
    const store = getStore();
    const spy = vi
      .spyOn(store, "create")
      .mockRejectedValueOnce(new Error("network down"));
    try {
      await expect(
        createRequest(joao, {
          customerId: "cliente-joao",
          productName: "Falha",
          description: "Falha",
          quantity: 1,
          unit: "un",
        }),
      ).rejects.toThrow("network down");
    } finally {
      spy.mockRestore();
    }
  });
});
