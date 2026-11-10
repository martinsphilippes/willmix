import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Booking e a vitrine (docs/BOOKING.md): o produto que chegou pela ficha
 * técnica fica FORA de tudo o que o cliente (e qualquer login de fora da
 * Wellmix) vê até ser aprovado no Booking: vitrine, página do produto,
 * carrinho, nova solicitação, busca por foto/link, fotos e arquivos do
 * produto e kit de marketing. Produto sem linha no Booking segue como antes;
 * a Wellmix continua abrindo tudo.
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

const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const { translator } = await import("@/i18n");
const explore = await import("@/lib/services/catalog-explore");
const cart = await import("@/lib/services/cart");
const { canAccessDocument } = await import("@/lib/services/documents");
const { runProductLookup } = await import("@/lib/services/product-lookup");
const { createKit, offerKit } = await import("@/lib/services/marketing");
const { createRequest } = await import("@/lib/services/requests");
const { hiddenBookingProductIds, isHiddenByBooking } =
  await import("@/lib/services/booking-visibility");
const { createRequestAction } = await import("@/app/app/actions");
type User = import("@/lib/db").User;
type Document = import("@/lib/db").Document;
type BookingStatus = import("@/lib/db/schema").BookingStatus;
type LinkPreview = import("@/lib/integrations/link-preview").LinkPreview;

const t = translator("pt");

/** Um produto por situação: sem linha no Booking e um em cada etapa. */
const KEYS = [
  "none",
  "new",
  "analysis",
  "discarded",
  "approved",
  "offered",
  "reserved",
  "requested",
] as const;
type Key = (typeof KEYS)[number];
const HIDDEN: Key[] = ["new", "analysis", "discarded"];
const VISIBLE: Key[] = ["none", "approved", "offered", "reserved", "requested"];
const pid = (key: Key) => `p-${key}`;
/** Palavra única no nome de cada produto (para achar vazamento de nome). */
const WORD: Record<Key, string> = {
  none: "girassol",
  new: "tucano",
  analysis: "capivara",
  discarded: "jabuti",
  approved: "arara",
  offered: "jaguatirica",
  reserved: "tamandua",
  requested: "sabia",
};
const nameOf = (key: Key) => `Relogio parede ${WORD[key]}`;
const ids = (keys: Key[]) => keys.map(pid).sort();

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;
let supplierC: User;
let agency: User;
const bookingId = {} as Record<Key, string>;
/** Foto de vitrine (interna, com linha em `product_photos`) de cada produto. */
const showcase = {} as Record<Key, Document>;
/** Arquivo do produto marcado como público (visibilidade "all"). */
const publicDoc = {} as Record<Key, Document>;

const store = () => getStore();

/** Move a linha do Booking do produto para outra etapa (como a tela faz). */
const moveTo = (key: Key, status: BookingStatus) =>
  store().update("bookings", bookingId[key], { status });

async function productDocument(
  key: Key,
  visibility: "internal" | "all",
  label: string,
) {
  return store().create("documents", {
    orderId: null,
    requestId: null,
    requirementId: null,
    type: "photo",
    name: `${label}-${key}.png`,
    mime: "image/png",
    size: 10,
    storageKey: `booking-vis-${label}-${key}`,
    version: 1,
    previousDocumentId: null,
    uploadedByUserId: admin.id,
    visibility,
    productId: pid(key),
    sourcingItemId: null,
    kitId: null,
    imageHash: null,
  });
}

const preview = (title: string): LinkPreview => ({
  status: "ok",
  url: "https://loja.example.com/p/1",
  title,
  description: null,
  siteName: null,
  imageUrl: null,
  price: null,
  product: {
    name: null,
    description: null,
    brand: null,
    material: null,
    color: null,
    sku: null,
    size: null,
    model: null,
  },
  category: null,
  image: null,
});

const requestInput = (productId: string | null, productName = "Pedido") => ({
  customerId: "cliente-joao",
  productId,
  productName,
  description: "Quero este produto",
  specification: null,
  quantity: 10,
  unit: "un",
  deadline: null,
  notes: null,
});

