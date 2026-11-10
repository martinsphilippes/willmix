import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Importação da ficha técnica no modo "Mandar para o Booking"
 * (docs/BOOKING.md): um produto por grupo de linhas e uma linha do Booking
 * por produto; reimportar a mesma planilha cai nos mesmos produtos e não
 * muda a etapa; o produto com variações da importação antiga não é tocado; a
 * planilha guardada de um lote antigo pode ser relida direto no Booking; e o
 * peso líquido nunca é lido como peso bruto.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/product-sheet-import");
const { getProductSheet } = await import("@/lib/services/product-sheet");
const pv = await import("@/lib/services/product-variants");
const { hiddenBookingProductIds } =
  await import("@/lib/services/booking-visibility");
type User = import("@/lib/db").User;
type ImportBatch = import("@/lib/db").ImportBatch;

let admin: User;
let joao: User;
/** Operador da Wellmix que abre Produtos, mas não a tela Booking. */
let designer: User;
let lineId: string;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  designer = {
    ...admin,
    id: "designer-sem-booking",
    email: "designer@wellmix.test",
    role: "operator",
    functions: ["designer"],
    screens: null,
  };
  lineId = (await getStore().list("product_lines", { orderBy: "name" }))[0].id;
});

const HEADER = [
  "SKU",
  "SUPPLIER NAME",
  "SUPPLIER STORE NO",
  "DESCRIPTION",
  "PRICE USD",
  "QTY/BOX",
  "N.W PC",
  "G.W PC",
  "CBM",
  "COLOR",
  "MOQ",
];

interface Line {
  sku: string;
  desc: string;
  price: string;
  color: string;
  box?: string;
  nw?: string;
  gw?: string;
  cbm?: string;
}

/** Planilha simples (uma linha de cabeçalho); a primeira linha de produto é a 2. */
const sheet = (supplier: [name: string, store: string], lines: Line[]) =>
  xlsxBytes([
    {
      name: "SUPPLIER INFO",
      cells: [
        HEADER,
        ...lines.map((l) => [
          l.sku,
          supplier[0],
          supplier[1],
          l.desc,
          l.price,
          l.box ?? "12",
          l.nw ?? "0.225",
          l.gw ?? "",
          l.cbm ?? "0.0183",
          l.color,
          "1200",
        ]),
      ],
    },
  ]);

