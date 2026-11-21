import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { MATERIAL_VIDRO, sheetFor } from "./quote-sheet-fixture";
import {
  boxesForSheet,
  catalogAlerts,
  changedSheetFields,
  draftChangedFields,
  draftFromBaseline,
  mergeBaselines,
  missingSheet,
  normalizeSheet,
  sheetWarnings,
  type SupplierSheetDraft,
} from "@/lib/supplier-sheet";
import type { SupplierSheetBaseline } from "@/lib/db/schema";

/*
 * Ficha técnica na cotação de compra (dono, 20/11/2026; docs/PURCHASE_DEMAND.md,
 * "Ficha técnica na cotação"): quem nunca vendeu o produto informa; quem já
 * vendeu confere o que temos (uma vez só); a correção vai para o Cadastro,
 * sem mudar o cadastro do produto nem o Sankhya; comercial obrigatório; a
 * foto na balança do cadastro só vale para quem já vendeu.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const strategy = await import("@/lib/services/purchase-strategy");
const quotes = await import("@/lib/services/purchase-quote");
const sheets = await import("@/lib/services/supplier-sheets");
type User = import("@/lib/db").User;

const blank: SupplierSheetDraft = {
  masterBoxQty: null,
  boxLengthCm: null,
  boxWidthCm: null,
  boxHeightCm: null,
  cbm: null,
  netWeightKg: null,
  grossWeightBoxKg: null,
  grossUnknown: false,
  materialIds: [],
  factoryItemCode: "",
  noFactoryCode: false,
};
const full: SupplierSheetDraft = sheetFor("x").draft;
/** O catálogo dos testes puros (a lista inicial tem o mesmo id). */
const catalog = new Map([
  [MATERIAL_VIDRO, { namePt: "Vidro" }],
  ["mat-plastico", { namePt: "Plástico" }],
]);

