import { beforeAll, describe, expect, it } from "vitest";
import { setTestFamily } from "./helpers/book-family";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Cadastrar produto (dono, 26/11/2026; docs/PRODUCT_REGISTRATION.md): o
 * catálogo cobre a planilha de cadastro e a tela do Sankhya, o de-para acha
 * as colunas no dicionário, os valores vão no formato do Sankhya e o
 * produto da cotação aprovada é cadastrado no portal pela tela nova.
 */
withTempStore();

const lib = await import("@/lib/product-registration");
const { dictionaries } = await import("@/i18n/dictionaries");
const { flowStepsOf } = await import("@/lib/flow");
const { kindGate } = await import("@/lib/task-owner");
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
const requests = await import("@/lib/services/supplier-requests");
const sampling = await import("@/lib/services/supplier-request-sampling");
const reg = await import("@/lib/services/product-registration");
const { pendingTasksFor } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;

/** Cabeçalho da planilha de cadastro (aba CADASTRO, colunas A a BT). */
const SPREADSHEET = [
  "DESCRIÇÃO INGLÊS",
  "DESCRIÇÃO PORTUGUÊS",
  "DESCRIÇÃO VENDA",
  "NOME DA LINHA",
  "CÓDIGO DO GRUPO",
  "NOME DA MARCA",
  "CÓDIGO FABRICA\n(PRODUTO)",
  "COMPOSIÇÃO",
  "COR SOLICITADA\n(TEXTO)",
  "PANTONE",
  "QTD SORTIMENTO",
  "SORTIMENTO\nCOR\n(S/N)",
  "SORTIMENTO MODELO\n(S/N)",
  "TIPO ALIMENTAÇÃO PRODUTO",
  "TIPO PILHA/ BATERIA PRODUTO",
  "QTD PILHA BATERIA PRODUTO",
  "TIPO ALIMENTAÇÃO ACESSÓRIO",
  "TIPO PILHA/ BATERIA ACESSÓRIO",
  "QTD PILHA/ BATERIA ACESSÓRIO",
  "LAVA-LOUÇAS (S/N)",
  "FORNO\n(S/N)",
  "MICROONDAS (S/N)",
  "CAPACIDADE\n(ML/KG)",
  "PORTO DE EMBARQUE",
  "GERENTE DE PRODUTO",
  "ANATEL\n(S/N)",
  "INMETRO\n(S/N)",
  "ANVISA\n(S/N)",
  "TIPO DE EMBALAGEM",
  "QUANTIDADE DE PEÇAS NA EMBALAGEM",
  "QUANTIDADE DE PEÇAS NO DISPLAY",
  "ALTURA DA PEÇA\n(M)",
  "LARGURA DA PEÇA\n(M)",
  "PROFUNDIDADE DA PEÇA\n(M)",
  "HOTSELL\n(S/N)",
  "COMBATE\n(S/N)",
  "FORNEC. ADRESS/PHONE",
  "FAIXA ETÁRIA\n(NÚMERO)",
  "RODA LIVRE\n(S/N)",
  "A FRICÇÃO\n(S/N)",
  "A CORDA\n(S/N)",
  "BATE E VOLTA\n(S/N)",
  "PRODUTO TEM SOM\n(S/N)",
  "PRODUTO TEM LUZ\n(S/N)",
  "PRODUTO TEM MOVIMENTO\n(S/N)",
  "COM CONTROLE REMOTO\n(S/N)",
  "CÓDIGO FABRICANTE",
  "CÓDIGO PARCEIRO FORNECEDOR PREFERENCIAL",
  "NCM",
  "QUANTIDADE DE PEÇAS  - CAIXA MASTER",
  "ALTURA DA MASTER\n(M)",
  "LARGURA DA MASTER\n(M)",
  "PROFUNDIDADE DA MASTER\n(M)",
  "CBM MASTER\n(M³)",
  "QUANTIDADE DE PEÇAS  - CAIXA INNER",
  "ALTURA DA INNER\n(M)",
  "LARGURA DA INNER\n(M)",
  "PROFUNDIDADE DA INNER\n(M)",
  "CBM INNER\n(M³)",
  "SAZONALIDADE\n(PREENCHER: NATAL,CRIANÇAS)",
  "FORNECEDOR",
  "PESO LÍQUIDO\n(KG)",
  "PESO BRUTO\n(KG)",
  "ALTURA DA EMBALAGEM INDIVIDUAL\n(M)",
  "LARGURA DA EMBALAGEM INDIVIDUAL\n(M)",
  "PROFUNDIDADE  DA EMBALAGEM INDIVIDUAL\n(M)",
  "INFORMAÇÕES ADICIONAIS",
  "CÓDIGO IPI",
  "LEAD TIME DE COMPRA\n(EX: 90)",
  "EMPRESA",
];
/** As duas últimas colunas da planilha são fotos (ficam no portal). */
const PHOTO_COLUMNS = ["FOTO ORIGEM DO PRODUTO", "FOTO DO PRODUTO NA BALANÇA"];

