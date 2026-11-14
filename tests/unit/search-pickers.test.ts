import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Campos com busca no lugar das listas de seleção com o cadastro inteiro
 * (auditoria de performance, 14/11/2026): produto (nome ou código), ficha do
 * produto escolhido na nova solicitação e destinatário de conversa nova. Cada
 * busca oferece o mesmo que a lista antiga mostrava, a quem a tela mostrava.
 */
withTempStore();

// Produto criado por uma solicitação ao fornecedor ainda não liberada no
// Booking: fica fora do catálogo da nova solicitação e do novo kit.
const HIDDEN = "prod-panela";
vi.mock("@/lib/services/booking-visibility", () => ({
  hiddenBookingProductIds: async () => new Set([HIDDEN]),
  isHiddenByBooking: async (id: string) => id === HIDDEN,
}));

const { seedDemo } = await import("@/lib/seed");
const { getStore } = await import("@/lib/db");
const { translator } = await import("@/i18n");
const ps = await import("@/lib/services/product-search");
const { requestProductFills } =
  await import("@/lib/services/request-product-fill");
const messages = await import("@/lib/services/messages");
const { catalogShowcasePhotos } = await import("@/lib/services/documents");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplier: User;
const t = translator("pt");
const ON = { customerCanCreateRequest: true };
const OFF = { customerCanCreateRequest: false };

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
  // Um produto desativado, com nome de exemplo e código parecido com outro.
  await getStore().create("products", {
    ...(await getStore().get("products", "prod-jarra"))!,
    id: "prod-velho",
    name: "Produto novo XPTO",
    sku: "UTL-0019",
    active: false,
  });
});

describe("busca de produtos", () => {
  it("acha pelo nome ou pelo código, sem caixa, a partir de 2 letras", async () => {
    expect(await ps.searchProducts({ q: "j", scope: "all" })).toEqual([]);
    const byName = await ps.searchProducts({ q: "JARRA", scope: "catalog" });
    expect(byName.map((p) => p.id)).toEqual(["prod-jarra"]);
    const bySku = await ps.searchProducts({ q: "brq-001", scope: "catalog" });
    expect(bySku.map((p) => p.id)).toEqual(["prod-boneca"]);
  });

  it("cada escopo oferece o que a lista antiga mostrava", async () => {
    const ids = async (scope: "all" | "active" | "catalog", q: string) =>
      (await ps.searchProducts({ q, scope })).map((p) => p.id);
    // Desativado: só no filtro do Marketing (todos).
    expect(await ids("all", "utl-001")).toContain("prod-velho");
    expect(await ids("active", "utl-001")).not.toContain("prod-velho");
    // Em análise no Booking: fora do catálogo, dentro dos ativos (Superplan).
    expect(await ids("catalog", "panela")).toEqual([]);
    expect(await ids("active", "panela")).toEqual([HIDDEN]);
  });

  it("o código igual ao digitado vem primeiro", async () => {
    const hits = await ps.searchProducts({ q: "UTL-001", scope: "all" });
    // "UTL-001" (jarra) antes de "UTL-0019" (o desativado), apesar do nome.
    expect(hits.map((p) => p.id).slice(0, 2)).toEqual([
      "prod-jarra",
      "prod-velho",
    ]);
  });

  it("rótulo: nome e código; nome de exemplo vira 'Produto sem nome'", () => {
    expect(
      ps.productOptionLabel(t, {
        name: "Jarra de vidro 1,5 L",
        sku: "UTL-001",
      }),
    ).toBe("Jarra de vidro 1,5 L (UTL-001)");
    expect(
      ps.productOptionLabel(t, { name: "Produto novo XPTO", sku: null }),
    ).toBe(t("productName.unnamed"));
  });

  it("há produto no catálogo (aviso do novo kit sem ler o cadastro)", async () => {
    expect(await ps.hasCatalogProducts()).toBe(true);
    const all = await getStore().list("products", { filter: { active: true } });
    expect(await ps.hasCatalogProducts(new Set(all.map((p) => p.id)))).toBe(
      false,
    );
  });
});

