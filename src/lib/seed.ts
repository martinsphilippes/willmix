import "server-only";

import {
  getStore,
  PARTY_EXTRA_DEFAULTS,
  PRODUCT_EXTRA_DEFAULTS,
  USER_EXTRA_DEFAULTS,
  LINE_EXTRA_DEFAULTS,
  type LinePrompts,
  type Product,
  type User,
} from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_PREPARATION_REQUIREMENTS } from "@/lib/workflow/stages";
import { boxCbm } from "@/lib/logistics/cbm";

export { DEMO_PARTIES, DEMO_PASSWORD, DEMO_USERS } from "./demo-data";
import {
  DEMO_PARTIES,
  DEMO_PASSWORD,
  DEMO_USERS,
  demoPartyFields,
  demoUserFields,
  type DemoParty,
  type DemoUser,
} from "./demo-data";

/** Marca onde a falha nasceu (tabela ou Appwrite Auth) para o motivo na tela. */
async function at<T>(where: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Error && !("where" in error))
      Object.assign(error, { where });
    throw error;
  }
}

async function createDemoParty(party: DemoParty) {
  await at("parties", () =>
    getStore().create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      ...demoPartyFields(party),
      type: party.type as never,
    }),
  );
}

/** Conta de demonstração: login no Appwrite Auth (produção) e linha em `users`. */
async function createDemoUser(u: DemoUser): Promise<User> {
  const store = getStore();
  if (store.mode === "appwrite") {
    // Autenticação fica no Appwrite Auth; a tabela users guarda papel e parceiro.
    const { createAdminClient } = await import("@/lib/appwrite/server");
    const { ID, Query } = await import("node-appwrite");
    const { users: authUsers } = createAdminClient();
    await at("auth", async () => {
      const found = await authUsers.list({
        queries: [Query.equal("email", u.email)],
      });
      if (found.total === 0)
        await authUsers.create({
          userId: ID.unique(),
          email: u.email,
          password: DEMO_PASSWORD,
          name: u.name,
        });
    });
  }
  return at("users", () =>
    store.create("users", {
      ...USER_EXTRA_DEFAULTS,
      ...demoUserFields(u),
      passwordHash:
        store.mode === "memory" ? hashPassword(DEMO_PASSWORD) : null,
    }),
  );
}

/** E-mails das contas de demonstração que existem no banco (ativas). */
export async function existingDemoAccounts(): Promise<Set<string>> {
  const rows = await getStore().list("users", {
    filter: { email: DEMO_USERS.map((u) => u.email) },
  });
  return new Set(rows.filter((u) => u.active).map((u) => u.email));
}

export interface DemoAccountsResult {
  /** Empresas e logins criados agora. */
  parties: string[];
  users: string[];
  /** Logins que não puderam ser criados (código do erro para a tela). */
  failed: Array<{ email: string; reason: string; detail?: string }>;
}

/**
 * Cria as empresas e os logins de demonstração que ainda não existem (um
 * papel novo no portal ganha a conta dele sem recriar o banco). Não mexe no
 * que já existe. Falha em uma conta não impede as outras.
 */
export async function ensureDemoAccounts(): Promise<DemoAccountsResult> {
  const store = getStore();
  const result: DemoAccountsResult = { parties: [], users: [], failed: [] };
  const partyIds = DEMO_PARTIES.map((p) => p.id);
  const haveParties = new Set(
    (await store.list("parties", { filter: { id: partyIds } })).map(
      (p) => p.id,
    ),
  );
  for (const party of DEMO_PARTIES) {
    if (haveParties.has(party.id)) continue;
    try {
      await createDemoParty(party);
      result.parties.push(party.id);
    } catch (error) {
      result.failed.push({ email: party.email, ...reasonOf(error, party.id) });
    }
  }
  const haveUsers = new Set(
    (
      await store.list("users", {
        filter: { email: DEMO_USERS.map((u) => u.email) },
      })
    ).map((u) => u.email),
  );
  for (const u of DEMO_USERS) {
    if (haveUsers.has(u.email)) continue;
    // Sem a empresa (falhou acima), o login ficaria órfão; a falha da
    // empresa já está na lista com esse e-mail.
    if (
      u.party &&
      !haveParties.has(u.party) &&
      !result.parties.includes(u.party)
    ) {
      if (!result.failed.some((f) => f.email === u.email))
        result.failed.push({ email: u.email, reason: "party_missing" });
      continue;
    }
    try {
      await createDemoUser(u);
      result.users.push(u.email);
    } catch (error) {
      result.failed.push({ email: u.email, ...reasonOf(error, u.email) });
    }
  }
  return result;
}

