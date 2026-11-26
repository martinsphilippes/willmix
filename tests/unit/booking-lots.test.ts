import { beforeAll, describe, expect, it } from "vitest";
import { setTestFamily } from "./helpers/book-family";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Booking por planilha (docs/BOOKING.md, "Booking por planilha"): a planilha
 * de um fornecedor vira um booking em rascunho com os itens (nenhum produto
 * do cadastro); fornecedor, origem e data são estimados da planilha; colunas
 * sem campo próprio ficam guardadas no item; fechar exige os campos
 * obrigatórios e roda o Superplan em todos os itens.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/booking-lots");
const lib = await import("@/lib/booking-lots");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

const HEADER = [
  "PRODUCT NUMBER LIST",
  "DATE",
  "LOCAL",
  "SUPPLIER NAME",
  "SUPPLIER STORE NO",
  "SUPPLIER PHONE NO",
  "SKU/FACTORY ITEM CODE",
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
  "COLOR ASSORTMENT",
  "CERTIFICATE",
];

const line = (
  n: string,
  sku: string,
  desc: string,
  extra: Partial<Record<string, string>> = {},
) => [
  n,
  "2026.10.13",
  "Yiwu",
  "Ningbo Glassware Co., Ltd.",
  "A 154678",
  "+86 138 0000 1111",
  sku,
  desc,
  "FOB",
  "USD",
  extra.price ?? "1.25",
  "48",
  extra.inner ?? "12",
  "0.3",
  "0.35",
  "0.12",
  "10",
  "8",
  extra.height ?? "20",
  "350",
  "color box",
  "glass",
  "1000",
  "clear",
  extra.cert ?? "CE",
];

const file = (rows: string[][], name = "booking-ningbo.xlsx") =>
  new File([xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }])], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