/** Rótulos da tela "Produto" do Sankhya (aba Compras), na ordem da imagem. */
const SANKHYA_SCREEN = [
  "Gerente de Produto",
  "Marca",
  "Marca Wellmix",
  "Grupo",
  "Cód.Linha",
  "Fornec.Adress Phone",
  "Factory Code",
  "País de origem",
  "Descrição Inglês",
  "Unidade padrão",
  "Unid. Compra",
  "Descontinuado",
  "Motivo Descontinuado",
  "Data Descontinuado",
  "Solicita compra?",
  "Permite comprar/vender este produto?",
  "Catálogo Produto",
  "Utiliza data de Fabricação",
  "Utiliza data de Validade",
  "Obrigatório MAPA",
  "Dumping",
  "Obrig. Certif. ANATEL",
  "Obrig. Certif. INMETRO",
  "Produto tem SOM",
  "Produto tem LUZ",
  "Produto tem MOVIMENTO",
  "Situação Embalagem",
  "Layout da Embalagem",
  "Cód. Tipo Embalagem",
  "Cores Disponíveis",
  "Sortimento",
  "Pantone",
  "Qtde de Peças na Embalagem",
  "Qtde de peças no Display",
  "Capacidade Volumétrica",
  "Faixa Etária",
];

const fieldOf = (label: string) => {
  const key = lib.labelKey(label);
  return lib.REGISTRATION_FIELDS.find((f) =>
    f.labels.some((l) => lib.labelKey(l) === key),
  );
};

describe("catálogo de campos", () => {
  it("cada coluna da planilha e cada campo da tela do Sankhya tem um campo, sem repetir", () => {
    expect(SPREADSHEET).toHaveLength(70);
    expect(SPREADSHEET.length + PHOTO_COLUMNS.length).toBe(72);
    const used = new Map<string, string>();
    for (const header of SPREADSHEET) {
      const field = fieldOf(header);
      expect(field, header).toBeDefined();
      // Uma coluna da planilha, um campo.
      expect(used.get(field!.id), header).toBeUndefined();
      used.set(field!.id, header);
    }
    for (const label of SANKHYA_SCREEN)
      expect(fieldOf(label), label).toBeDefined();
    const ids = lib.REGISTRATION_FIELDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo campo e toda seção têm o texto em pt, en e zh", () => {
    for (const lang of ["pt", "en", "zh"] as const) {
      const dict = dictionaries[lang] as Record<string, string>;
      for (const f of lib.REGISTRATION_FIELDS)
        expect(dict[`productRegistration.field.${f.id}`], f.id).toBeTruthy();
      for (const s of lib.REGISTRATION_SECTIONS)
        expect(dict[`productRegistration.section.${s}`], s).toBeTruthy();
      expect(dict["flow.step.new-product.registration"]).toBeTruthy();
    }
  });

  it("a pendência conta no passo Cadastrar produto, para quem abre a tela dele", () => {
    expect(
      flowStepsOf({ kind: "product_registration" }).map(
        (s) => `${s.block}/${s.key}`,
      ),
    ).toEqual(["new-product/registration"]);
    expect(kindGate("product_registration")).toEqual({
      screen: "productRegistration",
    });
  });

  it("a tela nasce para o Comprador, o Gerente de produto e o Cadastro; o designer e Vendas não", async () => {
    const { canOpen } = await import("@/lib/auth/screens");
    const who = (fn: string) =>
      ({ role: "operator", functions: [fn] }) as Parameters<typeof canOpen>[0];
    for (const fn of ["buyer", "product_manager", "catalog"])
      expect(canOpen(who(fn), "productRegistration"), fn).toBe(true);
    for (const fn of ["designer", "sales", "quality"])
      expect(canOpen(who(fn), "productRegistration"), fn).toBe(false);
  });
});

