import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * RCA do cliente (dono, 15/11/2026; docs/CUSTOMER_RCA.md): o vendedor do
 * Sankhya (TGFVEN) no cadastro do cliente, gravado pelo código; a carga do
 * Sankhya manda (sobrescreve o portal). Na Nova solicitação, o RCA do
 * cliente é só consulta (rota /api/parties/rca, Wellmix que abre
 * Solicitações), o solicitante é quem cria (sessão) e o login do cliente com
 * acesso segue as regras de antes (só login daquele cliente).
 */
withTempStore();

let current: unknown = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => current,
}));
// O Sankhya de mentira: as linhas da TGFVEN ou, nulo, fora do ar.
const sankhya: { rows: Array<Record<string, unknown>> | null; sql: string[] } =
  { rows: [], sql: [] };
vi.mock("@/lib/integrations/sankhya-client", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/integrations/sankhya-client")
  >()),
  executeQuery: async (sql: string) => {
    sankhya.sql.push(sql);
    if (!sankhya.rows) throw new Error("Sankhya fora do ar");
    return { columns: ["CODVEND", "APELIDO", "ATIVO"], rows: sankhya.rows };
  },
}));

const { getStore, PARTY_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { canOpen } = await import("@/lib/auth/screens");
const rca = await import("@/lib/services/rca");
const route = await import("@/app/api/parties/rca/route");
const { createRequest } = await import("@/lib/services/requests");
const { createPortalLogin } = await import("@/lib/services/portal-access");
const { importContext, upsertParty } =
  await import("@/lib/integrations/sankhya-import");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let joao: User;
let supplier: User;
/** Login do segundo cliente (Mercado da Maria). */
let maria: User;
/** Wellmix que abre Solicitações mas não Parceiros. */
let requestsOnly: User;

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "ok";
};

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
  await getStore().create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    id: "cliente-maria",
    type: "customer",
    name: "Mercado da Maria",
    country: "BR",
    email: "maria@mercado.com",
    phone: null,
    taxId: null,
    notes: null,
    active: true,
  });
  maria = await createPortalLogin(admin, {
    partyId: "cliente-maria",
    email: "maria@mercado.com",
    name: "Maria Cliente",
    role: "customer",
    locale: "pt",
    password: "senha-forte-1",
  });
  requestsOnly = { ...operator, screens: ["requests"] } as User;
});

describe("código do RCA", () => {
  it("só números, sem zeros à esquerda; 0, vazio ou texto = sem RCA", () => {
    expect(rca.normalizeRcaCode("0101")).toBe("101");
    expect(rca.normalizeRcaCode(7)).toBe("7");
    expect(rca.normalizeRcaCode(" 12 ")).toBe("12");
    expect(rca.normalizeRcaCode("0")).toBeNull();
    expect(rca.normalizeRcaCode("000")).toBeNull();
    expect(rca.normalizeRcaCode("")).toBeNull();
    expect(rca.normalizeRcaCode("abc")).toBeNull();
    expect(rca.normalizeRcaCode(null)).toBeNull();
    expect(rca.normalizeRcaCode(undefined)).toBeNull();
  });

  it("gravado no portal vale; sem nada gravado, o vendedor da carga", () => {
    const customer = { type: "customer" as const, sankhyaRefs: { CODVEND: 7 } };
    expect(rca.rcaCodeOf({ ...customer, rcaCode: null })).toBe("7");
    expect(rca.rcaCodeOf({ ...customer, rcaCode: undefined })).toBe("7");
    expect(rca.rcaCodeOf({ ...customer, rcaCode: "12" })).toBe("12");
    // "0" no portal = sem RCA, mesmo com vendedor antigo na carga.
    expect(rca.rcaCodeOf({ ...customer, rcaCode: "0" })).toBeNull();
    expect(
      rca.rcaCodeOf({ type: "customer", rcaCode: null, sankhyaRefs: null }),
    ).toBeNull();
    // Só cliente tem RCA.
    expect(
      rca.rcaCodeOf({ type: "supplier", rcaCode: "12", sankhyaRefs: null }),
    ).toBeNull();
  });
});