describe("regras puras da ficha técnica", () => {
  it("o que falta: tudo em branco; medidas ou CBM; sem código vale; o inner não é dele", () => {
    expect(missingSheet(blank, catalog)).toEqual([
      "masterBoxQty",
      "box",
      "netWeightKg",
      "grossWeightBoxKg",
      "material",
      "factoryItemCode",
    ]);
    expect(missingSheet(full, catalog)).toEqual([]);
    // Duas medidas só não bastam; o CBM sozinho basta.
    expect(missingSheet({ ...full, boxHeightCm: null }, catalog)).toEqual([
      "box",
    ]);
    expect(
      missingSheet({ ...full, boxHeightCm: null, cbm: 0.05 }, catalog),
    ).toEqual([]);
    expect(
      missingSheet(
        { ...full, factoryItemCode: "", noFactoryCode: true },
        catalog,
      ),
    ).toEqual([]);
    // Peças por caixa quebradas não valem.
    expect(missingSheet({ ...full, masterBoxQty: 2.5 }, catalog)).toEqual([
      "masterBoxQty",
    ]);
  });

  it("Sem peso: dispensa o peso bruto, sem gravar zero, e o número digitado não vale", () => {
    const unknown = { ...full, grossWeightBoxKg: null, grossUnknown: true };
    expect(missingSheet(unknown, catalog)).toEqual([]);
    const data = normalizeSheet(
      { ...full, grossWeightBoxKg: 12.5, grossUnknown: true },
      catalog,
    )!;
    expect(data.grossWeightBoxKg).toBeNull();
    expect(data.grossWeightUnknown).toBe(true);
    // Sem marcar e sem o número: falta.
    expect(
      missingSheet({ ...full, grossWeightBoxKg: null }, catalog),
    ).toEqual(["grossWeightBoxKg"]);
    // Peso informado: a marca fica falsa.
    expect(normalizeSheet(full, catalog)!.grossWeightUnknown).toBe(false);
  });

  it("material só do catálogo: id desconhecido não vale; o texto vira os nomes em português", () => {
    expect(
      missingSheet({ ...full, materialIds: ["inventado"] }, catalog),
    ).toEqual(["material"]);
    const data = normalizeSheet(
      { ...full, materialIds: ["mat-plastico", MATERIAL_VIDRO, "mat-plastico"] },
      catalog,
    )!;
    expect(data.materialIds).toEqual(["mat-plastico", MATERIAL_VIDRO]);
    expect(data.material).toBe("Plástico / Vidro");
    // A ficha de compra (texto) sem catálogo que bata: fica o texto.
    const text = normalizeSheet(
      { ...full, materialIds: [], materialText: "Bambu tratado" },
      catalog,
    )!;
    expect(text.materialIds).toBeNull();
    expect(text.material).toBe("Bambu tratado");
  });

  it("CBM das medidas sem arredondar; inner não perguntado = nulo; sem código = nulo", () => {
    const data = normalizeSheet(
      {
        ...full,
        masterBoxQty: 240,
        boxLengthCm: 31,
        boxWidthCm: 63.5,
        boxHeightCm: 75,
        noFactoryCode: true,
      },
      catalog,
    )!;
    expect(data.cbm).toBeCloseTo(0.1476375, 10);
    expect(data.innerBoxQty).toBeNull();
    expect(data.factoryItemCode).toBeNull();
    expect(normalizeSheet(blank, catalog)).toBeNull();
  });

  it("avisos: medidas × CBM, inner exigido que não fecha ou maior, caixa mais leve que as peças", () => {
    const keys = (d: SupplierSheetDraft, inner: number | null = null) =>
      sheetWarnings(d, { cbmPercent: 5 }, inner).map((w) => w.key);
    expect(keys(full)).toEqual([]);
    expect(keys({ ...full, cbm: 0.1 })).toEqual(["cbm_dims_mismatch"]);
    expect(keys({ ...full, cbm: 0.0855 })).toEqual([]); // 1,8% de 0,084
    // O inner é o exigido pelo cliente; sem exigência, nada de inner.
    expect(keys(full, 6)).toEqual([]);
    expect(keys(full, 5)).toEqual(["inner_not_closing"]);
    expect(keys(full, 48)).toEqual(["inner_above_master"]);
    // 24 peças × 0,6 kg = 14,4 kg dentro de uma caixa de 12,5 kg.
    expect(keys({ ...full, netWeightKg: 0.6 })).toEqual(["gross_below_net"]);
    // Sem peso: não há o que comparar.
    expect(keys({ ...full, netWeightKg: 0.6, grossUnknown: true })).toEqual(
      [],
    );
  });

  const ours: SupplierSheetBaseline = {
    masterBoxQty: 24,
    innerBoxQty: 6,
    boxLengthCm: 60,
    boxWidthCm: 40,
    boxHeightCm: 35,
    cbm: 0.084,
    netWeightKg: 0.45,
    grossWeightBoxKg: 12,
    material: "Vidro",
    factoryItemCode: null,
  };

  it("o que mudou: medidas em outra ordem e arredondamento não são correção; campo vazio preenchido também não", () => {
    const same = normalizeSheet(
      {
        ...full,
        boxLengthCm: 40,
        boxWidthCm: 60,
        grossWeightBoxKg: 12.04,
      },
      catalog,
    )!;
    expect(changedSheetFields(same, ours)).toEqual([]);
    const other = normalizeSheet(
      {
        ...full,
        masterBoxQty: 36,
        netWeightKg: 0.4,
        materialIds: ["mat-plastico"],
      },
      catalog,
    )!;
    // O inner não entra (não é dele); o bruto 12,5 contra os nossos 12 e o
    // material de Vidro para Plástico mudaram.
    expect(changedSheetFields(other, ours)).toEqual([
      "masterBoxQty",
      "netWeightKg",
      "grossWeightBoxKg",
      "material",
    ]);
    // Sem peso com o nosso peso: ele não confirma o que temos.
    const unknown = normalizeSheet({ ...full, grossUnknown: true }, catalog)!;
    expect(changedSheetFields(unknown, ours)).toEqual(["grossWeightBoxKg"]);
    expect(
      draftChangedFields({ ...full, grossUnknown: true }, ours, "Vidro"),
    ).toEqual(["grossWeightBoxKg"]);
    // Enquanto digita: a mesma regra, só onde há os dois valores.
    expect(draftChangedFields({ ...blank, masterBoxQty: 36 }, ours)).toEqual([
      "masterBoxQty",
    ]);
    expect(draftChangedFields(full, ours, "Plástico")).toEqual([
      "grossWeightBoxKg",
      "material",
    ]);
    // Sem o que tínhamos (quem nunca vendeu), nada é correção.
    expect(changedSheetFields(other, null)).toEqual([]);
  });

  it("avisos do comparativo: peso acima da tolerância, outra caixa, CBM só da mesma caixa", () => {
    const tol = { weightPercent: 3, dimensionPercent: 5, cbmPercent: 5 };
    const lighter = normalizeSheet({ ...full, netWeightKg: 0.3 }, catalog)!;
    expect(catalogAlerts(lighter, ours, tol).map((a) => a.key)).toEqual([
      "weight",
    ]);
    const bigger = normalizeSheet(
      {
        ...full,
        masterBoxQty: 48,
        boxHeightCm: 70,
      },
      catalog,
    )!;
    // Outra caixa: o CBM e as medidas não se comparam (a caixa é outra).
    expect(catalogAlerts(bigger, ours, tol).map((a) => a.key)).toEqual([
      "other_box",
    ]);
    const wide = normalizeSheet({ ...full, boxWidthCm: 44 }, catalog)!;
    expect(catalogAlerts(wide, ours, tol).map((a) => a.key)).toEqual([
      "cbm",
      "dims",
    ]);
  });

  it("o que temos: a caixa vem de uma fonte só; o CBM de outra caixa não entra", () => {
    const previous = { ...ours, cbm: null, boxLengthCm: null };
    const catalog36 = { ...ours, masterBoxQty: 36, cbm: 0.12 };
    const merged = mergeBaselines(previous, catalog36);
    expect(merged.masterBoxQty).toBe(24);
    expect(merged.cbm).toBeNull();
    expect(merged.boxLengthCm).toBeNull();
    // Sem quantidade na outra fonte, o CBM dela entra.
    expect(
      mergeBaselines(previous, { ...catalog36, masterBoxQty: null }).cbm,
    ).toBe(0.12);
    // O rascunho de quem já vendeu vem do que temos (os materiais do catálogo
    // que o nosso texto cita, achados por quem chama).
    expect(draftFromBaseline(ours, [MATERIAL_VIDRO])).toMatchObject({
      masterBoxQty: 24,
      cbm: 0.084,
      grossUnknown: false,
      materialIds: [MATERIAL_VIDRO],
    });
  });

  it("caixas e m³ pela caixa dele: uma conta por programação", () => {
    // 1.000 + 1.000 com 24 por caixa: 42 + 42 caixas (a última incompleta).
    expect(
      boxesForSheet([1000, 1000], { masterBoxQty: 24, cbm: 0.084 }),
    ).toEqual({
      boxes: 84,
      cbm: 84 * 0.084,
    });
    expect(boxesForSheet([], { masterBoxQty: 24, cbm: 0.084 })).toBeNull();
  });
});

