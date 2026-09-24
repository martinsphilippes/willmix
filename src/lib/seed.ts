import "server-only";

import { getStore, type Role, type User } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_PREPARATION_REQUIREMENTS } from "@/lib/workflow/stages";

/** Senha única de demonstração. Só existe no modo memória. */
export const DEMO_PASSWORD = "willmix123";

export const DEMO_USERS: Array<{
  email: string;
  name: string;
  role: Role;
  party: string | null;
  locale: "pt" | "en" | "zh";
}> = [
  { email: "admin@willmix.com", name: "Ana Admin", role: "admin", party: null, locale: "pt" },
  { email: "operador@willmix.com", name: "Otávio Operador", role: "operator", party: null, locale: "pt" },
  { email: "joao@lojista.com", name: "João Cliente", role: "customer", party: "cliente-joao", locale: "pt" },
  { email: "supplier.a@china.com", name: "Li Wei", role: "supplier", party: "fornecedor-a", locale: "zh" },
  { email: "supplier.b@china.com", name: "Chen Yu", role: "supplier", party: "fornecedor-b", locale: "en" },
  { email: "supplier.c@china.com", name: "Wang Fang", role: "supplier", party: "fornecedor-c", locale: "zh" },
  { email: "agencia@design.com", name: "Agência Criativa", role: "agency", party: "agencia", locale: "pt" },
  { email: "despachante@comex.com", name: "Diego Despachante", role: "broker", party: "despachante", locale: "pt" },
  { email: "armador@maritima.com", name: "Marítima SA", role: "shipping_line", party: "armador", locale: "en" },
  { email: "transportadora@rodo.com", name: "Trans Rodo", role: "carrier", party: "transportador", locale: "pt" },
  { email: "juridico@willmix.com", name: "Júlia Jurídico", role: "legal", party: null, locale: "pt" },
];

/** Cria usuários, parceiros, linhas e produtos de demonstração. Idempotente. */
export async function seedDemo(): Promise<{ created: boolean; users: User[] }> {
  const store = getStore();
  const existing = await store.list("users", { limit: 1 });
  if (existing.length > 0) {
    return { created: false, users: await store.list("users") };
  }

  const parties: Array<{ id: string; type: Role | "shipping_line"; name: string; country: string; email: string }> = [
    { id: "cliente-joao", type: "customer", name: "Loja do João Ltda", country: "BR", email: "joao@lojista.com" },
    { id: "fornecedor-a", type: "supplier", name: "Shenzhen Supplier A", country: "CN", email: "supplier.a@china.com" },
    { id: "fornecedor-b", type: "supplier", name: "Guangzhou Supplier B", country: "CN", email: "supplier.b@china.com" },
    { id: "fornecedor-c", type: "supplier", name: "Ningbo Supplier C", country: "CN", email: "supplier.c@china.com" },
    { id: "agencia", type: "agency", name: "Agência Criativa", country: "BR", email: "agencia@design.com" },
    { id: "despachante", type: "broker", name: "Comex Despachos", country: "BR", email: "despachante@comex.com" },
    { id: "armador", type: "shipping_line", name: "Marítima SA", country: "BR", email: "armador@maritima.com" },
    { id: "transportador", type: "carrier", name: "Trans Rodo", country: "BR", email: "transportadora@rodo.com" },
  ];
  for (const party of parties) {
    await store.create("parties", {
      id: party.id,
      type: party.type as never,
      name: party.name,
      country: party.country,
      email: party.email,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
    });
  }

  const passwordHash = hashPassword(DEMO_PASSWORD);
  const users: User[] = [];
  for (const u of DEMO_USERS) {
    users.push(
      await store.create("users", {
        email: u.email,
        name: u.name,
        role: u.role,
        partyId: u.party,
        locale: u.locale,
        passwordHash,
        active: true,
      }),
    );
  }

  const lines = [
    { id: "linha-utilidades", name: "Utilidades domésticas", requirements: DEFAULT_PREPARATION_REQUIREMENTS },
    { id: "linha-brinquedos", name: "Brinquedos", requirements: DEFAULT_PREPARATION_REQUIREMENTS },
    { id: "linha-inflaveis", name: "Infláveis", requirements: DEFAULT_PREPARATION_REQUIREMENTS },
  ];
  for (const line of lines) {
    await store.create("product_lines", {
      id: line.id,
      name: line.name,
      manualDocumentId: null,
      requirements: line.requirements,
      active: true,
    });
  }
  const products = [
    { id: "prod-jarra", lineId: "linha-utilidades", name: "Jarra de vidro 1,5 L", sku: "UTL-001" },
    { id: "prod-panela", lineId: "linha-utilidades", name: "Jogo de panelas antiaderentes 5 pçs", sku: "UTL-002" },
    { id: "prod-boneca", lineId: "linha-brinquedos", name: "Boneca articulada 30 cm", sku: "BRQ-001" },
    { id: "prod-piscina", lineId: "linha-inflaveis", name: "Piscina inflável 2.000 L", sku: "INF-001" },
  ];
  for (const product of products) {
    await store.create("products", {
      id: product.id,
      lineId: product.lineId,
      name: product.name,
      sku: product.sku,
      specification: null,
      active: true,
    });
  }
  return { created: true, users };
}
