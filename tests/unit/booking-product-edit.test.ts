import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Booking (docs/BOOKING.md), "Editar dados dos produtos": os dados do
 * produto mudados direto na tabela gravam no cadastro e na ficha mestre
 * (o mesmo caminho da página do produto), só o que mudou, só para quem
 * abre Booking e Produtos, e um valor ilegível recusa o envio inteiro.
 */
const h = vi.hoisted(() => ({
  current: null as unknown,
  redirects: [] as string[],
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirects.push(to);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.current,
}));
vi.mock("@/i18n/server", async () => {
  const { translator } = await import("@/i18n");
  return { getT: async () => translator("pt") };
});

withTempStore();

const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { ensureBookingForProduct } =
  await import("@/lib/services/booking-intake");
const { saveProductSheet, getProductSheet } =
  await import("@/lib/services/product-sheet");
const { listBookingRows } = await import("@/lib/services/booking");
const { superplanPrefillsFor } =
  await import("@/lib/services/superplan-analysis");
const { saveBookingProductsAction, setBookingProductFieldAction } =
  await import("@/app/app/actions/booking");
type User = import("@/lib/db").User;

let admin: User;
let onlyBooking: User;
let lineId: string;
let seq = 0;

const last = () => h.redirects.at(-1) ?? "";
const query = (url: string) => new URL(url, "http://x").searchParams;

async function row() {
  seq++;
  const product = await getStore().create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId,
    name: `Moldura ${seq}`,
    sku: null,
    specification: null,
    active: true,
    source: "import",
  } as never);
  await saveProductSheet(admin, product.id, {
    factoryItemCode: `E4-${seq}`,
    price: 4,
    currency: "USD",
    moq: 2400,
    masterCartonQty: 12,
    netWeightPcKg: 0.225,
    cbmPerCarton: 0.0183,
    colorAssortment: "WHITE / GREY",
    material: "PS",
  });
  const { booking } = await ensureBookingForProduct(admin, {
    productId: product.id,
    importBatchId: "lote-1",
    sourceFileName: "feira.xls",
    sourceRows: String(seq),
    sourceOrder: seq,
  });
  return { booking, product };
}

function edit(fields: Record<string, string>, back = "/app/booking?edit=1") {
  const form = new FormData();
  form.set("back", back);
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  const rest: Partial<User> = { ...admin };
  delete rest.id;
  delete rest.createdAt;
  delete rest.updatedAt;
  onlyBooking = await getStore().create("users", {
    ...(rest as Omit<User, "id" | "createdAt" | "updatedAt">),
    email: "so-booking@wellmix.com",
    name: "Só Booking",
    role: "operator",
    functions: [],
    screens: ["booking"],
  });
  lineId = (await getStore().list("product_lines", { limit: 1 }))[0].id;
});

describe("peso médio por peça (o terceiro peso)", () => {
  it("grava pela tabela do Booking, aparece na linha e no Superplan e pode ser apagado", async () => {
    const a = await row();
    h.current = admin;
    await saveBookingProductsAction(
      edit({ [`d.${a.product.id}.averageWeightPcKg`]: "0,27" }),
    );
    expect(last()).toBe("/app/booking?edit=1&edited=1");
    expect((await getProductSheet(a.product.id))!.averageWeightPcKg).toBe(0.27);
    const line = (await listBookingRows(admin)).rows.find(
      (r) => r.id === a.booking.id,
    )!;
    // Um peso a mais: o líquido e o bruto ficam como estavam.
    expect([
      line.averageWeightKg,
      line.netWeightKg,
      line.grossWeightKg,
    ]).toEqual([0.27, 0.225, null]);
    expect(
      (await superplanPrefillsFor([a.product.id])).get(a.product.id)!
        .averageWeightKg,
    ).toBe(0.27);
    // Apagar o campo apaga o peso médio.
    await saveBookingProductsAction(
      edit({ [`d.${a.product.id}.averageWeightPcKg`]: "" }),
    );
    expect(
      (await getProductSheet(a.product.id))!.averageWeightPcKg ?? null,
    ).toBeNull();
  });

  it("vazio numa ficha que nunca teve peso médio não vai ao banco (esquema ainda não publicado)", async () => {
    const { dropUnsavedEmptyOptional } =
      await import("@/lib/services/purchase-sheet");
    const patch: Record<string, unknown> = {
      averageWeightPcKg: null,
      averagePrice: undefined,
      price: null,
    };
    dropUnsavedEmptyOptional(patch, { averagePrice: null });
    // As colunas antigas seguem como vieram; as novas vazias saem.
    expect(patch).toEqual({ price: null });
    const clearing: Record<string, unknown> = { averageWeightPcKg: null };
    dropUnsavedEmptyOptional(clearing, { averageWeightPcKg: 0.3 });
    expect(clearing).toEqual({ averageWeightPcKg: null });
  });
});

