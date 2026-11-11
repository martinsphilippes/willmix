import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Login pelo Supabase Auth (docs/SUPABASE.md, etapa 3): o Supabase confere a
 * senha, a sessão é o cookie assinado do portal, conta inativa não entra,
 * e "esqueci minha senha" / "nova senha" falam com o Auth do jeito certo.
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
  headers: async () =>
    new Headers({ host: "portal.wellmix.com", "x-forwarded-proto": "https" }),
}));
const redirects: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirects.push(to);
    throw new Error(`REDIRECT ${to}`);
  },
}));

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const session = await import("@/lib/auth/session");
const reset = await import("@/app/app/actions/password-reset");

const calls: Array<{
  path: string;
  method: string;
  body: unknown;
  auth: string;
}> = [];
function fakeAuth() {
  vi.stubGlobal("fetch", (async (
    input: RequestInfo | URL,
    init: RequestInit = {},
  ) => {
    const url = new URL(String(input));
    const body = init.body ? JSON.parse(String(init.body)) : null;
    const auth = (init.headers as Record<string, string>).Authorization;
    calls.push({
      path: url.pathname + url.search,
      method: init.method ?? "GET",
      body,
      auth,
    });
    const json = (v: unknown, status = 200) =>
      new Response(JSON.stringify(v), { status });
    if (url.pathname === "/auth/v1/token")
      return body.password === "senha-certa"
        ? json({ access_token: "a", refresh_token: "r" })
        : json({ error_code: "invalid_credentials" }, 400);
    if (url.pathname === "/auth/v1/recover") return json({});
    if (url.pathname === "/auth/v1/user")
      return auth === "Bearer token-do-link-valido-123456"
        ? json({ email: "admin@wellmix.com" })
        : json({ error_code: "bad_jwt" }, 401);
    return json({}, 404);
  }) as typeof fetch);
}

beforeAll(async () => {
  await seedDemo();
  process.env.DATA_MODE = "supabase";
  process.env.SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  delete process.env.SESSION_SECRET;
});
afterEach(() => {
  vi.unstubAllGlobals();
  calls.length = 0;
  redirects.length = 0;
});

describe("login pelo Supabase Auth", () => {
  it("senha certa entra com o cookie do portal; errada e inativo não", async () => {
    fakeAuth();
    const user = await session.signIn("admin@wellmix.com", "senha-certa");
    expect(user.email).toBe("admin@wellmix.com");
    expect(calls[0]).toMatchObject({
      path: "/auth/v1/token?grant_type=password",
      method: "POST",
      body: { email: "admin@wellmix.com", password: "senha-certa" },
      auth: "Bearer anon-key",
    });
    expect(jar.get(session.MEMORY_COOKIE)).toBeTruthy();
    expect((await session.getCurrentUser())?.email).toBe("admin@wellmix.com");

    jar.clear();
    await expect(
      session.signIn("admin@wellmix.com", "senha-errada"),
    ).rejects.toBeInstanceOf(session.AuthError);
    expect(jar.size).toBe(0);

    const op = (await getStore().list("users")).find(
      (u) => u.email === "operador@wellmix.com",
    )!;
    await getStore().update("users", op.id, { active: false });
    await expect(
      session.signIn("operador@wellmix.com", "senha-certa"),
    ).rejects.toBeInstanceOf(session.AuthError);
    await getStore().update("users", op.id, { active: true });
  });

  it("esqueci minha senha manda o link para /login/reset do próprio portal", async () => {
    fakeAuth();
    const form = new FormData();
    form.set("email", "admin@wellmix.com");
    await expect(reset.requestPasswordResetAction(form)).rejects.toThrow(
      "REDIRECT /login/forgot?sent=1",
    );
    expect(calls[0]).toMatchObject({
      path: `/auth/v1/recover?redirect_to=${encodeURIComponent("https://portal.wellmix.com/login/reset")}`,
      body: { email: "admin@wellmix.com" },
    });
  });

  it("nova senha com o token do link; token ruim e senhas diferentes recusam", async () => {
    fakeAuth();
    expect(
      await reset.setNewPasswordAction({
        token: "token-do-link-valido-123456",
        password: "nova-senha-1",
        confirm: "nova-senha-1",
      }),
    ).toEqual({ ok: true });
    expect(calls.at(-1)).toMatchObject({
      path: "/auth/v1/user",
      method: "PUT",
      body: { password: "nova-senha-1" },
    });
    expect(
      await reset.setNewPasswordAction({
        token: "token-vencido-xxxxxxxxxxxx",
        password: "nova-senha-1",
        confirm: "nova-senha-1",
      }),
    ).toEqual({ ok: false, error: "expired" });
    expect(
      await reset.setNewPasswordAction({
        token: "token-do-link-valido-123456",
        password: "nova-senha-1",
        confirm: "outra-senha-1",
      }),
    ).toEqual({ ok: false, error: "mismatch" });
    expect(
      await reset.setNewPasswordAction({
        token: "token-do-link-valido-123456",
        password: "curta",
        confirm: "curta",
      }),
    ).toEqual({ ok: false, error: "short" });
  });
});
