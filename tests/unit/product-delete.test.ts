import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Cadastro de produtos: excluir (desativar) e restaurar vários de uma vez. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setProductsActive } = await import("@/lib/services/product-delete");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

describe("excluir produtos em lote", () => {
  it("desativa os selecionados, registra na auditoria e restaura", async () => {
    const store = getStore();
    const products = (
      await store.list("products", { filter: { active: true } })
    ).slice(0, 2);
    const ids = products.map((p) => p.id);
    const result = await setProductsActive(
      admin,
      [...ids, ids[0], "nao-existe"],
      false,
    );
    expect(result.changed).toBe(2);
    for (const id of ids)
      expect((await store.get("products", id))!.active).toBe(false);
    const log = await store.list("audit_log", {
      filter: { action: "product.delete" },
    });
    expect(log.map((l) => l.entityId).sort()).toEqual([...ids].sort());
    // De novo: nada muda.
    expect((await setProductsActive(admin, ids, false)).changed).toBe(0);
    // Restaurar.
    expect((await setProductsActive(admin, ids, true)).changed).toBe(2);
    for (const id of ids)
      expect((await store.get("products", id))!.active).toBe(true);
  });

  it("cliente não exclui produto", async () => {
    const [p] = await getStore().list("products", { limit: 1 });
    await expect(setProductsActive(joao, [p.id], false)).rejects.toThrow();
    expect((await getStore().get("products", p.id))!.active).toBe(true);
  });
});
