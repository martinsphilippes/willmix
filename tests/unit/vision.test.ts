import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Visão de Produto: prompts centralizados por linha, IA de cadastro por foto
 * (humano confirma), marketing studio / kit (prévia → oferta → compra →
 * pagamento → liberação), modalidade de operação do cliente (RADAR) e ciclo
 * contínuo do produto.
 */
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const { buildPrompt, checkRequiredAttributes, parseList } =
  await import("@/lib/ai/prompts");
const { extractJson, getAiAdapter } = await import("@/lib/integrations/ai");
const {
  requestProductSuggestion,
  applyProductSuggestion,
  discardSuggestion,
  listSuggestions,
  requestMarketingSuggestion,
} = await import("@/lib/services/ai-suggestions");
const {
  createKit,
  updateKit,
  addKitFile,
  offerKit,
  purchaseKit,
  confirmKitPayment,
  releaseKit,
  canViewKit,
  listKits,
  loadKit,
} = await import("@/lib/services/marketing");
const { canAccessDocument } = await import("@/lib/services/documents");
const { setCustomerOperation, radarProblem } =
  await import("@/lib/services/operations");
const { loadProductCycle } = await import("@/lib/services/product-cycle");
const { listOpenReviews } = await import("@/lib/services/reviews");
const { createRequest, openRfq, answerQuote, selectQuote, confirmDownPayment } =
  await import("@/lib/services/requests");
type User = import("@/lib/db").User;

withTempStore();

let admin: User;
let customer: User;
let supplierA: User;
let broker: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  customer = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  broker = users.find((u) => u.email === "despachante@comex.com")!;
});

describe("prompts por linha (centralizados)", () => {
  it("monta base + linha + produto + contexto sem prompt fixo em componente", async () => {
    const store = getStore();
    const line = (await store.get("product_lines", "linha-utilidades"))!;
    const product = (await store.get("products", "prod-panela"))!;
    const prompt = buildPrompt("marketing", {
      line,
      product,
      context: "Campanha de Dia das Mães",
    });
    expect(prompt).toContain("Linha de produto: Utilidades domésticas");
    expect(prompt).toContain("Tom prático e acolhedor");
    expect(prompt).toContain(
      "Atributos que a linha exige: material, cor, dimensões",
    );
    expect(prompt).toContain("Regras: Não citar marcas de terceiros");
    expect(prompt).toContain("Nome: Jogo de panelas antiaderentes 5 pçs");
    expect(prompt).toContain("Contexto: Campanha de Dia das Mães");
    // Linha sem configuração: só o prompt base.
    expect(buildPrompt("registration")).toContain('"materials"');
    expect(parseList("material, cor; cor\npantone")).toEqual([
      "material",
      "cor",
      "pantone",
    ]);
  });

  it("confere atributos exigidos de forma determinística", async () => {
    const store = getStore();
    const line = (await store.get("product_lines", "linha-utilidades"))!;
    const panela = (await store.get("products", "prod-panela"))!;
    expect(checkRequiredAttributes(panela, line).missing).toEqual([]);
    const jarra = (await store.get("products", "prod-jarra"))!;
    const check = checkRequiredAttributes(jarra, line);
    expect(check.missing).toEqual(["material", "cor", "dimensões"]);
    expect(
      checkRequiredAttributes(jarra, {
        prompts: { ...line.prompts!, requiredAttributes: ["laudo de bpa"] },
      }).manual,
    ).toEqual(["laudo de bpa"]);
  });
});

