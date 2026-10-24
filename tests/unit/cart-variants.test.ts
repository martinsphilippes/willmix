import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Vitrine e carrinho com variações de produto (fase 3): a página do produto
 * lista as variações com preço estimado e mínimo (nada confidencial chega ao
 * cliente), o carrinho exige a variação, separa as linhas por variação, usa o
 * mínimo dela, e o envio cria uma solicitação por linha com o nome "Produto ·
 * Variação" e o variantId. Produto sem variações continua exatamente igual.
 */
withTempStore();

const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const { translator } = await import("@/i18n");
const cart = await import("@/lib/services/cart");
const explore = await import("@/lib/services/catalog-explore");
const pv = await import("@/lib/services/product-variants");
type User = import("@/lib/db").User;
type ProductVariant = import("@/lib/db").ProductVariant;

const t = translator("pt");
let admin: User;
let joao: User;
let productId: string;
/** GRECIE 4X6: a mais barata (referência), mínimo 100. */
let small: ProductVariant;
/** STONE MARBLE A4: mais cara, mínimo 300. */
let large: ProductVariant;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  // Conta completa para o preço sair: câmbio, frete, ICMS e II/IPI.
  await setSetting("fxManualRates", { USD: 5, RMB: null, EUR: null });
  await setSetting("freightPerCbm", 100);
  await setSetting("freightCurrency", "USD");
  await setSetting("icmsPercent", 18);
  const store = getStore();
  const line = (await store.list("product_lines", { orderBy: "name" }))[0];
  const product = await store.create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId: line.id,
    name: "Porta-retrato",
    sku: null,
    specification: null,
    active: true,
    source: "manual",
    category: "Decoração",
  });
  productId = product.id;
  await store.create("tax_classifications", {
    productId,
    ncm: "44140000",
    description: null,
    taxes: { II: 18, IPI: 5 },
    adminTreatment: null,
    notes: null,
    source: "manual",
    sourceRef: null,
    status: "validated",
    suggestedByUserId: null,
    validatedByUserId: admin.id,
    validatedAt: new Date().toISOString(),
  });
  small = (
    await pv.upsertProductVariant(admin, productId, {
      name: "GRECIE 4X6",
      factoryItemCode: "G46",
      sizeText: "4X6",
      price: 2,
      currency: "USD",
      moq: 100,
      masterBoxQty: 48,
      cbm: 0.03,
      colorAssortment: "White / Gray",
      sortOrder: 0,
    })
  ).variant;
  large = (
    await pv.upsertProductVariant(admin, productId, {
      name: "STONE MARBLE A4",
      factoryItemCode: "SMA4",
      sizeText: "A4",
      price: 5,
      currency: "USD",
      moq: 300,
      masterBoxQty: 24,
      cbm: 0.05,
      sortOrder: 1,
    })
  ).variant;
  // Como as ações fazem: o produto e a ficha mestre espelham a referência.
  await pv.syncProductFromVariants(productId, admin);
});