const file = (bytes: Uint8Array<ArrayBuffer>, name = "feira-yiwu.xlsx") =>
  new File([bytes], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

const count = async () => {
  const store = getStore();
  return {
    products: (await store.list("products")).length,
    bookings: (await store.list("bookings")).length,
    suppliers: (await store.list("parties", { filter: { type: "supplier" } }))
      .length,
    batches: (await store.list("import_batches")).length,
    documents: (await store.list("documents")).length,
  };
};

const bookingOf = async (productId: string) =>
  (await getStore().list("bookings", { filter: { productId } }))[0] ?? null;

/** Três produtos: o primeiro em três cores (linhas 2 a 4), depois as linhas 5 e 6. */
const fairSheet = () =>
  sheet(
    ["Yiwu Quadros", "Q1-100"],
    [
      { sku: "A-1", desc: "MARBLE", price: "4", color: "White" },
      { sku: "A-1", desc: "MARBLE", price: "4", color: "Gray" },
      { sku: "A-1", desc: "MARBLE", price: "4", color: "Bege" },
      { sku: "B-2", desc: "WOOD", price: "3.15", color: "Natural" },
      { sku: "C-3", desc: "STEEL", price: "5", color: "Silver" },
    ],
  );

describe("mandar para o Booking", () => {
  let firstBatchId: string;
  let productIds: string[];

  it("cria um produto por grupo e uma linha do Booking por produto, fora da vitrine", async () => {
    const store = getStore();
    const before = await count();
    const result = await svc.importProductSheet(admin, file(fairSheet()), {
      lineId,
      namePrefix: "Quadro",
      mode: "booking",
    });
    expect(result.summary).toMatchObject({
      groups: 3,
      rows: 5,
      created: 3,
      updated: 0,
      errors: 0,
      suppliersCreated: 1,
      bookingCreated: 3,
      bookingKept: 0,
      variantsCreated: 0,
    });
    expect(result.results.map((r) => [r.name, r.status, r.error])).toEqual([
      ["Quadro MARBLE", "created", null],
      ["Quadro WOOD", "created", null],
      ["Quadro STEEL", "created", null],
    ]);
    const after = await count();
    expect(after.products).toBe(before.products + 3);
    expect(after.bookings).toBe(before.bookings + 3);

    firstBatchId = result.batchId;
    productIds = result.results.map((r) => r.productId!);
    // Cores do mesmo código juntas no mesmo produto.
    const first = (await store.get("products", productIds[0]))!;
    expect(first).toMatchObject({ supplierSku: "A-1", price: 4, moq: 1200 });
    expect((await getProductSheet(first.id))!.colorAssortment).toBe(
      "White / Gray / Bege",
    );
    // Sem variações: cada grupo é um produto inteiro.
    expect((await pv.variantsByProduct(productIds)).size).toBe(0);

    const rows = await Promise.all(productIds.map(bookingOf));
    expect(
      rows.map((b) => [
        b!.status,
        b!.ownerUserId,
        b!.createdByUserId,
        b!.importBatchId,
        b!.sourceFileName,
        b!.sourceRows,
        b!.sourceOrder,
      ]),
    ).toEqual([
      ["new", admin.id, admin.id, result.batchId, "feira-yiwu.xlsx", "2-4", 2],
      ["new", admin.id, admin.id, result.batchId, "feira-yiwu.xlsx", "5", 5],
      ["new", admin.id, admin.id, result.batchId, "feira-yiwu.xlsx", "6", 6],
    ]);
    expect(rows[0]).toMatchObject({
      customerId: null,
      reservedQty: null,
      analysis: null,
      requestId: null,
    });
    // Em Novo, o produto fica escondido do cliente.
    const hidden = await hiddenBookingProductIds();
    for (const id of productIds) expect(hidden.has(id)).toBe(true);

    const batch = (await store.get("import_batches", result.batchId))!;
    expect(batch.mapping.__mode).toBe("booking");
    expect(svc.importBatchMode(batch)).toBe("booking");
    expect(batch.fileDocumentId).toBeTruthy();
    expect(svc.batchProductIds(batch)).toEqual(productIds);
    expect(batch.decisions["1"]).toBe(`created:${productIds[1]}`);
    expect(batch.summary).toMatchObject({ bookingCreated: 3, bookingKept: 0 });
    // Modo desconhecido continua lido como antes (um produto por linha).
    expect(
      svc.importBatchMode({
        ...batch,
        mapping: { ...batch.mapping, __mode: "outro" },
      }),
    ).toBe("products");
    expect(svc.SHEET_IMPORT_MODES).toEqual(["booking", "variants", "products"]);
  });

  it("importar a mesma planilha de novo atualiza os mesmos produtos, sem outra linha e sem mudar a etapa", async () => {
    const store = getStore();
    // A segunda linha já foi aprovada no Booking.
    const approved = (await bookingOf(productIds[1]))!;
    await store.update("bookings", approved.id, { status: "approved" });
    const before = await count();
    const result = await svc.importProductSheet(admin, file(fairSheet()), {
      lineId,
      namePrefix: "Quadro",
      mode: "booking",
    });
    expect(result.summary).toMatchObject({
      created: 0,
      updated: 3,
      errors: 0,
      suppliersCreated: 0,
      bookingCreated: 0,
      bookingKept: 3,
    });
    expect(result.results.map((r) => r.productId)).toEqual(productIds);
    const after = await count();
    expect(after.products).toBe(before.products);
    expect(after.bookings).toBe(before.bookings);
    expect(after.suppliers).toBe(before.suppliers);
    const rows = await Promise.all(productIds.map(bookingOf));
    expect(rows.map((b) => b!.status)).toEqual(["new", "approved", "new"]);
    // A linha aprovada fica como estava; as que seguem em Novo apontam para a planilha mais recente.
    expect(rows[1]).toMatchObject({
      id: approved.id,
      importBatchId: firstBatchId,
    });
    expect(rows[0]!.importBatchId).toBe(result.batchId);
    expect(rows[2]!.importBatchId).toBe(result.batchId);
    // Uma linha por produto, sempre.
    for (const id of productIds)
      expect(
        (await store.list("bookings", { filter: { productId: id } })).length,
      ).toBe(1);
  });

  it("nomes repetidos na mesma planilha e nome igual de outro fornecedor caem nos mesmos produtos ao reimportar", async () => {
    const store = getStore();
    // Três grupos com o mesmo nome (preços diferentes): código, depois contador.
    const repeated = () =>
      sheet(
        ["Alfa Vasos", "V1-100"],
        [
          { sku: "V1", desc: "VASO", price: "3", color: "Azul" },
          { sku: "V2", desc: "VASO", price: "4", color: "Azul" },
          { sku: "", desc: "VASO", price: "5", color: "Azul" },
        ],
      );
    const first = await svc.importProductSheet(admin, file(repeated()), {
      lineId,
      mode: "booking",
    });
    expect(first.results.map((r) => [r.name, r.status])).toEqual([
      ["VASO", "created"],
      ["VASO · V2", "created"],
      ["VASO (2)", "created"],
    ]);
    // Outro fornecedor com o mesmo nome: produto dele, com o fornecedor no nome.
    const other = () =>
      sheet(
        ["Beta Vasos", "V2-200"],
        [{ sku: "X9", desc: "VASO", price: "9", color: "Verde" }],
      );
    const beta = await svc.importProductSheet(admin, file(other()), {
      lineId,
      mode: "booking",
    });
    expect(beta.results.map((r) => [r.name, r.status])).toEqual([
      ["VASO · Beta Vasos", "created"],
    ]);

    const before = await count();
    const again = await svc.importProductSheet(admin, file(repeated()), {
      lineId,
      mode: "booking",
    });
    expect(again.results.map((r) => [r.name, r.status, r.productId])).toEqual(
      first.results.map((r) => [r.name, "updated", r.productId]),
    );
    const betaAgain = await svc.importProductSheet(admin, file(other()), {
      lineId,
      mode: "booking",
    });
    expect(
      betaAgain.results.map((r) => [r.name, r.status, r.productId]),
    ).toEqual([["VASO · Beta Vasos", "updated", beta.results[0].productId]]);
    const after = await count();
    expect(after.products).toBe(before.products);
    expect(after.bookings).toBe(before.bookings);
    // Cada produto ficou com o preço do seu grupo (nenhum sobrescreveu o outro).
    const prices = await Promise.all(
      [...first.results, ...beta.results].map(
        async (r) => (await store.get("products", r.productId!))!.price,
      ),
    );
    expect(prices).toEqual([3, 4, 5, 9]);
  });

  it("falha ao criar a linha do Booking: o produto recém-criado é desfeito (nunca fica à vista do cliente) e reimportar conserta", async () => {
    const store = getStore();
    const bytes = () =>
      sheet(
        ["Gama Copos", "G3-300"],
        [
          { sku: "K1", desc: "COPO BAIXO", price: "1", color: "Azul" },
          { sku: "K2", desc: "COPO ALTO", price: "2", color: "Azul" },
          { sku: "K3", desc: "COPO LARGO", price: "3", color: "Azul" },
        ],
      );
    const original = store.create.bind(store);
    let calls = 0;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (table === "bookings" && ++calls === 2)
          throw new Error("booking down");
        return original(table, data as never);
      });
    let result: Awaited<ReturnType<typeof svc.importProductSheet>>;
    try {
      result = await svc.importProductSheet(admin, file(bytes()), {
        lineId,
        mode: "booking",
      });
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
    expect(result.summary).toMatchObject({
      created: 2,
      updated: 0,
      errors: 1,
      bookingCreated: 2,
    });
    expect(result.results.map((r) => [r.status, r.error])).toEqual([
      ["created", null],
      ["error", "booking_failed"],
      ["created", null],
    ]);
    // O produto que nasceu sem a linha do Booking é desfeito: sem ela ele
    // ficaria no cadastro, à vista do cliente, sem ter sido aprovado.
    expect(result.results[1].productId).toBeNull();
    const named = (await store.list("products")).filter(
      (p) => p.name === "COPO ALTO",
    );
    expect(named).toHaveLength(0);
    const batch = (await store.get("import_batches", result.batchId))!;
    expect(svc.batchDecision(batch.decisions["1"])).toMatchObject({
      status: "error",
      error: "booking_failed",
    });
    // Reimportar: o produto nasce de novo, já com a linha (Novo) e a ficha.
    const before = await count();
    const again = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      mode: "booking",
    });
    expect(again.summary).toMatchObject({
      created: 1,
      updated: 2,
      errors: 0,
      bookingCreated: 1,
      bookingKept: 2,
    });
    const reborn = again.results[1].productId!;
    expect((await store.get("products", reborn))!.price).toBe(2);
    expect((await bookingOf(reborn))!.status).toBe("new");
    expect((await count()).products).toBe(before.products + 1);
  });

  it("tabela do Booking ainda não publicada: recusa com schema_outdated antes de gravar qualquer coisa", async () => {
    const store = getStore();
    const before = await count();
    const original = store.list.bind(store);
    const spy = vi.spyOn(store, "list").mockImplementation((async (
      table: string,
      options: unknown,
    ) => {
      if (table === "bookings")
        throw Object.assign(
          new Error("Table with the requested ID could not be found."),
          { type: "table_not_found" },
        );
      return original(table as never, options as never);
    }) as never);
    try {
      await expect(
        svc.importProductSheet(
          admin,
          file(
            sheet(
              ["Fornecedor Novo Sem Tabela", "Z9-999"],
              [{ sku: "Z1", desc: "SEM TABELA", price: "1", color: "Azul" }],
            ),
          ),
          { lineId, mode: "booking" },
        ),
      ).rejects.toThrow("schema_outdated");
    } finally {
      spy.mockRestore();
    }
    // Nada pela metade: nem produto, nem fornecedor, nem lote, nem arquivo.
    expect(await count()).toEqual(before);
    // Os outros modos não dependem da tabela do Booking.
    const spyAgain = vi.spyOn(store, "list").mockImplementation((async (
      table: string,
      options: unknown,
    ) => {
      if (table === "bookings") throw new Error("não deveria ler bookings");
      return original(table as never, options as never);
    }) as never);
    try {
      const result = await svc.importProductSheet(
        admin,
        file(
          sheet(
            ["Delta Potes", "D4-400"],
            [{ sku: "P1", desc: "POTE", price: "1", color: "Azul" }],
          ),
        ),
        { lineId, mode: "products" },
      );
      expect(result.summary).toMatchObject({ created: 1, errors: 0 });
    } finally {
      spyAgain.mockRestore();
    }
  });

  it("só quem abre a tela Booking manda para o Booking", async () => {
    const before = await count();
    const bytes = () =>
      sheet(
        ["Epsilon Jarras", "E5-500"],
        [{ sku: "J1", desc: "JARRA", price: "1", color: "Azul" }],
      );
    // Operador da Wellmix com Produtos, mas sem a tela Booking.
    await expect(
      svc.importProductSheet(designer, file(bytes()), {
        lineId,
        mode: "booking",
      }),
    ).rejects.toThrow("forbidden");
    // Cliente: nem a importação.
    await expect(
      svc.importProductSheet(joao, file(bytes()), { lineId, mode: "booking" }),
    ).rejects.toThrow("forbidden");
    expect(await count()).toEqual(before);
    // Os outros modos seguem como eram para quem não abre o Booking.
    const result = await svc.importProductSheet(designer, file(bytes()), {
      lineId,
      mode: "products",
    });
    expect(result.summary).toMatchObject({
      created: 1,
      errors: 0,
      bookingCreated: 0,
      bookingKept: 0,
    });
    expect(await bookingOf(result.results[0].productId!)).toBeNull();
  });
});