describe("editar dados dos produtos no Booking", () => {
  it("grava no cadastro e na ficha mestre, e a linha e o Superplan mostram o novo valor", async () => {
    const a = await row();
    const b = await row();
    const supplier = (
      await getStore().list("parties", { filter: { type: "supplier" } })
    )[0];
    h.current = admin;
    await saveBookingProductsAction(
      edit({
        [`d.${a.product.id}.name`]: "Moldura Mármore A4",
        [`d.${a.product.id}.price`]: "3,85",
        [`d.${a.product.id}.currency`]: "RMB",
        [`d.${a.product.id}.moq`]: "1.200",
        [`d.${a.product.id}.masterCartonQty`]: "24",
        [`d.${a.product.id}.innerQty`]: "6",
        [`d.${a.product.id}.netWeightPcKg`]: "0,31",
        [`d.${a.product.id}.grossWeightPcKg`]: "0,4",
        [`d.${a.product.id}.cbmPerCarton`]: "0,05",
        [`d.${a.product.id}.averagePrice`]: "2,9",
        [`d.${a.product.id}.factoryItemCode`]: "SM-A4",
        [`d.${a.product.id}.location`]: "Yiwu",
        [`d.${a.product.id}.supplierStore`]: "B2-301",
        [`d.${a.product.id}.sheetDate`]: "2026-11-01",
        [`d.${a.product.id}.colorAssortment`]: "BLACK",
        [`d.${a.product.id}.material`]: "MDF",
        [`d.${a.product.id}.packageType`]: "Caixa kraft",
        [`d.${a.product.id}.pieceLengthCm`]: "33,5",
        [`d.${a.product.id}.pieceWidthCm`]: "24,8",
        [`d.${a.product.id}.pieceHeightCm`]: "1,5",
        [`d.${b.product.id}.supplierId`]: supplier.id,
      }),
    );
    expect(last()).toBe("/app/booking?edit=1&edited=2");
    const p = (await getStore().get("products", a.product.id))!;
    expect([
      p.name,
      p.price,
      p.currency,
      p.moq,
      p.masterBoxQty,
      p.innerBoxQty,
      p.netWeightKg,
      p.grossWeightKg,
      p.cbm,
      p.supplierSku,
      p.material,
      p.lengthCm,
      p.widthCm,
      p.heightCm,
    ]).toEqual([
      "Moldura Mármore A4",
      3.85,
      "CNY",
      1200,
      24,
      6,
      0.31,
      0.4,
      0.05,
      "SM-A4",
      "MDF",
      33.5,
      24.8,
      1.5,
    ]);
    const sheet = (await getProductSheet(a.product.id))!;
    expect([
      sheet.price,
      sheet.currency,
      sheet.moq,
      sheet.averagePrice,
      sheet.location,
      sheet.supplierStore,
      sheet.packageType,
      sheet.colorAssortment,
      sheet.sheetDate?.slice(0, 10),
    ]).toEqual([
      3.85,
      "RMB",
      1200,
      2.9,
      "Yiwu",
      "B2-301",
      "Caixa kraft",
      "BLACK",
      "2026-11-01",
    ]);
    // A linha do Booking e o Superplan leem o mesmo.
    const line = (await listBookingRows(admin)).rows.find(
      (r) => r.id === a.booking.id,
    )!;
    expect([line.name, line.price, line.currency, line.masterQty]).toEqual([
      "Moldura Mármore A4",
      3.85,
      "RMB",
      24,
    ]);
    const prefill = (await superplanPrefillsFor([a.product.id])).get(
      a.product.id,
    )!;
    expect([prefill.unitPrice, prefill.currency, prefill.pcsPerCarton]).toEqual(
      [3.85, "RMB", 24],
    );
    // Fornecedor trocado como no cadastro (principal novo).
    expect((await getStore().get("products", b.product.id))!.supplierId).toBe(
      supplier.id,
    );
    // Só o que mudou: o produto b manteve o preço.
    expect((await getStore().get("products", b.product.id))!.price).toBe(4);
  });

  it("valor ilegível recusa o envio inteiro, apontando a linha; nada é gravado", async () => {
    const a = await row();
    const b = await row();
    h.current = admin;
    await saveBookingProductsAction(
      edit({
        [`d.${a.product.id}.price`]: "9",
        [`d.${b.product.id}.moq`]: "muitos",
      }),
    );
    const q = query(last());
    expect([q.get("error"), q.get("row")]).toEqual([
      "booking_data_invalid",
      b.booking.id,
    ]);
    expect((await getStore().get("products", a.product.id))!.price).toBe(4);
    // Nome curto demais também.
    await saveBookingProductsAction(edit({ [`d.${a.product.id}.name`]: "x" }));
    expect(query(last()).get("error")).toBe("booking_data_invalid");
    expect((await getStore().get("products", a.product.id))!.name).not.toBe(
      "x",
    );
  });

  it("só quem abre Booking e Produtos; produto fora do Booking não é editado por aqui", async () => {
    const a = await row();
    h.current = onlyBooking;
    await saveBookingProductsAction(edit({ [`d.${a.product.id}.price`]: "9" }));
    expect(query(last()).get("error")).toBe("forbidden");
    expect((await getStore().get("products", a.product.id))!.price).toBe(4);
    // Produto sem linha no Booking.
    const loose = await getStore().create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      lineId,
      name: "Fora do Booking",
      sku: null,
      specification: null,
      active: true,
      source: "manual",
      price: 7,
    } as never);
    h.current = admin;
    await saveBookingProductsAction(edit({ [`d.${loose.id}.price`]: "1" }));
    expect(query(last()).get("error")).toBe("booking_not_found");
    expect((await getStore().get("products", loose.id))!.price).toBe(7);
    // Endereço de volta de fora do Booking não passa.
    await saveBookingProductsAction(
      edit({ [`d.${a.product.id}.price`]: "5" }, "https://fora.example/x"),
    );
    expect(last()).toBe("/app/booking?edited=1");
  });

  it("textos novos nas três línguas", async () => {
    const { translator } = await import("@/i18n");
    for (const lang of ["pt", "en", "zh"] as const) {
      const tr = translator(lang);
      for (const key of [
        "booking.edit.start",
        "booking.edit.save",
        "booking.edit.hint",
        "booking.done.edited",
        "booking.error.booking_data_invalid",
      ] as const)
        expect(tr(key)).not.toBe(key);
    }
  });
});