describe("lista de vendedores", () => {
  it("a demonstração vem marcada como demonstração", async () => {
    const list = await rca.loadRcaList();
    expect(list.demo).toBe(true);
    expect(list.sellers.map((s) => s.code)).toEqual(["101", "102", "103"]);
    expect(list.sellers.find((s) => s.code === "103")?.active).toBe(false);
  });

  it("trazer do Sankhya: só quem cuida do cadastro de clientes", async () => {
    expect(canOpen(requestsOnly, "parties")).toBe(false);
    expect(await code(() => rca.refreshRcaList(requestsOnly))).toBe(
      "forbidden",
    );
    expect(await code(() => rca.refreshRcaList(joao))).toBe("forbidden");
    expect(sankhya.sql).toHaveLength(0);
  });

  it("Sankhya fora do ar: avisa e mantém a lista de antes", async () => {
    sankhya.rows = null;
    expect(await code(() => rca.refreshRcaList(admin))).toBe("rca_sankhya");
    expect((await rca.loadRcaList()).sellers).toHaveLength(3);
  });

  it("traz a TGFVEN: ativos e inativos, sem o vendedor 0", async () => {
    sankhya.rows = [
      { CODVEND: 0, APELIDO: "<SEM VENDEDOR>", ATIVO: "S" },
      {
        CODVEND: 101,
        CODPARC: 5101,
        APELIDO: " Ana Representações ",
        ATIVO: "S",
      },
      { CODVEND: 102, CODPARC: 5102, APELIDO: "Bruno Vendas", ATIVO: "S" },
      { CODVEND: 103, CODPARC: 5103, APELIDO: "Carla Comercial", ATIVO: "N" },
      { CODVEND: 104, CODPARC: null, APELIDO: "Dora", ATIVO: null },
      { CODVEND: 105, APELIDO: "", ATIVO: "S" },
    ];
    const list = await rca.refreshRcaList(admin);
    expect(sankhya.sql.at(-1)).toMatch(/FROM TGFVEN/);
    expect(list.sellers).toEqual([
      {
        code: "101",
        name: "Ana Representações",
        active: true,
        partnerCode: "5101",
      },
      { code: "102", name: "Bruno Vendas", active: true, partnerCode: "5102" },
      {
        code: "103",
        name: "Carla Comercial",
        active: false,
        partnerCode: "5103",
      },
      { code: "104", name: "Dora", active: true, partnerCode: null },
    ]);
    // O CODPARC vem na mesma leitura da TGFVEN.
    expect(sankhya.sql.at(-1)).toContain("CODPARC");
    const saved = await rca.loadRcaList();
    expect(saved.demo).toBe(false);
    expect(saved.syncedAt).toBe(list.syncedAt);
    const [log] = await getStore().list("audit_log", {
      filter: { action: "rca.list" },
    });
    expect(log?.summary).toContain("4 vendedores");
  });
});

