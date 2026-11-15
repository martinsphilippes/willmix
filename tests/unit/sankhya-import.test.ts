import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Carga da amostra do Sankhya no portal: pedidos normais com a etapa da TOP,
 * valores em R$, cadastros reaproveitados (código, CNPJ, SKU, nome) e nada
 * duplicado ao rodar de novo.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { importSankhyaSet } = await import("@/lib/integrations/sankhya-import");
type User = import("@/lib/db").User;
type ImportSet = import("@/lib/integrations/sankhya-sample").ImportSet;

let admin: User;
beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

const set: ImportSet = {
  orders: [
    {
      NUNOTA: 900,
      CODEMP: 1,
      CODTIPOPER: 1107,
      CODPARC: 11,
      DTNEG: "10/11/2026",
      VLRNOTA: 1500.5,
      OBSERVACAO: "Container 1",
    },
    {
      NUNOTA: 899,
      CODEMP: 1,
      CODTIPOPER: 1403,
      CODPARC: 11,
      DTNEG: "01/10/2026",
      VLRNOTA: 300,
    },
    {
      NUNOTA: 898,
      CODEMP: 1,
      CODTIPOPER: 1002,
      CODPARC: 12,
      DTNEG: "01/10/2026",
      VLRNOTA: 10,
    },
  ],
  partners: [
    {
      CODPARC: 11,
      NOMEPARC: "Ningbo Ceramics",
      CGC_CPF: null,
      FORNECEDOR: "S",
      CLIENTE: "N",
      ATIVO: "S",
    },
    {
      CODPARC: 12,
      NOMEPARC: "Outro",
      FORNECEDOR: "S",
      CLIENTE: "N",
      ATIVO: "S",
    },
  ],
  items: [
    {
      NUNOTA: 900,
      SEQUENCIA: 1,
      CODPROD: 50,
      DESCRPROD: "CANECA CERAMICA 300ML",
      QTDNEG: 1200,
      CODVOL: "UN",
      VLRUNIT: 1.25,
    },
    {
      NUNOTA: 900,
      SEQUENCIA: 2,
      CODPROD: 51,
      DESCRPROD: "PRATO RASO",
      QTDNEG: 600,
      CODVOL: "UN",
      VLRUNIT: 2,
    },
    {
      NUNOTA: 899,
      SEQUENCIA: 1,
      CODPROD: 50,
      DESCRPROD: "CANECA CERAMICA 300ML",
      QTDNEG: 100,
      CODVOL: "UN",
      VLRUNIT: 3,
    },
  ],
  products: [
    {
      CODPROD: 50,
      DESCRPROD: "CANECA CERAMICA 300ML",
      REFFORN: "WX7588",
      CODGRUPOPROD: 160201001,
      NCM: "6912.00.00",
      ALTURA: 0.082,
      PESOBRUTO: 0.322,
      ATIVO: "S",
    },
    {
      CODPROD: 51,
      DESCRPROD: "PRATO RASO",
      REFFORN: null,
      CODGRUPOPROD: null,
      ATIVO: "S",
    },
  ],
  groups: [{ CODGRUPOPROD: 160201001, DESCRGRUPOPROD: "CANECA", ATIVO: "S" }],
  financial: [
    {
      NUFIN: 7001,
      NUNOTA: 900,
      RECDESP: -1,
      VLRDESDOB: 450,
      DTVENC: "20/11/2026",
      DHBAIXA: null,
      HISTORICO: "Sinal",
    },
    {
      NUFIN: 7002,
      NUNOTA: 899,
      RECDESP: -1,
      VLRDESDOB: 300,
      DHBAIXA: "05/10/2026",
    },
    { NUFIN: 7003, NUNOTA: 898, RECDESP: -1, VLRDESDOB: 10 },
  ],
  companies: [{ CODEMP: 1, NOMEFANTASIA: "WELLMIX - MTZ" }],
};

