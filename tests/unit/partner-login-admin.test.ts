import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Gerar login de parceiro ou de cliente é dar acesso ao portal: só o
 * administrador (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md, R5). A Server
 * Action recusa quem não é administrador mesmo chamada direto (sem a tela),
 * e nada é gravado.
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
const session = await import("@/lib/auth/session");
const { createUserAction } = await import("@/app/app/actions");

beforeAll(async () => {
  await seedDemo();
});

async function as(email: string) {
  jar.clear();
  await session.signIn(email, DEMO_PASSWORD);
}

async function createLogin(login: string) {
  const form = new FormData();
  form.set("partyId", "fornecedor-a");
  form.set("name", "Pessoa da fábrica");
  form.set("login", login);
  form.set("role", "supplier");
  form.set("locale", "zh");
  form.set("password", "senha-forte-123");
  redirects.length = 0;
  await createUserAction(form).catch((error: Error) => {
    if (!error.message.startsWith("REDIRECT")) throw error;
  });
  return redirects.at(-1) ?? "";
}

const loginExists = async (email: string) =>
  (await getStore().list("users", { filter: { email } })).length > 0;

describe("gerar login de parceiro: só o administrador", () => {
  it("o Comprador (abre Parceiros) é recusado no servidor e nada é criado", async () => {
    await as("operador@wellmix.com");
    const to = await createLogin("nova.pessoa@fabrica.cn");
    expect(to).toContain("error=forbidden");
    expect(await loginExists("nova.pessoa@fabrica.cn")).toBe(false);
  });

  it("o administrador gera o login, preso ao cadastro", async () => {
    await as("admin@wellmix.com");
    const to = await createLogin("outra.pessoa@fabrica.cn");
    expect(to).toContain("saved=user");
    const [user] = await getStore().list("users", {
      filter: { email: "outra.pessoa@fabrica.cn" },
    });
    expect(user?.partyId).toBe("fornecedor-a");
    expect(user?.role).toBe("supplier");
  });
});