describe("RCA no cadastro do cliente", () => {
  it("o RCA da demonstração: João com a Ana, Wellmix SC com o Bruno", async () => {
    const store = getStore();
    expect(rca.rcaCodeOf(await store.get("parties", "cliente-joao"))).toBe(
      "101",
    );
    expect(rca.rcaCodeOf(await store.get("parties", "wellmix-sc"))).toBe("102");
  });

  it("só quem grava o cadastro de clientes; só cadastro de cliente", async () => {
    expect(
      await code(() => rca.setCustomerRca(requestsOnly, "cliente-joao", "102")),
    ).toBe("forbidden");
    expect(
      await code(() => rca.setCustomerRca(joao, "cliente-joao", "102")),
    ).toBe("forbidden");
    expect(
      await code(() => rca.setCustomerRca(admin, "fornecedor-a", "102")),
    ).toBe("rca_not_customer");
    expect(await code(() => rca.setCustomerRca(admin, "nao-existe", "1"))).toBe(
      "not_found",
    );
    expect(rca.rcaCodeOf(await getStore().get("parties", "cliente-joao"))).toBe(
      "101",
    );
  });

  it("troca, remove e registra na Auditoria; o mesmo RCA não grava", async () => {
    const store = getStore();
    const logs = async () =>
      (
        await store.list("audit_log", {
          filter: { action: "party.rca", entityId: "cliente-joao" },
        })
      ).length;
    expect(await rca.setCustomerRca(admin, "cliente-joao", "102")).toBe(true);
    expect((await store.get("parties", "cliente-joao"))?.rcaCode).toBe("102");
    const [log] = await store.list("audit_log", {
      filter: { action: "party.rca", entityId: "cliente-joao" },
    });
    expect(log?.summary).toBe(
      "RCA do cliente: Ana Representações (101) → Bruno Vendas (102)",
    );
    expect(await rca.setCustomerRca(admin, "cliente-joao", "0102")).toBe(false);
    expect(await logs()).toBe(1);
    // Sem RCA: grava "0" (não volta a valer o vendedor da carga).
    expect(await rca.setCustomerRca(admin, "cliente-joao", "0")).toBe(true);
    const party = await store.get("parties", "cliente-joao");
    expect(party?.rcaCode).toBe("0");
    expect(rca.rcaCodeOf(party)).toBeNull();
    expect(await logs()).toBe(2);
    await rca.setCustomerRca(admin, "cliente-joao", "101");
  });
});

describe("carga do Sankhya", () => {
  it("o Sankhya manda: a carga sobrescreve o RCA do portal", async () => {
    const data = (codVend: number) => ({
      type: "customer" as const,
      name: "Cliente da Carga",
      taxId: null,
      sankhyaRefs: { CODPARC: 777, CODVEND: codVend },
      active: true,
    });
    const first = await upsertParty(
      await importContext(admin, true),
      "customers",
      "777",
      data(103),
    );
    expect(first.rcaCode).toBe("103");
    await rca.setCustomerRca(admin, first.id, "101");
    expect(rca.rcaCodeOf(await getStore().get("parties", first.id))).toBe(
      "101",
    );
    const again = await upsertParty(
      await importContext(admin, true),
      "customers",
      "777",
      data(103),
    );
    expect(again.id).toBe(first.id);
    expect(rca.rcaCodeOf(again)).toBe("103");
    // Sem vendedor no Sankhya (0): sem RCA.
    const none = await upsertParty(
      await importContext(admin, true),
      "customers",
      "777",
      data(0),
    );
    expect(none.rcaCode).toBe("0");
    expect(rca.rcaCodeOf(none)).toBeNull();
  });

  it("fornecedor não ganha RCA", async () => {
    const party = await upsertParty(
      await importContext(admin, true),
      "partners",
      "778",
      {
        type: "supplier",
        name: "Fornecedor da Carga",
        taxId: null,
        sankhyaRefs: { CODPARC: 778, CODVEND: 101 },
        active: true,
      },
    );
    expect(party.rcaCode ?? null).toBeNull();
  });
});