describe("vitrine com variações", () => {
  it("página do produto: variações com preço estimado, mínimo e especificação; nada confidencial ao cliente", async () => {
    const detail = (await explore.exploreProduct(joao, productId, t))!;
    expect(detail.variants.map((v) => v.name)).toEqual([
      "GRECIE 4X6",
      "STONE MARBLE A4",
    ]);
    const [a, b] = detail.variants;
    expect([a.moq, b.moq]).toEqual([100, 300]);
    expect(a.estimate.ok && b.estimate.ok).toBe(true);
    if (a.estimate.ok && b.estimate.ok) {
      expect(a.estimate.unitBrl).toBeLessThan(b.estimate.unitBrl);
      // "A partir de": a mais barata.
      expect(detail.priceFrom).toBe(a.estimate.unitBrl);
    }
    // O preço do produto em si é o da variação de referência (espelho da fase 1).
    expect(detail.estimate.ok && detail.estimate.unitBrl).toBe(
      detail.priceFrom,
    );
    // Só o que o cliente pode ver: sem fornecedor, FOB, moeda nem código.
    for (const v of detail.variants)
      expect(Object.keys(v).sort()).toEqual([
        "estimate",
        "id",
        "moq",
        "name",
        "photoDocumentId",
        "specification",
      ]);
    expect(a.specification).toEqual([
      "Tamanho: 4X6",
      "Cores: White / Gray",
      "Unidades por caixa master: 48",
    ]);
    expect(JSON.stringify(detail.variants)).not.toMatch(/G46|SMA4|USD/);
    // Na grade: as mesmas variações e o "a partir de" do cartão.
    const { items } = await explore.exploreCatalog(joao, {});
    const card = items.find((p) => p.id === productId)!;
    expect(card.variants.map((v) => v.id)).toEqual([small.id, large.id]);
    expect(card.priceFrom).toBe(detail.priceFrom);
    // Produto sem variações: lista vazia e sem "a partir de".
    const panela = items.find((p) => p.id === "prod-panela")!;
    expect([panela.variants, panela.priceFrom]).toEqual([[], null]);
    // A busca acha o produto pelo nome da variação.
    expect(
      (await explore.exploreCatalog(joao, { q: "marble" })).items.map(
        (p) => p.id,
      ),
    ).toEqual([productId]);
  });

  it("variação sem preço: sob consulta para o cliente (sem o motivo); a Wellmix vê o que falta; desativada some", async () => {
    const { variant } = await pv.upsertProductVariant(admin, productId, {
      name: "SEM PREÇO",
      sortOrder: 2,
    });
    const forJoao = (await explore.exploreProduct(
      joao,
      productId,
      t,
    ))!.variants.find((v) => v.id === variant.id)!;
    expect(forJoao.estimate).toEqual({ ok: false, missing: [] });
    // Sem mínimo próprio: vale o da ficha mestre (a referência, 100).
    expect(forJoao.moq).toBe(100);
    const forAdmin = (await explore.exploreProduct(
      admin,
      productId,
      t,
    ))!.variants.find((v) => v.id === variant.id)!;
    expect(!forAdmin.estimate.ok && forAdmin.estimate.missing).toContain(
      "price",
    );
    await pv.setProductVariantActive(admin, variant.id, false);
    expect(
      (await explore.exploreProduct(joao, productId, t))!.variants.map(
        (v) => v.id,
      ),
    ).toEqual([small.id, large.id]);
  });
});