describe("na cotação de compra", () => {
  let buyer: User;
  let director: User;
  let admin: User;
  let joao: User;
  let supplierA: User;
  let supplierC: User;
  const T0 = new Date("2026-11-20T09:00:00-03:00");
  const plus = (hours: number) => new Date(T0.getTime() + hours * 3_600_000);

  beforeAll(async () => {
    const { users } = await seedDemo();
    const by = (email: string) => users.find((u) => u.email === email)!;
    buyer = by("operador@wellmix.com");
    director = by("diretoria@wellmix.com");
    admin = by("admin@wellmix.com");
    joao = by("joao@lojista.com");
    supplierA = by("supplier.a@china.com");
    supplierC = by("supplier.c@china.com");
    await quotes.setSupplierLines(admin, supplierC.partyId!, [
      "linha-utilidades",
    ]);
    // O cadastro da jarra (como veio do Sankhya) e A, que já vendeu a jarra.
    await getStore().update("products", "prod-jarra", {
      masterBoxQty: 24,
      innerBoxQty: 6,
      boxLengthCm: 60,
      boxWidthCm: 40,
      boxHeightCm: 35,
      cbm: 0.084,
      netWeightKg: 0.45,
      grossWeightKg: 0.5,
      material: "Vidro",
    });
    await getStore().create("product_suppliers", {
      productId: "prod-jarra",
      supplierId: supplierA.partyId!,
      supplierSku: "JR-A1",
      price: null,
      currency: null,
      moq: null,
      leadTimeDays: null,
      source: "sankhya",
      createdByUserId: null,
      sankhyaLastPurchaseAt: "2026-06-01T12:00:00.000Z",
    });
  });

  async function openQuote() {
    const d = await requests.createRequest(joao, {
      customerId: "cliente-joao",
      productId: "prod-jarra",
      productName: "Jarra",
      description: "Encomenda",
      quantity: 1000,
      unit: "un",
    });
    await strategy.sendToStrategy(buyer, [d.id]);
    const decision = await strategy.chooseStrategy(buyer, {
      demandIds: [d.id],
      choice: "quote",
      note: null,
    });
    await strategy.decideStrategy(director, decision.id, {
      approve: true,
      note: null,
    });
    const fresh = (await getStore().get("purchase_decisions", decision.id))!;
    const quote = (await getStore().get("purchase_quotes", fresh.quoteId!))!;
    for (const r of await getStore().list("purchase_quote_responses", {
      filter: { quoteId: quote.id },
    }))
      await getStore().update("purchase_quote_responses", r.id, {
        invitedAt: T0.toISOString(),
        dueAt: plus(24).toISOString(),
      });
    return quote;
  }

  const commercial = {
    decline: false,
    currency: "USD",
    incoterm: "EXW",
    leadTimeDays: 40,
    port: "Ningbo",
    moq: 500,
    note: null,
  };
  const answer = (unitPrice: number, sheetsIn = [sheetFor("prod-jarra")]) => ({
    ...commercial,
    prices: [{ productId: "prod-jarra", unitPrice }],
    sheets: sheetsIn,
  });
  const responseOf = async (quoteId: string, user: User) =>
    (
      await getStore().list("purchase_quote_responses", {
        filter: { quoteId, supplierId: user.partyId! },
      })
    )[0];

  it("comercial obrigatório: prazo, pedido mínimo e porto (também no EXW)", async () => {
    const quote = await openQuote();
    for (const [patch, code] of [
      [{ leadTimeDays: null }, "quote_lead_required"],
      [{ moq: null }, "quote_moq_required"],
      [{ port: "  " }, "quote_port_required"],
    ] as const)
      await expect(
        quotes.answerQuote(
          supplierC,
          quote.id,
          { ...answer(2), ...patch },
          plus(1),
        ),
      ).rejects.toThrow(code);
  });

  it("quem nunca vendeu: a ficha vem em branco, é obrigatória e fica gravada como informada", async () => {
    expect(
      (await sheets.soldBeforeProducts(supplierC.partyId!, ["prod-jarra"])).has(
        "prod-jarra",
      ),
    ).toBe(false);
    const quote = await openQuote();
    const r = await responseOf(quote.id, supplierC);
    const [line] = await sheets.quoteSheetLines(quote, r);
    expect(line).toMatchObject({
      soldBefore: false,
      ask: true,
      baseline: null,
      askPhoto: true,
    });
    await expect(
      quotes.answerQuote(supplierC, quote.id, answer(2, []), plus(1)),
    ).rejects.toThrow("quote_sheet_missing");
    await quotes.answerQuote(
      supplierC,
      quote.id,
      answer(2, [sheetFor("prod-jarra", { masterBoxQty: 36 })]),
      plus(1),
    );
    const pair = (
      await sheets.loadPairSheets(supplierC.partyId!, ["prod-jarra"])
    ).get("prod-jarra")!;
    expect(pair).toMatchObject({
      kind: "declared",
      review: null,
      soldBefore: false,
      source: "quote",
      quoteId: quote.id,
    });
    expect(pair.data.masterBoxQty).toBe(36);
    const saved = await responseOf(quote.id, supplierC);
    expect(saved.items?.[0]).toMatchObject({
      productId: "prod-jarra",
      sheetKind: "declared",
    });
    // A foto do cadastro não vale para ele no pedido; a dele, sim.
    const order = { id: "pedido-x", supplierId: supplierC.partyId! };
    expect(await sheets.scalePhotoForOrder(order, "prod-jarra")).toEqual({
      catalogCounts: false,
      ownDocumentId: null,
    });
    await sheets.setQuoteScalePhoto(saved, "prod-jarra", "doc-balanca-c");
    expect(
      (await sheets.scalePhotoForOrder(order, "prod-jarra")).ownDocumentId,
    ).toBe("doc-balanca-c");
    // Próxima cotação do mesmo par: só o comercial ("Confirmada antes").
    const next = await openQuote();
    const [again] = await sheets.quoteSheetLines(
      next,
      await responseOf(next.id, supplierC),
    );
    expect(again.ask).toBe(false);
    expect(again.settled?.id).toBe(pair.id);
    await quotes.answerQuote(supplierC, next.id, answer(1.9, []), plus(1));
    expect((await responseOf(next.id, supplierC)).items?.[0].sheetKind).toBe(
      "existing",
    );
  });

  it("quem já vendeu: confere o que temos; corrigida vai para o Cadastro, sem mudar o cadastro do produto", async () => {
    const quote = await openQuote();
    const r = await responseOf(quote.id, supplierA);
    const [line] = await sheets.quoteSheetLines(quote, r);
    expect(line.soldBefore).toBe(true);
    expect(line.baseline).toMatchObject({
      masterBoxQty: 24,
      cbm: 0.084,
      netWeightKg: 0.45,
      grossWeightBoxKg: 12,
      material: "Vidro",
      // O código dele (o vínculo), nunca o de outro fornecedor.
      factoryItemCode: "JR-A1",
    });
    // A foto: o cadastro da jarra não tem foto na balança, então é pedida.
    expect(line.askPhoto).toBe(true);
    // Sem o "Confirmo", não envia.
    await expect(
      quotes.answerQuote(
        supplierA,
        quote.id,
        answer(2.2, [{ ...sheetFor("prod-jarra"), confirmed: false }]),
        plus(1),
      ),
    ).rejects.toThrow("quote_sheet_confirm");
    await quotes.answerQuote(
      supplierA,
      quote.id,
      answer(2.2, [
        sheetFor("prod-jarra", {
          masterBoxQty: 36,
          grossWeightBoxKg: 18,
          factoryItemCode: "JR-A1",
        }),
      ]),
      plus(1),
    );
    const pair = (
      await sheets.loadPairSheets(supplierA.partyId!, ["prod-jarra"])
    ).get("prod-jarra")!;
    expect(pair).toMatchObject({
      kind: "corrected",
      review: "pending",
      soldBefore: true,
    });
    expect(pair.changedFields).toEqual(["masterBoxQty", "grossWeightBoxKg"]);
    // O cadastro do produto não muda (nem o Sankhya).
    expect((await getStore().get("products", "prod-jarra"))!.masterBoxQty).toBe(
      24,
    );
    // Pendência do Cadastro (o administrador faz tudo).
    const drafts = await sheets.supplierSheetTaskDrafts(admin);
    expect(drafts.map((d) => d.link)).toContain(
      `/app/supplier-sheets/${pair.id}`,
    );
    // Quem não tem a ação não revisa; o fornecedor também não.
    await expect(
      sheets.reviewSupplierSheet(buyer, pair.id, { accept: true, note: null }),
    ).rejects.toThrow();
    await expect(
      sheets.reviewSupplierSheet(supplierA, pair.id, {
        accept: true,
        note: null,
      }),
    ).rejects.toThrow("forbidden");
    // Recusar pede o motivo; recusada, ele confere de novo na próxima cotação.
    await expect(
      sheets.reviewSupplierSheet(admin, pair.id, { accept: false, note: " " }),
    ).rejects.toThrow("supplier_sheet_reject_note");
    await sheets.reviewSupplierSheet(admin, pair.id, {
      accept: false,
      note: "A caixa do último pedido era de 24",
    });
    const next = await openQuote();
    const [again] = await sheets.quoteSheetLines(
      next,
      await responseOf(next.id, supplierA),
    );
    expect(again).toMatchObject({
      ask: true,
      rejectedNote: "A caixa do último pedido era de 24",
    });
    // Agora confirma o que temos, sem mudar nada: confirmada, sem revisão.
    await quotes.answerQuote(
      supplierA,
      next.id,
      answer(2.2, [
        sheetFor("prod-jarra", {
          grossWeightBoxKg: 12,
          factoryItemCode: "JR-A1",
        }),
      ]),
      plus(1),
    );
    const confirmed = (
      await sheets.loadPairSheets(supplierA.partyId!, ["prod-jarra"])
    ).get("prod-jarra")!;
    expect(confirmed).toMatchObject({
      id: pair.id,
      kind: "confirmed",
      review: null,
      changedFields: null,
    });
    expect(await sheets.supplierSheetTaskDrafts(admin)).toEqual([]);
  });

  it("aceitar a correção: vale para o fornecedor, não volta a ser pedida", async () => {
    const created = await getStore().create("supplier_product_sheets", {
      productId: "prod-panela",
      supplierId: supplierC.partyId!,
      kind: "corrected",
      data: normalizeSheet(full)!,
      baseline: null,
      changedFields: ["masterBoxQty"],
      soldBefore: true,
      source: "quote",
      quoteId: null,
      quoteResponseId: null,
      orderId: null,
      scalePhotoDocumentId: null,
      confirmedAt: T0.toISOString(),
      confirmedByUserId: supplierC.id,
      review: "pending",
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNote: null,
    });
    const reviewed = await sheets.reviewSupplierSheet(admin, created.id, {
      accept: true,
      note: null,
    });
    expect(reviewed.review).toBe("accepted");
    expect(sheets.sheetSettled(reviewed)).toBe(true);
    await expect(
      sheets.reviewSupplierSheet(admin, created.id, {
        accept: true,
        note: null,
      }),
    ).rejects.toThrow("supplier_sheet_not_pending");
  });

  it("pedido direto: a ficha de compra completa do fornecedor vale como a ficha técnica, uma vez só", async () => {
    const supplierB = (
      await getStore().list("users", {
        filter: { email: "supplier.b@china.com" },
      })
    )[0];
    const order = { id: "pedido-direto", supplierId: supplierB.partyId! };
    const ficha = {
      productId: "prod-jarra",
      masterCartonQty: 24,
      innerQty: 6,
      lengthCm: 60,
      widthCm: 40,
      heightCm: 35,
      cbmPerCarton: 0.084,
      netWeightPcKg: 0.45,
      grossWeightPcKg: 0.5,
      material: "Vidro",
      factoryItemCode: "B-77",
    };
    // A Wellmix preenchendo a ficha não é a confirmação dele.
    expect(
      await sheets.recordFromPurchaseSheet(admin, order, ficha),
    ).toBeNull();
    // Sem o código do item na fábrica (a ficha de compra não exige), não
    // grava: a cotação pede.
    expect(
      await sheets.recordFromPurchaseSheet(supplierB, order, {
        ...ficha,
        factoryItemCode: null,
      }),
    ).toBeNull();
    // O inner não é da ficha do par (dono, 21/11/2026): sem ele, grava.
    const saved = (await sheets.recordFromPurchaseSheet(supplierB, order, {
      ...ficha,
      innerQty: null,
    }))!;
    expect(saved).toMatchObject({
      kind: "declared",
      source: "purchase_sheet",
      orderId: "pedido-direto",
      review: null,
    });
    expect(saved.data.grossWeightBoxKg).toBeCloseTo(12, 10);
    expect(saved.data.innerBoxQty).toBeNull();
    // O texto "Vidro" da ficha de compra vira o material do catálogo.
    expect(saved.data.materialIds).toEqual([MATERIAL_VIDRO]);
    // Já vale: outra ficha salva não grava de novo.
    expect(
      await sheets.recordFromPurchaseSheet(supplierB, order, ficha),
    ).toBeNull();
  });

  it("foto na balança do cadastro enviada pelo próprio fornecedor vale para ele", async () => {
    const doc = await getStore().create("documents", {
      name: "balanca.jpg",
      mime: "image/jpeg",
      storageKey: "k-balanca",
      size: 1,
      type: "photo",
      visibility: "internal",
      uploadedByUserId: supplierC.id,
      orderId: null,
      requestId: null,
      requirementId: null,
      version: 1,
    } as never);
    await getStore().create("product_photos", {
      productId: "prod-jarra",
      sourcingItemId: null,
      orderId: null,
      documentId: doc.id,
      kind: "weight_scale",
      caption: null,
      takenAt: null,
      takenByUserId: supplierC.id,
      derivedFromPhotoId: null,
      isPrimary: false,
    });
    const c = await sheets.scalePhotoForOrder(
      { id: "pedido-y", supplierId: supplierC.partyId! },
      "prod-jarra",
    );
    expect(c.catalogCounts).toBe(true);
  });

  it("a vencedora: a solicitação ao fornecedor nasce com a embalagem e o peso que ela informou", async () => {
    const quote = await openQuote();
    // C já tem a ficha (informada antes): responde só o comercial.
    await quotes.answerQuote(supplierC, quote.id, answer(1.8, []), plus(1));
    await quotes.answerQuote(supplierA, quote.id, answer(2.5, []), plus(1));
    const rC = await responseOf(quote.id, supplierC);
    await quotes.chooseWinner(buyer, quote.id, rC.id, null, plus(2));
    const approved = await quotes.decideWinner(director, quote.id, {
      approve: true,
      note: null,
    });
    const [sr] = await getStore().list("supplier_requests", {
      filter: { id: approved.supplierRequestIds! },
    });
    expect(sr.item).toMatchObject({
      masterCartonQty: 36,
      // Sem inner exigido pelo cliente, a solicitação nasce sem inner (a
      // ficha do par não pergunta mais).
      innerQty: null,
      netWeightPcKg: 0.45,
      cbmPerCarton: 0.084,
      material: "Vidro",
      factoryItemCode: "JR-01",
      // Medidas da solicitação são do produto: as da caixa não entram.
      lengthCm: null,
    });
    expect(sr.item.grossWeightPcKg).toBeCloseTo(12.5 / 36, 10);
  });
});
