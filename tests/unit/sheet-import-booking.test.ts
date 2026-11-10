import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";
import { PNG_1X1, xlsxBytes } from "./xlsx-fixture";

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

describe("importação interrompida: produto novo nunca fica à vista sem a linha do Booking", () => {
  const cups = () =>
    sheet(
      ["Sigma Canecas", "S9-900"],
      [
        { sku: "N1", desc: "CANECA LISA", price: "2", color: "Azul" },
        { sku: "N2", desc: "CANECA RISCADA", price: "3", color: "Azul" },
      ],
    );

  it("falha logo depois de criar o produto: ele já tem a linha (Novo, escondido) e reimportar não o aprova", async () => {
    const store = getStore();
    const { hiddenBookingProductIds } =
      await import("@/lib/services/booking-visibility");
    const original = store.create.bind(store);
    let failed = false;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (
          !failed &&
          table === "audit_log" &&
          (data as { action?: string }).action === "product.create"
        ) {
          failed = true;
          throw new Error("audit down");
        }
        return original(table, data as never);
      });
    let result: Awaited<ReturnType<typeof svc.importProductSheet>>;
    try {
      result = await svc.importProductSheet(admin, file(cups()), {
        lineId,
        mode: "booking",
      });
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
    expect(result.results.map((r) => r.status)).toEqual(["error", "created"]);
    const [stub] = (await store.list("products")).filter(
      (p) => p.name === "CANECA LISA",
    );
    // O produto ficou no cadastro, mas com a linha: o cliente não o vê.
    expect(stub).toBeTruthy();
    expect((await bookingOf(stub.id))!.status).toBe("new");
    expect((await hiddenBookingProductIds()).has(stub.id)).toBe(true);
    // Reimportar completa o produto e NÃO o trata como "já estava à venda".
    const again = await svc.importProductSheet(admin, file(cups()), {
      lineId,
      mode: "booking",
    });
    expect(again.results.map((r) => r.status)).toEqual(["updated", "updated"]);
    expect(again.results[0].productId).toBe(stub.id);
    expect((await store.get("products", stub.id))!.price).toBe(2);
    expect((await bookingOf(stub.id))!.status).toBe("new");
    expect((await hiddenBookingProductIds()).has(stub.id)).toBe(true);
  });

  it("a criação do produto falhou: a linha que nasceu antes sai junto (nada fica sem produto)", async () => {
    const store = getStore();
    const bytes = () =>
      sheet(
        ["Tau Pratos", "T2-200"],
        [{ sku: "P1", desc: "PRATO FUNDO", price: "4", color: "Azul" }],
      );
    const original = store.create.bind(store);
    const before = await count();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (table === "products") throw new Error("products down");
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
    expect(result.results[0]).toMatchObject({
      status: "error",
      productId: null,
    });
    expect(result.summary).toMatchObject({ created: 0, bookingCreated: 0 });
    const after = await count();
    expect(after.products).toBe(before.products);
    expect(after.bookings).toBe(before.bookings);
    const again = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      mode: "booking",
    });
    expect(again.results[0].status).toBe("created");
    expect((await bookingOf(again.results[0].productId!))!.status).toBe("new");
  });

  it("linha em Novo sem produto (importação que caiu no meio) é varrida na importação seguinte, depois de 10 minutos", async () => {
    const store = getStore();
    const orphan = await store.create("bookings", {
      productId: "produto-que-nunca-nasceu",
      status: "new",
      importBatchId: "lote-que-nao-terminou",
      sourceFileName: "caiu.xlsx",
      sourceRows: "2",
      sourceOrder: 2,
      customerId: null,
      reservedQty: null,
      ownerUserId: admin.id,
      note: null,
      analysis: null,
      requestId: null,
      requestGroupId: null,
      requestNumber: null,
      statusChangedAt: null,
      statusChangedByUserId: null,
      createdByUserId: admin.id,
    });
    const bytes = () =>
      sheet(
        ["Ômega Potes", "O1-100"],
        [{ sku: "T1", desc: "POTE REDONDO", price: "1", color: "Azul" }],
      );
    // Recém-criada: pode ser de uma importação ainda rodando; fica.
    await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      mode: "booking",
    });
    expect(await store.get("bookings", orphan.id)).not.toBeNull();
    // Onze minutos depois: sai, e as linhas com produto continuam.
    const kept = (await store.list("bookings")).length;
    const clock = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.now() + 11 * 60_000);
    try {
      await svc.importProductSheet(admin, file(bytes()), {
        lineId,
        mode: "booking",
      });
    } finally {
      clock.mockRestore();
    }
    expect(await store.get("bookings", orphan.id)).toBeNull();
    expect((await store.list("bookings")).length).toBe(kept - 1);
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