beforeAll(async () => {
  const { users } = await seedDemo();
  const byEmail = (email: string) => users.find((u) => u.email === email)!;
  admin = byEmail("admin@wellmix.com");
  joao = byEmail("joao@lojista.com");
  supplierA = byEmail("supplier.a@china.com");
  supplierB = byEmail("supplier.b@china.com");
  supplierC = byEmail("supplier.c@china.com");
  agency = byEmail("agencia@design.com");
  await setSetting("lookupPaused", false);
  for (const key of KEYS) {
    await store().create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      id: pid(key),
      lineId: "linha-utilidades",
      name: nameOf(key),
      sku: `BKV-${key}`,
      specification: null,
      active: true,
      supplierId: "fornecedor-a",
      // Escondido e com mínimo alto: a recusa tem de vir antes da conta do mínimo.
      moq: key === "new" ? 500 : null,
    });
    if (key !== "none") {
      const row = await store().create("bookings", {
        productId: pid(key),
        status: key,
        importBatchId: null,
        sourceFileName: "ficha.xlsx",
        sourceRows: null,
        sourceOrder: null,
        customerId: null,
        reservedQty: null,
        ownerUserId: admin.id,
        note: null,
        analysis: null,
        requestId: null,
        requestGroupId: null,
        requestNumber: null,
        statusChangedAt: null,
        statusChangedByUserId: null,
        createdByUserId: admin.id,
      });
      bookingId[key] = row.id;
    }
    showcase[key] = await productDocument(key, "internal", "vitrine");
    await store().create("product_photos", {
      productId: pid(key),
      sourcingItemId: null,
      orderId: null,
      documentId: showcase[key].id,
      kind: "commercial",
      caption: null,
      takenAt: null,
      takenByUserId: admin.id,
      derivedFromPhotoId: null,
      isPrimary: true,
    });
    publicDoc[key] = await productDocument(key, "all", "publico");
  }
  // Fornecedor B também fornece o produto em análise (ligado, não o principal).
  await store().create("product_suppliers", {
    productId: pid("analysis"),
    supplierId: "fornecedor-b",
    supplierSku: null,
    price: null,
    currency: null,
    moq: null,
    leadTimeDays: null,
    source: "manual",
    lastQuoteId: null,
    lastQuotedAt: null,
    quoteCount: null,
    selectedCount: null,
    lastSelectedAt: null,
    createdByUserId: admin.id,
  });
});

describe("a regra", () => {
  it("escondem o produto as etapas Novo, Em análise e Descartado; sem linha, nunca", async () => {
    expect([...(await hiddenBookingProductIds())].sort()).toEqual(ids(HIDDEN));
    for (const key of KEYS)
      expect([key, await isHiddenByBooking(pid(key))]).toEqual([
        key,
        HIDDEN.includes(key),
      ]);
    expect(await isHiddenByBooking("prod-panela")).toBe(false);
  });
});

describe("vitrine", () => {
  const mine = (list: { id: string }[]) =>
    list
      .map((p) => p.id)
      .filter((id) => id.startsWith("p-"))
      .sort();

  it("a grade, o total, as contagens e a busca deixam os escondidos de fora", async () => {
    const active = await store().list("products", { filter: { active: true } });
    const all = await explore.exploreCatalog(joao, {});
    expect(mine(all.items)).toEqual(ids(VISIBLE));
    expect(all.total).toBe(active.length - HIDDEN.length);
    const inLine = active.filter(
      (p) =>
        p.lineId === "linha-utilidades" && !HIDDEN.some((k) => pid(k) === p.id),
    ).length;
    expect(all.lines.find((l) => l.id === "linha-utilidades")!.count).toBe(
      inLine,
    );
    // A busca pelo nome de um escondido não acha nada; a de um visível, acha.
    for (const key of HIDDEN)
      expect(
        (await explore.exploreCatalog(joao, { q: WORD[key] })).items,
      ).toEqual([]);
    expect(
      mine((await explore.exploreCatalog(joao, { q: WORD.approved })).items),
    ).toEqual([pid("approved")]);
    // A Wellmix vê a mesma grade ("como o cliente vê").
    expect(mine((await explore.exploreCatalog(admin, {})).items)).toEqual(
      ids(VISIBLE),
    );
  });

  it("página do produto: o cliente não abre o escondido; a Wellmix abre com o aviso", async () => {
    for (const key of HIDDEN) {
      expect(await explore.exploreProduct(joao, pid(key), t)).toBeNull();
      const forAdmin = await explore.exploreProduct(admin, pid(key), t);
      expect(forAdmin).toMatchObject({ id: pid(key), hiddenByBooking: true });
    }
    for (const key of VISIBLE) {
      const forCustomer = await explore.exploreProduct(joao, pid(key), t);
      expect(forCustomer).toMatchObject({
        id: pid(key),
        hiddenByBooking: false,
      });
      expect(
        (await explore.exploreProduct(admin, pid(key), t))!.hiddenByBooking,
      ).toBe(false);
    }
  });
});