describe("IA de cadastro por foto (humano confirma)", () => {
  it("sem chave e sem MOCK fica manual; MOCK devolve exemplo rotulado", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(getAiAdapter({ aiMode: "AUTO", aiModel: "x" }).mode).toBe("manual");
    expect(getAiAdapter({ aiMode: "MANUAL", aiModel: "x" }).mode).toBe(
      "manual",
    );
    expect(getAiAdapter({ aiMode: "MOCK", aiModel: "x" }).mode).toBe("mock");
    await expect(
      requestProductSuggestion(admin, "product", "prod-jarra"),
    ).rejects.toThrow("ai_unavailable");
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson("nada")).toBeNull();
  });

  it("sugere, aplica só o confirmado e registra a decisão", async () => {
    await setSetting("aiMode", "MOCK");
    const store = getStore();
    const suggestion = await requestProductSuggestion(
      admin,
      "product",
      "prod-jarra",
    );
    expect(suggestion.status).toBe("suggested");
    expect(suggestion.source).toBe("mock");
    expect(suggestion.prompt).toContain(
      "Linha de produto: Utilidades domésticas",
    );
    expect(String(suggestion.fields.category)).toContain("(mock)");
    // Nada mudou na ficha até a confirmação.
    let jarra = (await store.get("products", "prod-jarra"))!;
    expect(jarra.category).toBeNull();
    // Operador confirma categoria (editada) e cor; material exige escolha explícita e não foi marcado.
    await applyProductSuggestion(admin, suggestion.id, {
      category: "Copos e jarras",
      color: "Transparente",
    });
    jarra = (await store.get("products", "prod-jarra"))!;
    expect(jarra.category).toBe("Copos e jarras");
    expect(jarra.color).toBe("Transparente");
    expect(jarra.material).toBeNull();
    const [decided] = await listSuggestions("product", "prod-jarra");
    expect(decided.status).toBe("applied");
    expect(decided.note).toBe("category, color");
    await expect(
      applyProductSuggestion(admin, suggestion.id, { category: "x" }),
    ).rejects.toThrow("already_decided");
    // Fornecedor não pede sugestão.
    await expect(
      requestProductSuggestion(supplierA, "product", "prod-panela"),
    ).rejects.toThrow();
    // Descartar registra o motivo.
    const other = await requestProductSuggestion(
      admin,
      "sourcing_item",
      "sourcing-boia",
    );
    await discardSuggestion(admin, other.id, "Foto ruim");
    expect((await store.get("ai_suggestions", other.id))!.status).toBe(
      "discarded",
    );
  });
});

describe("marketing studio e kit", () => {
  it("prévia → oferta → compra → pagamento → liberação, com preço das configurações", async () => {
    await setSetting("marketingKitDefaultPrice", 350);
    const store = getStore();
    const kit = await createKit(admin, "prod-panela", {
      customerId: "cliente-joao",
    });
    expect(kit.price).toBe(350);
    expect(kit.currency).toBe("BRL");
    expect(kit.pantone).toBe("Black 6 C");
    expect(kit.status).toBe("draft");
    // Cliente ainda não vê (rascunho).
    expect(canViewKit(customer, kit)).toBe(false);
    // Sugestão de IA (mock) para os textos; o operador confirma pelo updateKit.
    const suggestion = await requestMarketingSuggestion(admin, kit);
    expect(String(suggestion.fields.slogan)).toContain("(mock)");
    await updateKit(admin, kit.id, {
      slogan: "Cozinhe com leveza",
      price: 300,
    });
    const preview = await addKitFile(
      admin,
      kit.id,
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "previa.png", {
        type: "image/png",
      }),
      "preview",
    );
    expect((await store.get("marketing_kits", kit.id))!.status).toBe("preview");
    // Prévia ainda invisível ao cliente antes da oferta.
    expect(await canAccessDocument(customer, preview)).toBe(false);
    await offerKit(admin, kit.id);
    expect(await canAccessDocument(customer, preview)).toBe(true);
    expect((await listKits(customer)).some((k) => k.id === kit.id)).toBe(true);
    // Outro papel não vê nem compra.
    expect(await listKits(broker)).toEqual([]);
    await expect(purchaseKit(supplierA, kit.id)).rejects.toThrow("forbidden");
    // Cliente compra: pagamento pendente com o preço do kit.
    const purchased = await purchaseKit(customer, kit.id);
    expect(purchased.status).toBe("purchased");
    const payment = (await store.get("payments", purchased.paymentId!))!;
    expect(payment.amount).toBe(300);
    expect(payment.kitId).toBe(kit.id);
    expect(payment.status).toBe("pending");
    // Preço travado depois da compra.
    await updateKit(admin, kit.id, { price: 999 });
    expect((await store.get("marketing_kits", kit.id))!.price).toBe(300);
    // Liberar antes de pagar: não.
    await expect(releaseKit(admin, kit.id)).rejects.toThrow("invalid_status");
    await confirmKitPayment(admin, kit.id);
    expect((await store.get("payments", payment.id))!.status).toBe("received");
    // Sem arquivo final não libera.
    await expect(releaseKit(admin, kit.id)).rejects.toThrow("no_final_files");
    const final = await addKitFile(
      admin,
      kit.id,
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "kit-final.pdf", {
        type: "application/pdf",
      }),
      "final",
    );
    expect(await canAccessDocument(customer, final)).toBe(false);
    const released = await releaseKit(admin, kit.id);
    expect(released.status).toBe("released");
    expect(await canAccessDocument(customer, final)).toBe(true);
    const view = (await loadKit(customer, kit.id))!;
    expect(view.releasedDocs.map((d) => d.id)).toEqual([final.id]);
    expect(view.previewDocs.map((d) => d.id)).toEqual([preview.id]);
    // Cliente de outro parceiro não abre o kit.
    expect(await loadKit(broker, kit.id)).toBeNull();
  });
});

