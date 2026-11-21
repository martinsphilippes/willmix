import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Gerar o login do parceiro na tela da Estratégia de compra (dono,
 * 20/11/2026; docs/PURCHASE_DEMAND.md, "Login do parceiro na Estratégia"):
 * o parceiro "Sem login ativo" ganha o acesso ali mesmo, com login, nome,
 * senha e idioma sugeridos e o papel pelo tipo; criado, ele fica Apto a
 * receber a cotação. Só o administrador.
 */
withTempStore();

const { getStore, PARTY_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { translator } = await import("@/i18n");
const { checkRecipients } = await import("@/lib/services/purchase-recipients");
const { createPartnerLogin, localeForCountry, partnerLoginSuggestion } =
  await import("@/lib/services/partner-login");
const { loginLabel } = await import("@/lib/auth/login-id");
type User = import("@/lib/db").User;
type Party = import("@/lib/db").Party;

let admin: User;
let operator: User;
let supplier: Party;
let noEmail: Party;
const t = translator("pt");

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "ok";
};

async function partner(input: {
  name: string;
  email: string | null;
  country: string;
  contactName?: string | null;
}) {
  return getStore().create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "supplier",
    name: input.name,
    country: input.country,
    email: input.email,
    phone: null,
    taxId: null,
    notes: null,
    city: null,
    address: null,
    contactName: input.contactName ?? null,
    wechat: null,
    storeNumber: null,
    active: true,
  } as never) as Promise<Party>;
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  supplier = await partner({
    name: "Big Tree International",
    email: "Sales@BigTree.cn",
    country: "China",
    contactName: "Lily Chen",
  });
  noEmail = await partner({
    name: "Huada Toys",
    email: null,
    country: "Vietnã",
  });
});

describe("login do parceiro na Estratégia de compra", () => {
  it("sugere o e-mail do cadastro, o contato, uma senha e o idioma pelo país", async () => {
    const s = await partnerLoginSuggestion(admin, supplier.id);
    expect(s).toMatchObject({
      login: "sales@bigtree.cn",
      name: "Lily Chen",
      locale: "zh",
    });
    expect(s.password.length).toBeGreaterThanOrEqual(8);
    // Sem e-mail: um nome de usuário pelo nome; fora da China e do Brasil,
    // em inglês.
    const other = await partnerLoginSuggestion(admin, noEmail.id);
    expect(other).toMatchObject({
      login: "huada.toys",
      name: "Huada Toys",
      locale: "en",
    });
    expect(localeForCountry("Brasil")).toBe("pt");
    expect(localeForCountry(null)).toBe("pt");
  });

  it("cria o login com o papel do tipo e a troca no 1º acesso; o parceiro fica Apto", async () => {
    const before = (await checkRecipients([supplier.id], t)).get(supplier.id);
    expect(before?.issues).toContain("no_login");
    expect(before?.ok).toBe(false);
    const created = await createPartnerLogin(admin, supplier.id, {
      login: "sales@bigtree.cn",
      name: "Lily Chen",
      password: "provisoria-7",
      locale: "zh",
    });
    expect(created).toMatchObject({
      role: "supplier",
      partyId: supplier.id,
      locale: "zh",
      active: true,
      mustChangePassword: true,
    });
    expect(loginLabel(created.email)).toBe("sales@bigtree.cn");
    const after = (await checkRecipients([supplier.id], t)).get(supplier.id);
    expect(after?.issues ?? []).not.toContain("no_login");
    expect(after?.ok).toBe(true);
    // O e-mail já é login: a próxima sugestão não o repete.
    expect((await partnerLoginSuggestion(admin, supplier.id)).login).not.toBe(
      "sales@bigtree.cn",
    );
  });

  it("só o administrador; cliente não; login já usado e senha curta são recusados", async () => {
    const input = {
      login: "outro@huada.vn",
      name: "Huada",
      password: "provisoria-8",
      locale: "en" as const,
    };
    expect(
      await code(() => createPartnerLogin(operator, noEmail.id, input)),
    ).toBe("forbidden");
    expect(await code(() => partnerLoginSuggestion(operator, noEmail.id))).toBe(
      "forbidden",
    );
    expect(
      await code(() => createPartnerLogin(admin, "cliente-joao", input)),
    ).toBe("not_found");
    expect(
      await code(() =>
        createPartnerLogin(admin, noEmail.id, {
          ...input,
          login: "sales@bigtree.cn",
        }),
      ),
    ).toBe("user_email_taken");
    expect(
      await code(() =>
        createPartnerLogin(admin, noEmail.id, { ...input, password: "curta" }),
      ),
    ).toBe("user_password_short");
  });
});
