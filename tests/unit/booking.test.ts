import { describe, expect, it } from "vitest";
import {
  BOOKING_COLUMNS,
  BOOKING_EMPTY,
  BOOKING_FLOW,
  activeBookingFilters,
  bookingColumnsFor,
  BOOKING_OPEN_REQUEST,
  bookingLinkState,
  bookingMoveError,
  bookingMoveOptions,
  bookingQuery,
  bookingSignal,
  bookingStatusRequirementError,
  filterBookingRows,
  hidesFromShowcase,
  pageOfBookingRows,
  parseBookingFilters,
  reservedQtyError,
  sortBookingRows,
  type BookingRow,
} from "@/lib/booking";
import { BOOKING_STATUSES, type BookingAnalysis } from "@/lib/db/schema";

/*
 * Booking (docs/BOOKING.md), regras puras: as etapas e quem pode mover; o
 * que cada etapa exige; quando o produto aparece na vitrine; e os filtros da
 * tela (toda coluna filtra, e o filtro mora no endereço da página).
 */

const ADMIN = { canApprove: true };
const BUYER = { canApprove: false };

const analysis = (patch: Partial<BookingAnalysis> = {}): BookingAnalysis => ({
  at: "2026-11-09T12:00:00.000Z",
  byUserId: "admin",
  businessType: "WELLMIX - UD - CHINA - MERCADO",
  salePriceBrl: 55.21,
  usesMinimum: true,
  costBrl: 30.67,
  minimumBrl: 55.21,
  profitPct: 16,
  targetPct: 22,
  verdict: "below",
  targetPriceBrl: 62.89,
  missing: [],
  ...patch,
});

const row = (patch: Partial<BookingRow> = {}): BookingRow => ({
  id: "b1",
  productId: "p1",
  status: "new",
  statusChangedAt: null,
  photoDocumentId: null,
  code: "1",
  sku: "UTL-010",
  name: "Porta-retrato STONE MARBLE A4",
  productMissing: false,
  supplierId: "fornecedor-a",
  supplierName: "MIN YAN",
  supplierStore: "E4-9558",
  location: "YIWU",
  sheetDate: "2026-10-13T00:00:00.000Z",
  incoterm: "EXW",
  price: 4,
  currency: "USD",
  moq: 2400,
  masterQty: 12,
  innerQty: 12,
  netWeightKg: 0.225,
  grossWeightKg: null,
  estimatedWeightKg: 0.243,
  weightEstimated: true,
  averageUsd: null,
  averageWeightKg: null,
  plannedQty: null,
  forecastOrder: null,
  forecastDistribution: null,
  forecastEcommerce: null,
  forecastTotal: null,
  cbm: 0.0183,
  size: "33,5 × 24,8 × 1,5 cm",
  colors: "White / Gray / bege",
  material: "PS+PVC",
  packageType: "Shrink + OPP + sticker",
  ncm: null,
  customerId: null,
  customerName: null,
  reservedQty: null,
  analysis: null,
  ownerUserId: null,
  ownerName: null,
  enteredAt: "2026-11-09T15:00:00.000Z",
  importBatchId: "lote-1",
  sourceFileName: "porta-retrato.xls",
  sourceRows: "3-5",
  sourceOrder: 3,
  note: null,
  requestId: null,
  requestGroupId: null,
  requestNumber: null,
  requestState: null,
  pieceLengthCm: null,
  pieceWidthCm: null,
  pieceHeightCm: null,
  ...patch,
});

