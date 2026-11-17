import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Rascunho do Novo parceiro no banco, por login (docs/EQUIPE_ACESSOS.md,
 * D11): guarda só os campos de texto, cada login vê só o dele, vazio apaga,
 * "Descartar" e salvar o cadastro limpam; quem não abre Parceiros não grava.
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
const drafts = await import("@/lib/services/form-drafts");
const { savePartyDraftAction, discardPartyDraftAction } =
  await import("@/app/app/actions/form-drafts");
const { savePartyAction } = await import("@/app/app/actions");
type User = import("@/lib/db").User;

let admin: User;
let buyer: User;
const userOf = async (email: string) =>
  (await getStore().list("users", { filter: { email } }))[0]!;

async function as(email: string) {
  jar.clear();
  await session.signIn(email, DEMO_PASSWORD);
}

const swallow = (error: Error) => {
  if (!error.message.startsWith("REDIRECT")) throw error;
};

beforeAll(async () => {
  await seedDemo();
  admin = await userOf("admin@wellmix.com");
  buyer = await userOf("operador@wellmix.com");
});

describe("rascunho de formulário (serviço)", () => {
  it("guarda só os campos do cadastro; cada login vê o dele; vazio apaga", async () => {
    await drafts.saveFormDraft(admin, "party-new:partner", {
      name: "Fornecedor X",
      notes: "x".repeat(3000),
      password: "nunca",
    });
    const mine = await drafts.loadFormDraft(admin, "party-new:partner");
    expect(mine?.payload.name).toBe("Fornecedor X");
    expect(mine?.payload.notes).toHaveLength(2000);
    expect(mine?.payload).not.toHaveProperty("password");
    // Outro login, outro rascunho.
    expect(await drafts.loadFormDraft(buyer, "party-new:partner")).toBeNull();
    // O de cliente é outro formulário.
    expect(await drafts.loadFormDraft(admin, "party-new:customer")).toBeNull();
    await drafts.saveFormDraft(admin, "party-new:partner", { name: "  " });
    expect(await drafts.loadFormDraft(admin, "party-new:partner")).toBeNull();
  });
});

describe("rascunho de formulário (ações)", () => {
  it("quem não abre Parceiros não grava; quem abre grava o dele", async () => {
    await as("vendas@wellmix.com");
    expect(
      await savePartyDraftAction({
        form: "party-new:partner",
        values: { name: "Não" },
      }),
    ).toEqual({ ok: false, savedAt: null });
    await as("joao@lojista.com");
    expect(
      (
        await savePartyDraftAction({
          form: "party-new:partner",
          values: { name: "Não" },
        })
      ).ok,
    ).toBe(false);
    await as("operador@wellmix.com");
    const saved = await savePartyDraftAction({
      form: "party-new:partner",
      values: { name: "Parceiro do comprador" },
    });
    expect(saved.ok).toBe(true);
    expect(
      (await drafts.loadFormDraft(buyer, "party-new:partner"))?.payload.name,
    ).toBe("Parceiro do comprador");
    // Formulário desconhecido: recusado.
    expect(
      (await savePartyDraftAction({ form: "outro", values: { name: "x" } })).ok,
    ).toBe(false);
  });

  it("Descartar apaga e volta ao formulário; salvar o cadastro também limpa", async () => {
    await as("operador@wellmix.com");
    const form = new FormData();
    form.set("form", "party-new:partner");
    form.set("back", "/app/parties/new");
    redirects.length = 0;
    await discardPartyDraftAction(form).catch(swallow);
    expect(redirects.at(-1)).toBe("/app/parties/new");
    expect(await drafts.loadFormDraft(buyer, "party-new:partner")).toBeNull();

    await savePartyDraftAction({
      form: "party-new:supplier",
      values: { name: "Fornecedor Rascunho" },
    });
    const create = new FormData();
    create.set("type", "supplier");
    create.set("name", "Fornecedor Rascunho");
    create.set("draftForm", "party-new:supplier");
    redirects.length = 0;
    await savePartyAction(create).catch(swallow);
    expect(redirects.at(-1)).toMatch(/^\/app\/parties\/[^/?#]+#access$/);
    expect(await drafts.loadFormDraft(buyer, "party-new:supplier")).toBeNull();
  });
});
