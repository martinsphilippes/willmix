import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Excluir acesso (Equipe e acessos → acessos de uma pessoa): só o
 * administrador; não exclui o próprio acesso, um login de fora da equipe nem
 * o último administrador ativo. O login fica inativo: sai da equipe, não
 * entra mais e a sessão aberta cai na próxima página. Nada é apagado
 * (cadastro, histórico, autoria) e a exclusão fica na Auditoria.
 */
withTempStore();

// O cookie da sessão num pote de teste (signIn grava, getCurrentUser lê).
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
const redirects: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirects.push(to);
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { DEMO_PASSWORD } = await import("@/lib/demo-data");
const team = await import("@/lib/services/team");
const session = await import("@/lib/auth/session");
const { createPortalLogin } = await import("@/lib/services/portal-access");
const { audit } = await import("@/lib/services/audit");
const { removeTeamMemberAction } = await import("@/app/app/actions/team");
type User = import("@/lib/db").User;

const PASSWORD = "senha-forte-1";
let admin: User;
let operator: User;

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "ok";
};

const newLogin = (
  name: string,
  email: string,
  role: "operator" | "admin" = "operator",
) =>
  createPortalLogin(admin, {
    partyId: null,
    email,
    name,
    role,
    locale: "pt",
    password: PASSWORD,
  });

/** Entra como o navegador entra: o cookie da sessão fica no pote. */
async function signInAs(email: string, password = PASSWORD) {
  jar.clear();
  await session.signIn(email, password);
}

/** Aperta "Excluir acesso" e devolve para onde a tela foi. */
async function deleteVia(userId: string) {
  const form = new FormData();
  form.set("userId", userId);
  redirects.length = 0;
  await removeTeamMemberAction(form).catch((error: Error) => {
    if (!error.message.startsWith("REDIRECT")) throw error;
  });
  return redirects.at(-1);
}

const deletions = (entityId: string) =>
  getStore().list("audit_log", {
    filter: { entityId, action: "team.member.delete" },
  });

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
});