describe("etapas do Booking", () => {
  it("a fila tem as seis etapas na ordem e o Descartado fica fora dela", () => {
    expect([...BOOKING_FLOW]).toEqual([
      "new",
      "analysis",
      "approved",
      "offered",
      "reserved",
      "requested",
    ]);
    expect([...BOOKING_STATUSES].sort()).toEqual(
      [...BOOKING_FLOW, "discarded"].sort(),
    );
  });

  it("o produto só aparece na vitrine depois de aprovado", () => {
    expect(BOOKING_STATUSES.filter(hidesFromShowcase)).toEqual([
      "new",
      "analysis",
      "discarded",
    ]);
  });

  it("'Virou solicitação' nunca é marcada à mão, nem pelo administrador", () => {
    for (const from of BOOKING_STATUSES)
      for (const actor of [ADMIN, BUYER])
        if (from !== "requested")
          expect(bookingMoveError(from, "requested", actor)).toBe(
            "booking_request_only",
          );
  });

  it("pôr na vitrine ou tirar dela é de quem analisa; o resto, de quem tem a tela", () => {
    // Comprador: Novo ↔ Em análise, descartar e recuperar antes de aprovar.
    expect(bookingMoveError("new", "analysis", BUYER)).toBeNull();
    expect(bookingMoveError("analysis", "new", BUYER)).toBeNull();
    expect(bookingMoveError("analysis", "discarded", BUYER)).toBeNull();
    expect(bookingMoveError("discarded", "new", BUYER)).toBeNull();
    // Aprovar, tirar da vitrine e descartar um aprovado: só quem analisa.
    for (const [from, to] of [
      ["new", "approved"],
      ["analysis", "approved"],
      ["analysis", "reserved"],
      ["discarded", "offered"],
      ["approved", "analysis"],
      ["offered", "new"],
      ["reserved", "discarded"],
    ] as const) {
      expect(bookingMoveError(from, to, BUYER), `${from}→${to}`).toBe(
        "booking_approver_required",
      );
      expect(bookingMoveError(from, to, ADMIN), `${from}→${to}`).toBeNull();
    }
    // Depois de aprovado: oferecer e reservar é do dia a dia.
    expect(bookingMoveError("approved", "offered", BUYER)).toBeNull();
    expect(bookingMoveError("offered", "reserved", BUYER)).toBeNull();
    expect(bookingMoveError("reserved", "approved", BUYER)).toBeNull();
    // Reabrir o que já virou solicitação: só quem analisa.
    expect(bookingMoveError("requested", "approved", BUYER)).toBe(
      "booking_reopen_forbidden",
    );
    expect(bookingMoveError("requested", "approved", ADMIN)).toBeNull();
    // A mesma etapa não é mudança.
    expect(bookingMoveError("new", "new", BUYER)).toBeNull();
  });

  it("o seletor mostra só as etapas que a pessoa pode escolher", () => {
    expect(bookingMoveOptions("new", BUYER)).toEqual([
      "new",
      "analysis",
      "discarded",
    ]);
    expect(bookingMoveOptions("approved", BUYER)).toEqual([
      "approved",
      "offered",
      "reserved",
    ]);
    expect(bookingMoveOptions("new", ADMIN)).toEqual([
      "new",
      "analysis",
      "approved",
      "offered",
      "reserved",
      "discarded",
    ]);
    expect(bookingMoveOptions("requested", BUYER)).toEqual(["requested"]);
  });

  it("'Oferecido' pede o cliente; 'Reservado', cliente e quantidade a partir do mínimo", () => {
    const base = { customerId: null, reservedQty: null, moq: 2400 };
    expect(bookingStatusRequirementError("approved", base)).toBeNull();
    expect(bookingStatusRequirementError("offered", base)).toBe(
      "booking_customer_required",
    );
    expect(
      bookingStatusRequirementError("offered", { ...base, customerId: "c1" }),
    ).toBeNull();
    expect(
      bookingStatusRequirementError("reserved", { ...base, customerId: "c1" }),
    ).toBe("booking_qty_required");
    expect(
      bookingStatusRequirementError("reserved", {
        ...base,
        customerId: "c1",
        reservedQty: 1200,
      }),
    ).toBe("booking_qty_below_moq");
    expect(
      bookingStatusRequirementError("reserved", {
        ...base,
        customerId: "c1",
        reservedQty: 2400,
      }),
    ).toBeNull();
    // Produto sem pedido mínimo: basta ser positivo.
    expect(
      bookingStatusRequirementError("reserved", {
        customerId: "c1",
        reservedQty: 10,
        moq: null,
      }),
    ).toBeNull();
    expect(reservedQtyError(null, 2400)).toBeNull();
    expect(reservedQtyError(0, null)).toBe("booking_qty_required");
    expect(reservedQtyError(1.5, null)).toBe("booking_qty_required");
    expect(reservedQtyError(100, 2400)).toBe("booking_qty_below_moq");
    expect(reservedQtyError(2400, 2400)).toBeNull();
  });

  it("sinal do Superplan: só com preço de venda testado; no preço mínimo é 'no preço mínimo'", () => {
    expect(bookingSignal(null)).toBe("none");
    // Preço testado no Superplan: verde, amarelo ou vermelho.
    for (const verdict of ["viable", "below", "loss"] as const)
      expect(bookingSignal(analysis({ verdict, usesMinimum: false }))).toBe(
        verdict,
      );
    // No preço mínimo o lucro só depende do tipo de negócio: não é sinal.
    for (const verdict of ["viable", "below", "loss"] as const)
      expect(bookingSignal(analysis({ verdict, usesMinimum: true }))).toBe(
        "minimum",
      );
    expect(bookingSignal(analysis({ verdict: null, missing: ["fx"] }))).toBe(
      "missing",
    );
  });
});

