import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";
import {
  accessBlockOf,
  parseAccessRules,
  DEFAULT_ACCESS_RULES,
} from "@/lib/access-state";

/*
 * Estados de cadastro e login (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md,
 * R7): o login e o cadastro têm estados próprios; só entra com os dois
 * ativos (o cadastro, com a regra ligada pelo administrador). Com a senha
 * certa, a entrada diz o motivo; com a errada, a resposta é a de sempre. A
 * sessão aberta cai na próxima página. Desativar, reativar e a regra: só o
 * administrador, com a Auditoria.
 */
withTempStore();

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { DEMO_PASSWORD } = await import("@/lib/demo-data");
const session = await import("@/lib/auth/session");
const access = await import("@/lib/services/access-state");
type User = import("@/lib/db").User;

let admin: User;
let buyer: User;
const userOf = async (email: string) =>
  (await getStore().list("users", { filter: { email } }))[0]!;

/** O código da recusa na entrada (ou "ok" quando entra). */
async function signInCode(email: string, password = DEMO_PASSWORD) {
  jar.clear();
  try {
    await session.signIn(email, password);
    return "ok";
  } catch (error) {
    if (error instanceof session.AuthError) return error.message;
    throw error;
  }
}

beforeAll(async () => {
  await seedDemo();
  admin = await userOf("admin@wellmix.com");
  buyer = await userOf("operador@wellmix.com");
});

describe("regra pura: os quatro cenários", () => {
  const rulesOn = { requireActiveParty: true };
  const rulesOff = { requireActiveParty: false };
  const partner = (active: boolean) => ({ active, partyId: "p1" });
  it("com a regra ligada: cadastro e login", () => {
    expect(accessBlockOf(partner(true), { active: true }, rulesOn)).toBeNull();
    expect(accessBlockOf(partner(false), { active: true }, rulesOn)).toBe(
      "login_inactive",
    );
    expect(accessBlockOf(partner(true), { active: false }, rulesOn)).toBe(
      "party_inactive",
    );
    expect(accessBlockOf(partner(false), { active: false }, rulesOn)).toBe(
      "blocked_both",
    );
  });
  it("com a regra desligada o cadastro não bloqueia (como antes)", () => {
    expect(
      accessBlockOf(partner(true), { active: false }, rulesOff),
    ).toBeNull();
    expect(accessBlockOf(partner(false), { active: false }, rulesOff)).toBe(
      "login_inactive",
    );
  });
  it("login da equipe (sem cadastro) e cadastro não achado não bloqueiam", () => {
    expect(
      accessBlockOf({ active: true, partyId: null }, null, rulesOn),
    ).toBeNull();
    expect(accessBlockOf(partner(true), null, rulesOn)).toBeNull();
  });
  it("a regra gravada, com o padrão para o que faltar", () => {
    expect(parseAccessRules(null)).toEqual(DEFAULT_ACCESS_RULES);
    expect(parseAccessRules({ requireActiveParty: "sim" })).toEqual(
      DEFAULT_ACCESS_RULES,
    );
    expect(
      parseAccessRules({
        requireActiveParty: true,
        changedAt: "2026-11-17T10:00:00.000Z",
        changedBy: "Ana",
      }),
    ).toEqual({
      requireActiveParty: true,
      changedAt: "2026-11-17T10:00:00.000Z",
      changedBy: "Ana",
    });
  });
});

describe("desativar e reativar login de parceiro", () => {
  it("só o administrador; login da equipe fica de fora", async () => {
    const supplier = await userOf("supplier.a@china.com");
    await expect(
      access.setPartnerLoginActive(buyer, supplier.id, false),
    ).rejects.toThrow("forbidden");
    await expect(
      access.setPartnerLoginActive(admin, buyer.id, false),
    ).rejects.toThrow("not_found");
    expect((await userOf("supplier.a@china.com")).active).toBe(true);
  });

  it("desativado: a sessão aberta cai, a entrada diz o motivo com a senha certa e reativar libera", async () => {
    const email = "supplier.a@china.com";
    const supplier = await userOf(email);
    // Sessão aberta antes.
    jar.clear();
    await session.signIn(email, DEMO_PASSWORD);
    expect((await session.getCurrentUser())?.id).toBe(supplier.id);

    await access.setPartnerLoginActive(admin, supplier.id, false);
    // A próxima página não abre; a tela de entrada sabe por quê.
    expect(await session.getCurrentUser()).toBeNull();
    expect(await session.sessionBlock()).toBe("login_inactive");
    // Senha certa: o motivo. Senha errada: a resposta de sempre.
    expect(await signInCode(email)).toBe("login_inactive");
    expect(await signInCode(email, "senha-errada-123")).toBe("invalid");
    // Auditoria.
    const log = await getStore().list("audit_log", {
      filter: { entityId: supplier.id, action: "user.deactivate" },
    });
    expect(log).toHaveLength(1);
    expect(log[0]!.userId).toBe(admin.id);

    await access.setPartnerLoginActive(admin, supplier.id, true);
    expect(await signInCode(email)).toBe("ok");
  });
});

describe("regra cadastro e login ativos (ligada pelo administrador)", () => {
  it("antes de ligar, quem seria bloqueado; ligada, bloqueia; desligada, volta", async () => {
    const email = "supplier.c@china.com";
    const login = await userOf(email);
    await getStore().update("parties", login.partyId!, { active: false });

    // Desligada: o cadastro inativo ainda entra (como antes).
    expect(await signInCode(email)).toBe("ok");
    expect(
      (await access.inactivePartyLogins()).map((a) => a.party.id),
    ).toContain(login.partyId);

    // Só o administrador liga.
    await expect(access.setRequireActiveParty(buyer, true)).rejects.toThrow(
      "forbidden",
    );
    jar.clear();
    await session.signIn(email, DEMO_PASSWORD);
    const { blockedLogins } = await access.setRequireActiveParty(admin, true);
    expect(blockedLogins).toBeGreaterThanOrEqual(1);
    // A sessão aberta cai e a entrada diz o motivo.
    expect(await session.getCurrentUser()).toBeNull();
    expect(await session.sessionBlock()).toBe("party_inactive");
    expect(await signInCode(email)).toBe("party_inactive");
    // Os dois inativos.
    await access.setPartnerLoginActive(admin, login.id, false);
    expect(await signInCode(email)).toBe("blocked_both");
    // Reativar só o login: continua bloqueado pelo cadastro.
    await access.setPartnerLoginActive(admin, login.id, true);
    expect(await signInCode(email)).toBe("party_inactive");
    // Login da equipe não depende de cadastro.
    expect(await signInCode("operador@wellmix.com")).toBe("ok");
    // Reativar o cadastro libera.
    await getStore().update("parties", login.partyId!, { active: true });
    expect(await signInCode(email)).toBe("ok");

    const rule = await getStore().list("audit_log", {
      filter: { action: "access.rule_on" },
    });
    expect(rule).toHaveLength(1);
    expect(rule[0]!.userId).toBe(admin.id);

    await access.setRequireActiveParty(admin, false);
    await getStore().update("parties", login.partyId!, { active: false });
    expect(await signInCode(email)).toBe("ok");
    await getStore().update("parties", login.partyId!, { active: true });
  });
});
