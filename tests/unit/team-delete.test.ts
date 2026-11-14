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
const requests = await import("@/lib/services/requests");
const { orderFromRequest } = await import("./helpers/order");
type User = import("@/lib/db").User;

const PASSWORD = "senha-forte-1";
let admin: User;
let operator: User;
let joao: User;

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

/** Aperta "Excluir acesso" (com as caixas marcadas) e devolve o destino. */
async function deleteVia(
  userId: string,
  checked: Array<"moveReports" | "redistribute"> = [],
) {
  const form = new FormData();
  form.set("userId", userId);
  for (const name of checked) form.set(name, "on");
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
  joao = users.find((u) => u.email === "joao@lojista.com")!;
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

  it("sem o registro na Auditoria, a exclusão é desfeita", async () => {
    const store = getStore();
    const target = await newLogin("Hugo Compras", "hugo@wellmix.com");
    const original = store.create.bind(store) as (
      table: string,
      data: Record<string, unknown>,
    ) => Promise<unknown>;
    const spy = vi.spyOn(store, "create").mockImplementation((async (
      table: string,
      data: Record<string, unknown>,
    ) => {
      if (table === "audit_log") throw new Error("banco fora do ar");
      return original(table, data);
    }) as never);
    try {
      expect(await code(() => team.removeTeamMember(admin, target.id))).toBe(
        "banco fora do ar",
      );
    } finally {
      spy.mockRestore();
    }
    // A lista segue o que está gravado: a pessoa continua com o acesso.
    expect((await store.get("users", target.id))?.active).toBe(true);
    expect((await team.wellmixTeam()).some((u) => u.id === target.id)).toBe(
      true,
    );
    expect(await deletions(target.id)).toHaveLength(0);
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

/*
 * Opções da confirmação (pedido do dono, 14/11/2026): quem respondia à pessoa
 * passa para o chefe dela; as pendências abertas dela vão para a divisão da
 * linha de cada produto, como "Distribuir agora", só as dela.
 */
describe("Excluir acesso: opções da confirmação", () => {
  const store = () => getStore();
  const reload = async (u: { id: string }) =>
    (await store().get("users", u.id))!;
  const place = (
    u: User,
    managerUserId: string | null,
    division: "wellmix" | null = null,
  ) =>
    team.setTeamMember(admin, u.id, {
      jobLevel: division ? "analyst" : null,
      managerUserId,
      division,
    });
  /** Solicitação aberta (do catálogo ou não) que está com `owner`. */
  async function openRequest(
    name: string,
    owner: User,
    productId: string | null,
  ) {
    const created = await requests.createRequest(joao, {
      customerId: "cliente-joao",
      productId,
      productName: name,
      description: name,
      specification: null,
      quantity: 1000,
      unit: "un",
      deadline: null,
      notes: null,
    });
    return store().update("requests", created.id, { ownerUserId: owner.id });
  }

  it("passa quem respondia a ela para o chefe dela, com a Auditoria", async () => {
    const boss = await newLogin("Irene Gerente", "irene@wellmix.com");
    const target = await newLogin("Joana Coordenadora", "joana@wellmix.com");
    const r1 = await newLogin("Kauã Analista", "kaua@wellmix.com");
    const r2 = await newLogin("Lia Analista", "lia@wellmix.com");
    await place(target, boss.id);
    await place(r1, target.id, "wellmix");
    await place(r2, target.id, "wellmix");

    const before = await team.teamMemberRemoval(
      await reload(target),
      await team.wellmixTeam(),
    );
    expect(before).toMatchObject({
      reports: 2,
      moveTo: { id: boss.id, name: "Irene Gerente" },
    });

    const done = await team.removeTeamMember(admin, target.id, {
      moveReports: true,
    });
    expect(done).toMatchObject({ moved: 2, redistributed: 0, unassigned: 0 });
    expect(done.movedTo?.id).toBe(boss.id);
    for (const r of [r1, r2])
      // Só o chefe muda: cargo e divisão ficam.
      expect(await reload(r)).toMatchObject({
        managerUserId: boss.id,
        jobLevel: "analyst",
        division: "wellmix",
        active: true,
      });
    const [moved] = (
      await store().list("audit_log", {
        filter: { entityId: r1.id, action: "team.member" },
        orderBy: "createdAt",
        direction: "desc",
        limit: 1,
      })
    ).filter((a) => a.userId === admin.id);
    expect(moved.before).toMatchObject({ managerUserId: target.id });
    expect(moved.after).toMatchObject({ managerUserId: boss.id });
  });

  it("sem chefe ativo, quem respondia a ela fica como estava", async () => {
    const target = await newLogin("Marta Sem Chefe", "marta@wellmix.com");
    const report = await newLogin("Nuno Analista", "nuno@wellmix.com");
    await place(report, target.id);
    expect(
      (
        await team.teamMemberRemoval(
          await reload(target),
          await team.wellmixTeam(),
        )
      ).moveTo,
    ).toBeNull();
    const done = await team.removeTeamMember(admin, target.id, {
      moveReports: true,
    });
    expect(done.moved).toBe(0);
    expect((await reload(report)).managerUserId).toBe(target.id);
  });

  it("redistribui só as pendências dela; sem para quem ir, conta e deixa", async () => {
    await team.setLineDivision(admin, "linha-utilidades", "wellmix");
    const analyst = await newLogin("Olga Analista", "olga@wellmix.com");
    await place(analyst, null, "wellmix");
    const target = await newLogin("Paula Compras", "paula@wellmix.com");
    const gone = await newLogin("Quim Antigo", "quim@wellmix.com");

    const jar1 = await openRequest("Jarra da Paula", target, "prod-jarra");
    const loose = await openRequest("Fora do catálogo", target, null);
    const ordered = await openRequest("Jarra pedida", target, "prod-jarra");
    const order = await orderFromRequest(admin, ordered);
    expect(order.ownerUserId).toBe(target.id);
    // De outro login que já saiu: fica para "Distribuir agora".
    const others = await openRequest("Jarra do Quim", gone, "prod-jarra");
    await store().update("users", gone.id, { active: false });

    const wellmix = async () =>
      new Set(
        (await team.wellmixTeam())
          .filter((u) => u.division === "wellmix")
          .map((u) => u.id),
      );
    // A jarra, a fora do catálogo e o pedido (a solicitação pedida já fechou).
    expect(
      (
        await team.teamMemberRemoval(
          await reload(target),
          await team.wellmixTeam(),
        )
      ).openWork,
    ).toBe(3);

    const done = await team.removeTeamMember(admin, target.id, {
      redistribute: true,
    });
    expect(done).toMatchObject({ redistributed: 2, unassigned: 1, moved: 0 });
    const division = await wellmix();
    expect(division.has(analyst.id)).toBe(true);
    expect(
      division.has((await store().get("requests", jar1.id))!.ownerUserId!),
    ).toBe(true);
    expect(
      division.has((await store().get("orders", order.id))!.ownerUserId!),
    ).toBe(true);
    // Sem divisão para o produto: continua com ela (sem responsável).
    expect((await store().get("requests", loose.id))!.ownerUserId).toBe(
      target.id,
    );
    // A de outro login não é mexida nesta passada.
    expect((await store().get("requests", others.id))!.ownerUserId).toBe(
      gone.id,
    );
    const [log] = await store().list("audit_log", {
      filter: { action: "team.distribute" },
      orderBy: "createdAt",
      direction: "desc",
      limit: 1,
    });
    expect(log.summary).toContain("Paula Compras");
  });

  it("se a passagem falhar, a exclusão fica e a tela diz o que conferir", async () => {
    const target = await newLogin("Rita Compras", "rita@wellmix.com");
    const s = store();
    const original = s.list.bind(s) as (
      table: string,
      options?: unknown,
    ) => Promise<unknown>;
    const spy = vi.spyOn(s, "list").mockImplementation((async (
      table: string,
      options?: unknown,
    ) => {
      if (table === "orders") throw new Error("banco fora do ar");
      return original(table, options);
    }) as never);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        await code(() =>
          team.removeTeamMember(admin, target.id, { redistribute: true }),
        ),
      ).toBe("delete_followup");
    } finally {
      spy.mockRestore();
      quiet.mockRestore();
    }
    expect((await reload(target)).active).toBe(false);
    expect(await deletions(target.id)).toHaveLength(1);
  });

  it("a tela leva o resumo para a lista", async () => {
    const boss = await newLogin("Sara Gerente", "sara@wellmix.com");
    const target = await newLogin("Téo Compras", "teo@wellmix.com");
    const report = await newLogin("Ugo Analista", "ugo@wellmix.com");
    await place(target, boss.id);
    await place(report, target.id);
    await openRequest("Fora do catálogo do Téo", target, null);

    await signInAs("admin@wellmix.com", DEMO_PASSWORD);
    expect(await deleteVia(target.id, ["moveReports", "redistribute"])).toBe(
      `/app/team?saved=deleted&reports=1&to=${boss.id}&left=1`,
    );
    expect((await reload(report)).managerUserId).toBe(boss.id);
  });
});
