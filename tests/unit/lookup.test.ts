import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { withTempStore } from "./setup";

/* Busca de produto por foto ou link na nova solicitação. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const { uploadDocument } = await import("@/lib/services/documents");
const { imageHashOf, hashDistance, SAME_PHOTO_MAX_DISTANCE } =
  await import("@/lib/services/image-hash");
const {
  isPrivateAddress,
  assertPublicUrl,
  parseLinkHtml,
  fetchLinkPreview,
  decodeEntities,
} = await import("@/lib/integrations/link-preview");
const { runProductLookup, getLookup, attachLookupToRequest, nameScore } =
  await import("@/lib/services/product-lookup");
const { createRequest } = await import("@/lib/services/requests");
type User = import("@/lib/db").User;
type LinkPreview = import("@/lib/integrations/link-preview").LinkPreview;

let admin: User;
let customer: User;
let supplier: User;

/** Imagem parecida com foto de produto (formas grandes); "b" é outra composição. */
async function photo(design: "a" | "b" | "c", width = 800, jpeg = false) {
  const svg =
    design === "a"
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#f0e8d0"/><circle cx="250" cy="300" r="140" fill="#303a8a"/><rect x="420" y="150" width="220" height="260" rx="30" fill="#c02a26"/><ellipse cx="400" cy="520" rx="300" ry="40" fill="#555" opacity="0.4"/></svg>`
      : design === "b"
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#20304a"/><rect y="200" width="800" height="120" fill="#e8e8e8"/><polygon points="100,580 400,60 700,580" fill="#3a9a55"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ffffff"/><rect x="80" y="80" width="200" height="440" fill="#111"/><rect x="520" y="80" width="200" height="440" fill="#111"/></svg>`;
  let img = sharp(Buffer.from(svg)).resize(width);
  img = jpeg ? img.jpeg({ quality: 45 }) : img.png();
  return new Uint8Array(await img.toBuffer());
}
const asFile = (bytes: Uint8Array, name: string, type: string) =>
  new File([new Uint8Array(bytes)], name, { type });

const preview = (over: Partial<LinkPreview>): LinkPreview => ({
  status: "ok",
  url: "https://loja.example.com/p/1",
  title: null,
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
  ...over,
});

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  customer = users.find((u) => u.email === "joao@lojista.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
  // Foto cadastrada da panela (a impressão digital nasce no upload).
  const store = getStore();
  const doc = await uploadDocument(
    admin,
    asFile(await photo("a"), "panela.png", "image/png"),
    { productId: "prod-panela", type: "photo", visibility: "internal" },
  );
  expect(doc.imageHash).toMatch(/^[0-9a-f]{16}$/);
  await store.create("product_photos", {
    productId: "prod-panela",
    sourcingItemId: null,
    orderId: null,
    documentId: doc.id,
    kind: "original",
    caption: null,
    takenAt: null,
    takenByUserId: admin.id,
    derivedFromPhotoId: null,
    isPrimary: true,
  });
});