describe("achados da revisão (segunda leva)", () => {
  /** Planilha com um fornecedor por linha (o `sheet` usa um só para todas). */
  const mixed = (
    lines: Array<Line & { supplier: [name: string, store: string] }>,
  ) =>
    xlsxBytes([
      {
        name: "SUPPLIER INFO",
        cells: [
          HEADER,
          ...lines.map((l) => [
            l.sku,
            l.supplier[0],
            l.supplier[1],
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

  it("planilha antiga relida do arquivo guardado não reescreve o produto que já existe: ele só ganha a linha", async () => {
    const store = getStore();
    const bytes = () =>
      sheet(
        ["Kapa Bandejas", "K4-400"],
        [
          { sku: "B1", desc: "BANDEJA OVAL", price: "4", color: "Preta" },
          { sku: "B2", desc: "BANDEJA RETA", price: "6", color: "Branca" },
        ],
      );
    // Importação antiga, um produto por linha (os produtos já se vendem).
    const old = await svc.importProductSheet(
      admin,
      file(bytes(), "velha.xlsx"),
      {
        lineId,
        mode: "products",
      },
    );
    const [ovalId, retaId] = old.results.map((r) => r.productId!);
    // Meses depois, o cadastro foi corrigido à mão.
    await store.update("products", ovalId, { price: 9.5, moq: 300 });
    const sheetBefore = await getProductSheet(ovalId);
    const ovalBefore = (await store.get("products", ovalId))!;
    const retaBefore = (await store.get("products", retaId))!;
    const photosBefore = (
      await store.list("product_photos", { filter: { productId: ovalId } })
    ).length;

    const result = await svc.reimportSheetToBooking(admin, old.batchId);
    expect(result.results.map((r) => [r.status, r.productId])).toEqual([
      ["updated", ovalId],
      ["updated", retaId],
    ]);
    expect(result.summary).toMatchObject({
      created: 0,
      updated: 2,
      errors: 0,
      bookingCreated: 2,
      bookingKept: 0,
    });
    // Nada do produto mudou: nem o preço corrigido, nem a ficha, nem as fotos.
    expect(await store.get("products", ovalId)).toEqual(ovalBefore);
    expect(await store.get("products", retaId)).toEqual(retaBefore);
    expect(await getProductSheet(ovalId)).toEqual(sheetBefore);
    expect(
      (await store.list("product_photos", { filter: { productId: ovalId } }))
        .length,
    ).toBe(photosBefore);
    // Só a linha do Booking, como Aprovado (continua na vitrine).
    expect((await bookingOf(ovalId))!.status).toBe("approved");
    expect((await bookingOf(retaId))!.status).toBe("approved");
    expect((await hiddenBookingProductIds()).has(ovalId)).toBe(false);
    // O lote diz que nada foi alterado (a tela mostra "Já existia").
    const batch = (await store.get("import_batches", result.batchId))!;
    expect(svc.importBatchKeptExisting(batch)).toBe(true);
    expect(
      svc.importBatchKeptExisting(
        (await store.get("import_batches", old.batchId))!,
      ),
    ).toBe(false);

    // Já a planilha enviada de novo (arquivo novo) atualiza, como sempre.
    const fresh = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      mode: "booking",
    });
    expect(fresh.results[0]).toMatchObject({
      status: "updated",
      productId: ovalId,
    });
    expect((await store.get("products", ovalId))!.price).toBe(4);
    expect(
      svc.importBatchKeptExisting(
        (await store.get("import_batches", fresh.batchId))!,
      ),
    ).toBe(false);
  });

  it("produto excluído (desativado) com o mesmo nome entra como Novo: restaurar não o devolve à vitrine sem aprovação", async () => {
    const store = getStore();
    const bytes = () =>
      sheet(
        ["Lambda Jarras", "L5-500"],
        [{ sku: "J1", desc: "JARRA ALTA", price: "7", color: "Verde" }],
      );
    const old = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      mode: "products",
    });
    const id = old.results[0].productId!;
    await store.update("products", id, { active: false });

    const result = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      mode: "booking",
    });
    expect(result.results[0]).toMatchObject({
      status: "updated",
      productId: id,
    });
    expect((await bookingOf(id))!.status).toBe("new");
    // A importação não restaura o produto; quando restaurado, segue escondido.
    expect((await store.get("products", id))!.active).toBe(false);
    await store.update("products", id, { active: true });
    expect((await hiddenBookingProductIds()).has(id)).toBe(true);
  });

  it("resposta perdida ao criar o produto (ele foi gravado): fica com a linha em Novo, escondido, e reimportar não o aprova", async () => {
    const store = getStore();
    const bytes = () =>
      sheet(
        ["Mi Xícaras", "M6-600"],
        [
          { sku: "X1", desc: "XICARA CURTA", price: "2", color: "Azul" },
          { sku: "X2", desc: "XICARA LONGA", price: "3", color: "Azul" },
        ],
      );
    const original = store.create.bind(store);
    let lost = false;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        const made = await original(table, data as never);
        // O servidor gravou; a resposta se perdeu no caminho.
        if (!lost && table === "products") {
          lost = true;
          throw new TypeError("fetch failed");
        }
        return made;
      });
    const before = await count();
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
    expect(lost).toBe(true);
    // O produto gravado é assumido (não vira erro nem perde a linha).
    expect(result.results.map((r) => r.status)).toEqual(["created", "created"]);
    expect(result.summary).toMatchObject({
      created: 2,
      errors: 0,
      bookingCreated: 2,
    });
    const after = await count();
    expect(after.products).toBe(before.products + 2);
    expect(after.bookings).toBe(before.bookings + 2);
    const id = result.results[0].productId!;
    expect((await store.get("products", id))!.name).toBe("XICARA CURTA");
    expect((await bookingOf(id))!.status).toBe("new");
    expect((await hiddenBookingProductIds()).has(id)).toBe(true);

    const again = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      mode: "booking",
    });
    expect(again.results.map((r) => [r.status, r.productId])).toEqual(
      result.results.map((r) => ["updated", r.productId]),
    );
    expect((await bookingOf(id))!.status).toBe("new");
    expect((await hiddenBookingProductIds()).has(id)).toBe(true);
  });

  it("a linha foi gravada e o registro dela falhou: a linha sai junto (não sobra linha em branco) e reimportar conserta", async () => {
    const store = getStore();
    const bytes = () =>
      sheet(
        ["Ni Bules", "N7-700"],
        [{ sku: "U1", desc: "BULE BAIXO", price: "8", color: "Azul" }],
      );
    const original = store.create.bind(store);
    let failed = false;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (
          !failed &&
          table === "audit_log" &&
          (data as { action?: string }).action === "booking.create"
        ) {
          failed = true;
          throw new Error("audit down");
        }
        return original(table, data as never);
      });
    const before = await count();
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
    expect(failed).toBe(true);
    expect(result.results[0]).toMatchObject({
      status: "error",
      error: "booking_failed",
      productId: null,
    });
    expect(result.summary).toMatchObject({ created: 0, bookingCreated: 0 });
    const after = await count();
    expect(after.products).toBe(before.products);
    expect(after.bookings).toBe(before.bookings);
    const again = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      mode: "booking",
    });
    expect(again.results[0].status).toBe("created");
    expect((await count()).bookings).toBe(before.bookings + 1);
  });

  it("produto por linha que ganhou variação à mão continua sendo o mesmo: entra no Booking, sem duplicar", async () => {
    const bytes = () =>
      sheet(
        ["Xi Cestos", "X8-800"],
        [
          { sku: "C1", desc: "CESTO FUNDO", price: "5", color: "Palha" },
          { sku: "C2", desc: "CESTO RASO", price: "4", color: "Palha" },
        ],
      );
    const old = await svc.importProductSheet(
      admin,
      file(bytes(), "cestos.xlsx"),
      {
        lineId,
        mode: "products",
      },
    );
    const [fundoId, rasoId] = old.results.map((r) => r.productId!);
    // Variação cadastrada à mão na página do produto (sem lote de importação).
    await pv.upsertProductVariant(admin, fundoId, { name: "Grande" });
    await pv.syncProductFromVariants(fundoId, admin);
    expect(await bookingOf(fundoId)).toBeNull();

    const before = await count();
    const result = await svc.reimportSheetToBooking(admin, old.batchId);
    expect(result.results.map((r) => [r.status, r.productId])).toEqual([
      ["updated", fundoId],
      ["updated", rasoId],
    ]);
    const after = await count();
    expect(after.products).toBe(before.products);
    expect(after.bookings).toBe(before.bookings + 2);
    expect((await bookingOf(fundoId))!.status).toBe("approved");
    expect(await pv.listProductVariants(fundoId)).toHaveLength(1);
    // E no modo Booking comum (arquivo novo) também cai no mesmo produto.
    const fresh = await svc.importProductSheet(admin, file(bytes()), {
      lineId,
      mode: "booking",
    });
    expect(fresh.results.map((r) => r.productId)).toEqual([fundoId, rasoId]);
    expect((await count()).products).toBe(before.products);
  });

  it("produto sem fornecedor com o nome de duas linhas de fornecedores diferentes: reimportar dá os mesmos produtos", async () => {
    const store = getStore();
    const [model] = await store.list("products", { filter: { lineId } });
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = model;
    void _id;
    void _c;
    void _u;
    const loose = await store.create("products", {
      ...rest,
      name: "C1 FRAME A4",
      supplierId: null,
      supplierSku: null,
      sku: null,
      active: true,
    });
    const bytes = () =>
      mixed([
        {
          supplier: ["Fabrica Y", "Y1-100"],
          sku: "Y-1",
          desc: "FRAME A4",
          price: "2",
          color: "Preta",
        },
        {
          supplier: ["Fabrica X", "X1-100"],
          sku: "X-9",
          desc: "FRAME A4",
          price: "3",
          color: "Preta",
        },
      ]);
    const options = { lineId, namePrefix: "C1", mode: "booking" as const };
    const first = await svc.importProductSheet(admin, file(bytes()), options);
    expect(first.results.map((r) => r.status)).toEqual(["updated", "created"]);
    expect(first.results[0].productId).toBe(loose.id);
    const before = await count();
    const second = await svc.importProductSheet(admin, file(bytes()), options);
    const third = await svc.importProductSheet(admin, file(bytes()), options);
    // Os mesmos dois produtos, com os mesmos nomes, nas três vezes.
    for (const run of [second, third])
      expect(run.results.map((r) => [r.name, r.status, r.productId])).toEqual(
        first.results.map((r) => [r.name, "updated", r.productId]),
      );
    const after = await count();
    expect(after.products).toBe(before.products);
    expect(after.bookings).toBe(before.bookings);
    // Cada produto ficou com o preço da sua linha.
    expect(
      await Promise.all(
        first.results.map(
          async (r) => (await store.get("products", r.productId!))!.price,
        ),
      ),
    ).toEqual([2, 3]);
  });
});