describe("Excluir acesso", () => {
  it("só o administrador exclui: o operador é recusado e nada muda", async () => {
    const target = await newLogin("Bruna Compras", "bruna@wellmix.com");
    expect(await code(() => team.removeTeamMember(operator, target.id))).toBe(
      "forbidden",
    );
    expect((await getStore().get("users", target.id))?.active).toBe(true);
    expect(await deletions(target.id)).toHaveLength(0);
  });

  it("não exclui o próprio acesso nem login de fora da equipe", async () => {
    expect(await code(() => team.removeTeamMember(admin, admin.id))).toBe(
      "delete_self",
    );
    const [supplier] = await getStore().list("users", {
      filter: { email: "supplier.a@china.com" },
    });
    expect(await code(() => team.removeTeamMember(admin, supplier.id))).toBe(
      "not_found",
    );
    expect(await code(() => team.removeTeamMember(admin, "nao-existe"))).toBe(
      "not_found",
    );
    expect((await getStore().get("users", supplier.id))?.active).toBe(true);
    expect((await getStore().get("users", admin.id))?.active).toBe(true);
  });

  it("exclui: sai da equipe, não entra mais, a sessão aberta cai e nada é apagado", async () => {
    const store = getStore();
    const target = await newLogin("Carla Compras", "carla@wellmix.com");
    await team.setTeamMember(admin, operator.id, {
      jobLevel: null,
      managerUserId: target.id,
      division: null,
    });
    // Algo feito por ela antes da exclusão: a autoria continua.
    await audit(target, "test.before", "user", target.id, "feito pela Carla");
    await signInAs("carla@wellmix.com");
    expect((await session.getCurrentUser())?.id).toBe(target.id);
    expect(
      await team.teamMemberRemoval(target, await team.wellmixTeam()),
    ).toMatchObject({ reports: 1, lastAdmin: false });

    await team.removeTeamMember(admin, target.id);

    // O cadastro continua (inativo), só sai da equipe.
    expect(await store.get("users", target.id)).toMatchObject({
      active: false,
      name: "Carla Compras",
      email: "carla@wellmix.com",
      role: "operator",
    });
    expect((await team.wellmixTeam()).some((u) => u.id === target.id)).toBe(
      false,
    );
    // A sessão que já estava aberta não abre a próxima página.
    expect(await session.getCurrentUser()).toBeNull();
    // E o login não entra de novo.
    jar.clear();
    await expect(
      session.signIn("carla@wellmix.com", PASSWORD),
    ).rejects.toBeInstanceOf(session.AuthError);
    // Histórico e autoria guardados; quem respondia a ela não foi mexido.
    const log = await store.list("audit_log", {
      filter: { entityId: target.id },
    });
    expect(log.find((a) => a.action === "test.before")?.userId).toBe(target.id);
    expect((await store.get("users", operator.id))?.managerUserId).toBe(
      target.id,
    );
    // Auditoria: quem excluiu, qual acesso e quando.
    const [entry] = await deletions(target.id);
    expect(entry).toMatchObject({
      userId: admin.id,
      entity: "user",
      entityId: target.id,
      summary: "Acesso excluído: Carla Compras (carla@wellmix.com)",
      after: { active: false },
    });
    expect(entry.before).toMatchObject({ active: true, role: "operator" });
    expect(Date.parse(entry.createdAt)).not.toBeNaN();
    // Os outros logins seguem como estavam.
    expect((await store.get("users", operator.id))?.active).toBe(true);
    await team.setTeamMember(admin, operator.id, {
      jobLevel: null,
      managerUserId: null,
      division: null,
    });
  });

  it("não deixa a equipe sem administrador ativo", async () => {
    const store = getStore();
    const second = await newLogin("Davi Diretor", "davi@wellmix.com", "admin");

    // Sessão antiga de um administrador que já saiu: o outro é o último ativo.
    await store.update("users", admin.id, { active: false });
    try {
      expect(await code(() => team.removeTeamMember(admin, second.id))).toBe(
        "delete_last_admin",
      );
      expect(
        (await team.teamMemberRemoval(second, await team.wellmixTeam()))
          .lastAdmin,
      ).toBe(true);
    } finally {
      await store.update("users", admin.id, { active: true });
    }

    // Dois administradores excluindo um ao outro ao mesmo tempo: a exclusão
    // que deixaria a equipe sem administrador é desfeita.
    const original = store.update.bind(store) as (
      table: string,
      id: string,
      patch: Record<string, unknown>,
    ) => Promise<unknown>;
    const spy = vi.spyOn(store, "update").mockImplementation((async (
      table: string,
      id: string,
      patch: Record<string, unknown>,
    ) => {
      const row = await original(table, id, patch);
      if (table === "users" && id === second.id && patch.active === false)
        await original("users", admin.id, { active: false });
      return row;
    }) as never);
    try {
      expect(await code(() => team.removeTeamMember(admin, second.id))).toBe(
        "delete_last_admin",
      );
    } finally {
      spy.mockRestore();
      await store.update("users", admin.id, { active: true });
    }
    expect((await store.get("users", second.id))?.active).toBe(true);
    expect(await deletions(second.id)).toHaveLength(0);

    // Com outro administrador ativo, o segundo sai normalmente.
    await team.removeTeamMember(admin, second.id);
    expect((await store.get("users", second.id))?.active).toBe(false);
    expect((await store.get("users", admin.id))?.active).toBe(true);
  });

  it("a tela volta à lista com a mensagem; com erro, mostra o motivo", async () => {
    const target = await newLogin("Elisa Compras", "elisa@wellmix.com");
    const other = await newLogin("Fábio Compras", "fabio@wellmix.com");

    await signInAs("admin@wellmix.com", DEMO_PASSWORD);
    expect(await deleteVia(target.id)).toBe("/app/team?saved=deleted");
    expect((await getStore().get("users", target.id))?.active).toBe(false);
    // De novo (já excluído em outra aba): volta com o motivo, sem duplicar.
    expect(await deleteVia(target.id)).toBe(
      `/app/team/${target.id}?error=not_found`,
    );
    expect(await deletions(target.id)).toHaveLength(1);
    expect(await deleteVia(admin.id)).toBe(
      `/app/team/${admin.id}?error=delete_self`,
    );
    expect(await deleteVia("../x")).toBe("/app/team?error=invalid_input");

    // Quem não é administrador é recusado no servidor.
    await signInAs("operador@wellmix.com", DEMO_PASSWORD);
    expect(await deleteVia(other.id)).toBe(
      `/app/team/${other.id}?error=forbidden`,
    );
    expect((await getStore().get("users", other.id))?.active).toBe(true);
    expect(await deletions(other.id)).toHaveLength(0);
  });
});