describe("filtros do Booking: toda coluna filtra", () => {
  const rows = [
    row(),
    row({
      id: "b2",
      productId: "p2",
      status: "approved",
      code: "2",
      name: "Porta-retrato MÁRMORE 20x25",
      price: 3.8,
      moq: 2400,
      masterQty: 24,
      netWeightKg: 0.183,
      grossWeightKg: 0.2,
      cbm: 0.0313,
      customerId: "cliente-joao",
      customerName: "Loja do João",
      reservedQty: 4800,
      sourceRows: "6-8",
      sourceOrder: 6,
      analysis: analysis({
        verdict: "viable",
        salePriceBrl: 62.89,
        usesMinimum: false,
      }),
      ownerUserId: "ana",
      ownerName: "Ana",
      note: "Cliente pediu amostra",
    }),
    row({
      id: "b3",
      productId: "p3",
      status: "discarded",
      code: "9",
      name: "Jarra de vidro",
      supplierId: "fornecedor-b",
      supplierName: "Guangzhou B",
      price: null,
      currency: "RMB",
      netWeightKg: null,
      colors: "Azul",
      material: "Vidro",
      enteredAt: "2026-10-01T09:00:00.000Z",
      importBatchId: "lote-0",
      sourceFileName: "vidros.xlsx",
      sheetDate: "2026-09-20T00:00:00.000Z",
      sourceRows: "2",
      sourceOrder: 2,
    }),
  ];
  const ids = (list: BookingRow[]) => list.map((r) => r.id);
  const run = (params: Record<string, string | string[]>, superplan = true) =>
    ids(
      filterBookingRows(rows, parseBookingFilters(params, { superplan }), {
        superplan,
      }),
    );

  it("toda coluna tem um tipo de filtro, sem chave repetida", () => {
    const keys = BOOKING_COLUMNS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    // Chaves que o endereço usa para outra coisa não podem ser colunas.
    for (const reserved of [
      "q",
      "sort",
      "dir",
      "page",
      "error",
      "fields",
      "at",
    ])
      expect(keys).not.toContain(reserved);
    // Os três "pesos" do dono: líquido, bruto e a média por kg.
    expect(keys).toEqual(
      expect.arrayContaining(["netWeight", "grossWeight", "average"]),
    );
  });

  it("texto: contém, sem acento e sem caixa", () => {
    expect(run({ name: "marmore" })).toEqual(["b2"]);
    expect(run({ name: "PORTA" })).toEqual(["b1", "b2"]);
    expect(run({ material: "vidro" })).toEqual(["b3"]);
    expect(run({ note: "amostra" })).toEqual(["b2"]);
    expect(run({ colors: "gray" })).toEqual(["b1", "b2"]);
    // O código do portal também acha pelo nome.
    expect(run({ name: "utl-010" })).toEqual(["b1", "b2", "b3"]);
  });

  it("opção: uma ou várias, e o vazio (sem cliente, sem responsável)", () => {
    expect(run({ status: "approved" })).toEqual(["b2"]);
    expect(run({ status: "new,discarded" })).toEqual(["b1", "b3"]);
    expect(run({ status: ["new", "approved"] })).toEqual(["b1", "b2"]);
    expect(run({ supplier: "fornecedor-b" })).toEqual(["b3"]);
    expect(run({ customer: BOOKING_EMPTY })).toEqual(["b1", "b3"]);
    expect(run({ customer: "cliente-joao" })).toEqual(["b2"]);
    expect(run({ owner: BOOKING_EMPTY })).toEqual(["b1", "b3"]);
    expect(run({ currency: "RMB" })).toEqual(["b3"]);
    expect(run({ source: "lote-0" })).toEqual(["b3"]);
  });

  it("número: de, até, ou os dois; linha sem o valor não entra", () => {
    expect(run({ price_min: "3,9" })).toEqual(["b1"]);
    expect(run({ price_max: "3.9" })).toEqual(["b2"]);
    expect(run({ price_min: "3", price_max: "5" })).toEqual(["b1", "b2"]);
    expect(run({ netWeight_max: "0,2" })).toEqual(["b2"]);
    expect(run({ grossWeight_min: "0,1" })).toEqual(["b2"]);
    expect(run({ reservedQty_min: "1" })).toEqual(["b2"]);
    expect(run({ cbm_min: "0,02" })).toEqual(["b2"]);
    expect(run({ masterQty_max: "12" })).toEqual(["b1", "b3"]);
  });

  it("data: de e até, pelo dia", () => {
    expect(run({ enteredAt_from: "2026-11-01" })).toEqual(["b1", "b2"]);
    expect(run({ enteredAt_to: "2026-10-31" })).toEqual(["b3"]);
    expect(
      run({ sheetDate_from: "2026-10-13", sheetDate_to: "2026-10-13" }),
    ).toEqual(["b1", "b2"]);
  });

  it("vários filtros valem juntos; a busca geral procura em tudo", () => {
    expect(run({ name: "porta", status: "approved" })).toEqual(["b2"]);
    expect(run({ name: "porta", price_min: "3,9", colors: "bege" })).toEqual([
      "b1",
    ]);
    expect(run({ q: "marmore 20x25" })).toEqual(["b2"]);
    expect(
      ids(
        filterBookingRows(
          rows,
          parseBookingFilters({ q: "joão" }, { superplan: true }),
          {
            superplan: true,
            searchText: (r) => `${r.name} ${r.customerName ?? ""}`,
          },
        ),
      ),
    ).toEqual(["b2"]);
  });

  it("colunas do Superplan só existem e só filtram para quem abre o Superplan", () => {
    expect(bookingColumnsFor(false).map((c) => c.key)).not.toEqual(
      expect.arrayContaining(["signal"]),
    );
    expect(bookingColumnsFor(false).some((c) => c.key === "salePrice")).toBe(
      false,
    );
    expect(run({ signal: "viable" })).toEqual(["b2"]);
    expect(run({ signal: "none" })).toEqual(["b1", "b3"]);
    expect(run({ salePrice_min: "60" })).toEqual(["b2"]);
    // Sem o Superplan o filtro é ignorado (não vaza quem é viável).
    expect(run({ signal: "viable" }, false)).toEqual(["b1", "b2", "b3"]);
    expect(run({ salePrice_min: "60" }, false)).toEqual(["b1", "b2", "b3"]);
    expect(
      parseBookingFilters({ sort: "signal" }, { superplan: false }).sort,
    ).toBeNull();
  });

  it("endereço estragado não quebra: o que não dá para ler é ignorado", () => {
    const f = parseBookingFilters(
      {
        price_min: "abc",
        enteredAt_from: "ontem",
        status: "<script>",
        sort: "naoexiste",
        page: "-3",
        name: "  ",
      },
      { superplan: true },
    );
    expect(activeBookingFilters(f)).toBe(0);
    expect(f.sort).toBeNull();
    expect(f.page).toBe(1);
  });

  it("ordem padrão: últimas a entrar primeiro, na ordem da planilha", () => {
    expect(ids(sortBookingRows(rows, null, { superplan: true }))).toEqual([
      "b1",
      "b2",
      "b3",
    ]);
  });

  it("ordenar por qualquer coluna, com os vazios no fim nos dois sentidos", () => {
    const sort = (key: string, dir: "asc" | "desc" = "asc") =>
      ids(
        sortBookingRows(
          rows,
          parseBookingFilters({ sort: key, dir }, { superplan: true }).sort,
          {
            superplan: true,
            optionLabel: (k, id) =>
              k === "supplier"
                ? (rows.find((r) => r.supplierId === id)?.supplierName ?? id)
                : id,
          },
        ),
      );
    expect(sort("price")).toEqual(["b2", "b1", "b3"]);
    expect(sort("price", "desc")).toEqual(["b1", "b2", "b3"]);
    expect(sort("name")).toEqual(["b3", "b2", "b1"]);
    // Etapa: pela ordem do processo, não pelo alfabeto.
    expect(sort("status")).toEqual(["b1", "b2", "b3"]);
    expect(sort("supplier")).toEqual(["b3", "b1", "b2"]);
    expect(sort("reservedQty", "desc")).toEqual(["b2", "b1", "b3"]);
  });

  it("o filtro vai e volta pelo endereço; mudar filtro volta à página 1", () => {
    const filters = parseBookingFilters(
      {
        q: "porta",
        name: "marmore",
        status: "new,approved",
        price_min: "3",
        price_max: "5,5",
        enteredAt_from: "2026-11-01",
        sort: "price",
        dir: "desc",
        page: "3",
      },
      { superplan: true },
    );
    expect(activeBookingFilters(filters)).toBe(5);
    const query = bookingQuery(filters);
    const again = parseBookingFilters(
      Object.fromEntries(new URLSearchParams(query)),
      { superplan: true },
    );
    expect(again).toEqual(filters);
    // Trocar de página mantém tudo; tirar um filtro ou ordenar volta à 1.
    expect(bookingQuery(filters, { page: 4 })).toContain("page=4");
    expect(bookingQuery(filters, { drop: "name" })).not.toContain("page=");
    expect(bookingQuery(filters, { drop: "name" })).not.toContain("name=");
    expect(bookingQuery(filters, { drop: "price" })).not.toContain("price_");
    expect(
      bookingQuery(filters, { sort: { key: "name", dir: "asc" } }),
    ).toContain("sort=name");
    expect(
      bookingQuery(filters, {
        option: { key: "status", values: ["reserved"] },
      }),
    ).toContain("status=reserved");
    expect(
      bookingQuery(filters, { option: { key: "status", values: [] } }),
    ).not.toContain("status=");
    expect(bookingQuery(parseBookingFilters({}, { superplan: true }))).toBe("");
  });

  it("páginas de 100 linhas", () => {
    const many = Array.from({ length: 230 }, (_, i) => i);
    expect(pageOfBookingRows(many, 1)).toMatchObject({
      page: 1,
      pages: 3,
      total: 230,
    });
    expect(pageOfBookingRows(many, 3).rows).toHaveLength(30);
    // Página além do fim: a última.
    expect(pageOfBookingRows(many, 9).page).toBe(3);
    expect(pageOfBookingRows([], 1)).toMatchObject({ page: 1, pages: 1 });
  });
});