describe("carrinho com variações", () => {
  it("produto com variações exige a variação; ela tem de ser dele e estar ativa", async () => {
    await expect(cart.addToCart(joao, productId, 100)).rejects.toThrow(
      "cart_variant_required",
    );
    await expect(
      cart.addToCart(joao, productId, 100, null, "nao-existe"),
    ).rejects.toThrow("cart_variant_invalid");
    // Produto sem variações não aceita variação nenhuma (nem de outro produto).
    await expect(
      cart.addToCart(joao, "prod-panela", 500, null, small.id),
    ).rejects.toThrow("cart_variant_invalid");
    await expect(
      cart.requestProductNow(joao, productId, 100, null, t),
    ).rejects.toThrow("cart_variant_required");
    expect(await cart.cartCount(joao)).toBe(0);
  });

  it("o mínimo é o da variação; duas variações do mesmo produto são duas linhas", async () => {
    await expect(
      cart.addToCart(joao, productId, 99, null, small.id),
    ).rejects.toThrow("cart_below_moq");
    await expect(
      cart.addToCart(joao, productId, 299, null, large.id),
    ).rejects.toThrow("cart_below_moq");
    await cart.addToCart(joao, productId, 100, "Logo", small.id);
    await cart.addToCart(joao, productId, 300, null, large.id);
    // A mesma variação de novo soma na mesma linha.
    await cart.addToCart(joao, productId, 100, null, small.id);
    const view = await cart.cartView(joao);
    expect(view.lines.map((l) => [l.variantId, l.quantity, l.moq])).toEqual([
      [small.id, 200, 100],
      [large.id, 300, 300],
    ]);
    expect(view.lines.map((l) => l.variantName)).toEqual([
      "GRECIE 4X6",
      "STONE MARBLE A4",
    ]);
    expect(view.lines[0].notes).toBe("Logo");
    expect(
      view.lines.every(
        (l) =>
          l.estimate.ok &&
          l.subtotal !== null &&
          !l.belowMoq &&
          !l.unavailable &&
          !l.variantUnavailable,
      ),
    ).toBe(true);
    expect(view.complete).toBe(true);
    // Cada linha com o próprio preço: a variação cara custa mais por unidade.
    const [a, b] = view.lines;
    expect(
      a.estimate.ok && b.estimate.ok && a.estimate.unitBrl < b.estimate.unitBrl,
    ).toBe(true);
    expect(await cart.cartCount(joao)).toBe(2);
  });

  it("atualizar a linha mantém a variação e confere o mínimo dela", async () => {
    const big = (await cart.cartView(joao)).lines.find(
      (l) => l.variantId === large.id,
    )!;
    await expect(cart.updateCartItem(joao, big.id, 250, null)).rejects.toThrow(
      "cart_below_moq",
    );
    await cart.updateCartItem(joao, big.id, 400, "Caixa branca");
    const after = (await cart.cartView(joao)).lines.find(
      (l) => l.id === big.id,
    )!;
    expect(after).toMatchObject({
      variantId: large.id,
      variantName: "STONE MARBLE A4",
      quantity: 400,
      notes: "Caixa branca",
    });
  });

  it("enviar: uma solicitação por linha, com a variação no nome, na especificação e no variantId", async () => {
    const created = await cart.checkoutCart(
      joao,
      { deadline: null, notes: null },
      t,
    );
    expect(created).toHaveLength(2);
    expect(created[0].groupId).toBe(created[1].groupId);
    expect(created.map((r) => r.productName).sort()).toEqual([
      "Porta-retrato · GRECIE 4X6",
      "Porta-retrato · STONE MARBLE A4",
    ]);
    const grecie = created.find((r) => r.productName.endsWith("GRECIE 4X6"))!;
    expect(grecie).toMatchObject({
      productId,
      variantId: small.id,
      quantity: 200,
      unit: "un",
    });
    expect(grecie.specification).toContain("Categoria: Decoração");
    expect(grecie.specification).toContain("Variação: GRECIE 4X6");
    expect(grecie.specification).toContain("Tamanho: 4X6");
    expect(grecie.specification).toContain("Cores: White / Gray");
    expect(grecie.description).toContain("Logo");
    const stone = created.find((r) => r.variantId === large.id)!;
    expect(stone.quantity).toBe(400);
    expect((await cart.cartView(joao)).lines).toEqual([]);
  });

  it("solicitar agora com a variação; variação desativada fica avisada e não é enviada", async () => {
    const request = await cart.requestProductNow(
      joao,
      productId,
      300,
      "Vermelho",
      t,
      large.id,
    );
    expect(request).toMatchObject({
      productId,
      variantId: large.id,
      quantity: 300,
      productName: "Porta-retrato · STONE MARBLE A4",
    });
    await cart.addToCart(joao, productId, 100, null, small.id);
    await cart.addToCart(joao, productId, 300, null, large.id);
    await pv.setProductVariantActive(admin, large.id, false);
    const view = await cart.cartView(joao);
    const gone = view.lines.find((l) => l.variantId === large.id)!;
    expect([
      gone.variantUnavailable,
      gone.unavailable,
      gone.estimate.ok,
    ]).toEqual([true, false, false]);
    // A variação que sumiu não entra em outra linha nem no envio.
    await expect(
      cart.addToCart(joao, productId, 300, null, large.id),
    ).rejects.toThrow("cart_variant_invalid");
    const created = await cart.checkoutCart(
      joao,
      { deadline: null, notes: null },
      t,
    );
    expect(created.map((r) => r.variantId)).toEqual([small.id]);
    // A linha avisada continua no carrinho até o cliente remover.
    const left = await cart.cartView(joao);
    expect(left.lines.map((l) => l.variantId)).toEqual([large.id]);
    await cart.removeCartItem(joao, left.lines[0].id);
    await pv.setProductVariantActive(admin, large.id, true);
    expect(await cart.cartCount(joao)).toBe(0);
  });

  it("produto sem variações: tudo como antes (sem a coluna nova gravada)", async () => {
    await cart.addToCart(joao, "prod-panela", 500, "Logo da loja");
    const [line] = (await cart.cartView(joao)).lines;
    expect(line).toMatchObject({
      productId: "prod-panela",
      variantId: null,
      variantName: null,
      variantUnavailable: false,
      quantity: 500,
    });
    const stored = (await getStore().get("cart_items", line.id)) as object;
    expect("variantId" in stored).toBe(false);
    await cart.updateCartItem(joao, line.id, 600, null);
    const [created] = await cart.checkoutCart(
      joao,
      { deadline: null, notes: null },
      t,
    );
    expect(created.productName).toBe("Jogo de panelas antiaderentes 5 pçs");
    expect(created.variantId ?? null).toBeNull();
    expect(created.quantity).toBe(600);
  });
});
