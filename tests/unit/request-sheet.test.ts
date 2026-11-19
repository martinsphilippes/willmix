import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Ficha completa da solicitação (dono, 15/11/2026; docs/REQUEST_SHEET.md):
 * uma linha por produto; cada dado com a origem (solicitação, programação,
 * negociação, Book, ficha atual, calculado); "Não informado" sem dado; e as
 * permissões no servidor (custo, compra e condições do fornecedor só para
 * quem vê valores; o cliente só o que a solicitação dele gravou e a venda).
 */
withTempStore();
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { PRODUCT_EXTRA_DEFAULTS, REQUEST_EXTRA_DEFAULTS } =
  await import("@/lib/db/schema");
const rs = await import("@/lib/services/request-sheet");
const { orderFromRequest } = await import("./helpers/order");
const { parseRequestSpec, normLabel } =
  await import("@/lib/request-spec-parse");
const { translator } = await import("@/i18n");
type User = import("@/lib/db").User;
type Request = import("@/lib/db").Request;
type SheetRow = import("@/lib/services/request-sheet").SheetRow;
type SheetField = import("@/lib/services/request-sheet").SheetField;

const t = translator("pt");
const CUSTOMER = "cliente-joao";
let admin: User;
let operator: User;
let sales: User;
let joao: User;

/** Texto gravado na Solicitação nº 1 de produção (bastão lança-bolhas). */
const BASTAO_SPEC =
  "Bastão Lança Bolhas Sereia Estela Sortimento de Cor 14,5cm\r\n\r\nComposição: Plástico polipropileno / PET (Polietileno tereftalato)\r\nFaixa etária: 3 anos\r\nCores: Azul / Rosa / Roxo\r\n3 Sortimentos de cores\r\nContém: 1 Peça\r\n\r\nDimensões (A x L x P)\r\nLança Bolhas: 14,5cm x 3,5cm x 2,5cm\r\n\r\nPaís de origem: China";

async function product(over: Record<string, unknown> = {}) {
  return getStore().create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId: "linha-brinquedos",
    name: "BASTAO LANCA BOLHAS SEREIA ESTELA SRT COR 14,5CM",
    sku: "WB12112",
    specification: null,
    active: true,
    supplierId: "fornecedor-b",
    price: 0.0809,
    currency: "USD",
    masterBoxQty: 192,
    innerBoxQty: 24,
    netWeightKg: 0.0112,
    grossWeightKg: 0.0536,
    lengthCm: 13,
    widthCm: 19,
    heightCm: 15,
    ncm: "95030099",
    brand: "WELLKIDS",
    sankhyaCode: "12112",
    ean: "7899527199518",
    ...over,
  } as never);
}

async function request(productId: string | null, over: Partial<Request> = {}) {
  return getStore().create("requests", {
    ...REQUEST_EXTRA_DEFAULTS,
    customerId: CUSTOMER,
    createdByUserId: admin.id,
    productId,
    productName: "BASTAO LANCA BOLHAS SEREIA ESTELA SRT COR 14,5CM",
    description: "BASTAO LANCA BOLHAS SEREIA ESTELA SRT COR 14,5CM",
    specification: BASTAO_SPEC,
    quantity: 2000,
    unit: "un",
    deadline: "2026-11-20T00:00:00.000Z",
    status: "REQUESTED",
    orderId: null,
    sellPrice: null,
    sellCurrency: null,
    downPaymentAmount: null,
    notes: null,
    requestedForUserId: joao.id,
    schedule: {
      firstDate: "2026-12-28",
      intervalDays: 45,
      items: [
        { index: 1, quantity: 1000, expectedAt: "2026-12-28" },
        { index: 2, quantity: 1000, expectedAt: "2027-02-11" },
      ],
    },
    ...over,
  } as never);
}

const sheetOf = async (user: User, r: Request, siblings: Request[] = []) =>
  rs.loadRequestSheet(user, r, siblings, t);