describe("booking por planilha", () => {
  it("cria o booking em rascunho com os itens, sem produto", async () => {
    const store = getStore();
    const productsBefore = (await store.list("products")).length;
    const lot = await svc.createBookingLotFromSheet(
      admin,
      file([
        line("1", "GL-01", "Glass cup"),
        line("2", "GL-02", "Glass jar", { height: "" }),
      ]),
    );
    expect(lot.status).toBe("draft");
    expect(lot.number).toBeGreaterThan(0);
    expect(lot.itemCount).toBe(2);
    expect(lot.bookingDate?.slice(0, 10)).toBe("2026-10-13");
    expect(lot.origin).toBe("Yiwu");
    // Fornecedor desconhecido: sugestão com o que a planilha trouxe.
    expect(lot.supplierId).toBeNull();
    expect(lot.supplierHint).toEqual({
      name: "Ningbo Glassware Co., Ltd.",
      store: "A 154678",
      phone: "+86 138 0000 1111",
      city: "Yiwu",
    });
    expect(lot.extraHeaders).toContain("CERTIFICATE");
    expect((await store.list("products")).length).toBe(productsBefore);

    const items = (
      await store.list("booking_items", { filter: { lotId: lot.id } })
    ).sort((a, b) => a.position - b.position);
    expect(items).toHaveLength(2);
    const [cup, jar] = items;
    expect(cup).toMatchObject({
      itemNumber: "1",
      factoryItemCode: "GL-01",
      description: "Glass cup",
      incoterm: "FOB",
      currency: "USD",
      price: 1.25,
      masterCartonQty: 48,
      innerQty: 12,
      netWeightPcKg: 0.3,
      grossWeightPcKg: 0.35,
      cbmPerCarton: 0.12,
      lengthCm: 10,
      widthCm: 8,
      heightCm: 20,
      capacityMl: 350,
      packageType: "color box",
      material: "glass",
      moq: 1000,
      colorAssortment: "clear",
      productId: null,
    });
    expect(cup.extras).toEqual({ CERTIFICATE: "CE" });
    // Sem produto parecido no cadastro: o NCM fica para o despachante.
    expect(lib.missingItemFields(cup)).toEqual(["ncm"]);
    expect(cup.ncmRequestedAt).toBeTruthy();
    expect(lib.missingItemFields(jar)).toEqual(["heightCm", "ncm"]);
  });

  it("reconhece o fornecedor já cadastrado pelo nome", async () => {
    const store = getStore();
    const party = await store.create("parties", {
      type: "supplier",
      name: "NINGBO GLASSWARE",
      country: "China",
      email: null,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
      city: "Ningbo",
      address: null,
      contactName: null,
      wechat: null,
      operationMode: null,
      radar: null,
      radarNotes: null,
      importerId: null,
      bankBeneficiary: null,
      bankName: null,
      bankAccount: null,
      bankSwift: null,
      bankAddress: null,
    });
    const lot = await svc.createBookingLotFromSheet(
      admin,
      file([line("1", "GL-01", "Glass cup")]),
    );
    expect(lot.supplierId).toBe(party.id);
    // Origem: a cidade do fornecedor.
    expect(lot.origin).toBe("Ningbo");
    await store.update("parties", party.id, { active: false });
  });

  it("só fecha completo, e fechar analisa todos os itens", async () => {
    const store = getStore();
    const lot = await svc.createBookingLotFromSheet(
      admin,
      file([
        line("1", "GL-01", "Glass cup"),
        line("2", "GL-02", "Glass jar", { height: "" }),
      ]),
    );
    await expect(svc.closeBookingLot(admin, lot.id)).rejects.toThrow(
      "supplier_required",
    );
    const party = await svc.registerBookingLotSupplier(admin, lot.id, {
      name: lot.supplierHint!.name!,
      storeNumber: lot.supplierHint!.store,
      phone: lot.supplierHint!.phone,
      city: lot.supplierHint!.city,
      country: null,
    });
    expect(party).toMatchObject({
      type: "supplier",
      storeNumber: "A 154678",
      phone: "+86 138 0000 1111",
      city: "Yiwu",
      active: true,
    });
    expect((await store.get("booking_lots", lot.id))!.supplierId).toBe(
      party.id,
    );
    await expect(svc.closeBookingLot(admin, lot.id)).rejects.toThrow(
      "booking_items_incomplete",
    );
    const jar = (
      await store.list("booking_items", { filter: { lotId: lot.id } })
    ).find((i) => i.factoryItemCode === "GL-02")!;
    await expect(
      svc.setBookingItemField(admin, jar.id, "heightCm", "abc"),
    ).rejects.toThrow("booking_item_invalid");
    const saved = await svc.setBookingItemField(
      admin,
      jar.id,
      "heightCm",
      "21,5",
    );
    expect(saved.heightCm).toBe(21.5);
    // Sem NCM, ainda não fecha; com o NCM (Wellmix), fecha.
    await expect(svc.closeBookingLot(admin, lot.id)).rejects.toThrow(
      "booking_items_incomplete",
    );
    const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
    await setBookingItemsNcm(
      admin,
      (await store.list("booking_items", { filter: { lotId: lot.id } })).map(
        (i) => i.id,
      ),
      "7013.37.00",
    );

    await setTestFamily(lot.id);
    const closed = await svc.closeBookingLot(admin, lot.id);
    expect(closed.status).toBe("closed");
    expect(closed.analyzedAt).toBeTruthy();
    const items = await store.list("booking_items", {
      filter: { lotId: lot.id },
    });
    expect(items.every((i) => i.analysis && i.analysis.at)).toBe(true);
    // Fechado não edita.
    await expect(
      svc.setBookingItemField(admin, jar.id, "heightCm", "22"),
    ).rejects.toThrow("booking_lot_locked");
    // Status à mão: só os caminhos previstos.
    await expect(svc.moveBookingLot(admin, lot.id, "draft")).rejects.toThrow(
      "booking_lot_move_invalid",
    );
    await svc.moveBookingLot(admin, lot.id, "in_progress");
    expect((await store.get("booking_lots", lot.id))!.status).toBe(
      "in_progress",
    );
  });

  /*
   * INNER (peças por caixa inner) opcional (dono, 16/11/2026): sem asterisco,
   * em branco fica sem valor (nulo, nunca zero) e não trava salvar nem fechar;
   * preenchido, segue as regras de número.
   */
  it("INNER em branco: fica sem valor, não falta e o book fecha", async () => {
    const store = getStore();
    const lot = await svc.createBookingLotFromSheet(
      admin,
      file(
        [
          line("1", "IN-01", "Cup without inner", { inner: "" }),
          line("2", "IN-02", "Cup with inner"),
        ],
        "booking-inner.xlsx",
      ),
    );
    const items = await store.list("booking_items", {
      filter: { lotId: lot.id },
    });
    const blank = items.find((i) => i.factoryItemCode === "IN-01")!;
    const filled = items.find((i) => i.factoryItemCode === "IN-02")!;
    // Da planilha: em branco fica sem valor (nunca zero).
    expect(blank.innerQty).toBeNull();
    expect(filled.innerQty).toBe(12);
    expect(lib.isRequiredItemField("innerQty")).toBe(false);
    expect(lib.missingItemFields(blank)).not.toContain("innerQty");

    // Apagar o INNER grava nulo; preenchido, as regras de número continuam.
    const cleared = await svc.setBookingItemField(
      admin,
      filled.id,
      "innerQty",
      "",
    );
    expect(cleared.innerQty).toBeNull();
    for (const bad of ["0", "-3", "abc"])
      await expect(
        svc.setBookingItemField(admin, filled.id, "innerQty", bad),
      ).rejects.toThrow("booking_item_invalid");
    expect(
      (await svc.setBookingItemField(admin, filled.id, "innerQty", "24"))
        .innerQty,
    ).toBe(24);

    // Fecha com o INNER em branco num dos itens.
    if (!lot.supplierId)
      await svc.registerBookingLotSupplier(admin, lot.id, {
        name: lot.supplierHint!.name!,
        storeNumber: lot.supplierHint!.store,
        phone: lot.supplierHint!.phone,
        city: lot.supplierHint!.city,
        country: null,
      });
    const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
    await setBookingItemsNcm(
      admin,
      items.map((i) => i.id),
      "7013.37.00",
    );
    const pending = lib.bookingLotPending(
      (await store.get("booking_lots", lot.id))!,
      await store.list("booking_items", { filter: { lotId: lot.id } }),
    );
    expect(lib.bookingLotReady(pending)).toBe(true);
    await setTestFamily(lot.id);
    const closed = await svc.closeBookingLot(admin, lot.id);
    expect(closed.status).toBe("closed");
    expect((await store.get("booking_items", blank.id))!.innerQty).toBeNull();
    expect((await store.get("booking_items", filled.id))!.innerQty).toBe(24);
  });

  it("cliente não sobe booking", async () => {
    await expect(
      svc.createBookingLotFromSheet(joao, file([line("1", "X", "Y")])),
    ).rejects.toThrow();
  });
});