describe("dados do produto direto na célula da tabela (grava sozinho)", () => {
  it("cada campo grava o seu, sem redirecionar: ficha mestre, cadastro, medidas, plano e fornecedor", async () => {
    const a = await row();
    h.current = admin;
    const before = h.redirects.length;
    const set = (field: string, value: string) =>
      setBookingProductFieldAction(a.product.id, field, value);
    for (const [field, value] of [
      ["price", "5,5"],
      ["currency", "RMB"],
      ["moq", "1.200"],
      ["averageWeightPcKg", "0,2"],
      ["pieceLengthCm", "21"],
      ["pieceWidthCm", "29,7"],
      ["name", "  Moldura nova  "],
      ["plannedQty", "3000"],
      ["colorAssortment", "BLACK"],
    ] as const)
      expect(await set(field, value), field).toEqual({ ok: true });
    expect(h.redirects.length).toBe(before);
    const sheet = (await getProductSheet(a.product.id))!;
    expect([
      sheet.price,
      sheet.currency,
      sheet.moq,
      sheet.averageWeightPcKg,
      sheet.colorAssortment,
      // O que não foi mexido fica como estava.
      sheet.masterCartonQty,
      sheet.netWeightPcKg,
      sheet.material,
    ]).toEqual([5.5, "RMB", 1200, 0.2, "BLACK", 12, 0.225, "PS"]);
    const product = (await getStore().get("products", a.product.id))!;
    expect([
      product.name,
      product.lengthCm,
      product.widthCm,
      product.price,
    ]).toEqual(["Moldura nova", 21, 29.7, 5.5]);
    expect(
      (await getStore().get("bookings", a.booking.id))!.plan?.plannedQty,
    ).toBe(3000);
    // Vazio apaga o campo (e só ele).
    expect(await set("averageWeightPcKg", "")).toEqual({ ok: true });
    expect(
      (await getProductSheet(a.product.id))!.averageWeightPcKg ?? null,
    ).toBeNull();
    // Fornecedor: a troca do principal, como no cadastro.
    const supplier = (
      await getStore().list("parties", { filter: { type: "supplier" } })
    )[0];
    expect(await set("supplierId", supplier.id)).toEqual({ ok: true });
    expect((await getStore().get("products", a.product.id))!.supplierId).toBe(
      supplier.id,
    );
  });

  it("recusa com o texto da célula e nada muda: valor ilegível, campo que não existe, nome curto, fornecedor inválido", async () => {
    const a = await row();
    h.current = admin;
    const set = (field: string, value: string) =>
      setBookingProductFieldAction(a.product.id, field, value);
    const unreadable = await set("price", "abc");
    expect(unreadable).toEqual({
      ok: false,
      message:
        "Não deu para ler este valor (número, data ou nome com menos de 2 letras). Nada foi gravado.",
    });
    for (const [field, value] of [
      ["moq", "dez"],
      ["name", "x"],
      ["supplierId", "nao-existe"],
      ["pieceLengthCm", "-3"],
      ["plannedQty", "1,5"],
      // Campos fora da lista (colunas do produto que a tabela não edita).
      ["active", "false"],
      ["supplierUnitPrice", "1"],
      ["id", "outro"],
    ] as const)
      expect((await set(field, value)).ok, field).toBe(false);
    const sheet = (await getProductSheet(a.product.id))!;
    expect([sheet.price, sheet.moq]).toEqual([4, 2400]);
    const product = (await getStore().get("products", a.product.id))!;
    expect([product.name, product.active, product.lengthCm ?? null]).toEqual([
      a.product.name,
      true,
      null,
    ]);
  });

  it("só quem abre Booking e Produtos; produto fora do Booking não é editado por aqui", async () => {
    const a = await row();
    h.current = onlyBooking;
    expect(
      await setBookingProductFieldAction(a.product.id, "price", "9"),
    ).toEqual({
      ok: false,
      message: "Você não tem permissão para esta ação.",
    });
    expect((await getStore().get("products", a.product.id))!.price).toBe(4);
    const loose = await getStore().create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      lineId,
      name: "Fora do Booking 2",
      sku: null,
      specification: null,
      active: true,
      source: "manual",
      price: 7,
    } as never);
    h.current = admin;
    expect(
      (await setBookingProductFieldAction(loose.id, "price", "1")).ok,
    ).toBe(false);
    expect((await getStore().get("products", loose.id))!.price).toBe(7);
  });

  it("textos novos nas três línguas", async () => {
    const { translator } = await import("@/i18n");
    for (const lang of ["pt", "en", "zh"] as const) {
      const tr = translator(lang);
      for (const key of [
        "booking.row.autosave",
        "booking.row.invalid",
        "booking.row.saving",
        "booking.row.saved",
        "booking.row.failed",
        "booking.row.customer",
      ] as const)
        expect(tr(key)).not.toBe(key);
    }
  });
});
