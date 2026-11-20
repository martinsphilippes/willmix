import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";
import { sheetFor } from "./quote-sheet-fixture";

/*
 * Grupo de produto (família) do parceiro (dono, 18/11/2026;
 * docs/PARTNER_FAMILIES.md): o cadastro de famílias vem da árvore de grupos
 * do Sankhya (o 1º nível, a mesma família da Nova solicitação), cada linha
 * ganha a família dela, os vínculos antigos "Linhas atendidas" viram
 * famílias (sem apagar), e Fornecedor, Trading, Supplier e Factory marcam
 * as famílias que atendem e entram na cotação de compra das linhas delas,
 * uma vez só, com o fornecedor principal preservado.
 */
const tree = vi.hoisted(() => ({
  groups: new Map<string, { name: string; parent: string | null }>(),
}));
vi.mock("@/lib/services/sankhya-product-families", () => ({
  sankhyaProductGroups: async () => tree.groups,
  resetSankhyaProductFamilies: () => {},
  sankhyaFamiliesByProduct: async () => new Map(),
  resetSankhyaFamiliesByProduct: () => {},
}));

withTempStore();

const { getStore } = await import("@/lib/db");
const { PARTY_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
const { seedDemo } = await import("@/lib/seed");
const fam = await import("@/lib/services/product-families");
const pure = await import("@/lib/party-families");
const quotes = await import("@/lib/services/purchase-quote");
const requests = await import("@/lib/services/requests");
const strategy = await import("@/lib/services/purchase-strategy");
type User = import("@/lib/db").User;

let admin: User;
let buyer: User;
let director: User;
let sales: User;
let joao: User;
let supplierUser: User;
const party: Record<"trading" | "factory" | "supplier_partner", string> = {
  trading: "",
  factory: "",
  supplier_partner: "",
};

/** Árvore do Sankhya do teste: duas famílias com o mesmo nome. */
function setTree() {
  tree.groups = new Map([
    ["20000000", { name: "UTILIDADES DOMÉSTICAS", parent: null }],
    ["20100000", { name: "COZINHA", parent: "20000000" }],
    ["20101001", { name: "JARRAS", parent: "20100000" }],
    ["10000000", { name: "BRINQUEDOS", parent: null }],
    ["10100000", { name: "ANIMAIS", parent: "10000000" }],
    ["10101001", { name: "ANIMAIS A CORDA", parent: "10100000" }],
    ["110000000", { name: "BRINQUEDOS", parent: null }],
    ["110101001", { name: "ANIMAIS A CORDA", parent: "110000000" }],
    ["30000000", { name: "CUIDADOS PESSOAIS", parent: null }],
  ]);
}

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  buyer = by("operador@wellmix.com");
  director = by("diretoria@wellmix.com");
  sales = by("vendas@wellmix.com");
  joao = by("joao@lojista.com");
  supplierUser = by("supplier.a@china.com");
  const store = getStore();
  for (const type of Object.keys(party) as Array<keyof typeof party>) {
    const p = await store.create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      type,
      name: `Parceiro ${type}`,
      legalName: null,
      country: "CN",
      email: null,
      phone: null,
      notes: null,
      active: true,
    } as never);
    party[type] = p.id;
  }
  // Linhas da demonstração com o grupo do Sankhya (a inflável vai para o
  // outro "BRINQUEDOS").
  await store.update("product_lines", "linha-utilidades", {
    sankhyaCode: "20101001",
    familyCode: null,
  });
  await store.update("product_lines", "linha-brinquedos", {
    sankhyaCode: "10101001",
  });
  await store.update("product_lines", "linha-inflaveis", {
    sankhyaCode: "110101001",
  });
  // Vínculo antigo "Linhas atendidas": o fornecedor B na de utilidades.
  await quotes.setSupplierLines(admin, "fornecedor-b", ["linha-utilidades"]);
});