describe("planilha antiga relida (terceira revisão)", () => {
  it("tentativa que falhou no meio: mandar de novo completa o produto que ficou pela metade, sem reescrever os outros", async () => {
    const store = getStore();
    const bytes = () =>
      sheet(
        ["Pi Lanternas", "P9-900"],
        [
          { sku: "L1", desc: "LANTERNA ALTA", price: "9", color: "Preta" },
          { sku: "L2", desc: "LANTERNA BAIXA", price: "7", color: "Preta" },
        ],
      );
    // Importação antiga, com variações (os produtos por linha ainda não existem).
    const old = await svc.importProductSheet(
      admin,
      file(bytes(), "lanternas.xlsx"),
      { lineId, namePrefix: "Pi" },
    );
    // 1ª tentativa: o produto da 1ª linha nasce e a ficha dele falha.
    const original = store.create.bind(store);
    let failed = false;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (!failed && table === "purchase_sheets") {
          failed = true;
          throw new Error("sheets down");
        }
        return original(table, data as never);
      });
    let first: Awaited<ReturnType<typeof svc.reimportSheetToBooking>>;
    try {
      first = await svc.reimportSheetToBooking(admin, old.batchId);
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
    expect(failed).toBe(true);
    expect(first.results.map((r) => r.status)).toEqual(["error", "created"]);
    // O produto nasceu (com a linha em Novo) e o erro ficou registrado com ele.
    const halfId = first.results[0].productId!;
    expect(halfId).toBeTruthy();
    expect(await getProductSheet(halfId)).toBeNull();
    expect((await bookingOf(halfId))!.status).toBe("new");
    const siblingId = first.results[1].productId!;
    // Enquanto isso, o outro produto foi corrigido à mão.
    await store.update("products", siblingId, { price: 7.5 });

    const before = await count();
    const retry = await svc.reimportSheetToBooking(admin, old.batchId);
    // O que ficou pela metade é completado (conta como criado); o outro fica.
    expect(retry.results.map((r) => [r.status, r.productId])).toEqual([
      ["created", halfId],
      ["updated", siblingId],
    ]);
    expect(retry.summary).toMatchObject({ created: 1, updated: 1, errors: 0 });
    expect((await getProductSheet(halfId))!.price).toBe(9);
    expect((await bookingOf(halfId))!.status).toBe("new");
    expect((await store.get("products", siblingId))!.price).toBe(7.5);
    const after = await count();
    expect(after.products).toBe(before.products);
    expect(after.bookings).toBe(before.bookings);
    // Completo: uma terceira vez não mexe mais nele.
    await store.update("products", halfId, { price: 9.9 });
    const third = await svc.reimportSheetToBooking(admin, old.batchId);
    expect(third.results.map((r) => r.status)).toEqual(["updated", "updated"]);
    expect((await store.get("products", halfId))!.price).toBe(9.9);
  });

  it("lote 'um produto por linha': o produto do lote entra no Booking mesmo renomeado; o apagado de vez nasce de novo, como Novo", async () => {
    const store = getStore();
    const bytes = () =>
      sheet(
        ["Ro Baldes", "R1-100"],
        [
          { sku: "B1", desc: "BALDE ALFA", price: "4", color: "Azul" },
          { sku: "B2", desc: "BALDE BETA", price: "5", color: "Azul" },
          { sku: "B3", desc: "BALDE GAMA", price: "6", color: "Azul" },
        ],
      );
    const old = await svc.importProductSheet(
      admin,
      file(bytes(), "baldes.xlsx"),
      {
        lineId,
        mode: "products",
      },
    );
    const [alfaId, betaId, gamaId] = old.results.map((r) => r.productId!);
    // Desde então: um foi renomeado e outro, apagado de vez.
    await store.update("products", alfaId, {
      name: "Balde grande (linha casa)",
    });
    await store.remove("products", gamaId);
    const alfaBefore = (await store.get("products", alfaId))!;

    const before = await count();
    const result = await svc.reimportSheetToBooking(admin, old.batchId);
    expect(result.results.map((r) => [r.name, r.status, r.productId])).toEqual([
      ["Balde grande (linha casa)", "updated", alfaId],
      ["BALDE BETA", "updated", betaId],
      ["BALDE GAMA", "created", result.results[2].productId],
    ]);
    expect(result.results[2].productId).not.toBe(gamaId);
    // O renomeado continua igual e ganha a linha; nada foi duplicado.
    expect(await store.get("products", alfaId)).toEqual(alfaBefore);
    expect((await bookingOf(alfaId))!.status).toBe("approved");
    expect((await bookingOf(betaId))!.status).toBe("approved");
    expect((await bookingOf(result.results[2].productId!))!.status).toBe("new");
    const after = await count();
    expect(after.products).toBe(before.products + 1);
    expect(after.bookings).toBe(before.bookings + 3);
    // O registro da importação diz que os que existiam não foram alterados.
    const [entry] = await store.list("audit_log", {
      filter: { entity: "import_batch", entityId: result.batchId },
    });
    expect(entry.summary).toContain("2 que já existiam (não alterados");
    expect(entry.summary).not.toContain("atualizados");
    // Mandar de novo não duplica nada.
    const again = await svc.reimportSheetToBooking(admin, old.batchId);
    expect(again.results.map((r) => r.productId)).toEqual(
      result.results.map((r) => r.productId),
    );
    expect((await count()).products).toBe(after.products);
  });
});

