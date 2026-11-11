import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Acesso ao portal preso ao cadastro (src/lib/services/portal-access.ts):
 * fornecedor que entrou pela planilha e não tem login aparece como "sem
 * acesso"; o login nasce dentro do cadastro dele, com o
 * papel do tipo do cadastro, e enxerga o que já tinha sido enviado.
 */
withTempStore();

// signIn grava o cookie da sessão: fora de uma requisição, um pote de teste.
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

const { getStore, PARTY_EXTRA_DEFAULTS, PRODUCT_EXTRA_DEFAULTS } =
  await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { saveProductSheet } = await import("@/lib/services/product-sheet");
const {
  createPortalLogin,
  partiesWithoutLogin,
  PORTAL_MIN_PASSWORD,
  suggestPassword,
} = await import("@/lib/services/portal-access");
const { isLoginName, loginLabel } = await import("@/lib/auth/login-id");
const { signIn } = await import("@/lib/auth/session");
const { verifyPassword } = await import("@/lib/auth/password");
type User = import("@/lib/db").User;
type Party = import("@/lib/db").Party;

let admin: User;
let operator: User;
let factory: Party;

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "ok";
};

const login = (patch: Partial<Parameters<typeof createPortalLogin>[1]> = {}) =>
  ({
    partyId: factory.id,
    email: "li@fabrica-nova.cn",
    name: "Li Wei",
    role: "supplier",
    locale: "zh",
    password: "senha-forte-1",
    ...patch,
  }) as Parameters<typeof createPortalLogin>[1];

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  const store = getStore();
  // Como a importação da ficha técnica cadastra o fornecedor da planilha.
  factory = await store.create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "supplier",
    name: "Fábrica Nova",
    country: "China",
    email: null,
    phone: null,
    taxId: null,
    notes: "Cadastrado pela importação da ficha técnica.",
    city: "Yiwu",
    address: null,
    contactName: null,
    wechat: null,
    storeNumber: "E4-9558",
    active: true,
  });
  const [line] = await store.list("product_lines", { limit: 1 });
  for (const supplierId of [factory.id, "fornecedor-a"]) {
    const product = await store.create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      lineId: line.id,
      name: `Porta-retrato de ${supplierId}`,
      sku: null,
      specification: null,
      active: true,
      source: "import",
      supplierId,
    } as never);
    await saveProductSheet(admin, product.id, {
      factoryItemCode: `E4-${supplierId}`,
      price: 4,
      currency: "RMB",
      moq: 120,
      masterCartonQty: 12,
    });
  }
});

describe("acesso ao portal preso ao cadastro", () => {
  it("aponta o fornecedor da planilha que não tem login (e só ele)", async () => {
    expect(await partiesWithoutLogin([factory.id, "fornecedor-a"])).toEqual(
      new Set([factory.id]),
    );
    expect(await partiesWithoutLogin([])).toEqual(new Set());
  });

  it("recusa login solto, com papel de outro tipo, senha curta ou papel da Wellmix por quem não é admin", async () => {
    expect(
      await code(() => createPortalLogin(admin, login({ partyId: null }))),
    ).toBe("user_party_required");
    expect(
      await code(() =>
        createPortalLogin(admin, login({ partyId: "nao-existe" })),
      ),
    ).toBe("not_found");
    expect(
      await code(() => createPortalLogin(admin, login({ role: "customer" }))),
    ).toBe("user_role_mismatch");
    expect(
      await code(() =>
        createPortalLogin(
          admin,
          login({ password: "x".repeat(PORTAL_MIN_PASSWORD - 1) }),
        ),
      ),
    ).toBe("user_password_short");
    expect(
      await code(() => createPortalLogin(operator, login({ role: "admin" }))),
    ).toBe("forbidden");
    expect(
      await code(() =>
        createPortalLogin(admin, login({ email: "supplier.a@china.com" })),
      ),
    ).toBe("user_email_taken");
    expect(
      (await getStore().list("users", { filter: { partyId: factory.id } }))
        .length,
    ).toBe(0);
  });

  it("cria o login preso ao fornecedor: some do aviso e fica na auditoria", async () => {
    const created = await createPortalLogin(
      operator,
      login({ email: "  Li@Fabrica-Nova.CN " }),
    );
    expect(created).toMatchObject({
      email: "li@fabrica-nova.cn",
      role: "supplier",
      partyId: factory.id,
      locale: "zh",
      active: true,
    });
    expect(verifyPassword("senha-forte-1", created.passwordHash ?? "")).toBe(
      true,
    );
    expect(await partiesWithoutLogin([factory.id, "fornecedor-a"])).toEqual(
      new Set(),
    );
    const log = await getStore().list("audit_log", {
      filter: { action: "user.create", entityId: created.id },
    });
    expect(log).toHaveLength(1);
    expect(log[0].summary).toContain("Fábrica Nova");
    // O mesmo e-mail não ganha um segundo login.
    expect(await code(() => createPortalLogin(admin, login()))).toBe(
      "user_email_taken",
    );
  });

  it("login sem e-mail: nome de usuário criado pela Wellmix entra no portal; fora do formato é recusado", async () => {
    for (const bad of ["ab", "li wei", "fábrica", "工厂"])
      expect(
        await code(() => createPortalLogin(admin, login({ email: bad }))),
      ).toBe("user_login_invalid");
    const created = await createPortalLogin(
      admin,
      login({ email: " Fabrica.Nova ", password: "abc23456" }),
    );
    expect(isLoginName(created.email)).toBe(true);
    expect(loginLabel(created.email)).toBe("fabrica.nova");
    expect(created.partyId).toBe(factory.id);
    // O mesmo nome de usuário não ganha um segundo login.
    expect(
      await code(() =>
        createPortalLogin(admin, login({ email: "FABRICA.NOVA" })),
      ),
    ).toBe("user_email_taken");
    // Entra digitando só o nome de usuário (sem distinguir maiúsculas).
    expect((await signIn("Fabrica.Nova", "abc23456")).id).toBe(created.id);
    expect(await code(() => signIn("fabrica.nova", "senha-errada"))).not.toBe(
      "ok",
    );
    expect(await code(() => signIn("nao existe", "abc23456"))).not.toBe("ok");
    // Quem tem e-mail continua entrando por ele.
    expect((await signIn("ADMIN@wellmix.com", "wellmix123")).id).toBe(admin.id);
    const log = await getStore().list("audit_log", {
      filter: { action: "user.create", entityId: created.id },
    });
    expect(log[0].summary).toContain("fabrica.nova (supplier)");
    expect(log[0].summary).not.toContain("@");
  });

  it("senha sugerida: tamanho mínimo e sem caracteres que se confundem", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const password = suggestPassword();
      expect(password).toMatch(/^[a-hj-km-np-z2-9]{10}$/);
      seen.add(password);
    }
    expect(seen.size).toBeGreaterThan(15);
  });

  it("login desativado não conta: o fornecedor volta a aparecer sem acesso", async () => {
    const users = await getStore().list("users", {
      filter: { partyId: factory.id },
    });
    expect(users.length).toBe(2);
    for (const user of users)
      await getStore().update("users", user.id, { active: false });
    expect(await partiesWithoutLogin([factory.id])).toEqual(
      new Set([factory.id]),
    );
  });
});