describe("regras puras", () => {
  it("família = o topo da árvore; o grupo do topo é a própria família", () => {
    setTree();
    expect(pure.familyCodeOf("20101001", tree.groups)).toBe("20000000");
    expect(pure.familyCodeOf("110101001", tree.groups)).toBe("110000000");
    expect(pure.familyCodeOf("10000000", tree.groups)).toBe("10000000");
    expect(pure.familyCodeOf("0", tree.groups)).toBeNull();
    expect(pure.familyCodeOf("999", tree.groups)).toBeNull();
    const cycle = new Map([
      ["1", { name: "A", parent: "2" }],
      ["2", { name: "B", parent: "1" }],
    ]);
    expect(["1", "2"]).toContain(pure.familyCodeOf("1", cycle));
  });

  it("famílias da árvore por nome e código; nome repetido; busca por nome (sem acento) e código", () => {
    setTree();
    const list = pure.familiesOfTree(tree.groups);
    expect(list.map((f) => f.code)).toEqual([
      "10000000",
      "110000000",
      "30000000",
      "20000000",
    ]);
    expect(pure.repeatedNames(list)).toEqual(new Set(["brinquedos"]));
    const utils = list.find((f) => f.code === "20000000")!;
    expect(pure.familyMatches(utils, "domesticas")).toBe(true);
    expect(pure.familyMatches(utils, "2000")).toBe(true);
    expect(pure.familyMatches(utils, "brinq")).toBe(false);
    expect(
      pure.uniqueByCode([...list, { code: "10000000", name: "X" }]),
    ).toHaveLength(4);
  });

  it("os quatro tipos com família e na cotação", () => {
    for (const type of ["supplier", "trading", "supplier_partner", "factory"])
      expect(pure.servesFamilies(type)).toBe(true);
    for (const type of ["customer", "carrier", "gp", "partner"])
      expect(pure.servesFamilies(type)).toBe(false);
  });
});

