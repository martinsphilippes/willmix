import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Cadastro rápido de cliente pelo "+" da Nova solicitação (dono, 21/11/2026;
 * docs/ORDER_TERMS.md, seção 11.25):
 * - grava como a carga do Sankhya (CNPJ só com dígitos, BRASIL, "CIDADE -
 *   UF", pessoa jurídica) e devolve a escolha do campo Cliente;
 * - CNPJ que já é de um cliente (com ou sem máscara) não cria outro;
 * - CNPJ, nome e e-mail conferidos no servidor;
 * - quem lança a solicitação cadastra (Vendas também); quem é de fora ou não
 *   abre a Nova solicitação, não.
 */
const h = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Map(),
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.current,
}));

withTempStore();

const { getStore, PARTY_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { formatCnpj } = await import("@/lib/order-terms");
const { findCustomerByCnpjAction, quickCustomerAction } =
  await import("@/app/app/actions/quick-customer");
type User = import("@/lib/db").User;

let admin: User;
let vendas: User;
let finance: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  vendas = by("vendas@wellmix.com");
  joao = by("joao@lojista.com");
  // Financeiro: login da Wellmix que não abre a Nova solicitação.
  finance = (await getStore().create("users", {
    ...by("operador@wellmix.com"),
    id: undefined,
    email: "financeiro.rapido@wellmix.com",
    name: "Financeiro",
    functions: ["finance"],
  } as never)) as User;
});

/** CNPJ válido a partir dos 12 primeiros dígitos. */
function cnpj(base: string): string {
  const d = base.split("").map(Number);
  const digit = (weights: number[]) => {
    const r = weights.reduce((a, w, i) => a + w * d[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  d.push(digit([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  d.push(digit([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  return d.join("");
}

async function customer(taxId: string, name: string, active = true) {
  return getStore().create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "customer",
    name,
    country: "BRASIL",
    email: null,
    phone: null,
    taxId,
    notes: null,
    active,
    sankhyaCode: "7777",
  });
}

describe("cadastro rápido de cliente", () => {
  it("Vendas cadastra: grava como a carga do Sankhya e devolve a escolha do campo Cliente", async () => {
    h.current = vendas;
    const doc = cnpj("112223330001");
    const result = await quickCustomerAction({
      cnpj: formatCnpj(doc),
      name: "  Mercado Rápido  ",
      legalName: "Mercado Rápido Comércio Ltda",
      city: "Campinas",
      state: "sp",
      phone: "(19) 3333-4444",
      email: "Compras@Mercado.com.br",
    });
    if (!result.ok) throw new Error(JSON.stringify(result));
    const party = await getStore().get("parties", result.customer.id);
    expect(party).toMatchObject({
      type: "customer",
      name: "Mercado Rápido",
      legalName: "Mercado Rápido Comércio Ltda",
      taxId: doc,
      personType: "J",
      country: "BRASIL",
      city: "CAMPINAS - SP",
      phone: "(19) 3333-4444",
      email: "compras@mercado.com.br",
      active: true,
    });
    expect(result.customer).toEqual({
      id: party!.id,
      name: "Mercado Rápido",
      code: null,
      hint: `${formatCnpj(doc)} · CAMPINAS - SP`,
      active: true,
    });
    const audit = await getStore().list("audit_log", {
      filter: { entityId: party!.id },
    });
    expect(audit.map((a) => [a.action, a.userId])).toContainEqual([
      "party.create",
      vendas.id,
    ]);
  });

  it("CNPJ que já é de um cliente não cria outro (só dígitos ou com máscara)", async () => {
    h.current = admin;
    const loaded = await customer(cnpj("998887770001"), "Cliente do Sankhya");
    const count = async () =>
      (await getStore().list("parties", { filter: { type: "customer" } }))
        .length;
    const before = await count();
    expect(
      (await findCustomerByCnpjAction(cnpj("998887770001"))).existing,
    ).toMatchObject({
      id: loaded.id,
      name: "Cliente do Sankhya",
      code: "7777",
    });
    expect(
      await quickCustomerAction({
        cnpj: formatCnpj(cnpj("998887770001")),
        name: "Outro nome",
      }),
    ).toEqual({
      ok: false,
      existing: expect.objectContaining({ id: loaded.id, active: true }),
    });
    expect(await count()).toBe(before);
    // Cadastro completo grava como foi digitado (com a máscara).
    const typed = await customer(
      formatCnpj(cnpj("554443330001")),
      "Cliente digitado",
    );
    expect(
      (await findCustomerByCnpjAction(cnpj("554443330001"))).existing?.id,
    ).toBe(typed.id);
    // Inativo: não cria outro; a tela pede a reativação.
    const inactive = await customer(cnpj("667778880001"), "Inativo", false);
    expect(
      await quickCustomerAction({ cnpj: cnpj("667778880001"), name: "Novo" }),
    ).toEqual({
      ok: false,
      existing: expect.objectContaining({ id: inactive.id, active: false }),
    });
  });

  it("confere CNPJ, nome e e-mail no servidor", async () => {
    h.current = admin;
    expect(
      await quickCustomerAction({ cnpj: "11.222.333/0001-80", name: "X Ltda" }),
    ).toEqual({ ok: false, error: "cnpj_invalid" });
    expect(
      await quickCustomerAction({ cnpj: cnpj("123123120001"), name: "X" }),
    ).toEqual({ ok: false, error: "name" });
    expect(
      await quickCustomerAction({
        cnpj: cnpj("123123120001"),
        name: "Xa Ltda",
        email: "nao-e-email",
      }),
    ).toEqual({ ok: false, error: "email" });
    expect(await quickCustomerAction("lixo")).toEqual({
      ok: false,
      error: "failed",
    });
  });

  it("quem é de fora ou não abre a Nova solicitação não cadastra nem consulta", async () => {
    const doc = cnpj("321321320001");
    for (const user of [joao, finance]) {
      h.current = user;
      expect(
        await quickCustomerAction({ cnpj: doc, name: "Y Comércio" }),
      ).toEqual({ ok: false, error: "forbidden" });
    }
    h.current = joao;
    await customer(cnpj("443332220001"), "Cliente escondido");
    expect(await findCustomerByCnpjAction(cnpj("443332220001"))).toEqual({
      existing: null,
    });
    const created = await getStore().list("parties", {
      filter: { taxId: doc },
    });
    expect(created).toEqual([]);
  });
});
