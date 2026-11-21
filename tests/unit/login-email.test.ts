import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Alterar o e-mail do login (dono, 20/11/2026; docs/EQUIPE_ACESSOS.md): o
 * administrador corrige o e-mail (ou o nome de usuário) de um login de
 * cliente ou parceiro. O login continua o mesmo (cadastro, papel e senha);
 * entra com o novo e o antigo deixa de entrar. No Supabase, a conta do Auth
 * troca de e-mail junto (achada pelo e-mail antigo).
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

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const session = await import("@/lib/auth/session");
const access = await import("@/lib/services/access-state");
const { createPortalLogin } = await import("@/lib/services/portal-access");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let joao: User;
let created: User;

const userOf = async (email: string) =>
  (await getStore().list("users", { filter: { email } }))[0]!;

/** O código da recusa na entrada (ou "ok" quando entra). */
async function signInCode(login: string, password: string) {
  jar.clear();
  try {
    await session.signIn(login, password);
    return "ok";
  } catch (error) {
    if (error instanceof session.AuthError) return error.message;
    throw error;
  }
}

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "ok";
};

beforeAll(async () => {
  await seedDemo();
  admin = await userOf("admin@wellmix.com");
  operator = await userOf("operador@wellmix.com");
  joao = await userOf("joao@lojista.com");
  // O login criado com o e-mail digitado errado ("gabrial").
  created = await createPortalLogin(admin, {
    partyId: joao.partyId!,
    email: "gabrial.teste@lojista.com",
    name: "Gabriela Teste",
    role: "customer",
    locale: "pt",
    password: "provisoria-9",
    mustChangePassword: true,
  });
});

describe("Alterar e-mail do login", () => {
  it("o administrador troca o e-mail: entra com o novo e a mesma senha; o antigo não entra mais", async () => {
    expect(await signInCode("gabrial.teste@lojista.com", "provisoria-9")).toBe(
      "ok",
    );
    const updated = await access.changeLoginEmail(
      admin,
      created.id,
      " Gabriela.Teste@Lojista.com ",
    );
    // O mesmo login: cadastro, papel, troca de senha e situação.
    expect(updated).toMatchObject({
      id: created.id,
      email: "gabriela.teste@lojista.com",
      role: "customer",
      partyId: joao.partyId,
      active: true,
      mustChangePassword: true,
    });
    expect(await signInCode("gabriela.teste@lojista.com", "provisoria-9")).toBe(
      "ok",
    );
    expect(await signInCode("gabrial.teste@lojista.com", "provisoria-9")).toBe(
      "invalid",
    );
    // A Auditoria registra o antes e o depois (sem senha).
    const log = (
      await getStore().list("audit_log", { filter: { entityId: created.id } })
    ).find((l) => l.action === "user.email");
    expect(log?.summary).toContain(
      "gabrial.teste@lojista.com → gabriela.teste@lojista.com",
    );
    expect(log?.summary).not.toContain("provisoria-9");
  });

  it("também para um nome de usuário (login sem e-mail)", async () => {
    await access.changeLoginEmail(admin, created.id, "gabriela.loja");
    expect(await signInCode("gabriela.loja", "provisoria-9")).toBe("ok");
    // E de volta para um e-mail.
    await access.changeLoginEmail(
      admin,
      created.id,
      "gabriela.teste@lojista.com",
    );
    expect(await signInCode("gabriela.teste@lojista.com", "provisoria-9")).toBe(
      "ok",
    );
  });

  it("recusas: só o administrador, só login de cliente ou parceiro, login válido, diferente e sem dono", async () => {
    expect(
      await code(() =>
        access.changeLoginEmail(operator, created.id, "outro@lojista.com"),
      ),
    ).toBe("forbidden");
    // Login da equipe (e o do administrador): pela Equipe Interna, não aqui.
    expect(
      await code(() =>
        access.changeLoginEmail(admin, operator.id, "outro@wellmix.com"),
      ),
    ).toBe("not_found");
    expect(
      await code(() =>
        access.changeLoginEmail(admin, admin.id, "outro@wellmix.com"),
      ),
    ).toBe("not_found");
    expect(
      await code(() =>
        access.changeLoginEmail(admin, created.id, "com espaço"),
      ),
    ).toBe("user_login_invalid");
    expect(
      await code(() =>
        access.changeLoginEmail(
          admin,
          created.id,
          "GABRIELA.TESTE@lojista.com",
        ),
      ),
    ).toBe("login_email_same");
    expect(
      await code(() =>
        access.changeLoginEmail(admin, created.id, "joao@lojista.com"),
      ),
    ).toBe("user_email_taken");
    // Nada mudou com as recusas.
    expect((await getStore().get("users", created.id))?.email).toBe(
      "gabriela.teste@lojista.com",
    );
  });
});

