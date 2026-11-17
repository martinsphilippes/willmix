import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Prévia de impacto antes de salvar uma função (docs/EQUIPE_ACESSOS.md, R1 e
 * etapa 5b): só o administrador consulta e grava; a prévia não grava nada; ao
 * salvar, a Auditoria guarda quem ganhou e quem perdeu.
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
const { previewFunctionImpactAction, saveFunctionPermissionsAction } =
  await import("@/app/app/actions/team");
const { loadFunctionDefs } = await import("@/lib/services/team-functions");
const { WELLMIX_BASE } = await import("@/lib/auth/screens");

beforeAll(async () => {
  await seedDemo();
});

async function as(email: string) {
  jar.clear();
  await session.signIn(email, DEMO_PASSWORD);
}

/** As marcas de hoje da função Comprador, sem a tela Avaliações (só ela libera ao operador de demonstração, que também é Planner). */
async function buyerWithoutOrders() {
  const buyer = (await loadFunctionDefs()).find((d) => d.key === "buyer")!;
  return {
    screens: [
      ...WELLMIX_BASE.filter((s) => !buyer.baseOff.includes(s)),
      ...buyer.screens,
    ].filter((s) => s !== "reviews"),
    actions: [...buyer.actions],
  };
}

describe("prévia de impacto de uma função", () => {
  it("quem não é administrador não consulta", async () => {
    await as("operador@wellmix.com");
    const draft = await buyerWithoutOrders();
    expect(
      await previewFunctionImpactAction({ key: "buyer", ...draft }),
    ).toEqual({ ok: false });
  });

  it("o administrador vê quem perde, sem gravar; ao salvar, a Auditoria guarda", async () => {
    await as("admin@wellmix.com");
    const draft = await buyerWithoutOrders();
    const result = await previewFunctionImpactAction({
      key: "buyer",
      ...draft,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const operador = (
      await getStore().list("users", {
        filter: { email: "operador@wellmix.com" },
      })
    )[0]!;
    const row = result.impact.rows.find((r) => r.id === operador.id);
    expect(row?.lostScreens).toEqual(["reviews"]);
    // Nada gravado: a função continua com Avaliações.
    const buyer = (await loadFunctionDefs()).find((d) => d.key === "buyer")!;
    expect(buyer.screens).toContain("reviews");

    // Salvar grava e a Auditoria leva quem foi afetado.
    const form = new FormData();
    form.set("key", "buyer");
    draft.screens.forEach((s) => form.append("screens", s));
    draft.actions.forEach((a) => form.append("actions", a));
    const saved = await saveFunctionPermissionsAction(
      { ok: false, error: null, message: null, savedAt: null },
      form,
    );
    expect(saved.ok).toBe(true);
    const [log] = await getStore().list("audit_log", {
      filter: { action: "team.function_permissions" },
    });
    const after = log!.after as { impact: { id: string }[]; holders: number };
    expect(after.holders).toBeGreaterThan(0);
    expect(after.impact.map((r) => r.id)).toContain(operador.id);
  });
});
