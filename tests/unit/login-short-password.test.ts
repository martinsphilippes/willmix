import { beforeEach, describe, expect, it, vi } from "vitest";

const createSession = vi.fn();
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  dataMode: () => "appwrite",
}));
vi.mock("@/lib/db", () => ({
  getStore: () => ({
    list: async () => [
      { id: "u1", email: "admin@wellmix.com", active: true, role: "admin" },
    ],
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@/lib/appwrite/server", () => ({
  createAdminClient: () => ({
    account: { createEmailPasswordSession: createSession },
  }),
  sessionCookieName: () => "a_session",
}));

const { signIn, AuthError } = await import("@/lib/auth/session");

/* Appwrite só aceita senha com 8+ caracteres: senha curta é senha errada, não "banco fora". */
describe("login no Appwrite com senha curta", () => {
  beforeEach(() => {
    createSession.mockReset();
    createSession.mockResolvedValue({
      secret: "s",
      expire: new Date(Date.now() + 86_400_000).toISOString(),
    });
  });

  it("senha com menos de 8 caracteres é credencial inválida, sem chamar o Appwrite", async () => {
    await expect(signIn("admin@wellmix.com", "1234567")).rejects.toBeInstanceOf(
      AuthError,
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it("senha com 8+ caracteres segue para o Appwrite", async () => {
    await signIn("admin@wellmix.com", "wellmix123");
    expect(createSession).toHaveBeenCalledWith({
      email: "admin@wellmix.com",
      password: "wellmix123",
    });
  });
});
