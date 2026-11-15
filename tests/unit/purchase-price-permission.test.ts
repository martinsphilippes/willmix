import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Ver preço de compra (dono, 15/11/2026; docs/LINHA_DE_VISAO.md, seção 7):
 * quem não vê o preço de compra não o edita, e salvar uma tela sem os campos
 * de preço não apaga o preço gravado. Login de teste: Cadastro (sem a
 * permissão por padrão); Comprador e administrador têm.
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
const catalog = await import("@/app/app/actions/catalog");
const variantActions = await import("@/app/app/actions/product-variants");
const { canSeePurchasePrice } = await import("@/lib/auth/function-access");
type User = import("@/lib/db").User;
type Product = import("@/lib/db").Product;

let admin: User;
let cadastro: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  cadastro = await getStore().create("users", {
    email: "cadastro@wellmix.com",
    name: "Célia Cadastro",
    role: "operator",
    partyId: null,
    locale: "pt",
    passwordHash: null,
    active: true,
    importerId: null,
    functions: ["catalog"],
  } as never);
});

/** O formulário do cadastro como a tela de quem não vê o preço envia (sem preço e moeda). */
function formWithoutPrice(p: Product, extra: Record<string, string> = {}) {
  const f = new FormData();
  const v = (x: unknown) => (x === null || x === undefined ? "" : String(x));
  const fields: Record<string, unknown> = {
    id: p.id,
    name: p.name,
    lineId: p.lineId,
    sku: p.sku,
    category: p.category,
    specification: p.specification,
    supplierId: p.supplierId,
    supplierSku: p.supplierSku,
    moq: p.moq,
    material: p.material,
    color: p.color,
    pantone: p.pantone,
    lengthCm: p.lengthCm,
    widthCm: p.widthCm,
    heightCm: p.heightCm,
    netWeightKg: p.netWeightKg,
    grossWeightKg: p.grossWeightKg,
    masterBoxQty: p.masterBoxQty,
    innerBoxQty: p.innerBoxQty,
    boxLengthCm: p.boxLengthCm,
    boxWidthCm: p.boxWidthCm,
    boxHeightCm: p.boxHeightCm,
    cbm: p.cbm,
    notes: p.notes,
  };
  for (const [k, x] of Object.entries({ ...fields, ...extra })) f.set(k, v(x));
  f.append("active", "off");
  f.append("active", "on");
  return f;
}

describe("quem não vê o preço de compra não o apaga nem o muda", () => {
  it("Cadastro não tem a permissão; o administrador tem", () => {
    expect(canSeePurchasePrice(cadastro)).toBe(false);
    expect(canSeePurchasePrice(admin)).toBe(true);
  });

  it("salvar o cadastro sem os campos de preço mantém preço e moeda", async () => {
    const store = getStore();
    const before = (await store.get("products", "prod-panela"))!;
    expect([before.price, before.currency]).toEqual([9.5, "USD"]);
    h.current = cadastro;
    await catalog.updateProductSheetAction(
      formWithoutPrice(before, { material: "Inox 304" }),
    );
    const after = (await store.get("products", "prod-panela"))!;
    // O resto do envio vale; o preço continua o gravado.
    expect(after.material).toBe("Inox 304");
    expect([after.price, after.currency]).toEqual([9.5, "USD"]);
  });

  it("preço enviado à força por quem não vê é ignorado", async () => {
    const store = getStore();
    const before = (await store.get("products", "prod-panela"))!;
    h.current = cadastro;
    await catalog.updateProductSheetAction(
      formWithoutPrice(before, { price: "1", currency: "BRL" }),
    );
    const after = (await store.get("products", "prod-panela"))!;
    expect([after.price, after.currency]).toEqual([9.5, "USD"]);
  });

  it("quem vê muda o preço normalmente", async () => {
    const store = getStore();
    const before = (await store.get("products", "prod-panela"))!;
    h.current = admin;
    await catalog.updateProductSheetAction(
      formWithoutPrice(before, { price: "9.75", currency: "USD" }),
    );
    expect((await store.get("products", "prod-panela"))!.price).toBe(9.75);
  });

  it("faixas de preço: o servidor recusa quem não vê", async () => {
    const store = getStore();
    const before = (await store.get("products", "prod-panela"))!.priceTiers;
    h.current = cadastro;
    h.redirects.length = 0;
    const f = new FormData();
    f.set("productId", "prod-panela");
    f.set("tiers", "100: 1");
    await catalog.saveProductPriceTiersAction(f);
    expect((await store.get("products", "prod-panela"))!.priceTiers).toEqual(
      before,
    );
    expect(h.redirects.join(" ")).toContain("error=");
  });

  it("variação: quem não vê salva o resto e o preço gravado fica", async () => {
    const store = getStore();
    const svc = await import("@/lib/services/product-variants");
    const { variant: created } = await svc.upsertProductVariant(
      admin,
      "prod-panela",
      {
        name: "5 L",
        price: 9.9,
        currency: "USD",
      } as never,
    );
    h.current = cadastro;
    const f = new FormData();
    f.set("productId", "prod-panela");
    f.set("variantId", created.id);
    f.set("name", "5 litros");
    await variantActions.saveProductVariantAction(f);
    const after = (await store.get("product_variants", created.id))!;
    expect(after.name).toBe("5 litros");
    expect([after.price, after.currency]).toEqual([9.9, "USD"]);
  });
});

describe("resumo do requisito Ficha de compra sem o preço", () => {
  it("tira moeda e preço do resumo antigo; texto que não é resumo fica igual", async () => {
    const { sheetSummaryWithoutPrice } =
      await import("@/lib/services/purchase-sheet-calc");
    expect(sheetSummaryWithoutPrice("FOB USD 3 · 5000 pcs · 2.68 m³")).toBe(
      "FOB · 5000 pcs · 2.68 m³",
    );
    expect(sheetSummaryWithoutPrice("EXW RMB 5.1392 · 66000 pcs")).toBe(
      "EXW · 66000 pcs",
    );
    expect(sheetSummaryWithoutPrice("USD 3")).toBe("—");
    expect(sheetSummaryWithoutPrice("FOB · 5000 pcs")).toBe("FOB · 5000 pcs");
    expect(sheetSummaryWithoutPrice("Ficha completa")).toBe("Ficha completa");
  });
});