describe("planilha antiga relida: a retomada só preenche o que ficou vazio", () => {
  /** Planilha com a coluna PHOTO e uma foto na 1ª linha de produto. */
  const withPhoto = () =>
    xlsxBytes(
      [
        {
          name: "SUPPLIER INFO",
          cells: [
            ["PHOTO", ...HEADER],
            [
              "",
              "F1",
              "Sigma Fotos",
              "S5-500",
              "MOLDURA FOTO",
              "8",
              "12",
              "0.225",
              "",
              "0.0183",
              "Preta",
              "1200",
            ],
            [
              "",
              "F2",
              "Sigma Fotos",
              "S5-500",
              "MOLDURA LISA",
              "6",
              "12",
              "0.225",
              "",
              "0.0183",
              "Preta",
              "1200",
            ],
          ],
        },
      ],
      { images: [{ sheet: 0, col: 0, row: 1, bytes: PNG_1X1, ext: "png" }] },
    );

  it("falha na foto: mandar de novo anexa só a foto que faltou e não reescreve o que foi corrigido à mão", async () => {
    const store = getStore();
    // Importação antiga, com variações (os produtos por linha ainda não existem).
    const old = await svc.importProductSheet(
      admin,
      file(withPhoto(), "fotos.xlsx"),
      { lineId, namePrefix: "Sigma" },
    );
    const photosOf = async (productId: string) =>
      (await store.list("product_photos", { filter: { productId } })).map(
        (p) => p.kind,
      );
    // 1ª tentativa: o produto nasce, a ficha é gravada e a foto falha.
    const original = store.create.bind(store);
    let failed = false;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(store, "create")
      .mockImplementation(async (table, data) => {
        if (!failed && table === "product_photos") {
          failed = true;
          throw new Error("photos down");
        }
        return original(table, data as never);
      });
    let first: Awaited<ReturnType<typeof svc.reimportSheetToBooking>>;
    try {
      first = await svc.reimportSheetToBooking(admin, old.batchId);
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
    expect(failed).toBe(true);
    expect(first.results.map((r) => r.status)).toEqual(["error", "created"]);
    const id = first.results[0].productId!;
    expect(id).toBeTruthy();
    expect(await getProductSheet(id)).not.toBeNull();
    expect(await photosOf(id)).toEqual([]);
    // Enquanto isso, o produto foi corrigido à mão.
    await store.update("products", id, { price: 9.9, moq: 300 });
    const productBefore = (await store.get("products", id))!;
    const sheetBefore = await getProductSheet(id);

    const retry = await svc.reimportSheetToBooking(admin, old.batchId);
    expect(retry.results.map((r) => [r.status, r.productId, r.photos])).toEqual(
      [
        ["updated", id, 1],
        ["updated", first.results[1].productId, 0],
      ],
    );
    expect(retry.summary).toMatchObject({ created: 0, updated: 2, errors: 0 });
    // Só a foto entrou: o cadastro e a ficha continuam como estavam.
    expect(await photosOf(id)).toEqual(["supplier"]);
    expect(await getProductSheet(id)).toEqual(sheetBefore);
    const productAfter = (await store.get("products", id))!;
    expect([productAfter.price, productAfter.moq, productAfter.name]).toEqual([
      productBefore.price,
      productBefore.moq,
      productBefore.name,
    ]);
    expect((await bookingOf(id))!.status).toBe("new");
    // Mais uma vez: nada novo (a foto não repete).
    const third = await svc.reimportSheetToBooking(admin, old.batchId);
    expect(third.results[0]).toMatchObject({ status: "updated", photos: 0 });
    expect(await photosOf(id)).toEqual(["supplier"]);
  });
});