describe("regras puras", () => {
  it("lê o valor digitado de cada campo", () => {
    expect(lib.readBookingItemValue("price", "1.234,50")).toBe(1234.5);
    expect(lib.readBookingItemValue("moq", "1.000")).toBe(1000);
    expect(lib.readBookingItemValue("incoterm", "exw")).toBe("EXW");
    expect(lib.readBookingItemValue("currency", "cny")).toBe("RMB");
    expect(lib.readBookingItemValue("material", "  ABS  ")).toBe("ABS");
    expect(lib.readBookingItemValue("price", "")).toBeNull();
    // INNER: vazio é nulo (nunca zero); preenchido, número inteiro positivo.
    expect(lib.readBookingItemValue("innerQty", "")).toBeNull();
    expect(lib.readBookingItemValue("innerQty", "  ")).toBeNull();
    expect(lib.readBookingItemValue("innerQty", "12")).toBe(12);
    expect(() => lib.readBookingItemValue("innerQty", "0")).toThrow();
    expect(() => lib.readBookingItemValue("innerQty", "doze")).toThrow();
    expect(() => lib.readBookingItemValue("price", "0")).toThrow();
    expect(() => lib.readBookingItemValue("incoterm", "CIF")).toThrow();
  });

  it("acha o fornecedor por nome, telefone ou loja", () => {
    const base = {
      type: "supplier" as const,
      active: true,
      phone: null,
      storeNumber: null,
    };
    const parties = [
      { ...base, id: "a", name: "Yiwu Toys Trading Co., Ltd" },
      { ...base, id: "b", name: "Other", phone: "+86 13800001111" },
      { ...base, id: "c", name: "Third", storeNumber: "B-200" },
    ] as unknown as import("@/lib/db").Party[];
    const hint = (
      h: Partial<{ name: string; phone: string; store: string }>,
    ) => ({
      name: h.name ?? null,
      phone: h.phone ?? null,
      store: h.store ?? null,
    });
    expect(
      lib.matchSheetSupplier(parties, hint({ name: "YIWU TOYS" }))?.id,
    ).toBe("a");
    expect(
      lib.matchSheetSupplier(parties, hint({ phone: "138-0000-1111" }))?.id,
    ).toBe("b");
    expect(lib.matchSheetSupplier(parties, hint({ store: "b 200" }))?.id).toBe(
      "c",
    );
    // Com outro nome na planilha, a loja igual não basta.
    expect(
      lib.matchSheetSupplier(parties, hint({ name: "New", store: "B-200" })),
    ).toBeNull();
    expect(
      lib.matchSheetSupplier(parties, hint({ name: "Nobody" })),
    ).toBeNull();
  });

  it("busca por qualquer campo e ordena por coluna", () => {
    const row = (n: number, supplier: string, origin: string) =>
      ({
        id: String(n),
        number: n,
        status: "draft",
        statusLabel: "Rascunho",
        origin,
        supplier,
        date: null,
        dateText: "",
        fileName: `f${n}.xlsx`,
        itemCount: n,
        pendingItems: 0,
        viable: 0,
        below: 0,
        loss: 0,
        missing: 0,
        owner: "",
        createdAt: "",
        createdText: "",
        itemType: "",
        factory: "",
        factoryStore: "",
        workedPct: 0,
        workedText: "",
        holder: "",
        lockId: null,
        lockMine: false,
        lockCanRelease: false,
        lockByType: false,
        heldMinutes: null,
        heldText: "",
        heldSince: null,
        workDoneAt: null,
      }) satisfies import("@/lib/booking-lots").BookingLotRow;
    const rows = [
      row(1, "Ningbo Glass", "Yiwu"),
      row(2, "Shantou Toys", "Shantou"),
    ];
    expect(lib.searchBookingLots(rows, "toys").map((r) => r.number)).toEqual([
      2,
    ]);
    expect(
      lib.searchBookingLots(rows, "yiwu ningbo").map((r) => r.number),
    ).toEqual([1]);
    expect(
      lib.sortBookingLots(rows, "supplier", "desc").map((r) => r.number),
    ).toEqual([2, 1]);
    expect(
      lib.sortBookingLots(rows, "itemCount", "asc").map((r) => r.number),
    ).toEqual([1, 2]);
  });
});