describe("filtro de número inteiro", () => {
  it("em colunas de peças e caixas, 1.200 é mil e duzentos; em preço e peso, o ponto é decimal", () => {
    const filters = parseBookingFilters(
      {
        moq_min: "1.200",
        masterQty_max: "1.000",
        reservedQty_min: "2.400",
        price_min: "1.200",
        netWeight_max: "0,225",
      },
      { superplan: true },
    );
    expect(filters.numbers.moq).toEqual({ min: 1200 });
    expect(filters.numbers.masterQty).toEqual({ max: 1000 });
    expect(filters.numbers.reservedQty).toEqual({ min: 2400 });
    expect(filters.numbers.price).toEqual({ min: 1.2 });
    expect(filters.numbers.netWeight).toEqual({ max: 0.225 });
    const rows = [
      row({ id: "a", moq: 600 }),
      row({ id: "b", moq: 1200 }),
      row({ id: "c", moq: 2400 }),
    ];
    expect(
      filterBookingRows(rows, filters, { superplan: true }).map((r) => r.id),
    ).toEqual([]);
    const onlyMoq = parseBookingFilters(
      { moq_min: "1.200" },
      { superplan: true },
    );
    expect(
      filterBookingRows(rows, onlyMoq, { superplan: true }).map((r) => r.id),
    ).toEqual(["b", "c"]);
  });
});