describe("produto com variações (importação antiga)", () => {
  const bytes = () =>
    sheet(
      ["Zeta Pedras", "P6-600"],
      [
        { sku: "S1", desc: "PEDRA", price: "4", color: "Cinza" },
        { sku: "S2", desc: "MADEIRA", price: "3", color: "Clara" },
      ],
    );

  it("no modo Booking o produto com variações não é casado nem alterado: nasce um produto por linha", async () => {
    const store = getStore();
    // Importação antiga, sem nome base: o produto único leva o nome do 1º grupo.
    const old = await svc.importProductSheet(admin, file(bytes()), { lineId });
    expect(old.results[0]).toMatchObject({ name: "PEDRA", status: "created" });
    const parentId = old.results[0].productId!;
    const parentBefore = (await store.get("products", parentId))!;
    const sheetBefore = await getProductSheet(parentId);
    const variantsBefore = await pv.listProductVariants(parentId, {
      includeInactive: true,
    });
    expect(variantsBefore).toHaveLength(2);

    const before = await count();
    const result = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      mode: "booking",
    });
    // O primeiro grupo tem o mesmo nome do produto com variações e, mesmo assim, é produto novo.
    expect(result.results.map((r) => [r.name, r.status])).toEqual([
      ["PEDRA", "created"],
      ["MADEIRA", "created"],
    ]);
    const ids = result.results.map((r) => r.productId!);
    expect(ids).not.toContain(parentId);
    const after = await count();
    expect(after.products).toBe(before.products + 2);
    expect(after.bookings).toBe(before.bookings + 2);
    // O produto antigo fica exatamente como estava, fora do Booking.
    expect(await store.get("products", parentId)).toEqual(parentBefore);
    expect(await getProductSheet(parentId)).toEqual(sheetBefore);
    expect(
      await pv.listProductVariants(parentId, { includeInactive: true }),
    ).toEqual(variantsBefore);
    expect(await bookingOf(parentId)).toBeNull();
    expect((await pv.variantsByProduct(ids)).size).toBe(0);

    // De novo: os mesmos dois produtos, nunca o de variações.
    const again = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      mode: "booking",
    });
    expect(again.results.map((r) => [r.status, r.productId])).toEqual([
      ["updated", ids[0]],
      ["updated", ids[1]],
    ]);
    expect(await count()).toMatchObject({
      products: after.products,
      bookings: after.bookings,
    });
    expect(await store.get("products", parentId)).toEqual(parentBefore);
  });

  it("produto do Booking que ganhou variações depois continua sendo o mesmo ao reimportar (sem outra linha)", async () => {
    const store = getStore();
    const [inBooking] = (
      await store.list("products", { filter: { name: "MADEIRA" } })
    ).filter((p) => p.lineId === lineId);
    expect(await bookingOf(inBooking.id)).not.toBeNull();
    await pv.upsertProductVariant(admin, inBooking.id, { name: "Grande" });
    const before = await count();
    const result = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      mode: "booking",
    });
    expect(result.results[1]).toMatchObject({
      status: "updated",
      productId: inBooking.id,
    });
    expect(await count()).toMatchObject({
      products: before.products,
      bookings: before.bookings,
    });
  });
});