describe("cliente com ou sem RADAR", () => {
  it("importação própria sem RADAR abre item de revisão; via trade não", async () => {
    const store = getStore();
    expect(
      radarProblem({ operationMode: "via_trade", radar: "none" }),
    ).toBeNull();
    expect(radarProblem({ operationMode: null, radar: null })).toBeNull();
    expect(
      radarProblem({ operationMode: "own_import", radar: "limited" }),
    ).toBeNull();
    expect(
      radarProblem({ operationMode: "own_import", radar: null }),
    ).toContain("não informado");
    await setCustomerOperation(admin, "cliente-joao", {
      operationMode: "own_import",
      radar: "none",
    });
    await expect(
      setCustomerOperation(customer, "cliente-joao", {
        operationMode: "via_trade",
        radar: null,
      }),
    ).rejects.toThrow();
    const request = await createRequest(customer, {
      customerId: "cliente-joao",
      productId: "prod-panela",
      productName: "Panelas",
      description: "Teste RADAR",
      specification: null,
      quantity: 500,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await openRfq(admin, request.id, ["fornecedor-a"]);
    const [quote] = await store.list("quotes", {
      filter: { requestId: request.id },
    });
    await answerQuote(supplierA, quote.id, {
      price: 9.5,
      currency: "USD",
      leadTimeDays: 30,
      conditions: null,
    });
    await selectQuote(admin, quote.id, {
      sellPrice: 40000,
      sellCurrency: "BRL",
      downPaymentAmount: 12000,
    });
    const order = await confirmDownPayment(admin, request.id);
    expect((await store.get("orders", order.id))!.operationMode).toBe(
      "own_import",
    );
    const rules = (await listOpenReviews(order.id)).map((r) => r.rule);
    expect(rules).toContain("customer.radarMissing");
    // Volta para via trade: pedidos novos não geram o item.
    await setCustomerOperation(admin, "cliente-joao", {
      operationMode: "via_trade",
      radar: "none",
    });
  });
});

describe("ciclo contínuo do produto", () => {
  it("reúne sourcing, solicitações, pedidos, pós-venda e kits por relacionamento", async () => {
    const cycle = (await loadProductCycle("prod-panela"))!;
    expect(cycle.counts.requests).toBeGreaterThanOrEqual(1);
    expect(cycle.counts.orders).toBeGreaterThanOrEqual(1);
    expect(cycle.orders[0].customerName).toBe("Loja do João Ltda");
    expect(cycle.kits.length).toBeGreaterThanOrEqual(2);
    expect(await loadProductCycle("nao-existe")).toBeNull();
  });
});