describe("carrinho", () => {
  it("escondido não entra no carrinho nem no solicitar agora (mesma recusa do produto fora do catálogo)", async () => {
    for (const key of HIDDEN) {
      // 500 é o mínimo do produto em Novo: a recusa não é a do mínimo.
      await expect(cart.addToCart(joao, pid(key), 500)).rejects.toThrow(
        "cart_product_unavailable",
      );
      await expect(
        cart.requestProductNow(joao, pid(key), 500, null, t),
      ).rejects.toThrow("cart_product_unavailable");
    }
    await expect(cart.addToCart(joao, pid("new"), 1)).rejects.toThrow(
      "cart_product_unavailable",
    );
    expect(await cart.cartCount(joao)).toBe(0);
    const requested = await store().list("requests", {
      filter: { productId: HIDDEN.map(pid) },
    });
    expect(requested).toEqual([]);
  });

  it("produto que volta a ficar escondido: a linha fica avisada e não é enviada", async () => {
    await cart.addToCart(joao, pid("approved"), 10);
    await cart.addToCart(joao, pid("none"), 10);
    await moveTo("approved", "analysis");
    try {
      const view = await cart.cartView(joao);
      const line = view.lines.find((l) => l.productId === pid("approved"))!;
      expect(line).toMatchObject({ unavailable: true, photo: null });
      expect(line.estimate.ok).toBe(false);
      expect(
        view.lines.find((l) => l.productId === pid("none"))!.unavailable,
      ).toBe(false);
      const created = await cart.checkoutCart(
        joao,
        { deadline: null, notes: null },
        t,
      );
      expect(created.map((r) => r.productId)).toEqual([pid("none")]);
      // A linha escondida continua no carrinho (avisada) até o cliente remover.
      const left = await cart.cartView(joao);
      expect(left.lines.map((l) => l.productId)).toEqual([pid("approved")]);
      // Só ela no carrinho: nada a enviar.
      await expect(
        cart.checkoutCart(joao, { deadline: null, notes: null }, t),
      ).rejects.toThrow("cart_product_unavailable");
      await cart.removeCartItem(joao, left.lines[0].id);
    } finally {
      await moveTo("approved", "approved");
    }
    // Aprovado de novo: volta a entrar.
    await cart.addToCart(joao, pid("approved"), 10);
    const again = await cart.cartView(joao);
    expect(again.lines[0]).toMatchObject({
      productId: pid("approved"),
      unavailable: false,
      photo: showcase.approved.id,
    });
    await cart.removeCartItem(joao, again.lines[0].id);
  });
});

