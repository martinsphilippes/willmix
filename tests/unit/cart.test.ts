import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Vitrine (Explorar) e carrinho: o cliente vê os produtos ativos com preço
 * estimado (nunca o fornecedor nem o preço de compra), monta o carrinho e
 * envia; cada produto vira uma solicitação de orçamento no mesmo lote. Cada
 * login tem o próprio carrinho; a Wellmix e os fornecedores não compram aqui.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const { translator } = await import("@/i18n");
const cart = await import("@/lib/services/cart");
const explore = await import("@/lib/services/catalog-explore");
const { canViewRequest } = await import("@/lib/auth/permissions");
const { canAccessDocument } = await import("@/lib/services/documents");
type User = import("@/lib/db").User;

const t = translator("pt");
let admin: User;
let joao: User;
let colleague: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  // Outro login da mesma empresa: carrinho próprio, sem ver o do João.
  const rest: Partial<User> = { ...joao };
  delete rest.id;
  delete rest.createdAt;
  delete rest.updatedAt;
  colleague = await getStore().create("users", {
    ...(rest as Omit<User, "id" | "createdAt" | "updatedAt">),
    email: "colega@lojista.com",
    name: "Colega",
  });
  // Conta completa para a jarra-panela ter preço: câmbio, frete, ICMS e II/IPI.
  await setSetting("fxManualRates", { USD: 5, RMB: null, EUR: null });
  await setSetting("freightPerCbm", 100);
  await setSetting("freightCurrency", "USD");
  await setSetting("icmsPercent", 18);
  await getStore().create("tax_classifications", {
    productId: "prod-panela",
    ncm: "76151000",
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
});

describe("vitrine", () => {
  it("cliente vê preço estimado sem fornecedor nem preço de compra; Wellmix vê o que falta", async () => {
    const { items } = await explore.exploreCatalog(joao, {});
    const panela = items.find((p) => p.id === "prod-panela")!;
    expect(panela.estimate.ok).toBe(true);
    // Nada do fornecedor nem do preço de compra chega ao cliente.
    for (const item of items) {
      const keys = Object.keys(item);
      for (const secret of [
        "supplierId",
        "supplierSku",
        "price",
        "currency",
        "priceTiers",
      ])
        expect(keys).not.toContain(secret);
      // Sem preço: o cliente não vê o motivo (é do cadastro da Wellmix).
      if (!item.estimate.ok) expect(item.estimate.missing).toEqual([]);
    }
    const jarraForAdmin = (await explore.exploreCatalog(admin, {})).items.find(
      (p) => p.id === "prod-jarra",
    )!;
    expect(jarraForAdmin.estimate.ok).toBe(false);
    expect(
      !jarraForAdmin.estimate.ok && jarraForAdmin.estimate.missing,
    ).toContain("price");
    // Fornecedor não abre a vitrine.
    expect((await explore.exploreCatalog(supplierA, {})).items).toEqual([]);
  });

  it("busca sem acento, filtro por linha e ordem por preço", async () => {
    const found = await explore.exploreCatalog(joao, {
      q: "PANELAS antiaderentes",
    });
    expect(found.items.map((p) => p.id)).toEqual(["prod-panela"]);
    const line = await explore.exploreCatalog(joao, {
      lineId: "linha-brinquedos",
    });
    expect(line.items.every((p) => p.lineId === "linha-brinquedos")).toBe(true);
    const cheap = await explore.exploreCatalog(joao, { sort: "price_asc" });
    const priced = cheap.items.filter((p) => p.estimate.ok);
    const prices = priced.map((p) => (p.estimate.ok ? p.estimate.unitBrl : 0));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    // Sem preço sempre no fim.
    const firstUnpriced = cheap.items.findIndex((p) => !p.estimate.ok);
    if (firstUnpriced >= 0)
      expect(
        cheap.items.slice(firstUnpriced).every((p) => !p.estimate.ok),
      ).toBe(true);
  });

  it("página do produto: faixas de preço por quantidade e especificação", async () => {
    const detail = (await explore.exploreProduct(joao, "prod-panela", t))!;
    expect(detail.tiers.map((r) => r.minQty)).toEqual([500, 1000, 2000]);
    expect(detail.specification.join("\n")).toContain("Alumínio");
    // Produto inativo não abre.
    await getStore().update("products", "prod-piscina", { active: false });
    expect(await explore.exploreProduct(joao, "prod-piscina", t)).toBeNull();
    await getStore().update("products", "prod-piscina", { active: true });
  });
});

