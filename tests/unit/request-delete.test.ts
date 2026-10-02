import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Excluir solicitações: cancela (sem apagar), encerra cotações, respeita acesso e pedidos. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequest, openRfq, deleteRequests } =
  await import("@/lib/services/requests");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplier: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
});

const newRequest = (user: User) =>
  createRequest(user, {
    customerId: "cliente-joao",
    productId: null,
    productName: "Teste exclusão",
    description: "Teste",
    specification: null,
    quantity: 10,
    unit: "un",
    deadline: null,
  });

describe("excluir solicitações", () => {
  it("cancela várias de uma vez, encerra cotações e guarda auditoria", async () => {
    const store = getStore();
    const a = await newRequest(joao);
    const b = await newRequest(joao);
    await openRfq(admin, b.id, ["fornecedor-a"]);
    const result = await deleteRequests(admin, [a.id, b.id]);
    expect(result).toEqual({ deleted: 2, skipped: 0 });
    expect((await store.get("requests", a.id))!.status).toBe("CANCELLED");
    const quotes = await store.list("quotes", { filter: { requestId: b.id } });
    expect(quotes.every((q) => q.status === "rejected")).toBe(true);
    const audit = await store.list("audit_log", {
      filter: { action: "request.delete", entityId: [a.id, b.id] },
    });
    expect(audit).toHaveLength(2);
    // Já excluída: não conta de novo.
    expect(await deleteRequests(admin, [a.id])).toEqual({
      deleted: 0,
      skipped: 1,
    });
  });

  it("cliente exclui só as próprias; fornecedor não exclui", async () => {
    const own = await newRequest(joao);
    const byWellmix = await newRequest(admin); // sem login solicitante
    expect(await deleteRequests(joao, [own.id, byWellmix.id])).toEqual({
      deleted: 1,
      skipped: 1,
    });
    await expect(deleteRequests(supplier, [byWellmix.id])).rejects.toThrow();
  });

  it("solicitação que virou pedido não é excluída", async () => {
    const store = getStore();
    const r = await newRequest(joao);
    await store.update("requests", r.id, { status: "ORDERED" });
    expect(await deleteRequests(admin, [r.id])).toEqual({
      deleted: 0,
      skipped: 1,
    });
    expect((await store.get("requests", r.id))!.status).toBe("ORDERED");
  });
});
