import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppwriteException } from "node-appwrite";

const signIn = vi.fn();
vi.mock("@/lib/auth/session", () => {
  class AuthError extends Error {}
  return {
    AuthError,
    signIn: (...a: unknown[]) => signIn(...a),
    signOut: vi.fn(),
  };
});

const { POST } = await import("@/app/api/auth/session/route");
const { AuthError } = await import("@/lib/auth/session");

function login() {
  return POST(
    new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@wellmix.com", password: "secret1" }),
    }),
  );
}

/* Rota de login: senha errada (401), banco fora (503) e banco pausado (503 + code "paused"). */
describe("rota de login", () => {
  beforeEach(() => {
    signIn.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("banco pausado responde 503 com code paused", async () => {
    signIn.mockRejectedValue(
      new AppwriteException(
        "Project is paused due to inactivity. Please restore it from the console to resume operations.",
        403,
        "project_paused",
        "",
      ),
    );
    const res = await login();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "paused" });
  });

  it("outra falha do banco responde 503 com code unavailable", async () => {
    signIn.mockRejectedValue(
      new AppwriteException("boom", 500, "general_unknown", ""),
    );
    const res = await login();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "unavailable" });
  });

  it("senha errada continua 401, sem revelar o estado do banco", async () => {
    signIn.mockRejectedValue(new AuthError("invalid"));
    const res = await login();
    expect(res.status).toBe(401);
    expect(await res.json()).not.toHaveProperty("code");
  });
});
