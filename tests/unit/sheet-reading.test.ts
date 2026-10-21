import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Ficha pela foto do quadro: a IA transcreve o quadro preenchido à mão; o que
 * falta na ficha é preenchido e o que diverge fica marcado até a Wellmix
 * decidir qual vale (ex.: MOQ 12000 no quadro e 2400 na ficha).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const reading = await import("@/lib/services/sheet-reading");
const calc = await import("@/lib/services/sheet-reading-calc");
const { canAccessDocument } = await import("@/lib/services/documents");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
});

const boardPhoto = () =>
  new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], "quadro.png", {
    type: "image/png",
  });

describe("leitura do quadro (sem IA)", () => {
  it("transcreve como a ficha guarda: moeda, data, milhar, peso", () => {
    expect(
      calc.normalizeReading({
        sheetDate: "2026.10.13",
        currency: "RMB",
        price: "4",
        moq: "12,000",
        masterCartonQty: 12,
        netWeightPcKg: "0.225",
        incoterm: "Exw",
        material: "  PS+PVC ",
        grossWeightPcKg: null,
        cbmPerCarton: "",
      }),
    ).toEqual({
      sheetDate: "2026-10-13T00:00:00.000Z",
      currency: "RMB",
      price: 4,
      moq: 12000,
      masterCartonQty: 12,
      netWeightPcKg: 0.225,
      incoterm: "EXW",
      material: "PS+PVC",
    });
    expect(calc.normalizeReading({ currency: "U$", price: 3.8 })).toEqual({
      currency: "USD",
      price: 3.8,
    });
  });

  it("preço sem moeda não entra (4 yuan não vira 4 dólares)", () => {
    expect(calc.normalizeReading({ price: 4 })).toEqual({});
    // Ficha em US$ e quadro em RMB: o preço não é gravado na moeda errada.
    expect(
      calc.fillFromReading(
        { currency: "USD", price: null },
        { currency: "RMB", price: 4 },
      ),
    ).toEqual({});
  });

  it("divergência some quando a Wellmix decide e volta se a ficha mudar", () => {
    const fields = { moq: 12000, material: "PS+PVC" };
    const sheet = { moq: 2400, material: "ps+pvc" };
    expect(
      calc.readingDivergences(sheet, { fields, resolutions: null }),
    ).toEqual([{ field: "moq", photo: 12000, sheet: 2400 }]);
    const decided = {
      moq: { choice: "sheet" as const, value: 2400, byUserId: "x", at: "" },
    };
    expect(
      calc.readingDivergences(sheet, { fields, resolutions: decided }),
    ).toEqual([]);
    expect(
      calc.readingDivergences(
        { ...sheet, moq: 3000 },
        { fields, resolutions: decided },
      ),
    ).toHaveLength(1);
  });
});

describe("ficha da cotação pela foto do quadro", () => {
  it("fornecedor lê, ficha preenchida, MOQ divergente; só a Wellmix decide", async () => {
    const store = getStore();
    await setSetting("aiMode", "MOCK");
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Porta-retrato",
      description: "Porta-retrato A4",
      specification: null,
      quantity: 1200,
      unit: "un",
      deadline: null,
    });
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const [quote] = await store.list("quotes", {
      filter: { requestId: request.id, supplierId: "fornecedor-a" },
    });
    // O fornecedor já tinha digitado MOQ 2400 na ficha.
    await qs.saveQuoteSheet(supplierA, quote.id, { moq: 2400 });

    // Quem não edita a ficha não lê o quadro.
    await expect(
      reading.readSheetBoard(supplierB, "quote", quote.id, boardPhoto()),
    ).rejects.toThrow("forbidden");
    await expect(
      reading.readSheetBoard(joao, "quote", quote.id, boardPhoto()),
    ).rejects.toThrow("forbidden");

    const done = await reading.readSheetBoard(
      supplierA,
      "quote",
      quote.id,
      boardPhoto(),
    );
    // Mock: quadro com MOQ 12000, caixa 12, EXW, RMB 4 e material.
    expect(done.filled).toEqual(
      expect.arrayContaining([
        "incoterm",
        "currency",
        "price",
        "masterCartonQty",
        "material",
      ]),
    );
    expect(done.divergent).toContain("moq");
    const sheet = (await qs.getQuoteSheet(quote.id))!;
    expect(sheet).toMatchObject({
      moq: 2400,
      masterCartonQty: 12,
      currency: "RMB",
      price: 4,
      incoterm: "EXW",
    });

    // A foto do quadro fica guardada: o fornecedor e a Wellmix abrem; o
    // cliente e o outro fornecedor não.
    const doc = (await store.get("documents", done.reading.documentId))!;
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(await canAccessDocument(admin, doc)).toBe(true);
    expect(await canAccessDocument(supplierB, doc)).toBe(false);
    expect(await canAccessDocument(joao, doc)).toBe(false);

    const view = (await reading.sheetReadingView(quote.id, sheet))!;
    expect(view.divergences.map((d) => d.field)).toContain("moq");

    // O fornecedor não decide; a Wellmix decide pelo quadro.
    await expect(
      reading.resolveReadingDivergence(
        supplierA,
        done.reading.id,
        "moq",
        "photo",
      ),
    ).rejects.toThrow("forbidden");
    await reading.resolveReadingDivergence(
      admin,
      done.reading.id,
      "moq",
      "photo",
    );
    const after = (await qs.getQuoteSheet(quote.id))!;
    expect(after.moq).toBe(12000);
    const view2 = (await reading.sheetReadingView(quote.id, after))!;
    expect(view2.divergences.map((d) => d.field)).not.toContain("moq");
    const history = await store.list("audit_log", {
      filter: { action: "sheet.resolve_divergence" },
    });
    expect(history.length).toBeGreaterThan(0);
  });

  it("IA desligada: avisa e não lê", async () => {
    await setSetting("aiMode", "MANUAL");
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Quadro",
      description: "Teste",
      specification: null,
      quantity: 10,
      unit: "un",
      deadline: null,
    });
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const [quote] = await getStore().list("quotes", {
      filter: { requestId: request.id },
    });
    await expect(
      reading.readSheetBoard(supplierA, "quote", quote.id, boardPhoto()),
    ).rejects.toThrow("ai_unavailable");
  });
});