describe("nova solicitação", () => {
  it("cliente: escondido, inativo e inexistente dão a MESMA recusa, sem criar nada nem copiar o nome", async () => {
    await store().create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      id: "p-inactive",
      lineId: "linha-utilidades",
      name: "Relogio parede urubu",
      sku: "BKV-inactive",
      specification: null,
      active: false,
    });
    const before = (await store().list("requests")).length;
    const refused = [...HIDDEN.map(pid), "p-inactive", "nao-existe"];
    const messages: string[] = [];
    for (const productId of refused) {
      const error = await createRequest(joao, requestInput(productId)).then(
        () => null,
        (e: Error) => e,
      );
      messages.push(error?.message ?? "created");
    }
    // O mesmo código para todos: não dá para saber se o produto existe.
    expect([...new Set(messages)]).toEqual(["product_unavailable"]);
    const after = await store().list("requests");
    expect(after.length).toBe(before);
    for (const word of ["tucano", "capivara", "jabuti", "urubu"])
      expect(JSON.stringify(after)).not.toContain(word);
  });

  it("cliente pede normalmente o produto sem linha no Booking e o aprovado; fora do catálogo também", async () => {
    for (const key of ["none", "approved", "requested"] as const) {
      const request = await createRequest(joao, requestInput(pid(key)));
      expect(request).toMatchObject({
        productId: pid(key),
        status: "REQUESTED",
      });
    }
    const free = await createRequest(joao, requestInput(null, "Produto novo"));
    expect(free.productId).toBeNull();
  });

  it("a Wellmix segue como antes: cria com o produto ainda no Booking", async () => {
    const request = await createRequest(
      admin,
      // 500 = pedido mínimo do produto em Novo.
      { ...requestInput(pid("new"), nameOf("new")), quantity: 500 },
    );
    expect(request).toMatchObject({
      productId: pid("new"),
      productName: nameOf("new"),
    });
  });

  it("formulário do cliente sem o nome: o nome do escondido não é copiado e a recusa é a mesma", async () => {
    h.current = joao;
    const send = async (productId: string, productName = "") => {
      const form = new FormData();
      form.set("p0.productId", productId);
      form.set("p0.productName", productName);
      form.set("p0.description", "Quero este produto");
      form.set("p0.quantity", "500");
      form.set("p0.unit", "un");
      h.redirects.length = 0;
      await createRequestAction(form);
      return h.redirects.at(-1)!;
    };
    const before = (await store().list("requests")).length;
    const targets = new Set<string>();
    for (const productId of [...HIDDEN.map(pid), "p-inactive", "nao-existe"]) {
      targets.add(await send(productId));
      // Com o nome digitado, a recusa vem do serviço: o mesmo código.
      targets.add(await send(productId, "Um nome qualquer"));
    }
    expect([...targets]).toEqual([
      "/app/requests/new?error=product_unavailable",
    ]);
    expect((await store().list("requests")).length).toBe(before);
    // Produto que o cliente vê: o nome do cadastro preenche a solicitação.
    const ok = await send(pid("none"));
    expect(ok).toMatch(/^\/app\/requests\/[^?]+$/);
    const created = await store().get("requests", ok.split("/").pop()!);
    expect(created).toMatchObject({
      productId: pid("none"),
      productName: nameOf("none"),
    });
    // O texto da recusa existe na tela da nova solicitação.
    expect(t("reqBatch.error.product_unavailable")).not.toBe(
      "reqBatch.error.product_unavailable",
    );
    h.current = null;
  });
});

describe("fotos e arquivos do produto", () => {
  it("cliente não abre a foto de vitrine nem o arquivo público do escondido; aprovado, abre", async () => {
    for (const key of HIDDEN) {
      expect(await canAccessDocument(joao, showcase[key])).toBe(false);
      expect(await canAccessDocument(joao, publicDoc[key])).toBe(false);
    }
    for (const key of VISIBLE) {
      expect(await canAccessDocument(joao, showcase[key])).toBe(true);
      expect(await canAccessDocument(joao, publicDoc[key])).toBe(true);
    }
    await moveTo("new", "approved");
    try {
      expect(await canAccessDocument(joao, showcase.new)).toBe(true);
      expect(await canAccessDocument(joao, publicDoc.new)).toBe(true);
    } finally {
      await moveTo("new", "new");
    }
    expect(await canAccessDocument(joao, showcase.new)).toBe(false);
    expect(await canAccessDocument(joao, publicDoc.new)).toBe(false);
  });

  it("a Wellmix abre tudo; o fornecedor do próprio produto continua abrindo o arquivo público", async () => {
    for (const key of KEYS) {
      expect(await canAccessDocument(admin, showcase[key])).toBe(true);
      expect(await canAccessDocument(admin, publicDoc[key])).toBe(true);
      // Fornecedor principal do produto: como antes (público sim, interno não).
      expect(await canAccessDocument(supplierA, publicDoc[key])).toBe(true);
      expect(await canAccessDocument(supplierA, showcase[key])).toBe(false);
    }
    // Fornecedor ligado ao produto (não o principal): também continua.
    expect(await canAccessDocument(supplierB, publicDoc.analysis)).toBe(true);
    // Outro fornecedor e a agência: o escondido fecha; o visível segue como antes.
    for (const other of [supplierC, agency]) {
      for (const key of HIDDEN)
        expect(await canAccessDocument(other, publicDoc[key])).toBe(false);
      expect(await canAccessDocument(other, publicDoc.none)).toBe(true);
      expect(await canAccessDocument(other, publicDoc.approved)).toBe(true);
    }
    expect(await canAccessDocument(supplierB, publicDoc.new)).toBe(false);
  });
});

