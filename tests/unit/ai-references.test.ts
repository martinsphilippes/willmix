import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Referências por IA na escolha do grupo (docs/SUPPLIER_REQUESTS.md,
 * "Referências por IA"): três prompts (padrão das Configurações, editáveis
 * na escolha) viram duas imagens aproximadas e uma ficha; os arquivos ficam
 * com a escolha (só a Wellmix) e passam à solicitação ao abrir (o fornecedor
 * dela vê, outro não).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting, getSettings } = await import("@/lib/settings");
const lots = await import("@/lib/services/booking-lots");
const groups = await import("@/lib/services/selection-groups");
const refs = await import("@/lib/services/ai-references");
const pure = await import("@/lib/ai-references");
const media = await import("@/lib/integrations/openai-media");
const { canAccessDocument } = await import("@/lib/services/documents");
type User = import("@/lib/db").User;

let admin: User;
let supplierA: User;
let supplierB: User;

const HEADER = [
  "SUPPLIER NAME",
  "DATE",
  "SKU",
  "DESCRIPTION",
  "FOB/EXW",
  "CONI US $/RMB",
  "PRICE",
  "QTY/BOX",
  "QTY/INNER",
  "N.W./PC",
  "G.W./PC",
  "CBM",
  "SIZE(CM) LENGTH",
  "SIZE(CM) WIDTH",
  "SIZE(CM) HEIGHT",
  "CAPACITY(ML)",
  "PACKAGE",
  "MATERIAL",
  "MOQ",
  "PURCHASE QTY IN PCS",
];
const row = (sku: string, desc: string) => [
  "Shenzhen Supplier A",
  "2026.10.13",
  sku,
  desc,
  "FOB",
  "USD",
  "1.25",
  "48",
  "12",
  "0.3",
  "0.35",
  "0.12",
  "10",
  "8",
  "20",
  "350",
  "color box",
  "glass",
  "1000",
  "600",
];

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find(
    (u) => u.role === "supplier" && u.partyId !== supplierA.partyId,
  )!;
});

afterEach(() => vi.unstubAllGlobals());

describe("prompts (puro)", () => {
  const defaults = { product: "A", detail: "B", sheet: "C" };
  it("grava só o que difere do padrão", () => {
    expect(
      pure.promptsToSave({ product: " A ", detail: "", sheet: "C" }, defaults),
    ).toBeNull();
    expect(pure.promptsToSave({ product: "X" }, defaults)).toEqual({
      product: "X",
      detail: "B",
      sheet: "C",
    });
    expect(pure.effectivePrompts(null, defaults)).toEqual(defaults);
    expect(
      pure.effectivePrompts({ product: "X", detail: "", sheet: "" }, defaults),
    ).toEqual({ product: "X", detail: "B", sheet: "C" });
  });

  it("junta os dados do item e o que a Wellmix precisa, sem inventar", () => {
    const text = pure.buildReferencePrompt(
      "product",
      "Foto do produto",
      {
        description: "Marble tray",
        productName: null,
        factoryItemCode: "GA-1",
        itemNumber: null,
        material: "marble",
        colorAssortment: null,
        lengthCm: 10,
        widthCm: 8,
        heightCm: null,
        capacityMl: null,
        sizeText: null,
        packageType: "color box",
        powerDetail: null,
        masterCartonQty: 24,
        innerQty: null,
      },
      "Logo gravado",
    );
    expect(text).toContain("Foto do produto");
    expect(text).toContain("- Product: Marble tray");
    expect(text).toContain("- Material: marble");
    expect(text).toContain("Logo gravado");
    // Medida incompleta não entra; nada de "null".
    expect(text).not.toContain("Dimensions");
    expect(text).not.toContain("null");
    expect(pure.referenceFileName("sheet", "GA 1/x", "text/plain")).toBe(
      "ia-sheet-GA-1-x.txt",
    );
  });
});

describe("adaptador OpenAI", () => {
  it("pede a imagem e o texto com a chave só no cabeçalho", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (url.endsWith("/images/generations"))
          return Response.json({
            data: [{ b64_json: Buffer.from("png").toString("base64") }],
          });
        return Response.json({ output_text: "Sheet text" });
      }),
    );
    const a = new media.OpenAiMediaAdapter("sk-test", "gpt-image-1", "gpt-x");
    const img = await a.image("prompt");
    expect(Buffer.from(img.bytes).toString()).toBe("png");
    expect(await a.text("prompt")).toBe("Sheet text");
    expect(calls[0].url).toBe("https://api.openai.com/v1/images/generations");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      model: "gpt-image-1",
      prompt: "prompt",
    });
    expect(calls[1].url).toBe("https://api.openai.com/v1/responses");
    expect(
      (calls[1].init.headers as Record<string, string>).authorization,
    ).toBe("Bearer sk-test");
  });

  it("erro da OpenAI vira um motivo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 429 })),
    );
    const a = new media.OpenAiMediaAdapter("sk-test", "gpt-image-1", "gpt-x");
    await expect(a.text("p")).rejects.toThrow("openai_rate_limit");
  });

  it("sem chave fica manual; MOCK gera exemplo", async () => {
    const s = await getSettings();
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(media.getMediaAdapter({ ...s, aiMode: "AUTO" }).mode).toBe("manual");
    expect(media.getMediaAdapter({ ...s, aiMode: "MOCK" }).mode).toBe("mock");
    if (saved) process.env.OPENAI_API_KEY = saved;
  });
});

