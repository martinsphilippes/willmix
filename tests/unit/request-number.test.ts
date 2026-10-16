import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/* Número da solicitação desde o envio (o lote divide um só) e RFQ do lote inteiro. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequestBatch, createRequest, openBatchRfq, openRfq } =
  await import("@/lib/services/requests");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
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

const inbox = async (user: User) =>
  (await getStore().list("notifications", { filter: { userId: user.id } }))
    .filter((n) => n.channel === "inapp")
    .map((n) => n.subject);

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

describe("RFQ do lote inteiro", () => {
  it("abre uma cotação por produto e avisa cada fornecedor uma vez só", async () => {
    const created = await createRequestBatch(joao, BASE, [
      item("RFQ lote A"),
      item("RFQ lote B"),
    ]);
    const groupId = created[0].groupId!;
    const before = (await inbox(supplierA)).length;

    const result = await openBatchRfq(admin, groupId, [
      "fornecedor-a",
      "fornecedor-b",
      "fornecedor-a",
    ]);
    expect(result).toEqual({ requests: 2, quotes: 4 });

    const store = getStore();
    for (const r of created) {
      const quotes = await store.list("quotes", {
        filter: { requestId: r.id },
      });
      expect(quotes.map((q) => q.supplierId).sort()).toEqual([
        "fornecedor-a",
        "fornecedor-b",
      ]);
      expect((await store.get("requests", r.id))!.status).toBe("RFQ_OPEN");
    }
    const subjects = (await inbox(supplierA)).slice(before);
    expect(subjects).toHaveLength(1);
    expect(subjects[0]).toContain("2 produtos");
    expect(subjects[0]).toContain(`nº ${created[0].number}`);

    // Convidar de novo não duplica cotação nem aviso.
    const again = await openBatchRfq(admin, groupId, ["fornecedor-a"]);
    expect(again.quotes).toBe(0);
    expect((await inbox(supplierA)).length).toBe(before + 1);
  });

  it("só produtos ainda em cotação; nenhum = invalid_status", async () => {
    const created = await createRequestBatch(joao, BASE, [
      item("Status A"),
      item("Status B"),
    ]);
    const groupId = created[0].groupId!;
    await getStore().update("requests", created[0].id, {
      status: "CANCELLED",
    });
    expect(await openBatchRfq(admin, groupId, ["fornecedor-c"])).toEqual({
      requests: 1,
      quotes: 1,
    });
    await getStore().update("requests", created[1].id, {
      status: "CANCELLED",
    });
    await expect(
      openBatchRfq(admin, groupId, ["fornecedor-c"]),
    ).rejects.toThrow("invalid_status");
  });

  it("recusa fornecedor inexistente, outra empresa, lista vazia e quem não é Wellmix", async () => {
    const created = await createRequestBatch(joao, BASE, [
      item("Regra A"),
      item("Regra B"),
    ]);
    const groupId = created[0].groupId!;
    await expect(openBatchRfq(admin, groupId, [])).rejects.toThrow(
      "no_suppliers",
    );
    await expect(
      openBatchRfq(admin, groupId, ["fornecedor-a", "nao-existe"]),
    ).rejects.toThrow("invalid_supplier");
    await expect(
      openBatchRfq(admin, groupId, ["cliente-joao"]),
    ).rejects.toThrow("invalid_supplier");
    await expect(
      openBatchRfq(joao, groupId, ["fornecedor-a"]),
    ).rejects.toThrow();
    await expect(
      openRfq(admin, created[0].id, ["transportador"]),
    ).rejects.toThrow("invalid_supplier");
    // Nada foi criado pelas tentativas recusadas.
    const quotes = await getStore().list("quotes", {
      filter: { requestId: created.map((r) => r.id) },
    });
    expect(quotes).toHaveLength(0);
  });
});