describe("mandar uma planilha antiga para o Booking (relendo o arquivo guardado)", () => {
  const bytes = () =>
    sheet(
      ["Eta Molduras", "M7-700"],
      [
        { sku: "L1", desc: "LISA", price: "4", color: "Preta" },
        { sku: "L1", desc: "LISA", price: "4", color: "Branca" },
        { sku: "T2", desc: "TRABALHADA", price: "6", color: "Dourada" },
      ],
    );
  let old: ImportBatch;

  it("cria um lote novo no modo Booking com o mesmo arquivo, um produto por linha, sem tocar o produto com variações", async () => {
    const store = getStore();
    const imported = await svc.importProductSheet(
      admin,
      file(bytes(), "antiga.xlsx"),
      { lineId, namePrefix: "Moldura", defaultCurrency: "USD" },
    );
    old = (await store.get("import_batches", imported.batchId))!;
    expect(svc.importBatchMode(old)).toBe("variants");
    expect(old.fileDocumentId).toBeTruthy();
    const parentId = imported.results[0].productId!;
    const parentBefore = (await store.get("products", parentId))!;

    const before = await count();
    const result = await svc.reimportSheetToBooking(admin, old.id);
    expect(result.batchId).not.toBe(old.id);
    expect(result.summary).toMatchObject({
      groups: 2,
      created: 2,
      updated: 0,
      errors: 0,
      bookingCreated: 2,
    });
    expect(result.results.map((r) => [r.name, r.status])).toEqual([
      ["Moldura LISA", "created"],
      ["Moldura TRABALHADA", "created"],
    ]);
    const batch = (await store.get("import_batches", result.batchId))!;
    expect(svc.importBatchMode(batch)).toBe("booking");
    expect(batch).toMatchObject({
      entity: "product_sheets",
      fileDocumentId: old.fileDocumentId,
      fileName: "antiga.xlsx",
      sheetName: old.sheetName,
      createdByUserId: admin.id,
    });
    expect(batch.mapping).toMatchObject({
      __mode: "booking",
      __lineId: lineId,
      __namePrefix: "Moldura",
      __currency: "USD",
    });
    // O arquivo guardado é o mesmo: nada foi enviado de novo nem apagado.
    const after = await count();
    expect(after.documents).toBe(before.documents);
    expect(after.batches).toBe(before.batches + 1);
    expect(after.products).toBe(before.products + 2);
    expect(after.bookings).toBe(before.bookings + 2);
    const doc = (await store.get("documents", old.fileDocumentId!))!;
    expect((await store.getFile(doc.storageKey))!.bytes.length).toBeGreaterThan(
      0,
    );
    const rows = await Promise.all(
      result.results.map((r) => bookingOf(r.productId!)),
    );
    expect(
      rows.map((b) => [
        b!.status,
        b!.importBatchId,
        b!.sourceFileName,
        b!.sourceRows,
        b!.sourceOrder,
        b!.ownerUserId,
      ]),
    ).toEqual([
      ["new", result.batchId, "antiga.xlsx", "2-3", 2, admin.id],
      ["new", result.batchId, "antiga.xlsx", "4", 4, admin.id],
    ]);
    // O produto com variações e o lote antigo ficam como estavam.
    expect(await store.get("products", parentId)).toEqual(parentBefore);
    expect(await pv.listProductVariants(parentId)).toHaveLength(2);
    expect(await bookingOf(parentId)).toBeNull();
    expect(await store.get("import_batches", old.id)).toEqual(old);
  });

  it("mandar de novo não duplica: os produtos que já estão no Booking são atualizados e a etapa fica", async () => {
    const store = getStore();
    const [lisa] = await store.list("products", {
      filter: { name: "Moldura LISA" },
    });
    const row = (await bookingOf(lisa.id))!;
    await store.update("bookings", row.id, { status: "approved" });
    const before = await count();
    const result = await svc.reimportSheetToBooking(admin, old.id);
    expect(result.summary).toMatchObject({
      created: 0,
      updated: 2,
      errors: 0,
      bookingCreated: 0,
      bookingKept: 2,
    });
    expect(result.results[0].productId).toBe(lisa.id);
    const after = await count();
    expect(after.products).toBe(before.products);
    expect(after.bookings).toBe(before.bookings);
    expect(after.documents).toBe(before.documents);
    expect(after.batches).toBe(before.batches + 1);
    expect((await bookingOf(lisa.id))!.status).toBe("approved");
    const batch = (await store.get("import_batches", result.batchId))!;
    expect(batch.fileDocumentId).toBe(old.fileDocumentId);
    expect(svc.importBatchMode(batch)).toBe("booking");
  });

  it("recusa quando o lote não existe, não é de ficha técnica, perdeu o arquivo ou a linha, e para quem não abre o Booking", async () => {
    const store = getStore();
    const copy = (patch: Partial<ImportBatch>) =>
      store.create("import_batches", {
        entity: old.entity,
        fileDocumentId: old.fileDocumentId,
        fileName: old.fileName,
        sheetName: old.sheetName,
        headers: old.headers,
        rows: old.rows,
        mapping: old.mapping,
        decisions: old.decisions,
        status: old.status,
        summary: old.summary,
        rowCount: old.rowCount,
        createdByUserId: old.createdByUserId,
        ...patch,
      });
    const otherEntity = await copy({ entity: "products" });
    const noFile = await copy({ fileDocumentId: null });
    const lostFile = await copy({ fileDocumentId: "documento-que-nao-existe" });
    const lostLine = await copy({
      mapping: { ...old.mapping, __lineId: "linha-apagada" },
    });
    const before = await count();
    await expect(
      svc.reimportSheetToBooking(admin, "lote-que-nao-existe"),
    ).rejects.toThrow("batch_not_found");
    await expect(
      svc.reimportSheetToBooking(admin, otherEntity.id),
    ).rejects.toThrow("batch_not_found");
    await expect(svc.reimportSheetToBooking(admin, noFile.id)).rejects.toThrow(
      "file_gone",
    );
    await expect(
      svc.reimportSheetToBooking(admin, lostFile.id),
    ).rejects.toThrow("file_gone");
    await expect(
      svc.reimportSheetToBooking(admin, lostLine.id),
    ).rejects.toThrow("line_gone");
    await expect(svc.reimportSheetToBooking(designer, old.id)).rejects.toThrow(
      "forbidden",
    );
    await expect(svc.reimportSheetToBooking(joao, old.id)).rejects.toThrow(
      "forbidden",
    );
    expect(await count()).toEqual(before);
  });
});