/** Campo do grupo pela chave (procura em todas as seções). */
function fieldOf(row: SheetRow, group: string, key: string): SheetField {
  const g = row.groups.find((x) => x.key === group);
  const f = g?.sections.flatMap((s) => s.fields).find((x) => x.key === key);
  if (!f) throw new Error(`sem o campo ${group}.${key}`);
  return f;
}
const shown = (f: SheetField) => ({
  value: f.value,
  source: f.source?.label ?? null,
});

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  sales = users.find((u) => u.email === "vendas@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

describe("especificação gravada", () => {
  it("bastão: linhas, eixos do cabeçalho e unidade", () => {
    const spec = parseRequestSpec(BASTAO_SPEC);
    expect(spec.measures).toEqual([
      {
        label: "Lança Bolhas",
        values: [
          { axis: "height", value: 14.5, unit: "cm" },
          { axis: "width", value: 3.5, unit: "cm" },
          { axis: "depth", value: 2.5, unit: "cm" },
        ],
      },
    ]);
    expect(spec.lines).toEqual([
      {
        label: null,
        value: "Bastão Lança Bolhas Sereia Estela Sortimento de Cor 14,5cm",
      },
      {
        label: "Composição",
        value: "Plástico polipropileno / PET (Polietileno tereftalato)",
      },
      { label: "Faixa etária", value: "3 anos" },
      { label: "Cores", value: "Azul / Rosa / Roxo" },
      { label: null, value: "3 Sortimentos de cores" },
      { label: "Contém", value: "1 Peça" },
      { label: "País de origem", value: "China" },
    ]);
  });

  it("o texto da Nova solicitação (C × L × A do cadastro), pesos e caixa", () => {
    const order = [normLabel(t("catalog.dimensions"))];
    const zoey = parseRequestSpec(
      "Dimensões do produto (cm): 20 × 11 × 35.1\r\nPeso líquido (kg): 0.3728\r\nUnidades por caixa master: 6",
      order,
    );
    expect(zoey.measures[0]).toEqual({
      label: "Dimensões do produto",
      values: [
        { axis: "length", value: 20, unit: "cm" },
        { axis: "width", value: 11, unit: "cm" },
        { axis: "height", value: 35.1, unit: "cm" },
      ],
    });
    expect(zoey.netWeight).toEqual({ value: 0.3728, unit: "kg" });
    expect(zoey.perBox).toBe(6);
    const portal = parseRequestSpec(
      "Medidas do produto: 13 × 19 × 15 cm (C × L × A)\nPeso por unidade: 0,011 kg líquido · 0,054 kg bruto\nCaixa master: 48 peças · 4 por caixa interna · 52 × 34 × 68 cm · 0,1202 m³\nDimensões: 5cm x 5cm x 5cm\nDiâmetro: 10 cm",
    );
    expect(portal.measures.map((m) => m.values.map((v) => v.axis))).toEqual([
      ["length", "width", "height"],
      [null, null, null],
      ["diameter"],
    ]);
    expect(portal.grossWeight).toEqual({ value: 0.054, unit: "kg" });
    expect([portal.perBox, portal.innerQty, portal.cbmPerBox]).toEqual([
      48, 4, 0.1202,
    ]);
    expect(portal.boxDims?.values.map((v) => [v.axis, v.value])).toEqual([
      ["length", 52],
      ["width", 34],
      ["height", 68],
    ]);
    expect(portal.lines).toEqual([]);
  });
});

describe("Solicitação nº 1: bastão lança-bolhas, sem preço negociado", () => {
  let row: SheetRow;
  let r: Request;
  beforeAll(async () => {
    const p = await product();
    r = await request(p.id);
    const view = await sheetOf(admin, r);
    expect(view.rows).toHaveLength(1);
    row = view.rows[0];
  });

  it("linha principal: peças da programação, caixas e custo", () => {
    expect(row.current).toBe(true);
    expect(row.code).toBe("WB12112");
    expect(shown(row.main.pieces)).toEqual({
      value: "2.000 peças",
      source: "Programação",
    });
    expect(row.main.pieces.note).toBe("2 programações: 1.000 + 1.000");
    // 1.000 ÷ 192 = 5,21 → 6 caixas em cada programação.
    expect(shown(row.main.boxes!)).toEqual({
      value: "12 caixas",
      source: "Calculado",
    });
    expect(row.main.boxes!.note).toContain("6 + 6");
    expect(shown(row.main.cbm!)).toEqual({ value: null, source: null });
    expect(shown(row.main.cost!)).toMatchObject({ source: "Ficha atual" });
    expect(row.main.cost!.value).toMatch(/US\$\s?0,0809/);
    expect(shown(row.main.purchase!)).toEqual({ value: null, source: null });
    expect(shown(row.main.sale!)).toEqual({ value: null, source: null });
    expect(row.warnings).toEqual([]);
  });

  it("Produto: a solicitação primeiro; o que falta, da ficha atual", () => {
    expect(shown(fieldOf(row, "product", "sku"))).toEqual({
      value: "WB12112",
      source: "Ficha atual",
    });
    expect(shown(fieldOf(row, "product", "erp")).value).toBe("12112");
    expect(shown(fieldOf(row, "product", "ean")).value).toBe("7899527199518");
    expect(shown(fieldOf(row, "product", "ncm"))).toEqual({
      value: "95030099",
      source: "Ficha atual",
    });
    expect(shown(fieldOf(row, "product", "brand")).value).toBe("WELLKIDS");
    const spec = row.groups[0].sections.find((s) => s.key === "spec")!;
    expect(spec.fields.map((f) => [f.label, f.value, f.source?.label])).toEqual(
      [
        [
          "Especificação",
          "Bastão Lança Bolhas Sereia Estela Sortimento de Cor 14,5cm\n3 Sortimentos de cores",
          "Solicitação",
        ],
        [
          "Composição",
          "Plástico polipropileno / PET (Polietileno tereftalato)",
          "Solicitação",
        ],
        ["Faixa etária", "3 anos", "Solicitação"],
        ["Cores", "Azul / Rosa / Roxo", "Solicitação"],
        ["Contém", "1 Peça", "Solicitação"],
        ["País de origem", "China", "Solicitação"],
      ],
    );
    // Medida da peça com os eixos (a ficha atual não substitui a gravada).
    expect(shown(fieldOf(row, "product", "measure.0"))).toEqual({
      value: "Altura 14,5 cm · Largura 3,5 cm · Profundidade 2,5 cm",
      source: "Solicitação",
    });
    expect(shown(fieldOf(row, "product", "netWeight"))).toEqual({
      value: "0,0112 kg",
      source: "Ficha atual",
    });
    expect(shown(fieldOf(row, "product", "grossWeight"))).toEqual({
      value: "0,0536 kg",
      source: "Ficha atual",
    });
    // Exigência da linha (Brinquedos: Inmetro).
    expect(shown(fieldOf(row, "product", "certifications"))).toEqual({
      value: "Inmetro",
      source: "Linha do produto",
    });
  });

  it("Embalagem e cubagem: gravado x calculado, e o que não há", () => {
    expect(shown(fieldOf(row, "packing", "innerQty"))).toEqual({
      value: "24",
      source: "Ficha atual",
    });
    expect(shown(fieldOf(row, "packing", "perBox"))).toEqual({
      value: "192",
      source: "Ficha atual",
    });
    expect(shown(fieldOf(row, "packing", "boxDims"))).toEqual({
      value: null,
      source: null,
    });
    expect(shown(fieldOf(row, "packing", "cbmPerBox")).value).toBeNull();
    expect(shown(fieldOf(row, "packing", "cbmTotal")).value).toBeNull();
  });

  it("CBM de uma caixa com outra quantidade de peças fica de fora, com o aviso", async () => {
    // Dono, 19/11/2026 (a mesma proteção da Estratégia de compra): a
    // variação pedida tem 24 por caixa e nenhum CBM; o cadastro tem o CBM
    // da caixa de 60. Multiplicar as caixas de 24 pelo m³ da caixa de 60
    // daria uma cubagem errada: o CBM fica de fora.
    const p = await product({ masterBoxQty: 60, cbm: 0.08 });
    const r = await request(p.id, {
      variant: { name: "Caixa pequena", masterBoxQty: 24 } as never,
    });
    const [other] = (await sheetOf(admin, r)).rows;
    expect(shown(fieldOf(other, "packing", "perBox"))).toEqual({
      value: "24",
      source: "Variação da solicitação",
    });
    expect(shown(fieldOf(other, "packing", "boxes")).value).toBe("84 caixas");
    const cbm = fieldOf(other, "packing", "cbmPerBox");
    expect(cbm.value).toBeNull();
    expect(cbm.note).toBe(
      "O CBM de Ficha atual é de uma caixa de 60 peças, e a conta usa caixas de 24: fica de fora",
    );
    expect(fieldOf(other, "packing", "cbmTotal").value).toBeNull();
  });

  it("Valores e Pagamento: custo da ficha atual; sem compra, venda e condições", () => {
    expect(shown(fieldOf(row, "values", "quote")).value).toBeNull();
    expect(shown(fieldOf(row, "values", "negotiated")).value).toBeNull();
    expect(shown(fieldOf(row, "values", "purchaseTotal")).value).toBeNull();
    expect(shown(fieldOf(row, "values", "costTotal"))).toMatchObject({
      source: "Calculado",
    });
    expect(fieldOf(row, "values", "costTotal").value).toMatch(/161,80/);
    expect(shown(fieldOf(row, "values", "saleTotal")).value).toBeNull();
    expect(shown(fieldOf(row, "payment", "supplier"))).toEqual({
      value: "Guangzhou Supplier B",
      source: "Ficha atual",
    });
    for (const key of [
      "terms",
      "method",
      "deposit",
      "saleDeposit",
      "saleTerms",
    ])
      expect(fieldOf(row, "payment", key).value).toBeNull();
  });

  it("Comprador (Ver preço de compra, sem Ver valores e margem): compra e custo registrado sim; venda não", async () => {
    // Dono, 15/11/2026 (docs/LINHA_DE_VISAO.md): o preço de compra é de quem
    // compra; venda e margem continuam com "Ver valores e margem".
    const [op] = (await sheetOf(operator, r)).rows;
    expect(op.code).toBe("WB12112");
    expect(op.main.boxes?.value).toBe("12 caixas");
    expect(op.main.cost?.value).toContain("0,0809");
    expect(op.main.purchase).not.toBeNull();
    expect(op.main.sale).toBeNull();
    const values = op.groups.find((g) => g.key === "values")!;
    const payment = op.groups.find((g) => g.key === "payment")!;
    expect(values.sections.map((x) => x.key)).toEqual(["purchase", "cost"]);
    expect(payment.sections.map((x) => x.key)).toEqual(["supplierPay"]);
  });

  it("login sem Ver preço de compra (Vendas): ficha técnica sim; valores e pagamento fechados", async () => {
    const [op] = (await sheetOf(sales, r)).rows;
    expect(op.code).toBe("WB12112");
    expect(op.main.boxes?.value).toBe("12 caixas");
    expect([op.main.cost, op.main.purchase, op.main.sale]).toEqual([
      null,
      null,
      null,
    ]);
    const values = op.groups.find((g) => g.key === "values")!;
    const payment = op.groups.find((g) => g.key === "payment")!;
    expect(values.sections).toEqual([]);
    expect(values.restricted).toContain("Ver preço de compra");
    expect(payment.sections).toEqual([]);
    // O custo e o fornecedor não saem do servidor.
    const json = JSON.stringify(op);
    expect(json).not.toContain("0,0809");
    expect(json).not.toContain("Guangzhou");
  });

  it("cliente: só o que a solicitação gravou, a programação e a venda", async () => {
    const [mine] = (await sheetOf(joao, r)).rows;
    expect(mine.code).toBeNull();
    expect(mine.main.boxes).toBeNull();
    expect(mine.main.cost).toBeNull();
    expect(mine.main.purchase).toBeNull();
    expect(mine.main.pieces.value).toBe("2.000 peças");
    expect(shown(fieldOf(mine, "product", "measure.0")).value).toBe(
      "Altura 14,5 cm · Largura 3,5 cm · Profundidade 2,5 cm",
    );
    expect(
      mine.groups.find((g) => g.key === "values")!.sections.map((s) => s.key),
    ).toEqual(["sale"]);
    expect(
      mine.groups.find((g) => g.key === "payment")!.sections.map((s) => s.key),
    ).toEqual(["customerPay"]);
    // Sem o id da solicitação: um UUID aleatório pode conter "192".
    const json = JSON.stringify({ ...mine, requestId: "" });
    for (const secret of [
      "WB12112",
      "0,0809",
      "Guangzhou",
      "Ficha atual",
      "192",
    ])
      expect(json).not.toContain(secret);
  });
});

describe("com negociação, Book, venda e condição do fornecedor", () => {
  it("cotação e negociado com a origem; totais calculados; sinal da condição", async () => {
    const p = await product({ supplierId: "fornecedor-a", sku: "WB-NEG" });
    const store = getStore();
    const lot = await store.create("booking_lots", {
      number: 77,
      status: "open",
      supplierId: "fornecedor-a",
      supplierHint: null,
      origin: null,
      bookingDate: null,
      sheetDate: null,
      fileName: "book.xlsx",
      fileDocumentId: null,
      sheetName: null,
      extraHeaders: null,
      itemCount: 1,
      businessType: null,
      closedAt: null,
      closedByUserId: null,
      analyzedAt: null,
      statusChangedAt: null,
      statusChangedByUserId: null,
      note: null,
      ownerUserId: null,
      createdByUserId: admin.id,
    } as never);
    const book = await store.create("booking_items", {
      lotId: lot.id,
      position: 1,
      productId: p.id,
      price: 0.08,
      currency: "USD",
      incoterm: "FOB",
      masterCartonQty: 200,
      cbmPerCarton: 0.05,
      // SIZE LENGTH/WIDTH/HEIGHT do Book: medidas da PEÇA (dono, 15/11/2026).
      lengthCm: 20,
      widthCm: 10,
      heightCm: 5,
      analysis: {
        at: "2026-11-15T00:00:00.000Z",
        byUserId: admin.id,
        businessType: "importacao",
        salePriceBrl: 1.2,
        usesMinimum: false,
        costBrl: 0.62,
        minimumBrl: null,
        profitPct: 35.5,
        targetPct: 30,
        verdict: "viable",
        targetPriceBrl: null,
        missing: [],
      },
    } as never);
    const neg = await store.create("supplier_requests", {
      number: 31,
      status: "approved",
      supplierId: "fornecedor-a",
      bookingItemId: book.id,
      bookingLotId: lot.id,
      alternativeItemIds: null,
      item: { price: 0.08, currency: "USD" },
      quantity: 2000,
      unit: "un",
      needs: null,
      searchQuery: null,
      supplierCanDo: "yes",
      supplierPrice: 0.075,
      supplierCurrency: "USD",
      supplierMoq: 2000,
      supplierLeadTimeDays: 45,
      supplierIncoterm: "FOB",
      supplierNote: null,
      respondedAt: null,
      respondedByUserId: null,
      decidedAt: null,
      decidedByUserId: null,
      decisionNote: null,
      createdByUserId: admin.id,
      productId: p.id,
    } as never);
    const r = await request(p.id, {
      sellPrice: 1000,
      sellCurrency: "BRL",
      downPaymentAmount: 300,
    });
    const [row] = (await sheetOf(admin, r)).rows;
    expect(shown(row.main.purchase!)).toMatchObject({
      source: `Negociação nº ${neg.number}`,
    });
    expect(row.main.purchase!.source?.href).toBe(
      `/app/supplier-requests/${neg.id}`,
    );
    expect(fieldOf(row, "values", "negotiated").value).toMatch(/0,075/);
    expect(fieldOf(row, "values", "negotiated").note).toBe(
      "Negociação aprovada",
    );
    expect(shown(fieldOf(row, "values", "quote"))).toMatchObject({
      source: "Book nº 77",
    });
    expect(fieldOf(row, "values", "quote").value).toMatch(/0,08/);
    // 2.000 peças × US$ 0,075 = US$ 150,00 (calculado).
    expect(shown(fieldOf(row, "values", "purchaseTotal")).source).toBe(
      "Calculado",
    );
    expect(fieldOf(row, "values", "purchaseTotal").value).toMatch(/150,00/);
    expect(fieldOf(row, "values", "incoterm").value).toBe("FOB");
    expect(shown(fieldOf(row, "values", "margin"))).toEqual({
      value: "35,5%",
      source: "Superplan (Book nº 77)",
    });
    // Venda gravada na solicitação (total) e o unitário calculado.
    expect(shown(fieldOf(row, "values", "saleTotal")).source).toBe(
      "Solicitação",
    );
    expect(fieldOf(row, "values", "saleTotal").value).toMatch(/1\.000,00/);
    expect(shown(fieldOf(row, "values", "saleUnit")).source).toBe("Calculado");
    expect(fieldOf(row, "values", "saleUnit").value).toMatch(/0,50/);
    // Caixa e CBM: o Book vem antes da ficha atual (200 por caixa, 0,05 m³;
    // a negociação deste exemplo não gravou a caixa).
    expect(shown(fieldOf(row, "packing", "perBox"))).toEqual({
      value: "200",
      source: "Book nº 77",
    });
    expect(shown(fieldOf(row, "packing", "boxes")).value).toBe("10 caixas");
    expect(shown(fieldOf(row, "packing", "cbmTotal"))).toEqual({
      value: "0,5 m³",
      source: "Calculado",
    });
    // Pagamento: condição do cadastro do fornecedor, sinal e prazo.
    expect(shown(fieldOf(row, "payment", "terms"))).toEqual({
      value: "30% na data do pedido + 70% 90 dias após a entrega ao cliente",
      source: "Cadastro do fornecedor",
    });
    expect(fieldOf(row, "payment", "deposit").value).toBe(
      "30% na data do pedido",
    );
    expect(fieldOf(row, "payment", "deposit").note).toMatch(/45,00/);
    expect(fieldOf(row, "payment", "installments").value).toBe("2 parcela(s)");
    expect(fieldOf(row, "payment", "leadTime").value).toBe("45 dias");
    expect(fieldOf(row, "payment", "saleDeposit").value).toMatch(/300,00/);
    expect(fieldOf(row, "payment", "saleTerms").value).toBeNull();
    // As medidas do Book são da peça: não viram caixa master nem CBM.
    expect(shown(fieldOf(row, "packing", "boxDims")).value).toBeNull();
    expect(shown(fieldOf(row, "packing", "cbmPerBox"))).toEqual({
      value: "0,05 m³",
      source: "Book nº 77",
    });
    const plain = await request(p.id, { specification: null });
    const [noSpec] = (await sheetOf(admin, plain)).rows;
    expect(shown(fieldOf(noSpec, "product", "pieceDims"))).toEqual({
      value: "Comprimento 20 cm · Largura 10 cm · Altura 5 cm",
      source: "Book nº 77",
    });
    // O cliente vê a venda e o sinal dele, nunca a compra nem o fornecedor.
    const [mine] = (await sheetOf(joao, r)).rows;
    expect(fieldOf(mine, "values", "saleTotal").value).toMatch(/1\.000,00/);
    expect(JSON.stringify(mine)).not.toMatch(
      /0,075|0,08\b|Shenzhen|Negociação/,
    );
  });
});

describe("solicitação com vários produtos", () => {
  it("uma linha por produto na ordem do lote; a atual marcada", async () => {
    const a = await product({ sku: "WB-A", name: "Boneca Liuly" });
    const b = await product({ sku: "WB-B", name: "Cubo interativo" });
    const first = await request(a.id, {
      groupId: "lote-1",
      productName: "BONECA LIULY SRT COR",
      specification: "Dimensões (A x L x P)\nBoneca: 26,5cm x 6cm x 3cm",
    });
    // Criadas uma depois da outra, como no lote da Nova solicitação.
    await new Promise((done) => setTimeout(done, 5));
    const second = await request(b.id, {
      groupId: "lote-1",
      productName: "CUBO INTERATIVO 3X3X3 COLOR CUBE 5CM",
      specification: "Dimensões: 5cm x 5cm x 5cm",
      quantity: 2400,
    });
    const view = await sheetOf(admin, second, [first]);
    expect(view.rows.map((x) => [x.name, x.current])).toEqual([
      ["BONECA LIULY SRT COR", false],
      ["CUBO INTERATIVO 3X3X3 COLOR CUBE 5CM", true],
    ]);
    // Eixos do cabeçalho na boneca; o cubo não diz os eixos.
    expect(fieldOf(view.rows[0], "product", "measure.0").value).toBe(
      "Altura 26,5 cm · Largura 6 cm · Profundidade 3 cm",
    );
    const cube = fieldOf(view.rows[1], "product", "measure.0");
    expect(cube.value).toBe("5 × 5 × 5 cm");
    expect(cube.note).toBe("A especificação não diz os eixos.");
    // Quantidade gravada (2.400) diferente da programação (2.000): aviso.
    expect(view.rows[1].main.pieces.value).toBe("2.000 peças");
    expect(view.rows[1].warnings[0]).toContain("2.400");
  });
});

describe("forma de pagamento do cliente no pedido (docs/CUSTOMER_PAYMENT.md)", () => {
  it("aprovada: forma, parcelas com valor, sinal e prazo; em aprovação o cliente não vê", async () => {
    const store = getStore();
    const p = await product({ sku: "WB-PAY" });
    const r = await request(p.id);
    const order = await orderFromRequest(admin, r, {
      sellPrice: 10000,
      sellCurrency: "BRL",
    });
    const plan = {
      planId: "forma-10-90",
      name: "10% no pedido; 90% no embarque",
      installments: [
        { percent: 10, event: "order", days: 0 },
        { percent: 90, event: "shipment", days: 0 },
      ],
      monthlyInterestPercent: null,
      requiresApproval: false,
      approverUserId: null,
      status: "approved",
      chosenByUserId: admin.id,
      chosenAt: "2026-11-15T12:00:00.000Z",
      decidedByUserId: null,
      decidedAt: null,
      decisionNote: null,
      saleNunota: null,
    };
    await store.update("orders", order.id, {
      customerPaymentPlan: plan,
      paymentPlanStatus: "approved",
    } as never);
    const fresh = (await store.get("requests", r.id))!;
    const spaces = (v: string | null) => v?.replace(/\s/g, " ") ?? null;

    // Administrador: a forma do pedido, com a origem e a situação.
    const [row] = (await sheetOf(admin, fresh)).rows;
    expect(shown(fieldOf(row, "payment", "saleTerms"))).toEqual({
      value: "10% no pedido; 90% no embarque",
      source: `Pedido nº ${order.number}`,
    });
    expect(fieldOf(row, "payment", "saleTerms").note).toBe("Aprovada");
    expect(spaces(fieldOf(row, "payment", "saleInstallments").value)).toBe(
      "10% no pedido (R$ 1.000,00) 90% no embarque (R$ 9.000,00)",
    );
    expect(fieldOf(row, "payment", "saleDeposit").value).toBe(
      "10% na data do pedido",
    );
    expect(fieldOf(row, "payment", "saleTerm").value).toBe("No embarque");

    // O cliente do pedido vê a forma aprovada.
    const [mine] = (await sheetOf(joao, fresh)).rows;
    expect(fieldOf(mine, "payment", "saleTerms").value).toBe(
      "10% no pedido; 90% no embarque",
    );

    // Em aprovação: o cliente ainda não vê; a Wellmix vê com a situação.
    await store.update("orders", order.id, {
      customerPaymentPlan: { ...plan, status: "pending" },
      paymentPlanStatus: "pending",
    } as never);
    const [pending] = (await sheetOf(joao, fresh)).rows;
    expect(fieldOf(pending, "payment", "saleTerms").value).toBeNull();
    expect(fieldOf(pending, "payment", "saleInstallments").value).toBeNull();
    const [wellmix] = (await sheetOf(admin, fresh)).rows;
    expect(fieldOf(wellmix, "payment", "saleTerms").note).toBe("Em aprovação");

    // Comprador sem "Ver valores e margem": só o pagamento ao fornecedor;
    // a forma do cliente continua fechada.
    const [op] = (await sheetOf(operator, fresh)).rows;
    expect(
      op.groups.find((g) => g.key === "payment")!.sections.map((x) => x.key),
    ).toEqual(["supplierPay"]);
    // Sem "Ver preço de compra" (Vendas): o pagamento todo fechado.
    const [noPrice] = (await sheetOf(sales, fresh)).rows;
    expect(noPrice.groups.find((g) => g.key === "payment")!.sections).toEqual(
      [],
    );
  });
});