describe("carga da amostra do Sankhya", () => {
  it("grava pedidos com a etapa da TOP, em R$, com cadastros e financeiro", async () => {
    const store = getStore();
    // Produto que já existe no portal com o mesmo código WX: só ganha o vínculo.
    const [line] = await store.list("product_lines", { limit: 1 });
    const existing = await store.create("products", {
      lineId: line.id,
      name: "Caneca do catálogo",
      sku: "WX7588",
      specification: null,
      active: true,
      supplierId: null,
      supplierSku: null,
      category: null,
      material: null,
      color: null,
      pantone: null,
      moq: null,
      price: null,
      currency: null,
      masterBoxQty: null,
      innerBoxQty: null,
      netWeightKg: null,
      grossWeightKg: null,
      widthCm: null,
      heightCm: null,
      lengthCm: null,
      boxLengthCm: null,
      boxWidthCm: null,
      boxHeightCm: null,
      cbm: null,
      notes: null,
      source: "manual",
      negotiatedAt: null,
      sourcingItemId: null,
      primaryPhotoDocumentId: null,
      ncm: null,
      priceTiers: null,
    });

    const lines = await importSankhyaSet(admin, set);
    const of = (entity: string, code: string) =>
      lines.find((l) => l.entity === entity && l.code === code)!;

    expect(of("products", "50")).toMatchObject({
      outcome: "linked",
      id: existing.id,
    });
    expect((await store.get("products", existing.id))?.sankhyaCode).toBe("50");
    // Produto sem grupo vai para a linha "Importados do Sankhya".
    const plate = await store.get("products", of("products", "51").id!);
    const plateLine = await store.get("product_lines", plate!.lineId);
    expect(plateLine?.name).toBe("Importados do Sankhya");
    expect(of("productGroups", "160201001").outcome).toBe("created");
    expect(of("companies", "EMP-1")).toMatchObject({
      outcome: "created",
      label: "WELLMIX - MTZ",
    });

    // NUNOTA 900, TOP 1107 (EMBARCADO) → desembaraço ativo, etapas antes concluídas.
    const order = await store.get("orders", of("orders", "900").id!);
    expect(order).toMatchObject({
      erpNumber: "900",
      erpSyncStatus: "synced",
      status: "CUSTOMS",
      fobTotal: 1500.5,
      fobCurrency: "BRL",
      closedAt: null,
    });
    const supplier = await store.get("parties", order!.supplierId);
    expect(supplier).toMatchObject({
      name: "Ningbo Ceramics",
      type: "supplier",
      sankhyaCode: "11",
    });
    const customer = await store.get("parties", order!.customerId);
    expect(customer?.type).toBe("customer");
    const items = await store.list("order_items", {
      filter: { orderId: order!.id },
    });
    expect(items.map((i) => [i.name, i.quantity, i.unitPrice])).toEqual(
      expect.arrayContaining([
        ["CANECA CERAMICA 300ML", 1200, 1.25],
        ["PRATO RASO", 600, 2],
      ]),
    );
    const stages = (
      await store.list("stages", { filter: { orderId: order!.id } })
    ).sort((a, b) => a.sequence - b.sequence);
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s.status]));
    expect(byKey).toMatchObject({
      ORDER_CREATED: "done",
      SHIPPING: "done",
      CUSTOMS: "active",
      TRANSPORT: "pending",
    });
    expect(order!.currentStageId).toBe(
      stages.find((s) => s.key === "CUSTOMS")!.id,
    );
    const request = await store.get("requests", order!.requestId);
    expect(request).toMatchObject({ status: "ORDERED", orderId: order!.id });
    // Fase 5d (advanceMilestones): TOP → marco (1107 → Desembaraço). Os
    // itens dos marcos antes dele ficam feitos, os do marco da TOP abertos;
    // os marcos gravados acompanham a espera do pedido, sem aviso nem evento.
    const { milestoneRank } = await import("@/lib/milestones");
    const { topMilestone } = await import("@/lib/integrations/sankhya-mapping");
    expect(topMilestone(1107)).toBe("customs");
    const reqs = await store.list("requirements", {
      filter: { orderId: order!.id },
    });
    expect(
      reqs
        .filter(
          (r) =>
            r.milestoneKey &&
            milestoneRank(r.milestoneKey as never) < milestoneRank("customs"),
        )
        .every((r) => r.status === "done"),
    ).toBe(true);
    expect(
      reqs.some((r) => r.milestoneKey === "customs" && r.status === "pending"),
    ).toBe(true);
    const rows = await store.list("order_milestones", {
      filter: { orderId: order!.id },
    });
    expect(rows.find((r) => r.key === "customs")?.status).toBe("active");
    expect(
      rows.every((r) => (r.held === true) === (order!.held === true)),
    ).toBe(true);
    const { flushMilestoneSync } =
      await import("@/lib/services/order-milestones");
    await flushMilestoneSync();
    expect(
      (await store.list("notifications")).filter((n) =>
        n.link?.includes(order!.id),
      ),
    ).toEqual([]);
    expect(
      (
        await store.list("audit_log", {
          filter: { entity: "order", entityId: order!.id },
        })
      ).filter((a) => a.action.startsWith("milestone.")),
    ).toEqual([]);

    // TOP 1403 (FINALIZADO) → pedido encerrado, tudo concluído.
    const closed = await store.get("orders", of("orders", "899").id!);
    expect(closed?.closedAt).toBeTruthy();
    const closedStages = await store.list("stages", {
      filter: { orderId: closed!.id },
    });
    expect(closedStages.every((s) => s.status === "done")).toBe(true);

    // TOP 1002 (cotação) não vira pedido; o título dela também fica de fora.
    expect(of("orders", "898")).toMatchObject({ outcome: "skipped" });
    expect(of("financial", "7003")).toMatchObject({ outcome: "skipped" });

    // Financeiro em R$: em aberto = pendente; baixado = confirmado.
    const open = await store.get("payments", of("financial", "7001").id!);
    expect(open).toMatchObject({
      orderId: order!.id,
      direction: "supplier_out",
      amount: 450,
      currency: "BRL",
      status: "pending",
      sankhyaCode: "7001",
    });
    const paid = await store.get("payments", of("financial", "7002").id!);
    expect(paid?.status).toBe("confirmed");
  });

  it("rodar de novo não duplica nada", async () => {
    const store = getStore();
    const before = {
      orders: (await store.list("orders")).length,
      parties: (await store.list("parties")).length,
      products: (await store.list("products")).length,
      payments: (await store.list("payments")).length,
      lines: (await store.list("product_lines")).length,
    };
    const lines = await importSankhyaSet(admin, set);
    expect(lines.filter((l) => l.outcome === "created")).toEqual([]);
    expect({
      orders: (await store.list("orders")).length,
      parties: (await store.list("parties")).length,
      products: (await store.list("products")).length,
      payments: (await store.list("payments")).length,
      lines: (await store.list("product_lines")).length,
    }).toEqual(before);
  });

  it("produto de grupo interno (material de consumo, folha...) entra inativo", async () => {
    const { isInternalGroup } = await import(
      "@/lib/integrations/sankhya-mapping"
    );
    expect(isInternalGroup(910101001)).toBe(true);
    expect(isInternalGroup("900101001")).toBe(true);
    // Mercadoria: grupos de 8 dígitos 901... (limpeza) e amostras 920...
    expect(isInternalGroup(90101001)).toBe(false);
    expect(isInternalGroup(920101001)).toBe(false);
    expect(isInternalGroup(160201001)).toBe(false);
    expect(isInternalGroup(null)).toBe(false);
    await importSankhyaSet(admin, {
      ...set,
      orders: [],
      items: [],
      financial: [],
      products: [
        {
          CODPROD: 23484,
          DESCRPROD: "CUBO PROMOCIONAL 20CM",
          CODGRUPOPROD: 910101001,
          ATIVO: "S",
        },
      ],
      groups: [
        {
          CODGRUPOPROD: 910101001,
          DESCRGRUPOPROD: "MATERIAIS DE CONSUMO",
          ATIVO: "S",
        },
      ],
    });
    const [cube] = await getStore().list("products", {
      filter: { sankhyaCode: "23484" },
    });
    expect(cube.active).toBe(false);
    const [mug] = await getStore().list("products", {
      filter: { sankhyaCode: "50" },
    });
    expect(mug.active).toBe(true);
  });

  it("lê só os cadastros dos códigos da nota, não as tabelas inteiras", async () => {
    const store = getStore();
    const spy = vi.spyOn(store, "list");
    try {
      await importSankhyaSet(admin, set);
      const whole = spy.mock.calls.filter(
        ([table, options]) =>
          ["parties", "products", "product_lines"].includes(table) &&
          !options?.filter,
      );
      expect(whole).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
