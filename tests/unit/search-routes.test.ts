import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Rotas dos campos com busca (auditoria de performance, 14/11/2026): cada
 * uma responde só a quem abre a tela que já mostrava aquela lista inteira;
 * para os outros, 404 (como a rota não existisse).
 */
withTempStore();

let current: unknown = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => current,
}));
vi.mock("@/i18n/server", async () => {
  const { translator } = await import("@/i18n");
  return { getT: async () => translator("pt"), getLocale: async () => "pt" };
});

const { seedDemo } = await import("@/lib/seed");
const { attachAccess } = await import("@/lib/auth/access-cache");
const { ensureStockParty, STOCK_PARTY_ID } =
  await import("@/lib/services/stock-party");
const parties = await import("@/app/api/parties/search/route");
const products = await import("@/app/api/products/search/route");
const fill = await import("@/app/api/products/fill/route");
const targets = await import("@/app/api/messages/targets/route");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplier: User;
/** Parceiro de fora com só Containers liberado na Gestão de telas. */
let containersOnly: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
  const logistics = users.find((u) => u.role === "logistics")!;
  containersOnly = { ...logistics };
  attachAccess(containersOnly, {
    screens: [],
    actions: [],
    external: ["home", "containers"],
  });
  await ensureStockParty(admin);
});

async function get(
  route: { GET: (r: Request) => Promise<Response> },
  path: string,
  who: User | null,
) {
  current = who;
  const res = await route.GET(new Request(`http://localhost${path}`));
  const body = (await res.json()) as {
    options?: Array<{ id: string; name: string; hint?: string | null }>;
    fill?: { id: string };
  };
  return { status: res.status, body };
}

describe("/api/parties/search", () => {
  it("Wellmix busca qualquer tipo; o estoque só com stock=1", async () => {
    const sup = await get(
      parties,
      "/api/parties/search?type=supplier&q=supplier",
      admin,
    );
    expect(sup.status).toBe(200);
    expect(sup.body.options!.length).toBeGreaterThan(0);
    const ids = async (path: string) =>
      (await get(parties, path, admin)).body.options!.map((o) => o.id);
    expect(
      await ids("/api/parties/search?type=customer&q=estoque"),
    ).not.toContain(STOCK_PARTY_ID);
    expect(
      await ids("/api/parties/search?type=customer&q=estoque&stock=1"),
    ).toContain(STOCK_PARTY_ID);
  });

  it("perfil de fora só com Containers: clientes sim, fornecedores não", async () => {
    const customers = await get(
      parties,
      "/api/parties/search?type=customer&q=loja",
      containersOnly,
    );
    expect(customers.status).toBe(200);
    expect(customers.body.options!.map((o) => o.id)).toContain("cliente-joao");
    expect(
      (
        await get(
          parties,
          "/api/parties/search?type=supplier&q=supplier",
          containersOnly,
        )
      ).status,
    ).toBe(404);
  });

  it("fornecedor e quem não entrou: 404", async () => {
    expect(
      (await get(parties, "/api/parties/search?type=customer&q=loja", supplier))
        .status,
    ).toBe(404);
    expect(
      (await get(parties, "/api/parties/search?type=customer&q=loja", null))
        .status,
    ).toBe(404);
  });
});

describe("/api/products/search e /api/products/fill", () => {
  it("Wellmix: rótulo 'Nome (SKU)' em cada escopo", async () => {
    for (const scope of ["all", "active", "catalog"]) {
      const res = await get(
        products,
        `/api/products/search?scope=${scope}&q=utl-001`,
        admin,
      );
      expect(res.status).toBe(200);
      expect(res.body.options).toContainEqual({
        id: "prod-jarra",
        name: "Jarra de vidro 1,5 L (UTL-001)",
      });
    }
    expect(
      (await get(products, "/api/products/search?scope=outro&q=jarra", admin))
        .status,
    ).toBe(400);
  });

  it("cliente: só o catálogo e a ficha; fornecedor: nada", async () => {
    expect(
      (await get(products, "/api/products/search?scope=catalog&q=jarra", joao))
        .status,
    ).toBe(200);
    expect(
      (await get(products, "/api/products/search?scope=all&q=jarra", joao))
        .status,
    ).toBe(404);
    const ok = await get(fill, "/api/products/fill?id=prod-jarra", joao);
    expect(ok.status).toBe(200);
    expect(ok.body.fill!.id).toBe("prod-jarra");
    expect(
      (
        await get(
          products,
          "/api/products/search?scope=catalog&q=jarra",
          supplier,
        )
      ).status,
    ).toBe(404);
    expect(
      (await get(fill, "/api/products/fill?id=prod-jarra", supplier)).status,
    ).toBe(404);
  });

  it("ficha: produto desativado ou inexistente não sai", async () => {
    const { getStore } = await import("@/lib/db");
    await getStore().update("products", "prod-boneca", { active: false });
    expect(
      (await get(fill, "/api/products/fill?id=prod-boneca", admin)).status,
    ).toBe(404);
    expect(
      (await get(fill, "/api/products/fill?id=nao-existe", admin)).status,
    ).toBe(404);
    expect((await get(fill, "/api/products/fill?id=a%20b", admin)).status).toBe(
      400,
    );
    await getStore().update("products", "prod-boneca", { active: true });
  });
});

describe("/api/messages/targets", () => {
  it("só a Wellmix; empresa com o tipo ao lado", async () => {
    const res = await get(targets, "/api/messages/targets?q=trans", admin);
    expect(res.status).toBe(200);
    expect(res.body.options).toContainEqual({
      id: "party:transportador",
      name: "Trans Rodo",
      hint: "Transportador",
    });
    expect(
      (await get(targets, "/api/messages/targets?q=trans", joao)).status,
    ).toBe(404);
    expect(
      (await get(targets, "/api/messages/targets?q=trans", supplier)).status,
    ).toBe(404);
  });
});