describe("sair de 'Virou solicitação'", () => {
  it("depende da solicitação da linha", () => {
    const now = Date.parse("2026-11-10T12:00:00Z");
    const taken = (minutesAgo: number) => ({
      status: "requested" as const,
      statusChangedAt: new Date(now - minutesAgo * 60_000).toISOString(),
    });
    // Estado: sendo criada (2 min), não nasceu, em andamento, pedido/cancelada.
    expect(bookingLinkState(taken(1), null, now)).toBe("pending");
    expect(bookingLinkState(taken(2), null, now)).toBe("pending");
    expect(bookingLinkState(taken(3), null, now)).toBe("missing");
    expect(
      bookingLinkState({ status: "requested", statusChangedAt: null }, null),
    ).toBe("missing");
    for (const status of BOOKING_OPEN_REQUEST)
      expect(bookingLinkState(taken(1), { status }, now)).toBe("alive");
    // Virou pedido: encerrada. Cancelada: para a linha, não existe mais (na
    // hora, sem esperar os 2 minutos).
    expect(bookingLinkState(taken(600), { status: "ORDERED" }, now)).toBe(
      "closed",
    );
    expect(bookingLinkState(taken(0), { status: "CANCELLED" }, now)).toBe(
      "missing",
    );
    expect(
      bookingLinkState({ status: "approved", statusChangedAt: null }, null),
    ).toBeNull();

    for (const actor of [BUYER, ADMIN]) {
      // Sendo criada ou em andamento: ninguém move, nem quem analisa.
      for (const to of ["approved", "reserved", "discarded", "new"] as const) {
        expect(bookingMoveError("requested", to, actor, "pending")).toBe(
          "booking_request_pending",
        );
        expect(bookingMoveError("requested", to, actor, "alive")).toBe(
          "booking_request_alive",
        );
      }
      expect(bookingMoveOptions("requested", actor, "pending")).toEqual([
        "requested",
      ]);
      expect(bookingMoveOptions("requested", actor, "alive")).toEqual([
        "requested",
      ]);
      // Não nasceu: quem tem a tela devolve para onde ela podia estar.
      for (const to of ["approved", "offered", "reserved"] as const)
        expect(bookingMoveError("requested", to, actor, "missing")).toBeNull();
    }
    // Não nasceu, para fora da vitrine: só quem analisa.
    expect(bookingMoveError("requested", "new", BUYER, "missing")).toBe(
      "booking_reopen_forbidden",
    );
    expect(bookingMoveError("requested", "new", ADMIN, "missing")).toBeNull();
    // Virou pedido ou foi cancelada: só quem analisa reabre.
    expect(bookingMoveError("requested", "approved", BUYER, "closed")).toBe(
      "booking_reopen_forbidden",
    );
    expect(
      bookingMoveError("requested", "approved", ADMIN, "closed"),
    ).toBeNull();
    expect(bookingMoveOptions("requested", BUYER, "closed")).toEqual([
      "requested",
    ]);
    // "Virou solicitação" nunca à mão, em estado nenhum.
    expect(bookingMoveError("approved", "requested", ADMIN, "missing")).toBe(
      "booking_request_only",
    );
  });
});
