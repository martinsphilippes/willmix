import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { MATERIAL_VIDRO, sheetFor } from "./quote-sheet-fixture";
import { innerFromDemands, quoteInnerState } from "@/lib/quote-inner";
import {
  MATERIAL_SEED,
  matchMaterials,
  materialSeedId,
  materialsText,
} from "@/lib/materials";

/*
 * Inner exigido pelo cliente, material do catálogo e "Sem peso" na cotação
 * de compra (dono, 21/11/2026; docs/PURCHASE_DEMAND.md, "Inner do cliente,
 * material do catálogo e Sem peso").
 */
withTempStore();

const { approveQuoteSample } = await import("./helpers/sampling");

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const strategy = await import("@/lib/services/purchase-strategy");
const quotes = await import("@/lib/services/purchase-quote");
const materials = await import("@/lib/services/materials");
const { parseInnerRequirement } =
  await import("@/app/app/actions/request-items");
type User = import("@/lib/db").User;

describe("inner pelas demandas (puro)", () => {
  it("ninguém pediu: sem inner; todos o mesmo: exigido; diferente ou sem número: a Wellmix define", () => {
    expect(innerFromDemands([{}, { innerRequirement: null }])).toBeNull();
    expect(
      innerFromDemands([
        { innerRequirement: { qty: 24 } },
        { innerRequirement: { qty: 24 } },
      ]),
    ).toEqual({ qty: 24, issue: null, requested: null });
    expect(
      innerFromDemands([
        { innerRequirement: { qty: 24 } },
        { innerRequirement: { qty: 12 } },
      ]),
    ).toEqual({ qty: null, issue: "conflict", requested: [12, 24] });
    // Um pediu e o outro não: também é a Wellmix quem define (0 = sem inner).
    expect(innerFromDemands([{ innerRequirement: { qty: 24 } }, {}])).toEqual({
      qty: null,
      issue: "conflict",
      requested: [0, 24],
    });
    // Pedido sem o número: nada é inventado.
    expect(innerFromDemands([{ innerRequirement: { qty: null } }])).toEqual({
      qty: null,
      issue: "missing",
      requested: [],
    });
  });

  it("o que o fornecedor vê", () => {
    expect(quoteInnerState(undefined)).toEqual({ kind: "none" });
    expect(quoteInnerState({ qty: 24, issue: null })).toEqual({
      kind: "required",
      qty: 24,
    });
    expect(
      quoteInnerState({ qty: null, issue: "conflict", requested: [12, 24] }),
    ).toEqual({ kind: "pending", issue: "conflict", requested: [12, 24] });
    // A Wellmix decidiu não exigir: nada de inner.
    expect(quoteInnerState({ qty: null, issue: null })).toEqual({
      kind: "none",
    });
  });

  it("Nova solicitação: Não por padrão; Sim exige o número no envio e não no rascunho", () => {
    expect(parseInnerRequirement("", "")).toBeNull();
    expect(parseInnerRequirement("no", "24")).toBeNull();
    expect(parseInnerRequirement("yes", "24")).toEqual({ qty: 24 });
    expect(parseInnerRequirement("yes", "1.200")).toEqual({ qty: 1200 });
    expect(() => parseInnerRequirement("yes", "")).toThrow(
      "inner_qty_required",
    );
    expect(() => parseInnerRequirement("yes", "2,5")).toThrow(
      "inner_qty_required",
    );
    expect(parseInnerRequirement("yes", "", true)).toEqual({ qty: null });
  });
});

describe("catálogo de materiais (puro)", () => {
  const catalog = MATERIAL_SEED.map((m) => ({
    id: materialSeedId(m.pt),
    namePt: m.pt,
    nameEn: m.en,
    nameZh: m.zh,
    nameKey: m.pt.toLowerCase(),
    active: true,
  }));
  it("a lista inicial tem ids fixos e nomes únicos nos três idiomas", () => {
    const ids = catalog.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(MATERIAL_VIDRO);
    expect(catalog.every((m) => m.namePt && m.nameEn && m.nameZh)).toBe(true);
  });
  it("a Composição do Sankhya vira os materiais do catálogo, com as grafias diferentes", () => {
    const hit = matchMaterials("Plástico / Papel", catalog);
    expect(hit.ids).toEqual(["mat-plastico", "mat-papel"]);
    expect(hit.unknown).toEqual([]);
    expect(
      matchMaterials(
        "plástico polipropileno e componentes eletronicos",
        catalog,
      ).ids,
    ).toEqual(["mat-polipropileno-pp", "mat-componentes-eletronicos"]);
    // O que não bate fica à vista para quem revisa, sem inventar.
    expect(matchMaterials("Vidro + unobtainium", catalog)).toEqual({
      ids: [MATERIAL_VIDRO],
      unknown: ["unobtainium"],
    });
    const byId = new Map(catalog.map((m) => [m.id, m]));
    expect(materialsText(["mat-plastico", "mat-papel"], byId, "zh-CN")).toBe(
      "塑料 / 纸",
    );
  });
});