describe("referências da escolha do grupo", () => {
  it("gera com os prompts da escolha e entrega ao fornecedor da solicitação", async () => {
    const store = getStore();
    const file = new File(
      [
        xlsxBytes([
          {
            name: "BOOKING",
            cells: [HEADER, row("AI-1", "Glass jar"), row("AI-2", "Glass cup")],
          },
        ]),
      ],
      "b.xlsx",
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );
    const lot = await lots.createBookingLotFromSheet(admin, file);
    const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
    const items = await store.list("booking_items", {
      filter: { lotId: lot.id },
    });
    await setBookingItemsNcm(
      admin,
      items.map((i) => i.id),
      "7013.37.00",
    );
    await lots.closeBookingLot(admin, lot.id, null);
    const jar = items.find((i) => i.factoryItemCode === "AI-1")!;
    const cup = items.find((i) => i.factoryItemCode === "AI-2")!;

    const group = await groups.saveSelectionGroup(admin, {
      itemIds: [jar.id, cup.id],
      chosenItemId: jar.id,
      quantity: null,
      needs: "Tampa de bambu",
      aiPrompts: {
        product: "Jar on white",
        detail: "Lid close",
        sheet: "Spec",
      },
    });
    expect(group.aiPrompts?.product).toBe("Jar on white");

    // IA em modo manual: nada é gerado e a tela diz o motivo.
    await setSetting("aiMode", "MANUAL");
    expect(await refs.generateGroupReferences(admin, group.id)).toMatchObject({
      mode: "manual",
      generated: 0,
      error: "openai_off",
    });
    // Fornecedor não gera.
    await expect(
      refs.generateGroupReferences(supplierA, group.id),
    ).rejects.toThrow();

    await setSetting("aiMode", "MOCK");
    const result = await refs.generateGroupReferences(admin, group.id);
    expect(result).toEqual({ mode: "mock", generated: 3, error: null });
    const saved = await store.get("selection_groups", group.id);
    expect(saved?.aiAssets?.map((a) => a.kind).sort()).toEqual([
      "detail",
      "product",
      "sheet",
    ]);
    const sheet = saved!.aiAssets!.find((a) => a.kind === "sheet")!;
    const sheetDoc = (await store.get("documents", sheet.documentId))!;
    const text = new TextDecoder().decode(
      (await store.getFile(sheetDoc.storageKey))!.bytes,
    );
    // Exemplo rotulado, com o prompt da escolha e os dados do item.
    expect(text).toContain("EXEMPLO MOCK");
    expect(text).toContain("Spec");
    expect(text).toContain("Glass jar");
    expect(text).toContain("Tampa de bambu");
    const image = saved!.aiAssets!.find((a) => a.kind === "product")!;
    const imageDoc = (await store.get("documents", image.documentId))!;
    expect(imageDoc.mime).toBe("image/png");
    // Antes da solicitação, o fornecedor não abre.
    expect(await canAccessDocument(supplierA, imageDoc)).toBe(false);

    // Gravar de novo o mesmo ganhador mantém os arquivos.
    const again = await groups.saveSelectionGroup(admin, {
      itemIds: [jar.id, cup.id],
      chosenItemId: jar.id,
      quantity: null,
      needs: "Tampa de bambu",
      aiPrompts: null,
    });
    expect(again.id).toBe(group.id);
    expect(again.aiAssets).toHaveLength(3);
    expect(again.aiPrompts).toBeNull();

    const opened = await groups.openGroupRequests(admin, [group.id]);
    expect(opened.failed).toEqual([]);
    const request = (await store.get(
      "supplier_requests",
      opened.opened[0].id,
    ))!;
    expect(request.aiAssets).toHaveLength(3);
    const linked = (await store.get("documents", image.documentId))!;
    expect(linked.supplierRequestId).toBe(request.id);
    expect(await canAccessDocument(supplierA, linked)).toBe(true);
    if (supplierB)
      expect(await canAccessDocument(supplierB, linked)).toBe(false);
    await setSetting("aiMode", "AUTO");
  });
});