/**
 * Código do motivo (a tela traduz; a mensagem inteira vai para o registro do
 * servidor): esquema ainda não publicado (coluna, tabela ou valor novo de
 * papel/tipo recusado pelo Appwrite) ou erro inesperado.
 */
export function demoFailureReason(
  error: unknown,
): "schema_outdated" | "unexpected" {
  const type = String((error as { type?: unknown } | null)?.type ?? "");
  const message = error instanceof Error ? error.message : String(error);
  if (
    [
      "document_invalid_structure",
      "row_invalid_structure",
      "attribute_not_found",
      "column_not_found",
      "table_not_found",
      "collection_not_found",
    ].includes(type) ||
    /invalid document structure|invalid format|unknown attribute|attribute not found|not found in schema|missing required attribute|invalid.*enum|not a valid enum/i.test(
      message,
    ) ||
    /^(table|collection) with the requested id\b.*could not be found/i.test(
      message,
    )
  )
    return "schema_outdated";
  return "unexpected";
}

/**
 * Detalhe técnico, só códigos (vai na URL e aparece na tela): onde falhou
 * (parties.type, users.role, auth) e o tipo de erro do Appwrite
 * (document_invalid_structure…). Sem isso o administrador só via "esquema
 * desatualizado" sem saber qual coluna, e o registro do servidor não está
 * à mão de quem opera o portal.
 */
export function demoFailureDetail(error: unknown): string | undefined {
  const e = error as { where?: unknown; type?: unknown } | null;
  const where = /^[a-z_]{1,30}$/.test(String(e?.where ?? ""))
    ? String(e?.where)
    : "";
  const type = /^[a-z_]{1,60}$/.test(String(e?.type ?? ""))
    ? String(e?.type)
    : "";
  const message = error instanceof Error ? error.message : String(error);
  const column =
    where && where !== "auth"
      ? /attribute[:\s]+"?([A-Za-z_][A-Za-z0-9_]{0,60})"?/i.exec(message)?.[1]
      : undefined;
  const place = column ? `${where}.${column}` : where;
  const detail = [place, type].filter(Boolean).join(":");
  return detail || undefined;
}

function reasonOf(error: unknown, who: string) {
  console.error("[demo] conta de demonstração não criada", who, error);
  return { reason: demoFailureReason(error), detail: demoFailureDetail(error) };
}

/**
 * Cria usuários, parceiros, linhas e produtos de demonstração. Idempotente:
 * com o banco já populado, só completa as contas de demonstração que faltam
 * (ensureDemoAccounts) e devolve o que criou em `added`.
 */
