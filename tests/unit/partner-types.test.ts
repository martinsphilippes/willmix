import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Tipos de parceiro administráveis (docs/PARTNER_TYPES.md): catálogo com os
 * de fábrica e os criados no painel, renomear e inativar com histórico,
 * atribuição só de tipo ativo, CSV legado e que nada disso dá acesso ao portal.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/partner-types");
const lib = await import("@/lib/partner-types");
const { translator } = await import("@/i18n");
const { PARTY_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let supplier: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
});

const input = (name: string, value: string | null = null) => ({
  value,
  name,
  nameEn: null,
  nameZh: null,
  description: null,
  active: true,
});

describe("catálogo de tipos de parceiro", () => {
  it("começa com os quatro em destaque e os oito de sempre, ativos, sem linha no banco", async () => {
    const catalog = await svc.getPartnerTypeCatalog();
    expect(catalog.map((e) => e.value)).toEqual([
      // Em destaque (decisão do dono): entram como o Fornecedor entra.
      "trading",
      "factory",
      "supplier_partner",
      "gp",
      "agency",
      "broker",
      "shipping_line",
      "carrier",
      "legal",
      "comex",
      "logistics",
      "ocp",
      "marketing_agency",
    ]);
    expect(catalog.every((e) => e.active && e.rowId === null)).toBe(true);
    const agency = catalog.find((e) => e.value === "agency")!;
    expect(lib.partnerTypeName(agency, "pt")).toBe("Agência");
    expect(lib.partnerTypeName(agency, "en")).toBe("Agency");
    expect(lib.partnerTypeName(catalog[2], "pt")).toBe("Supplier");
    // Login: os novos entram com o papel do Fornecedor e perfil próprio; os
    // de sempre, com o papel de sempre.
    expect(catalog[0]).toMatchObject({
      loginRole: "supplier",
      profileKey: "type:trading",
    });
    expect(agency).toMatchObject({
      loginRole: "agency",
      profileKey: "role:agency",
    });
  });

  it("só o administrador cria; nome repetido (em qualquer idioma) recusa", async () => {
    await expect(
      svc.savePartnerType(operator, input("Empresa de Inspeção")),
    ).rejects.toThrow();
    await expect(
      svc.savePartnerType(supplier, input("Empresa de Inspeção")),
    ).rejects.toThrow();
    await expect(svc.savePartnerType(admin, input("x"))).rejects.toThrow(
      "partner_type_name_invalid",
    );
    const created = await svc.savePartnerType(
      admin,
      input("Empresa de Inspeção"),
    );
    expect(created).toMatchObject({
      key: "empresa_de_inspecao",
      builtin: null,
      active: true,
    });
    expect(created.value).toBe(`custom:${created.rowId}`);
    // Mesmo nome sem acento, ou o nome de um tipo de fábrica: recusa.
    await expect(
      svc.savePartnerType(admin, input("empresa de inspecao")),
    ).rejects.toThrow("partner_type_name_taken");
    await expect(svc.savePartnerType(admin, input("Agency"))).rejects.toThrow(
      "partner_type_name_taken",
    );
    const audits = await getStore().list("audit_log", {
      filter: { action: "partner_type.create" },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].after).toMatchObject({ name: "Empresa de Inspeção" });
  });

  it("renomear mantém o identificador; inativar some das novas atribuições e fica no cadastro antigo", async () => {
    const store = getStore();
    const catalog = await svc.getPartnerTypeCatalog();
    const inspection = catalog.find((e) => e.key === "empresa_de_inspecao")!;
    // Cadastro com o tipo criado no painel.
    const resolved = await svc.resolvePartyType(inspection.value, null);
    expect(resolved).toEqual({
      type: "partner",
      partnerTypeId: inspection.rowId,
    });
    const party = await store.create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      ...resolved,
      name: "Inspecta Ltda",
      country: "BR",
      email: null,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
    });
    const t = translator("pt");
    expect(lib.partyTypeLabel(party, catalog, t)).toBe("Empresa de Inspeção");

    const renamed = await svc.savePartnerType(admin, {
      ...input("Inspeção de Qualidade", inspection.value),
      nameEn: "Quality inspection",
      active: false,
    });
    expect(renamed).toMatchObject({
      key: "empresa_de_inspecao",
      active: false,
    });
    const after = await svc.getPartnerTypeCatalog();
    // O cadastro antigo continua legível, no idioma de quem lê.
    expect(lib.partyTypeLabel(party, after, t)).toBe("Inspeção de Qualidade");
    expect(lib.partyTypeLabel(party, after, translator("en"))).toBe(
      "Quality inspection",
    );
    // Novo cadastro com tipo inativo recusa; o que já tinha, continua.
    await expect(svc.resolvePartyType(renamed.value, null)).rejects.toThrow(
      "partner_type_inactive",
    );
    expect(await svc.resolvePartyType(renamed.value, party)).toEqual(resolved);
    await expect(svc.resolvePartyType("custom:nada", null)).rejects.toThrow(
      "partner_type_invalid",
    );
    const audits = await store.list("audit_log", {
      filter: { action: "partner_type.update" },
    });
    expect(audits[0].before).toMatchObject({
      name: "Empresa de Inspeção",
      active: true,
    });
    expect(audits[0].after).toMatchObject({
      name: "Inspeção de Qualidade",
      active: false,
    });
    await svc.savePartnerType(admin, {
      ...input("Inspeção de Qualidade", inspection.value),
      active: true,
    });
  });

  it("tipo de fábrica: renomear e inativar sem mexer nos cadastros", async () => {
    const entry = await svc.savePartnerType(
      admin,
      input("Agência de arte", "agency"),
    );
    expect(entry).toMatchObject({ value: "agency", builtin: "agency" });
    expect(lib.partnerTypeName(entry, "pt")).toBe("Agência de arte");
    // O cadastro continua com o tipo de fábrica.
    expect(await svc.resolvePartyType("agency", null)).toEqual({
      type: "agency",
      partnerTypeId: null,
    });
    // Cliente e fornecedor não passam pelo catálogo.
    expect(await svc.resolvePartyType("supplier", null)).toEqual({
      type: "supplier",
      partnerTypeId: null,
    });
  });
});