describe("de-para com a TGFPRO", () => {
  const dictionary: import("@/lib/product-registration").ProductDictionary = {
    loadedAt: "2026-11-26T12:00:00.000Z",
    fields: [
      { column: "DESCRPROD", label: "Descrição", type: "S" },
      { column: "REFFORN", label: "Referência do Fornecedor", type: "S" },
      { column: "MARCA", label: "Marca", type: "S" },
      { column: "CODGRUPOPROD", label: "Grupo", type: "I" },
      { column: "CODVOL", label: "Unidade padrão", type: "S" },
      { column: "NCM", label: "NCM", type: "S" },
      { column: "PESOBRUTO", label: "Peso Bruto", type: "F" },
      { column: "AD_GERPROD", label: "Gerente de Produto", type: "S" },
      { column: "AD_FACTORYCODE", label: "Factory Code", type: "S" },
      { column: "AD_INMETRO", label: "Obrig. Certif. INMETRO", type: "S" },
      { column: "AD_SITEMB", label: "Situação Embalagem", type: "S" },
      { column: "AD_DTDESC", label: "Data Descontinuado", type: "D" },
    ],
    options: {
      AD_SITEMB: [
        { value: "1", label: "Nova" },
        { value: "2", label: "Alterações (fonte, cor, foto)" },
      ],
    },
  };

  it("sem dicionário, só as colunas conhecidas", () => {
    const cols = lib.resolveColumns(null);
    expect(cols.descrPt.column).toBe("DESCRPROD");
    expect(cols.lineId.column).toBe("CODGRUPOPROD");
    expect(cols.productManager).toMatchObject({
      column: null,
      source: "none",
    });
  });

  it("com o dicionário, acha os personalizados pela descrição; coluna conhecida ausente não vai", () => {
    const cols = lib.resolveColumns(dictionary);
    expect(cols.productManager).toMatchObject({
      column: "AD_GERPROD",
      source: "dictionary",
    });
    expect(cols.factoryCode.column).toBe("AD_FACTORYCODE");
    expect(cols.inmetro.column).toBe("AD_INMETRO");
    expect(cols.packageStatus.options).toHaveLength(2);
    // CODPAIS não está neste dicionário: não vai (o Sankhya recusaria tudo).
    expect(cols.country).toMatchObject({ column: null, absent: true });
  });

  it("o administrador corrige a coluna ou desliga o campo", () => {
    const cols = lib.resolveColumns(dictionary, {
      productManager: "-",
      descrSale: "DESCRPROD",
      pantone: "AD_GERPROD",
    });
    expect(cols.productManager).toMatchObject({ column: null, source: "off" });
    // DESCRPROD já é da descrição em português: o segundo fica de fora.
    expect(cols.descrSale.column).toBeNull();
    expect(cols.pantone).toMatchObject({
      column: "AD_GERPROD",
      source: "override",
    });
  });

  it("os valores vão no formato do Sankhya; sem coluna, ficam de fora", () => {
    const cols = lib.resolveColumns(dictionary);
    const out = lib.sankhyaPayload(
      {
        descrPt: "Caneca 300 ml",
        supplierRef: "S-1",
        brand: "WELLKIDS",
        lineId: "linha-1",
        unit: "UN",
        ncm: "6912.00.00",
        grossWeight: "0,35",
        productManager: "Wellington",
        inmetro: "S",
        packageStatus: "alteracoes (fonte, cor, foto)",
        discontinuedAt: "2026-12-01",
        pantone: "Azul",
      },
      cols,
      "10902001",
    );
    expect(out.values).toMatchObject({
      DESCRPROD: "Caneca 300 ml",
      REFFORN: "S-1",
      MARCA: "WELLKIDS",
      CODGRUPOPROD: "10902001",
      CODVOL: "UN",
      NCM: "69120000",
      PESOBRUTO: "0.35",
      AD_GERPROD: "Wellington",
      AD_INMETRO: "S",
      AD_SITEMB: "2",
      AD_DTDESC: "01/12/2026",
    });
    expect(out.skipped).toContainEqual({ id: "pantone", reason: "no_column" });
  });

  it("confere números, datas e obrigatórios", () => {
    expect(
      lib.invalidFields({
        grossWeight: "abc",
        masterQty: "1,5",
        height: "0,2",
      }),
    ).toEqual(["grossWeight", "masterQty"]);
    expect(lib.missingRequired({ descrPt: "x" }, "portal")).toEqual(["lineId"]);
    expect(
      lib.missingRequired({ descrPt: "x", lineId: "l" }, "sankhya"),
    ).toEqual(["brand", "supplierRef", "unit"]);
  });

  it("pré-preenche em metros e com as certificações da linha; o portal guarda em cm", () => {
    const values = lib.prefillValues({
      name: "Caneca",
      description: "Mug 300ml",
      factoryCode: "S-1",
      material: "ceramic",
      colors: "azul",
      variation: null,
      capacityMl: 300,
      powerDetail: null,
      packageType: "color box",
      piecesPerPackage: null,
      lengthCm: 10,
      widthCm: 8,
      heightCm: 20,
      netWeightKg: 0.3,
      grossWeightKg: 0.35,
      masterQty: 48,
      masterCbm: 0.12,
      innerQty: 12,
      ncm: "7013.37.00",
      leadTimeDays: 30,
      supplierName: "Shenzhen",
      supplierCode: "123",
      supplierContact: null,
      countryCode: "1",
      countryName: "CHINA",
      portCode: null,
      productManager: "Ana",
      notes: null,
      lineId: "l1",
      certifications: ["INMETRO"],
    });
    expect(values).toMatchObject({
      descrPt: "Caneca",
      descrEn: "Mug 300ml",
      supplierRef: "S-1",
      height: "0,2",
      depth: "0,1",
      grossWeight: "0,35",
      masterQty: "48",
      inmetro: "S",
      anatel: "N",
      unit: "UN",
      requestsPurchase: "S",
      "country:name": "CHINA",
    });
    expect(lib.productPatch(values)).toMatchObject({
      name: "Caneca",
      sku: "S-1",
      heightCm: 20,
      lengthCm: 10,
      grossWeightKg: 0.35,
      masterBoxQty: 48,
      cbm: 0.12,
    });
  });
});