describe("prazo da trava do book (dono, 24/11/2026)", () => {
  it("mostra só a data e a hora do fim do prazo, no horário de Brasília", async () => {
    const { lockDueText } = await import("@/lib/booking-locks");
    // 24/11 16:52 em Brasília (19:52 UTC) + 3 h = 24/11 19:52 em Brasília.
    expect(lockDueText("2026-11-24T19:52:00Z", 3)).toBe("24/11 19:52");
    // Virada do dia: 23:30 + 3 h = 02:30 do dia seguinte.
    expect(lockDueText("2026-11-25T02:30:00Z", 3)).toBe("25/11 02:30");
    expect(lockDueText("data ruim", 3)).toBe("");
  });
});

describe("o prazo do book explicado (dono, 24/11/2026)", () => {
  // Travado às 16:52 em Brasília (19:52 UTC); prazo de 3 h: vence às 19:52.
  const since = "2026-11-24T19:52:00Z";
  const at = (iso: string, minutes = 0, seconds = 0) =>
    Date.parse(iso) + minutes * 60_000 + seconds * 1000;
  const labelsOf = async (locale: "pt" | "en" | "zh") => {
    const { translator } = await import("@/i18n");
    const t = translator(locale);
    return {
      left: t("bookWork.clock.left"),
      late: t("bookWork.clock.late"),
      done: t("bookWork.clock.done"),
      doneNow: t("bookWork.clock.doneNow"),
      until: t("bookWork.clock.until"),
      due: t("bookWork.clock.due"),
      doneAt: t("bookWork.clock.doneAt"),
    };
  };

  it("no prazo: quanto falta e até quando; âmbar no último quarto", async () => {
    const { bookClock, bookClockText } = await import("@/lib/booking-locks");
    const pt = await labelsOf("pt");
    const ok = bookClock({ since }, 3, at(since, 50))!;
    expect(ok).toEqual({
      stage: "ok",
      minutes: 130,
      elapsed: 50,
      at: "24/11 19:52",
    });
    expect(bookClockText(ok, pt)).toEqual({
      main: "Faltam 2 h 10 min",
      at: "até 24/11 19:52",
    });
    // Acabou de travar: faltam as 3 h inteiras (30 s contam como 1 min).
    expect(bookClock({ since }, 3, at(since, 0, 30))).toMatchObject({
      stage: "ok",
      minutes: 180,
      elapsed: 0,
    });
    // Relógio do aparelho atrasado: nunca mais que o prazo inteiro.
    expect(bookClock({ since }, 3, at(since, -2))).toMatchObject({
      stage: "ok",
      minutes: 180,
      elapsed: 0,
    });
    // Últimos 45 min (um quarto de 3 h): âmbar.
    expect(bookClock({ since }, 3, at(since, 134))?.stage).toBe("ok");
    const soon = bookClock({ since }, 3, at(since, 135))!;
    expect(soon).toMatchObject({ stage: "soon", minutes: 45 });
    expect(bookClockText(soon, pt).main).toBe("Faltam 45 min");
  });

  it("atrasado: quanto passou e quando venceu", async () => {
    const { bookClock, bookClockText } = await import("@/lib/booking-locks");
    const late = bookClock({ since }, 3, at(since, 180 + 65))!;
    expect(late).toEqual({
      stage: "late",
      minutes: 65,
      elapsed: 245,
      at: "24/11 19:52",
    });
    expect(bookClockText(late, await labelsOf("pt"))).toEqual({
      main: "Atrasado 1 h 05 min",
      at: "venceu 24/11 19:52",
    });
    // Na hora do prazo já vence, com pelo menos 1 min de atraso.
    expect(bookClock({ since }, 3, at(since, 180))).toMatchObject({
      stage: "late",
      minutes: 1,
    });
    // Dias de atraso.
    expect(
      bookClockText(
        bookClock({ since }, 3, at(since, 180 + 3 * 1440 + 4 * 60))!,
        await labelsOf("pt"),
      ).main,
    ).toBe("Atrasado 3 d 4 h");
  });

  it("feito: há quanto tempo e quando, mesmo com a trava ainda na linha", async () => {
    const { bookClock, bookClockText } = await import("@/lib/booking-locks");
    // Todos os itens trabalhados às 19:30 em Brasília.
    const workDoneAt = "2026-11-24T22:30:00Z";
    const done = bookClock({ since, workDoneAt }, 3, at(workDoneAt, 40))!;
    expect(done).toEqual({
      stage: "done",
      minutes: 40,
      elapsed: 40,
      at: "24/11 19:30",
    });
    expect(bookClockText(done, await labelsOf("pt"))).toEqual({
      main: "Feito há 40 min",
      at: "em 24/11 19:30",
    });
    expect(
      bookClockText(
        bookClock({ workDoneAt }, 3, at(workDoneAt, 0, 20))!,
        await labelsOf("pt"),
      ).main,
    ).toBe("Feito agora");
  });

  it("sem trava nem feito (ou data ruim): nada; e os textos nos três idiomas", async () => {
    const { bookClock, bookClockText } = await import("@/lib/booking-locks");
    expect(bookClock({}, 3, Date.now())).toBeNull();
    expect(
      bookClock({ since: null, workDoneAt: null }, 3, Date.now()),
    ).toBeNull();
    expect(bookClock({ since: "data ruim" }, 3, Date.now())).toBeNull();
    expect(bookClock({ workDoneAt: "data ruim" }, 3, Date.now())).toBeNull();
    const ok = bookClock({ since }, 3, at(since, 50))!;
    expect(bookClockText(ok, await labelsOf("en"))).toEqual({
      main: "2 h 10 min left",
      at: "until 24/11 19:52",
    });
    expect(bookClockText(ok, await labelsOf("zh"))).toEqual({
      main: "剩余 2 h 10 min",
      at: "截止 24/11 19:52",
    });
  });
});