describe("produto que já estava no cadastro (já na vitrine)", () => {
  it("entra no Booking como Aprovado e continua na vitrine; só o que a planilha criou fica em Novo", async () => {
    const store = getStore();
    const { hiddenBookingProductIds } =
      await import("@/lib/services/booking-visibility");
    // Importada antes do jeito antigo (um produto por linha): já à venda.
    const first = () =>
      sheet(
        ["Delta Vasos", "D7-700"],
        [{ sku: "V1", desc: "VASO REDONDO", price: "6", color: "Azul" }],
      );
    const old = await svc.importProductSheet(admin, file(first()), {
      lineId,
      mode: "products",
    });
    const liveId = old.results[0].productId!;
    expect(await bookingOf(liveId)).toBeNull();
    expect((await hiddenBookingProductIds()).has(liveId)).toBe(false);

    // A planilha nova traz o mesmo produto e um que ainda não existia.
    const result = await svc.importProductSheet(
      admin,
      file(
        sheet(
          ["Delta Vasos", "D7-700"],
          [
            { sku: "V1", desc: "VASO REDONDO", price: "6", color: "Azul" },
            { sku: "V2", desc: "VASO QUADRADO", price: "7", color: "Azul" },
          ],
        ),
      ),
      { lineId, mode: "booking" },
    );
    expect(result.results.map((r) => r.status)).toEqual(["updated", "created"]);
    expect(result.results[0].productId).toBe(liveId);
    const newId = result.results[1].productId!;
    expect((await bookingOf(liveId))!.status).toBe("approved");
    expect((await bookingOf(newId))!.status).toBe("new");
    const hidden = await hiddenBookingProductIds();
    expect(hidden.has(liveId)).toBe(false);
    expect(hidden.has(newId)).toBe(true);
    expect((await store.get("products", liveId))!.active).toBe(true);
  });
});