describe("CSV de parceiros", () => {
  it("vale a chave legada e o nome; desconhecido, ambíguo e inativo dão erro por linha", async () => {
    const of = await svc.importPartyType();
    expect(of("agency")).toMatchObject({ ok: true, value: "agency" });
    expect(of("SUPPLIER")).toMatchObject({ ok: true, value: "supplier" });
    // Nome antigo de fábrica continua valendo depois de renomear.
    expect(of("Agência")).toMatchObject({ ok: true, value: "agency" });
    expect(of("despachante")).toMatchObject({ ok: true, value: "broker" });
    expect(of("Inspeção de Qualidade")).toMatchObject({
      ok: true,
      party: { type: "partner" },
    });
    expect(of("não existe")).toEqual({ ok: false, reason: "unknown" });

    const catalog = await svc.getPartnerTypeCatalog();
    const twin = {
      ...catalog.find((e) => e.value === "agency")!,
      value: "custom:x",
      key: "x",
      builtin: null,
    };
    expect(lib.matchPartnerType("Agência de arte", [...catalog, twin])).toEqual(
      { ok: false, reason: "ambiguous" },
    );
    await svc.savePartnerType(admin, {
      ...input("Jurídico", "legal"),
      active: false,
    });
    expect((await svc.importPartyType())("legal")).toEqual({
      ok: false,
      reason: "inactive",
    });
  });

  it("importar cadastra o parceiro e não cria login nenhum", async () => {
    const store = getStore();
    const usersBefore = (await store.list("users")).length;
    const { importCsv } = await import("@/lib/services/import");
    const result = await importCsv(
      admin,
      "parties",
      [
        "type,name,country,email",
        "agency,Agência Legada,BR,a@x.com",
        "Inspeção de Qualidade,Inspecta Sul,BR,i@x.com",
        "tipo inventado,Ninguém,BR,n@x.com",
      ].join("\n"),
    );
    expect(result).toMatchObject({ created: 2, skipped: 1 });
    const parties = await store.list("parties");
    expect(parties.find((p) => p.name === "Agência Legada")!.type).toBe(
      "agency",
    );
    const custom = parties.find((p) => p.name === "Inspecta Sul")!;
    expect(custom.type).toBe("partner");
    expect(custom.partnerTypeId).toBeTruthy();
    expect((await store.list("users")).length).toBe(usersBefore);
  });
});

describe("login dos tipos de parceiro", () => {
  it("tipo criado sem login recusa; com login e os em destaque entram como o Fornecedor", async () => {
    const store = getStore();
    const party = (await store.list("parties")).find(
      (p) => p.type === "partner",
    )!;
    const { createPortalLogin } = await import("@/lib/services/portal-access");
    await expect(
      createPortalLogin(admin, {
        name: "Inspetor",
        email: "inspetor@x.com",
        password: "senha-forte-123",
        role: "supplier",
        partyId: party.id,
        locale: "pt",
      } as Parameters<typeof createPortalLogin>[1]),
    ).rejects.toThrow("user_role_mismatch");

    // O administrador libera o login do tipo: o usuário entra como fornecedor.
    const entry = (await svc.getPartnerTypeCatalog()).find(
      (e) => e.rowId === party.partnerTypeId,
    )!;
    expect(entry.loginRole).toBeNull();
    const withLogin = await svc.savePartnerType(admin, {
      ...input(lib.partnerTypeName(entry, "pt"), entry.value),
      allowLogin: true,
    });
    expect(withLogin).toMatchObject({
      loginRole: "supplier",
      profileKey: `type:${entry.key}`,
    });
    const inspector = await createPortalLogin(admin, {
      name: "Inspetor",
      email: "inspetor@x.com",
      password: "senha-forte-123",
      role: "supplier",
      partyId: party.id,
      locale: "pt",
    } as Parameters<typeof createPortalLogin>[1]);
    expect(inspector).toMatchObject({ role: "supplier", partyId: party.id });

    // Factory (em destaque): login de fornecedor; outro papel recusa.
    const factory = await store.create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      type: "factory",
      name: "Fábrica Yiwu",
      country: "CN",
      email: null,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
    });
    await expect(
      createPortalLogin(admin, {
        name: "Li",
        email: "li@factory.com",
        password: "senha-forte-123",
        role: "customer",
        partyId: factory.id,
        locale: "zh",
      } as Parameters<typeof createPortalLogin>[1]),
    ).rejects.toThrow("user_role_mismatch");
    const li = await createPortalLogin(admin, {
      name: "Li",
      email: "li@factory.com",
      password: "senha-forte-123",
      role: "supplier",
      partyId: factory.id,
      locale: "zh",
    } as Parameters<typeof createPortalLogin>[1]);
    expect(li.role).toBe("supplier");
    // Isolamento: o login da Factory não vê pedido de outro fornecedor.
    const { canViewOrder } = await import("@/lib/auth/permissions");
    const [order] = await store.list("orders", { limit: 1 });
    if (order) expect(canViewOrder(li, order)).toBe(false);
  });
});
