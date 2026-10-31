import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Contas de demonstração: a carga inicial só roda em banco vazio; depois,
 * um papel novo no portal ganha a conta dele por ensureDemoAccounts (também
 * chamada pelo seed), sem recriar nem duplicar o que já existe.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const seed = await import("@/lib/seed");

beforeAll(async () => {
  await seed.seedDemo();
});

describe("motivo da falha ao criar conta", () => {
  it("valor de papel recusado pelo Appwrite é esquema desatualizado; o resto é inesperado", () => {
    const appwriteEnum = Object.assign(
      new Error(
        'Invalid document structure: Attribute "type" has invalid format. Value must be one of (customer, supplier)',
      ),
      { type: "document_invalid_structure" },
    );
    expect(seed.demoFailureReason(appwriteEnum)).toBe("schema_outdated");
    expect(
      seed.demoFailureReason(new Error('Unknown attribute: "functions"')),
    ).toBe("schema_outdated");
    expect(
      seed.demoFailureReason(
        Object.assign(new Error("x"), { type: "table_not_found" }),
      ),
    ).toBe("schema_outdated");
    // Nomes do TablesDB (Appwrite 1.8) e coluna obrigatória criada depois da tabela.
    expect(
      seed.demoFailureReason(
        Object.assign(
          new Error('Invalid document structure: Missing required attribute "jobLevel"'),
          { type: "row_invalid_structure" },
        ),
      ),
    ).toBe("schema_outdated");
    expect(
      seed.demoFailureReason(
        Object.assign(new Error("x"), { type: "column_not_found" }),
      ),
    ).toBe("schema_outdated");
    // Sem vírgula nem dois-pontos: o código viaja na URL sem embaralhar a lista.
    expect(seed.demoFailureReason(new Error("fetch failed: a, b"))).toBe(
      "unexpected",
    );
  });

  it("detalhe técnico: onde falhou (tabela.coluna ou auth) e o tipo do erro, só códigos", () => {
    const enumError = Object.assign(
      new Error(
        'Invalid document structure: Attribute "type" has invalid format. Value must be one of (customer, supplier)',
      ),
      { type: "document_invalid_structure", where: "parties" },
    );
    expect(seed.demoFailureDetail(enumError)).toBe(
      "parties.type:document_invalid_structure",
    );
    expect(
      seed.demoFailureDetail(
        Object.assign(new Error('Unknown attribute: "functions"'), {
          where: "users",
          type: "document_invalid_structure",
        }),
      ),
    ).toBe("users.functions:document_invalid_structure");
    // Appwrite Auth: sem coluna; só o tipo do erro.
    expect(
      seed.demoFailureDetail(
        Object.assign(new Error("A user with the same email already exists"), {
          where: "auth",
          type: "user_already_exists",
        }),
      ),
    ).toBe("auth:user_already_exists");
    // Valores fora do formato de código não entram (nada de texto livre na URL).
    expect(
      seed.demoFailureDetail(
        Object.assign(new Error("x"), { where: "a b", type: "Boom!" }),
      ),
    ).toBeUndefined();
    expect(seed.demoFailureDetail(new Error("fetch failed"))).toBeUndefined();
  });
});

describe("contas de demonstração", () => {
  it("segunda carga não duplica nada e não cria conta nova", async () => {
    const before = (await getStore().list("users")).length;
    const again = await seed.seedDemo();
    expect(again.created).toBe(false);
    expect(again.added.users).toEqual([]);
    expect(again.added.parties).toEqual([]);
    expect(again.added.failed).toEqual([]);
    expect((await getStore().list("users")).length).toBe(before);
    expect([...(await seed.existingDemoAccounts())].sort()).toEqual(
      seed.DEMO_USERS.map((u) => u.email).sort(),
    );
  });

  it("papel novo: cria só a empresa e o login que faltam", async () => {
    const store = getStore();
    const [ocp] = await store.list("users", {
      filter: { email: "ocp@certifica.com" },
    });
    await store.remove("users", ocp.id);
    await store.remove("parties", "ocp");
    expect((await seed.existingDemoAccounts()).has("ocp@certifica.com")).toBe(
      false,
    );
    const result = await seed.seedDemo();
    expect(result.created).toBe(false);
    expect(result.added).toEqual({
      parties: ["ocp"],
      users: ["ocp@certifica.com"],
      failed: [],
    });
    const [created] = await store.list("users", {
      filter: { email: "ocp@certifica.com" },
    });
    expect(created).toMatchObject({
      role: "ocp",
      partyId: "ocp",
      active: true,
    });
    expect(created.passwordHash).toBeTruthy();
    expect((await store.get("parties", "ocp"))?.type).toBe("ocp");
    // Idempotente: chamar de novo não cria mais nada.
    expect((await seed.ensureDemoAccounts()).users).toEqual([]);
  });

  it("empresa já existe: cria só o login", async () => {
    const store = getStore();
    const [comex] = await store.list("users", {
      filter: { email: "comex@assessoria.com" },
    });
    await store.remove("users", comex.id);
    const result = await seed.ensureDemoAccounts();
    expect(result.parties).toEqual([]);
    expect(result.users).toEqual(["comex@assessoria.com"]);
    expect(
      (await store.list("parties", { filter: { id: ["comex"] } })).length,
    ).toBe(1);
  });
});