describe("impressão digital da imagem", () => {
  it("a mesma foto redimensionada e recomprimida fica perto; outra foto fica longe", async () => {
    const a = (await imageHashOf(await photo("a")))!;
    const b = (await imageHashOf(await photo("a", 320, true)))!;
    expect(hashDistance(a, b)).toBeLessThanOrEqual(SAME_PHOTO_MAX_DISTANCE);
    for (const other of ["b", "c"] as const)
      expect(
        hashDistance(a, (await imageHashOf(await photo(other)))!),
      ).toBeGreaterThan(SAME_PHOTO_MAX_DISTANCE);
    expect(await imageHashOf(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("leitura segura do link", () => {
  it("bloqueia endereços internos e esquemas não http", async () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.0.10",
      "172.20.0.1",
      "169.254.169.254",
      "100.64.0.1",
      "::1",
      "fd00::1",
      "::ffff:127.0.0.1",
    ])
      expect(isPrivateAddress(ip)).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    for (const u of [
      "http://127.0.0.1/x",
      "http://localhost:3000",
      "file:///etc/passwd",
      "http://10.0.0.1:8080/",
      "https://user:pw@8.8.8.8/",
    ])
      await expect(assertPublicUrl(new URL(u))).rejects.toThrow();
    expect((await fetchLinkPreview("http://127.0.0.1/admin")).status).toBe(
      "invalid",
    );
    expect((await fetchLinkPreview("nao é link")).status).toBe("invalid");
  });

  it("extrai Open Graph e o produto do JSON-LD", () => {
    const html = `<html><head><title>Ignorado</title>
      <meta property="og:title" content="Jogo de Panelas 5 pe&ccedil;as &amp; tampa | Loja X">
      <meta content="Panelas antiaderentes de alumínio" property="og:description">
      <meta property="og:image" content="/img/panela.jpg">
      <meta property="og:site_name" content="Loja X">
      <meta name="description" content="Descri&Ccedil;&Atilde;O">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Jogo de Panelas 5 peças","brand":{"@type":"Brand","name":"Marca Y"},"material":"Alumínio","color":"Preto","sku":"PAN-5","offers":{"price":"199.90","priceCurrency":"BRL"}}]}</script>
      </head></html>`;
    const r = parseLinkHtml(html, "https://loja.example.com/p/1");
    expect(r.title).toBe("Jogo de Panelas 5 peças & tampa | Loja X");
    expect(r.description).toBe("Panelas antiaderentes de alumínio");
    expect(r.imageUrl).toBe("https://loja.example.com/img/panela.jpg");
    expect(r.siteName).toBe("Loja X");
    expect(decodeEntities("A&ccedil;&atilde;o &Eacute; &#233; &#x263A;")).toBe(
      "Ação É é ☺",
    );
    expect(r.price).toBe("BRL 199.90");
    expect(r.product).toMatchObject({
      name: "Jogo de Panelas 5 peças",
      brand: "Marca Y",
      material: "Alumínio",
      color: "Preto",
      sku: "PAN-5",
    });
  });
});

describe("busca no catálogo e sugestões", () => {
  it("foto parecida encontra o produto cadastrado", async () => {
    await setSetting("aiMode", "MANUAL");
    const row = await runProductLookup(customer, {
      file: asFile(await photo("a", 320, true), "whats.jpg", "image/jpeg"),
    });
    expect(row.matches[0]).toMatchObject({
      productId: "prod-panela",
      reasons: ["photo"],
    });
    expect(row.aiSource).toBeNull();
    expect(row.customerId).toBe("cliente-joao");
    // Sugestões do catálogo (nome e especificação, nunca preço ou fornecedor).
    expect(row.suggestions.productName?.[0]).toEqual({
      value: "Jogo de panelas antiaderentes 5 pçs",
      source: "catalog",
    });
    expect(JSON.stringify(row.suggestions)).not.toMatch(/9\.5|Shenzhen|USD/);
  });

  it("link com nome parecido encontra o produto e sugere vários valores por campo", async () => {
    const row = await runProductLookup(
      customer,
      { url: "https://loja.example.com/p/1" },
      {
        fetchPreview: async () =>
          preview({
            title: "Jogo de Panelas Antiaderentes 5 pçs | Loja X",
            description: "Kit com 5 panelas de alumínio",
            product: {
              name: null,
              description: null,
              brand: "Marca Y",
              material: "Alumínio",
              color: "Vermelho",
              sku: null,
              size: null,
              model: null,
            },
          }),
      },
    );
    expect(row.matches.map((m) => m.productId)).toContain("prod-panela");
    expect(
      row.matches.find((m) => m.productId === "prod-panela")!.reasons,
    ).toContain("name");
    const names = row.suggestions.productName!.map((o) => o.value);
    expect(names).toContain("Jogo de Panelas Antiaderentes 5 pçs");
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(row.suggestions.specification![0]).toEqual({
      value: "Material: Alumínio; Cor: Vermelho; Marca: Marca Y",
      source: "link",
    });
  });

  it("produto novo: sem correspondência, sugestões do link e da IA (mock rotulado)", async () => {
    await setSetting("aiMode", "MOCK");
    const row = await runProductLookup(
      customer,
      { url: "https://loja.example.com/p/2" },
      {
        fetchPreview: async () =>
          preview({
            title: "Luminária solar de jardim LED",
            description: "Acende sozinha ao anoitecer",
          }),
      },
    );
    expect(row.matches).toEqual([]);
    expect(row.aiSource).toBe("mock");
    expect(row.suggestions.productName!.map((o) => o.source)).toEqual([
      "link",
      "mock",
    ]);
    expect(row.suggestions.description![0].value).toBe(
      "Acende sozinha ao anoitecer",
    );
    await setSetting("aiMode", "MANUAL");
  });

  it("com IA de imagem: envia a foto do cliente e as fotos do catálogo; só confiança média/alta vira correspondência", async () => {
    const store = getStore();
    // Foto de medida da boneca: não deve ir para a comparação visual.
    const dim = await uploadDocument(
      admin,
      asFile(await photo("c"), "medida.png", "image/png"),
      { productId: "prod-boneca", type: "photo", visibility: "internal" },
    );
    await store.create("product_photos", {
      productId: "prod-boneca",
      sourcingItemId: null,
      orderId: null,
      documentId: dim.id,
      kind: "dimension_height",
      caption: null,
      takenAt: null,
      takenByUserId: admin.id,
      derivedFromPhotoId: null,
      isPrimary: false,
    });
    const sent: Array<{ labels: string[]; count: number }> = [];
    const fakeAi = {
      mode: "api" as const,
      model: "fake-vision",
      async complete(_prompt: string, images?: unknown) {
        const list = (Array.isArray(images) ? images : []) as Array<{
          label?: string;
        }>;
        sent.push({
          labels: list.map((i) => i.label ?? ""),
          count: list.length,
        });
        const json = {
          catalogMatches: [
            { id: "prod-panela", confidence: "high", reason: "mesmo formato" },
            { id: "prod-jarra", confidence: "low", reason: "só a categoria" },
            { id: "nao-existe", confidence: "high" },
          ],
          productName: ["Jogo de panelas preto"],
          description: [],
          specification: ["Alumínio, cor preta"],
        };
        return { text: JSON.stringify(json), json };
      },
    };
    // Outra foto (composição diferente): impressão digital não casa; a IA reconhece.
    const row = await runProductLookup(
      customer,
      {
        file: asFile(
          await photo("b", 500, true),
          "outra-foto.jpg",
          "image/jpeg",
        ),
      },
      { aiAdapter: fakeAi },
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].labels[0]).toBe("FOTO DO CLIENTE:");
    expect(
      sent[0].labels.some((l) => l.startsWith("CATÁLOGO id=prod-panela")),
    ).toBe(true);
    expect(sent[0].labels.some((l) => l.includes("prod-boneca"))).toBe(false);
    expect(row.matches.map((m) => m.productId)).toEqual(["prod-panela"]);
    expect(row.matches[0].reasons).toEqual(["ai"]);
    expect(row.aiSource).toBe("api");
    expect(row.suggestions.productName!.map((o) => o.source)).toContain("ai");
  });

  it("link bloqueado não quebra: só registra o status", async () => {
    const row = await runProductLookup(
      customer,
      { url: "https://1688.example.com/x" },
      { fetchPreview: async () => preview({ status: "blocked" }) },
    );
    expect(row.linkStatus).toBe("blocked");
    expect(row.matches).toEqual([]);
  });

  it("nome parecido exige ao menos duas palavras do produto", async () => {
    const p = (await getStore().get("products", "prod-panela"))!;
    expect(nameScore(p, "Panela de pressão elétrica")).toBe(0);
    expect(
      nameScore(p, "Jogo de panelas antiaderentes"),
    ).toBeGreaterThanOrEqual(0.5);
  });

  it("permissões e anexo à solicitação", async () => {
    await expect(runProductLookup(customer, {})).rejects.toThrow(
      "lookup_empty",
    );
    await expect(
      runProductLookup(supplier, { url: "https://x.example.com" }),
    ).rejects.toThrow("forbidden");
    await expect(
      runProductLookup(customer, {
        file: asFile(
          new Uint8Array([37, 80, 68, 70]),
          "a.pdf",
          "application/pdf",
        ),
      }),
    ).rejects.toThrow("lookup_not_image");
    const row = await runProductLookup(customer, {
      file: asFile(await photo("b", 400), "novo.png", "image/png"),
    });
    expect(await getLookup(supplier, row.id)).toBeNull();
    expect(await getLookup(admin, row.id)).not.toBeNull();
    const request = await createRequest(customer, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Produto novo",
      description: "Pela foto",
      specification: null,
      quantity: 10,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await attachLookupToRequest(customer, row.id, request.id);
    const store = getStore();
    expect(
      (await store.get("documents", row.imageDocumentId!))!.requestId,
    ).toBe(request.id);
    expect((await store.get("product_lookups", row.id))!.requestId).toBe(
      request.id,
    );
  });
});

describe("provedor da IA", () => {
  it("escolhe chave direta, chave do gateway ou OIDC na Vercel; sem nada, manual", async () => {
    const { getAiAdapter, toGatewayModel, aiStatus } =
      await import("@/lib/integrations/ai");
    const saved = { ...process.env };
    const s = { aiMode: "AUTO" as const, aiModel: "claude-sonnet-5-5" };
    try {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;
      delete process.env.VERCEL;
      expect(getAiAdapter(s).mode).toBe("manual");
      process.env.VERCEL = "1";
      expect(aiStatus(s)).toEqual({
        mode: "api",
        provider: "gateway",
        model: "anthropic/claude-sonnet-5.5",
      });
      process.env.AI_GATEWAY_API_KEY = "x";
      expect(aiStatus(s).provider).toBe("gateway");
      process.env.ANTHROPIC_API_KEY = "y";
      expect(aiStatus(s)).toEqual({
        mode: "api",
        provider: "anthropic",
        model: "claude-sonnet-5-5",
      });
      expect(getAiAdapter({ ...s, aiMode: "MANUAL" }).mode).toBe("manual");
    } finally {
      process.env = saved;
    }
    expect(toGatewayModel("claude-haiku-4-5")).toBe(
      "anthropic/claude-haiku-4.5",
    );
    expect(toGatewayModel("claude-opus-5")).toBe("anthropic/claude-opus-5");
    expect(toGatewayModel("anthropic/claude-sonnet-5")).toBe(
      "anthropic/claude-sonnet-5",
    );
  });
});

describe("motivo da falha da IA", () => {
  it("classifica a resposta do AI Gateway e traduz o motivo", async () => {
    const { classifyAiFailure, aiErrorCode, AiError } =
      await import("@/lib/integrations/ai");
    const { aiErrorText } = await import("@/i18n/ai-error");
    const { dictionaries } = await import("@/i18n/dictionaries");
    const vercel403 =
      '{"error":{"message":"AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d to add a card and unlock your free credits.","type":"customer_verification_required"}}';
    expect(classifyAiFailure(403, vercel403)).toBe("card_required");
    expect(
      classifyAiFailure(401, '{"error":{"type":"authentication_error"}}'),
    ).toBe("unauthorized");
    expect(classifyAiFailure(402, "")).toBe("no_credit");
    expect(classifyAiFailure(429, "{}")).toBe("rate_limited");
    expect(classifyAiFailure(404, "{}")).toBe("model_not_found");
    expect(
      classifyAiFailure(529, '{"error":{"type":"overloaded_error"}}'),
    ).toBe("service_down");
    expect(classifyAiFailure(400, "{}")).toBe("unknown");
    const timeout = new Error("t");
    timeout.name = "TimeoutError";
    expect(aiErrorCode(timeout)).toBe("timeout");
    expect(aiErrorCode(new AiError("no_credit"))).toBe("no_credit");
    expect(new AiError("card_required").message).toBe("ai_card_required");
    const t = (key: string) =>
      (dictionaries.pt as Record<string, string>)[key] ?? key;
    expect(aiErrorText(t as never, "ai_card_required")).toContain(
      "cartão de crédito",
    );
    expect(aiErrorText(t as never, "card_required")).toContain("Vercel");
    expect(aiErrorText(t as never, "invalid_input")).toBeNull();
  });

  it("a busca guarda o motivo quando a IA falha", async () => {
    const { AiError } = await import("@/lib/integrations/ai");
    const row = await runProductLookup(
      customer,
      { file: asFile(await photo("b", 300, true), "x.jpg", "image/jpeg") },
      {
        aiAdapter: {
          mode: "api",
          model: "fake",
          async complete() {
            throw new AiError("card_required", 403);
          },
        },
      },
    );
    expect(row.aiError).toBe("card_required");
    expect(row.aiSource).toBeNull();
  });
});

describe("link do Mercado Livre e produtos relacionados", () => {
  it("extrai os ids do endereço compartilhado e ignora título que é só a loja", async () => {
    const { mercadoLivreIds, mapMercadoLivre, isGenericTitle } =
      await import("@/lib/integrations/link-preview");
    const url = new URL(
      "https://www.mercadolivre.com.br/p/MLB2000141964?pdp_filters=item_id:MLB7535677260&matt_tool=38524122#origin=share&sid=share&wid=MLB7535677260&action=copy",
    );
    expect(mercadoLivreIds(url)).toEqual({
      productId: "MLB2000141964",
      itemIds: ["MLB7535677260"],
      slug: null,
    });
    expect(
      mercadoLivreIds(
        new URL(
          "https://produto.mercadolivre.com.br/MLB-123456789-capa-case-iphone-15-magsafe-_JM",
        ),
      ),
    ).toEqual({
      productId: null,
      itemIds: ["MLB123456789"],
      slug: "capa case iphone 15 magsafe",
    });
    expect(
      mercadoLivreIds(new URL("https://www.amazon.com.br/dp/B0C")),
    ).toBeNull();
    expect(isGenericTitle("Mercado Libre", null)).toBe(true);
    expect(isGenericTitle("Amazon.com.br", null)).toBe(true);
    expect(
      isGenericTitle("Apple iPhone 15 (128 GB) - Preto", "Mercado Livre"),
    ).toBe(false);
    const mapped = mapMercadoLivre(
      {
        title: "Apple iPhone 15 Pro Max (256 GB) - Titânio Preto",
        price: 7999,
        currency_id: "BRL",
        category_id: "MLB1055",
        pictures: [{ secure_url: "https://http2.mlstatic.com/x.jpg" }],
        attributes: [
          { id: "BRAND", value_name: "Apple" },
          { id: "MODEL", value_name: "iPhone 15 Pro Max" },
          { id: "COLOR", value_name: "Titânio preto" },
        ],
      },
      "Celulares e Telefones > Celulares e Smartphones",
    );
    expect(mapped).toMatchObject({
      title: "Apple iPhone 15 Pro Max (256 GB) - Titânio Preto",
      price: "BRL 7999",
      category: "Celulares e Telefones > Celulares e Smartphones",
      imageUrl: "https://http2.mlstatic.com/x.jpg",
      product: {
        brand: "Apple",
        model: "iPhone 15 Pro Max",
        color: "Titânio preto",
      },
    });
  });

  it("anúncio de iPhone traz o celular cadastrado como relacionado (mesma categoria)", async () => {
    const { PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
    const store = getStore();
    const celular = await store.create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      lineId: "linha-utilidades",
      name: "Celular Teste",
      sku: "01",
      specification: null,
      active: true,
      category: "Celular",
      material: "Celular",
    });
    const row = await runProductLookup(
      admin,
      { url: "https://www.mercadolivre.com.br/p/MLB2000141964" },
      {
        fetchPreview: async () =>
          preview({
            title: "Apple iPhone 15 Pro Max (256 GB) - Titânio Preto",
            siteName: "Mercado Livre",
            category: "Celulares e Telefones > Celulares e Smartphones",
            product: {
              name: null,
              description: null,
              brand: "Apple",
              material: null,
              color: "Titânio preto",
              sku: null,
              size: null,
              model: "iPhone 15 Pro Max",
            },
          }),
      },
    );
    const hit = row.matches.find((m) => m.productId === celular.id)!;
    expect(hit).toBeDefined();
    expect(hit.reasons).toContain("category");
    expect(hit.reasons.some((r) => ["photo", "name", "ai"].includes(r))).toBe(
      false,
    );
    // Relacionado não vira sugestão de nome (só o que parece ser o mesmo produto).
    expect(row.suggestions.productName!.every((o) => o.source === "link")).toBe(
      true,
    );
    // A panela não tem relação com celular.
    expect(row.matches.some((m) => m.productId === "prod-panela")).toBe(false);
  });

  it("palavra significativa em comum, com plural", async () => {
    const row = await runProductLookup(
      admin,
      { url: "https://loja.example.com/x" },
      {
        fetchPreview: async () =>
          preview({ title: "Panela de pressão elétrica 6L" }),
      },
    );
    const panela = row.matches.find((m) => m.productId === "prod-panela")!;
    expect(panela.reasons).toEqual(
      expect.arrayContaining(["category", "word"]),
    );
  });
});