describe("tela Cadastrar produto", () => {
  let admin: User;
  let supplierA: User;

  beforeAll(async () => {
    const { users } = await seedDemo();
    admin = users.find((u) => u.email === "admin@wellmix.com")!;
    supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  });

  const HEADER = [
    "SUPPLIER NAME",
    "DATE",
    "SKU",
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
    "PURCHASE QTY IN PCS",
  ];

  async function approvedWithSample(sku: string) {
    const file = new File(
      [
        xlsxBytes([
          {
            name: "BOOKING",
            cells: [
              HEADER,
              [
                "Shenzhen Supplier A",
                "2026.10.13",
                sku,
                "Registration mug 300ml",
                "FOB",
                "USD",
                "1.10",
                "48",
                "12",
                "0.3",
                "0.35",
                "0.12",
                "10",
                "8",
                "20",
                "300",
                "color box",
                "ceramic",
                "1000",
                "2000",
              ],
            ],
          },
        ]),
      ],
      "b.xlsx",
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );
    const lot = await lots.createBookingLotFromSheet(admin, file);
    const items = await getStore().list("booking_items", {
      filter: { lotId: lot.id },
    });
    const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
    await setBookingItemsNcm(
      admin,
      items.map((i) => i.id),
      "7013.37.00",
    );
    await setTestFamily(lot.id);
    await lots.closeBookingLot(admin, lot.id);
    const request = await requests.openSupplierRequest(admin, {
      itemId: items[0].id,
      alternativeIds: [],
      quantity: null,
      needs: "Logo Wellmix no fundo",
      searchQuery: null,
    });
    await requests.answerSupplierRequest(supplierA, request.id, {
      canDo: "yes",
      price: 1.05,
      currency: "USD",
      moq: 1000,
      leadTimeDays: 45,
      note: null,
    });
    await requests.decideSupplierRequest(admin, request.id, "approved", null);
    return request;
  }

  async function approveSample(id: string) {
    await sampling.addSamplingFile(supplierA, id, {
      file: new File([new Uint8Array([137, 80, 78, 71, 1])], "a.png", {
        type: "image/png",
      }),
      uploadedFileId: null,
    });
    await sampling.submitSampling(supplierA, id, null);
    await sampling.reviewSampling(admin, id, "approve", null);
  }

  it("rascunho antes da amostra; com ela aprovada, cadastra o produto com a ficha e sem Sankhya fica para enviar", async () => {
    const request = await approvedWithSample("REG-1");
    // Antes da amostra: dá para gravar o rascunho, não para cadastrar.
    let ctx = await reg.registrationContext(admin, request.id);
    expect(ctx?.state).toBe("waiting_sample");
    expect(ctx?.values).toMatchObject({
      descrEn: "Registration mug 300ml",
      supplierRef: "REG-1",
      factoryCode: "REG-1",
      leadTime: "45",
      grossWeight: "0,35",
      masterQty: "48",
      ncm: "70133700",
    });
    await reg.saveRegistrationDraft(admin, request.id, {
      ...ctx!.values,
      descrPt: "Caneca Registro 300 ml",
      brand: "WELLMIX",
    });
    expect(
      (await reg.listRegistrations(admin, "open")).find(
        (r) => r.request.id === request.id,
      ),
    ).toMatchObject({
      state: "waiting_sample",
      name: "Caneca Registro 300 ml",
    });
    const line = (
      await getStore().list("product_lines", { filter: { active: true } })
    )[0];
    await expect(
      reg.registerProduct(
        admin,
        request.id,
        { descrPt: "Caneca Registro 300 ml", lineId: line.id },
        [],
      ),
    ).rejects.toThrow("request_product_sampling_pending");

    await approveSample(request.id);
    // Pendência "Cadastrar o produto", no passo do menu.
    expect(
      (await pendingTasksFor(admin)).some(
        (t) =>
          t.kind === "product_registration" &&
          t.link === `/app/product-registration/${request.id}`,
      ),
    ).toBe(true);
    ctx = await reg.registrationContext(admin, request.id);
    expect(ctx?.state).toBe("to_register");
    // O rascunho volta na tela.
    expect(ctx?.values.descrPt).toBe("Caneca Registro 300 ml");
    // Sem a linha: recusa apontando o campo.
    await expect(
      reg.registerProduct(admin, request.id, { descrPt: "X caneca" }, []),
    ).rejects.toMatchObject({
      message: "registration_required",
      fields: ["f.lineId"],
    });
    const result = await reg.registerProduct(
      admin,
      request.id,
      {
        ...ctx!.values,
        lineId: line.id,
        height: "0,25",
        masterCbm: "0,15",
        pantone: "Pantone 286 C",
      },
      [],
    );
    // Sem a credencial do Sankhya (teste): gravado no portal, sem envio.
    expect(result.send).toBe("off");
    const product = await getStore().get("products", result.product.id);
    expect(product).toMatchObject({
      name: "Caneca Registro 300 ml",
      sku: "REG-1",
      brand: "WELLMIX",
      heightCm: 25,
      cbm: 0.15,
      pantone: "Pantone 286 C",
    });
    const saved = await getStore().get("supplier_requests", request.id);
    expect(saved?.productId).toBe(product!.id);
    expect(saved?.registration).toMatchObject({
      sendStatus: "off",
      sendDetail: "not_configured",
    });
    // Sem pendência e na lista "A cadastrar" como "Falta o Sankhya".
    expect(
      (await pendingTasksFor(admin)).some(
        (t) => t.kind === "product_registration" && t.link.includes(request.id),
      ),
    ).toBe(false);
    expect(
      (await reg.listRegistrations(admin, "open")).find(
        (r) => r.request.id === request.id,
      )?.state,
    ).toBe("to_send");
    // Reenviar grava o formulário no produto.
    await reg.sendRegistration(admin, request.id, {
      ...saved!.registration!.values,
      grossWeight: "0,4",
    });
    expect((await getStore().get("products", product!.id))?.grossWeightKg).toBe(
      0.4,
    );
  });

  it("só a Wellmix com a tela Produtos; o de-para é do administrador", async () => {
    const request = await approvedWithSample("REG-2");
    await expect(
      reg.registrationContext(supplierA, request.id),
    ).rejects.toThrow();
    const users = await getStore().list("users");
    const operator = users.find(
      (u) => u.role === "operator" && u.active !== false,
    );
    if (operator)
      await expect(
        reg.saveFieldOverrides(operator, { brand: "MARCA" }),
      ).rejects.toThrow();
    await reg.saveFieldOverrides(admin, { brand: "marca", pantone: "-" });
    expect(await reg.readFieldOverrides()).toEqual({
      brand: "MARCA",
      pantone: "-",
    });
    await expect(
      reg.saveFieldOverrides(admin, { brand: "1 errado" }),
    ).rejects.toMatchObject({ message: "registration_column_invalid" });
  });
});