describe("pesos: o líquido nunca é lido como bruto", () => {
  const bytes = () =>
    sheet(
      ["Teta Pesos", "W8-800"],
      [
        // N.W PC preenchido e G.W PC vazio.
        { sku: "W1", desc: "SO LIQUIDO", price: "2", color: "Azul" },
        // Os dois preenchidos: cada um na sua coluna.
        {
          sku: "W2",
          desc: "LIQUIDO E BRUTO",
          price: "3",
          color: "Azul",
          nw: "0.186",
          gw: "0.2",
        },
      ],
    );

  it("o cabeçalho N.W PC é o peso líquido e G.W PC, o bruto", () => {
    const parsed = svc.parseProductSheet(bytes());
    expect(parsed.columns.netWeightPcKg).toBe(HEADER.indexOf("N.W PC"));
    expect(parsed.columns.grossWeightPcKg).toBe(HEADER.indexOf("G.W PC"));
    const [onlyNet, both] = parsed.groups;
    expect(onlyNet.reading.netWeightPcKg).toBe(0.225);
    expect(onlyNet.reading.grossWeightPcKg).toBeUndefined();
    expect(both.reading).toMatchObject({
      netWeightPcKg: 0.186,
      grossWeightPcKg: 0.2,
    });
  });

  it("peso bruto vazio fica vazio no produto e na ficha mestre (Booking)", async () => {
    const store = getStore();
    const result = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      namePrefix: "Peso",
      mode: "booking",
    });
    expect(result.summary).toMatchObject({ created: 2, errors: 0 });
    const [onlyNet, both] = await Promise.all(
      result.results.map((r) => store.get("products", r.productId!)),
    );
    expect(onlyNet).toMatchObject({ netWeightKg: 0.225, grossWeightKg: null });
    expect(both).toMatchObject({ netWeightKg: 0.186, grossWeightKg: 0.2 });
    const onlyNetSheet = (await getProductSheet(onlyNet!.id))!;
    expect(onlyNetSheet.netWeightPcKg).toBe(0.225);
    expect(onlyNetSheet.grossWeightPcKg ?? null).toBeNull();
    expect(await getProductSheet(both!.id)).toMatchObject({
      netWeightPcKg: 0.186,
      grossWeightPcKg: 0.2,
    });
    // Reimportar não copia o líquido para o bruto.
    await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      namePrefix: "Peso",
      mode: "booking",
    });
    expect(await store.get("products", onlyNet!.id)).toMatchObject({
      netWeightKg: 0.225,
      grossWeightKg: null,
    });
  });

  it("o mesmo nos outros modos: um produto por linha e variações", async () => {
    const store = getStore();
    const products = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      namePrefix: "Peso por linha",
      mode: "products",
    });
    expect(
      await store.get("products", products.results[0].productId!),
    ).toMatchObject({ netWeightKg: 0.225, grossWeightKg: null });
    const variants = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      namePrefix: "Peso com variações",
    });
    const [onlyNet, both] = await pv.listProductVariants(
      variants.results[0].productId!,
    );
    expect(onlyNet).toMatchObject({ netWeightKg: 0.225, grossWeightKg: null });
    expect(both).toMatchObject({ netWeightKg: 0.186, grossWeightKg: 0.2 });
  });
});