describe("a conta do Supabase Auth troca junto", () => {
  const env = { ...process.env };
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...env };
  });

  /** Um Auth de mentira: a lista de contas e a troca do e-mail. */
  function fakeAuth(options: {
    accounts: { id: string; email: string }[];
    filter?: boolean;
    taken?: boolean;
  }) {
    process.env.SUPABASE_URL = "https://auth.exemplo.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-de-teste";
    const calls: { method: string; url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init: RequestInit) => {
        const url = new URL(input);
        const method = init.method ?? "GET";
        calls.push({
          method,
          url: url.pathname + url.search,
          body: init.body ? JSON.parse(String(init.body)) : null,
        });
        const json = (status: number, body: unknown) =>
          new Response(JSON.stringify(body), { status });
        if (method === "GET" && url.pathname === "/auth/v1/admin/users") {
          const page = Number(url.searchParams.get("page"));
          const perPage = Number(url.searchParams.get("per_page"));
          const filter = url.searchParams.get("filter") ?? "";
          const list = options.filter
            ? options.accounts.filter((a) => a.email.includes(filter))
            : options.accounts;
          return json(200, {
            users: list.slice((page - 1) * perPage, page * perPage),
          });
        }
        if (method === "PUT") {
          if (options.taken) return json(422, { error_code: "email_exists" });
          return json(200, { id: url.pathname.split("/").pop() });
        }
        return json(404, { error_code: "not_found" });
      }),
    );
    return calls;
  }

  it("acha a conta pelo e-mail antigo e grava o novo, já confirmado", async () => {
    const auth = await import("@/lib/auth/supabase-auth");
    const calls = fakeAuth({
      filter: true,
      accounts: [
        { id: "a1", email: "outra@loja.com" },
        { id: "a2", email: "gabrial@loja.com" },
      ],
    });
    expect(
      await auth.supabaseChangeEmail("gabrial@loja.com", "gabriela@loja.com"),
    ).toBe("ok");
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.url).toBe("/auth/v1/admin/users/a2");
    expect(put?.body).toEqual({
      email: "gabriela@loja.com",
      email_confirm: true,
    });
  });

  it("sem o filtro no Auth: percorre as páginas até achar", async () => {
    const auth = await import("@/lib/auth/supabase-auth");
    const many = Array.from({ length: 1000 }, (_, i) => ({
      id: `x${i}`,
      email: `pessoa${i}@loja.com`,
    }));
    const calls = fakeAuth({
      filter: false,
      accounts: [...many, { id: "alvo", email: "gabrial@loja.com" }],
    });
    expect(await auth.supabaseUserIdByEmail("Gabrial@Loja.com")).toBe("alvo");
    expect(calls.filter((c) => c.method === "GET")).toHaveLength(2);
  });

  it("sem conta com o e-mail antigo: 'missing', sem gravar; e-mail novo de outra conta: recusa", async () => {
    const auth = await import("@/lib/auth/supabase-auth");
    const calls = fakeAuth({ filter: true, accounts: [] });
    expect(
      await auth.supabaseChangeEmail("ninguem@loja.com", "novo@loja.com"),
    ).toBe("missing");
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
    fakeAuth({
      filter: true,
      taken: true,
      accounts: [{ id: "a2", email: "gabrial@loja.com" }],
    });
    expect(
      await code(() =>
        auth.supabaseChangeEmail("gabrial@loja.com", "joao@loja.com"),
      ),
    ).toBe("user_email_taken");
  });
});
