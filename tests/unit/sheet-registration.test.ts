import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Tela do produto unificada (decisão do dono, 11/11/2026): caixa repetida
 * fica só no cadastro; a ficha mestre fica com o que só existe nela. Salvar
 * a ficha sem os campos do cadastro não apaga nada, a ficha nasce com os
 * dados do cadastro e as observações viram um texto só, com a caixa "Vai
 * para o e-commerce".
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const ps = await import("@/lib/services/product-sheet");
const {
  REGISTRATION_SHEET_FIELDS,
  isRegistrationField,
  sheetNotesFromProduct,
  unifiedProductNotes,
} = await import("@/lib/sheet-registration");
const { SHEET_REQUIRED_FIELDS } =
  await import("@/lib/services/purchase-sheet-calc");
const { parseSheet } = await import("@/app/app/actions/sheet-form");
type User = import("@/lib/db").User;

let admin: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("campos que ficam só no cadastro", () => {
  it("os obrigatórios da ficha que sobram nela são FOB/EXW e embalagem", () => {
    expect(
      SHEET_REQUIRED_FIELDS.filter((f) => !isRegistrationField(f)),
    ).toEqual(["incoterm", "packageType"]);
    // O NCM não entrou: continua nos dois lugares até o dono decidir.
    expect(isRegistrationField("ncm")).toBe(false);
    expect(new Set(REGISTRATION_SHEET_FIELDS).size).toBe(
      REGISTRATION_SHEET_FIELDS.length,
    );
  });

  it("formulário da ficha sem esses campos não os altera (ausente = não mexe)", () => {
    const form = new FormData();
    form.set("incoterm", "FOB");
    form.set("packageType", "Color box");
    form.set("supplierStore", "A 154678");
    const { input, invalid } = parseSheet(form);
    expect(invalid).toEqual([]);
    expect(input.incoterm).toBe("FOB");
    for (const key of REGISTRATION_SHEET_FIELDS)
      expect((input as Record<string, unknown>)[key]).toBeUndefined();
  });
});

describe("ficha mestre salva sem os campos do cadastro", () => {
  it("não apaga o cadastro e nasce com os dados dele", async () => {
    const store = getStore();
    const registration = {
      supplierId: "fornecedor-a",
      supplierSku: "JAR-001",
      price: 2.35,
      currency: "USD",
      moq: 1200,
      material: "Vidro e bambu",
      color: "Transparente",
      netWeightKg: 0.45,
      grossWeightKg: 0.52,
      masterBoxQty: 24,
      innerBoxQty: 6,
      boxLengthCm: 60,
      boxWidthCm: 40,
      boxHeightCm: 35,
      cbm: 0.084,
    };
    await store.update("products", "prod-jarra", registration);

    const { sheet, missing } = await ps.saveProductSheet(admin, "prod-jarra", {
      incoterm: "EXW",
      packageType: "Gift box",
    });
    const product = await store.get("products", "prod-jarra");
    expect(product).toMatchObject(registration);
    expect(sheet).toMatchObject({
      incoterm: "EXW",
      packageType: "Gift box",
      supplierName: "Shenzhen Supplier A",
      factoryItemCode: "JAR-001",
      price: 2.35,
      currency: "USD",
      moq: 1200,
      masterCartonQty: 24,
      innerQty: 6,
      netWeightPcKg: 0.45,
      grossWeightPcKg: 0.52,
      cbmPerCarton: 0.084,
      heightCm: 35,
      widthCm: 40,
      lengthCm: 60,
      colorAssortment: "Transparente",
      material: "Vidro e bambu",
    });
    // Só as fotos continuam faltando.
    expect(missing.every((m) => String(m).endsWith("Photo"))).toBe(true);
  });

  it("o cadastro salvo depois é seguido pela ficha mestre", async () => {
    const store = getStore();
    await store.update("products", "prod-jarra", { moq: 2400, price: 2.1 });
    await ps.syncMasterFromProduct("prod-jarra");
    expect(await ps.getProductSheet("prod-jarra")).toMatchObject({
      moq: 2400,
      price: 2.1,
      incoterm: "EXW",
      packageType: "Gift box",
    });
  });
});