describe("carrinho", () => {
  it("só o cliente usa; quantidade e produto conferidos", async () => {
    await expect(cart.addToCart(admin, "prod-panela", 500)).rejects.toThrow(
      "forbidden",
    );
    await expect(cart.addToCart(supplierA, "prod-panela", 500)).rejects.toThrow(
      "forbidden",
    );
    await expect(cart.addToCart(joao, "prod-panela", 0)).rejects.toThrow(
      "cart_quantity_invalid",
    );
    await expect(cart.addToCart(joao, "prod-panela", 1e9)).rejects.toThrow(
      "cart_quantity_invalid",
    );
    await expect(cart.addToCart(joao, "nao-existe", 10)).rejects.toThrow(
      "cart_product_unavailable",
    );
    // O pedido mínimo vale (panela: 500; boneca: 2.000).
    await expect(cart.addToCart(joao, "prod-panela", 499)).rejects.toThrow(
      "cart_below_moq",
    );
    await expect(cart.addToCart(joao, "prod-boneca", 1000)).rejects.toThrow(
      "cart_below_moq",
    );
  });

  it("o mínimo é o da ficha mestre quando ela existe (o mesmo que a vitrine mostra)", async () => {
    const { saveProductSheet } = await import("@/lib/services/product-sheet");
    // Cadastro da jarra: mínimo 300 (seed); a ficha mestre diz 100.
    await saveProductSheet(admin, "prod-piscina", { moq: 100 });
    const shown = (await explore.exploreCatalog(joao, { q: "piscina" }))
      .items[0];
    expect(shown?.moq).toBe(100);
    // O serviço aceita o mínimo mostrado e recusa abaixo dele.
    await cart.addToCart(joao, "prod-piscina", 100);
    await expect(cart.addToCart(joao, "prod-piscina", 99)).rejects.toThrow(
      "cart_below_moq",
    );
    const line = (await cart.cartView(joao)).lines.find(
      (l) => l.productId === "prod-piscina",
    )!;
    expect([line.moq, line.belowMoq]).toEqual([100, false]);
    // Ficha mestre com mínimo maior que o cadastro: vale o maior também.
    await saveProductSheet(admin, "prod-piscina", { moq: 5000 });
    await expect(
      cart.updateCartItem(joao, line.id, 4999, null),
    ).rejects.toThrow("cart_below_moq");
    await cart.updateCartItem(joao, line.id, 5000, null);
    await cart.removeCartItem(joao, line.id);
    await saveProductSheet(admin, "prod-piscina", { moq: null });
  });

  it("adicionar de novo soma; cada login tem o próprio carrinho", async () => {
    await cart.addToCart(joao, "prod-panela", 500, "Logo da loja");
    const atMin = (await cart.cartView(joao)).lines[0];
    await cart.addToCart(joao, "prod-panela", 500);
    // Item de antes da regra do mínimo (gravado direto): fica, com o aviso.
    await getStore().create("cart_items", {
      userId: joao.id,
      customerId: joao.partyId,
      productId: "prod-boneca",
      quantity: 1000,
      notes: null,
    } as never);
    const view = await cart.cartView(joao);
    expect(view.lines.map((l) => [l.productId, l.quantity])).toEqual([
      ["prod-panela", 1000],
      ["prod-boneca", 1000],
    ]);
    const panela = view.lines[0];
    expect(panela.notes).toBe("Logo da loja");
    expect(panela.estimate.ok).toBe(true);
    expect(panela.subtotal).toBeGreaterThan(0);
    // Boneca abaixo do mínimo (2.000), de antes: avisa.
    expect(view.lines[1].belowMoq).toBe(true);
    // Mudar a quantidade dela: só para o mínimo ou mais; a observação pode mudar.
    await expect(
      cart.updateCartItem(joao, view.lines[1].id, 1500, null),
    ).rejects.toThrow("cart_below_moq");
    await cart.updateCartItem(joao, view.lines[1].id, 1000, "Caixa branca");
    await cart.updateCartItem(joao, view.lines[1].id, 2000, null);
    expect((await cart.cartView(joao)).lines[1].belowMoq).toBe(false);
    expect(await cart.cartCount(joao)).toBe(2);
    // O colega da mesma empresa não vê nem mexe no carrinho do João.
    expect((await cart.cartView(colleague)).lines).toEqual([]);
    await expect(
      cart.updateCartItem(colleague, panela.id, 10, null),
    ).rejects.toThrow("cart_item_not_found");
    await expect(cart.removeCartItem(colleague, panela.id)).rejects.toThrow(
      "cart_item_not_found",
    );
    // Atualizar a quantidade e a personalização do próprio item.
    await cart.updateCartItem(joao, panela.id, 1000, "Logo azul");
    const after = await cart.cartView(joao);
    expect(after.lines[0]).toMatchObject({
      quantity: 1000,
      notes: "Logo azul",
    });
    // A faixa de 1.000 deixa a unidade mais barata que a de 500.
    expect(
      after.lines[0].estimate.ok &&
        atMin.estimate.ok &&
        after.lines[0].estimate.unitBrl < atMin.estimate.unitBrl,
    ).toBe(true);
  });

  it("enviar: cada produto vira uma solicitação no mesmo lote e o carrinho esvazia", async () => {
    const created = await cart.checkoutCart(
      joao,
      { deadline: "2026-12-20", notes: "Entrega em Curitiba" },
      t,
    );
    expect(created).toHaveLength(2);
    expect(created[0].groupId).toBeTruthy();
    expect(created[0].groupId).toBe(created[1].groupId);
    const panela = created.find((r) => r.productId === "prod-panela")!;
    expect(panela).toMatchObject({
      customerId: "cliente-joao",
      quantity: 1000,
      unit: "un",
    });
    // A data em que o cliente precisa vai para as observações (a Wellmix vê).
    expect(panela.notes).toBe(
      "Prazo desejado pelo cliente: 20/12/2026\nEntrega em Curitiba",
    );
    expect(panela.description).toContain("Logo azul");
    // Só o login que enviou vê (como toda solicitação do cliente).
    expect(canViewRequest(joao, panela)).toBe(true);
    expect(canViewRequest(colleague, panela)).toBe(false);
    expect((await cart.cartView(joao)).lines).toEqual([]);
    await expect(
      cart.checkoutCart(joao, { deadline: null, notes: null }, t),
    ).rejects.toThrow("cart_empty");
  });

  it("produto que saiu do catálogo fica avisado e não é enviado", async () => {
    await cart.addToCart(joao, "prod-piscina", 300);
    await cart.addToCart(joao, "prod-panela", 500);
    await getStore().update("products", "prod-piscina", { active: false });
    const view = await cart.cartView(joao);
    expect(
      view.lines.find((l) => l.productId === "prod-piscina")!.unavailable,
    ).toBe(true);
    const created = await cart.checkoutCart(
      joao,
      { deadline: null, notes: null },
      t,
    );
    expect(created.map((r) => r.productId)).toEqual(["prod-panela"]);
    // A piscina continua no carrinho (avisada) até o cliente remover.
    const left = await cart.cartView(joao);
    expect(left.lines.map((l) => l.productId)).toEqual(["prod-piscina"]);
    await cart.removeCartItem(joao, left.lines[0].id);
    expect(await cart.cartCount(joao)).toBe(0);
    await getStore().update("products", "prod-piscina", { active: true });
  });

  it("solicitar agora: só aquele produto, sem mexer no carrinho", async () => {
    await cart.addToCart(joao, "prod-boneca", 2000);
    const request = await cart.requestProductNow(
      joao,
      "prod-panela",
      700,
      "Cor vermelha",
      t,
    );
    expect(request).toMatchObject({ productId: "prod-panela", quantity: 700 });
    // Uma solicitação só (fora de lote).
    expect(request.groupId ?? null).toBeNull();
    expect(request.description).toContain("Cor vermelha");
    const view = await cart.cartView(joao);
    expect(view.lines.map((l) => [l.productId, l.quantity])).toEqual([
      ["prod-boneca", 2000],
    ]);
    await cart.removeCartItem(joao, view.lines[0].id);
  });

  it("pedidos pela vitrine desligados nas Configurações: só o catálogo", async () => {
    await setSetting("customerCanCreateRequest", false);
    expect(await explore.canBuyOnStorefront(joao)).toBe(false);
    await expect(cart.addToCart(joao, "prod-panela", 500)).rejects.toThrow(
      "cart_disabled",
    );
    await expect(
      cart.requestProductNow(joao, "prod-panela", 500, null, t),
    ).rejects.toThrow("cart_disabled");
    // O catálogo continua aberto.
    expect(
      (await explore.exploreCatalog(joao, {})).items.length,
    ).toBeGreaterThan(0);
    await setSetting("customerCanCreateRequest", true);
    expect(await explore.canBuyOnStorefront(joao)).toBe(true);
  });

  it("cartão do fornecedor nunca aparece nem abre para o cliente", async () => {
    const store = getStore();
    const doc = await store.create("documents", {
      orderId: null,
      requestId: null,
      requirementId: null,
      type: "photo",
      name: "cartao.png",
      mime: "image/png",
      size: 10,
      storageKey: "cartao-teste",
      version: 1,
      previousDocumentId: null,
      uploadedByUserId: admin.id,
      visibility: "internal",
      productId: "prod-panela",
      sourcingItemId: null,
      kitId: null,
      imageHash: null,
    });
    await store.create("product_photos", {
      productId: "prod-panela",
      sourcingItemId: null,
      orderId: null,
      documentId: doc.id,
      kind: "business_card",
      caption: null,
      takenAt: new Date().toISOString(),
      takenByUserId: admin.id,
      derivedFromPhotoId: null,
      isPrimary: true,
    });
    const { items } = await explore.exploreCatalog(joao, {});
    const panela = items.find((p) => p.id === "prod-panela")!;
    expect(panela.photos.map((p) => p.documentId)).not.toContain(doc.id);
    expect(await canAccessDocument(joao, doc)).toBe(false);
    expect(await canAccessDocument(admin, doc)).toBe(true);
  });
});
