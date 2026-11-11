import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Troca da própria senha e primeiro acesso com senha provisória (modo
 * memória): a senha atual é conferida, a nova segue as regras e a marca de
 * primeiro acesso some depois da troca.
 */
withTempStore();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Map(),
}));

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { verifyPassword } = await import("@/lib/auth/password");
const { newPasswordError } = await import("@/lib/password-rules");
const { createPortalLogin } = await import("@/lib/services/portal-access");
const { changeOwnPassword, PasswordChangeError } =
  await import("@/lib/services/password-change");
type User = import("@/lib/db").User;

let admin: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("regras da senha nova", () => {
  it("curta, igual à atual e confirmação diferente são recusadas", () => {
    const base = {
      current: "12345678",
      next: "nova-senha-1",
      confirm: "nova-senha-1",
    };
    expect(newPasswordError(base)).toBeNull();
    expect(newPasswordError({ ...base, next: "curta", confirm: "curta" })).toBe(
      "password_short",
    );
    expect(
      newPasswordError({ ...base, next: "12345678", confirm: "12345678" }),
    ).toBe("password_same");
    expect(newPasswordError({ ...base, confirm: "outra-senha-1" })).toBe(
      "password_mismatch",
    );
    expect(
      newPasswordError({
        ...base,
        next: "a".repeat(129),
        confirm: "a".repeat(129),
      }),
    ).toBe("password_long");
  });
});

describe("primeiro acesso com senha provisória", () => {
  it("o login master nasce com a marca, troca a senha e a marca some", async () => {
    const master = await createPortalLogin(admin, {
      partyId: null,
      email: "well_wellmix@wellmix.com",
      name: "Master Wellmix",
      role: "admin",
      locale: "pt",
      password: "12345678",
      mustChangePassword: true,
    });
    expect(master.role).toBe("admin");
    expect(master.mustChangePassword).toBe(true);

    // Senha atual errada: nada muda.
    await expect(
      changeOwnPassword(master, {
        current: "errada-123",
        next: "senha-nova-1",
        confirm: "senha-nova-1",
      }),
    ).rejects.toMatchObject({ code: "password_wrong" });
    // A provisória não pode continuar.
    await expect(
      changeOwnPassword(master, {
        current: "12345678",
        next: "12345678",
        confirm: "12345678",
      }),
    ).rejects.toBeInstanceOf(PasswordChangeError);
    let stored = await getStore().get("users", master.id);
    expect(stored!.mustChangePassword).toBe(true);

    await changeOwnPassword(master, {
      current: "12345678",
      next: "senha-nova-1",
      confirm: "senha-nova-1",
    });
    stored = await getStore().get("users", master.id);
    expect(stored!.mustChangePassword).toBe(false);
    expect(verifyPassword("senha-nova-1", stored!.passwordHash)).toBe(true);
    expect(verifyPassword("12345678", stored!.passwordHash)).toBe(false);
  });

  it("login comum não nasce com a marca e troca a senha quando quiser", async () => {
    const before = await getStore().get("users", admin.id);
    expect(before!.mustChangePassword ?? false).toBe(false);
  });
});