describe("busca por foto ou link", () => {
  it("os escondidos não entram nos candidatos, não vão à IA nem voltam como sugestão", async () => {
    const prompts: string[] = [];
    const fakeAi = {
      mode: "api" as const,
      model: "fake",
      async complete(prompt: string) {
        prompts.push(prompt);
        const json = {
          // A IA "reconhece" um escondido: não pode virar correspondência.
          catalogMatches: [
            { id: pid("new"), confidence: "high" },
            { id: pid("none"), confidence: "high" },
          ],
          productName: [],
          description: [],
          specification: [],
        };
        return { text: JSON.stringify(json), json };
      },
    };
    for (const user of [joao, admin]) {
      prompts.length = 0;
      const row = await runProductLookup(
        user,
        { url: "https://loja.example.com/p/1", customerId: "cliente-joao" },
        {
          // O link fala de todos os relógios: só os visíveis podem aparecer.
          fetchPreview: async () =>
            preview(`Relogio parede ${KEYS.map((k) => WORD[k]).join(" ")}`),
          aiAdapter: fakeAi,
        },
      );
      const matched = row.matches.map((m) => m.productId);
      for (const key of HIDDEN) expect(matched).not.toContain(pid(key));
      expect(matched).toEqual(
        expect.arrayContaining([pid("none"), pid("approved")]),
      );
      expect(prompts).toHaveLength(1);
      for (const key of HIDDEN) {
        // Nem o id nem o nome do escondido na lista do catálogo enviada à IA.
        expect(prompts[0]).not.toContain(`${pid(key)} |`);
        expect(prompts[0]).not.toContain(nameOf(key));
        expect(JSON.stringify(row.suggestions)).not.toContain(nameOf(key));
      }
      expect(prompts[0]).toContain(`${pid("none")} | ${nameOf("none")}`);
      expect(JSON.stringify(row.suggestions)).toContain(nameOf("none"));
    }
  });
});

describe("kit de marketing", () => {
  it("produto escondido não ganha kit nem tem kit oferecido", async () => {
    for (const key of HIDDEN)
      await expect(
        createKit(admin, pid(key), { customerId: "cliente-joao" }),
      ).rejects.toThrow("product_in_booking");
    expect(
      await store().list("marketing_kits", {
        filter: { productId: HIDDEN.map(pid) },
      }),
    ).toEqual([]);
    // Sem linha no Booking e aprovado: como antes.
    await createKit(admin, pid("none"));
    const kit = await createKit(admin, pid("approved"), {
      customerId: "cliente-joao",
    });
    // O produto volta a ficar escondido: o kit não pode ser oferecido.
    await moveTo("approved", "discarded");
    try {
      await expect(offerKit(admin, kit.id)).rejects.toThrow(
        "product_in_booking",
      );
    } finally {
      await moveTo("approved", "approved");
    }
    expect((await offerKit(admin, kit.id)).status).toBe("offered");
    // O texto da recusa existe (a tela mostra `marketing.error.<código>`).
    expect(t("marketing.error.product_in_booking")).not.toBe(
      "marketing.error.product_in_booking",
    );
  });
});