describe("observações: um texto só, com a caixa do e-commerce", () => {
  it("antes da primeira gravação junta os três textos, sem repetir nem perder", () => {
    expect(
      unifiedProductNotes(
        { notes: "Frágil" },
        { notes: "Pedir amostra", ecommerceDescription: "Jarra de vidro" },
      ),
    ).toEqual({
      text: "Frágil\n\nPedir amostra\n\nJarra de vidro",
      toEcommerce: false,
    });
    // Texto igual (ou já contido) não entra duas vezes.
    expect(
      unifiedProductNotes(
        { notes: "Jarra de vidro\n\nFrágil" },
        { notes: "Frágil", ecommerceDescription: "Jarra de vidro" },
      ).text,
    ).toBe("Jarra de vidro\n\nFrágil");
    // Só havia a descrição para e-commerce: a caixa já vem marcada.
    expect(
      unifiedProductNotes(
        { notes: null },
        { notes: null, ecommerceDescription: "Jarra de vidro" },
      ),
    ).toEqual({ text: "Jarra de vidro", toEcommerce: true });
    expect(unifiedProductNotes({ notes: null }, null)).toEqual({
      text: "",
      toEcommerce: false,
    });
  });

  it("depois de gravado pelo cadastro vale o texto do produto e a caixa dele", () => {
    expect(
      unifiedProductNotes(
        { notes: "Texto novo", notesToEcommerce: true },
        { notes: "antigo", ecommerceDescription: "antiga" },
      ),
    ).toEqual({ text: "Texto novo", toEcommerce: true });
    expect(
      unifiedProductNotes({ notes: "Interno", notesToEcommerce: false }, null),
    ).toEqual({ text: "Interno", toEcommerce: false });
  });

  it("marcado vira a descrição para e-commerce da ficha; desmarcado, a observação", () => {
    expect(
      sheetNotesFromProduct({ notes: " Jarra ", notesToEcommerce: true }),
    ).toEqual({ ecommerceDescription: "Jarra", notes: null });
    expect(
      sheetNotesFromProduct({ notes: "Interno", notesToEcommerce: false }),
    ).toEqual({ ecommerceDescription: null, notes: "Interno" });
    expect(
      sheetNotesFromProduct({ notes: null, notesToEcommerce: true }),
    ).toEqual({ ecommerceDescription: null, notes: null });
    // Produto ainda não gravado pelo cadastro unificado: a ficha não muda.
    expect(sheetNotesFromProduct({ notes: "Antigo" })).toBeNull();
    expect(
      sheetNotesFromProduct({ notes: "Antigo", notesToEcommerce: null }),
    ).toBeNull();
  });

  it("a ficha mestre acompanha a caixa e não perde o texto antigo antes dela", async () => {
    const store = getStore();
    // Texto antigo na ficha, produto ainda sem a caixa: a ficha fica como está.
    const sheet = (await ps.getProductSheet("prod-jarra"))!;
    await store.update("purchase_sheets", sheet.id, {
      ecommerceDescription: "Descrição antiga",
      notes: "Observação antiga",
    });
    await ps.syncMasterFromProduct("prod-jarra");
    expect(await ps.getProductSheet("prod-jarra")).toMatchObject({
      ecommerceDescription: "Descrição antiga",
      notes: "Observação antiga",
    });
    // Gravado pelo cadastro com a caixa marcada.
    await store.update("products", "prod-jarra", {
      notes: "Jarra de vidro com tampa de bambu",
      notesToEcommerce: true,
    });
    await ps.syncMasterFromProduct("prod-jarra");
    expect(await ps.getProductSheet("prod-jarra")).toMatchObject({
      ecommerceDescription: "Jarra de vidro com tampa de bambu",
      notes: null,
    });
    // Desmarcada: volta a ser só observação.
    await store.update("products", "prod-jarra", { notesToEcommerce: false });
    await ps.syncMasterFromProduct("prod-jarra");
    expect(await ps.getProductSheet("prod-jarra")).toMatchObject({
      ecommerceDescription: null,
      notes: "Jarra de vidro com tampa de bambu",
    });
  });
});