describe("na cotação de compra", () => {
  let buyer: User;
  let director: User;
  let admin: User;
  let joao: User;
  let supplierA: User;
  let supplierC: User;
  const T0 = new Date("2026-11-21T09:00:00-03:00");
  const plus = (hours: number) => new Date(T0.getTime() + hours * 3_600_000);

  beforeAll(async () => {
    const { users } = await seedDemo();
    // A encomenda não vira cotação sozinha aqui (dono, 22/11/2026): estes
    // testes exercitam a Estratégia manual ou outro assunto.
    await (await import("@/lib/settings")).setSetting(
      "autoQuoteOrders",
      false,
    );
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
  });

  async function openQuote(
    inners: Array<{ qty: number | null } | null>,
  ): Promise<import("@/lib/db").PurchaseQuote> {
    const ids: string[] = [];
    for (const inner of inners) {
      const d = await requests.createRequest(joao, {
        customerId: "cliente-joao",
        productId: "prod-jarra",
        productName: "Jarra",
        description: "Encomenda",
        quantity: 1000,
        unit: "un",
        innerRequirement: inner,
      });
      ids.push(d.id);
    }
    await strategy.sendToStrategy(buyer, ids);
    const decision = await strategy.chooseStrategy(buyer, {
      demandIds: ids,
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

  const answer = (sheets = [sheetFor("prod-jarra")]) => ({
    decline: false,
    currency: "USD",
    incoterm: "FOB",
    leadTimeDays: 40,
    port: "Ningbo",
    moq: 500,
    note: null,
    prices: [{ productId: "prod-jarra", unitPrice: 2 }],
    sheets,
  });
  const responseOf = async (quoteId: string, user: User) =>
    (
      await getStore().list("purchase_quote_responses", {
        filter: { quoteId, supplierId: user.partyId! },
      })
    )[0];

  it("a encomenda grava o inner do cliente; a cotação mostra travado e a vencedora leva para a solicitação", async () => {
    const quote = await openQuote([{ qty: 12 }]);
    expect(quote.items[0].inner).toEqual({
      qty: 12,
      issue: null,
      requested: null,
    });
    const demand = await getStore().get("requests", quote.demandIds[0]);
    expect(demand?.innerRequirement).toEqual({ qty: 12 });
    await quotes.answerQuote(supplierA, quote.id, answer(), plus(1));
    const rA = await responseOf(quote.id, supplierA);
    // A resposta guarda a exigência que ele viu; a ficha do par, nenhum inner.
    expect(rA.items?.[0]).toMatchObject({ innerRequired: 12 });
    const pair = (
      await getStore().list("supplier_product_sheets", {
        filter: { productId: "prod-jarra", supplierId: supplierA.partyId! },
      })
    )[0];
    expect(pair.data.innerBoxQty).toBeNull();
    // Só vence quem tem a amostra aprovada (dono, 22/11/2026).
    await approveQuoteSample(quote.id, rA.id);
    await quotes.chooseWinner(buyer, quote.id, rA.id, null, plus(25));
    const approved = await quotes.decideWinner(director, quote.id, {
      approve: true,
      note: null,
    });
    const [sr] = await getStore().list("supplier_requests", {
      filter: { id: approved.supplierRequestIds! },
    });
    expect(sr.item.innerQty).toBe(12);
  });

  it("inner pedido sem a quantidade: a Wellmix define (pendência do Comprador) e o fornecedor passa a ver", async () => {
    // A tela não deixa (Sim exige o número); vale para dado antigo ou
    // importado. A Estratégia leva uma encomenda só, sem produto repetido:
    // o caso de exigências diferentes fica no teste puro.
    const quote = await openQuote([{ qty: null }]);
    expect(quoteInnerState(quote.items[0].inner)).toEqual({
      kind: "pending",
      issue: "missing",
      requested: [],
    });
    const tasks = await quotes.quoteTaskDrafts(buyer, plus(1));
    expect(
      tasks.some(
        (d) => d.kind === "purchase_quote_inner" && d.link.endsWith(quote.id),
      ),
    ).toBe(true);
    // O fornecedor responde sem travar (a Wellmix vai confirmar). A já tem a
    // ficha do par (do teste anterior): responde só o comercial.
    await quotes.answerQuote(supplierA, quote.id, answer([]), plus(1));
    expect((await responseOf(quote.id, supplierA)).items?.[0]).toMatchObject({
      innerRequired: null,
    });
    // Fornecedor não define o inner; número quebrado não vale.
    await expect(
      quotes.setQuoteItemInner(supplierA, quote.id, "prod-jarra", 24),
    ).rejects.toThrow();
    await expect(
      quotes.setQuoteItemInner(buyer, quote.id, "prod-jarra", 2.5),
    ).rejects.toThrow("quote_inner_invalid");
    const saved = await quotes.setQuoteItemInner(
      buyer,
      quote.id,
      "prod-jarra",
      24,
      plus(2),
    );
    expect(quoteInnerState(saved.items[0].inner)).toEqual({
      kind: "required",
      qty: 24,
    });
    expect(saved.items[0].inner?.setByUserId).toBe(buyer.id);
    const after = await quotes.quoteTaskDrafts(buyer, plus(2));
    expect(
      after.some(
        (d) => d.kind === "purchase_quote_inner" && d.link.endsWith(quote.id),
      ),
    ).toBe(false);
    // "Não exigir inner": o fornecedor não vê nada de inner.
    const none = await quotes.setQuoteItemInner(
      buyer,
      quote.id,
      "prod-jarra",
      null,
      plus(3),
    );
    expect(quoteInnerState(none.items[0].inner)).toEqual({ kind: "none" });
  });

  it("material só do catálogo: id inventado ou desativado é recusado no servidor", async () => {
    const quote = await openQuote([null]);
    // B nunca vendeu: a ficha é pedida a ele.
    const supplierB = (
      await getStore().list("users", {
        filter: { email: "supplier.b@china.com" },
      })
    )[0];
    await quotes.setSupplierLines(admin, supplierB.partyId!, [
      "linha-utilidades",
    ]);
    await quotes.inviteMore(buyer, quote.id, [supplierB.partyId!], plus(0));
    await getStore().update(
      "purchase_quote_responses",
      (await responseOf(quote.id, supplierB)).id,
      { invitedAt: T0.toISOString(), dueAt: plus(24).toISOString() },
    );
    await expect(
      quotes.answerQuote(
        supplierB,
        quote.id,
        answer([sheetFor("prod-jarra", { materialIds: ["inventado"] })]),
        plus(1),
      ),
    ).rejects.toThrow("material_not_in_catalog");
    await materials.setMaterialActive(admin, "mat-plastico", false);
    await expect(
      quotes.answerQuote(
        supplierB,
        quote.id,
        answer([sheetFor("prod-jarra", { materialIds: ["mat-plastico"] })]),
        plus(1),
      ),
    ).rejects.toThrow("material_not_in_catalog");
    await materials.setMaterialActive(admin, "mat-plastico", true);
    // "Sem peso" vale: grava nulo com a marca, nunca zero.
    await quotes.answerQuote(
      supplierB,
      quote.id,
      answer([
        sheetFor("prod-jarra", {
          materialIds: ["mat-plastico", MATERIAL_VIDRO],
          grossWeightBoxKg: 12.5,
          grossUnknown: true,
        }),
      ]),
      plus(1),
    );
    const pair = (
      await getStore().list("supplier_product_sheets", {
        filter: { productId: "prod-jarra", supplierId: supplierB.partyId! },
      })
    )[0];
    expect(pair.data).toMatchObject({
      grossWeightBoxKg: null,
      grossWeightUnknown: true,
      materialIds: ["mat-plastico", MATERIAL_VIDRO],
      material: "Plástico / Vidro",
    });
  });

  it("o catálogo: carga inicial uma vez, nome repetido recusado, só o Cadastro (ou o administrador) mantém", async () => {
    const first = await materials.listMaterials({ includeInactive: true });
    expect(first.length).toBe(MATERIAL_SEED.length);
    // Ler de novo não carrega outra vez.
    expect((await materials.listMaterials()).length).toBe(MATERIAL_SEED.length);
    await expect(
      materials.createMaterial(admin, {
        namePt: "vidro",
        nameEn: "Glass",
        nameZh: "玻璃",
      }),
    ).rejects.toThrow("material_duplicate");
    await expect(
      materials.createMaterial(admin, {
        namePt: "Granito",
        nameEn: "",
        nameZh: "花岗岩",
      }),
    ).rejects.toThrow("material_names_required");
    await expect(
      materials.createMaterial(supplierA, {
        namePt: "Granito",
        nameEn: "Granite",
        nameZh: "花岗岩",
      }),
    ).rejects.toThrow();
    const granite = await materials.createMaterial(admin, {
      namePt: "Granito",
      nameEn: "Granite",
      nameZh: "花岗岩",
    });
    expect(granite.active).toBe(true);
    const renamed = await materials.updateMaterial(admin, granite.id, {
      namePt: "Granito polido",
      nameEn: "Polished granite",
      nameZh: "抛光花岗岩",
    });
    expect(renamed.nameKey).toBe("granito polido");
    await materials.setMaterialActive(admin, granite.id, false);
    expect(
      (await materials.listMaterials()).some((m) => m.id === granite.id),
    ).toBe(false);
    // Desativado continua no catálogo (as fichas antigas leem o nome).
    expect((await materials.materialCatalog()).get(granite.id)?.namePt).toBe(
      "Granito polido",
    );
  });
});
