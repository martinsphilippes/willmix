import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Cores Pantone do cadastro do produto: espelho com a ficha mestre nos dois
   sentidos, sem apagar as cores da ficha quando o produto antigo não tem a coluna. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const ps = await import("@/lib/services/product-sheet");
type User = import("@/lib/db").User;

let admin: User;
const red = { code: "185 C", hex: "#e4002b" };
const black = { code: "Black C", hex: "#2d2926" };

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("Pantone do produto", () => {
  it("ficha mestre com cores espelha no produto (chips e texto)", async () => {
    const store = getStore();
    await ps.saveProductSheet(admin, "prod-jarra", {
      colorPantones: [red, black],
      material: "GLASS",
    });
    const product = (await store.get("products", "prod-jarra"))!;
    expect(product.colorPantones).toEqual([red, black]);
    expect(product.pantone).toBe("185 C / Black C");
  });

  it("produto antigo sem a coluna não apaga as cores da ficha mestre; com a coluna, manda", async () => {
    const store = getStore();
    await ps.saveProductSheet(admin, "prod-panela", { colorPantones: [red] });
    // Linha antiga: sem a chave colorPantones.
    const before = (await store.get("products", "prod-panela"))!;
    const { colorPantones: _c, ...legacy } = before;
    void _c;
    await store.update("products", "prod-panela", {
      ...legacy,
      colorPantones: undefined,
      color: "RED",
    });
    await ps.syncMasterFromProduct("prod-panela");
    expect((await ps.getProductSheet("prod-panela"))!.colorPantones).toEqual([
      red,
    ]);
    // Produto com cores: a ficha mestre acompanha; rascunho de ficha também.
    await store.update("products", "prod-panela", { colorPantones: [black] });
    await ps.syncMasterFromProduct("prod-panela");
    expect((await ps.getProductSheet("prod-panela"))!.colorPantones).toEqual([
      black,
    ]);
    const product = (await store.get("products", "prod-panela"))!;
    expect(ps.productSheetDraft(product, null).colorPantones).toEqual([black]);
  });
});