describe("quem busca produtos", () => {
  it("Wellmix: cada escopo pela tela que o usa", () => {
    for (const scope of ps.PRODUCT_SCOPES)
      expect(ps.canSearchProducts(admin, scope, ON)).toBe(true);
  });

  it("cliente: só o catálogo, e só com 'Cliente pode criar solicitação'", () => {
    expect(ps.canSearchProducts(joao, "catalog", ON)).toBe(true);
    expect(ps.canSearchProducts(joao, "catalog", OFF)).toBe(false);
    expect(ps.canSearchProducts(joao, "all", ON)).toBe(false);
    expect(ps.canSearchProducts(joao, "active", ON)).toBe(false);
    expect(ps.canPickRequestProducts(joao, ON)).toBe(true);
    expect(ps.canPickRequestProducts(joao, OFF)).toBe(false);
  });

  it("fornecedor e parceiros: nenhum", () => {
    for (const scope of ps.PRODUCT_SCOPES)
      expect(ps.canSearchProducts(supplier, scope, ON)).toBe(false);
    expect(ps.canPickRequestProducts(supplier, ON)).toBe(false);
  });
});

describe("ficha do produto escolhido na nova solicitação", () => {
  it("nome, descrição e especificação da ficha; estoque sem quantidade para o cliente", async () => {
    const jarra = (await getStore().get("products", "prod-jarra"))!;
    const [forCustomer] = await requestProductFills(joao, t, [jarra]);
    expect(forCustomer).toMatchObject({
      id: "prod-jarra",
      label: "Jarra de vidro 1,5 L (UTL-001)",
      productName: "Jarra de vidro 1,5 L",
    });
    expect(forCustomer.description.startsWith("Jarra de vidro 1,5 L")).toBe(
      true,
    );
    expect(forCustomer.stock.detail).toBeNull();
    expect(await requestProductFills(admin, t, [])).toEqual([]);
  });

  it("nome de exemplo: nada no nome nem na descrição (quem pede preenche)", async () => {
    const velho = (await getStore().get("products", "prod-velho"))!;
    const [fill] = await requestProductFills(admin, t, [velho]);
    expect(fill.productName).toBe("");
    expect(fill.label).toBe(`${t("productName.unnamed")} (UTL-0019)`);
  });

  it("fotos do catálogo só dos produtos pedidos (mesmo resultado com poucos ids)", async () => {
    const store = getStore();
    await store.create("product_photos", {
      productId: "prod-jarra",
      documentId: "doc-jarra",
      kind: "main",
      caption: null,
      isPrimary: true,
    } as never);
    await store.create("product_photos", {
      productId: "prod-boneca",
      documentId: "doc-boneca",
      kind: "main",
      caption: null,
      isPrimary: true,
    } as never);
    const one = await catalogShowcasePhotos(["prod-jarra"]);
    expect([...one.keys()]).toEqual(["prod-jarra"]);
    expect(one.get("prod-jarra")!.map((p) => p.documentId)).toEqual([
      "doc-jarra",
    ]);
  });
});

describe("destinatário de conversa nova (Mensagens)", () => {
  it("empresas ativas dos tipos da conversa, pelo nome, com o tipo ao lado", async () => {
    const found = await messages.searchChatTargets(admin, "trans");
    expect(found).toContainEqual({
      id: "party:transportador",
      name: "Trans Rodo",
      type: "carrier",
    });
    expect(messages.chatTypeLabel(t, "carrier")).toBe(
      t("messages.type.carrier"),
    );
    expect(await messages.searchChatTargets(admin, "t")).toEqual([]);
  });

  it("tipos fora da conversa nova (fábrica, trading) não aparecem", async () => {
    await getStore().create("parties", {
      ...(await getStore().get("parties", "transportador"))!,
      id: "fabrica-trans",
      type: "factory",
      name: "Trans Fábrica",
    });
    const ids = (await messages.searchChatTargets(admin, "trans")).map(
      (x) => x.id,
    );
    expect(ids).not.toContain("party:fabrica-trans");
  });

  it("só a Wellmix busca", async () => {
    await expect(messages.searchChatTargets(joao, "trans")).rejects.toThrow();
  });
});