export async function seedDemo(): Promise<{
  created: boolean;
  users: User[];
  added: DemoAccountsResult;
}> {
  const store = getStore();
  const existing = await store.list("users", { limit: 1 });
  if (existing.length > 0) {
    const added = await ensureDemoAccounts();
    return { created: false, users: await store.list("users"), added };
  }

  for (const party of DEMO_PARTIES) await createDemoParty(party);

  // Uma conta que falhe (ex.: login já existia no Appwrite Auth) não
  // interrompe a carga: linhas, produtos e o resto ainda são criados, e a
  // conta pode ser completada depois em Configurações.
  const users: User[] = [];
  for (const u of DEMO_USERS) {
    try {
      users.push(await createDemoUser(u));
    } catch (error) {
      console.error("[seed] conta de demonstração não criada", u.email, error);
    }
  }

  // Brinquedos e infláveis exigem Inmetro; utilidades (usada pelo E2E) não exige nada.
  const lines: Array<{
    id: string;
    name: string;
    requirements: typeof DEFAULT_PREPARATION_REQUIREMENTS;
    requiredCertifications?: string[];
    prompts?: LinePrompts;
  }> = [
    {
      id: "linha-utilidades",
      name: "Utilidades domésticas",
      requirements: DEFAULT_PREPARATION_REQUIREMENTS,
      // Prompts por linha (Visão de Produto): base + linha + produto + contexto.
      prompts: {
        descriptionPrompt:
          "Utilidades domésticas para o varejo brasileiro: destaque uso, capacidade e material; nada de promessas técnicas.",
        marketingPrompt:
          "Tom prático e acolhedor, foco em praticidade no dia a dia da casa.",
        imagePrompt: "Ambiente de cozinha clara, produto em primeiro plano.",
        requiredAttributes: ["material", "cor", "dimensões"],
        validationRules: ["Não citar marcas de terceiros"],
      },
    },
    {
      id: "linha-brinquedos",
      name: "Brinquedos",
      requirements: DEFAULT_PREPARATION_REQUIREMENTS,
      requiredCertifications: ["Inmetro"],
    },
    {
      id: "linha-inflaveis",
      name: "Infláveis",
      requirements: DEFAULT_PREPARATION_REQUIREMENTS,
      requiredCertifications: ["Inmetro"],
    },
  ];
  for (const line of lines) {
    await store.create("product_lines", {
      ...LINE_EXTRA_DEFAULTS,
      id: line.id,
      name: line.name,
      manualDocumentId: null,
      requirements: line.requirements,
      requiredCertifications: line.requiredCertifications ?? null,
      prompts: line.prompts ?? null,
      active: true,
    });
  }
  // A jarra fica sem ficha completa de propósito: o E2E usa esse produto e a
  // inspeção só compara atributos presentes no snapshot da compra.
  const products: Array<
    { id: string; lineId: string; name: string; sku: string } & Partial<Product>
  > = [
    {
      id: "prod-jarra",
      lineId: "linha-utilidades",
      name: "Jarra de vidro 1,5 L",
      sku: "UTL-001",
    },
    {
      id: "prod-panela",
      lineId: "linha-utilidades",
      name: "Jogo de panelas antiaderentes 5 pçs",
      sku: "UTL-002",
      supplierId: "fornecedor-a",
      supplierSku: "SZA-PAN5",
      category: "Cozinha",
      material: "Alumínio com revestimento antiaderente",
      color: "Preto",
      pantone: "Black 6 C",
      moq: 500,
      price: 9.5,
      currency: "USD",
      masterBoxQty: 4,
      innerBoxQty: 1,
      netWeightKg: 2.4,
      grossWeightKg: 2.9,
      lengthCm: 30,
      widthCm: 30,
      heightCm: 20,
      boxLengthCm: 62,
      boxWidthCm: 32,
      boxHeightCm: 42,
      source: "sourcing",
      priceTiers: [
        { minQty: 500, price: 9.5 },
        { minQty: 1000, price: 8.9 },
        { minQty: 2000, price: 8.2 },
      ],
    },
    {
      id: "prod-boneca",
      lineId: "linha-brinquedos",
      name: "Boneca articulada 30 cm",
      sku: "BRQ-001",
      supplierId: "fornecedor-b",
      supplierSku: "GZB-DOLL30",
      category: "Bonecas",
      material: "PVC atóxico",
      color: "Sortido",
      moq: 2000,
      price: 3.2,
      currency: "USD",
      masterBoxQty: 48,
      innerBoxQty: 6,
      netWeightKg: 0.28,
      grossWeightKg: 0.35,
      lengthCm: 12,
      widthCm: 8,
      heightCm: 32,
      boxLengthCm: 52,
      boxWidthCm: 34,
      boxHeightCm: 68,
      source: "import",
      priceTiers: [
        { minQty: 2000, price: 3.2 },
        { minQty: 5000, price: 2.95 },
      ],
    },
    {
      id: "prod-piscina",
      lineId: "linha-inflaveis",
      name: "Piscina inflável 2.000 L",
      sku: "INF-001",
      supplierId: "fornecedor-c",
      category: "Lazer",
      material: "PVC 0,4 mm",
      color: "Azul",
      moq: 300,
      price: 14.8,
      currency: "USD",
      masterBoxQty: 6,
      netWeightKg: 3.1,
      grossWeightKg: 3.6,
      boxLengthCm: 60,
      boxWidthCm: 40,
      boxHeightCm: 50,
      source: "manual",
    },
  ];
  for (const product of products) {
    const { id, lineId, name, sku, ...sheet } = product;
    await store.create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      id,
      lineId,
      name,
      sku,
      specification: null,
      active: true,
      source: "manual",
      ...sheet,
      cbm: boxCbm(sheet),
    });
  }

  // A boneca tem Inmetro válido; a piscina (linha que exige) não tem: mostra o gate de conformidade.
  await store.create("certifications", {
    entity: "product",
    entityId: "prod-boneca",
    kind: "Inmetro",
    name: "Certificado de conformidade Inmetro",
    issuer: "OCP credenciado",
    number: "INMETRO-2026-0421",
    validUntil: new Date(Date.now() + 300 * 86400000).toISOString(),
    documentId: null,
    status: "valid",
    notes: null,
    createdByUserId: users[0].id,
    validatedByUserId: users[0].id,
    validatedAt: new Date().toISOString(),
  });

  // Sourcing de demonstração: uma visita e um produto encontrado ainda não promovido.
  const visit = await store.create("supplier_visits", {
    id: "visita-canton",
    supplierId: "fornecedor-c",
    supplierName: "Ningbo Supplier C",
    factoryName: "Fábrica de plásticos de Ningbo",
    city: "Guangzhou",
    address: null,
    location: "Feira de Cantão, pavilhão 3",
    visitedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    participants: "Ana Admin, Otávio Operador",
    notes: "Bom padrão de acabamento; negociar MOQ menor na próxima rodada.",
    nextVisitAt: new Date(Date.now() + 40 * 86400000).toISOString(),
    followUp: "Pedir amostra da boia infantil e proposta com MOQ 200.",
    status: "done",
    createdByUserId: users[0].id,
  });
  await store.create("sourcing_items", {
    id: "sourcing-boia",
    visitId: visit.id,
    supplierId: "fornecedor-c",
    supplierName: "Ningbo Supplier C",
    productId: null,
    lineId: "linha-inflaveis",
    category: "Lazer",
    name: "Boia infantil com cobertura solar",
    description: "Boia com assento e cobertura removível, 0-2 anos.",
    supplierSku: "NBC-FLT02",
    material: "PVC 0,3 mm",
    color: "Amarelo",
    pantone: "Yellow C",
    price: 4.1,
    currency: "USD",
    moq: 500,
    masterBoxQty: 24,
    innerBoxQty: 6,
    netWeightKg: 0.45,
    grossWeightKg: 0.55,
    widthCm: 70,
    heightCm: 25,
    lengthCm: 70,
    boxLengthCm: 55,
    boxWidthCm: 45,
    boxHeightCm: 40,
    cbm: boxCbm({ boxLengthCm: 55, boxWidthCm: 45, boxHeightCm: 40 }),
    conditions: "FOB Ningbo, 30% sinal, saldo contra BL",
    notes: "Amostra prometida em 15 dias.",
    foundAt: visit.visitedAt,
    city: "Guangzhou",
    location: "Feira de Cantão, pavilhão 3",
    status: "negotiating",
    primaryPhotoDocumentId: null,
    createdByUserId: users[0].id,
    requestId: null,
    priceTiers: null,
  });

  // Marketing studio: um kit em rascunho para o cliente, alimentado pela ficha da panela.
  await store.create("marketing_kits", {
    id: "kit-panela",
    productId: "prod-panela",
    customerId: "cliente-joao",
    name: "Kit de marketing · Jogo de panelas antiaderentes 5 pçs",
    price: 200,
    currency: "BRL",
    status: "draft",
    concept: null,
    slogan: null,
    description: null,
    campaign: null,
    colors: ["Preto"],
    pantone: "Black 6 C",
    previewDocumentIds: [],
    releasedDocumentIds: [],
    paymentId: null,
    offeredAt: null,
    purchasedAt: null,
    paidAt: null,
    releasedAt: null,
    notes: null,
    createdByUserId: users[0].id,
  });
  return {
    created: true,
    users,
    added: {
      parties: DEMO_PARTIES.map((p) => p.id),
      users: users.map((u) => u.email),
      failed: DEMO_USERS.filter(
        (u) => !users.some((c) => c.email === u.email),
      ).map((u) => ({ email: u.email, reason: "unexpected" })),
    },
  };
}