describe("cadastro de famílias pelo Sankhya", () => {
  it("cria e atualiza pelo código, inativa a que sumiu, dá a família às linhas e converte as Linhas atendidas", async () => {
    setTree();
    const store = getStore();
    const result = await fam.syncProductFamilies(admin);
    expect(result).toMatchObject({ families: 4, created: 1, inactivated: 1 });
    const all = await fam.listProductFamilies({ includeInactive: true });
    const byCode = new Map(all.map((f) => [f.code, f]));
    // Nome com acento do Sankhya; a chave pelo nome é a da Nova solicitação.
    expect(byCode.get("20000000")).toMatchObject({
      name: "UTILIDADES DOMÉSTICAS",
      nameKey: "fm:UTILIDADES_DOMESTICAS",
      active: true,
    });
    expect(byCode.get("30000000")?.active).toBe(true);
    // A da demonstração que não está na árvore fica inativa (não some).
    expect(byCode.get("40000000")?.active).toBe(false);
    expect((await fam.listProductFamilies()).map((f) => f.code)).not.toContain(
      "40000000",
    );
    expect(
      (await store.get("product_lines", "linha-utilidades"))!.familyCode,
    ).toBe("20000000");
    expect(
      (await store.get("product_lines", "linha-inflaveis"))!.familyCode,
    ).toBe("110000000");
    // O vínculo antigo virou a família da linha; o antigo continua, marcado.
    expect(await fam.partyFamilyCodes("fornecedor-b")).toEqual(["20000000"]);
    const oldLinks = await store.list("supplier_lines", {
      filter: { supplierId: "fornecedor-b" },
    });
    expect(oldLinks).toHaveLength(1);
    expect(oldLinks[0].familyConvertedAt).toBeTruthy();
    const again = await fam.syncProductFamilies(admin);
    expect(again).toMatchObject({ created: 0, converted: 0 });
    expect(
      (await fam.listProductFamilies({ includeInactive: true })).length,
    ).toBe(5);
    const audits = await store.list("audit_log", {
      filter: { action: "product_families.sync" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });

  it("sem o Sankhya: nada muda; atualizar pelo administrador avisa", async () => {
    const saved = tree.groups;
    tree.groups = new Map();
    expect(await fam.syncProductFamilies(null)).toBeNull();
    await expect(fam.refreshFamiliesFromSankhya(admin)).rejects.toThrow(
      "families_sankhya_unavailable",
    );
    await expect(fam.refreshFamiliesFromSankhya(buyer)).rejects.toThrow(
      "forbidden",
    );
    tree.groups = saved;
  });
});

describe("famílias do parceiro", () => {
  it("cada parceiro dos quatro tipos grava as suas, independentes", async () => {
    await fam.setPartyFamilies(admin, party.trading, ["10000000", "110000000"]);
    await fam.setPartyFamilies(admin, party.factory, ["20000000"]);
    await fam.setPartyFamilies(admin, party.supplier_partner, ["10000000"]);
    await fam.setPartyFamilies(admin, "fornecedor-c", ["10000000", "20000000"]);
    expect(await fam.partyFamilyCodes(party.trading)).toEqual([
      "10000000",
      "110000000",
    ]);
    expect(await fam.partyFamilyCodes(party.factory)).toEqual(["20000000"]);
    expect(await fam.partyFamilyCodes(party.supplier_partner)).toEqual([
      "10000000",
    ]);
    expect(await fam.partyFamilyCodes("fornecedor-c")).toEqual([
      "10000000",
      "20000000",
    ]);
    // Trocar a lista: tira o que saiu, com a Auditoria antes e depois.
    expect(
      await fam.setPartyFamilies(admin, party.trading, ["110000000"]),
    ).toEqual({ added: 0, removed: 1 });
    expect(await fam.partyFamilyCodes(party.trading)).toEqual(["110000000"]);
    const [audit] = await getStore().list("audit_log", {
      filter: { action: "party.families", entityId: party.trading },
      orderBy: "createdAt",
      direction: "desc",
    });
    expect(audit.before).toEqual({ families: ["10000000", "110000000"] });
    expect(audit.after).toEqual({ families: ["110000000"] });
  });

  it("regras de hoje: equipe com Cadastros; tipo sem família e código desconhecido recusam", async () => {
    await expect(
      fam.setPartyFamilies(admin, "cliente-joao", ["10000000"]),
    ).rejects.toThrow("family_party_type");
    await expect(
      fam.setPartyFamilies(admin, party.factory, ["99999999"]),
    ).rejects.toThrow("family_unknown");
    await expect(
      fam.setPartyFamilies(supplierUser, party.factory, ["10000000"]),
    ).rejects.toThrow("forbidden");
    // Vendas não abre Cadastros.
    await expect(
      fam.setPartyFamilies(sales, party.factory, ["10000000"]),
    ).rejects.toThrow();
    expect(await fam.partyFamilyCodes(party.factory)).toEqual(["20000000"]);
  });
});

describe("cotação de compra pelas famílias", () => {
  it("quem marcou a família da linha entra, dos quatro tipos, uma vez só; o principal continua", async () => {
    const store = getStore();
    // Brinquedos (família 10000000): Supplier e o fornecedor C marcaram; o
    // fornecedor principal da boneca também entra; a Trading é do outro
    // "BRINQUEDOS"; a Factory é de utilidades.
    const boneca = (await store.get("products", "prod-boneca"))!;
    const ids = await quotes.supplierIdsForLines(["linha-brinquedos"]);
    expect(ids).toContain(party.supplier_partner);
    expect(ids).toContain("fornecedor-c");
    if (boneca.supplierId) expect(ids).toContain(boneca.supplierId);
    expect(ids).not.toContain(party.trading);
    expect(ids).not.toContain(party.factory);
    expect(new Set(ids).size).toBe(ids.length);
    // O principal também marcado pela família: continua uma vez só.
    if (boneca.supplierId) {
      await fam.setPartyFamilies(admin, boneca.supplierId, ["10000000"]);
      const again = await quotes.supplierIdsForLines(["linha-brinquedos"]);
      expect(again.filter((id) => id === boneca.supplierId)).toHaveLength(1);
    }
    // Infláveis (o outro "BRINQUEDOS"): só a Trading pela família.
    expect(await quotes.supplierIdsForLines(["linha-inflaveis"])).toContain(
      party.trading,
    );
    // Inativo não entra; cliente (mesmo com o vínculo) não entra.
    await store.update("parties", party.supplier_partner, { active: false });
    expect(
      await quotes.supplierIdsForLines(["linha-brinquedos"]),
    ).not.toContain(party.supplier_partner);
    await store.update("parties", party.supplier_partner, { active: true });
    await store.create("party_families", {
      partyId: "cliente-joao",
      familyCode: "10000000",
      createdByUserId: null,
    });
    expect(
      await quotes.supplierIdsForLines(["linha-brinquedos"]),
    ).not.toContain("cliente-joao");
  });

  it("Linhas atendidas convertidas: a família manda (desmarcar tira da cotação e atualizar do Sankhya não refaz); a de linha sem família continua valendo", async () => {
    const store = getStore();
    // fornecedor-b: o vínculo antigo (utilidades) virou a família 20000000.
    await fam.setPartyFamilies(admin, "fornecedor-b", ["20000000"]);
    expect(await quotes.supplierIdsForLines(["linha-utilidades"])).toContain(
      "fornecedor-b",
    );
    // Desmarcou: sai da cotação de utilidades; o principal continua.
    await fam.setPartyFamilies(admin, "fornecedor-b", []);
    const ids = await quotes.supplierIdsForLines(["linha-utilidades"]);
    expect(ids).not.toContain("fornecedor-b");
    expect(ids).toContain("fornecedor-a");
    // Outra atualização do Sankhya não refaz a família desmarcada.
    await fam.refreshFamiliesFromSankhya(admin);
    expect(await fam.partyFamilyCodes("fornecedor-b")).toEqual([]);
    expect(
      await quotes.supplierIdsForLines(["linha-utilidades"]),
    ).not.toContain("fornecedor-b");
    // Linha sem grupo do Sankhya: o vínculo antigo não vira família e
    // continua valendo na cotação.
    const manual = await store.create("product_lines", {
      name: "Linha manual",
      manualDocumentId: null,
      requirements: [],
      active: true,
      requiredCertifications: null,
      prompts: null,
      sankhyaCode: null,
    });
    await quotes.setSupplierLines(admin, "fornecedor-c", [manual.id]);
    await fam.refreshFamiliesFromSankhya(admin);
    const [kept] = await store.list("supplier_lines", {
      filter: { supplierId: "fornecedor-c", lineId: manual.id },
    });
    expect(kept.familyConvertedAt ?? null).toBeNull();
    expect(await quotes.supplierIdsForLines([manual.id])).toContain(
      "fornecedor-c",
    );
  });

  it("linha sem a família gravada: calculada pela árvore e gravada", async () => {
    const store = getStore();
    await store.update("product_lines", "linha-brinquedos", {
      familyCode: null,
    });
    expect(await fam.familyCodesForLines(["linha-brinquedos"])).toEqual([
      "10000000",
    ]);
    expect(
      (await store.get("product_lines", "linha-brinquedos"))!.familyCode,
    ).toBe("10000000");
  });

  it("a Factory da família é convidada, responde, vence e vira o fornecedor da solicitação; a Trading entra pelo convite", async () => {
    const store = getStore();
    const factoryUser = await store.create("users", {
      email: "factory-family@test.com",
      name: "Factory",
      role: "supplier",
      partyId: party.factory,
      locale: "pt",
      passwordHash: null,
      active: true,
      importerId: null,
    } as never);
    const T0 = new Date();
    const plus = (h: number) => new Date(T0.getTime() + h * 3_600_000);
    const d = await requests.createRequest(joao, {
      customerId: "cliente-joao",
      productId: "prod-jarra",
      productName: "Jarra",
      description: "Encomenda",
      quantity: 1000,
      unit: "un",
    });
    // Encomendas → "Enviar para cotação" (Estratégia de Compra, 18/11/2026).
    await strategy.sendToStrategy(buyer, [d.id]);
    const decision = await strategy.chooseStrategy(buyer, {
      demandIds: [d.id],
      choice: "quote",
      note: null,
    });
    await strategy.decideStrategy(director, decision.id, {
      approve: true,
      note: null,
    });
    const quoteId = (await store.get("purchase_decisions", decision.id))!
      .quoteId!;
    let responses = await store.list("purchase_quote_responses", {
      filter: { quoteId },
    });
    // Utilidades (família 20000000): a Factory e o fornecedor C pela
    // família, cada um uma vez.
    const invited = responses.map((r) => r.supplierId);
    expect(invited).toContain(party.factory);
    expect(invited).toContain("fornecedor-c");
    expect(new Set(invited).size).toBe(invited.length);
    // Convite à mão: a Trading (outro tipo) também pode.
    expect(await quotes.inviteMore(buyer, quoteId, [party.trading])).toBe(1);
    responses = await store.list("purchase_quote_responses", {
      filter: { quoteId },
    });
    for (const r of responses)
      await store.update("purchase_quote_responses", r.id, {
        invitedAt: T0.toISOString(),
        dueAt: plus(24).toISOString(),
      });
    await quotes.answerQuote(
      factoryUser,
      quoteId,
      {
        decline: false,
        prices: [{ productId: "prod-jarra", unitPrice: 1.5 }],
        currency: "USD",
        incoterm: "FOB",
        leadTimeDays: 30,
        port: "Ningbo",
        moq: 500,
        note: null,
        sheets: [sheetFor("prod-jarra")],
      },
      plus(1),
    );
    const mine = responses.find((r) => r.supplierId === party.factory)!;
    await quotes.chooseWinner(buyer, quoteId, mine.id, null, plus(25));
    const approved = await quotes.decideWinner(director, quoteId, {
      approve: true,
      note: null,
    });
    const [sr] = await store.list("supplier_requests", {
      filter: { id: approved.supplierRequestIds! },
    });
    expect(sr.supplierId).toBe(party.factory);
  });
});