describe("/api/parties/rca (Nova solicitação)", () => {
  const get = async (customer: string, who: User | null) => {
    current = who;
    const res = await route.GET(
      new Request(`http://localhost/api/parties/rca?customer=${customer}`),
    );
    return {
      status: res.status,
      cache: res.headers.get("Cache-Control"),
      body: (await res.json()) as {
        rca?: { code: string; name: string | null } | null;
      },
    };
  };

  it("o RCA do cadastro, com o nome da lista", async () => {
    const joaoRca = await get("cliente-joao", admin);
    expect(joaoRca.status).toBe(200);
    expect(joaoRca.cache).toBe("private, no-store");
    expect(joaoRca.body.rca).toMatchObject({
      code: "101",
      name: "Ana Representações",
      partnerCode: "5101",
    });
    // Outro cliente, outro RCA (a troca de cliente na tela).
    expect((await get("wellmix-sc", requestsOnly)).body.rca).toMatchObject({
      code: "102",
      name: "Bruno Vendas",
    });
  });

  it("cliente sem RCA e código fora da lista", async () => {
    expect((await get("cliente-maria", admin)).body.rca).toBeNull();
    await getStore().update("parties", "cliente-maria", { rcaCode: "999" });
    // Fora da cópia da lista (dono, 16/11/2026): o apelido vem direto da
    // TGFVEN pelo código; sem ele no Sankhya (ou sem o Sankhya), só o código.
    sankhya.rows = [];
    const unknown = {
      code: "999",
      name: null,
      active: null,
      partnerCode: null,
    };
    expect((await get("cliente-maria", admin)).body.rca).toEqual(unknown);
    sankhya.rows = null;
    expect((await get("cliente-maria", admin)).body.rca).toEqual(unknown);
    // O CODPARC (o código do vendedor na empresa) vem junto: a tela mostra
    // "CODPARC - APELIDO"; o CODVEND é interno.
    sankhya.rows = [
      { CODVEND: 999, CODPARC: 4321, APELIDO: "CARLOS RCA", ATIVO: "S" },
    ];
    sankhya.sql = [];
    expect((await get("cliente-maria", admin)).body.rca).toEqual({
      code: "999",
      name: "CARLOS RCA",
      active: true,
      partnerCode: "4321",
    });
    expect(sankhya.sql).toEqual([
      "SELECT CODVEND, CODPARC, APELIDO, ATIVO FROM TGFVEN WHERE CODVEND = 999",
    ]);
    sankhya.rows = [];
    await getStore().update("parties", "cliente-maria", { rcaCode: "0" });
    expect((await get("cliente-maria", admin)).body.rca).toBeNull();
    // Não é cliente: sem RCA.
    expect((await get("fornecedor-a", admin)).body.rca).toBeNull();
  });

  it("só a Wellmix que abre Solicitações; cliente e fornecedor: 404", async () => {
    expect((await get("cliente-joao", joao)).status).toBe(404);
    expect((await get("cliente-joao", supplier)).status).toBe(404);
    expect((await get("cliente-joao", null)).status).toBe(404);
    const noRequests = { ...operator, screens: ["parties"] } as User;
    expect(canOpen(noRequests, "requests")).toBe(false);
    expect((await get("cliente-joao", noRequests)).status).toBe(404);
    expect((await get("x%20y", admin)).status).toBe(400);
  });
});

describe("solicitante e login do cliente com acesso", () => {
  const input = (customerId: string, requestedForUserId: string | null) => ({
    customerId,
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Teste do RCA",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
    requestedForUserId,
  });

  it("usuário interno: ele é o solicitante; o acesso é o login escolhido", async () => {
    const request = await createRequest(
      operator,
      input("cliente-joao", joao.id),
    );
    expect(request.createdByUserId).toBe(operator.id);
    expect(request.requestedForUserId).toBe(joao.id);
    const none = await createRequest(operator, input("cliente-joao", null));
    expect(none.createdByUserId).toBe(operator.id);
    expect(none.requestedForUserId).toBeNull();
  });

  it("login de outro cliente não ganha acesso", async () => {
    expect(
      await code(() => createRequest(admin, input("cliente-joao", maria.id))),
    ).toBe("invalid_requester");
    expect(
      await code(() => createRequest(admin, input("cliente-maria", joao.id))),
    ).toBe("invalid_requester");
  });

  it("o próprio cliente: solicitante e acesso são o login dele", async () => {
    const request = await createRequest(maria, input("cliente-maria", null));
    expect(request.createdByUserId).toBe(maria.id);
    expect(request.requestedForUserId).toBe(maria.id);
    // Para outro cliente, não.
    expect(
      await code(() => createRequest(maria, input("cliente-joao", null))),
    ).toBe("forbidden");
  });
});
